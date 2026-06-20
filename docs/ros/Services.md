# 服务（Service）

## 1. 什么是服务

ROS 2 中的 **服务（Service）** 是一种 **请求-响应** 通信方式。

它由两个节点组成：

- **服务端 Server**：接收请求，处理后返回结果
- **客户端 Client**：发送请求，并接收返回结果

基本流程：

```text
Client 发送请求
        ↓
Server 处理请求
        ↓
Client 接收响应
```

---

## 2. 服务接口 `.srv`

服务的数据格式由 `.srv` 文件定义。

`.srv` 文件分为两部分：

```text
请求数据
---
响应数据
```

本例使用 ROS 2 自带服务接口：

```text
example_interfaces/srv/AddTwoInts
```

接口内容为：

```text
int64 a
int64 b
---
int64 sum
```

含义：

- 客户端发送两个整数 `a` 和 `b`
- 服务端返回它们的和 `sum`

---

# 3. Python 示例

## 3.1 Python 服务端

文件名：

```bash
add_two_ints_server.py
```

```python
import rclpy
from rclpy.node import Node
from example_interfaces.srv import AddTwoInts


class AddTwoIntsServer(Node):
    def __init__(self):
        super().__init__('add_two_ints_server')

        self.service = self.create_service(
            AddTwoInts,
            'add_two_ints',
            self.handle_add_two_ints
        )

        self.get_logger().info('Python 服务端已启动')

    def handle_add_two_ints(self, request, response):
        response.sum = request.a + request.b

        self.get_logger().info(
            f'请求: {request.a} + {request.b} = {response.sum}'
        )

        return response


def main(args=None):
    rclpy.init(args=args)

    node = AddTwoIntsServer()

    rclpy.spin(node)

    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
```

---

## 3.2 Python 客户端

文件名：

```bash
add_two_ints_client.py
```

```python
import rclpy
from rclpy.node import Node
from example_interfaces.srv import AddTwoInts


class AddTwoIntsClient(Node):
    def __init__(self):
        super().__init__('add_two_ints_client')

        self.client = self.create_client(
            AddTwoInts,
            'add_two_ints'
        )

    def send_request(self, a, b):
        while not self.client.wait_for_service(timeout_sec=1.0):
            self.get_logger().info('等待服务端启动...')

        request = AddTwoInts.Request()
        request.a = a
        request.b = b

        future = self.client.call_async(request)

        rclpy.spin_until_future_complete(self, future)

        return future.result()


def main(args=None):
    rclpy.init(args=args)

    node = AddTwoIntsClient()

    response = node.send_request(3, 5)

    node.get_logger().info(f'响应结果: {response.sum}')

    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()
```

---

# 4. C++ 示例

## 4.1 C++ 服务端

文件名：

```bash
add_two_ints_server.cpp
```

```cpp
#include "rclcpp/rclcpp.hpp"
#include "example_interfaces/srv/add_two_ints.hpp"

#include <memory>

using AddTwoInts = example_interfaces::srv::AddTwoInts;

class AddTwoIntsServer : public rclcpp::Node
{
public:
  AddTwoIntsServer()
  : Node("add_two_ints_server")
  {
    service_ = this->create_service<AddTwoInts>(
      "add_two_ints",
      std::bind(
        &AddTwoIntsServer::handle_add_two_ints,
        this,
        std::placeholders::_1,
        std::placeholders::_2
      )
    );

    RCLCPP_INFO(this->get_logger(), "C++ 服务端已启动");
  }

private:
  void handle_add_two_ints(
    const std::shared_ptr<AddTwoInts::Request> request,
    std::shared_ptr<AddTwoInts::Response> response)
  {
    response->sum = request->a + request->b;

    RCLCPP_INFO(
      this->get_logger(),
      "请求: %ld + %ld = %ld",
      request->a,
      request->b,
      response->sum
    );
  }

  rclcpp::Service<AddTwoInts>::SharedPtr service_;
};


int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);

  auto node = std::make_shared<AddTwoIntsServer>();

  rclcpp::spin(node);

  rclcpp::shutdown();

  return 0;
}
```

---

## 4.2 C++ 客户端

文件名：

```bash
add_two_ints_client.cpp
```

```cpp
#include "rclcpp/rclcpp.hpp"
#include "example_interfaces/srv/add_two_ints.hpp"

#include <chrono>
#include <memory>

using namespace std::chrono_literals;
using AddTwoInts = example_interfaces::srv::AddTwoInts;

class AddTwoIntsClient : public rclcpp::Node
{
public:
  AddTwoIntsClient()
  : Node("add_two_ints_client")
  {
    client_ = this->create_client<AddTwoInts>("add_two_ints");
  }

  void send_request(int64_t a, int64_t b)
  {
    while (!client_->wait_for_service(1s)) {
      RCLCPP_INFO(this->get_logger(), "等待服务端启动...");
    }

    auto request = std::make_shared<AddTwoInts::Request>();
    request->a = a;
    request->b = b;

    auto future = client_->async_send_request(request);

    auto result = rclcpp::spin_until_future_complete(
      this->get_node_base_interface(),
      future
    );

    if (result == rclcpp::FutureReturnCode::SUCCESS) {
      RCLCPP_INFO(
        this->get_logger(),
        "响应结果: %ld",
        future.get()->sum
      );
    } else {
      RCLCPP_ERROR(this->get_logger(), "服务调用失败");
    }
  }

private:
  rclcpp::Client<AddTwoInts>::SharedPtr client_;
};


int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);

  auto node = std::make_shared<AddTwoIntsClient>();

  node->send_request(3, 5);

  rclcpp::shutdown();

  return 0;
}
```

---

# 5. 运行方式

## 查看接口

```bash
ros2 interface show example_interfaces/srv/AddTwoInts
```

输出：

```text
int64 a
int64 b
---
int64 sum
```

---

## 启动服务端

如果是 Python：

```bash
ros2 run 包名 add_two_ints_server
```

如果是 C++：

```bash
ros2 run 包名 add_two_ints_server
```

---

## 启动客户端

```bash
ros2 run 包名 add_two_ints_client
```

---

## 命令行调用服务

也可以不用客户端程序，直接用命令行调用：

```bash
ros2 service call /add_two_ints example_interfaces/srv/AddTwoInts "{a: 3, b: 5}"
```

返回结果：

```text
sum=8
```

---

# 6. 总结

ROS 2 服务的核心结构：

```text
服务端：create_service()
客户端：create_client()
请求：Request
响应：Response
```

本例中：

```text
客户端发送：a = 3, b = 5
服务端返回：sum = 8
```