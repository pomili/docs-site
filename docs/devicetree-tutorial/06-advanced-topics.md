# 第6章：设备树高级应用

## 6.1 Pin Control 深度解析

### 6.1.1 Pin Control 的设计动机

在传统 Zephyr (v2.x) 中，引脚配置直接写在外设节点的属性中：

```dts
// 旧式写法 (已废弃)
&uart0 {
    tx-pin = <6>;
    rx-pin = <8>;
    rts-pin = <5>;
    cts-pin = <7>;
};
```

新式 Pin Control (v3.x+) 将引脚配置抽到独立的 pinctrl 节点中：

```dts
// 新式写法 (推荐)
&uart0 {
    pinctrl-0 = <&uart0_default>;
    pinctrl-1 = <&uart0_sleep>;
    pinctrl-names = "default", "sleep";
};

&pinctrl {
    uart0_default: uart0_default {
        group1 {
            psels = <NRF_PSEL(UART_TX, 0, 6)>,
                    <NRF_PSEL(UART_RTS, 0, 5)>;
        };
        group2 {
            psels = <NRF_PSEL(UART_RX, 0, 8)>,
                    <NRF_PSEL(UART_CTS, 0, 7)>;
            bias-pull-up;
        };
    };
};
```

**新写法优势**：
1. **状态管理** — `default` (运行) / `sleep` (低功耗) 两个状态自动切换
2. **群组分隔** — 将同一电气特性的引脚放在一个 group
3. **可复用** — pinctrl 节点可以在多个 overlay 中引用
4. **类型安全** — `NRF_PSEL()` 宏强制指定功能角色

### 6.1.2 nRF52840 的 Pin Control 选项

```dts
group1 {
    // 引脚选择 (必需)
    psels = <NRF_PSEL(UART_TX, 0, 6)>;    // 功能=UART_TX, Port=0, Pin=6

    // 偏置配置 (可选)
    bias-pull-up;                          // 上拉
    bias-pull-down;                        // 下拉
    bias-disable;                          // 无偏置

    // 驱动能力 (可选)
    drive-mode = "standard";               // 标准驱动
    drive-mode = "high-drive";             // 高驱动 (nRF: H0H1)

    // 低功耗模式 (sleep 状态)
    low-power-enable;                      // 睡眠时断开引脚

    // 输入缓冲
    input-enable;                          // 使能输入 (RX 引脚)
    input-disable;                         // 禁用输入 (TX 引脚省电)
    input-schmitt-enable;                  // 施密特触发

    // Nordic 特有: 引脚断开
    nordic,drive-mode = <NRF_DRIVE_S0S1>;  // 标准 0/1 驱动
    nordic,drive-mode = <NRF_DRIVE_H0H1>;  // 高驱动
};
```

### 6.1.3 多状态 Pin Control 的工作机制

```dts
&uart0 {
    pinctrl-0 = <&uart0_default>;   // 索引 0 ←→ "default"
    pinctrl-1 = <&uart0_sleep>;     // 索引 1 ←→ "sleep"
    pinctrl-names = "default", "sleep";
};
```

当系统进入低功耗模式时，Zephyr 的电源管理框架会自动：
1. 保存当前引脚配置
2. 切换到 `uart0_sleep` 配置 (断开不用的引脚，省电)
3. 唤醒时恢复 `uart0_default`

### 6.1.4 实际功耗对比

nRF52840 的引脚在断开状态 vs 保持驱动状态的功耗差异：

```
所有未用引脚设为 low-power-enable:  ~1.5 μA  (System ON, no RAM retention)
所有未用引脚保持默认驱动状态:      ~200 μA (同样条件下)
                                   ↑ 130 倍反差
```

## 6.2 多实例设备管理

### 6.2.1 当你有多个相同的设备

```dts
// 两个相同的 SPI Flash 芯片，但用途不同
&spi1 {
    cs-gpios = <&gpio0 17 GPIO_ACTIVE_LOW>,
               <&gpio0 18 GPIO_ACTIVE_LOW>;

    code_flash: flash@0 {
        compatible = "jedec,spi-nor";
        reg = <0>;
        spi-max-frequency = <8000000>;
    };

    data_flash: flash@1 {
        compatible = "jedec,spi-nor";
        reg = <1>;
        spi-max-frequency = <8000000>;
    };
};
```

在 C 代码中区分两个实例：

```c
// 方式 1：通过节点标签获取
const struct device *code_flash = DEVICE_DT_GET(DT_NODELABEL(code_flash));
const struct device *data_flash = DEVICE_DT_GET(DT_NODELABEL(data_flash));

// 方式 2：通过别名
// aliases { code-flash = &code_flash; data-flash = &data_flash; };
const struct device *code_flash = DEVICE_DT_GET(DT_ALIAS(code_flash));
const struct device *data_flash = DEVICE_DT_GET(DT_ALIAS(data_flash));

// 方式 3：遍历所有实例 (在驱动代码中)
#define FLASH_INST(n) \
    static const struct device *flash_dev_##n = DEVICE_DT_GET(DT_DRV_INST(n));
DT_INST_FOREACH_STATUS_OKAY(FLASH_INST)
```

### 6.2.2 同一外设选择不同实例

```dts
// I2C0 同时连接 BME280 和 MPU6050
// SPI1 连接外部 Flash

// 选择使用哪种组合取决于应用场景
&i2c0 {
    status = "okay";
};

// 不用的外设明确禁用
&i2c1 { status = "disabled"; };     // 避免浪费资源
&spi0 { status = "disabled"; };
&spi2 { status = "disabled"; };
```

## 6.3 电源域 (Power Domain) 与设备树

nRF52840 只有一个主电源域 (VDD)，但复杂的 SoC 可以有多个。

```dts
// nRF5340 有独立的 Network Core 和 Application Core 电源域
// 这是概念性示例 (nRF52840 无此特性)
soc {
    app_core: cpu@0 {
        compatible = "arm,cortex-m33f";
        power-domain = <&app_power>;
    };
    net_core: cpu@1 {
        compatible = "arm,cortex-m33";
        power-domain = <&net_power>;
    };
};
```

在 nRF52840 中，电源管理主要体现在：
- `regulator-fixed` 节点描述外部稳压器
- `vdd-supply` / `vddh-supply` 等属性连接传感器到电源

### 6.3.1 传感器电源控制

```dts
// 当传感器有独立的使能引脚
&i2c0 {
    bme280@76 {
        compatible = "bosch,bme280";
        reg = <0x76>;
        vdd-supply = <&sensor_regulator>;
    };
};

// 用 GPIO 模拟稳压器使能
sensor_regulator: regulator-sensor {
    compatible = "regulator-fixed";
    regulator-name = "sensor-3v3";
    enable-gpios = <&gpio0 21 GPIO_ACTIVE_HIGH>;
    regulator-boot-on;                    // 启动时自动开启
};
```

驱动中使用：
```c
// 在驱动 init 函数中
static int bme280_init(const struct device *dev)
{
    // Zephyr 电源管理框架自动处理 vdd-supply
    // pm_device_action_run(dev, PM_DEVICE_ACTION_RESUME);
    // → 自动使能 regulator-sensor
    ...
}
```

## 6.4 自定义总线 (Custom Bus)

### 6.4.1 Bit-banging I2C (GPIO 模拟)

当 SoC 的内置 I2C 控制器不够用时，可以用 GPIO 模拟：

```dts
// app.overlay
/ {
    i2c_bitbang: i2c-bitbang {
        compatible = "zephyr,i2c-bitbang";
        status = "okay";

        scl-gpios = <&gpio0 22 (GPIO_OPEN_DRAIN | GPIO_PULL_UP)>;
        sda-gpios = <&gpio0 23 (GPIO_OPEN_DRAIN | GPIO_PULL_UP)>;

        #address-cells = <1>;
        #size-cells = <0>;

        clock-frequency = <50000>;   // 50 kHz (GPIO 模拟上限)

        eeprom@50 {
            compatible = "atmel,at24c02";
            reg = <0x50>;
        };
    };
};
```

### 6.4.2 Bit-banging SPI

```dts
/ {
    spi_bitbang: spi-bitbang {
        compatible = "zephyr,spi-bitbang";
        status = "okay";

        sclk-gpios = <&gpio0 27 GPIO_ACTIVE_LOW>;
        mosi-gpios = <&gpio0 28 GPIO_ACTIVE_LOW>;
        miso-gpios = <&gpio0 29 GPIO_ACTIVE_LOW>;

        #address-cells = <1>;
        #size-cells = <0>;
    };
};
```

## 6.5 设备树的 `zephyr,user` 节点

这是 Zephyr 特有的**通用用户节点**，用于声明应用需要但不符合任何标准 binding 的硬件资源。

```dts
/ {
    zephyr,user {
        // 声明需要哪些 ADC 通道
        io-channels = <&adc 0>, <&adc 1>, <&adc 2>;

        // 声明需要使用哪些 GPIO
        my-gpios = <&gpio0 2 0>, <&gpio1 5 0>;

        // 声明 PPI 通道
        ppi-ch = <0>;
    };
};
```

C 代码中访问：
```c
// 通过 DT_PATH(zephyr_user) 访问
#define USER_NODE DT_PATH(zephyr_user)

static const struct gpio_dt_spec my_gpio =
    GPIO_DT_SPEC_GET_BY_IDX(USER_NODE, my_gpios, 0);  // 第一个 my-gpio

static const struct adc_dt_spec adc_ch0 =
    ADC_DT_SPEC_GET_BY_IDX(USER_NODE, 0);     // 第一个 io-channel
```

## 6.6 nRF52840 特有的高级设备树用法

### 6.6.1 PPI (Programmable Peripheral Interconnect)

PPI 是 nRF52840 独有的硬件特性——外设事件直接触发外设任务，**不经过 CPU**。

```dts
// DTS 不直接配置 PPI 通道 (Zephyr 3.x 中没有标准 binding)
// PPI 在运行时通过 API 配置，但设备树确保相关外设已启用

// 确保 GPIOTE 和 TIMER 外设可用
&gpiote {
    status = "okay";
};

&timer0 {
    status = "okay";
};
```

```c
// PPI 的 C API (非设备树操作)
#include <nrfx_ppi.h>

void configure_ppi(void)
{
    nrf_ppi_channel_t ppi_ch;
    nrfx_ppi_channel_alloc(&ppi_ch);        // 分配 PPI 通道

    // GPIOTE 事件 (按键按下) → TIMER 任务 (开始计时)
    nrfx_ppi_channel_assign(ppi_ch,
        nrf_gpiote_event_address_get(NRF_GPIOTE_EVENTS_IN_0),
        nrf_timer_task_address_get(NRF_TIMER0, NRF_TIMER_TASK_START));

    nrfx_ppi_channel_enable(ppi_ch);
}
```

### 6.6.2 QSPI 的特殊引脚配置

nRF52840 的 QSPI 有**专用的物理引脚**，不通过 PSEL 寄存器配置：

```dts
&qspi {
    status = "okay";
    compatible = "nordic,nrf-qspi";

    // QSPI 引脚由硬件固定：
    //   CS   = P0.17
    //   SCK  = P0.19
    //   DIO0 = P0.20  (MOSI/IO0)
    //   DIO1 = P0.21  (MISO/IO1)
    //   DIO2 = P0.22  (IO2)
    //   DIO3 = P0.23  (IO3)

    // 需要设置的是引脚驱动强度，不是引脚号
    pinctrl-0 = <&qspi_default>;
    pinctrl-1 = <&qspi_sleep>;
    pinctrl-names = "default", "sleep";

    mx25r64: mx25r6435f@0 {
        compatible = "nordic,qspi-nor";
        reg = <0>;
        sck-frequency = <8000000>;      // 8 MHz
        quad-enable-requirements = "NONE";  // MX25R64 不需要 QE 位
    };
};

&pinctrl {
    qspi_default: qspi_default {
        group1 {
            psels = <NRF_PSEL(QSPI_SCK,  0, 19)>,
                    <NRF_PSEL(QSPI_IO0,  0, 20)>,
                    <NRF_PSEL(QSPI_IO1,  0, 21)>,
                    <NRF_PSEL(QSPI_IO2,  0, 22)>,
                    <NRF_PSEL(QSPI_IO3,  0, 23)>,
                    <NRF_PSEL(QSPI_CSN,  0, 17)>;
            nordic,drive-mode = <NRF_DRIVE_H0H1>;  // 高频 → 高驱动
        };
    };
    qspi_sleep: qspi_sleep {
        group1 {
            psels = <NRF_PSEL(QSPI_SCK,  0, 19)>,
                    <NRF_PSEL(QSPI_IO0,  0, 20)>,
                    <NRF_PSEL(QSPI_IO1,  0, 21)>,
                    <NRF_PSEL(QSPI_IO2,  0, 22)>,
                    <NRF_PSEL(QSPI_IO3,  0, 23)>,
                    <NRF_PSEL(QSPI_CSN,  0, 17)>;
            low-power-enable;
        };
    };
};
```

**QSPI 的约束**：
- 如果使用 QSPI，这些引脚不能用作普通 GPIO
- QSPI 的引脚是**固定的**，只能在这些引脚上使用 QSPI
- `sck-frequency` 影响 Flash 读取速度，取决于走线质量和 PCB 设计

### 6.6.3 NFC 引脚复用为 GPIO

nRF52840 的 NFC 功能使用 P0.09 和 P0.10，默认被 NFC 占用。如果要当普通 GPIO 用：

```dts
// 需要禁用 NFC 标签功能
&nfct {
    status = "disabled";
};

// 然后这两个引脚就可以当普通 GPIO
/ {
    my_nfc_gpios {
        compatible = "gpio-leds";
        user_led_extra1 {
            gpios = <&gpio0 9 GPIO_ACTIVE_LOW>;    // P0.09
        };
        user_led_extra2 {
            gpios = <&gpio0 10 GPIO_ACTIVE_LOW>;   // P0.10
        };
    };
};
```

对应的 Kconfig：
```kconfig
CONFIG_NFCT=n         # 禁用 NFC Tag 驱动
CONFIG_NFC_OOB=n      # 禁用 NFC OOB 配对
```

## 6.7 设备树的编译时计算

Zephyr 的设备树宏支持编译时计算，减少运行时开销：

```c
// 编译时提取并组合信息
#define LED_COUNT DT_NUM_MACROS(DT_NODELABEL(leds))  // LED 子节点数量

// 编译时检查
BUILD_ASSERT(LED_COUNT == 4, "Expected 4 LEDs on this board");

// 编译时查找
#define NODE_WITH_REG(node_id, reg_val)                                    \
    COND_CODE_1(DT_REG_ADDR(node_id) == reg_val, (node_id), (DT_INVALID_NODE))
```

---

**本章小结**：Pin Control 是新式引脚管理标准，支持运行时状态切换。多实例设备通过标签/别名区分。QSPI 有硬件固定引脚，NFC 引脚需要禁用 NFC 后释放。掌握这些高级特性可以应对复杂的硬件设计需求。
