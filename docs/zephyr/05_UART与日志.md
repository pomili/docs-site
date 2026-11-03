# 第 05 章：UART、日志与交互 Shell

[返回目录](README.md)

## 5.1 先区分三件事

1. **UART 外设**：收发电平和字节，TX/RX 引脚连接真实线路。
2. **控制台 console**：`printk()` 等输出使用的逻辑设备，可映射到 UART，也可能映射到 USB。
3. **Shell**：带命令解析的交互系统，通常占用控制台对应的串行通道。

不能把同一个 UART 同时当 Shell 输入、二进制传感器协议和任意回显程序来用，除非你明确设计了复用协议与所有权。

## 5.2 两板当前串口

| 板子 | 控制器 | TX | RX | 默认速率 |
|---|---|---|---|---|
| ESP32-S3 | UART0 | GPIO43 | GPIO44 | 115200 |
| FK407M2 | USART1 | PA9 | PA10 | 115200 |

接线：板 TX → USB-UART 模块 RX，板 RX ← 模块 TX，GND 共地。使用 **3.3V TTL UART**，不是 RS-232 的正负电压接口。不要把模块的 5V 电源线随意连接到板 GPIO。

USB-UART 桥芯片的 COM 口、ESP32 内置 USB Serial/JTAG 的 COM 口、Zephyr USB CDC 的 COM 口可能不同，第 12 章会单独区分。

## 5.3 从 printk 过渡到日志

`prj.conf`：

```ini
CONFIG_LOG=y
CONFIG_LOG_DEFAULT_LEVEL=3
```

片段：

```c
#include <zephyr/logging/log.h>
LOG_MODULE_REGISTER(sensor_app, LOG_LEVEL_INF);

/* 放在处理流程中 */
LOG_INF("device started");
LOG_WRN("queue nearly full");
LOG_ERR("read failed: %d", ret);
```

日志有模块、级别、后端和延迟处理机制。不要在高频 ISR 中打印大量内容，也不要用打印时间代替精确性能测量。打印过多会改变任务时序、占满队列或导致串口吞吐不足。

不要把密码、Wi-Fi PSK、配对密钥或完整认证令牌写入日志。

## 5.4 最小 UART 轮询回显：完整 main.c

这个实验**独占控制台串口，不启用 Shell 或并行日志输出**。它演示通用 API，不演示中断吞吐或 DMA。

建立 `apps/uart_echo`。`prj.conf`：

```ini
CONFIG_SERIAL=y
CONFIG_CONSOLE=y
CONFIG_UART_CONSOLE=y
CONFIG_SHELL=n
CONFIG_LOG=n
```

完整代码：

```c
#include <zephyr/kernel.h>
#include <zephyr/device.h>
#include <zephyr/drivers/uart.h>

static const struct device *const uart =
    DEVICE_DT_GET(DT_CHOSEN(zephyr_console));

int main(void)
{
    unsigned char byte;

    if (!device_is_ready(uart)) {
        return 0;
    }
    while (1) {
        if (uart_poll_in(uart, &byte) == 0) {
            uart_poll_out(uart, byte);
        } else {
            k_msleep(1);
        }
    }
    return 0;
}
```

两板构建命令与第 01 章一致，分别把应用改为 `apps/uart_echo`，输出改为 `build/uart_esp32`、`build/uart_stm32`。关闭终端软件的本地回显，避免误以为收到两份数据。

局限：`uart_poll_out()` 可阻塞直到能发送；轮询可能丢失高速连续输入。本例适合验证 TX/RX，不适合作为完整生产串口驱动结构。

## 5.5 中断模式

典型配置：

```ini
CONFIG_UART_INTERRUPT_DRIVEN=y
```

典型处理顺序：注册 callback → 启用 RX 中断 → callback 内调用 `uart_irq_update()` → 判断 `uart_irq_rx_ready()` → 用 `uart_fifo_read()` 尽快取走数据 → 放环形缓冲/消息队列 → 在线程中解析协议。

ISR 不做长报文解析，不写 Flash，不等网络。FIFO 读完通常需要循环，不能默认每次中断只有一个字节。

## 5.6 异步 UART / DMA

典型配置：

```ini
CONFIG_UART_ASYNC_API=y
```

关键接口为 `uart_callback_set()`、`uart_rx_enable()`、`uart_rx_buf_rsp()`、`uart_tx()`。接收会通过 `UART_RX_RDY`、缓冲请求/释放等事件通知。

注意：

- 硬件/驱动支持不由配置选项本身保证，需检查该板该 UART 的驱动能力。
- DMA 缓冲区在驱动释放前不可复用或离开作用域。
- 别在同一个 UART 上同时使用中断驱动 API 和异步 API。
- STM32 DMA 可能需要设备树 DMA 通道、时钟和可访问 RAM；不要把缓冲随意放进 CCM。
- 协议必须考虑拆包、粘包、超时、长度、校验和，不以一次 callback 等同一帧。

## 5.7 Shell 的正确用途

配置 `CONFIG_SHELL=y` 后，可以注册应用命令用于现场诊断，例如查询状态或设置采样周期。Wi-Fi 官方 shell 示例已经提供网络命令，不应另外启动串口回显抢占它。

安全设备应限制敏感命令，必要时在量产配置中关闭调试 shell。

## 5.8 排查清单

无输出：COM 口是否正确、波特率是否匹配、UART chosen 是否正确、固件是否真正运行？

乱码：波特率/时钟/电平/地线是否正确？不要先怀疑 C 字符串编码。

只有发送无接收：TX/RX 是否交叉、RX 引脚是否启用、是否被 Shell 或另一个 callback 占用？

频繁丢字节：测量输入速率、服务间隔、硬件 FIFO、软件缓冲和线程阻塞时间。
