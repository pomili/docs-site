# 第2章：Zephyr 设备树模型

## 2.1 Zephyr 设备树的设计哲学

Zephyr 与 Linux 虽然都使用设备树，但设计哲学差异很大：

| 维度 | Linux Kernel | Zephyr RTOS |
|------|-------------|-------------|
| 解析时机 | **运行时**解析 DTB | **编译时**展开为 C 宏 |
| 内存开销 | 需要在 RAM 中存放 DTB | 零运行时开销 |
| 驱动模型 | 总线型 (platform_driver) | 设备对象型 (device) |
| 配置源 | 纯 DTS | DTS + Kconfig 双轨制 |
| 修改方式 | 改 dts 重编 dtb | overlay + Kconfig |
| MCU 适配 | 针对应用处理器 (AP) | 针对 Cortex-M 微控制器 |

**核心原则**: Zephyr 的设备树在**编译阶段**就完成了全部解析。运行时代码通过宏常量访问硬件信息，没有任何树遍历或属性查找。

## 2.2 Zephyr 设备树的五层结构

```
第 1 层: Architecture (架构级)      → arm/arm64/riscv/xtensa
第 2 层: SoC Family (SoC 家族)     → nordic/nrf52
第 3 层: SoC Variant (SoC 具体型号) → nrf52840_qiaa
第 4 层: Board (板级)              → nrf52840dk_nrf52840
第 5 层: Application (应用层)      → app.overlay
```

### 2.2.1 第一层：架构级 (arch)

定位文件：`dts/arm/armv7-m.dtsi`

```dts
/ {
    #address-cells = <1>;
    #size-cells = <1>;

    cpus {
        #address-cells = <1>;
        #size-cells = <0>;
        cpu@0 {
            compatible = "arm,cortex-m4f";
            reg = <0>;
        };
    };
};
```

定义 CPU 架构特性、中断嵌套控制器 (NVIC)、调试组件 (DWT, ITM) 等。

### 2.2.2 第二层：SoC 家族 (soc-family)

定位文件：`dts/arm/nordic/nrf52.dtsi`

```dts
#include <arm/armv7-m.dtsi>

/ {
    soc {
        #address-cells = <1>;
        #size-cells = <1>;

        ficr: ficr@10000000 {
            compatible = "nordic,nrf-ficr";
            reg = <0x10000000 0x1000>;
            status = "okay";
        };

        uicr: uicr@10001000 {
            compatible = "nordic,nrf-uicr";
            reg = <0x10001000 0x1000>;
            status = "okay";
        };
    };
};
```

nRF52 家族共有的外设 (FICR, UICR, NVMC, CLOCK, POWER) 在此定义。

### 2.2.3 第三层：SoC 具体型号 (soc-variant)

定位文件：`dts/arm/nordic/nrf52840_qiaa.dtsi`

```dts
/ {
    soc {
        sram0: memory@20000000 {
            reg = <0x20000000 0x40000>;    // 256KB SRAM
        };

        flash0: flash@0 {
            reg = <0x00000000 0x100000>;    // 1MB Flash
        };

        gpio0: gpio@50000000 {
            compatible = "nordic,nrf-gpio";
            reg = <0x50000000 0x1000>;
            interrupts = <41 1>;
            #gpio-cells = <2>;
            gpio-controller;
            status = "okay";
        };

        gpio1: gpio@50000300 {
            compatible = "nordic,nrf-gpio";
            reg = <0x50000300 0x1000>;
            interrupts = <42 1>;
            #gpio-cells = <2>;
            gpio-controller;
            status = "okay";
        };

        uart0: uart@40002000 {
            compatible = "nordic,nrf-uarte";
            reg = <0x40002000 0x1000>;
            interrupts = <2 1>;
            status = "disabled";    // 默认关闭！
        };

        i2c0: i2c@40003000 {
            compatible = "nordic,nrf-twim";
            reg = <0x40003000 0x1000>;
            interrupts = <3 1>;
            status = "disabled";
        };

        spi0: spi@40003000 {        // 与 i2c0 共享基地址！
            compatible = "nordic,nrf-spim";
            reg = <0x40003000 0x1000>;
            interrupts = <3 1>;
            status = "disabled";
        };

        // ... 其他外设实例
    };
};
```

**关键发现**：

1. **几乎全部外设都 `status = "disabled"`** — SoC 只定义硬件存在，不决定使用哪个
2. **I2C0 和 SPI0 共享基地址 `0x40003000`** — nRF52 的 TWI/SPI 外设共用寄存器，只能二选一
3. **GPIO 默认 `status = "okay"`** — GPIO 几乎总是需要，不用手动启用

### 2.2.4 第四层：板级 (board)

定位文件：`boards/arm/nrf52840dk_nrf52840/nrf52840dk_nrf52840.dts`

```dts
/dts-v1/;
#include <nordic/nrf52840_qiaa.dtsi>
#include "nrf52840dk_nrf52840-pinctrl.dtsi"

/ {
    model = "Nordic nRF52840 DK NRF52840";
    compatible = "nordic,nrf52840dk-nrf52840";

    chosen {
        zephyr,console = &uart0;
        zephyr,shell-uart = &uart0;
        zephyr,uart-mcumgr = &uart0;
        zephyr,bt-mon-uart = &uart0;
        zephyr,bt-c2h-uart = &uart0;
        zephyr,sram = &sram0;
        zephyr,flash = &flash0;
        zephyr,code-partition = &slot0_partition;
    };

    leds {
        compatible = "gpio-leds";
        led0: led_0 {
            gpios = <&gpio0 13 GPIO_ACTIVE_LOW>;
            label = "Green LED 0";
        };
        led1: led_1 {
            gpios = <&gpio0 14 GPIO_ACTIVE_LOW>;
            label = "Green LED 1";
        };
        led2: led_2 {
            gpios = <&gpio0 15 GPIO_ACTIVE_LOW>;
            label = "Green LED 2";
        };
        led3: led_3 {
            gpios = <&gpio0 16 GPIO_ACTIVE_LOW>;
            label = "Green LED 3";
        };
    };

    buttons {
        compatible = "gpio-keys";
        btn0: btn_0 {
            gpios = <&gpio0 11 (GPIO_PULL_UP | GPIO_ACTIVE_LOW)>;
            label = "Button 1";
            zephyr,code = <INPUT_KEY_0>;
        };
        // ... btn1, btn2, btn3 类似
    };

    aliases {
        led0 = &led0;
        led1 = &led1;
        led2 = &led2;
        led3 = &led3;
        sw0  = &btn0;
    };
};

// 启用需要用到的外设
&uart0 {
    compatible = "nordic,nrf-uarte";
    status = "okay";
    current-speed = <115200>;
};

&i2c0 {
    compatible = "nordic,nrf-twim";
    status = "okay";
    clock-frequency = <I2C_BITRATE_FAST>;   // 400 kHz
};

&spi1 {    // 注意：使用 spi1 而不是 spi0 (避开与 i2c0 的冲突)
    compatible = "nordic,nrf-spim";
    status = "okay";
};

// 禁用不需要的外设
&spi0  { status = "disabled"; };
&spi2  { status = "disabled"; };
&i2c1  { status = "disabled"; };
```

**板级 DTS 的工作**：
1. 引入正确的 SoC 型号
2. 定义板载外设 (LED, Button, 外部传感器)
3. 启用需要用到的 SoC 外设 (UART, I2C, SPI)
4. 设置 `chosen` — 指定 Console、Shell、Flash 分区等特殊节点
5. 设置 `aliases` — 为频繁引用的节点提供短名称

### 2.2.5 第五层：应用层 (app.overlay)

```dts
// app.overlay — 放在应用目录下
&i2c0 {
    bme280@76 {
        compatible = "bosch,bme280";
        reg = <0x76>;
        status = "okay";
    };
};

&spi1 {
    cs-gpios = <&gpio0 17 GPIO_ACTIVE_LOW>;
    flash@0 {
        compatible = "jedec,spi-nor";
        reg = <0>;
        spi-max-frequency = <8000000>;
    };
};
```

Overlay 是最高优先级的 DTS 输入，用于应用层定制。

## 2.3 chosen 节点 — Zephyr 的系统配置枢纽

`chosen` 不是硬件属性，而是**内核配置选择**——告诉 Zephyr 哪个硬件实例承担特定的系统角色。

### 2.3.1 常用的 Zephyr chosen 属性

| chosen 属性 | 说明 | 指向示例 |
|------------|------|---------|
| `zephyr,console` | 控制台 UART | `&uart0` |
| `zephyr,shell-uart` | Shell 命令 UART | `&uart0` |
| `zephyr,bt-mon-uart` | BLE Monitor 日志 | `&uart0` |
| `zephyr,bt-c2h-uart` | BLE HCI 的 H4 传输 | `&uart0` |
| `zephyr,sram` | 系统 SRAM | `&sram0` |
| `zephyr,flash` | 系统 Flash | `&flash0` |
| `zephyr,code-partition` | 固件存放分区 | `&slot0_partition` |
| `zephyr,entropy` | 随机数源 | `&rng` |
| `zephyr,display` | 显示控制器 | `&lcd` |
| `zephyr,flash-controller` | Flash 控制器 | `&flash_controller` |
| `zephyr,ipc` | 核间通信 | `&ipc0` |

### 2.3.2 在 C 代码中访问 chosen

```c
// Zephyr 编译时展开的宏
#define ZEPHYR_CHOSEN_CONSOLE DT_N_S_soc_S_serial_40002000  // 自动生成

// 简便宏
#define CONSOLE_NODE DT_CHOSEN(zephyr_console)
```

## 2.4 aliases 节点 — 简化引用

别名让你用简短名称访问特定节点：

```dts
aliases {
    led0 = &led0;
    led1 = &led1;
    sw0  = &btn0;
    i2c-0 = &i2c0;
    spi-1 = &spi1;
};
```

在 C 代码中使用：

```c
#define LED0_NODE   DT_ALIAS(led0)      // → 指向 led_0 节点
#define I2C0_NODE   DT_ALIAS(i2c_0)     // → 指向 i2c0 节点
```

实际工程中，更推荐用 `DT_ALIAS()` 而非硬编码路径——更换板子后只需修改 alias 指向。

## 2.5 Zephyr 设备树 vs Kconfig 的分工

这是一个经常让新手困惑的问题：**什么时候用设备树，什么时候用 Kconfig？**

| 决策维度 | 设备树 (DTS) | Kconfig |
|---------|-------------|---------|
| 硬件描述 | GPIO 引脚、I2C 地址、寄存器基址、DMA 通道 | — |
| 硬件开关 | `status = "okay"` | `CONFIG_UART_0=y` |
| 软件功能 | — | `CONFIG_BT=y`, `CONFIG_LOG=y` |
| 协议参数 | I2C 速度、UART 波特率 | BLE MTU、连接间隔 |
| 驱动选择 | `compatible` 匹配 | `CONFIG_I2C=y` (使能子系统) |

**黄金法则**:

> 如果这个配置描述的是**硬件长什么样** → 设备树
> 如果这个配置描述的是**软件要不要这个功能** → Kconfig

**双重开关问题**：

```dts
&uart0 { status = "okay"; };          // DTS 开关
```
```kconfig
CONFIG_UART_0=y                        // Kconfig 开关
```

**两者必须同时满足**外设才能工作。如果 `status = "disabled"` 但 `CONFIG_UART_0=y`，UART 驱动存在但不初始化。如果 `status = "okay"` 但 `CONFIG_UART_0=n`，UART 驱动根本没编译进固件。

这种设计允许在一个构建中禁用某些硬件实例来节省资源。

## 2.6 构建时设备树处理流程

```
prj.conf (Kconfig)
    ↓ Kconfig 解析
autoconf.h (Kconfig → C 宏)
    ↓
app.overlay → dts → dtc → zephyr.dts.pre (预处理后)
    ↓                        ↓ dtc 编译
    ↓                   zephyr.dtb (二进制)
    ↓                        ↓ gen_defines.py
    ↓                   devicetree_generated.h (DT → C 宏)
    ↓                        ↓
    ↓                   main.c  #include <devicetree.h>
    ↓                        ↓
    └────────────────────→ 最终二进制固件
```

**最关键的输出**——`devicetree_generated.h`：

```c
// 自动生成的宏 (编译产物，不要手动编辑！)
#define DT_N_S_soc_S_gpio_50000000           // 节点存在标记
#define DT_N_S_soc_S_serial_40002000_P_current_speed 115200  // 属性值
#define DT_N_ALIAS_led0                      // alias 存在标记

#define DT_PROP(DT_NODELABEL(led0), gpios)   // 获取 led0 的 gpios 属性
//    展开为: { DT_N_S_soc_S_gpio_50000000, 13, 1 }
```

## 2.7 Zephyr Devicetree API 快速入门

Zephyr 提供两组 API 操作设备树：

### 2.7.1 设备树宏 API (编译时)

```c
#include <zephyr/devicetree.h>

// 1. 检查节点是否存在
#if DT_NODE_EXISTS(DT_NODELABEL(led0))
    // ...
#endif

// 2. 读取节点属性
#define LED_GPIOS   DT_PROP(DT_NODELABEL(led0), gpios)
#define I2C_FREQ    DT_PROP(DT_NODELABEL(i2c0), clock_frequency)

// 3. 检查属性
#if DT_NODE_HAS_PROP(DT_NODELABEL(uart0), hw_flow_control)
    // ...
#endif

// 4. 判断 compatible
#if DT_NODE_HAS_COMPAT(DT_NODELABEL(i2c0), nordic_nrf_twim)
    // ...
#endif

// 5. 从 phandle 属性获取 GPIO 描述
#define BTN_GPIO    DT_GPIO_CTLR(DT_ALIAS(sw0), gpios)
#define BTN_PIN     DT_GPIO_PIN(DT_ALIAS(sw0), gpios)
#define BTN_FLAGS   DT_GPIO_FLAGS(DT_ALIAS(sw0), gpios)
```

### 2.7.2 GPIO 描述符结构体 (运行时)

```c
#include <zephyr/drivers/gpio.h>

// 这个宏在编译时生成 GPIO 设备结构体
// gpio_dt_spec 包含 device 指针和 pin 号
static const struct gpio_dt_spec led =
    GPIO_DT_SPEC_GET(DT_ALIAS(led0), gpios);

void main(void) {
    if (!gpio_is_ready_dt(&led)) {
        return;  // 设备未就绪
    }
    gpio_pin_configure_dt(&led, GPIO_OUTPUT_ACTIVE);
    gpio_pin_toggle_dt(&led);
}
```

`GPIO_DT_SPEC_GET` 在编译时展开为：
```c
static const struct gpio_dt_spec led = {
    .port = DEVICE_DT_GET(DT_N_S_soc_S_gpio_50000000),  // GPIO0 设备指针
    .pin  = 13,                                          // 引脚号
    .dt_flags = GPIO_ACTIVE_LOW,                         // 标志
};
```

---

**本章小结**：Zephyr 设备树采用编译时展开策略，没有运行时解析开销。五层结构从架构到应用，层层细化。chosen 对系统配置，aliases 对应用引用。DTS 描述硬件长相，Kconfig 控制软件开关——二者互补。下一章进入 nRF52840 实战。

## 热身：用宏查看你的设备树

```bash
# 在 nRF Connect SDK 的 zephyr 目录下
west build -b nrf52840dk_nrf52840 -t menuconfig   # 可视化 Kconfig
west build -b nrf52840dk_nrf52840 -t guiconfig    # GUI 版本

# 查看预处理后的设备树
cat build/zephyr/zephyr.dts.pre

# 查看生成的宏
cat build/zephyr/include/generated/devicetree_generated.h | head -100
```
