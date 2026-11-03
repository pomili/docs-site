# 第 02 章：设备树、Kconfig 与板级差异

[返回目录](README.md)

## 2.1 三层职责

| 层 | 回答的问题 | 典型文件 |
|---|---|---|
| 设备树 DTS / overlay | 硬件是什么、在哪里、用哪些引脚？ | 板 `.dts`、应用 `.overlay` |
| Kconfig | 编译哪些软件功能/驱动？ | `prj.conf`、板 defconfig |
| C 代码 | 业务什么时候读写设备、如何处理数据？ | `src/*.c` |

设备树启用了节点但 Kconfig 没有驱动，可能没有可用 device；打开驱动但没有正确硬件节点，也不会自动选好引脚。

## 2.2 设备树基本语法

```dts
/ {
    aliases {
        led0 = &user_led;
    };
};

&i2c1 {
    status = "okay";
    clock-frequency = <100000>;
};
```

- `/`：根节点。
- `&i2c1`：引用已有标签，覆盖或追加属性；不是 C 指针。
- `status = "okay"`：声明启用，不表示实物初始化一定成功。
- `<...>`：数值或 phandle cell 数组。
- `aliases`：给应用一个稳定名称，隐藏不同板的实际节点。
- `chosen`：为控制台、SRAM、Flash 等系统用途选择节点。
- `compatible`：对应设备树 binding，规定允许的属性和驱动匹配。

**label、节点路径、alias、运行时 device 名称不是同一个东西。** 学习阶段优先使用编译期 `DT_ALIAS`、`DT_NODELABEL`，不要到处写字符串寻找设备。

## 2.3 应用 overlay 的放置

```text
apps/my_app/
├── prj.conf
├── CMakeLists.txt
├── src/main.c
└── boards/
    ├── esp32s3_devkitc_esp32s3_procpu.overlay
    └── fk407m2_stm32f407xx.overlay
```

本版本可按完整目标中 `/` 替换为 `_` 的名称匹配板专用文件。只有相应板会加载相应文件。构建日志中的 `Found devicetree overlay` 是确认依据。

需要显式指定时：

```powershell
west build -p always -b fk407m2/stm32f407xx -d build/custom apps/my_app -- -DDTC_OVERLAY_FILE=boards/fk407m2_stm32f407xx.overlay
```

相对 overlay 路径以应用目录为基准。显式 `DTC_OVERLAY_FILE` 会改变默认选择，不应假定它总是追加到自动发现文件之后；需要额外叠加时了解 `EXTRA_DTC_OVERLAY_FILE`。先用自动匹配方式，避免初学时混用多种覆盖机制。

## 2.4 从 DTS 到 C

```c
#include <zephyr/device.h>
#include <zephyr/drivers/gpio.h>

static const struct gpio_dt_spec led =
    GPIO_DT_SPEC_GET(DT_ALIAS(led0), gpios);
```

这里把 GPIO 控制器、引脚和属性一起打包。`gpio_pin_set_dt(&led, 1)` 是逻辑有效：

- `GPIO_ACTIVE_HIGH`：输出高电平。
- `GPIO_ACTIVE_LOW`：输出低电平。

因此同一份代码可控制 ESP32 GPIO4 和 STM32 PC13。不要在应用中再次按板名取反。

使用设备前检查：

```c
if (!gpio_is_ready_dt(&led)) {
    /* 设备驱动未成功初始化，不能继续操作。 */
}
```

`DEVICE_DT_GET()` 获得引用不等于设备已经 ready。

## 2.5 pinctrl 与 GPIO 的区别

普通 GPIO 可由 `gpios = <&控制器 引脚 flags>` 描述。UART、I2C、SPI、PWM 等复用外设通常还需要 pinctrl：

```dts
&usart1 {
    pinctrl-0 = <&usart1_tx_pa9 &usart1_rx_pa10>;
    pinctrl-names = "default";
    current-speed = <115200>;
    status = "okay";
};
```

`usart1_tx_pa9` 等名字来自 STM32 pinctrl 头文件，不是任意字符串。ESP32 依靠另一套 pinmux 宏表达 GPIO matrix 的路由，不能把 STM32 pinctrl 片段原样复制过去。

同一物理引脚不能同时承担互相冲突的 GPIO、UART、PWM 功能。成功生成 DTS 不意味着外部线路没有冲突。

## 2.6 Kconfig 的写法与检查

`prj.conf` 使用 `CONFIG_` 前缀：

```ini
CONFIG_GPIO=y
CONFIG_I2C=y
CONFIG_LOG=y
CONFIG_MAIN_STACK_SIZE=2048
```

CMake 或 DTS 中的变量不一定能写进 prj.conf，例如 `BOARD_ROOT` 不是 Kconfig 选项。

配置交互界面：

```powershell
west build -d build/esp32s3 -t menuconfig
```

menuconfig 修改的是构建配置；要长期保留，应整理回应用源配置。遇到“被赋值 y，实际为 n”的警告，应检查依赖，而不是反复添加同一个选项。

## 2.7 FK407M2 当前基础定义

源码在 `boards/fanke/fk407m2/fk407m2.dts`：

- 8 MHz HSE，通过 PLL 配置系统时钟 168 MHz。
- USART1：PA9 / PA10，115200。
- LED：PC13，低有效。
- I2C1：PB6 / PB7，100 kHz。
- 没有默认 `sw0`。
- 不因芯片存在 USB/SPI/PWM 就默认全部启用。

这些来自当前代码定义。原理图资料先前清理时发生遗漏，不能将教程中的引脚推荐视为重新核实过原理图；上板前仍需对照实物及可靠板卡资料。

## 2.8 排错顺序

1. 构建日志有没有加载预期 overlay？
2. `zephyr.dts` 中节点是否启用、引脚是否正确？
3. `.config` 中驱动是否真的为 y？
4. 是否存在对应 `device`，运行时是否 ready？
5. 测量供电、复用、上拉、波形。

`undefined reference to __device_dts_ord_...` 通常要检查设备节点和驱动是否生成，不是简单“补一个 include”就能解决。
