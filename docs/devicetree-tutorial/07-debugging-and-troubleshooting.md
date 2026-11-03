# 第7章：设备树调试与排错

> 本仓库章节只有Markdown，以下命令须对自行建立的实际Zephyr应用执行，不能在本章目录直接构建。Windows PowerShell用 `Get-Content <文件> | Select-String <模式>` 或 `Select-String -Path <文件> -Pattern <模式>` 代替下文的 `cat/grep`；NCS3.3.0用 `nrf52840dk/nrf52840` 新板名。Sysbuild产物可能位于 `<build>/<应用名>/zephyr/`，以实际生成目录为准，不要固定假设所有版本都是 `build/zephyr`。

## 7.1 诊断流程

当设备树表现不正常时——外设不工作、驱动未初始化、引脚无波形——按以下流程逐一排查：

```
① 我的节点在最终设备树中存在吗？
   → cat build/zephyr/zephyr.dts.pre | grep "my_device"

② 驱动匹配到了这个节点吗？
   → cat build/zephyr/zephyr.dts | grep "compatible"

③ 节点的 status 是 "okay" 吗？
   → DTS 中 status = "okay" 且 Kconfig 中对应 CONFIG_XXX=y

④ 引脚配置正确吗？
   → 对照原理图和 pinctrl 配置

⑤ 驱动初始化成功了吗？
   → 在 C 代码中检查 device_is_ready() 返回值
```

## 7.2 查看合并后的最终设备树

这是排错的最重要工具。很多问题的根源在于 overlay 没有按预期合并。

```bash
# 构建项目
west build -b nrf52840dk_nrf52840

# 查看最终设备树 (可读文本格式)
cat build/zephyr/zephyr.dts.pre

# 查看其中的某个节点
grep -A 30 "bme280" build/zephyr/zephyr.dts.pre

# 查看 pin control 合并结果
grep -A 15 "uart0_default" build/zephyr/zephyr.dts.pre
```

### 7.2.1 看懂 zephyr.dts.pre

```dts
// build/zephyr/zephyr.dts.pre (片段)
/ {
    model = "Nordic nRF52840 DK NRF52840";
    // ... 这包含了所有 include 和 overlay 合并后的完整设备树

    soc {
        i2c@40003000 {              // ← i2c0 的实际节点名
            compatible = "nordic,nrf-twim";
            reg = <0x40003000 0x1000>;
            status = "okay";
            clock-frequency = <400000>;    // ← 你的 overlay 值是否在此?

            bme280@76 {                     // ← 你的设备是否在此?
                compatible = "bosch,bme280";
                reg = <0x76>;
            };
        };
    };
};
```

### 7.2.2 检查 devicetree_generated.h

```bash
# 查看生成的宏 — 了解 C 代码能访问什么
cat build/zephyr/include/generated/devicetree_generated.h | less

# 检查特定节点是否存在
grep "BME280" build/zephyr/include/generated/devicetree_generated.h

# 检查属性值是否被正确解析
grep "current_speed" build/zephyr/include/generated/devicetree_generated.h
```

### 7.2.3 使用 C 代码中的编译时断言

在排错时临时加入断言，编译时就能发现设备树问题：

```c
#include <zephyr/devicetree.h>

// 1. 检查节点是否存在
#define MY_NODE DT_NODELABEL(my_device)
#if !DT_NODE_EXISTS(MY_NODE)
#error "my_device node not found. Check your overlay!"
#endif

// 2. 检查 GPIO 是否被正确引用
#define LED_GPIO_NODE DT_GPIO_CTLR(DT_ALIAS(led0), gpios)
#if !DT_NODE_HAS_COMPAT(LED_GPIO_NODE, nordic_nrf_gpio)
#error "LED GPIO controller is not nrf-gpio!"
#endif

// 3. 检查状态
#define UART0_NODE DT_NODELABEL(uart0)
#if !DT_NODE_HAS_STATUS(UART0_NODE, okay)
#error "UART0 is not okay! Check status in DTS."
#endif

// 4. 打印设备树信息 (编译时可见)
#pragma message "UART0 current-speed is: " \
    STRINGIFY(DT_PROP(UART0_NODE, current_speed))
```

## 7.3 常见问题与解决方案

### 问题 1：外设驱动没有初始化

**症状**：`device_is_ready()` 返回 false，外设不工作。

**排查步骤**：

```c
const struct device *dev = DEVICE_DT_GET(DT_NODELABEL(uart1));

if (dev == NULL) {
    printk("dev is NULL\n");    // ① 设备对象没生成
}
if (!device_is_ready(dev)) {
    printk("dev not ready\n");  // ② 初始化失败
}
```

**可能原因和解决**：

| 原因 | 检查 | 解决 |
|------|------|------|
| `status = "disabled"` | `grep status zephyr.dts.pre` | 在 overlay 中设 `status = "okay"` |
| Kconfig 未启用 | `grep CONFIG_UART_1 build/zephyr/.config` | 在 `prj.conf` 中添加配置 |
| 引脚冲突 | 两个外设用了同一引脚 | 对照 nRF52840 原理图重新分配 |
| 依赖未初始化 | 初始化优先级太低 | 调整 `DEVICE_DT_DEFINE` 的优先级参数 |

### 问题 2：GPIO 引脚无输出

**症状**：LED 不亮，逻辑分析仪无波形。

```bash
# 检查引脚是否被正确分配
grep -A 20 "gpio@50000000" build/zephyr/zephyr.dts.pre
```

```c
// 运行时诊断
static const struct gpio_dt_spec led = GPIO_DT_SPEC_GET(DT_ALIAS(led0), gpios);

void diagnose_gpio(void)
{
    printk("LED port: %p, pin: %d, flags: 0x%x\n",
           led.port, led.pin, led.dt_flags);

    if (led.port == NULL) {
        printk("ERROR: LED port device is NULL\n");
    }
}
```

**常见 GPIO 陷阱**：

```dts
// 错误 1：引脚被 NFC 占用
// P0.09 和 P0.10 默认被 NFC 占用，需要手动禁用 NFC
&nfct { status = "disabled"; };    // ← 容易忘记

// 错误 2：GPIO 标志混淆
gpios = <&gpio0 13 GPIO_ACTIVE_LOW>;
//                     ^^^^^^^^^^^^^^^^ 这是 bitmask，不是 active=low

// GPIO_ACTIVE_LOW = 1  → pin 配置为 active low
// 0 = GPIO_ACTIVE_HIGH → pin 配置为 active high

// 错误 3：用 gpio1 但忘记使能
&gpio1 { status = "okay"; };  // gpio1 默认 disabled
```

### 问题 3：I2C 设备通信失败

**症状**：`i2c_write()` 返回 -EIO，`sensor_sample_fetch()` 失败。

**排查流程**：

```bash
# 1. 检查 I2C 控制器是否启用
grep -A 15 "i2c@40003000" build/zephyr/zephyr.dts.pre

# 2. 检查你的 I2C 设备是否在正确的总线下
grep -A 10 "bme280" build/zephyr/zephyr.dts.pre

# 3. 检查引脚是否被复用
grep "psels.*26\|psels.*27" build/zephyr/zephyr.dts.pre
#   → P0.26 (SDA) 和 P0.27 (SCL) 是否同时出现在多个外设中
```

```c
// 运行时 I2C 诊断
static const struct i2c_dt_spec i2c_dev =
    I2C_DT_SPEC_GET(DT_NODELABEL(bme280));

void diagnose_i2c(void)
{
    if (!i2c_is_ready_dt(&i2c_dev)) {
        printk("I2C bus not ready\n");
        return;
    }

    // 尝试探测 I2C 地址
    uint8_t dummy;
    int ret = i2c_write_dt(&i2c_dev, &dummy, 0);  // 空写测试 ACK
    if (ret < 0) {
        printk("No ACK at address 0x%02x (err: %d)\n",
               i2c_dev.addr, ret);
        printk("Check: wiring, pull-up resistors, address\n");
    }
}
```

**I2C 常见陷阱**：
- nRF52840 的 I2C 引脚需要外部上拉电阻 (4.7kΩ) — 内部上拉不对 I2C 生效
- I2C0 和 SPI0 共享寄存器 → 不能同时使用
- I2C 地址在 overlay 中是 7-bit 格式：`reg = <0x76>` (不是 8-bit 的 0xEC)

### 问题 4：Overlay 没有生效

**症状**：修改了 `app.overlay`，但硬件行为没变化。

```bash
# 1. 确认 overlay 文件被 build system 发现
west build -b nrf52840dk_nrf52840 -t dts_dtc 2>&1 | head -50
# 正常输出包含: "Devicetree header saved to ..."

# 2. 列出所有被 include 的 DTS 文件
grep "^#include" build/zephyr/zephyr.dts.pre

# 3. 确认你的 overlay 中的节点在最终文件中
grep "your_custom_node" build/zephyr/zephyr.dts.pre
```

**检查清单**：
- `app.overlay` 是否在项目根目录 (与 `CMakeLists.txt` 同级)
- `CMakeLists.txt` 是否通过 `find_package(Zephyr)` 正确初始化
- 是否有其他 overlay 文件覆盖了你的设置 (Shield overlay 等)
- 节点名/标签名是否正确 (对照 `zephyr.dts.pre` 中的实际名称)

### 问题 5：设备树编译错误

```bash
# 常见错误诊断
# 语法错误
Error: app.overlay:10.1-2 syntax error
→ 检查第 10 行，通常是括号不匹配或缺少分号

# 节点已存在
Error: duplicate node name "my_device"
→ 同一个父节点下有两个同名子节点

# 属性不存在
Error: 'clock_frequency' is not a valid property for this compatible
→ 检查 binding YAML，确认属性名拼写正确

# phandle 参数个数错误
Error: property 'gpios' has length X, expected Y
→ #gpio-cells 值与 gpios 参数数不匹配
```

## 7.4 高级调试技巧

### 7.4.1 生成 RAM/ROM 报告查看设备开销

```bash
west build -b nrf52840dk_nrf52840 -t ram_report
west build -b nrf52840dk_nrf52840 -t rom_report
```

报告会列出每个设备对象占用的 RAM/ROM：

```
Memory region          Used Size   Region Size  %age Used
     FLASH:          52840 B          1 MB       5.04%
      SRAM:          12345 B        256 KB       4.71%

Devices (ROM):
  uart@40002000:        520 B       (driver + config)
  i2c@40003000:         468 B       (driver + config)
  gpio@50000000:        232 B       (driver exclusive)
  bme280@76:            820 B       (sensor driver)
```

如果看到预期外的设备，说明有未预期的节点启用了。

### 7.4.2 用 Python 脚本验证设备树

```python
#!/usr/bin/env python3
"""check_dt.py — 验证设备树是否符合预期"""
import sys
import re

def check_dts(dts_path):
    with open(dts_path) as f:
        content = f.read()

    checks = {
        "UART0 enabled":
            ('status = "okay"' in content and
             'uart@40002000' in content),
        "I2C0 enabled":
            ('status = "okay"' in content and
             'i2c@40003000' in content),
        "LEDs configured":
            'gpio-leds' in content,
        "Buttons configured":
            'gpio-keys' in content,
    }

    all_ok = True
    for name, result in checks.items():
        status = "PASS" if result else "FAIL"
        if not result:
            all_ok = False
        print(f"[{status:4}] {name}")

    return all_ok

if __name__ == "__main__":
    if not check_dts("build/zephyr/zephyr.dts.pre"):
        print("\nSome checks FAILED!")
        sys.exit(1)
```

### 7.4.3 对比两个构建的设备树

```bash
# 导出两个构建的设备树
cat build_a/zephyr/zephyr.dts.pre > /tmp/dt_a.txt
cat build_b/zephyr/zephyr.dts.pre > /tmp/dt_b.txt

# 对比差异
diff /tmp/dt_a.txt /tmp/dt_b.txt

# 只关注关键差异 (过滤时间戳等无关变化)
diff /tmp/dt_a.txt /tmp/dt_b.txt | grep -E "status|compatible|reg|gpios|psels"
```

## 7.5 设备树排错速查表

| 现象 | 第一检查点 | 命令/代码 |
|------|-----------|----------|
| 驱动未初始化 | `status` | `grep "status" zephyr.dts.pre \| grep my_dev` |
| GPIO 无输出 | 引脚号、标志 | `GPIO_DT_SPEC_GET(DT_ALIAS(led0), gpios)` |
| I2C 无 ACK | 设备在正确的总线? | `grep -B5 -A10 "bme280" zephyr.dts.pre` |
| SPI 无时钟 | CS 引脚配置 | `grep "cs-gpios" zephyr.dts.pre` |
| UART 无输出 | Pin Control | `grep -A15 "uart0_default" zephyr.dts.pre` |
| Overlay 不生效 | 文件路径、文件名 | `ls -la boards/*.overlay app.overlay` |
| PWM 无波形 | PSEL 引脚分配 | `grep "PWM_OUT" zephyr.dts.pre` |
| ADC 读数 0 | 参考电压配置 | `grep -A10 "adc@" zephyr.dts.pre` |
| 引脚冲突 | 同引脚多外设 | `grep "0, 13)" zephyr.dts.pre` (查 P0.13 被谁占用) |

## 7.6 最佳实践总结

### 代码审查检查点

在 PR 审查中关注设备树变更时，重点检查：

1. **引脚冲突** — 新加的外设是否使用了已被占用的引脚
2. **status 状态** — 新增节点是否 `status = "okay"`，废弃节点是否 `status = "disabled"`
3. **compatible 拼写** — compatible 字符串必须与 binding YAML 文件名完全匹配
4. **reg 格式** — I2C 的 reg 是 1 个 cell，SPI 的 reg 是 CS 索引，内存映射外设是 `<addr size>` 两个 cell
5. **pinctrl 匹配** — `pinctrl-0/1` 对应的 phandle 节点是否存在
6. **#-cells 一致性** — `gpios` 的参数个数等于 gpio 控制器的 `#gpio-cells`

### 提交信息规范

```
dts: add BME280 sensor on I2C0

Enable I2C0 (TWIM) on nRF52840 DK with BME280 at address 0x76.
Pins: SDA=P0.26, SCL=P0.27.

dts: remap UART0 to custom pins for rev B PCB

TX: P1.03, RX: P1.10. Disable RTS/CTS.
Overrides default pin mapping in board DTS.
```

---

**本章小结**：设备树排错的核心工具链是 `zephyr.dts.pre` (最终合并结果) + `devicetree_generated.h` (C 代码可访问的宏) + 编译时断言 (编译时发现问题)。90% 的设备树问题可以通过检查最终 DTS 中的节点存在性、status 状态、引脚分配这三项解决。
