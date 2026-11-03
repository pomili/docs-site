# 第 10 章：Wi-Fi 与网络编程

[返回目录](README.md)

## 10.1 两块板分别能做什么

ESP32-S3 内置 **2.4GHz Wi-Fi**。STM32F407 没有无线射频，需要外接 Wi-Fi 模块或其他网络接口。二者可以共享部分 socket/应用协议代码，但不能共享一个凭空存在的片上 Wi-Fi 驱动。

本章先在 ESP32-S3 用官方 Wi-Fi shell 验证，再解释通用网络程序。STM32 部分是外接方案选择，不是现有 FK407M2 开箱即用步骤。

## 10.2 先补齐本版本的模块依赖

当前工作区只启用了 cmsis、cmsis_6、hal_stm32、hal_espressif、hal_xtensa。ESP32 Wi-Fi 驱动在本版本 **select MBEDTLS**，即使不写 HTTPS，也需要该模块。

以下为你准备实际无线实验时执行的命令，会修改工作区配置并联网获取依赖；编写教程时未执行：

```powershell
west config --local manifest.project-filter -- '-.*,+cmsis,+cmsis_6,+hal_stm32,+hal_espressif,+hal_xtensa,+mbedtls'
west update mbedtls
west list
```

这是针对当前白名单的完整设置。如果你后来已经加入其他模块，应保留它们，不要用上面命令覆盖丢失。

不要随意安装最新 Mbed TLS 代替 manifest 指定版本，也不要只复制目录却仍通过 project-filter 排除它。版本由 `zephyr/west.yml` 固定。

ESP32 的 blobs 已随环境保留，可只读检查：

```powershell
west blobs list hal_espressif
```

仅缺少或损坏时，再按许可与网络条件执行官方命令：

```powershell
west blobs fetch hal_espressif
```

Wi-Fi 和 BLE 基础实验不应无依据全量下载所有 Zephyr 项目。本地 Wi-Fi 驱动依赖还包含 `!SMP`，本教程不要顺手开启 `CONFIG_SMP`。

## 10.3 先运行官方 Wi-Fi Shell

准确样例路径：`zephyr/samples/net/wifi/shell`。本版本不存在教程常见的 `samples/net/wifi/station` 或 `wifi/connect` 目录，别使用不存在的命令路径。

模块准备完成后：

```powershell
west build -p always -b esp32s3_devkitc/esp32s3/procpu -d build/wifi_shell zephyr/samples/net/wifi/shell
```

烧录方法见第13章。UART0 控制台 GPIO43/44、115200，使用正常串口终端，不要同时运行第05章的回显程序。

板端 Shell 命令（不是电脑 PowerShell 命令）：

```text
wifi scan
wifi connect -s "YourSSID" -p "YourPassword" -k 1
wifi status
net iface
wifi disconnect
```

这里 `-k 1` 是本版本的 WPA2-PSK。开放网络用 `-k 0` 且不要填写密码；它不具备链路加密，不适合敏感业务。

本地 README 中可能仍有旧的位置参数写法，**本章以 4.2 的 `wifi_shell.c` 实际解析为准**。使用 `wifi connect -h` 查看当前固件命令帮助。

请使用你拥有或获准连接的测试 AP。不要把真实密码提交到源码仓库、截图或共享日志。

## 10.4 连接成功与网络可用不是同一状态

推荐状态机：

```text
接口可用 → 请求连接 → 关联/认证成功 → DHCP取得地址
         → DNS可用 → 建立TCP/UDP会话 → 应用协议交换
```

- 驱动就绪不代表已关联 AP。
- `net_mgmt()` 返回请求已受理，不等于连接完成。
- AP 关联成功不代表拿到 IPv4 地址。
- 能获得地址不代表能访问互联网或通过 DNS。
- Wi-Fi 信号稳定不代表远端服务器一定在线。

官方 ESP32-S3 Wi-Fi shell SoC 配置启用了 `CONFIG_ESP32_WIFI_STA_AUTO_DHCPV4`。若你沿用它，不要又在另一处无条件重复启动 DHCP；自定义程序应明确由谁管理地址分配。

## 10.5 编程接口与异步事件

典型头文件：

```c
#include <zephyr/net/net_if.h>
#include <zephyr/net/net_mgmt.h>
#include <zephyr/net/wifi_mgmt.h>
#include <zephyr/net/socket.h>
```

以下是连接请求**片段**，`iface` 必须是已选定的 Wi-Fi 网络接口，`ssid`/`psk` 是有效且生命周期足够长的缓冲区，程序还需注册事件回调并管理重连：

```c
struct wifi_connect_req_params params = {
    .ssid = ssid,
    .ssid_length = strlen((const char *)ssid),
    .psk = psk,
    .psk_length = strlen((const char *)psk),
    .security = WIFI_SECURITY_TYPE_PSK,
    .channel = WIFI_CHANNEL_ANY,
    .timeout = 30,
};
int ret = net_mgmt(NET_REQUEST_WIFI_CONNECT, iface,
                   &params, sizeof(params));
```

`strlen()` 需要 `<string.h>`。生产程序必须验证 SSID/密码长度，不把外部输入无限制复制到固定缓冲。

通过 `net_mgmt_init_event_callback()`、`net_mgmt_add_event_callback()` 订阅连接/断开/地址事件，检查事件携带的状态。事件回调中只更新状态或投递消息，不做长时间 DNS、TLS 握手或文件写入。

本地程序式连接参考是 `zephyr/samples/net/wifi/apsta_mode`，但它是 **AP+STA** 示例，默认配置针对经典 ESP32，不是已经适配好的 S3 纯 STA 工程。只借鉴请求和回调，不承诺换 `-b` 即可。

## 10.6 TCP、UDP 与 TLS

| 层 | 解决的问题 |
|---|---|
| Wi-Fi | 无线接入局域网 |
| DHCP / 静态配置 | IP 地址、网关等 |
| DNS | 域名到地址 |
| TCP | 可靠字节流；**无消息边界** |
| UDP | 数据报；可能丢失、重复或乱序 |
| TLS | 身份验证和加密传输，需要正确证书/时间/随机源 |
| MQTT / HTTP / 自定义协议 | 应用数据格式与业务语义 |

Zephyr 提供 `zsock_socket()`、`zsock_connect()`、`zsock_send()`、`zsock_recv()` 等接口。不能假定一次 send/recv 就是一个完整应用消息；TCP 必须设计长度字段、分隔符或固定帧，并处理部分发送、超时和断线。

数据缓冲要有上限，重连采用退避；网络线程不要长时间阻塞传感器采集线程。先在局域网测试简单协议，再增加 DNS、TLS 和公网服务。

官方 Wi-Fi shell 配置含用于样例的 `CONFIG_TEST_RANDOM_GENERATOR`。**测试随机源不能用于生产密钥或 TLS 安全要求**；量产需要合适的 entropy/CSPRNG、证书验证和时钟策略。不能通过关闭证书检查解决 HTTPS 问题。

## 10.7 STM32 外接 Wi-Fi 的两条路线

### 路线 A：Zephyr 驱动支持的外接网络设备

选择本 Zephyr 版本有驱动的明确模块型号，确认 UART/SPI/SDIO 接口、流控、复位/使能引脚、固件版本。通过设备树和 Kconfig 接入后，才能讨论复用网络接口/socket代码。

### 路线 B：外部模块提供完整 AT/应用协议

STM32 经 UART/SPI 与模块通信，模块自己运行 TCP/TLS。若没有相应 offload 驱动，你写的是模块协议适配器，不会自动获得 Zephyr `net_if`/socket。

必须处理异步通知、命令超时、转义、二进制长度、重连和版本兼容；不要在传感器线程里用长时间阻塞的 AT 等待循环。

本教程不指定未连接的模块型号，也不伪造 FK407M2 的 Wi-Fi overlay。先确定实际硬件，再编写板级适配。

## 10.8 验收与故障定位

1. 能扫描到你的2.4GHz AP。
2. 连接事件成功，`net iface` 显示有效地址。
3. 与受控局域网服务器交换少量数据。
4. AP 断电/恢复时无死锁，有退避重连。
5. 并发采集时队列长度有界、丢弃策略明确。

扫描不到：查天线/供电/2.4GHz/地区限制。认证失败：查安全模式和凭据。拿不到地址：查 DHCP。仅域名失败：查 DNS。仅 TLS 失败：查证书、时间、内存和随机源，不把问题全归因 Wi-Fi。

本章未执行模块下载、Wi-Fi 编译或射频连接测试。依据：`zephyr/drivers/wifi/esp32/Kconfig.esp32`、`zephyr/samples/net/wifi/shell`、`zephyr/subsys/net/l2/wifi/wifi_shell.c`。
