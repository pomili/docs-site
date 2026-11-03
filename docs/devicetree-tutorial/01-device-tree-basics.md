# 第1章：设备树基础语法

## 1.1 什么是设备树？

设备树 (Devicetree, DT) 是一种**描述硬件配置**的数据结构，起源于 Open Firmware，后来被 Linux 内核和 Zephyr RTOS 采用。它用树形结构表达 SoC、总线、外设之间的层级关系。

**核心思想**: 硬件信息从代码中抽离到独立的 `.dts` 文本文件中，引导加载程序 (或 RTOS 内核) 在启动时解析并配置硬件。

### 1.1.1 传统方式 vs 设备树

```
传统裸机方式 (nRF5 SDK):
  nrf_gpio_cfg_output(LED_1);   // LED_1 = 13，宏定义在 board.h
  → 换一个引脚 = 修改宏 + 重编译

设备树方式 (Zephyr):
  leds { compatible = "gpio-leds"; led0: led_0 { gpios = <&gpio0 13 GPIO_ACTIVE_LOW>; }; };
  → 换一个引脚 = 改一行 DTS，不改 C 代码
```

### 1.1.2 设备树的三层文件体系

| 层级 | 扩展名 | 说明 | 举例 |
|------|--------|------|------|
| 源文件 | `.dts` | 手写的顶层设备树 | `nrf52840dk_nrf52840.dts` |
| 头文件 | `.dtsi` | 被 include 的模块化定义 | `nrf52840.dtsi`, `nrf52840_qiaa.dtsi` |
| 绑定文件 | `.yaml` | 驱动兼容性定义 | `gpio-leds.yaml`, `nordic,nrf-uarte.yaml` |

```
nrf52840dk_nrf52840.dts        ← 板级顶层 DTS
├── #include <nordic/nrf52840_qiaa.dtsi>  ← SoC 引脚/内存信息
├── #include "nrf52840dk_nrf52840-pinctrl.dtsi" ← Pin Control 定义
└── / { leds { ... }; buttons { ... }; }; ← 板级外设
```

## 1.2 设备树基本语法

### 1.2.1 节点 (Node)

设备树由**节点**组成，每个节点代表一个硬件组件。节点有名称、可选的单元地址、属性列表和子节点。

```
node-name@unit-address {
    property1 = <value>;
    property2 = "string";
    child-node { ... };
};
```

**命名规则**:
- `node-name`: 1-31 字符，只含小写字母、数字、下划线、中划线
- `@unit-address`: 可选的物理地址后缀，与 `reg` 属性首地址一致
- 同一级节点名称必须唯一

```dts
// 正确的节点名
uart0: serial@40002000 { ... };    // uart0 是 label, serial@40002000 是节点名
i2c@40003000 { ... };
led_0 { ... };                      // 虚拟设备可以没有 @addr
my-custom-sensor@76 { ... };       // I2C 地址作为 unit-address
```

### 1.2.2 根节点与路径

设备树始终有一个根节点 `/`，所有节点形成从根出发的路径：

```dts
/ {
    soc {
        uart0: serial@40002000 {
            status = "okay";
            current-speed = <115200>;
        };
    };
};
```

这个 UART 的完整路径是 `/soc/serial@40002000`。

### 1.2.3 属性 (Property)

属性是键值对，描述硬件特征。值类型丰富：

| 类型 | 语法 | 示例 |
|------|------|------|
| 布尔 | 属性名 (无值) | `hw-flow-control;` |
| 整型 | `<数字>` | `<115200>` |
| 整型数组 | `<a b c>` | `<0 1 2>` |
| 字符串 | `"text"` | `"nordic,nrf-uarte"` |
| 字符串列表 | `"a", "b"` | `"okay", "disabled"` (少见) |
| 字节数组 | `[hex]` | `[12 AB CD]` |
| phandle 引用 | `<&label>` | `<&gpio0 13 0>` |

```dts
// 属性示例集合
my-device@1000 {
    compatible = "vendor,device-name";       // 字符串 — 驱动匹配关键字
    reg = <0x1000 0x100>;                    // <地址 长度> — 寄存器区域
    interrupts = <42 1>;                     // <中断号 触发类型>
    clocks = <&clk_ms 0>;                    // phandle 引用时钟控制器
    label = "MY_DEV";                        // Zephyr 特有的标签 (已废弃)
    status = "okay";                         // "okay" / "disabled" / "reserved" / "fail"
    dmas = <&dma0 2>, <&dma1 5>;            // 多值数组
    enable-gpios = <&gpio0 13 GPIO_ACTIVE_LOW>;  // GPIO 描述
};
```

### 1.2.4 phandle — 节点间引用

phandle (pointer handle) 是设备树的核心机制，让节点可以引用其他节点。

```dts
// gpio0 被定义在 SoC 级别的 dtsi 中
soc {
    gpio0: gpio@50000000 {
        compatible = "nordic,nrf-gpio";
        reg = <0x50000000 0x1000>;
        #gpio-cells = <2>;     // GPIO 描述符需要 2 个 cell
    };
};

// 在板级 dts 中引用
/ {
    leds {
        led0: led_0 {
            gpios = <&gpio0 13 GPIO_ACTIVE_LOW>;
            //        ^      ^    ^
            //        |      |    +-- 标志位 (低电平有效)
            //        |      +------- 引脚号 (P0.13)
            //        +-------------- phandle 引用 gpio0 控制器
        };
    };
};
```

`#gpio-cells = <2>` 声明了这个 GPIO 控制器需要 2 个参数 (pin number + flags)。

### 1.2.5 标签 (Label) 与引用

标签用于在 DTS 中跨文件引用节点：

```dts
// 定义节点时打上标签
i2c0: i2c@40003000 { ... };

// 在别处通过 &i2c0 引用并追加/修改属性
&i2c0 {
    clock-frequency = <I2C_BITRATE_FAST>;  // 添加属性
};

// 在 C 代码中通过路径获取
// #define I2C0_NODE DT_NODELABEL(i2c0)
```

## 1.3 设备树的三个标准属性

### 1.3.1 compatible — 驱动兼容性

```dts
compatible = "nordic,nrf52-uarte";             // 单条目
compatible = "nordic,nrf52840-uarte", "nordic,nrf-uarte";  // 多条目 (具体→通用)
```

`compatible` 是最重要的属性——内核用它匹配驱动程序。"厂商,型号" 是命名惯例。

### 1.3.2 reg — 寄存器地址

```dts
reg = <0x40002000 0x1000>;  // 起始地址 0x40002000，长度 0x1000
```

`reg` 的编码方式由父节点定义：
- `#address-cells = <1>`: 地址占 1 个 32-bit cell
- `#size-cells = <1>`: 长度占 1 个 32-bit cell

```dts
// I2C 设备：reg 编码为 1 个 cell (I2C 地址)
i2c0: i2c@40003000 {
    #address-cells = <1>;
    #size-cells = <0>;        // I2C 设备不需要 size
    bme280@76 {
        reg = <0x76>;         // 仅地址：1 个 cell
    };
};
```

### 1.3.3 status — 外设开关

```
status = "okay"       // 设备已启用 (Zephyr 默认)
status = "disabled"   // 设备被禁用
status = "reserved"   // 设备保留 (用于禁用但不可被 overlay 启用)
status = "fail"       // 设备有故障
```

`status = "disabled"` 在 Zephyr 中的作用：**内核不会为此设备初始化驱动**，节省 RAM/Flash。

## 1.4 设备树预处理器

Zephyr 的设备树编译经过 C 预处理器，支持 `#include`, `#define`, `#ifdef` 等宏。

```dts
#include <nordic/nrf52840_qiaa.dtsi>   // 引入 SoC 定义
#include "board-pinctrl.dtsi"           // 引入本地 pin control

// 宏常数
#define I2C_SPEED I2C_BITRATE_STANDARD  // Zephyr 预定义宏

// 条件编译
#if defined(CONFIG_SENSOR_BME280)
    bme280@76 { compatible = "bosch,bme280"; reg = <0x76>; };
#endif
```

### 1.4.1 Zephyr 内置宏速查

| 宏 | 含义 | 值 |
|----|------|-----|
| `GPIO_ACTIVE_LOW` | 低电平有效 | 1 |
| `GPIO_ACTIVE_HIGH` | 高电平有效 | 0 |
| `GPIO_PULL_UP` | 上拉 | bitmask |
| `GPIO_PULL_DOWN` | 下拉 | bitmask |
| `GPIO_OPEN_DRAIN` | 开漏输出 | bitmask |
| `I2C_BITRATE_STANDARD` | 100 kHz | 宏值 |
| `I2C_BITRATE_FAST` | 400 kHz | 宏值 |
| `NRF_PSEL_DISCONNECT` | 引脚未连接 | 0xFFFFFFFF |

## 1.5 设备树操作符

### 1.5.1 修改 / 追加现有节点

```dts
&uart0 {
    current-speed = <115200>;
    status = "okay";
};
```

使用 `&label` 引用已有节点，在其内部添加或覆盖属性。

### 1.5.2 删除节点或属性

```dts
/delete-node/ &spi2;              // 删除整个 spi2 节点
/delete-property/ interrupts;      // 在当前上下文中删除 interrupts 属性
```

典型使用场景：板级 dts 中禁用 SoC 默认开启但不用不到的外设。

### 1.5.3 父节点引用

```dts
&i2c0 {
    bme280@76 {
        compatible = "bosch,bme280";
        reg = <0x76>;
    };
};
```

这等价于直接写作嵌套形式：
```dts
/ {
    soc {
        i2c@40003000 {
            bme280@76 { ... };
        };
    };
};
```

显然 `&i2c0 { ... }` 更简洁、更可维护。

## 1.6 设备树编译过程

```
.dts 源文件 ──┬── 设备树编译器 (dtc) ──→ .dtb (扁平设备树二进制)
.dtsi 头文件 ─┘                         └→ devicetree_generated.h (Zephyr 独有)
                                               └→ C 宏供应用代码使用
```

Zephyr 在构建时会：
1. 运行 C 预处理器展开 `#include` 和 `#define`
2. 运行 dtc 编译为二进制 format
3. 生成 `devicetree_generated.h` 头文件 (所有 DT 信息变成 C 宏)
4. 应用代码通过 `#include <zephyr/devicetree.h>` 访问

**重要区别**：Linux 内核在运行时解析 `.dtb`，而 Zephyr 在**编译时**就将设备树信息转化为宏定义——没有运行时解析开销。

## 1.7 动手：编写你的第一个 dts 文件

```dts
/dts-v1/;

/ {
    model = "My Custom nRF52840 Board";
    compatible = "mycompany,myboard";

    chosen {
        zephyr,sram = &sram0;
        zephyr,flash = &flash0;
        zephyr,console = &uart0;
    };

    leds {
        compatible = "gpio-leds";
        led0: led_0 {
            gpios = <&gpio0 13 GPIO_ACTIVE_LOW>;
            label = "Blue LED";
        };
    };

    buttons {
        compatible = "gpio-keys";
        btn0: btn_0 {
            gpios = <&gpio0 11 GPIO_ACTIVE_LOW>;
            label = "Button 1";
            zephyr,code = <INPUT_KEY_0>;
        };
    };
};
```

**要点回顾**：
- `/dts-v1/` 声明这是 DTS v1 格式
- `chosen` 节点告诉内核哪些硬件承担特定角色 (控制台、存储等)
- 板级外设 (LED、按键) 定义在顶层，引用 SoC 的 GPIO 控制器
- phandle `&gpio0` 连接了板级定义和 SoC 级定义

---

**本章小结**：掌握了节点、属性、phandle、compatible、reg、status 这些基本概念，就能读懂大部分 `.dts` 文件。下一章深入 Zephyr 如何使用设备树模型。
