# 第 11 章：BLE 蓝牙低功耗

[返回目录](README.md)

## 11.1 能力和分层

ESP32-S3 有 BLE，不支持把经典蓝牙 SPP 串口协议直接照搬过来。STM32F407 没有片上 BLE，需要外接控制器或模块。

本工作区 ESP32-S3 的蓝牙路径是：

```text
应用 → Zephyr Bluetooth Host / GATT → HCI驱动 → Espressif Controller与blobs → 射频
```

不是用 Zephyr 软件 Link Layer 替换 Espressif controller。芯片宣传支持某个蓝牙版本也不意味着该版本所有 feature 都在当前 Zephyr/驱动/样例中验证过。

## 11.2 先掌握术语

| 术语 | 含义 |
|---|---|
| Advertiser / Scanner | 广播者 / 扫描者，可不建立连接 |
| Peripheral / Central | 外围设备 / 中心设备角色 |
| Service | 一组相关功能，例如心率服务 |
| Characteristic | 有值、属性和访问权限的数据项 |
| UUID | 服务/特征标识，标准服务用分配编号，自定义通常用128位 |
| CCC | 客户端配置描述符，用于订阅通知/指示 |
| Notify | 无 ATT 层确认的值更新；不等于业务已消费 |
| Indicate | 带 ATT 确认的值更新；仍不替代业务确认 |
| Pairing / Bonding | 建立安全关系 / 持久化保存密钥 |

“GATT server”不必然等于 peripheral，协议角色应分开理解。

## 11.3 模块准备

官方 `peripheral` 示例启用 SMP、隐私、Settings 等。此 Zephyr 4.2 的依赖为 `BT_SMP → BT_CRYPTO → MBEDTLS/PSA`，不能照旧教程只装 tinycrypt。

如果第10章已补齐 mbedtls，无需重复。否则准备无线实验时执行（会联网；教程编写未执行）：

```powershell
west config --local manifest.project-filter -- '-.*,+cmsis,+cmsis_6,+hal_stm32,+hal_espressif,+hal_xtensa,+mbedtls'
west update mbedtls
west blobs list hal_espressif
```

保留你后来加入的其他白名单项目。S3 的 Bluetooth HCI 节点已由上游板定义选中；不要为它套用外部 UART HCI 的 overlay。

## 11.4 从官方 Peripheral 样例开始

```powershell
west build -p always -b esp32s3_devkitc/esp32s3/procpu -d build/ble_peripheral zephyr/samples/bluetooth/peripheral
```

按第13章烧录后，用 BLE 调试手机 App 扫描、连接、发现服务，查看 characteristic，尝试订阅允许 notify 的特征。只操作你自己的设备。

官方样例包含 Battery/Heart Rate/Device Information 等服务，以及 Settings/NVS，不是只有十行代码的最简广播程序。所需 Flash 分区与存储配置需保持正确；不要为了“清配对”直接擦除不明地址。

## 11.5 最小广播实验：完整 main.c

若想先理解广播，可新建 `apps/ble_beacon`。它是**不可连接广播**，因此不会出现可连接的 GATT 服务。

`prj.conf`：

```ini
CONFIG_BT=y
CONFIG_BT_BROADCASTER=y
CONFIG_BT_DEVICE_NAME="ZephyrLesson"
CONFIG_PRINTK=y
```

完整代码：

```c
#include <zephyr/kernel.h>
#include <zephyr/bluetooth/bluetooth.h>
#include <zephyr/bluetooth/gap.h>
#include <zephyr/sys/printk.h>
#include <zephyr/sys/util.h>

static const struct bt_data ad[] = {
    BT_DATA_BYTES(BT_DATA_FLAGS, BT_LE_AD_GENERAL | BT_LE_AD_NO_BREDR),
    BT_DATA(BT_DATA_NAME_COMPLETE, CONFIG_BT_DEVICE_NAME,
            sizeof(CONFIG_BT_DEVICE_NAME) - 1),
};

int main(void)
{
    int ret = bt_enable(NULL);
    if (ret) {
        printk("Bluetooth init failed: %d\n", ret);
        return 0;
    }
    ret = bt_le_adv_start(BT_LE_ADV_NCONN, ad, ARRAY_SIZE(ad), NULL, 0);
    if (ret) {
        printk("Advertising failed: %d\n", ret);
        return 0;
    }
    printk("Non-connectable advertising started\n");
    return 0;
}
```

标准 CMake 与第01章相同，构建：

```powershell
west build -b esp32s3_devkitc/esp32s3/procpu -d build/ble_beacon apps/ble_beacon
```

最小广播不等于启用了配对服务，其依赖与完整 peripheral 示例不同；本教程仍建议先准备第11.3节统一的无线依赖。上面代码未编译或上板验证。

## 11.6 从广播升级为 GATT

一般步骤：

1. `bt_enable()` 初始化协议栈。
2. 如启用持久化，按样例流程在合适时机 `settings_load()`。
3. 定义服务、特征、read/write 回调和 CCC。
4. 注册连接/断开回调。
5. 启动可连接广播。
6. 客户端连接、发现服务并写 CCC 开启订阅。
7. 应用在线程上下文中按需发送 `bt_gatt_notify()` 或 indication。

API 片段（不是完整服务声明）：

```c
/* attr 必须指向本服务的特征值属性；data 在调用要求的生命周期内有效。 */
int ret = bt_gatt_notify(conn, attr, data, length);
```

不要随意硬编码 `attrs[3]` 却不解释它对应哪个 characteristic value。修改服务声明后属性下标可能变化。

read/write 回调必须检查 offset、长度、权限和数据格式。不要在协议栈回调中执行耗时 Flash 擦除或阻塞 I2C；先复制小消息到队列，再由应用线程处理。

## 11.7 MTU、分包与吞吐

默认 ATT MTU 为23时，常见 notification 可用值负载为20字节；协商更大 MTU 后也不能假设每个手机都接受相同大小。还受连接间隔、PHY、controller缓冲、通知排队、无线干扰影响。

应用数据应有明确格式：版本、序号、类型、长度、字节序。发送 C 结构体的原始内存可能带 padding，跨编译器/手机端不可移植。

返回资源不足时应稍后重试或按策略丢弃，而不是高优先级死循环发送。BLE 和 Wi-Fi 并发共享射频/资源，必须实测延迟、吞吐和功耗。

## 11.8 安全不是“配对弹窗”四个字

- 需要保密的 characteristic 要设置恰当的加密/认证权限。
- Just Works 通常不能提供 MITM 防护；根据实际输入输出能力选择配对方式。
- Bonding 保存密钥，应规划 Settings/NVS 分区和清除流程。
- 不记录密钥，不用固定口令代替完整安全设计。
- Bluetooth 地址可能随隐私机制改变，不应单靠 MAC 地址作为永久业务身份。

要验证未配对设备是否确实被拒绝访问敏感特征，而不是仅验证已配对手机能读到值。

## 11.9 STM32 外接 BLE

### 外接 HCI Controller

外部芯片负责 controller，STM32 运行 Zephyr Host。需要兼容 HCI 固件、UART/SPI transport、波特率/流控、复位和缓冲配置。正确接入后 GATT 应用逻辑通常可复用。

### 外接完整 BLE 模块

模块自己运行 Host/GATT，STM32 通过 AT/私有协议传数据。此时 STM32 上的 Zephyr Bluetooth Host API 不会自动生效，需要模块协议层；不能把“串口透明传输模块”当作 HCI controller。

当前 FK407M2 没有配置任何外接 BLE 模块，因此本章不提供虚构的“一条 west 命令即可启用蓝牙”。

## 11.10 验收与参考

分阶段验收：看到广播 → 连接 → 发现服务 → 读写 → 订阅通知 → 断线重连 → 重启后密钥恢复 → 权限拒绝测试。

本地参考：`zephyr/samples/bluetooth/peripheral`、`zephyr/subsys/bluetooth/host/Kconfig`、`zephyr/subsys/bluetooth/crypto/Kconfig`、`zephyr/include/zephyr/bluetooth/`。

本章没有执行无线构建、手机连接或射频测试。实际成功结果必须由你的硬件实验记录，不用示意日志代替。
