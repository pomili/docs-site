# 第5章：设备树覆盖与定制

## 5.1 Overlay 的本质

Overlay (覆盖文件) 是应用层设备树，它不是在运行时"覆盖"已有节点，而是在**构建时与板级 DTS 合并**生成最终设备树。

```
板级 DTS (nrf52840dk_nrf52840.dts)
          +
应用 Overlay (app.overlay)
          +
Shield Overlay (shields/*.overlay)  ← 扩展板定义
          =
最终设备树 (zephyr.dts)
```

### 5.1.1 Overlay 的优先级

```
高优先级 (后合并，会覆盖)：
  app.overlay                          ← 应用定制
  <board>.overlay                      ← 板级补充

中优先级：
  <shield>.overlay                     ← 扩展板配套

低优先级 (先合并，被覆盖)：
  boards/<vendor>/<board>.dts          ← 官方板级定义
  dts/arm/nordic/nrf52840_qiaa.dtsi    ← SoC 定义
  dts/arm/armv7-m.dtsi                 ← 架构定义
```

**规则**: 后合并的同名属性会**覆盖**先合并的值。Overlay 中 `status = "okay"` 可以覆盖 SoC 级别的 `status = "disabled"` (但不能覆盖 `status = "reserved"`)。

## 5.2 四种 Overlay 使用场景

### 5.2.1 场景一：启用外设

SoC 级别外设默认 disabled，overlay 中启用：

```dts
// app.overlay
&uart1 {
    status = "okay";
    current-speed = <9600>;
};

&spi1 {
    status = "okay";
    cs-gpios = <&gpio0 17 GPIO_ACTIVE_LOW>;
};
```

### 5.2.2 场景二：添加外部设备

```dts
// app.overlay — 在 I2C 总线上挂载传感器
&i2c0 {
    status = "okay";

    bme280@76 {
        compatible = "bosch,bme280";
        reg = <0x76>;
    };

    mpu6050@68 {
        compatible = "invensense,mpu6050";
        reg = <0x68>;
    };
};
```

### 5.2.3 场景三：重映射引脚

官方板的 UART 引脚可能不符合你的 PCB 布局：

```dts
// 官方板 UART0 使用 P0.06 (TX), P0.08 (RX)
// 你的 PCB 用 P1.03 (TX), P1.10 (RX)

&pinctrl {
    /delete-node/ uart0_default;    // 删除默认配置

    uart0_default: uart0_default {
        group1 {
            psels = <NRF_PSEL(UART_TX, 1, 3)>;     // 你的 TX: P1.03
        };
        group2 {
            psels = <NRF_PSEL(UART_RX, 1, 10)>;    // 你的 RX: P1.10
            bias-pull-up;
        };
    };

    /delete-node/ uart0_sleep;

    uart0_sleep: uart0_sleep {
        group1 {
            psels = <NRF_PSEL(UART_TX, 1, 3)>,
                    <NRF_PSEL(UART_RX, 1, 10)>;
            low-power-enable;
        };
    };
};
```

### 5.2.4 场景四：修改外设配置

```dts
// app.overlay — 将 I2C 速度从 Fast (400kHz) 改为 Standard (100kHz)
&i2c0 {
    clock-frequency = <I2C_BITRATE_STANDARD>;   // 覆盖 = 100kHz
};
```

## 5.3 多配置文件的管理策略

当项目需要支持多个硬件版本时，推荐以下组织方式：

```
my-project/
├── CMakeLists.txt
├── prj.conf
├── boards/
│   ├── rev_a.overlay       ← 硬件版本 A
│   ├── rev_b.overlay       ← 硬件版本 B
│   └── rev_c.overlay       ← 硬件版本 C
├── src/
│   └── main.c
└── README.md
```

**不推荐**用 `#ifdef` 在 C 代码中判断硬件版本——应该通过**条件编译设备树宏**：

```c
// 好的做法：根据设备树中的节点存在与否决定行为
#define SENSOR_NODE DT_NODELABEL(bme280)

#if DT_NODE_EXISTS(SENSOR_NODE)
    // BME280 已配置，初始化温湿度逻辑
    static const struct device *bme280 = DEVICE_DT_GET(SENSOR_NODE);
#else
    // 没有 BME280，使用模拟数据或跳过
    #warning "BME280 not configured in devicetree"
#endif
```

编译时选择 overlay：
```bash
# 构建版本 A
west build -b nrf52840dk_nrf52840 -- \
    -DDTC_OVERLAY_FILE="boards/rev_a.overlay"

# 构建版本 B
west build -b nrf52840dk_nrf52840 -- \
    -DDTC_OVERLAY_FILE="boards/rev_b.overlay"
```

## 5.4 Overlay 的高级操作

### 5.4.1 删除属性和节点

```dts
// 情形：官方板开启了 NFC 功能，但你的 PCB 使用 NFC 引脚 (P0.09, P0.10) 做 GPIO
// 需要删除 NFC 节点

/delete-node/ &nfc_pins;

// 情形：需要删除自身的某个属性
&uart0 {
    /delete-property/ hw-flow-control;  // 去掉硬件流控
};
```

### 5.4.2 修改 phandle 数组中的元素

```dts
// 官方 LED 连接 P0.13，你想改成 P0.20
&led0 {
    gpios = <&gpio0 20 GPIO_ACTIVE_LOW>;   // 完整覆盖 gpios 属性
};
```

**注意**：不能只改引脚号不改其他，必须**完整重写** `gpios` 属性。

### 5.4.3 替换 compatible 字符串

```dts
// nRF52840 UART 有两种驱动模式
// 默认使用 UARTE (EasyDMA)，低功耗场景可改为传统 UART

&uart0 {
    compatible = "nordic,nrf-uart";    // 从 UARTE 切换到传统 UART
    status = "okay";
    current-speed = <115200>;
};
```

### 5.4.4 添加辅助总线

```dts
// 在 SPI 总线上添加多个从设备
&spi1 {
    status = "okay";
    cs-gpios = <&gpio0 17 GPIO_ACTIVE_LOW>,    // CS0
               <&gpio0 18 GPIO_ACTIVE_LOW>,    // CS1
               <&gpio0 19 GPIO_ACTIVE_LOW>;    // CS2

    flash@0 {
        compatible = "jedec,spi-nor";
        reg = <0>;
        spi-max-frequency = <8000000>;
    };
    sensor@1 {
        compatible = "some-spi-sensor";
        reg = <1>;
        spi-max-frequency = <1000000>;
    };
    adc@2 {
        compatible = "some-spi-adc";
        reg = <2>;
        spi-max-frequency = <2000000>;
    };
};
```

## 5.5 多 Overlay 文件的合并

Zephyr 允许指定多个 overlay 文件：

```cmake
# CMakeLists.txt
set(DTC_OVERLAY_FILE
    "${CMAKE_CURRENT_SOURCE_DIR}/common.overlay"
    "${CMAKE_CURRENT_SOURCE_DIR}/sensors.overlay"
)
```

或通过命令行：
```bash
west build -b nrf52840dk_nrf52840 -- \
    -DDTC_OVERLAY_FILE="common.overlay;sensors.overlay"
```

**合并规则**：按列表顺序依次合并，排在后面的覆盖前面的。

## 5.6 Shield Overlay — 扩展板支持

Zephyr 的 Shield 机制为常见的扩展板提供开箱即用的 overlay：

```dts
// 在 boards/shields/ 目录下
// 例如: sparkfun_serlcd.overlay 为 SparkFun SerLCD 扩展板提供引脚映射

// 使用 shield overlay:
west build -b nrf52840dk_nrf52840 -- -DSHIELD=sparkfun_serlcd
```

Shield overlay 会自动合并到最终的设备树中。

### 5.6.1 Shield Overlay 中的条件配置

```dts
// shields/my_shield.overlay
// 条件性启用：只在目标板有 I2C0 时才生效
&i2c0 {
    status = "okay";

    my_device@76 {
        compatible = "my-vendor,my-device";
        reg = <0x76>;
    };
};
```

## 5.7 Partition Manager (分区管理) — Storage Overlay

nRF Connect SDK 使用 Partition Manager 管理 Flash 分区，这也通过 overlay 实现：

```dts
// pm_static.yml 或 overlay 中:
&flash0 {
    partitions {
        compatible = "fixed-partitions";
        #address-cells = <1>;
        #size-cells = <1>;

        boot_partition: partition@0 {
            label = "mcuboot";
            reg = <0x00000000 0xC000>;
        };
        slot0_partition: partition@c000 {
            label = "image-0";
            reg = <0x0000C000 0x73000>;
        };
        slot1_partition: partition@7f000 {
            label = "image-1";
            reg = <0x0007F000 0x73000>;
        };
        storage_partition: partition@f2000 {
            label = "storage";
            reg = <0x000F2000 0xE000>;
        };
    };
};
```

nRF52840 的 1MB Flash 典型分区布局：
```
0x00000 ┌──────────────┐
        │   MCUboot    │ 48KB (0xC000)
0x0C000 ├──────────────┤
        │   Slot 0     │ 460KB (0x73000)
        │  (主固件)     │
0x7F000 ├──────────────┤
        │   Slot 1     │ 460KB (0x73000)
        │  (OTA 升级)   │
0xF2000 ├──────────────┤
        │   Storage    │ 56KB (0xE000)
0x100000└──────────────┘
```

## 5.8 Overlay 调试技巧

### 5.8.1 查看合并后的最终设备树

```bash
# 最关键的一条命令 — 看到所有 overlay 合并后的结果
west build -b nrf52840dk_nrf52840
cat build/zephyr/zephyr.dts.pre | less

# 查看节点是否存在
grep "my_device" build/zephyr/zephyr.dts.pre

# 确认属性值被覆盖
grep "current-speed" build/zephyr/zephyr.dts.pre
```

### 5.8.2 验证 Overlay 是否生效

```c
// 在 main.c 中添加编译时断言
#include <zephyr/devicetree.h>

// 断言 my_device 节点存在
#if !DT_NODE_EXISTS(DT_NODELABEL(my_device))
#error "my_device not found in devicetree! Check your overlay."
#endif

// 断言当前速度是否正确设置
#if DT_PROP(DT_NODELABEL(uart0), current_speed) != 115200
#error "UART0 speed is not 115200!"
#endif

// 断言 GPIO 标志
#define EXPECTED_FLAGS (GPIO_ACTIVE_LOW)
#if DT_GPIO_FLAGS(DT_ALIAS(led0), gpios) != EXPECTED_FLAGS
#error "LED0 GPIO flags mismatch"
#endif
```

这些断言在**编译时**就报错，不会等到运行时才发现问题。

### 5.8.3 常见 Overlay 错误

| 错误 | 原因 | 解决 |
|------|------|------|
| `node not found` | 引用的标签在板级 DTS 中不存在 | 检查 SoC/板级 `dtsi` 文件，确认标签名 |
| overlay 不生效 | 文件路径不对或未指定 | 确认 `app.overlay` 在工程根目录，或检查 `CMakeLists.txt` |
| 属性被覆盖 | 多个 overlay 中定义了同一属性 | 检查合并顺序，后面的会覆盖前面的 |
| `status = "reserved"` | SoC 级别设为 reserved | 无法用 overlay 覆盖 reserved，需删节点重建 |

---

**本章小结**：Overlay 是应用层设备树的入口。`app.overlay` + `<board>.overlay` + `<shield>.overlay` 按优先级合并。掌握 `/delete-node/`、`/delete-property/`、完整重写属性这三种操作，就能灵活控制任何硬件配置。
