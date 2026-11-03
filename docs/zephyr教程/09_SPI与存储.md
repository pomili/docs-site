# 第 09 章：SPI、Flash 与持久化存储

[返回目录](README.md)

## 9.1 SPI 不负责定义器件协议

SPI 提供时钟、收发和片选；“发哪个命令、读几个字节、是否有 dummy cycle”由外设手册规定。它不像 I2C 那样用总线地址区分设备，一般通过独立 CS 区分。

| 信号 | ESP32-S3 SPI2 建议 | STM32 SPI2 建议 |
|---|---|---|
| SCK | GPIO12 | PB13 |
| MOSI | GPIO11 | PB15 |
| MISO | GPIO13 | PB14 |
| CS | GPIO10 | PB12 |

以上是本教程建议，需核对实物引出。注意 Flash/PSRAM 占脚，不能把所有 ESP32 GPIO 当自由引脚。使用外部模块时确认电源、I/O 电平、SPI mode 和最高频率。

## 9.2 先做无器件的线回环

独立实验只短接 MOSI 与 MISO，不连接会驱动 MISO 的外设。这样能验证基本路由和收发，不验证真实 SPI 器件协议或 CS 时序。

新建 `apps/spi_loopback`，标准 CMake，`prj.conf`：

```ini
CONFIG_SPI=y
CONFIG_PRINTK=y
```

ESP32 `boards/esp32s3_devkitc_esp32s3_procpu.overlay`：

```dts
#include <zephyr/dt-bindings/pinctrl/esp32s3-pinctrl.h>

&pinctrl {
    lesson_spi_pins: lesson_spi_pins {
        group1 {
            pinmux = <SPIM2_SCLK_GPIO12 SPIM2_MOSI_GPIO11 SPIM2_MISO_GPIO13>;
        };
    };
};

&spi2 {
    status = "okay";
    pinctrl-0 = <&lesson_spi_pins>;
    pinctrl-names = "default";
};

/ {
    aliases { lesson-spi = &spi2; };
};
```

该 pinctrl 不包含默认硬件 CS 路由；回环不需要片选。如果要普通 GPIO CS，也不能同时让同一脚被硬件 CS pinmux 占用。

STM32 `boards/fk407m2_stm32f407xx.overlay`：

```dts
&spi2 {
    status = "okay";
    pinctrl-0 = <&spi2_sck_pb13 &spi2_miso_pb14 &spi2_mosi_pb15>;
    pinctrl-names = "default";
};

/ {
    aliases { lesson-spi = &spi2; };
};
```

完整 `src/main.c`：

```c
#include <string.h>
#include <zephyr/kernel.h>
#include <zephyr/device.h>
#include <zephyr/drivers/spi.h>
#include <zephyr/sys/printk.h>

static const struct device *const bus = DEVICE_DT_GET(DT_ALIAS(lesson_spi));
static const struct spi_config config = {
    .frequency = 1000000,
    .operation = SPI_OP_MODE_MASTER | SPI_WORD_SET(8) | SPI_TRANSFER_MSB,
    .slave = 0,
};

int main(void)
{
    uint8_t tx[] = {0x55, 0xAA, 0x12, 0x34};
    uint8_t rx[sizeof(tx)];
    struct spi_buf tx_buf = {.buf = tx, .len = sizeof(tx)};
    struct spi_buf rx_buf = {.buf = rx, .len = sizeof(rx)};
    const struct spi_buf_set tx_set = {.buffers = &tx_buf, .count = 1};
    const struct spi_buf_set rx_set = {.buffers = &rx_buf, .count = 1};

    if (!device_is_ready(bus)) {
        printk("SPI not ready\n");
        return 0;
    }
    while (1) {
        memset(rx, 0, sizeof(rx));
        int ret = spi_transceive(bus, &config, &tx_set, &rx_set);
        if (ret < 0) {
            printk("SPI error: %d\n", ret);
        } else {
            printk("loopback %s\n", memcmp(tx, rx, sizeof(tx)) == 0 ? "OK" : "FAIL");
        }
        k_msleep(1000);
    }
    return 0;
}
```

```powershell
west build -b esp32s3_devkitc/esp32s3/procpu -d build/spi_esp32 apps/spi_loopback
west build -b fk407m2/stm32f407xx -d build/spi_stm32 apps/spi_loopback
```

示例尚未验证；若驱动要求硬件 CS/额外配置，检查其返回值和实际波形，不通过手动翻 CS 掩盖控制器配置问题。

## 9.3 实际器件使用 spi_dt_spec

实际设备推荐在 SPI 控制器下面建立带真实 binding 的子节点，设置 `reg`（片选索引）、`spi-max-frequency`、mode 等属性，控制器上定义 `cs-gpios`（如果使用 GPIO CS）。

API 片段：

```c
static const struct spi_dt_spec peripheral =
    SPI_DT_SPEC_GET(DT_NODELABEL(my_sensor),
                    SPI_OP_MODE_MASTER | SPI_WORD_SET(8), 0);
```

`my_sensor` 必须是**SPI 子设备**标签，不能把 `DT_NODELABEL(spi2)` 控制器直接塞给这个宏。也不要捏造一个不存在 binding 的 `compatible`，然后期望所有 `SPI_DT_SPEC_GET` 宏正常生成。

真实外设用已有 sensor/display/flash 驱动时，应优先使用该驱动的上层 API，不绕过驱动独占控制器事务。

## 9.4 SPI NOR Flash 的关键区别

接外部 NOR Flash 时，一般使用 `jedec,spi-nor` binding 和 Flash API。具体容量、JEDEC ID、擦除粒度、时序、SFDP 支持、保护位依据器件型号配置，不能假定任何 8 脚芯片都是同一款。

Flash 写入不是 RAM 赋值：

- 写入前可能需要擦除。
- 擦除单位可能是 sector/block，不是单字节。
- 写入有对齐、页边界和寿命限制。
- 应对断电中断，避免半写入数据被当成完整记录。
- 禁止把试验擦除范围指向 bootloader 或应用固件分区。

## 9.5 NVS、Settings、文件系统怎么选

| 需求 | 方案 |
|---|---|
| 少量参数、计数器、校准值 | NVS 等键值存储 |
| Zephyr 子系统配置，如蓝牙配对信息 | Settings + 合适的存储后端 |
| 需要文件名、目录、大块记录 | 文件系统，例如 LittleFS，配合明确分区 |
| 大容量可移动存储 | SD/MMC 或 SPI SD，取决于驱动和接线 |

NVS 和 Settings 不是两个互斥概念：Settings 可以使用 NVS 作为后端。

学习时先用官方样例并检查分区：`zephyr/samples/subsys/nvs`、`zephyr/samples/subsys/fs/littlefs`（运行前确认当前版本目录及目标要求）。不要只打开 `CONFIG_NVS=y` 就直接把任意内部 Flash 地址当数据区。

## 9.6 实验验收

1. 回环先跑低频，再逐渐提高并观察误码。
2. 接真实外设时先读 ID，再做可逆读操作，最后才写入/擦除。
3. 保存参数后重启验证，模拟断电时不能破坏固件区。
4. 总线共享时为 CS、SPI mode、频率和设备所有权建立清晰设计。
