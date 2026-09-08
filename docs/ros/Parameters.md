# Parameters

## 1. 文档目标

本文档用于教学和入门学习，帮助你理解 **ROS 2 参数 Parameters** 的基本概念、常用命令、YAML 配置方式，以及在 **C++ / Python / Launch** 中的使用方法。

学习完本文档后，你应该能够：

- 理解 ROS 2 参数的作用
- 查看、获取、修改节点参数
- 使用命令行给节点传参
- 使用 YAML 文件管理参数
- 在 C++ 和 Python 节点中声明、读取和修改参数
- 在 Launch 文件中加载参数
- 理解参数动态修改机制

---

# 2. 什么是 ROS 2 参数？

在 ROS 2 中，**参数**是一种给节点配置数据的机制。

简单来说，参数就是节点运行时使用的配置项。

例如，一个机器人导航节点可能需要这些参数：

```yaml
robot_name: "robot_01"
max_speed: 1.0
use_sim_time: true
map_frame: "map"
odom_frame: "odom"
```

这些参数可以用来控制节点行为，例如：

- 机器人名字是什么
- 最大速度是多少
- 是否使用仿真时间
- 使用哪个坐标系
- 传感器发布频率是多少
- 是否开启调试模式

---

# 3. ROS 2 参数的特点

ROS 2 参数有几个重要特点：

## 3.1 参数属于节点

ROS 2 中的参数不是全局变量，而是属于某个节点。

例如：

```text
/talker
/listener
/camera_node
/nav2_controller
```

每个节点都可以有自己的参数。

---

## 3.2 参数通常需要先声明

在 ROS 2 中，节点通常需要先声明参数，才能读取或使用参数。

例如 C++ 中：

```cpp
this->declare_parameter("robot_name", "robot_01");
```

Python 中：

```python
self.declare_parameter("robot_name", "robot_01")
```

如果没有声明就直接获取，可能会报错。

---

## 3.3 参数可以从外部配置

参数可以通过多种方式设置：

- 命令行
- YAML 文件
- Launch 文件
- 程序内部
- 动态修改

---

## 3.4 参数可以运行时修改

部分参数可以在节点运行过程中修改，例如：

```bash
ros2 param set /talker frequency 20
```

但是否修改后立即生效，取决于节点代码是否支持动态参数更新。

---

# 4. 参数常见类型

ROS 2 参数支持以下常见类型：

| 参数类型    | 示例              | 说明       |
| ----------- | ----------------- | ---------- |
| bool        | `true`            | 布尔值     |
| integer     | `10`              | 整数       |
| double      | `3.14`            | 浮点数     |
| string      | `"robot_01"`      | 字符串     |
| list        | `[1, 2, 3]`       | 数组       |
| string list | `["map", "odom"]` | 字符串数组 |

示例：

```yaml
robot_name: "robot_01"
use_sim_time: false
max_speed: 1.5
publish_rate: 10
frames: ["map", "odom", "base_link"]
```

---

# 5. ROS 2 参数命令行操作

ROS 2 提供了 `ros2 param` 命令来操作参数。

---

## 5.1 查看所有参数命令

```bash
ros2 param
```

输出类似：

```text
usage: ros2 param [-h] Call `ros2 param <command> -h` for more detailed usage.
```

常用子命令包括：

```bash
ros2 param list
ros2 param get
ros2 param set
ros2 param dump
ros2 param load
ros2 param describe
```

---

## 5.2 查看当前运行的节点

```bash
ros2 node list
```

示例输出：

```text
/turtlesim
```

---

## 5.3 查看某个节点的参数

```bash
ros2 param list /节点名
```

示例：

```bash
ros2 param list /turtlesim
```

可能输出：

```text
/turtlesim:
  background_b
  background_g
  background_r
  use_sim_time
```

---

## 5.4 获取参数值

命令格式：

```bash
ros2 param get /节点名 参数名
```

示例：

```bash
ros2 param get /turtlesim background_r
```

输出示例：

```text
Integer value is: 69
```

---

## 5.5 设置参数值

命令格式：

```bash
ros2 param set /节点名 参数名 参数值
```

示例：

```bash
ros2 param set /turtlesim background_r 255
```

输出示例：

```text
Set parameter successful
```

---

## 5.6 查看参数描述

```bash
ros2 param describe /节点名 参数名
```

示例：

```bash
ros2 param describe /turtlesim background_r
```

---

## 5.7 保存节点参数到 YAML 文件

```bash
ros2 param dump /节点名
```

示例：

```bash
ros2 param dump /turtlesim > turtlesim_params.yaml
```

生成的文件可能类似：

```yaml
/turtlesim:
  ros__parameters:
    background_b: 255
    background_g: 86
    background_r: 69
    use_sim_time: false
```

---

## 5.8 从 YAML 文件加载参数

```bash
ros2 param load /节点名 参数文件.yaml
```

示例：

```bash
ros2 param load /turtlesim turtlesim_params.yaml
```

---

# 6. 使用命令行启动节点时传参

启动节点时可以使用 `--ros-args -p` 设置参数。

命令格式：

```bash
ros2 run 包名 可执行文件 --ros-args -p 参数名:=参数值
```

示例：

```bash
ros2 run demo_nodes_cpp talker --ros-args -p use_sim_time:=true
```

多个参数：

```bash
ros2 run demo_nodes_cpp talker --ros-args \
  -p robot_name:=robot_01 \
  -p publish_rate:=20 \
  -p use_sim_time:=false
```

---

# 7. 使用 YAML 文件配置参数

当参数比较多时，不建议全部写在命令行中，而是使用 YAML 文件集中管理。

---

## 7.1 YAML 参数文件基本格式

基本格式如下：

```yaml
节点名:
  ros__parameters:
    参数1: 值1
    参数2: 值2
```

示例：

```yaml
talker:
  ros__parameters:
    robot_name: "robot_01"
    publish_rate: 10
    use_sim_time: false
```

如果节点名是 `/talker`，也可以写成：

```yaml
/talker:
  ros__parameters:
    robot_name: "robot_01"
    publish_rate: 10
    use_sim_time: false
```

---

## 7.2 带命名空间的 YAML 参数

如果节点位于命名空间 `/robot1` 下，例如完整节点名是：

```text
/robot1/talker
```

那么 YAML 可以写成：

```yaml
/robot1/talker:
  ros__parameters:
    robot_name: "robot_01"
    publish_rate: 10
```

---

## 7.3 使用通配符配置参数

可以使用 `/**` 给多个节点配置公共参数：

```yaml
/**:
  ros__parameters:
    use_sim_time: true
```

这表示所有节点都使用仿真时间。

---

## 7.4 启动节点时加载 YAML 文件

```bash
ros2 run 包名 可执行文件 --ros-args --params-file 参数文件.yaml
```

示例：

```bash
ros2 run demo_nodes_cpp talker --ros-args --params-file params.yaml
```

---

# 8. C++ 中使用 ROS 2 参数

下面以 `rclcpp` 为例。

---

## 8.1 声明参数

```cpp
this->declare_parameter<std::string>("robot_name", "robot_01");
this->declare_parameter<int>("publish_rate", 10);
this->declare_parameter<bool>("use_sim_time", false);
```

---

## 8.2 获取参数

```cpp
std::string robot_name;
int publish_rate;
bool use_sim_time;

this->get_parameter("robot_name", robot_name);
this->get_parameter("publish_rate", publish_rate);
this->get_parameter("use_sim_time", use_sim_time);
```

---

## 8.3 完整 C++ 示例

```cpp
#include "rclcpp/rclcpp.hpp"

class ParamDemoNode : public rclcpp::Node
{
public:
  ParamDemoNode() : Node("param_demo_node")
  {
    this->declare_parameter<std::string>("robot_name", "robot_01");
    this->declare_parameter<int>("publish_rate", 10);
    this->declare_parameter<double>("max_speed", 1.0);
    this->declare_parameter<bool>("debug_mode", false);

    std::string robot_name;
    int publish_rate;
    double max_speed;
    bool debug_mode;

    this->get_parameter("robot_name", robot_name);
    this->get_parameter("publish_rate", publish_rate);
    this->get_parameter("max_speed", max_speed);
    this->get_parameter("debug_mode", debug_mode);

    RCLCPP_INFO(this->get_logger(), "robot_name: %s", robot_name.c_str());
    RCLCPP_INFO(this->get_logger(), "publish_rate: %d", publish_rate);
    RCLCPP_INFO(this->get_logger(), "max_speed: %.2f", max_speed);
    RCLCPP_INFO(this->get_logger(), "debug_mode: %s", debug_mode ? "true" : "false");
  }
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<ParamDemoNode>());
  rclcpp::shutdown();
  return 0;
}
```

---

## 8.4 C++ 动态参数回调

动态参数回调可以在参数被修改时执行检查或更新内部变量。

```cpp
#include "rclcpp/rclcpp.hpp"
#include "rcl_interfaces/msg/set_parameters_result.hpp"

class ParamCallbackNode : public rclcpp::Node
{
public:
  ParamCallbackNode() : Node("param_callback_node")
  {
    this->declare_parameter<int>("publish_rate", 10);

    callback_handle_ = this->add_on_set_parameters_callback(
      std::bind(
        &ParamCallbackNode::onParameterChanged,
        this,
        std::placeholders::_1
      )
    );
  }

private:
  rcl_interfaces::msg::SetParametersResult onParameterChanged(
    const std::vector<rclcpp::Parameter> & parameters)
  {
    rcl_interfaces::msg::SetParametersResult result;
    result.successful = true;

    for (const auto & param : parameters) {
      if (param.get_name() == "publish_rate") {
        int value = param.as_int();

        if (value <= 0) {
          result.successful = false;
          result.reason = "publish_rate must be greater than 0";
          return result;
        }

        RCLCPP_INFO(this->get_logger(), "publish_rate changed to: %d", value);
      }
    }

    return result;
  }

  OnSetParametersCallbackHandle::SharedPtr callback_handle_;
};
```

---

# 9. Python 中使用 ROS 2 参数

下面以 `rclpy` 为例。

---

## 9.1 声明参数

```python
self.declare_parameter('robot_name', 'robot_01')
self.declare_parameter('publish_rate', 10)
self.declare_parameter('use_sim_time', False)
```

---

## 9.2 获取参数

```python
robot_name = self.get_parameter('robot_name').value
publish_rate = self.get_parameter('publish_rate').value
use_sim_time = self.get_parameter('use_sim_time').value
```

---

## 9.3 完整 Python 示例

```python
import rclpy
from rclpy.node import Node


class ParamDemoNode(Node):
    def __init__(self):
        super().__init__('param_demo_node')

        self.declare_parameter('robot_name', 'robot_01')
        self.declare_parameter('publish_rate', 10)
        self.declare_parameter('max_speed', 1.0)
        self.declare_parameter('debug_mode', False)

        robot_name = self.get_parameter('robot_name').value
        publish_rate = self.get_parameter('publish_rate').value
        max_speed = self.get_parameter('max_speed').value
        debug_mode = self.get_parameter('debug_mode').value

        self.get_logger().info(f'robot_name: {robot_name}')
        self.get_logger().info(f'publish_rate: {publish_rate}')
        self.get_logger().info(f'max_speed: {max_speed}')
        self.get_logger().info(f'debug_mode: {debug_mode}')


def main(args=None):
    rclpy.init(args=args)
    node = ParamDemoNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
```

运行：

```bash
ros2 run your_package param_demo_node
```

命令行传参：

```bash
ros2 run your_package param_demo_node --ros-args \
  -p robot_name:=robot_02 \
  -p publish_rate:=20
```

---

## 9.4 Python 动态参数回调

```python
import rclpy
from rclpy.node import Node
from rcl_interfaces.msg import SetParametersResult


class ParamCallbackNode(Node):
    def __init__(self):
        super().__init__('param_callback_node')

        self.declare_parameter('publish_rate', 10)

        self.add_on_set_parameters_callback(self.parameter_callback)

    def parameter_callback(self, params):
        result = SetParametersResult()
        result.successful = True

        for param in params:
            if param.name == 'publish_rate':
                if param.value <= 0:
                    result.successful = False
                    result.reason = 'publish_rate must be greater than 0'
                    return result

                self.get_logger().info(
                    f'publish_rate changed to: {param.value}'
                )

        return result


def main(args=None):
    rclpy.init(args=args)
    node = ParamCallbackNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
```

运行后，可以在另一个终端修改参数：

```bash
ros2 param set /param_callback_node publish_rate 20
```

如果设置非法值：

```bash
ros2 param set /param_callback_node publish_rate -1
```

会失败。

---

# 10. Launch 文件中设置参数

ROS 2 常用 Python 格式的 launch 文件来启动节点。

---

## 10.1 在 Launch 中直接写参数

```python
from launch import LaunchDescription
from launch_ros.actions import Node


def generate_launch_description():
    return LaunchDescription([
        Node(
            package='demo_nodes_cpp',
            executable='talker',
            name='talker',
            parameters=[
                {
                    'robot_name': 'robot_01',
                    'publish_rate': 10,
                    'use_sim_time': False
                }
            ]
        )
    ])
```

---

## 10.2 在 Launch 中加载 YAML 参数文件

```python
from launch import LaunchDescription
from launch_ros.actions import Node
from ament_index_python.packages import get_package_share_directory

import os


def generate_launch_description():
    config_file = os.path.join(
        get_package_share_directory('your_package'),
        'config',
        'params.yaml'
    )

    return LaunchDescription([
        Node(
            package='your_package',
            executable='param_demo_node',
            name='param_demo_node',
            parameters=[config_file]
        )
    ])
```

---

# 11. 参数文件组织建议

推荐在 ROS 2 包中建立 `config` 目录：

```text
your_package/
├── config/
│   └── params.yaml
├── launch/
│   └── param_demo.launch.py
├── src/
│   └── param_demo_node.cpp
├── package.xml
└── CMakeLists.txt
```

参数文件：

```yaml
param_demo_node:
  ros__parameters:
    robot_name: "robot_01"
    publish_rate: 10
    max_speed: 1.0
    debug_mode: false
```

---

# 12. 常用内置参数：use_sim_time

`use_sim_time` 是 ROS 2 中非常常见的参数。

它用于决定节点是否使用仿真时间。

## 12.1 使用系统时间

```yaml
use_sim_time: false
```

## 12.2 使用仿真时间

```yaml
use_sim_time: true
```

当使用 Gazebo、RViz 回放 rosbag 或仿真环境时，通常需要设置：

```bash
ros2 param set /node_name use_sim_time true
```

或在 YAML 中写：

```yaml
/**:
  ros__parameters:
    use_sim_time: true
```

---

# 13. 实验：使用 turtlesim 学习参数

`turtlesim` 是学习 ROS 2 的经典示例。

---

## 13.1 启动 turtlesim

终端 1：

```bash
ros2 run turtlesim turtlesim_node
```

---

## 13.2 查看节点

终端 2：

```bash
ros2 node list
```

输出：

```text
/turtlesim
```

---

## 13.3 查看参数

```bash
ros2 param list /turtlesim
```

可能输出：

```text
/turtlesim:
  background_b
  background_g
  background_r
  use_sim_time
```

---

## 13.4 修改背景颜色

```bash
ros2 param set /turtlesim background_r 255
ros2 param set /turtlesim background_g 255
ros2 param set /turtlesim background_b 255
```

背景颜色会变成白色。

---

## 13.5 保存当前参数

```bash
ros2 param dump /turtlesim > turtlesim_params.yaml
```

---

## 13.6 下次加载参数

```bash
ros2 run turtlesim turtlesim_node --ros-args --params-file turtlesim_params.yaml
```

---

# 14. 常见错误与解决方法

## 14.1 ParameterNotDeclaredException

### 问题原因

参数没有声明就被读取。

错误类似：

```text
ParameterNotDeclaredException
```

### 解决方法

先声明参数：

C++：

```cpp
this->declare_parameter("speed", 1.0);
```

Python：

```python
self.declare_parameter("speed", 1.0)
```

---

## 14.2 YAML 文件不生效

### 常见原因

- 节点名写错
- 缩进错误
- `ros__parameters` 写错
- launch 中节点 `name` 和 YAML 不一致
- 参数没有被节点声明
- 参数文件路径错误

### 正确示例

```yaml
param_demo_node:
  ros__parameters:
    robot_name: "robot_01"
    publish_rate: 10
```

注意：`ros__parameters` 中间是两个下划线。

---

## 14.3 参数设置成功但程序行为没变化

### 可能原因

- 节点只在启动时读取了一次参数
- 没有添加动态参数回调
- 参数虽然修改了，但内部变量没有更新

### 解决方法

使用参数回调，在参数变化时更新内部变量。

---

## 14.4 类型不匹配

例如参数声明为整数：

```cpp
this->declare_parameter<int>("publish_rate", 10);
```

但 YAML 写成字符串：

```yaml
publish_rate: "10"
```

这可能导致类型错误。

正确写法：

```yaml
publish_rate: 10
```

---

# 15. 教学练习

## 练习 1：查看 turtlesim 参数

1. 启动 turtlesim：

```bash
ros2 run turtlesim turtlesim_node
```

2. 查看参数：

```bash
ros2 param list /turtlesim
```

3. 获取背景颜色参数：

```bash
ros2 param get /turtlesim background_r
ros2 param get /turtlesim background_g
ros2 param get /turtlesim background_b
```

---

## 练习 2：修改 turtlesim 背景颜色

尝试执行：

```bash
ros2 param set /turtlesim background_r 0
ros2 param set /turtlesim background_g 0
ros2 param set /turtlesim background_b 0
```

观察窗口背景颜色变化。

---

## 练习 3：编写 YAML 参数文件

创建 `params.yaml`：

```yaml
param_demo_node:
  ros__parameters:
    robot_name: "robot_01"
    publish_rate: 5
    max_speed: 0.8
    debug_mode: true
```

启动节点时加载：

```bash
ros2 run your_package param_demo_node --ros-args --params-file params.yaml
```

---

## 练习 4：动态修改参数

运行支持参数回调的节点后，执行：

```bash
ros2 param set /param_callback_node publish_rate 30
```

再尝试非法值：

```bash
ros2 param set /param_callback_node publish_rate -5
```

观察结果。

---

# 16. 总结

ROS 2 参数是节点配置的重要机制。

核心知识点：

- 参数属于节点
- 参数通常需要声明
- 可以通过命令行、YAML、Launch 配置参数
- 可以使用 `ros2 param` 查看、获取、设置参数
- YAML 文件适合管理大量参数
- 动态参数回调可以让节点在运行时响应参数变化
- `use_sim_time` 是仿真和 rosbag 中最常用的参数之一

---

# 17. 常用命令速查表

| 功能      | 命令                                                    |
| --------- | ------------------------------------------------------- |
| 查看节点  | `ros2 node list`                                        |
| 查看参数  | `ros2 param list /node_name`                            |
| 获取参数  | `ros2 param get /node_name param_name`                  |
| 设置参数  | `ros2 param set /node_name param_name value`            |
| 查看描述  | `ros2 param describe /node_name param_name`             |
| 保存参数  | `ros2 param dump /node_name > params.yaml`              |
| 加载参数  | `ros2 param load /node_name params.yaml`                |
| 启动传参  | `ros2 run pkg exe --ros-args -p name:=value`            |
| 加载 YAML | `ros2 run pkg exe --ros-args --params-file params.yaml` |

