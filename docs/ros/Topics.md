# Topics

Topic 用于节点之间的异步数据传输。

## 1. Topic 是什么？

ROS 2 中不同节点之间通常不会直接调用彼此函数，而是通过 Topic 通信。

例如：

```text
摄像头节点  --->  /image_raw  --->  图像处理节点
```

或者：

```text
键盘控制节点  --->  /cmd_vel  --->  小车底盘节点
```

其中：

```text
/image_raw
/cmd_vel
```

就是 Topic。

## 2. 发布者和订阅者

Topic 通信中有两个核心角色：

### Publisher 发布者

负责往某个话题发送数据。

例如：

```text
摄像头节点发布图像数据
```

---

### Subscriber 订阅者

负责从某个话题接收数据。

例如：

```text
图像处理节点订阅图像数据
```

---

## 3. 基本模型

```text
Publisher 节点
    |
    | 发布消息
    v
Topic 话题
    |
    | 订阅消息
    v
Subscriber 节点
```

例如：

```text
/talker
    |
    | std_msgs/String
    v
/chatter
    |
    v
/listener
```

---

## 4. Topic 的特点

### 1. 异步通信

发布者发消息后，不需要等待订阅者回复。

例如：

```text
摄像头节点只管不断发布图像
图像处理节点有数据就处理
```

---

### 2. 多对多通信

一个 Topic 可以有：

- 一个发布者，多个订阅者
- 多个发布者，一个订阅者
- 多个发布者，多个订阅者

例如：

```text
/camera/image_raw
```

可以同时被：

```text
图像显示节点
目标检测节点
录像节点
```

订阅。

---

### 3. 需要消息类型一致

发布者和订阅者必须使用同一种消息类型。

例如：

```bash
/cmd_vel
```

通常类型是：

```bash
geometry_msgs/msg/Twist
```

如果类型不匹配，就不能正常通信。

---

## 5. 常见 Topic 例子

| Topic 名称          | 常见消息类型                 | 含义           |
| ------------------- | ---------------------------- | -------------- |
| `/cmd_vel`          | `geometry_msgs/msg/Twist`    | 控制机器人速度 |
| `/odom`             | `nav_msgs/msg/Odometry`      | 里程计信息     |
| `/scan`             | `sensor_msgs/msg/LaserScan`  | 激光雷达数据   |
| `/camera/image_raw` | `sensor_msgs/msg/Image`      | 摄像头图像     |
| `/imu`              | `sensor_msgs/msg/Imu`        | IMU 数据       |
| `/tf`               | `tf2_msgs/msg/TFMessage`     | 动态坐标变换   |
| `/joint_states`     | `sensor_msgs/msg/JointState` | 关节状态       |

---

## 6. 常用命令

### 查看所有话题

```bash
ros2 topic list
```

---

### 查看话题和类型

```bash
ros2 topic list -t
```

示例：

```bash
/cmd_vel [geometry_msgs/msg/Twist]
/odom [nav_msgs/msg/Odometry]
```

---

### 查看某个话题类型

```bash
ros2 topic type /话题名
```

例如：

```bash
ros2 topic type /cmd_vel
```

输出：

```bash
geometry_msgs/msg/Twist
```

---

### 查看话题内容

```bash
ros2 topic echo /话题名
```

例如：

```bash
 ros2 topic echo /robot_news 
```

---

### 查看话题频率

```bash
ros2 topic hz /话题名
```

例如：

```bash
ros2 topic hz /scan
```

---

### 查看话题带宽

```bash
ros2 topic bw /话题名
```

例如：

```bash
ros2 topic bw /camera/image_raw
```

---

### 手动发布一次消息

```bash
ros2 topic pub /话题名 消息类型 "消息内容"
```

例如发布速度控制：

```bash
ros2 topic pub /cmd_vel geometry_msgs/msg/Twist "{linear: {x: 0.2}, angular: {z: 0.0}}"
```

---

### 按频率发布消息

```bash
ros2 topic pub -r 10 /cmd_vel geometry_msgs/msg/Twist "{linear: {x: 0.2}, angular: {z: 0.0}}"
```

表示：

```text
以 10 Hz 频率发布速度指令
```

---

## 7. Topic 通信适合什么？

适合连续数据流，例如：

- 摄像头图像
- 激光雷达
- IMU
- 里程计
- 机器人速度命令
- 关节状态
- 传感器数据

---

## 8. Topic 不适合什么？

Topic 不适合需要明确请求和响应的场景。

例如：

```text
打开/关闭电机
保存地图
查询当前模式
请求规划路径
```

这类更适合用：

```text
Service
```

如果是长时间任务，比如：

```text
导航到某个目标点
机械臂执行轨迹
无人机起飞降落
```

更适合用：

```text
Action
```

---

## 9. Topic、Service、Action 简单区别

| 通信方式 | 特点           | 适合场景                 |
| -------- | -------------- | ------------------------ |
| Topic    | 持续发布/订阅  | 传感器、速度、状态       |
| Service  | 一问一答       | 开关、查询、短任务       |
| Action   | 可反馈、可取消 | 导航、机械臂运动、长任务 |

---

## 10. C++ 中创建发布者

简单示例：

```cpp
publisher_ = this->create_publisher<std_msgs::msg::String>("chatter", 10);
```

发布消息：

```cpp
auto msg = std_msgs::msg::String();
msg.data = "hello";
publisher_->publish(msg);
```

---

## 11. C++ 中创建订阅者

```cpp
subscription_ = this->create_subscription<std_msgs::msg::String>(
    "chatter",
    10,
    std::bind(&MyNode::callback, this, std::placeholders::_1)
);
```

回调函数：

```cpp
void callback(const std_msgs::msg::String::SharedPtr msg)
{
    RCLCPP_INFO(this->get_logger(), "I heard: %s", msg->data.c_str());
}
```

---

## 12. Python 中创建发布者

```python
self.publisher_ = self.create_publisher(String, 'chatter', 10)
```

发布：

```python
msg = String()
msg.data = 'hello'
self.publisher_.publish(msg)
```

---

## 13. Python 中创建订阅者

```python
self.subscription = self.create_subscription(
    String,
    'chatter',
    self.listener_callback,
    10
)
```

回调：

```python
def listener_callback(self, msg):
    self.get_logger().info('I heard: "%s"' % msg.data)
```

---

## 14. 简单例子：小车速度控制

小车底盘节点订阅：

```bash
/cmd_vel
```

键盘控制节点发布：

```bash
/cmd_vel
```

结构：

```text
/teleop_keyboard
        |
        | geometry_msgs/msg/Twist
        v
/cmd_vel
        |
        v
/base_controller
```

消息内容大概是：

```yaml
linear:
  x: 0.2
  y: 0.0
  z: 0.0
angular:
  x: 0.0
  y: 0.0
  z: 0.5
```

## 15.常用命令

```bash
ros2 topic list
ros2 topic echo /topic_name
ros2 topic info /topic_name
ros2 topic pub /topic_name 消息类型 "内容"
```