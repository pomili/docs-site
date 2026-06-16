# C++知识

### 构造函数初始化列表

```
#include <iostream>
using namespace std;

class Person {
private:
    string name;
    int age;

public:
    Person(string n, int a) : name(n), age(a) {
        cout << "构造函数执行" << endl;
    }

    void show() {
        cout << "name = " << name << ", age = " << age << endl;
    }

};

int main() {
    Person p("Tom", 18);
    p.show();

    return 0;

}
```

这里的

```
Person(string n, int a) : name(n), age(a)
```

就是构造函数初始化列表

等价于

```
name = n;
age = a;
```

但严格来说，它不是“赋值”，而是在对象创建时直接初始化成员变量。

## `std::bind` 函数和部分参数提前绑定

头文件：

```cpp
#include <functional>
```

## 1. 普通函数

```cpp
#include <iostream>
#include <functional>
using namespace std::placeholders;

void print(int a, int b) {
    std::cout << a << " " << b << std::endl;
}

int main() {
    auto f = std::bind(print, _1, 10);
    f(5); // 等价于 print(5, 10)
}
```

## 2. 改变参数顺序

```cpp
auto f = std::bind(print, _2, _1);
f(1, 2); // 等价于 print(2, 1)
```

## 3. 绑定成员函数

```cpp
struct A {
    void show(int x) {
        std::cout << x << std::endl;
    }
};

A a;
auto f = std::bind(&A::show, &a, _1);
f(100); // 等价于 a.show(100)
```

## 4. 注意引用

`bind` 默认会拷贝参数，要引用用 `std::ref`：

```cpp
auto f = std::bind(func, std::ref(x));
```

## 5. 简单总结

```cpp
auto f = std::bind(函数, 固定参数, _1, _2);
```

- `_1` 表示调用时传入的第 1 个参数
- `_2` 表示调用时传入的第 2 个参数
- 现代 C++ 中很多场景也可以用 `lambda` 替代。

## `std::chrono_literals` =时间字面量命名空间

它可以让你直接写：

```cpp
using namespace std::chrono_literals;

auto t1 = 10s;   // 10 秒
auto t2 = 5ms;   // 5 毫秒
auto t3 = 2h;    // 2 小时
```

这些其实是 `std::chrono::duration` 类型。

---

常见后缀：

```cpp
h    // 小时
min  // 分钟
s    // 秒
ms   // 毫秒
us   // 微秒
ns   // 纳秒
```

示例：

```cpp
#include <iostream>
#include <chrono>
#include <thread>

using namespace std::chrono_literals;

int main() {
    std::this_thread::sleep_for(500ms);
    std::cout << "sleep 500ms\n";
}
```



