# 第 06 章：定时器与硬件 PWM

[返回目录](README.md)

## 6.1 三种“定时”不要混淆

- `k_msleep()`：让当前线程等待，恢复执行受调度影响。
- `k_timer`：在系统时钟到期时通知，回调属于中断上下文。
- 硬件 PWM：外设自动持续产生波形，不靠线程反复翻 GPIO。

LED 呼吸、蜂鸣器、舵机控制应优先考虑 PWM。精确脉冲计数/输入捕获属于 counter 或厂商定时器能力，不等于 `k_timer`。

## 6.2 本章接线方案

新建独立应用 `apps/pwm_demo`，采用第 01 章 CMake，`prj.conf`：

```ini
CONFIG_PWM=y
CONFIG_PRINTK=y
```

| 板 | PWM 输出建议 | 说明 |
|---|---|---|
| ESP32-S3 | LEDC channel 0 → GPIO6 | 外接 LED + 限流电阻，或示波器 |
| STM32 | TIM3 channel 1 → PA6 | 外接 LED + 限流电阻，不是 PC13 板载 LED |

以下 overlay 按本地驱动/binding 编写，尚未编译和上板验证。先确认引脚在实物上可用；不要把舵机电源直接接 GPIO，也不要靠开发板小电流电源给大负载供电。

## 6.3 ESP32-S3 overlay

`boards/esp32s3_devkitc_esp32s3_procpu.overlay`：

```dts
#include <zephyr/dt-bindings/pwm/pwm.h>
#include <zephyr/dt-bindings/pinctrl/esp32s3-pinctrl.h>

&pinctrl {
    lesson_pwm_pins: lesson_pwm_pins {
        group1 {
            pinmux = <LEDC_CH0_GPIO6>;
            output-enable;
        };
    };
};

&ledc0 {
    status = "okay";
    pinctrl-0 = <&lesson_pwm_pins>;
    pinctrl-names = "default";
    #address-cells = <1>;
    #size-cells = <0>;
    channel0@0 {
        reg = <0>;
        timer = <0>;
    };
};

/ {
    aliases { pwm-led0 = &lesson_pwm_led; };
    pwmleds {
        compatible = "pwm-leds";
        lesson_pwm_led: led {
            pwms = <&ledc0 0 PWM_MSEC(1) PWM_POLARITY_NORMAL>;
        };
    };
};
```

LEDC 的 pinmux、channel 子节点和 `pwms` 的通道必须一致。S3 不是经典 ESP32 的全部 LEDC 通道集合，不照抄 channel 8–15 的配置。

## 6.4 STM32 overlay

`boards/fk407m2_stm32f407xx.overlay`：

```dts
#include <zephyr/dt-bindings/pwm/pwm.h>

&timers3 {
    status = "okay";
    st,prescaler = <83>;
    pwm3: pwm {
        status = "okay";
        pinctrl-0 = <&tim3_ch1_pa6>;
        pinctrl-names = "default";
    };
};

/ {
    aliases { pwm-led0 = &lesson_pwm_led; };
    pwmleds {
        compatible = "pwm-leds";
        lesson_pwm_led: led {
            pwms = <&pwm3 1 PWM_MSEC(1) PWM_POLARITY_NORMAL>;
        };
    };
};
```

本 SoC 已有 `timers3/pwm` 子节点，但没有现成 `pwm3` 标签，所以上述在合并子节点时添加标签。不能直接写一个没有来源的 `&pwm3`。

当前板 APB1 为 42MHz，TIM3 在该分频设置下为 84MHz，预分频 83 后为 1MHz 计数。16 位定时器需要考虑周期可表示范围。换时钟配置后应重新计算，不要永久记住“所有 STM32 定时器都是 84MHz”。

## 6.5 共用完整 main.c

```c
#include <zephyr/kernel.h>
#include <zephyr/drivers/pwm.h>
#include <zephyr/sys/printk.h>

static const struct pwm_dt_spec output =
    PWM_DT_SPEC_GET(DT_ALIAS(pwm_led0));

int main(void)
{
    if (!pwm_is_ready_dt(&output)) {
        printk("PWM not ready\n");
        return 0;
    }
    while (1) {
        for (unsigned int duty = 0; duty <= 100; duty += 5) {
            uint32_t pulse = (uint64_t)output.period * duty / 100;
            int ret = pwm_set_pulse_dt(&output, pulse);
            if (ret < 0) {
                printk("PWM failed: %d\n", ret);
                return 0;
            }
            k_msleep(50);
        }
    }
    return 0;
}
```

```powershell
west build -b esp32s3_devkitc/esp32s3/procpu -d build/pwm_esp32 apps/pwm_demo
west build -b fk407m2/stm32f407xx -d build/pwm_stm32 apps/pwm_demo
```

API 使用纳秒。`PWM_MSEC(1)` 是 1ms 周期，也就是 1kHz；`pulse` 不可大于 `period`。循环到 100% 后跳回 0%，这是锯齿亮度，不是平滑往返呼吸；可作为练习增加下降段。

## 6.6 舵机与频率共享

普通模型舵机常用约 20ms 周期、毫秒级高电平，但具体范围必须看型号。不要把 0–100% 全范围呼吸灯程序直接接舵机，可能撞机械限位。

同一硬件定时器/LEDC timer 的多个通道可能共享频率。某通道改周期可能影响其他通道，要按驱动和硬件共享关系规划资源。

## 6.7 验收与依据

示波器检查周期约 1ms，占空比逐步变化。没有示波器时 LED 只能验证粗略效果，不能证明精确频率。

本地参考：`zephyr/samples/basic/blinky_pwm`、`zephyr/samples/basic/fade_led`；binding 为 `st,stm32-pwm.yaml`、`espressif,esp32-ledc.yaml`。官方其他板的 overlay 只能参考结构，不直接代表本板接线。
