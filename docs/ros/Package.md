# Package

ROS 2 包(package)，是 ROS 2 中组织代码和资源的基本单位。一个包就是一个功能模块。

例如一个机器人可以拆分成很多包：

```
my_robot_description   # 机器人模型包
my_robot_bringup       # 启动包
my_robot_control       # 控制包
my_robot_navigation    # 导航包
my_robot_interfaces    # 自定义消息/服务/动作包
```

## C++包

```
my_cpp_pkg/
├── package.xml
├── CMakeLists.txt
├── src/
│   └── talker.cpp
├── include/
│   └── my_cpp_pkg/
├── launch/
│   └── talker.launch.py
└── config/
    └── params.yaml
```

## python包

```
my_py_pkg/
├── package.xml
├── setup.py
├── setup.cfg
├── resource/
│   └── my_py_pkg
├── my_py_pkg/
│   ├── __init__.py
│   └── listener.py
├── launch/
│   └── listener.launch.py
└── config/
    └── params.yaml
```

### 创建包

```
//进入工作空间的src目录
cd ~/ros2_ws/src
//创建C++包
ros2 pkg create my_cpp_pkg --build-type ament_cmake --dependencies rclcpp
//创建python包
ros2 pkg create my_py_pkg --build-type ament_python --dependencies rclpy
```

- `my_cpp_pkg`：包名
- `--build-type ament_cmake`：C++ 常用构建方式
- `--dependencies rclcpp`：依赖 C++ ROS 2 库

### 编译包

```
cd ~/ros2_ws                             #进入工作空间
colcon build                             #编译全部包
colcon build --packages-select my_py_pkg #编译选择的包
source install/setup.bash
```

