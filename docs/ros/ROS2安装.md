# ROS 2 Humble 安装教程，适配 Ubuntu 22.04

#### 1. 确认系统版本

ROS 2 Humble 主要面向的 Ubuntu 版本是：

- **Ubuntu 22.04 Jammy Jellyfish**
- 支持架构包括：
  - `amd64`
  - `arm64`

> 注意：ROS 2 Humble 是 LTS 长期支持版本，适合学习、开发和实际项目使用。  
> 不建议在 Ubuntu 22.04 上安装 Rolling，Rolling 更适合 ROS 2 开发者和测试环境。

可以使用以下命令查看 Ubuntu 版本：

```bash
lsb_release -a
```

如果输出中包含：

```bash
Ubuntu 22.04
Codename: jammy
```

说明系统版本正确。

---

#### 2. 设置系统 Locale

确保系统支持 `UTF-8`，尤其是在 Docker 或最小化 Ubuntu 环境中。

```bash
locale
sudo apt update && sudo apt install locales
sudo locale-gen en_US en_US.UTF-8
sudo update-locale LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8
export LANG=en_US.UTF-8
locale
```

作用：

- 检查当前语言环境
- 安装 locale 工具
- 生成 `en_US.UTF-8`
- 设置系统默认语言环境为 UTF-8

---

#### 3. 启用 Ubuntu Universe 仓库

ROS 2 依赖一些来自 Ubuntu Universe 仓库的软件包，因此需要先启用它。

```bash
sudo apt install software-properties-common
sudo add-apt-repository universe
```

---

#### 4. 添加 ROS 2 软件源

首先安装必要工具：

```bash
sudo apt update
sudo apt install curl gnupg lsb-release
```

添加 ROS 2 GPG 密钥：

```bash
sudo curl -sSL https://raw.githubusercontent.com/ros/rosdistro/master/ros.key \
-o /usr/share/keyrings/ros-archive-keyring.gpg
```

添加 ROS 2 apt 软件源：

```bash
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/ros-archive-keyring.gpg] http://packages.ros.org/ros2/ubuntu $(. /etc/os-release && echo $UBUNTU_CODENAME) main" \
| sudo tee /etc/apt/sources.list.d/ros2.list > /dev/null
```

对于 Ubuntu 22.04，这里的系统代号应为：

```bash
jammy
```

添加完成后更新软件源：

```bash
sudo apt update
```

---

#### 5. 可选：安装开发工具

如果你需要编译 ROS 2 包、创建工作空间或进行 ROS 2 开发，建议安装开发工具：

```bash
sudo apt install ros-dev-tools
```

也可以安装常用编译工具：

```bash
sudo apt install build-essential cmake git python3-colcon-common-extensions python3-rosdep python3-vcstool
```

---

#### 6. 初始化 rosdep

`rosdep` 用于自动安装 ROS 包依赖，建议配置。

```bash
sudo rosdep init
rosdep update
```

如果执行：

```bash
sudo rosdep init
```

提示已经初始化过，可以忽略该错误，直接执行：

```bash
rosdep update
```

---

#### 7. 更新系统软件包

安装 ROS 2 前，先更新 apt 缓存并升级系统。

```bash
sudo apt update
sudo apt upgrade
```

这样可以避免因为系统包版本过旧导致 ROS 2 依赖安装失败。

---

#### 8. 安装 ROS 2 Humble

Ubuntu 22.04 推荐安装 **ROS 2 Humble**。

网页提供了两种常用安装方式。

---

##### 方式一：桌面完整版，推荐

包含：

- ROS 2 基础功能
- RViz
- 示例程序
- 教程相关包
- 图形化工具

安装命令：

```bash
sudo apt install ros-humble-desktop
```

适合：

- 初学者
- 桌面开发环境
- 需要 RViz 和示例程序的用户

---

##### 方式二：ROS-Base 精简版

只包含：

- 通信库
- 消息包
- 命令行工具

不包含 GUI 工具。

安装命令：

```bash
sudo apt install ros-humble-ros-base
```

适合：

- 服务器
- Docker
- 嵌入式环境
- 不需要图形界面的场景

---

#### 9. 可选：安装其他 RMW 实现

ROS 2 Humble 默认使用的中间件通常是：

- **Fast DDS**

如果项目需要，也可以安装其他 RMW 实现，例如 Cyclone DDS。

例如安装 Cyclone DDS：

```bash
sudo apt install ros-humble-rmw-cyclonedds-cpp
```

如果想临时切换到 Cyclone DDS：

```bash
export RMW_IMPLEMENTATION=rmw_cyclonedds_cpp
```

如果想每次终端自动生效：

```bash
echo "export RMW_IMPLEMENTATION=rmw_cyclonedds_cpp" >> ~/.bashrc
source ~/.bashrc
```

---

#### 10. 配置 ROS 2 环境变量

安装完成后，需要 source ROS 2 的环境配置文件：

```bash
source /opt/ros/humble/setup.bash
```

如果你不是使用 bash，需要替换为对应 shell。

例如 sh：

```bash
source /opt/ros/humble/setup.sh
```

例如 zsh：

```bash
source /opt/ros/humble/setup.zsh
```

如果想每次打开终端自动生效，可以添加到 `~/.bashrc`：

```bash
echo "source /opt/ros/humble/setup.bash" >> ~/.bashrc
source ~/.bashrc
```

检查 ROS 2 是否可用：

```bash
ros2 --version
```

---

#### 11. 测试 ROS 2 是否安装成功

如果安装的是 `ros-humble-desktop`，可以使用官方 demo 测试。

##### 终端 1：运行 C++ talker

```bash
source /opt/ros/humble/setup.bash
ros2 run demo_nodes_cpp talker
```

##### 终端 2：运行 Python listener

```bash
source /opt/ros/humble/setup.bash
ros2 run demo_nodes_py listener
```

如果安装成功：

- talker 会持续发布消息
- listener 会接收到这些消息

这说明：

- ROS 2 命令可用
- C++ API 正常
- Python API 正常
- 节点通信正常

---

# Ubuntu 22.04 安装 ROS 2 Humble 简要流程

```bash
# 1. 设置 Locale
sudo apt update && sudo apt install locales
sudo locale-gen en_US en_US.UTF-8
sudo update-locale LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8
export LANG=en_US.UTF-8

# 2. 启用 Universe 仓库
sudo apt install software-properties-common
sudo add-apt-repository universe

# 3. 安装必要工具
sudo apt update
sudo apt install curl gnupg lsb-release

# 4. 添加 ROS 2 GPG 密钥
sudo curl -sSL https://raw.githubusercontent.com/ros/rosdistro/master/ros.key \
-o /usr/share/keyrings/ros-archive-keyring.gpg

# 5. 添加 ROS 2 软件源
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/ros-archive-keyring.gpg] http://packages.ros.org/ros2/ubuntu $(. /etc/os-release && echo $UBUNTU_CODENAME) main" \
| sudo tee /etc/apt/sources.list.d/ros2.list > /dev/null

# 6. 更新软件源
sudo apt update

# 7. 可选：安装开发工具
sudo apt install ros-dev-tools

# 8. 可选：初始化 rosdep
sudo rosdep init
rosdep update

# 9. 更新系统
sudo apt update
sudo apt upgrade

# 10. 安装 ROS 2 Humble 桌面版
sudo apt install ros-humble-desktop

# 或者安装 ROS 2 Humble 精简版
sudo apt install ros-humble-ros-base

# 11. 配置环境变量
source /opt/ros/humble/setup.bash

# 12. 添加到 bashrc，打开终端自动生效
echo "source /opt/ros/humble/setup.bash" >> ~/.bashrc
source ~/.bashrc

# 13. 测试 ROS 2
ros2 run demo_nodes_cpp talker
```

