# Zephyr west 使用说明

## west 常用操作清单（按使用顺序）

先看这份清单，再阅读后面的详细教程。以下命令以 **Windows PowerShell** 为例，按“首次准备 → 编译运行 → 日常维护”的顺序列出，**不是每次都要从头执行一遍**。

> **路径约定：**本清单沿用正文的通用教学环境：虚拟环境为 `F:\zyphyr_tution\.venv`，工作区为 `F:\zyphyr_tution\zephyrproject`，实体板示例为 `nucleo_f401re`。除初始化及切换目录外，west 操作均在工作区根目录执行。
>
> **已有本机 STM32 环境时：**请按 `stm32_zephyr/README.md` 激活现有环境，跳过下面的新建环境和初始化步骤。该环境使用不同的工作区与板卡，并通过脚本绑定工具链，不要照抄这里的全量 `west update`、`west zephyr-export` 或 SDK 安装步骤。

### 一、首次准备（已有可用环境可跳过）

先准备 Git、兼容的 Python、CMake、Ninja 等基础依赖，详见第 3 节。

| 顺序 | 操作 | 命令 | 何时执行 / 注意事项 |
| --- | --- | --- | --- |
| 1 | 进入教程目录并创建虚拟环境 | `Set-Location F:\zyphyr_tution`<br>`python -m venv .venv` | 首次创建；不要覆盖已有环境 |
| 2 | 激活环境并安装 west | `.\.venv\Scripts\Activate.ps1`<br>`python -m pip install west`<br>`west --version` | 安装只需首次执行；新终端需要重新激活 |
| 3 | 初始化指定版本工作区 | `west init --mr v4.2.0 zephyrproject` | 仅新建工作区时执行，不要重复初始化 |
| 4 | 进入工作区并下载依赖仓库 | `Set-Location zephyrproject`<br>`west update` | 首次下载；以后仅在需要同步清单版本时执行 |
| 5 | 安装 Zephyr 的 Python 依赖 | `python -m pip install -r zephyr/scripts/requirements.txt` | 首次准备或依赖发生变化时执行 |
| 6 | 注册 Zephyr 路径 | `west zephyr-export` | 通用安装流程；会写入 CMake 用户包注册表，多套环境并存时按项目约定处理 |
| 7 | 准备工具链 | `west sdk install -h`<br>`west sdk install` | 仅目标版本支持且尚未配置合适 SDK 时执行；已有工具链可跳过，详见第 4.3 节 |

### 二、编译、配置、烧录与调试

每次打开新终端，先激活环境并进入工作区：

```powershell
Set-Location F:\zyphyr_tution
.\.venv\Scripts\Activate.ps1
Set-Location zephyrproject
```

| 顺序 | 操作 | 命令 | 何时执行 / 注意事项 |
| --- | --- | --- | --- |
| 8 | 确认当前工作区 | `west topdir` | 检查是否进入了正确的工作区 |
| 9 | 查看支持的开发板 | `west boards` | 首次选板时执行；以下板名需替换为自己的实际目标 |
| 10 | 首次编译应用 | `west build -b nucleo_f401re zephyr/samples/hello_world -d build/nucleo_f401re` | 显式指定开发板、应用路径和构建目录 |
| 11 | 调整 Kconfig 配置（可选） | `west build -d build/nucleo_f401re -t menuconfig` | 需要改配置时执行；长期配置应整理进 `prj.conf`，之后重新编译 |
| 12 | 修改代码后增量编译 | `west build -d build/nucleo_f401re` | 日常最常用；复用已有构建目录 |
| 13 | 烧录到开发板 | `west flash -d build/nucleo_f401re` | 编译成功、硬件连接和烧录工具就绪后执行 |
| 14 | 启动调试（可选） | `west debug -d build/nucleo_f401re` | 需要断点、单步等调试功能时执行；需板卡支持及相应调试工具 |

**没有实体板时，可改走 QEMU 路线**（与上面的实体板流程二选一，需先安装匹配的 QEMU）：

```powershell
west build -b qemu_cortex_m3 zephyr/samples/hello_world -d build/hello_world
west build -d build/hello_world -t run
```

### 三、日常维护与排查（按需执行）

| 顺序 | 操作 | 命令 | 何时执行 / 注意事项 |
| --- | --- | --- | --- |
| 15 | 查看仓库列表与本地修改 | `west list`<br>`west status`<br>`west diff` | 同步依赖前先检查并保存需要保留的修改 |
| 16 | 按清单同步依赖 | `west update` | 清单版本变化或依赖缺失时执行，不是每次编译的前置步骤，也不是对全部仓库执行 `git pull` |
| 17 | 清理缓存并重新编译 | `west build -p always -b nucleo_f401re zephyr/samples/hello_world -d build/nucleo_f401re` | 切换目标或缓存不兼容时按需使用；会删除构建目录中的生成内容，日常优先增量编译 |
| 18 | 查看命令帮助 | `west -h`<br>`west build -h`<br>`west flash -h` | 不确定参数或遇到版本差异时查看 |

**日常最短流程：激活环境 → 进入工作区 → 修改代码 → `west build -d build/nucleo_f401re` → `west flash -d build/nucleo_f401re`。** 首次构建需先执行第 10 步；使用模拟器时，将烧录换为对应构建目录的 `-t run`。

---

> 本文介绍 **Zephyr RTOS 的 west 工具**，适合初次接触 Zephyr 的开发者，也可作为日常命令速查。
>
> 命令以 **Windows PowerShell** 为主。示例固定使用 Zephyr `v4.2.0`，仅用于展示可复现的操作流程，不代表最新版本。使用其他版本时，应同时查阅该版本的安装说明、开发板文档和工具链要求。

## 1. west 是什么

west 是 Zephyr 项目使用的命令行工具，主要负责两类工作：

| 类型 | 作用 | 常见命令 |
| --- | --- | --- |
| 内置命令 | 管理由多个 Git 仓库组成的工作区 | `init`、`update`、`list`、`status`、`diff`、`forall`、`manifest`、`config` |
| Zephyr 扩展命令 | 调用 Zephyr 的构建、烧录、调试工具 | `build`、`flash`、`debug`、`debugserver`、`attach`、`boards` |

可以把 west 理解为“多仓库管理工具 + Zephyr 开发命令入口”。

它不替代底层工具：

- Git 仍负责提交、分支、合并和推送。
- CMake 和 Ninja 等工具负责生成与执行构建任务。
- 编译器、链接器由 Zephyr SDK 或其他受支持的工具链提供。
- OpenOCD、J-Link 等工具负责实际烧录和调试，具体取决于开发板。

**安装 west，不等于安装好了完整的 Zephyr 开发环境。**

## 2. 先理解三个概念

### 2.1 工作区（workspace）

west 工作区是一组 Git 仓库及其管理信息的集合。一个典型布局如下：

```text
zephyrproject/
├── .west/
│   └── config          # 当前工作区的 west 配置
├── zephyr/             # Zephyr 源码；默认也是清单仓库
│   ├── west.yml
│   ├── samples/
│   └── scripts/
├── modules/            # 由清单描述的模块仓库
├── bootloader/         # 例如 MCUboot，是否存在取决于清单
└── tools/              # 是否存在取决于清单
```

`.west` 所在的目录就是工作区根目录。进入工作区内任意子目录后，可以运行：

```powershell
west topdir
```

注意：**工作区通常不是一个单独的 Git 仓库**。例如，`zephyr/` 和 `modules/` 下的各个项目可以分别拥有自己的 `.git`。

### 2.2 清单仓库（manifest repository）

清单仓库保存 `west.yml`，决定工作区需要哪些项目。

默认使用官方 Zephyr 仓库作为清单仓库；自己的应用仓库也可以承担这一角色。

### 2.3 清单文件（manifest）

`west.yml` 通常描述：

- 项目名称和 Git URL。
- 项目在工作区中的目录。
- 项目需要检出的分支、标签或提交。
- 是否导入其他清单。
- 当前清单仓库自身的相关信息。

`west update` 会依据这些描述获取和检出项目，而不是简单地对所有仓库执行 `git pull`。

## 3. 安装前准备

### 3.1 基础依赖

在 Windows 上，通常需要：

1. Git。
2. 与目标 Zephyr 版本兼容的 Python。
3. CMake 和 Ninja 等构建工具。
4. Zephyr SDK 或受支持的其他工具链。
5. 如果连接硬件，还需要调试探针驱动和对应烧录工具。

Python、CMake、SDK 的最低版本随 Zephyr 版本变化，请以对应版本的官方 Getting Started Guide 为准，不要直接混用不同版本教程。

建议将源码放在较短、无空格、无中文的路径下，例如 `F:\zyphyr_tution`，以减少路径相关问题。

### 3.2 创建 Python 虚拟环境并安装 west

以下命令在 PowerShell 中执行：

```powershell
Set-Location F:\zyphyr_tution

python -m venv .venv
.\.venv\Scripts\Activate.ps1

python -m pip install --upgrade pip
python -m pip install west

west --version
```

后续每次打开新终端，都需要先激活这个虚拟环境：

```powershell
Set-Location F:\zyphyr_tution
.\.venv\Scripts\Activate.ps1
```

如果 PowerShell 的执行策略禁止运行激活脚本，可改用 CMD 并执行 `.venv\Scripts\activate.bat`，或者按所在组织的策略处理。不要为了激活环境而直接放宽整台机器的安全设置。

> 本文中的虚拟环境放在 west 工作区外。虚拟环境负责 Python 包隔离，west 工作区负责源码管理，两者不是同一个概念。

## 4. 初始化并准备 Zephyr 工作区

### 4.1 获取指定版本的 Zephyr

在已激活虚拟环境的 PowerShell 中执行：

```powershell
Set-Location F:\zyphyr_tution

west init --mr v4.2.0 zephyrproject
Set-Location zephyrproject

west update
```

说明：

- `west init` 创建 `.west` 并获取清单仓库。
- `--mr v4.2.0` 指定清单仓库使用的 revision，此处为 Zephyr 发布标签。
- `zephyrproject` 是将要创建的工作区目录。
- `west update` 再获取清单描述的模块仓库。

初始化需要下载较多内容。若下载中断，通常可以排查网络后再次运行 `west update`，不必立即删除整个工作区。

如需显式指定清单仓库 URL，等价写法为：

```powershell
west init -m https://github.com/zephyrproject-rtos/zephyr --mr v4.2.0 zephyrproject
```

上面两种初始化方式二选一，不要在同一路径重复执行。

### 4.2 安装 Zephyr 的 Python 依赖

对于本文的 `v4.2.0` 示例，在工作区根目录执行：

```powershell
python -m pip install -r zephyr/scripts/requirements.txt
```

一些较新版本提供 `west packages`，可列出或安装清单中各模块的 Python 依赖。若目标版本支持，可以先查阅：

```powershell
west packages -h
```

支持直接安装选项的版本，在已激活虚拟环境时可使用：

```powershell
west packages pip --install
```

**选择与目标版本文档相符的依赖安装方式，不要把所有年代的安装命令机械叠加。**

### 4.3 注册 Zephyr 并安装工具链

```powershell
west zephyr-export
```

`west zephyr-export` 将当前 Zephyr 安装位置注册到 CMake 用户包注册表，方便应用查找 Zephyr；它既不是编译操作，也不是安装编译器。

支持 SDK 管理命令的版本可以使用：

```powershell
west sdk install
```

该命令可能下载较大的 SDK。使用前可先查看选项：

```powershell
west sdk install -h
```

如果目标版本没有该命令，或需要离线安装，应按照对应版本文档手动安装受支持的 Zephyr SDK。仅安装 Python 依赖无法解决“找不到编译器”的问题。

## 5. 第一次编译

### 5.1 编译 Hello World

在工作区根目录执行：

```powershell
west build -b qemu_cortex_m3 zephyr/samples/hello_world -d build/hello_world
```

参数含义：

| 参数 | 含义 |
| --- | --- |
| `-b qemu_cortex_m3` | 指定目标板，此处为 QEMU 模拟目标 |
| `zephyr/samples/hello_world` | 应用源码路径 |
| `-d build/hello_world` | 指定构建目录 |

实际构建工具运行成功后，可以通过目标 `run` 启动模拟程序：

```powershell
west build -d build/hello_world -t run
```

预期应用输出包含：

```text
Hello World! qemu_cortex_m3
```

> QEMU 示例需要主机上存在匹配的 QEMU 可执行程序。Windows 上的可用性取决于 SDK、QEMU 安装和 PATH；不能把“编译成功”理解为“本机一定能运行模拟器”。若运行环境未就绪，可先完成编译，或按照板卡文档改用实际硬件。Linux/WSL 的模拟流程也应按其对应安装指南准备。

### 5.2 编译真实开发板

以 Nucleo F401RE 为例：

```powershell
west build -b nucleo_f401re zephyr/samples/hello_world -d build/nucleo_f401re
```

列出当前源码支持的开发板：

```powershell
west boards
```

较新的板卡可能要求完整的 `board/soc/variant` 限定名称。应以当前版本的 `west boards` 输出及板卡文档为准，不要直接照搬其他版本的板名。

## 6. 日常构建操作

### 6.1 增量编译

修改源码后，复用原有构建目录：

```powershell
west build -d build/hello_world
```

不要每次都清空构建目录，否则会失去增量编译的速度优势。

### 6.2 干净构建（pristine build）

切换开发板、切换应用或遇到 CMake 缓存不兼容时，使用：

```powershell
west build -p always -b qemu_cortex_m3 zephyr/samples/hello_world -d build/hello_world
```

常见策略：

| 策略 | 含义 |
| --- | --- |
| `-p always` | 构建前清理构建目录中的生成内容，重新配置 |
| `-p auto` | west 检测到某些不兼容情况时自动执行 pristine |
| `-p never` | 不自动执行 pristine |

例如：

```powershell
west build -p auto -b qemu_cortex_m3 zephyr/samples/hello_world -d build/hello_world
```

`auto` 并不保证识别所有缓存问题。明确切换板卡或应用时，优先使用独立构建目录；确有必要时再使用 `always`。

**注意：pristine 会删除构建目录中的生成内容，不要将手写源码或需要保留的文件放进该目录。**

### 6.3 向 CMake 传递参数

west 参数写在 `--` 前，CMake 参数写在 `--` 后：

```powershell
west build -b nucleo_f401re zephyr/samples/hello_world -d build/nucleo_debug -- -DCMAKE_BUILD_TYPE=Debug
```

如果应用目录中有 `debug.conf`，可以额外叠加配置：

```powershell
west build -b nucleo_f401re path/to/app -d build/app -- -DEXTRA_CONF_FILE=debug.conf
```

如果应用目录中有 `custom.overlay`，可以显式指定设备树 overlay：

```powershell
west build -b nucleo_f401re path/to/app -d build/app -- -DDTC_OVERLAY_FILE=custom.overlay
```

以上应用路径和文件名均为占位示例，需要替换为真实存在的内容。多个配置文件的列表参数及带空格的路径，应按所用 shell 的规则加引号。

### 6.4 打开配置界面

```powershell
west build -d build/nucleo_f401re -t menuconfig
```

`menuconfig` 用于交互式调整 Kconfig 配置，能否正常显示取决于终端及 Python 依赖。

注意：构建目录中的 `.config` 是生成配置，不应当作为唯一的配置来源。希望配置长期保留时，应将适当的选项整理进应用的 `prj.conf` 或相应配置片段。

### 6.5 构建产物在哪里

非 sysbuild 的常见输出位置：

```text
build/nucleo_f401re/zephyr/zephyr.elf
build/nucleo_f401re/zephyr/zephyr.hex
build/nucleo_f401re/zephyr/zephyr.bin
build/nucleo_f401re/zephyr/.config
build/nucleo_f401re/zephyr/zephyr.dts
```

其中 `.hex`、`.bin` 是否生成取决于板卡和配置，并不是每次都会同时存在。`.config` 和 `zephyr.dts` 可用于检查最终生效的 Kconfig 和设备树配置。

## 7. 烧录与调试

### 7.1 烧录程序

连接目标板并准备好驱动、探针和烧录工具后：

```powershell
west flash -d build/nucleo_f401re
```

west 会根据构建结果选择默认 runner。runner 是对具体烧录或调试工具的适配层。

查看该构建的 runner 信息及参数：

```powershell
west flash -d build/nucleo_f401re --context
```

只有当前板卡支持且相关工具已安装时，才能指定对应 runner。例如使用 OpenOCD：

```powershell
west flash -d build/nucleo_f401re -r openocd
```

不要假定每块板都能使用 `openocd`、`jlink` 或其他任意 runner。

### 7.2 启动调试

```powershell
west debug -d build/nucleo_f401re
```

其他常见命令：

```powershell
# 启动调试服务端，供 IDE 或另一个 GDB 会话连接
west debugserver -d build/nucleo_f401re

# 按 runner 的实现连接现有目标，通常不重新烧录
west attach -d build/nucleo_f401re
```

`debug`、`debugserver`、`attach` 的支持情况和复位行为取决于 runner。使用前查看板卡文档和命令帮助；不要把 attach 理解为对所有目标都完全无干扰。

## 8. 管理多个 Git 仓库

### 8.1 查看项目清单和本地修改

```powershell
west list
west status
west diff
```

- `west list`：列出清单描述的项目及相关信息；不等同于证明所有项目都已下载。
- `west status`：查看本地仓库的 Git 状态。
- `west diff`：查看工作区仓库的差异。

操作单个仓库时，仍然可以直接使用 Git：

```powershell
git -C zephyr status
git -C zephyr log -5 --oneline
```

### 8.2 同步清单中的项目

```powershell
west update
```

也可以指定清单中的项目名，例如清单包含 `mbedtls` 时：

```powershell
west update mbedtls
```

**这里有一个重要区别：**在官方默认布局中，`zephyr` 是清单仓库，不是清单里一个名为 `zephyr` 的普通项目，因此不能依靠 `west update zephyr` 更新它。只有当自己的清单将 Zephyr 声明为名为 `zephyr` 的项目时，才能用该命令管理它。

`west update` 通常将受管理项目检出到清单对应提交，可能出现 detached HEAD。这是正常的版本锁定行为，不代表仓库损坏。

如果需要修改某个模块，应先在该模块中创建自己的开发分支并提交改动。切换清单版本或执行更新前，应先检查本地修改；不要将“更新”当成会自动保存或合并本地开发工作的操作。

### 8.3 更新 Zephyr 本身的版本

在官方默认布局中，`west update` **不会替你更新清单仓库自身**。例如切换 Zephyr 版本，应先使用 Git 切换 `zephyr/`，再同步依赖：

```powershell
# 先确认本地工作已妥善保存
git -C zephyr status

# 获取标签并切换到目标版本；此处仍以 v4.2.0 为例
git -C zephyr fetch --tags origin
git -C zephyr switch --detach v4.2.0

# 然后按新清单同步模块
west update

# 按新版本要求刷新 Python 依赖
python -m pip install -r zephyr/scripts/requirements.txt
west zephyr-export
```

若要迁移到其他版本，将标签换成目标标签，并同时检查 SDK、Python、构建工具及配置兼容性。旧构建目录也不宜直接跨版本复用。

如果清单仓库是自己的应用仓库，则应更新那个仓库，而不是机械地更新 `zephyr/`。

### 8.4 在多个仓库执行只读命令

```powershell
west forall -c "git status --short"
```

`west forall` 可批量执行命令，但作用范围受项目选择和本地克隆状态等因素影响。涉及修改或删除的命令应先明确范围；不建议把 `git reset --hard`、`git clean -fdx` 等破坏性操作作为日常同步手段。

## 9. 自己的应用如何使用 west.yml

对于长期维护的产品，常见做法是：**将应用仓库作为清单仓库，并在清单中固定 Zephyr 版本。**

例如：

```text
my-workspace/
├── .west/
├── app/                  # 自己的 Git 仓库，也是清单仓库
│   ├── west.yml
│   ├── CMakeLists.txt
│   ├── prj.conf
│   └── src/
│       └── main.c
├── zephyr/
└── modules/
```

`app/west.yml` 示例：

```yaml
manifest:
  version: "0.13"

  remotes:
    - name: zephyrproject-rtos
      url-base: https://github.com/zephyrproject-rtos

  projects:
    - name: zephyr
      remote: zephyrproject-rtos
      revision: v4.2.0
      path: zephyr
      import: true

  self:
    path: app
```

说明：

- `manifest.version` 表示所需的清单格式支持版本，**不是 Zephyr 的版本号**。
- `revision` 指定 Zephyr 项目的版本。严谨的交付通常使用完整提交 SHA。
- `import: true` 导入 Zephyr 自己的清单，从而获取其模块依赖。
- 项目的 `path` 相对于工作区根目录，而不是 `west.yml` 所在目录。
- `self.path` 描述清单仓库的预期路径；对本地初始化而言，实际已有仓库的位置同样重要。

### 9.1 从已有本地应用仓库初始化

假设 `my-workspace/app` 已经是包含上述 `west.yml` 的 Git 仓库，且父目录尚未被初始化为 west 工作区：

```powershell
Set-Location path/to/my-workspace
west init -l app
west update
west zephyr-export
```

`-l` 表示使用已有的本地清单仓库，不是再从网络克隆。此布局的工作区根目录是 `my-workspace`。

安装匹配的依赖和工具链后，编译应用：

```powershell
west build -b nucleo_f401re app -d build/app
```

以上只是清单示例，`CMakeLists.txt`、`prj.conf` 和 `src/main.c` 仍需由应用实际提供；单独创建一个 `west.yml` 并不能产生可编译的应用。

### 9.2 从远程应用仓库初始化

如果应用仓库已发布，并在仓库根目录保存 `west.yml`：

```powershell
west init -m https://example.com/team/app.git --mr main my-workspace
Set-Location my-workspace
west update
```

这里的 URL 和分支名是占位示例，需替换为自己的仓库与 revision。交付或 CI 场景应避免不受控地跟随移动的 `main` 分支。

## 10. 清单检查与版本复现

验证清单格式：

```powershell
west manifest --validate
```

展开导入的清单：

```powershell
west manifest --resolve -o resolved-west.yml
```

将项目 revision 固定为本地提交 SHA：

```powershell
west manifest --freeze -o frozen-west.yml
```

冻结前应先完成所需项目的同步，并确认工作区状态。

**冻结清单不是完整备份，也不等于完整复现环境：**

- 不会保存未提交的修改或未跟踪文件。
- 不会把清单仓库自身的当前提交当作普通依赖项目自动锁定。
- 不会自动锁定 Python、SDK、CMake 和主机环境。
- 不会保证远程服务器将来仍然保留这些提交。
- 仅生成文件不会自动切换当前工作区所使用的清单。

建议在交付记录中同时保存：应用/清单仓库提交 SHA、冻结清单、Zephyr SDK 版本、Python 依赖约束、构建命令和必要的环境说明。CI 要复用冻结清单，还需明确将其作为实际清单输入。

## 11. west 配置

查看当前生效的配置：

```powershell
west config -l
```

查看清单仓库路径：

```powershell
west config manifest.path
```

为当前工作区设置默认开发板和 pristine 策略：

```powershell
west config --local build.board nucleo_f401re
west config --local build.pristine auto
```

此后，在适合该默认板卡的场景，可以省略 `-b`：

```powershell
west build zephyr/samples/hello_world -d build/default_board
```

west 配置存在系统、用户全局和工作区本地等作用域。项目相关配置建议显式使用 `--local`，避免无意影响其他工作区。

默认板卡不会可靠地“改造”已有构建目录的缓存；需要换板时仍应使用独立目录或 pristine 构建。

## 12. 多镜像构建：sysbuild

普通应用通常直接使用 `west build`。应用涉及 MCUboot、多个固件镜像或多核系统时，可能需要 sysbuild：

```powershell
west build --sysbuild -b <board> <application> -d build/sysbuild
west flash -d build/sysbuild
```

`<board>` 和 `<application>` 是说明性占位符，执行前必须替换，不能原样粘贴到 PowerShell。

`--sysbuild` 只是进入多镜像构建流程，**不会自动替任意应用完成 MCUboot、签名、多核通信等配置**。具体要求、构建目录布局及烧录行为需要参考对应应用和板卡文档。

## 13. 常见问题排查

### 13.1 找不到 `west` 命令

检查：

1. 是否安装到了另一个 Python 环境。
2. 当前终端是否已激活安装 west 的虚拟环境。
3. 虚拟环境的 `Scripts` 目录是否正确进入 PATH。

可以查看：

```powershell
python -m pip show west
Get-Command python
Get-Command west
```

### 13.2 `west build` 不是有效命令

`build` 是 Zephyr 扩展命令，不是 west 的纯内置命令。检查：

- 当前目录是否处于正确的 west 工作区。
- 是否完成 `west update`，Zephyr 源码和扩展命令文件是否存在。
- 清单是否正确声明或导入 Zephyr。
- 是否有错误的环境变量或配置指向另一份 Zephyr 源码。

```powershell
west topdir
west list
west -h
```

仅重新安装 west，不一定能修复工作区或扩展命令发现问题。

### 13.3 `west update` 下载失败

检查 Git 访问、DNS、代理、证书以及清单中的 URL 和 revision。先保留错误输出，再尝试重新执行 `west update`。

如果自己修改过模块，先查看状态并提交或另行保存；不要为了网络错误直接删除整个源码目录。

### 13.4 切换开发板后出现缓存冲突

优先为不同板卡使用不同构建目录。必要时执行：

```powershell
west build -p always -b nucleo_f401re zephyr/samples/hello_world -d build/nucleo_f401re
```

确认该目录只存放可重新生成的构建内容。

### 13.5 找不到 Zephyr SDK 或编译器

检查 SDK 是否真正安装、版本是否兼容、环境变量是否指向正确位置。安装 west 或执行 `west zephyr-export` 都不会自动等同于工具链已就绪。

### 13.6 找不到板卡

```powershell
west boards
```

对照当前版本的板卡文档，确认板名、SoC 和限定名称。某些教程基于旧硬件命名方式，不能原样套用。

### 13.7 烧录失败

依次检查：

1. USB 线是否支持数据传输，板卡是否正常供电。
2. 调试探针驱动是否安装。
3. runner 对应的外部工具是否安装并可被找到。
4. 当前构建目录是否确实对应连接的板卡。
5. 探针是否被 IDE 或其他调试程序占用。
6. 多探针环境是否需要选择设备；选择参数应查看对应 runner 帮助。

```powershell
west flash -d build/nucleo_f401re --context
west -v flash -d build/nucleo_f401re
```

`-v` 是 west 的全局详细日志选项，放在子命令之前。

## 14. 常用命令速查

| 目的 | 命令 |
| --- | --- |
| 查看版本 | `west --version` |
| 查看帮助 | `west -h` |
| 查看构建帮助 | `west build -h` |
| 查看工作区根目录 | `west topdir` |
| 初始化工作区 | `west init --mr v4.2.0 zephyrproject` |
| 同步清单项目 | `west update` |
| 查看项目列表 | `west list` |
| 查看仓库修改 | `west status` |
| 查看差异 | `west diff` |
| 验证清单 | `west manifest --validate` |
| 导出冻结清单 | `west manifest --freeze -o frozen-west.yml` |
| 查看配置 | `west config -l` |
| 注册 Zephyr CMake 包 | `west zephyr-export` |
| 查看板卡 | `west boards` |
| 首次编译 | `west build -b nucleo_f401re zephyr/samples/hello_world -d build/nucleo_f401re` |
| 增量编译 | `west build -d build/nucleo_f401re` |
| 干净编译 | `west build -p always -b nucleo_f401re zephyr/samples/hello_world -d build/nucleo_f401re` |
| 打开配置界面 | `west build -d build/nucleo_f401re -t menuconfig` |
| 烧录 | `west flash -d build/nucleo_f401re` |
| 查看烧录 runner | `west flash -d build/nucleo_f401re --context` |
| 调试 | `west debug -d build/nucleo_f401re` |
| 启动调试服务 | `west debugserver -d build/nucleo_f401re` |

## 15. 推荐的日常工作流程

1. 激活 Python 虚拟环境，进入正确的 west 工作区。
2. 使用 `west status` 或 Git 确认本地修改状态。
3. 仅在清单或所需版本变化时执行 `west update`，不必每次编译都更新。
4. 为不同板卡、应用和重要配置使用独立构建目录。
5. 开发时增量编译；切换环境或处理缓存冲突时再进行 pristine 构建。
6. 用对应构建目录执行 `west flash` 或 `west debug`。
7. 提交应用和模块中的必要修改，避免依赖未提交内容。
8. 交付时记录清单仓库提交、依赖版本和工具链环境。

**记忆口诀：`init` 建工作区，`update` 同步依赖，`build` 编译，`flash` 烧录，`debug` 调试；版本提交和分支管理仍然用 Git。**

## 16. 官方参考资料

下面 `latest` 链接会随 Zephyr 开发演进。使用本文示例或维护既有项目时，请通过文档版本选择器切换到目标版本。

- [Zephyr Getting Started Guide](https://docs.zephyrproject.org/latest/develop/getting_started/)
- [West basics](https://docs.zephyrproject.org/latest/develop/west/basics.html)
- [Installing west](https://docs.zephyrproject.org/latest/develop/west/install.html)
- [West built-in commands](https://docs.zephyrproject.org/latest/develop/west/built-in.html)
- [Building, Flashing and Debugging](https://docs.zephyrproject.org/latest/develop/west/build-flash-debug.html)
- [West manifests](https://docs.zephyrproject.org/latest/develop/west/manifest.html)
- [West configuration](https://docs.zephyrproject.org/latest/develop/west/config.html)
- [Additional Zephyr extension commands](https://docs.zephyrproject.org/latest/develop/west/zephyr-cmds.html)

> 说明：本文是操作说明，并未在当前机器上实际下载 Zephyr、安装 SDK、编译或连接硬件验证。网络查询用于核对官方文档入口和主要命令；具体平台与版本差异仍以所用版本的官方文档及本地 `west <command> -h` 输出为准。
