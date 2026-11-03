# 第 07 章：ADC 模拟采样

[返回目录](README.md)

## 7.1 先明确测量对象

ADC 测量的是输入电压在配置量程内的位置，不直接知道“温度”“电池百分比”。需要传感器/分压电路、标定和物理公式。

- 输入不能超过芯片允许范围，不直接接 5V 或电池高电压。
- ESP32 的衰减/增益配置不意味着输入具有任意过压保护。
- 高阻信号需要考虑采样电容充电时间、缓冲放大器和采样时间。
- 数字分辨率、有效精度、线性度和标定误差是不同概念。

## 7.2 两板教学输入

| 板 | Zephyr 节点 / 通道 | 建议输入引脚 |
|---|---|---|
| ESP32-S3 | `adc0`，channel 7（硬件 ADC unit 1） | GPIO8 |
| STM32F407 | `adc1`，channel 0 | PA0 |

ESP32 的 `adc0` 不等于 STM32 的 ADC0；节点名是 SoC 描述习惯。GPIO8 避开本教程 I2C0 的 GPIO1/2。初步实验先输入已知、安全的低电压并用万用表比较，不假定整个 0–3.3V 范围都线性可测。

## 7.3 应用配置

新建 `apps/adc_demo`，标准 CMake，`prj.conf`：

```ini
CONFIG_ADC=y
CONFIG_PRINTK=y
```

ESP32 `boards/esp32s3_devkitc_esp32s3_procpu.overlay`：

```dts
#include <zephyr/dt-bindings/adc/adc.h>

/ {
    zephyr,user {
        io-channels = <&adc0 7>;
    };
};

&adc0 {
    status = "okay";
    #address-cells = <1>;
    #size-cells = <0>;
    channel@7 {
        reg = <7>;
        zephyr,gain = "ADC_GAIN_1_4";
        zephyr,reference = "ADC_REF_INTERNAL";
        zephyr,acquisition-time = <ADC_ACQ_TIME_DEFAULT>;
        zephyr,resolution = <12>;
    };
};
```

STM32 `boards/fk407m2_stm32f407xx.overlay`：

```dts
#include <zephyr/dt-bindings/adc/adc.h>

/ {
    zephyr,user {
        io-channels = <&adc1 0>;
    };
};

&adc1 {
    status = "okay";
    pinctrl-0 = <&adc1_in0_pa0>;
    pinctrl-names = "default";
    st,adc-prescaler = <4>;
    #address-cells = <1>;
    #size-cells = <0>;
    channel@0 {
        reg = <0>;
        zephyr,gain = "ADC_GAIN_1";
        zephyr,reference = "ADC_REF_INTERNAL";
        zephyr,acquisition-time = <ADC_ACQ_TIME_DEFAULT>;
        zephyr,resolution = <12>;
    };
};
```

STM32 当前 APB2 为 84MHz，ADC 分频 4 后为 21MHz。`st,adc-prescaler` 是该 binding 的必要配置。这里 `ADC_REF_INTERNAL` 是驱动接受的参考选择，并不表示正在采样内部参考通道，也不保证实际 VREF 恰好 3300mV。

## 7.4 通用完整 main.c

```c
#include <stdint.h>
#include <zephyr/kernel.h>
#include <zephyr/drivers/adc.h>
#include <zephyr/sys/printk.h>

static const struct adc_dt_spec input =
    ADC_DT_SPEC_GET_BY_IDX(DT_PATH(zephyr_user), 0);

int main(void)
{
    int16_t raw;
    struct adc_sequence sequence = {
        .buffer = &raw,
        .buffer_size = sizeof(raw),
    };
    int ret;

    if (!adc_is_ready_dt(&input)) {
        printk("ADC not ready\n");
        return 0;
    }
    ret = adc_channel_setup_dt(&input);
    if (ret < 0) {
        printk("channel setup failed: %d\n", ret);
        return 0;
    }
    ret = adc_sequence_init_dt(&input, &sequence);
    if (ret < 0) {
        printk("sequence init failed: %d\n", ret);
        return 0;
    }
    while (1) {
        ret = adc_read_dt(&input, &sequence);
        if (ret == 0) {
            int32_t mv = raw;
            ret = adc_raw_to_millivolts_dt(&input, &mv);
            if (ret == 0) {
                printk("raw=%d estimated=%d mV\n", raw, (int)mv);
            } else {
                printk("raw=%d; mV conversion unsupported: %d\n", raw, ret);
            }
        } else {
            printk("ADC read failed: %d\n", ret);
        }
        k_msleep(500);
    }
    return 0;
}
```

```powershell
west build -b esp32s3_devkitc/esp32s3/procpu -d build/adc_esp32 apps/adc_demo
west build -b fk407m2/stm32f407xx -d build/adc_stm32 apps/adc_demo
```

本例是单通道 12 位单端输入，所以 `int16_t` 足够；不要不加判断推广到所有分辨率、差分或多通道序列。

## 7.5 读数换算与滤波

`adc_raw_to_millivolts_dt()` 使用设备树和驱动参考信息，是估计转换，不替代板级标定。直接写 `raw * 3300 / 4095` 不能跨板正确处理衰减、参考源、分辨率等差异。

简单平均可降低随机噪声，但不能消除偏置/增益误差。移动平均会引入响应延迟。电池分压还需要乘回分压比，并考虑电阻公差、静态耗电和输入阻抗。

ESP32 混合无线采样时优先使用已确认支持的 ADC unit/channel；不要从“独立 ADC 实验可用”推断并发 Wi-Fi 时所有 ADC 资源也可用。

## 7.6 验收与参考

用至少两个已知安全电压点比较 raw 和 mV；断开输入后漂移是悬空现象，不应把它当真实测量。

参考 `zephyr/samples/drivers/adc/adc_dt`，特别是其 `socs/esp32s3_procpu.overlay`。官方例子的 channel0 对应 GPIO1，本教程改为 channel7/GPIO8 是为了避免 I2C 冲突；两个位置的通道号必须一起改。
