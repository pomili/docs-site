# 第3章：nRF52840 设备树实战

本章通过具体的外设配置实例，展示如何在实际项目中操作 nRF52840 的设备树。

## 3.1 nRF52840 外设地址映射

nRF52840 的 48 个 GPIO 分属两个端口：

```
Port 0: P0.00 – P0.31  (32 个引脚)
Port 1: P1.00 – P1.15  (16 个引脚)

GPIO 控制器寄存器:
  gpio0: 0x50000000  (控制 Port 0)
  gpio1: 0x50000300  (控制 Port 1)
```

外设实例与基地址对照：

```
UART0:  0x40002000     I2C0:   0x40003000     SPI0:   0x40003000
UART1:  0x40028000     I2C1:   0x40004000     SPI1:   0x40004000
                                                    SPI2:   0x40023000
                                                    SPI3:   0x4002F000
SAADC:  0x40007000     PWM0:   0x4001C000     PWM1:   0x40021000
PWM2:   0x40022000     PWM3:   0x4002D000     QSPI:   0x40029000
USB:    0x40027000     RNG:    0x4000D000     WDT:    0x40010000
TIMER0: 0x40008000     TIMER1: 0x40009000     TIMER2: 0x4000A000
TIMER3: 0x4001A000     TIMER4: 0x4001B000
```

**关键约束**：
- I2C0 和 SPI0 **互斥** (共享基址 0x40003000)
- I2C1 和 SPI1 **互斥** (共享基址 0x40004000)
- UART0 可以用 EasyDMA (UARTE) 或传统模式 (UART)，通过 `compatible` 区分

## 3.2 GPIO 实战

### 3.2.1 设备树定义

nRF52840 DK 板载 4 个 LED 和 4 个按键，默认定义如下：

```dts
/ {
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
        btn1: btn_1 {
            gpios = <&gpio0 12 (GPIO_PULL_UP | GPIO_ACTIVE_LOW)>;
            label = "Button 2";
            zephyr,code = <INPUT_KEY_1>;
        };
        btn2: btn_2 {
            gpios = <&gpio0 24 (GPIO_PULL_UP | GPIO_ACTIVE_LOW)>;
            label = "Button 3";
            zephyr,code = <INPUT_KEY_2>;
        };
        btn3: btn_3 {
            gpios = <&gpio0 25 (GPIO_PULL_UP | GPIO_ACTIVE_LOW)>;
            label = "Button 4";
            zephyr,code = <INPUT_KEY_3>;
        };
    };

    aliases {
        led0 = &led0;
        led1 = &led1;
        led2 = &led2;
        led3 = &led3;
        sw0  = &btn0;
        sw1  = &btn1;
        sw2  = &btn2;
        sw3  = &btn3;
    };
};
```

### 3.2.2 C 代码访问

```c
#include <zephyr/kernel.h>
#include <zephyr/drivers/gpio.h>

// 从设备树生成 GPIO 描述结构体 (编译时常量)
static const struct gpio_dt_spec led0 = GPIO_DT_SPEC_GET(DT_ALIAS(led0), gpios);
static const struct gpio_dt_spec btn0 = GPIO_DT_SPEC_GET(DT_ALIAS(sw0),  gpios);

// 按键回调
static struct gpio_callback btn0_cb;

void btn0_handler(const struct device *dev, struct gpio_callback *cb,
                  uint32_t pins)
{
    gpio_pin_toggle_dt(&led0);    // 按下按键 → 翻转 LED
}

void main(void)
{
    // 检查 GPIO 设备是否就绪
    if (!gpio_is_ready_dt(&led0)) {
        printk("LED0 GPIO not ready\n");
        return;
    }
    if (!gpio_is_ready_dt(&btn0)) {
        printk("BTN0 GPIO not ready\n");
        return;
    }

    // 配置 GPIO
    gpio_pin_configure_dt(&led0, GPIO_OUTPUT_INACTIVE);
    gpio_pin_configure_dt(&btn0, GPIO_INPUT);

    // 配置中断
    gpio_pin_interrupt_configure_dt(&btn0, GPIO_INT_EDGE_TO_ACTIVE);
    gpio_init_callback(&btn0_cb, btn0_handler, BIT(btn0.pin));
    gpio_add_callback(btn0.port, &btn0_cb);
}
```

### 3.2.3 自定义 GPIO 引脚 (App Overlay)

假设你要外接一个继电器模块到 P0.03：

```dts
// app.overlay
/ {
    relay: relay {
        compatible = "gpio-leds";     // 复用 gpio-leds 驱动 (继电器=逻辑 LED)
        relay0: relay_0 {
            gpios = <&gpio0 3 GPIO_ACTIVE_HIGH>;
            label = "Relay";
        };
    };
};
```

```c
// main.c
static const struct gpio_dt_spec relay =
    GPIO_DT_SPEC_GET(DT_NODELABEL(relay0), gpios);

// 使用
gpio_pin_set_dt(&relay, 1);   // 吸合
gpio_pin_set_dt(&relay, 0);   // 释放
```

## 3.3 UART 实战

### 3.3.1 nRF52840 UART 的特殊性

nRF52840 的 UART 有两种模式，通过 `compatible` 区分：

```dts
// EasyDMA 模式 (推荐，DMA 传输，省 CPU)
compatible = "nordic,nrf-uarte";

// 传统模式 (无 DMA，低功耗场景)
compatible = "nordic,nrf-uart";
```

**版本约束**：本教程参考的 NCS v2.6.1 使用 `pinctrl-0` / `pinctrl-1` 和 `NRF_PSEL(...)` 配置 UARTE 引脚，不应再添加旧式 `rx-pin` / `tx-pin` 属性。不使用流控时不设置 `hw-flow-control`；引脚分组按实际接线选择。

### 3.3.2 UART 设备树配置

```dts
// 基本的 UART 配置
&uart0 {
    compatible = "nordic,nrf-uarte";
    status = "okay";
    current-speed = <115200>;
    pinctrl-0 = <&uart0_default>;
    pinctrl-1 = <&uart0_sleep>;
    pinctrl-names = "default", "sleep";
};
```

### 3.3.3 UART Pin Control 详解

nRF52840 的 UART 引脚配置在独立的 pin control 文件中：

```dts
// nrf52840dk_nrf52840-pinctrl.dtsi
&pinctrl {
    uart0_default: uart0_default {
        group1 {
            psels = <NRF_PSEL(UART_TX, 0, 6)>,   // P0.06 = TXD
                    <NRF_PSEL(UART_RTS, 0, 5)>;   // P0.05 = RTS
        };
        group2 {
            psels = <NRF_PSEL(UART_RX, 0, 8)>,   // P0.08 = RXD
                    <NRF_PSEL(UART_CTS, 0, 7)>;   // P0.07 = CTS
            bias-pull-up;
        };
    };

    uart0_sleep: uart0_sleep {
        group1 {
            psels = <NRF_PSEL(UART_TX, 0, 6)>,
                    <NRF_PSEL(UART_RX, 0, 8)>,
                    <NRF_PSEL(UART_RTS, 0, 5)>,
                    <NRF_PSEL(UART_CTS, 0, 7)>;
            low-power-enable;   // 睡眠时降低功耗
        };
    };
};
```

**`NRF_PSEL` 宏解析**：
```
NRF_PSEL(UART_TX, 0, 6) → 功能=UART_TX, Port=0, Pin=6
  展开为: 0x00000006  (nRF PSEL 寄存器格式)
```

### 3.3.4 C 代码使用 UART

```c
#include <zephyr/drivers/uart.h>

// 通过 chosen 获取控制台 UART
#define CONSOLE_NODE DT_CHOSEN(zephyr_console)

void main(void)
{
    const struct device *uart = DEVICE_DT_GET(CONSOLE_NODE);

    if (!device_is_ready(uart)) {
        printk("UART device not ready\n");
        return;
    }

    // 中断驱动接收
    uint8_t rx_buf[64];
    uart_irq_callback_user_data_set(uart, my_uart_callback, NULL);
    uart_irq_rx_enable(uart);
    uart_rx_buf_rsp(uart, rx_buf, sizeof(rx_buf));
}
```

### 3.3.5 添加第二个 UART

nRF52840 有 2 个 UART 实例，第二个通常用于调试或扩展：

```dts
// app.overlay — 启用 uart1
&uart1 {
    compatible = "nordic,nrf-uarte";
    status = "okay";
    current-speed = <9600>;
    pinctrl-0 = <&uart1_default>;
    pinctrl-1 = <&uart1_sleep>;
    pinctrl-names = "default", "sleep";
};

&pinctrl {
    uart1_default: uart1_default {
        group1 {
            psels = <NRF_PSEL(UART_TX, 0, 31)>,   // P0.31 = TXD
                    <NRF_PSEL(UART_RX, 0, 30)>;   // P0.30 = RXD
        };
    };
    uart1_sleep: uart1_sleep {
        group1 {
            psels = <NRF_PSEL(UART_TX, 0, 31)>,
                    <NRF_PSEL(UART_RX, 0, 30)>;
            low-power-enable;
        };
    };
};
```

对应的 Kconfig：
```kconfig
# prj.conf
CONFIG_SERIAL=y
CONFIG_UART_INTERRUPT_DRIVEN=y
# CONFIG_UART_1=y 不推荐用 Kconfig 开，直接在 DTS 中 status = "okay"
```

## 3.4 I2C 实战

### 3.4.1 nRF52840 I2C 的特殊性

nRF52840 的 TWI 外设 (Two-Wire Interface) 是 I2C 协议的 Nordic 实现。Zephyr 驱动中有两种模式：

```dts
// EasyDMA 模式 (TWIM) — 推荐
compatible = "nordic,nrf-twim";

// 传统模式 (TWI) — 低功耗简单场景
compatible = "nordic,nrf-twi";
```

### 3.4.2 BME280 传感器示例

完整的 I2C + BME280 配置：

```dts
// app.overlay
&i2c0 {
    compatible = "nordic,nrf-twim";
    status = "okay";
    clock-frequency = <I2C_BITRATE_FAST>;   // 400 kHz
    pinctrl-0 = <&i2c0_default>;
    pinctrl-1 = <&i2c0_sleep>;
    pinctrl-names = "default", "sleep";

    bme280@76 {
        compatible = "bosch,bme280";
        reg = <0x76>;                       // I2C 7-bit 地址
        status = "okay";
    };
};

&pinctrl {
    i2c0_default: i2c0_default {
        group1 {
            psels = <NRF_PSEL(TWIM_SDA, 0, 26)>,
                    <NRF_PSEL(TWIM_SCL, 0, 27)>;
        };
    };
    i2c0_sleep: i2c0_sleep {
        group1 {
            psels = <NRF_PSEL(TWIM_SDA, 0, 26)>,
                    <NRF_PSEL(TWIM_SCL, 0, 27)>;
            low-power-enable;
        };
    };
};
```

### 3.4.3 C 代码访问

```c
#include <zephyr/drivers/sensor.h>

void main(void)
{
    const struct device *bme280 = DEVICE_DT_GET_ONE(bosch_bme280);

    if (!device_is_ready(bme280)) {
        printk("BME280 not found\n");
        return;
    }

    struct sensor_value temp, humidity, pressure;
    sensor_sample_fetch(bme280);
    sensor_channel_get(bme280, SENSOR_CHAN_AMBIENT_TEMP, &temp);
    sensor_channel_get(bme280, SENSOR_CHAN_HUMIDITY, &humidity);
    sensor_channel_get(bme280, SENSOR_CHAN_PRESS, &pressure);

    printk("Temp: %d.%d C\n", temp.val1, temp.val2 / 1000);
}
```

`DEVICE_DT_GET_ONE(bosch_bme280)` 自动扫描设备树，找到 `compatible = "bosch,bme280"` 的节点并返回其 device 对象。

### 3.4.4 在 I2C 总线上添加多个设备

```dts
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

    eeprom@50 {
        compatible = "atmel,at24c256";
        reg = <0x50>;
    };
};
```

I2C 总线的 `#address-cells = <1>`, `#size-cells = <0>` 意味着每个子节点的 `reg` 只有一个 cell（I2C 地址），没有 size。

## 3.5 SPI 实战

### 3.5.1 nRF52840 SPI 配置

与 I2C 类似，SPI 也有 EasyDMA (SPIM) 和传统 (SPI) 两种模式：

```dts
&spi1 {    // 用 spi1 而不是 spi0 (避免与 i2c0 互斥冲突)
    compatible = "nordic,nrf-spim";
    status = "okay";

    cs-gpios = <&gpio0 17 GPIO_ACTIVE_LOW>;    // 片选引脚 (可多个)
    pinctrl-0 = <&spi1_default>;
    pinctrl-1 = <&spi1_sleep>;
    pinctrl-names = "default", "sleep";

    flash@0 {
        compatible = "jedec,spi-nor";
        reg = <0>;                              // 片选索引
        spi-max-frequency = <8000000>;          // 8 MHz
        size = <DT_SIZE_M(8)>;                  // 8 MB
        has-dpd;
        t-enter-dpd = <3000>;
    };
};

&pinctrl {
    spi1_default: spi1_default {
        group1 {
            psels = <NRF_PSEL(SPIM_SCK,  0, 31)>,
                    <NRF_PSEL(SPIM_MOSI, 0, 30)>;
        };
        group2 {
            psels = <NRF_PSEL(SPIM_MISO, 0, 29)>;
            bias-pull-down;
        };
    };
    spi1_sleep: spi1_sleep {
        group1 {
            psels = <NRF_PSEL(SPIM_SCK,  0, 31)>,
                    <NRF_PSEL(SPIM_MOSI, 0, 30)>,
                    <NRF_PSEL(SPIM_MISO, 0, 29)>;
            low-power-enable;
        };
    };
};
```

### 3.5.2 SPI 多设备 (多片选)

```dts
&spi1 {
    cs-gpios = <&gpio0 17 GPIO_ACTIVE_LOW>,     // CS0
               <&gpio0 18 GPIO_ACTIVE_LOW>;     // CS1

    flash@0 {
        compatible = "jedec,spi-nor";
        reg = <0>;           // 使用 CS0
        spi-max-frequency = <8000000>;
    };

    display@1 {
        compatible = "sitronix,st7789v";
        reg = <1>;           // 使用 CS1
        spi-max-frequency = <32000000>;
    };
};
```

`reg` 的值对应 `cs-gpios` 数组的索引。

### 3.5.3 SPI 的 C 代码

```c
#include <zephyr/drivers/spi.h>
#include <zephyr/drivers/flash.h>

// 自动找到 compatible="jedec,spi-nor" 的节点
#define FLASH_DEV DEVICE_DT_GET_ONE(jedec_spi_nor)

void main(void)
{
    const struct device *flash = FLASH_DEV;
    if (!device_is_ready(flash)) {
        printk("SPI Flash not found\n");
        return;
    }

    uint8_t buf[256];
    flash_read(flash, 0x1000, buf, sizeof(buf));
}
```

## 3.6 PWM 实战

nRF52840 有 4 个 PWM 模块 (PWM0–PWM3)，每个 4 通道。

```dts
// app.overlay — 用 PWM 控制 LED 亮度
/ {
    pwmleds {
        compatible = "pwm-leds";
        pwm_led0: pwm_led_0 {
            pwms = <&pwm0 0 PWM_MSEC(20) PWM_POLARITY_NORMAL>;
            //        ^    ^     ^              ^
            //        |    |     |              +-- 极性
            //        |    |     +-- 周期 (20ms = 50Hz)
            //        |    +-- PWM 通道 0
            //        +-- PWM0 控制器
        };
    };
};

&pinctrl {
    pwm0_default: pwm0_default {
        group1 {
            psels = <NRF_PSEL(PWM_OUT0, 0, 13)>;   // 连接到板载 LED1
        };
    };
};
```

```c
#include <zephyr/drivers/pwm.h>

static const struct pwm_dt_spec pwm_led0 =
    PWM_DT_SPEC_GET(DT_NODELABEL(pwm_led0));

void main(void)
{
    if (!pwm_is_ready_dt(&pwm_led0)) {
        return;
    }

    // 呼吸灯效果: 占空比从 0% → 100% → 0%
    for (;;) {
        for (uint32_t pulse = 0; pulse <= pwm_led0.period; pulse += 1000) {
            pwm_set_pulse_dt(&pwm_led0, pulse);
            k_msleep(5);
        }
        for (uint32_t pulse = pwm_led0.period; pulse > 0; pulse -= 1000) {
            pwm_set_pulse_dt(&pwm_led0, pulse);
            k_msleep(5);
        }
    }
}
```

`PWM_MSEC(20)` → 周期 = 20ms = 50Hz。`PWM_USEC(100)` → 100μs。
`PWM_HZ(1000)` → 1kHz，`PWM_KHZ(50)` → 50kHz。

## 3.7 ADC 实战 (SAADC)

nRF52840 内置 12-bit SAR ADC，支持差分测量。

```dts
// app.overlay
/ {
    zephyr,user {
        io-channels = <&adc 0>;    // 通道 0，单端模式 (AIN0 = P0.02)
    };
};

// 或者使用 nrf-saadc 的特定绑定
&adc {
    status = "okay";
    #address-cells = <1>;
    #size-cells = <0>;

    channel@0 {
        reg = <0>;
        zephyr,gain = "ADC_GAIN_1_6";
        zephyr,reference = "ADC_REF_INTERNAL";
        zephyr,acquisition-time = <ADC_ACQ_TIME_DEFAULT>;
        zephyr,input-positive = <NRF_SAADC_AIN0>;   // P0.02
        zephyr,resolution = <12>;
    };
};
```

```c
#include <zephyr/drivers/adc.h>

#define ADC_NODE DT_NODELABEL(adc)
static const struct adc_dt_spec adc_ch =
    ADC_DT_SPEC_GET_BY_IDX(DT_PATH(zephyr_user), 0);

void main(void)
{
    if (!adc_is_ready_dt(&adc_ch)) return;

    int16_t buf;
    struct adc_sequence seq = {
        .buffer = &buf,
        .buffer_size = sizeof(buf),
    };

    adc_read(adc_ch.dev, &seq);

    int32_t mv = (int32_t)buf;
    adc_raw_to_millivolts_dt(&adc_ch, &mv);
    printk("ADC: %d mV\n", mv);
}
```

## 3.8 nRF52840 常用外设速查表

| 外设 | compatible 字符串 | 实例数 | 备注 |
|------|------------------|--------|------|
| GPIO | `nordic,nrf-gpio` | 2 (gpio0/1) | 分别控制 Port 0 / Port 1 |
| UART | `nordic,nrf-uarte` | 2 | EasyDMA 模式 |
| UART | `nordic,nrf-uart` | 2 | 传统无 DMA 模式 |
| I2C  | `nordic,nrf-twim` | 2 | EasyDMA 模式 (推荐) |
| I2C  | `nordic,nrf-twi` | 2 | 传统模式 |
| SPI  | `nordic,nrf-spim` | 4 | EasyDMA 模式 (推荐) |
| SPI  | `nordic,nrf-spi` | 4 | 传统模式 |
| ADC  | `nordic,nrf-saadc` | 1 | 8 通道，12-bit |
| PWM  | `nordic,nrf-pwm` | 4 | 每模块 4 通道 |
| QSPI | `nordic,nrf-qspi` | 1 | 32MB/s，必须指定引脚 |
| WDT  | `nordic,nrf-wdt` | 1 | 看门狗 |
| RNG  | `nordic,nrf-rng` | 1 | 随机数生成器 |
| RTC  | `nordic,nrf-rtc` | 2 | 低功耗实时计数器 |
| Temp | `nordic,nrf-temp` | 1 | 片内温度传感器 |
| NVMC | `nordic,nrf-nvmc` | 1 | Flash 控制器 |
| ECB  | `nordic,nrf-ecb` | 1 | AES 硬件加速 |
| CCM  | `nordic,nrf-ccm` | 1 | CCM 加密 |
| USB  | `nordic,nrf-usbd` | 1 | USB 2.0 FS Device |

---

**本章小结**：nRF52840 的外设配置通过设备树实现引脚映射、参数设定和实例选择。核心模式几乎不变：DTS 中 `status = "okay"` + Pin Control 配置 + C 代码中 `GPIO_DT_SPEC_GET` / `PWM_DT_SPEC_GET` / `DEVICE_DT_GET` 等宏。
