# 第 12 章：USB 设备开发——必须区分硬件与协议栈

[返回目录](README.md)

## 12.1 三种“USB 串口”不是一回事

| 类型 | 谁实现 USB 协议 | MCU 软件看到什么 |
|---|---|---|
| 外部 USB-UART 桥 | CH340/CP210x 等桥接芯片 | 普通 UART |
| ESP32-S3 USB Serial/JTAG | 芯片内置专用硬件控制器 | Zephyr serial/UART API |
| Zephyr USB CDC ACM | MCU USB controller + Zephyr USB 栈 | CDC 类提供的虚拟 UART |

都可能在电脑上显示 COM 口，但引脚、初始化、驱动和可扩展能力不同。不要以“设备管理器出现串口”判断固件使用哪一种。

## 12.2 当前版本支持边界

### ESP32-S3

芯片有 full-speed USB OTG 和 USB Serial/JTAG，内部 PHY 的 D- 为 GPIO19、D+ 为 GPIO20。

但本地 Zephyr **4.2.0** 中，已核查到的是 `usb_serial` / `espressif,esp32-usb-serial` 串口驱动；没有找到 S3 的通用 USB device/UDC 接入节点及对应 OTG 驱动集成。

因此：

- 可以按本节尝试内置 USB Serial/JTAG 控制台。
- **不能虚构 `&usb0` 或 `&zephyr_udc0`，声称 S3 可直接运行本版本通用 USB CDC/HID 样例。**
- 若目标是 S3 自定义 HID/复合设备，需要先确认支持该硬件的 Zephyr 版本/驱动，或进行真正的驱动移植；不是本章几行 overlay 能解决。

### STM32F407 / FK407M2

芯片有 USB OTG FS；本地 SoC 定义 `usbotg_fs`，PA11/PA12 对应 D-/D+，存在 Zephyr STM32 USB 驱动。

当前自定义板未启用 USB，也没有 `zephyr_udc0` 标签。需要应用 overlay、正确时钟以及真实连接器线路。不能从“芯片有 USB”推导“开发板某接口必定已经可用”。

## 12.3 ESP32-S3：内置 USB Serial/JTAG 控制台

创建独立应用 `apps/usb_serial_demo`，采用第01章 Hello World 的 CMake/main.c。创建 `boards/esp32s3_devkitc_esp32s3_procpu.overlay`：

```dts
/ {
    chosen {
        zephyr,console = &usb_serial;
        zephyr,shell-uart = &usb_serial;
    };
};

&usb_serial {
    status = "okay";
};
```

`prj.conf`：

```ini
CONFIG_SERIAL=y
CONFIG_CONSOLE=y
CONFIG_UART_CONSOLE=y
CONFIG_PRINTK=y
CONFIG_SERIAL_ESP32_USB=y
```

构建：

```powershell
west build -b esp32s3_devkitc/esp32s3/procpu -d build/usb_serial_s3 apps/usb_serial_demo
```

这使用芯片内置 USB 协议实现，不需要为它创建 `compatible = "zephyr,cdc-acm-uart"` 子节点，也不是 `CONFIG_USB_DEVICE_STACK=y` 启动的软件 USB 栈。

接到板上实际路由 GPIO19/20 的原生 USB 口；部分开发板另有 USB-UART 桥口，不能混淆。连接方式、供电和硬件版次需核对。程序刚启动的输出可能发生在主机打开串口之前，所以使用循环打印验证而不是仅打印一次。

本例尚未编译/上板验证；启用成功也不意味着可以在该专用接口上任意增加 HID/MSC 类。

## 12.4 STM32：USB FS 硬件核查

需要确认：

1. PA11=D-、PA12=D+ 确实连接到期望接口。
2. PLL_Q 为48MHz。当前板配置 HSE8MHz、M8、N336、Q7，算术上是48MHz。
3. 引脚复用、USB controller 时钟和驱动均启用。
4. USB VBUS 检测/供电、Type-C CC 电阻（若为Type-C）、保护器件和线路完整。
5. 使用有数据线的 USB 线，不是只有供电的线。

**PA9/PA10 当前用于 USART1。不要未经板卡资料核查就把 PA9 改为 USB VBUS sensing。**

当前原理图文件未保存在新工作区，已在之前清理事故中遗漏；这里的引脚来自 SoC/板级代码，不是重新核验了板上连接器。硬件不明确时先补齐可信资料，不靠猜测短接线路。

## 12.5 创建 USB 控制器 overlay

为了不修改公共板文件，先自行创建 `apps/usb_board/fk407m2_usb.overlay`（这个目录只是放配置，不需要 CMake）：

```dts
zephyr_udc0: &usbotg_fs {
    pinctrl-0 = <&usb_otg_fs_dm_pa11 &usb_otg_fs_dp_pa12>;
    pinctrl-names = "default";
    status = "okay";
};
```

它启用已有控制器，并为官方 sample 提供 `zephyr_udc0` 标签。**这只是软件最小模板，不补偿缺失的 VBUS/连接器硬件条件。**

官方 sample 自己的 `app.overlay` 已包含 CDC 子节点：

```dts
&zephyr_udc0 {
    cdc_acm_uart0 {
        compatible = "zephyr,cdc-acm-uart";
        label = "Zephyr USB CDC-ACM";
    };
};
```

不要再复制同一子节点造成重复设备。

## 12.6 Zephyr 4.2 两种 USB 设备栈

| 项目 | Legacy | Next |
|---|---|---|
| 配置 | `CONFIG_USB_DEVICE_STACK` | `CONFIG_USB_DEVICE_STACK_NEXT` |
| 典型接口 | `usb_enable()` | `usbd_init()` / `usbd_enable()` 等 |
| CDC sample 配置 | `prj.conf` | `usbd_next_prj.conf` |
| 状态 | 旧 API，文档有迁移计划 | 本地4.2文档仍标实验性，按具体驱动验证 |

不要把两套初始化混在一个应用，也不要说“Zephyr4.2已经删除旧栈”。本地 CDC sample 默认仍使用旧配置，新栈需要明确选择。

## 12.7 使用官方 CDC ACM 回显样例

样例目录：`zephyr/samples/subsys/usb/cdc_acm`。必须先完成第12.5节创建控制器 overlay，再执行下面命令。

**overlay 顺序很重要**：官方 `app.overlay` 先引用 `&zephyr_udc0`，而 FK407M2 原板没有该标签。不能只用 `EXTRA_DTC_OVERLAY_FILE` 在它后面定义标签；顶层 `&label` 块解析时需要标签已存在。显式把控制器 overlay 放前、官方 app.overlay 放后。

Legacy：

```powershell
west build -p always -b fk407m2/stm32f407xx -d build/usb_stm32_legacy zephyr/samples/subsys/usb/cdc_acm -- "-DDTC_OVERLAY_FILE=F:/zephyr_tutorial/zephyr_workspace/apps/usb_board/fk407m2_usb.overlay;F:/zephyr_tutorial/zephyr_workspace/zephyr/samples/subsys/usb/cdc_acm/app.overlay"
```

Next：

```powershell
west build -p always -b fk407m2/stm32f407xx -d build/usb_stm32_next zephyr/samples/subsys/usb/cdc_acm -- -DCONF_FILE=usbd_next_prj.conf "-DDTC_OVERLAY_FILE=F:/zephyr_tutorial/zephyr_workspace/apps/usb_board/fk407m2_usb.overlay;F:/zephyr_tutorial/zephyr_workspace/zephyr/samples/subsys/usb/cdc_acm/app.overlay"
```

PowerShell 中给含分号参数加引号，避免被拆成命令。这里 `CONF_FILE` 是选择完整配置文件，**不是把 legacy prj.conf 和 next prj.conf 一起叠加**。

这些是待验证命令，没有在本教程编写中执行。编译若因控制器驱动、Kconfig或时钟失败，应按日志定位，不删掉报错依赖强行绕过。

## 12.8 初始化、DTR 与回显

旧栈示例调用 `usb_enable(NULL)`；新栈示例使用 sample helper `sample_usbd_init_device()`，其内部配置描述符、configuration、class，再初始化设备。这个 helper 来自官方 sample 的 common 代码，不是任意应用自动具备的核心 API。

CDC 回显最终使用 UART API，但还有 USB 生命周期：

- USB 枚举完成不等于主机应用已经打开 COM 口。
- sample 会等待 DTR，终端软件需要正确打开串口并设置 DTR。
- 拔线、挂起、重连时不得永远阻塞关键采集线程。
- 缓冲区背压要明确，不允许主机不读时无限累积。

回显不是日志控制台。另有 `zephyr/samples/subsys/usb/console` 和 `console-next`；后者使用 `CONFIG_CDC_ACM_SERIAL_INITIALIZE_AT_BOOT` 路径，不要再机械加入旧栈 `usb_enable()`。

## 12.9 HID、MSC 与复合设备

CDC跑通后再考虑：

- HID：报告描述符、报告长度、轮询间隔、主机枚举一致性。
- MSC：块设备与文件系统所有权；不能 MCU 和电脑同时无协调地挂载写同一文件系统。
- 复合设备：端点数量、interface编号、描述符、驱动资源限制。

STM32 FS 控制器端点资源有限，不能无限增加类。量产需合法 VID/PID 和准确描述符，不把 sample 标识直接当自己的产品身份。

## 12.10 分层排错

没有主机枚举：查线、接口、供电、D+/D-、48MHz、pinctrl和驱动启动。

枚举但没 COM：查描述符、设备类和主机驱动。

有 COM 不回显：查 DTR、本地回显开关、固件是否等待条件、串口是否被其他程序占用。

数据丢失：查发送缓冲、主机读取、USB状态、线程阻塞，不把 UART 虚拟接口等同无限速缓存。

本地依据：`drivers/serial/Kconfig.esp32`、S3 DTS 的 `usb_serial`、`dts/arm/st/f4/stm32f4.dtsi`、`drivers/usb/udc/Kconfig.stm32`、`samples/subsys/usb/cdc_acm`、`scripts/dts/python-devicetree/src/devicetree/dtlib.py`。
