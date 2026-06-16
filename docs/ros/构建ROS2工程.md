# 构建ROS工作空间

### 目录结构

ros2_ws/
├── src/                  # 源代码目录，所有 ROS 2 包放在这里
│   ├── package_a/
│   │   ├── package.xml   # 包描述文件
│   │   ├── CMakeLists.txt
│   │   ├── src/          # C++ 源文件
│   │   ├── include/      # C++ 头文件
│   │   ├── launch/       # launch 启动文件
│   │   ├── config/       # 参数配置文件
│   │   ├── msg/          # 自定义消息
│   │   ├── srv/          # 自定义服务
│   │   └── action/       # 自定义动作
│   │
│   └── package_b/
│       ├── package.xml
│       ├── setup.py      # Python 包常见
│       ├── setup.cfg
│       ├── resource/
│       ├── launch/
│       └── package_b/
│           └── node.py
│
├── build/                # 编译中间文件，由 colcon 自动生成
├── install/              # 安装结果目录，由 colcon 自动生成
├── log/                  # 编译日志目录，由 colcon 自动生成
└── README.md             # 可选，工作空间说明



### 常用流程

```
mkdir -p ~/ros2_ws/src
cd ~/ros2_ws
colcon build
source install/setup.bash
```

