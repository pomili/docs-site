# 第 04 章：GPIO、LED 与按键中断

[返回目录](README.md)

## 4.1 目标与电气前提

先掌握逻辑开关，再做按键中断。GPIO 不应直接驱动电机、继电器线圈或大电流负载；使用驱动器和必要的续流保护。两板实验使用 3.3V 逻辑，外接设备必须共地，不能因某些 STM32 引脚有容忍能力就假定全部引脚可接 5V。

当前共享示例：ESP32 GPIO4 接外部 LED；STM32 PC13 使用板载低有效 LED。源码在 `apps/shared_demo/src/main.c`，两板编译已验证，硬件未验证。

## 4.2 从逻辑电平理解 API

```c
static const struct gpio_dt_spec led =
    GPIO_DT_SPEC_GET(DT_ALIAS(led0), gpios);

/* 片段：先检查 gpio_is_ready_dt(&led)，每次调用检查返回值。 */
gpio_pin_configure_dt(&led, GPIO_OUTPUT_INACTIVE);
gpio_pin_set_dt(&led, 1); /* 逻辑点亮，不一定物理高电平 */
gpio_pin_set_dt(&led, 0); /* 逻辑熄灭 */
```

`gpio_pin_get_dt()` 同样考虑 `GPIO_ACTIVE_LOW`；读到 1 表示逻辑有效。若需要物理电平，了解 raw API，而不是随手在不同板上添加 `!value`。

## 4.3 为 FK407M2 增加教学用外接按键

ESP32 上游板已有 `sw0`：GPIO0 BOOT，低有效。按住 BOOT 复位可能进入下载模式，所以实验不要把它当作任意自由引脚。

FK407M2 当前未定义 `sw0`。本章建议**外接按键到 PB0 与 GND**，并在 `apps/button_demo/boards/fk407m2_stm32f407xx.overlay` 添加：

```dts
#include <zephyr/dt-bindings/gpio/gpio.h>

/ {
    aliases {
        sw0 = &lesson_button;
    };
    buttons {
        compatible = "gpio-keys";
        lesson_button: button_0 {
            gpios = <&gpiob 0 (GPIO_PULL_UP | GPIO_ACTIVE_LOW)>;
            label = "External lesson button";
        };
    };
};
```

PB0 只是本章外接方案，先确认引脚可接、没有外部负载。不要将复位键等同 GPIO 按键。ESP32 本章无需额外按键 overlay；若同时使用 GPIO4 LED，需复制该应用专用 LED overlay，而不是以为别的应用的 overlay 会自动共享。

## 4.4 中断 + 延迟 work 消抖：完整 main.c

`prj.conf`：

```ini
CONFIG_GPIO=y
CONFIG_PRINTK=y
CONFIG_SERIAL=y
CONFIG_CONSOLE=y
CONFIG_UART_CONSOLE=y
```

应用使用第 01 章标准 CMake，项目名改为 `button_demo`。

```c
#include <zephyr/kernel.h>
#include <zephyr/drivers/gpio.h>
#include <zephyr/sys/printk.h>

static const struct gpio_dt_spec button =
    GPIO_DT_SPEC_GET(DT_ALIAS(sw0), gpios);
static struct gpio_callback button_cb;
static int last_state;

static void debounce_handler(struct k_work *work)
{
    ARG_UNUSED(work);
    int state = gpio_pin_get_dt(&button);

    if (state < 0) {
        printk("button read failed: %d\n", state);
        return;
    }
    if (state != last_state) {
        last_state = state;
        printk("button: %s\n", state ? "pressed" : "released");
    }
}

K_WORK_DELAYABLE_DEFINE(debounce_work, debounce_handler);

static void button_isr(const struct device *port,
                       struct gpio_callback *cb, gpio_port_pins_t pins)
{
    ARG_UNUSED(port);
    ARG_UNUSED(cb);
    ARG_UNUSED(pins);
    /* ISR 只安排工作；最后一个边沿 30ms 后读状态。 */
    k_work_reschedule(&debounce_work, K_MSEC(30));
}

int main(void)
{
    int ret;

    if (!gpio_is_ready_dt(&button)) {
        printk("button device not ready\n");
        return 0;
    }
    ret = gpio_pin_configure_dt(&button, GPIO_INPUT);
    if (ret < 0) {
        printk("configure failed: %d\n", ret);
        return 0;
    }
    last_state = gpio_pin_get_dt(&button);
    if (last_state < 0) {
        printk("initial read failed: %d\n", last_state);
        return 0;
    }
    gpio_init_callback(&button_cb, button_isr, BIT(button.pin));
    ret = gpio_add_callback(button.port, &button_cb);
    if (ret < 0) {
        printk("add callback failed: %d\n", ret);
        return 0;
    }
    ret = gpio_pin_interrupt_configure_dt(&button, GPIO_INT_EDGE_BOTH);
    if (ret < 0) {
        printk("interrupt configure failed: %d\n", ret);
        return 0;
    }
    printk("button ready\n");
    return 0; /* 系统 workqueue 仍运行。 */
}
```

构建：

```powershell
west build -b esp32s3_devkitc/esp32s3/procpu -d build/button_esp32 apps/button_demo
west build -b fk407m2/stm32f407xx -d build/button_stm32 apps/button_demo
```

这是适合入门的时间窗口消抖，不保证采集每一个快速脉冲。编码器、高速计数和严格事件时间戳应该用专门的计数/捕获方案。

## 4.5 常见陷阱

- 在 ISR 中 `k_msleep()`、执行阻塞 I2C 或网络操作。
- 在栈上创建 callback 后退出函数，导致回调对象失效；本例使用静态对象。
- GPIO 同时被 pinctrl 分配给 UART/PWM，GPIO API 返回成功也可能不是预期波形。
- 用 BOOT 引脚接外部低电平负载，影响 ESP32 启动。
- PC13 使用限制不同于一般高速输出，别拿它做高速总线或大电流驱动。

## 4.6 验收

按下一次、松开一次，各输出一次稳定状态。快速敲击不会刷出大量抖动日志。长按不应导致线程忙等；复位时不能意外进入下载模式。
