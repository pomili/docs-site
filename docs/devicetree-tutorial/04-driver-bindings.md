# 第4章：设备树与驱动程序绑定

## 4.1 什么是 Devicetree Binding？

Binding (绑定) 是**设备树节点与驱动代码之间的契约**。它用 YAML 文件定义了：

1. 这个 `compatible` 值需要哪些**必需属性**
2. 每项属性的**类型**和**取值范围**
3. 哪些属性是**可选**的
4. 子节点的结构约束

输入：DTS 节点
```
bme280@76 {
    compatible = "bosch,bme280";
    reg = <0x76>;
};
```

Binding 校验：`dts/bindings/sensor/bosch,bme280.yaml`
```yaml
compatible: "bosch,bme280"
properties:
  reg:
    required: true     # reg 是必需的
```

驱动匹配：`drivers/sensor/bme280/bme280.c`
```c
#define DT_DRV_COMPAT bosch_bme280   // 声明此驱动匹配的 compatible

// Zephyr 自动为此 compatible 的所有实例生成 init 代码
DEVICE_DT_INST_DEFINE(...)
```

## 4.2 Binding YAML 文件结构

### 4.2.1 基本格式

```yaml
# zephyr/dts/bindings/sensor/bosch,bme280.yaml
description: BME280 temperature/humidity/pressure sensor

compatible: "bosch,bme280"

include: i2c-device.yaml     # 继承 I2C 设备的基础属性

properties:
  reg:
    required: true           # I2C 地址，必需

  vdd-supply:
    type: phandle            # 电源域引用 (可选)
    description: VDD power supply

  vddio-supply:
    type: phandle
    description: VDDIO power supply
```

### 4.2.2 包含与继承

```yaml
# i2c-device.yaml — 所有 I2C 设备的基类
on-bus: i2c                 # 声明此设备位于 I2C 总线上

properties:
  reg:
    required: true
    description: I2C address of the device

# → bosch,bme280.yaml 继承后自动拥有 reg 属性要求
```

常见基础 binding：

| 基类文件 | 继承的属性 |
|---------|----------|
| `i2c-device.yaml` | `reg` (I2C 地址) |
| `spi-device.yaml` | `reg` (片选索引), `spi-max-frequency` |
| `gpio-leds.yaml` | `gpios` |
| `pwm-leds.yaml` | `pwms` |
| `base.yaml` | `status`, `compatible`, `label`, `interrupts` |

### 4.2.3 属性类型详解

```yaml
properties:
  # 整型
  clock-frequency:
    type: int
    default: 100000
    enum: [100000, 250000, 400000]     # 只能取这些值

  # 布尔型
  hw-flow-control:
    type: boolean                       # 有/无此属性

  # 字符串
  status:
    type: string
    enum:
      - "okay"
      - "disabled"
      - "reserved"
      - "fail"

  # 数组
  reg:
    type: array

  # phandle 引用
  clocks:
    type: phandle-array

  # phandle 引用 + 参数
  gpios:
    type: phandle-array

  # 复合类型
  pinctrl-0:
    type: phandles
```

## 4.3 驱动匹配流程

### 4.3.1 从 DTS 到驱动的完整路径

```
步骤 1: DTS 声明
━━━━━━━━━━━━━━━━
app.overlay:
  &i2c0 {
    bme280@76 {
      compatible = "bosch,bme280";
      reg = <0x76>;
    };
  };

步骤 2: Zephyr edtlib Binding 校验（不是 dtc 匹配 YAML）
━━━━━━━━━━━━━━━━━━━━
Zephyr 的 Python 设备树处理工具检查:
  ✓ compatible = "bosch,bme280" → 匹配到 binding 文件
  ✓ reg 属性存在 (binding 要求 required: true)
  ✓ I2C 地址 0x76 格式正确

步骤 3: 生成设备树宏
━━━━━━━━━━━━━━━━━━━━
devicetree_generated.h:
  #define DT_N_S_soc_S_i2c_40003000_S_bme280_76_EXISTS 1
  // → DT_NODELABEL(bme280) 能定位到此节点
  // → DEVICE_DT_GET(DT_NODELABEL(bme280)) 返回设备对象

步骤 4: 驱动注册
━━━━━━━━━━━━━━━━━━━━
drivers/sensor/bme280/bme280.c:
  #define DT_DRV_COMPAT bosch_bme280
  // Kconfig/CMake 决定是否编译驱动（例如 CONFIG_BME280）
  // DT_DRV_COMPAT 只为 DT_INST_* 宏提供 compatible 标识
  // 驱动显式使用 DT_INST_FOREACH_STATUS_OKAY(BME280_DEFINE)
  // → 为每个启用实例展开 DEVICE_DT_INST_DEFINE
  // → 驱动初始化函数被加入启动序列
  // 仅有 compatible 或 DT_DRV_COMPAT 不会自动编译/注册驱动

步骤 5: 应用访问
━━━━━━━━━━━━━━━━━━━━
main.c:
  const struct device *dev = DEVICE_DT_GET_ONE(bosch_bme280);
  // → platform 宏展开为设备指针
  // → device_is_ready(dev) 检查驱动初始化是否完成
  // → sensor_sample_fetch(dev) 调用驱动的 fetch 函数
```

### 4.3.2 `DT_DRV_COMPAT` 驱动的魔法

在驱动源文件中，`DT_DRV_COMPAT` 是整个自动化的入口：

```c
// drivers/sensor/bme280/bme280.c (简化版)

#define DT_DRV_COMPAT bosch_bme280    // ← 关键宏

#include <zephyr/drivers/sensor.h>
#include <zephyr/pm/device.h>

struct bme280_data {
    // 校准数据
    uint16_t dig_T1;
    int16_t  dig_T2;
    int16_t  dig_T3;
    // ...
};

struct bme280_config {
    struct i2c_dt_spec i2c;
    // 设备树中无额外配置时可为空
};

// 初始化函数
static int bme280_init(const struct device *dev)
{
    const struct bme280_config *cfg = dev->config;

    // 检查 I2C 设备是否就绪
    if (!i2c_is_ready_dt(&cfg->i2c)) {
        return -ENODEV;
    }

    // 读取芯片 ID
    uint8_t chip_id;
    i2c_reg_read_byte_dt(&cfg->i2c, 0xD0, &chip_id);
    if (chip_id != 0x60) {    // BME280 芯片 ID
        return -EIO;
    }

    return 0;
}

// 传感器操作函数表
static const struct sensor_driver_api bme280_api = {
    .sample_fetch = bme280_sample_fetch,
    .channel_get  = bme280_channel_get,
    .attr_set     = bme280_attr_set,
};

// 从设备树生成 config 结构体
// DT_DRV_COMPAT 让这个宏为所有 bosch,bme280 节点生成实例
#define BME280_DEFINE(inst)                                               \
    static const struct bme280_config bme280_config_##inst = {           \
        .i2c = I2C_DT_SPEC_INST_GET(inst),                               \
    };                                                                    \
                                                                          \
    static struct bme280_data bme280_data_##inst;                         \
                                                                          \
    PM_DEVICE_DT_INST_DEFINE(inst, bme280_pm_action);                     \
    DEVICE_DT_INST_DEFINE(inst, bme280_init, PM_DEVICE_DT_INST_GET(inst), \
                          &bme280_data_##inst, &bme280_config_##inst,    \
                          POST_KERNEL, CONFIG_SENSOR_INIT_PRIORITY,      \
                          &bme280_api);

// 为每个实例调用 DEFINE 宏
DT_INST_FOREACH_STATUS_OKAY(BME280_DEFINE)
```

### 4.3.3 关键的 DT_INST 宏族

```c
// 这些宏由 DT_DRV_COMPAT 驱动，自动对应该驱动的各实例

// 获取当前驱动的第 inst 个实例
DT_DRV_INST(inst)

// 从实例获取属性
DT_INST_PROP(inst, clock_frequency)

// 获取实例的 GPIO 描述符
GPIO_DT_SPEC_INST_GET(inst, enable_gpios)

// 获取实例的 I2C 描述符
I2C_DT_SPEC_INST_GET(inst)

// 获取实例的 SPI 描述符
SPI_DT_SPEC_INST_GET(inst)

// 遍历所有 status="okay" 的实例
DT_INST_FOREACH_STATUS_OKAY(macro)

// 获取实例的 reg 属性 (第一个元素)
DT_INST_REG_ADDR(inst)
```

## 4.4 编写一个自定义 Binding 和驱动

### 4.4.1 场景：自定义 LED 驱动

假设要写一个支持硬件调光的 SPI LED 驱动。

#### Step 1: 创建 Binding YAML

```yaml
# zephyr/dts/bindings/led/mycompany,myled.yaml
description: MyCompany SPI RGB LED Controller

compatible: "mycompany,myled"

include:
  - name: spi-device.yaml      # 继承 SPI 设备的 reg 和 spi-max-frequency

properties:
  num-leds:
    type: int
    default: 1
    description: Number of LEDs in the chain

  color-order:
    type: string
    default: "RGB"
    enum:
      - "RGB"
      - "GRB"
      - "BGR"
    description: Color channel order

  enable-gpios:
    type: phandle-array
    description: Optional enable pin (active high)

  is-matrix:
    type: boolean
    description: Set if the LEDs form a matrix display
```

#### Step 2: 在 DTS 中使用

```dts
// app.overlay
&spi1 {
    myled@0 {
        compatible = "mycompany,myled";
        reg = <0>;
        spi-max-frequency = <4000000>;
        num-leds = <16>;
        color-order = "RGB";
        enable-gpios = <&gpio0 5 GPIO_ACTIVE_HIGH>;
    };
};
```

#### Step 3: 编写驱动

```c
// drivers/led/myled.c
#define DT_DRV_COMPAT mycompany_myled

#include <zephyr/drivers/led.h>
#include <zephyr/drivers/spi.h>
#include <zephyr/drivers/gpio.h>

struct myled_config {
    struct spi_dt_spec spi;
    struct gpio_dt_spec enable;
    uint8_t num_leds;
    uint8_t color_order[3];  // [R_idx, G_idx, B_idx]
    bool is_matrix;
};

struct myled_data {
    uint8_t *buffer;     // DMA-safe SPI buffer
};

static int myled_init(const struct device *dev)
{
    const struct myled_config *cfg = dev->config;

    if (!spi_is_ready_dt(&cfg->spi)) {
        return -ENODEV;
    }

    if (cfg->enable.port) {
        gpio_pin_configure_dt(&cfg->enable, GPIO_OUTPUT_ACTIVE);
    }

    return 0;
}

#define MYLED_INIT(n)                                                       \
    /* 解析 color-order 字符串映射 */                                       \
    COND_CODE_1(                                                            \
        DT_INST_NODE_HAS_PROP(n, enable_gpios),                             \
        (.enable = GPIO_DT_SPEC_INST_GET(n, enable_gpios),),                \
        (.enable = {0},)                                                    \
    )                                                                       \
                                                                            \
    static const struct myled_config myled_config_##n = {                   \
        .spi       = SPI_DT_SPEC_INST_GET(n,                                \
                        SPI_OP_MODE_MASTER | SPI_WORD_SET(8), 0),           \
        MYLED_INIT_ENABLE(n)                                                \
        .num_leds  = DT_INST_PROP(n, num_leds),                             \
        .is_matrix = DT_INST_PROP(n, is_matrix),                            \
    };                                                                      \
    static struct myled_data myled_data_##n;                                \
    DEVICE_DT_INST_DEFINE(n, myled_init, NULL,                              \
        &myled_data_##n, &myled_config_##n,                                 \
        POST_KERNEL, CONFIG_LED_INIT_PRIORITY, NULL);

DT_INST_FOREACH_STATUS_OKAY(MYLED_INIT)
```

## 4.5 Binding 的校验机制

### 4.5.1 编译时校验

构建系统自动运行 dtc 校验。如果有不匹配项，会报错：

```
错误示例 1: 缺少必需属性
  bme280@76 { compatible = "bosch,bme280"; };
  → ERROR: bme280@76: 'reg' is a required property (from bosch,bme280.yaml)

错误示例 2: 类型不匹配
  reg = "0x76";     // 字符串而非整型数组
  → ERROR: bme280@76: reg: expected type 'array', got 'string'

错误示例 3: 未识别的 compatible
  compatible = "unknown,vendor,chip";
  → WARNING: unknown compatible string "unknown,vendor,chip"
```

### 4.5.2 查看构建中的 Binding 警告

```bash
# 构建时开启详细诊断
west build -b nrf52840dk_nrf52840 -- -DEXTRA_DTC_FLAGS="-Werror"

# 查看完整的 DTS 处理输出
west build -b nrf52840dk_nrf52840 -t dts_dtc 2>&1 | grep -i error

# 列出所有在该构建中使用的 binding
find build/zephyr/dts -name "*.yaml"
```

## 4.6 Binding 的高级特性

### 4.6.1 child-binding: 子节点结构

```yaml
# pinctrl 节点的 binding 示例
compatible: "nordic,nrf-pinctrl"

child-binding:
  description: Pin control state configuration
  child-binding:
    description: Pin group configuration
    properties:
      psels:
        type: array
        required: true
      bias-pull-up:
        type: boolean
      bias-pull-down:
        type: boolean
      low-power-enable:
        type: boolean
      drive-mode:
        type: string
        enum: ["standard", "high-drive"]
```

这定义了 `pinctrl → state → group` 的三层结构：
```dts
&pinctrl {
    uart0_default: uart0_default {           // state
        group1 {                              // group
            psels = <NRF_PSEL(UART_TX, 0, 6)>;
        };
    };
};
```

### 4.6.2 specifier-space: phandle 参数格式

```yaml
# GPIO 控制器的 binding
compatible: "nordic,nrf-gpio"

gpio-cells:
  - pin      # cell 0 = 引脚号
  - flags    # cell 1 = 标志 (ACTIVE_LOW, PULL_UP 等)

# 暗示引用此设备的节点需要 2-cell 描述:
#   gpios = <&gpio0 13 GPIO_ACTIVE_LOW>;
#              ^     ^        ^
#           phandle  pin    flags
```

驱动代码中通过 `#gpio-cells` 的值解析参数数量。

### 4.6.3 bus: 声明总线类型

```yaml
# I2C 控制器的 binding
compatible: "nordic,nrf-twim"

bus: i2c
# → 挂在此总线下的设备自动继承 i2c-device.yaml
```

```yaml
# SPI 控制器的 binding
compatible: "nordic,nrf-spim"

bus: spi
# → 挂在此总线下的设备自动继承 spi-device.yaml
```

## 4.7 实战：调试 Binding 问题

### 常见 binding 相关错误

| 错误现象 | 可能原因 | 排查方法 |
|---------|--------|---------|
| `reg not found` | I2C 设备缺 `reg` 属性 | 检查设备树节点是否有 `reg = <0x76>` |
| `unknown compatible` | `compatible` 与 binding 文件名不一致 | 确认 YAML 文件名 = `vendor,model.yaml` |
| `phandle arg length mismatch` | GPIO cells 数量不对 | 检查 `#gpio-cells` 和 gpios 属性参数数 |
| 驱动未初始化 | `status = "disabled"` | 确认 `status = "okay"` |
| 驱动重复初始化 | 同一 compatible 被两个 `DT_DRV_COMPAT` 匹配 | 检查是否引入了冲突的驱动 `.c` 文件 |

### 查看完整的 DT 树结构

```bash
# 以可读形式输出最终设备树
west build -b nrf52840dk_nrf52840 -t dts_dtc
cat build/zephyr/zephyr.dts.pre | less

# 搜索特定节点
grep -A 20 "bme280" build/zephyr/zephyr.dts.pre
```

---

**本章小结**：Binding 是设备树与驱动之间的桥梁。`compatible` 字符串是驱动匹配的关键字。`DT_DRV_COMPAT` + `DT_INST_FOREACH_STATUS_OKAY` 是编写 Zephyr 驱动的标准范式。理解 Binding 才能写出正确的 DTS 节点和驱动程序。
