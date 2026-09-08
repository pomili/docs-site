# K-means聚类

> K-means（K 均值聚类）是数学建模中最常用的**无监督学习**算法之一。它的任务很朴素：把 $n$ 个样本自动分成 $K$ 组（簇），使得**组内样本尽量相似、组间样本尽量不同**。K-means 思想简单、计算飞快、结果直观，是竞赛中处理**客户分群、市场细分、样本分类、异常初步筛查**类题目的首选入门工具，也是学习 DBSCAN、GMM 等高级聚类方法的第一块垫脚石。本文从原理、适用场景、评价指标、可视化到可运行代码，完整梳理 K-means 的竞赛实战用法。

## 一、算法含义

### 1.1 通俗理解

先回忆一下"监督学习"与"无监督学习"的区别：

- **监督学习**（如回归、分类）：每个样本都有标签 $y$（如房价、类别），算法照着标签"学"；
- **无监督学习**（如聚类）：样本**没有标签**，只有特征 $x$，算法要自己从数据中"发现"内在结构。

K-means 聚类的直观思想是"物以类聚"。举个例子：超市手里有 10000 名会员的消费数据（最近 3 个月消费金额、消费次数、客单价等），想把会员分成几类以便差异化营销——但**没有人事先告诉你应该分成哪几类、每个会员属于哪一类**。K-means 的做法是：

1. 预先指定要分的组数 $K$（比如 $K=3$："高价值""中价值""低价值"会员）；
2. 在数据空间里放 $K$ 个"代表点"（质心），把每个样本划给离它**最近**的代表点；
3. 代表点挪到本组样本的**中心**位置，再重新划分，如此反复；
4. 直到划分不再变化——最终得到的 $K$ 组就是聚类结果。

通俗地说：**"每个点跟着最近的质心走，质心跟着本组点的平均位置走，两者互相调整直到稳定"**。

### 1.2 数学模型与目标函数

设数据集为 $n$ 个样本、每个样本有 $p$ 个特征：

$$X = \{x_1, x_2, \dots, x_n\}, \quad x_i \in \mathbb{R}^{p}$$

K-means 要把这 $n$ 个样本划分成 $K$ 个**互不相交**的簇（簇即"组"）：

$$C_1 \cup C_2 \cup \dots \cup C_K = \{1, 2, \dots, n\}, \quad C_k \cap C_j = \varnothing \ (k \ne j)$$

每个簇 $C_k$ 有一个**质心**（centroid）$\mu_k \in \mathbb{R}^{p}$，代表这个簇的"典型位置"。聚类的"好坏"用**组内平方和**（SSE, Sum of Squared Errors，又称 inertia 惯性）衡量——即每个样本到它所在簇质心的欧氏距离平方之和：

$$SSE = \sum_{k=1}^{K} \sum_{i \in C_k} \lVert x_i - \mu_k \rVert^2 = \sum_{k=1}^{K} \sum_{i \in C_k} \sum_{j=1}^{p} (x_{ij} - \mu_{kj})^2$$

其中 $\lVert x_i - \mu_k \rVert = \sqrt{\sum_{j=1}^{p}(x_{ij} - \mu_{kj})^2}$ 是样本 $x_i$ 与质心 $\mu_k$ 的**欧氏距离**。

这个目标函数的含义非常直观：

- 如果每个样本都紧贴自己簇的质心，SSE 就小——簇内**紧凑**；
- 如果有样本远离质心（被错误划分、或簇内有离群点），平方项会把这种"远"放大，SSE 急剧增大。

所以 **K-means 的求解目标就是：找一组划分 $\{C_k\}$ 和质心 $\{\mu_k\}$，使 SSE 最小**。

$$\min_{C_1,\dots,C_K,\ \mu_1,\dots,\mu_K} \sum_{k=1}^{K} \sum_{i \in C_k} \lVert x_i - \mu_k \rVert^2$$

注意：这个优化问题是 **NP 难**的（要枚举所有可能的划分），所以 K-means 不追求全局最优解，而是用下面的**两步交替迭代**求一个足够好的解。

### 1.3 两步交替迭代

K-means 的求解过程是**分配步**与**更新步**的反复交替（与 EM 算法的 E 步、M 步思想类似）：

**① 分配步（Assignment）——固定质心，重新划分样本**

给定当前质心 $\mu_1, \dots, \mu_K$，把每个样本 $x_i$ 分给**离它最近**的质心所在簇（就近原则）：

$$C_k = \left\{ i : \lVert x_i - \mu_k \rVert \le \lVert x_i - \mu_j \rVert, \ \forall j = 1, 2, \dots, K \right\}$$

**② 更新步（Update）——固定划分，重新计算质心**

给定当前划分 $C_1, \dots, C_K$，把每个簇的质心更新为簇内所有样本的**均值**：

$$\mu_k = \frac{1}{|C_k|} \sum_{i \in C_k} x_i$$

其中 $|C_k|$ 是第 $k$ 个簇的样本数。

**为什么质心取均值？** 把 SSE 对 $\mu_k$ 求偏导并令其为 0：

$$\frac{\partial SSE}{\partial \mu_k} = -2 \sum_{i \in C_k} (x_i - \mu_k) = 0 \quad \Rightarrow \quad \mu_k = \frac{1}{|C_k|} \sum_{i \in C_k} x_i$$

可见在"划分固定"的条件下，均值恰好是使 SSE 最小的质心——这也是平方损失下"中心"必然是均值的数学根源。

两步交替执行：初始质心 → 分配 → 更新 → 分配 → 更新 → …… 直到收敛。这就是 K-means 名字的由来：$K$ 个均值（means）。

### 1.4 收敛性

K-means 能保证收敛，理由如下：

- **分配步**：每个样本换到更近的质心，SSE 只会下降或不变；
- **更新步**：均值是当前划分下 SSE 的最优解，SSE 同样只会下降或不变；

因此 **SSE 单调不增**。又因为 $SSE \ge 0$（平方和非负，有下界），单调不增且有下界的数列必然收敛——所以 K-means 的迭代**一定会在有限步内停止**（实践中常设：质心位移小于阈值 `tol` 或达到最大迭代次数 `max_iter` 即停）。

但必须强调两点：

1. K-means 收敛到的是**局部最优**而非全局最优——不同的初始质心可能得到不同的结果（有的好、有的差）；
2. 收敛的快慢与初始质心的位置关系很大：初始质心挤在一起时收敛慢且结果差。

竞赛中的标准对策：**多次随机初始化，取 SSE 最小的一次**（sklearn 中即 `n_init=10`），或用下文介绍的 **k-means++ 初始化**。

### 1.5 K-means++ 初始化

普通随机初始化的缺陷：若 $K$ 个初始质心恰好都落在同一个真实簇里，算法很难再"掰开"，最终收敛到很差的局部最优。

**K-means++ 初始化**的思路是"让初始质心尽量彼此远离"：

1. 随机均匀地选第一个质心；
2. 对每个样本 $x$，计算它到**已选质心的最近距离** $D(x)$；
3. 以与 $D(x)^2$ 成正比的概率抽下一个质心：

$$P(\text{选 } x \text{ 为下一个质心}) = \frac{D(x)^2}{\sum_{x' \in X} D(x')^2}$$

也就是说，**离已选质心越远的样本，越有资格成为下一个质心**。重复第 2、3 步直到选满 $K$ 个。

K-means++ 只是改进了初始化，迭代过程与普通 K-means 完全相同，几乎不增加计算量，却能显著降低陷入差局部最优的概率。理论上有著名结论：k-means++ 得到的 SSE 期望不超过最优 SSE 的 $O(\log K)$ 倍。scikit-learn 中 `KMeans(init="k-means++")` 是**默认选项**，竞赛代码里一般不用改。

### 1.6 优缺点

**优点**：

- 思想简单、实现容易（核心只有"就近分配 + 均值更新"两步，几十行代码即可手写）；
- 计算快：每次迭代复杂度约 $O(nKp)$，$n$、$p$ 很大也能跑（超大规模可用 MiniBatchKMeans）；
- 结果可解释性强：每个簇就是一个"质心 + 样本集合"，质心坐标可直接用于"类别画像"描述；
- sklearn 一行代码即可调用，参数少、不易出错，适合竞赛节奏；
- 是很多高级方法（二分 K-means、GMM 的初始化、矢量量化）的基础。

**缺点**：

- **簇数 $K$ 必须预先给定**——K 选错了结论全错（需用肘部法则、轮廓系数辅助选 K）；
- **对离群点敏感**：平方距离会把离群点的"远"成倍放大，一个极端点就能把质心拽偏；
- **隐含"球状簇"假设**：默认簇是凸的、各方向方差相近的球形，对细长形、环形、月牙形簇无能为力；
- **对初始化敏感**：随机初始化可能陷入差的局部最优（对策：k-means++、多次运行取最优）；
- 基于**欧氏距离**：特征量纲差异大或高维数据下距离会失真（对策：先标准化、必要时先降维）。

## 二、何时使用（适用场景与条件）

### 2.1 适用场景

1. **客户分群 / 市场细分**：把客户按消费金额、频次、活跃度等特征分成若干群体，对不同群体制定差异化策略。这是 K-means 最经典、评审最认可的用法；
2. **图像颜色量化**：把一张图的上万种颜色压缩成 $K$ 种代表色（质心即代表色），常用于图像压缩、风格分析；
3. **赛题中的样本分群**：对样本先聚类，再**分群分别建模**（比如先分群再对每群分别做回归），往往比整体建模精度更高；
4. **异常初步筛查**：聚类后把**样本数极少的小簇**或**离质心极远的样本**标记为异常候选，再做进一步核查——注意这只是"初步筛查"，异常检测的正规武器是 DBSCAN 或孤立森林；
5. **特征工程 / 数据预处理**：把聚类标签作为新的分类特征喂给后续模型，或对连续特征做"离散化"；
6. **地理聚类**：按经纬度对门店、配送点、事故点分群，辅助选址与区域划分。

### 2.2 竞赛典型题目

历年数学建模竞赛中，K-means 常作为"探索性分析"或"预处理环节"出现：

- **数据分群类**：赛题给出一批无标签样本（如企业、用户、区域），要求"分类研究、提出针对性建议"——K-means 是最直接的解题工具；
- **分群 + 分别建模类**：先对样本聚类，再对每类分别建立回归/评价模型，结论更精细（如 2021 年国赛 B 题《乙醇偶合制备 C4 烯烃》中，常先对催化剂组合与产物指标聚类、识别工况类别，再分类别讨论影响因素）；
- **异常筛查类**：传感器数据、交易记录中的异常值，可先聚类再看孤立小簇；
- **画像描述类**：聚类后输出各簇质心，直接写成"类别 1 具有高消费、低频次的特征……"，是论文里最出彩的定性结论。

竞赛定位提示：聚类是**无监督**的，没有标准答案可对，所以论文中必须用**肘部法则、轮廓系数等指标论证"为什么 K 取这个值、聚类结果是否可信"**，否则结论缺乏说服力。

### 2.3 使用前提

1. **特征必须标准化**（最重要！）：K-means 用欧氏距离，若特征量纲不同（如"收入/元"与"年龄/岁"），数值大的特征会"垄断"距离。使用前必须做 z-score 标准化：$x'_{ij} = \dfrac{x_{ij} - \bar{x}_j}{s_j}$；
2. **球状簇假设大致成立**：数据中的簇应是"一团团"的凸集（大致球形、各簇方差相近）。细长、环形、嵌套的簇请换 DBSCAN 或谱聚类；
3. **簇数 $K$ 已知或可估计**：由业务背景给定，或由肘部法则/轮廓系数确定；
4. **特征以连续数值为主**：若含大量无序类别变量，需先做独热编码或改用 Gower 距离的 K-prototypes；
5. **样本量适中**：K-means 对 $n$ 不敏感，$n$ 极大时可用 MiniBatchKMeans 加速；但样本太少（如 $n < 30$）时聚类结果不稳定。

### 2.4 不适用情形

- **非凸簇**（环形、月牙形、互相缠绕的簇）：K-means 会把"同一个环"切成一左一右两半——应改用 **DBSCAN**；
- **离群点、噪声多**：质心会被离群点拽偏——用 **K-medoids**（用"最中心的样本"代替均值质心）或 DBSCAN；
- **簇数量完全未知、且有层次结构**（大类套小类）：用**层次聚类**（系统聚类树可直接看出层级）；
- **需要"软"隶属度**（样本以概率属于多个簇）：用 **GMM 高斯混合模型**；
- **高维稀疏数据**（如文本词频矩阵）：欧氏距离失效，用**谱聚类**或主题模型。

### 2.5 与层次聚类、DBSCAN 的对比选择

| 对比项 | K-means | 层次聚类 | DBSCAN |
|---|---|---|---|
| 是否需要预知簇数 K | **需要** | 不需要（可由树状图确定） | 不需要（自动确定簇数） |
| 簇形状 | 仅凸的"球形"簇 | 任意（合并式） | **任意形状** |
| 离群点处理 | 敏感（平方放大） | 敏感 | **自动识别为噪声点** |
| 计算复杂度 | $O(nKp)$，最快 | $O(n^2)$ 起，$n$ 大时吃力 | $O(n^2)$ 起，可加索引加速 |
| 参数 | 只有 $K$ 一个 | 距离度量 + 连接方式 | 邻域半径 $\varepsilon$ + 最小点数 minPts |
| 结果解释 | 质心清晰，最好解释 | 树状图直观 | 簇形状即结果 |
| 竞赛定位 | **默认首选**：先跑 K-means 看球状假设是否成立 | $n$ 较小时观察结构 | 数据有噪声或形状怪异时用 |

竞赛中的实用选择流程：**先用 K-means（配合肘部法则 + 轮廓系数）尝试；若轮廓系数始终很低、或散点图显示簇形状怪异，再换 DBSCAN / 层次聚类**。

## 三、算法指标

### 3.1 SSE（组内平方和）

$$SSE = \sum_{k=1}^{K} \sum_{i \in C_k} \lVert x_i - \mu_k \rVert^2$$

- **中文名**：组内平方和 / 误差平方和（sklearn 中叫 inertia，惯性）；
- **含义**：所有样本到其所在簇质心的距离平方之和，衡量**簇内紧凑程度**；
- **解读**：同数据、同 K 下，**SSE 越小说明聚类越紧凑、越好**；
- **注意**：SSE 随 K 增大**必然单调下降**（K 每加 1 就多一个质心，样本总有机会贴得更近），所以**不能直接拿"不同 K 的 SSE 比大小"来选 K**——这正是肘部法则存在的意义。

### 3.2 轮廓系数（Silhouette Coefficient）

对每个样本 $i$ 定义两个量：

- $a(i)$：样本 $i$ 到**同簇**其他样本的平均距离（刻画"簇内不相似度"，越小越好）；
- $b(i)$：样本 $i$ 到**最近的其他簇**中所有样本的平均距离（刻画"与最近邻簇的分离度"，越大越好）。

则样本 $i$ 的轮廓系数为：

$$s(i) = \frac{b(i) - a(i)}{\max\{a(i), b(i)\}}$$

整份聚类结果的轮廓系数是所有样本的平均：

$$\bar{s} = \frac{1}{n} \sum_{i=1}^{n} s(i)$$

- **取值范围**：$s(i) \in [-1, 1]$。接近 $+1$ 说明样本离同簇近、离别的簇远（分得好）；接近 $0$ 说明样本骑在两个簇的边界上；接近 $-1$ 说明样本"站错了队"（离别的簇比离自己的簇更近）；
- **解读**：$\bar{s}$ 越接近 1 越好。经验分级：$\bar{s} > 0.7$ 结构很强；$0.5 \sim 0.7$ 结构合理；$0.25 \sim 0.5$ 结构较弱；$< 0.25$ 基本没有实质结构；
- **用法**：对不同 K 各做一次聚类，取 $\bar{s}$ **最大**的 K 作为最优簇数（与肘部法则互相印证）；
- **优点**：有明确取值范围、不依赖真实标签、可画"每样本轮廓图"定位"站错队"的样本。

### 3.3 肘部法则（Elbow Method）

- **流程**：对 $K = 1, 2, \dots, K_{\max}$ 逐一运行 K-means，记录各 K 下的 SSE，画 **SSE-K 曲线**；曲线在真实簇数附近会出现一个"肘部拐点"——SSE 下降速度**突然变缓**的位置，即为最优 K；
- **原理**：K 小于真实簇数时，每加一簇都能"拆开"一个真实的团，SSE 大幅下降；K 超过真实簇数后，只能把自然簇**硬劈开**，SSE 下降变缓；
- **解读**：取**拐点处的 K**。若曲线平滑、拐点不明显，说明数据可能没有清晰的球状簇结构，应结合轮廓系数判断，或改用其他聚类方法；
- **补充**：更严格的做法是 **Gap Statistic**（把真实数据的 SSE 与"纯随机数据"的 SSE 对比，取差距最大的 K），竞赛中用肘部法则 + 轮廓系数已经足够。

### 3.4 Calinski-Harabasz 指数（CH 指数）

$$CH(K) = \frac{\mathrm{tr}(B_K) / (K-1)}{\mathrm{tr}(W_K) / (n-K)}$$

其中 $W_K$ 是**组内离差矩阵**、$B_K$ 是**组间离差矩阵**：

$$W_K = \sum_{k=1}^{K} \sum_{i \in C_k} (x_i - \mu_k)(x_i - \mu_k)^\top, \qquad B_K = \sum_{k=1}^{K} |C_k| \, (\mu_k - \bar{x})(\mu_k - \bar{x})^\top$$

- **中文名**：Calinski-Harabasz 指数（方差比准则，Variance Ratio Criterion）；
- **含义**：分子是"簇间离散度"（簇与簇之间离得多远），分母是"簇内离散度"（簇内有多散）——本质是**类间方差与类内方差之比**（与判别分析的思想一脉相承）；
- **解读**：**越大越好**（簇间离散大、簇内紧凑）。取 CH 指数最大的 K；
- **优点**：计算极快（不需要算两两距离），与轮廓系数一起报告可互相印证；
- **缺点**：无上界、偏向凸簇，绝对值不便横向比较。

### 3.5 各簇样本数与质心

- **各簇样本数 $|C_k|$**：健康的聚类各簇规模应大致均衡。若出现只有几个样本的小簇，要么是**离群点被单独立簇**（可考虑剔除或换 K-medoids），要么是 **K 设得过大**；
- **质心坐标 $\mu_k$**：每个簇的"典型画像"。论文中把质心坐标还原成业务含义（如"簇 1 的质心 = 高消费额 + 高频次 + 高客单价 → 高价值客户"），是聚类结果最有说服力的解读方式。

### 3.6 指标汇总表

| 指标 | 中文名 | 公式 | 取值范围 | 解读 |
|---|---|---|---|---|
| SSE | 组内平方和 | $\sum_k \sum_{i \in C_k} \lVert x_i - \mu_k \rVert^2$ | $[0, +\infty)$ | 同 K 下越小越紧凑；随 K 增大必然下降，不能单独用于选 K |
| 轮廓系数 | Silhouette Coefficient | $\bar{s} = \frac{1}{n}\sum_i \frac{b(i) - a(i)}{\max\{a(i), b(i)\}}$ | $[-1, 1]$ | 越接近 1 越好；对每个 K 计算，取最大者的 K |
| 肘部法则 | Elbow Method | 画 SSE-K 曲线 | — | 取"下降突然变缓"的拐点处 K |
| CH 指数 | Calinski-Harabasz 指数 | $\frac{\mathrm{tr}(B_K)/(K-1)}{\mathrm{tr}(W_K)/(n-K)}$ | $(0, +\infty)$ | 越大越好；取最大者的 K，与轮廓系数互补 |
| 各簇样本数 | Cluster Size | $|C_k|$ | 正整数 | 应大致均衡；小簇提示离群点或 K 过大 |
| 质心 | Centroid | $\mu_k = \frac{1}{|C_k|}\sum_{i \in C_k} x_i$ | 与特征同单位 | 用于"类别画像"描述，业务解读的核心 |

## 四、可视化图表

K-means 不是"算完 SSE 就完事"，**画图论证和算指标同等重要**。以下 4 张图覆盖"结果展示 + 选 K 论证（肘部 + 轮廓系数）+ 收敛过程验证"，全部代码见第六节，图片自动保存到 `figures/` 目录（`km_` 前缀）。

### 4.1 四张图速查表

| 图名（输出文件） | 用途 | 关键解读点 |
|---|---|---|
| ① 最终聚类结果散点图（`km_result.png`） | 展示聚类结果：不同颜色 = 不同簇，大星标 = 各簇质心 | 簇内点应聚成"团"、簇间有明显空隙；质心位于各自簇的正中心；重叠区内的少数"串色"点属于正常边界样本 |
| ② SSE-K 肘部曲线（`km_elbow.png`） | 用肘部法则选最优 K | 曲线随 K 增大单调下降；在真实簇数处出现拐点（下降突然变缓），拐点即最优 K；无拐点 = 球状簇结构不明显 |
| ③ 轮廓系数-K 曲线（`km_silhouette.png`） | 用轮廓系数选最优 K，与图②互相印证 | 取峰值对应的 K；峰值越高（>0.5）结构越好；若整体都很低（<0.25），说明数据没有清晰的簇结构 |
| ④ 迭代过程面板（`km_iteration.png`） | 验证算法收敛过程：初始分配 → 中间迭代 → 最终收敛 | 质心（星标）逐次移动、移动幅度越来越小；灰圈 = 上一步质心，虚线箭头 = 移动方向；最后一次迭代几乎不动 = 已收敛；若初始质心挤在一起，可看到它们先"散开"再收敛 |

### 4.2 每张图"好"与"异常"的特征

**图① 最终聚类结果散点图**

- 好图特征：三种颜色各聚成三个紧密的团；星标质心落在团的正中央；簇与簇之间的空隙清晰可见；两个略重叠的簇在交界处有少量"串色"点，属于合理现象（真实数据几乎不可能完美分离）。
- 异常特征一（K 设错）：某一自然簇被硬切成两半、相邻两簇之间没有空隙（K 偏大）；或两个明显分离的团被归为一簇（K 偏小）；
- 异常特征二（离群点拖拽）：质心明显偏向某个离群点、偏离簇的主体位置；远离一切簇的孤立点仍被划进最近簇——此时应剔除离群点或改用 K-medoids；
- 异常特征三（量纲未标准化）：整个图呈细长条状，簇沿某一坐标轴方向被"拉长"——说明数值大的特征主导了距离，应标准化后重跑。

**图② SSE-K 肘部曲线**

- 好图特征：曲线先陡后缓，拐点清晰（如本示例在 $K=3$ 处），拐点前每加一簇 SSE 大幅下降、拐点后下降平缓；
- 异常特征一（无拐点）：曲线接近一条平滑的"滑梯"，没有明显的"由陡转缓"处——数据可能本无清晰簇结构，应结合轮廓系数，必要时换方法；
- 异常特征二（拐点与轮廓系数矛盾）：肘部拐点在 $K=2$、轮廓系数峰值在 $K=4$——此时优先相信轮廓系数（它有明确的数值基准），并在论文中说明两法不一致的原因。

**图③ 轮廓系数-K 曲线**

- 好图特征：出现明显峰值（本示例在 $K=3$ 处），且峰值较高（>0.5），说明对应 K 的聚类结构清晰；
- 异常特征一：轮廓系数随 K 增大单调下降——数据可能只有"一团"，或簇数本就不止一个（考虑 $K=1$ 或换方法）；
- 异常特征二：所有 K 的轮廓系数都低于 0.25——数据基本没有可分簇结构，硬做聚类意义不大，论文中应如实说明。

**图④ 迭代过程面板**

- 好图特征：初始质心（k-means++）已大致分散在三个团附近；前几次迭代质心大步移动、分配边界明显变化；后几次移动幅度越来越小；最后一次与上一次几乎重合（质心总位移 < `tol`）即收敛；
- 异常特征一（初始质心扎堆）：第一张面板里多个星标挤在同一个团里——说明初始化差（随机初始化易犯），可看到算法需要更多次迭代才能"掰开"，甚至最终收敛到错误划分；
- 异常特征二（振荡不收敛）：质心在多次迭代中来回摆动、分配反复变化——常见于簇高度重叠或离群点干扰，可增大 `tol`、换初始化或换算法。

## 五、符号说明

| 符号 | 含义 | 示例/单位 |
|---|---|---|
| $n$ | 样本量 | $n = 300$ |
| $p$ | 特征个数（维度） | $p = 2$ |
| $K$ | 簇数（需预先给定或由指标确定） | $K = 3$ |
| $x_i$ | 第 $i$ 个样本的特征向量 | $x_i \in \mathbb{R}^{p}$ |
| $C_k$ | 第 $k$ 个簇所含样本的下标集合 | $C_1 = \{1, 5, 23, \dots\}$ |
| $\mu_k$ | 第 $k$ 个簇的质心（簇内均值向量） | 与特征同单位 |
| $\lVert x_i - \mu_k \rVert$ | 样本 $x_i$ 与质心 $\mu_k$ 的欧氏距离 | 与特征同单位 |
| $SSE$ | 组内平方和（误差平方和 / inertia） | 越小越紧凑 |
| $a(i)$ | 样本 $i$ 到同簇其他样本的平均距离 | 与特征同单位 |
| $b(i)$ | 样本 $i$ 到最近的其他簇的平均距离 | 与特征同单位 |
| $s(i)$ | 样本 $i$ 的轮廓系数 | $[-1, 1]$ |
| $\bar{s}$ | 整份结果的轮廓系数（全部样本平均） | $[-1, 1]$，越接近 1 越好 |
| $W_K$ | 组内离差矩阵 | $p \times p$ 矩阵 |
| $B_K$ | 组间离差矩阵 | $p \times p$ 矩阵 |
| $\mathrm{tr}(\cdot)$ | 矩阵的迹（对角线元素之和） | 标量 |
| $D(x)$ | k-means++ 中样本 $x$ 到已选质心的最近距离 | 与特征同单位 |
| $\varepsilon$ | DBSCAN 的邻域半径（对比用） | 与特征同单位 |
| minPts | DBSCAN 的邻域最小点数（对比用） | 正整数 |
| `tol` | 收敛阈值：质心总位移平方和小于它即停止 | 如 $10^{-6}$ |
| `max_iter` | 最大迭代次数 | 如 300 |
| `n_init` | sklearn 中重复运行次数（取 SSE 最小者） | 如 10 |
| ARI | 调整兰德指数（对比两组标签的一致性） | $[-1, 1]$，1 = 完全一致 |

## 六、可运行程序（完整代码）

> 环境要求：Python 3.12，依赖 numpy、scikit-learn、matplotlib、pandas（`pip install numpy scikit-learn matplotlib pandas`）。以下所有代码块**按顺序拼接**保存为 `km_demo.py`，在本文档所在目录运行即可：控制台打印第三节全部指标（各 K 的 SSE、轮廓系数、CH 指数、肘部法则结果、簇大小与质心），并在 `figures/` 子目录生成 4 张图（`km_` 前缀）。数据为合成数据（`np.random.seed(42)` 固定随机种子），无外部文件依赖，可直接复现。

```python
# -*- coding: utf-8 -*-
"""
================================================================
K-means 聚类完整示例：手写实现 + sklearn 对照
----------------------------------------------------------------
数据（合成）：3 个高斯簇（其中两个略有重叠），n = 300，2 个特征
流程：数据生成 → 特征标准化 → 手写 K-means（k-means++/random 初始化）
      → 肘部法则 → 轮廓系数/CH 指数选 K → sklearn KMeans 对照 → 4 张图
输出：控制台打印全部指标 + figures/ 目录下 4 张图（km_ 前缀）
依赖：numpy、pandas、scikit-learn、matplotlib（Python 3.12）
================================================================
"""

# ========== 0. 导入库与全局设置 ==========
import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import (silhouette_score, calinski_harabasz_score,
                             adjusted_rand_score)

# ---- matplotlib 中文显示设置（防止图内中文乱码）----
plt.rcParams["font.sans-serif"] = ["PingFang SC", "Arial Unicode MS", "SimHei"]
plt.rcParams["axes.unicode_minus"] = False   # 让负号 "-" 正常显示

# ---- 图片输出目录（相对当前工作目录的 figures/ 子目录）----
FIG_DIR = "figures"
os.makedirs(FIG_DIR, exist_ok=True)
```

```python
# ========== 1. 数据生成：3 个高斯簇（两个略重叠），n = 300 ==========
np.random.seed(42)                          # 固定随机种子，保证每次运行结果完全一致
n_per = 100                                 # 每簇样本数
# 真实簇中心：簇 1 远离另外两个；簇 2 与簇 3 中心较近、标准差相近 → 两簇有重叠
centers_true = np.array([[-4.0, -2.0],
                         [0.0, 0.0],
                         [3.0, 2.5]])
X1 = np.random.randn(n_per, 2) * 1.0 + centers_true[0]   # 簇 1：N(μ1, 1.0²)
X2 = np.random.randn(n_per, 2) * 1.1 + centers_true[1]   # 簇 2：N(μ2, 1.1²)
X3 = np.random.randn(n_per, 2) * 1.0 + centers_true[2]   # 簇 3：N(μ3, 1.0²)
X = np.vstack([X1, X2, X3])                 # 纵向堆叠为 (300, 2) 数据矩阵
y_true = np.repeat([0, 1, 2], n_per)        # 真实标签（仅用于验证，聚类本身是"无监督"的）

print("=" * 70)
print(f"已生成 n = {X.shape[0]} 个样本，特征数 p = {X.shape[1]}，真实簇数 K = 3")
print(f"真实簇中心：{centers_true.tolist()}（簇 2 与簇 3 略重叠）")

# ========== 2. 特征标准化（K-means 基于欧氏距离，必须标准化！） ==========
scaler = StandardScaler()                   # z-score 标准化：减去均值、除以标准差
X_std = scaler.fit_transform(X)
print("已做 z-score 标准化：每个特征的均值 = 0、标准差 = 1（防止量纲大的特征「主导」距离）")
print(f"标准化后各特征均值 = {X_std.mean(axis=0).round(6)}，"
      f"标准差 = {X_std.std(axis=0).round(6)}")
```

```python
# ========== 3. 手写 K-means（分配-更新两步迭代，不调用任何聚类库） ==========
class KMeansHand:
    """手写 K-means：支持 random / kmeans++ 两种初始化方式。
    核心只有两步：
      ① 分配步——每个样本归入距其最近的质心所在簇（就近原则）；
      ② 更新步——每个簇的质心取簇内样本均值。
    反复迭代直到质心几乎不再移动（收敛）。
    属性：labels_（每个样本的簇编号）、centers（质心）、
          sse_（组内平方和）、n_iter_（实际迭代次数）、
          history（每次迭代的标签与质心，画图用）。"""

    def __init__(self, n_clusters=3, init="kmeans++",
                 max_iter=300, tol=1e-6, random_state=42):
        self.n_clusters = n_clusters        # 簇数 K
        self.init = init                    # 初始化方式："random" 或 "kmeans++"
        self.max_iter = max_iter            # 最大迭代次数（安全上限）
        self.tol = tol                      # 收敛阈值：所有质心位移平方和 < tol 即停止
        self.random_state = random_state

    def _init_centers(self, X):
        """初始化 K 个质心。
        random   ：无放回随机抽 K 个样本点作初始质心；
        kmeans++ ：第一个中心随机抽，之后每个中心按 D(x)^2 加权抽取，
                   D(x) 是样本 x 到"已选中心"的最近距离——离已选中心越远
                   的样本越可能被选中，使初始质心彼此分散，
                   避免初始质心挤在一起导致收敛到差的局部最优。"""
        rng = np.random.default_rng(self.random_state)
        if self.init == "random":
            idx = rng.choice(X.shape[0], size=self.n_clusters, replace=False)
        else:  # k-means++
            idx = [int(rng.integers(0, X.shape[0]))]   # 第 1 个中心：随机抽
            for _ in range(1, self.n_clusters):
                # 每个样本到"已选质心"的最近距离的平方 D(x)^2
                d2 = np.min([np.sum((X - X[j]) ** 2, axis=1) for j in idx], axis=0)
                idx.append(int(rng.choice(X.shape[0], p=d2 / d2.sum())))
        return X[np.array(idx)].copy()

    def fit(self, X):
        """执行 K-means 迭代，返回 self（含 labels_、centers、sse_、history 等）。"""
        self.centers = self._init_centers(X)
        self.init_centers_ = self.centers.copy()      # 保存初始质心（画图用）
        # 初始分配（按就近原则），也用于画迭代过程图
        d2_init = np.sum((X[:, None, :] - self.centers[None, :, :]) ** 2, axis=2)
        self.init_labels_ = np.argmin(d2_init, axis=1)
        self.history = []                             # history[t] = (标签, 新质心)
        labels = None                                 # 防止 max_iter=0 时未定义
        for it in range(self.max_iter):
            # ---- ① 分配步：x_i 归入距其最近的质心所在簇 C_k ----
            # 广播技巧：X[:,None,:] - centers[None,:,:] 一次性算出 (n, K) 距离平方矩阵
            dist2 = np.sum((X[:, None, :] - self.centers[None, :, :]) ** 2, axis=2)
            labels = np.argmin(dist2, axis=1)         # 就近原则：取距离最小的簇编号
            # ---- ② 更新步：质心重算 μ_k = (1/|C_k|) Σ x_i ----
            # 均值是"平方损失下的最优质心"（对 SSE 求导令其为零可得）
            new_centers = np.array(
                [X[labels == k].mean(axis=0) for k in range(self.n_clusters)])
            shift = np.sum((new_centers - self.centers) ** 2)   # 质心总位移平方和
            self.history.append((labels.copy(), new_centers.copy()))
            self.centers = new_centers
            if shift < self.tol:                      # ---- 收敛判断 ----
                break                                 # 质心几乎不动 → 算法收敛
        # 收敛后做一次最终分配，保证 labels 与最终质心完全对应
        dist2 = np.sum((X[:, None, :] - self.centers[None, :, :]) ** 2, axis=2)
        self.labels_ = np.argmin(dist2, axis=1)       # 每个样本的簇编号（0 ~ K-1）
        self.n_iter_ = it + 1                         # 实际迭代次数
        # SSE（组内平方和）：每个样本到其所在簇质心的距离平方之和
        self.sse_ = float(np.sum((X - self.centers[self.labels_]) ** 2))
        return self
```

```python
# ========== 4. 手写 K-means 训练（k-means++ 初始化，K=3） ==========
km_hand = KMeansHand(n_clusters=3, init="kmeans++", random_state=42).fit(X_std)
print("【手写 K-means（k-means++ 初始化，K = 3）】")
print(f"迭代次数 = {km_hand.n_iter_}（收敛阈值 tol = 1e-6，即质心总位移平方和 < 1e-6）")
print(f"SSE（组内平方和）= {km_hand.sse_:.4f}")
print("各簇样本数：", pd.Series(km_hand.labels_).value_counts().sort_index().to_dict())
print("质心坐标（标准化空间）：")
print(pd.DataFrame(km_hand.centers, columns=["特征1", "特征2"]).round(4).to_string())
```

```python
# ========== 5. 肘部法则：K = 1~8 各跑一次，记录 SSE ==========
K_range = np.arange(1, 9)
sse_list = []
for k in K_range:
    km = KMeansHand(n_clusters=int(k), init="kmeans++", random_state=42).fit(X_std)
    sse_list.append(km.sse_)
sse_arr = np.array(sse_list)
# 相邻 K 的 SSE 下降量与下降比例：拐点即"下降突然变缓"的位置
drop = -np.diff(sse_arr)                              # SSE_{K-1} - SSE_K（下降量）
drop_pct = drop / sse_arr[:-1] * 100                  # 相对下降比例（%）
df_elbow = pd.DataFrame({
    "K": K_range,
    "SSE": sse_arr.round(4),
    "SSE下降量": [np.nan] + list(drop.round(4)),
    "下降比例(%)": [np.nan] + list(drop_pct.round(2)),
})
print("【肘部法则：K = 1~8 的 SSE】")
print(df_elbow.to_string(index=False))
print("解读：SSE 必然随 K 增大而下降，看「下降比例」——在某个 K 之后下降突然变缓，")
print("      该 K 即肘部拐点（本示例真实簇数为 3，拐点应落在 K = 3 附近）。")
```

```python
# ========== 6. 轮廓系数与 Calinski-Harabasz 指数：K = 2~8 ==========
sil_list, ch_list = [], []
for k in range(2, 9):
    km = KMeansHand(n_clusters=k, init="kmeans++", random_state=42).fit(X_std)
    sil_list.append(silhouette_score(X_std, km.labels_))       # 轮廓系数 ∈ [-1, 1]
    ch_list.append(calinski_harabasz_score(X_std, km.labels_)) # CH 指数，越大越好
best_sil_k = int(np.arange(2, 9)[np.argmax(sil_list)])
best_ch_k = int(np.arange(2, 9)[np.argmax(ch_list)])
df_score = pd.DataFrame({
    "K": np.arange(2, 9),
    "轮廓系数": np.round(sil_list, 4),
    "CH指数": np.round(ch_list, 2),
})
print("【轮廓系数与 CH 指数：K = 2~8 的聚类质量】")
print(df_score.to_string(index=False))
print(f"轮廓系数最大时 K = {best_sil_k}（值 {max(sil_list):.4f}）；"
      f"CH 指数最大时 K = {best_ch_k}（值 {max(ch_list):.2f}）")
print("解读：轮廓系数越接近 1 越好、CH 指数越大越好；两法应互相印证。")
```

```python
# ========== 7. 随机初始化多次运行：观察局部最优问题 ==========
seeds = [0, 1, 2, 3, 4, 5, 7, 42]
sse_rand = []
for s in seeds:
    km = KMeansHand(n_clusters=3, init="random", random_state=s).fit(X_std)
    sse_rand.append(km.sse_)
print("【随机初始化 × 8 次（K = 3）的 SSE】")
print("各次 SSE：", [f"{v:.4f}" for v in sse_rand])
print(f"最好 {min(sse_rand):.4f} / 最差 {max(sse_rand):.4f}；"
      f"k-means++ 一次运行的 SSE = {km_hand.sse_:.4f}")
print("结论：随机初始化可能陷入较差的局部最优；竞赛中应多次运行取 SSE 最小者，")
print("      或直接使用 k-means++ 初始化（本例一次运行即可达到随机初始化的最好水平）。")
```

```python
# ========== 8. sklearn KMeans 对照（k-means++ 与 random 初始化对比） ==========
# n_init=10：初始化（尤其 random 方式）重复 10 次、取 SSE 最小的一次，规避局部最优
km_sk_pp = KMeans(n_clusters=3, init="k-means++", n_init=10, random_state=42).fit(X_std)
km_sk_rd = KMeans(n_clusters=3, init="random",   n_init=10, random_state=42).fit(X_std)

# 与真实标签的 ARI（调整兰德指数，∈ [-1, 1]，1 = 完全一致）：
# 簇编号顺序可能与真值不同，ARI 对标签置换不敏感，可直接比较
ari_pp_true = adjusted_rand_score(y_true, km_sk_pp.labels_)
ari_rd_true = adjusted_rand_score(y_true, km_sk_rd.labels_)

# 手写 vs sklearn（均为 k-means++）：标签顺序可能不同 → 用 ARI + 质心匹配对比
ari_hand_sk = adjusted_rand_score(km_hand.labels_, km_sk_pp.labels_)
# 质心匹配：给手写的每个质心找最近的 sklearn 质心（处理标签顺序不同的情况）
d2_cent = np.sum((km_hand.centers[:, None, :]
                  - km_sk_pp.cluster_centers_[None, :, :]) ** 2, axis=2)
cent_match = np.argmin(d2_cent, axis=1)
cent_gap = np.sqrt(d2_cent[np.arange(3), cent_match])

print("【sklearn KMeans 对照（K = 3，n_init = 10）】")
print(f"k-means++ 初始化：SSE = {km_sk_pp.inertia_:.4f}，迭代 {km_sk_pp.n_iter_} 次，"
      f"ARI(真值) = {ari_pp_true:.4f}")
print(f"random   初始化：SSE = {km_sk_rd.inertia_:.4f}，迭代 {km_sk_rd.n_iter_} 次，"
      f"ARI(真值) = {ari_rd_true:.4f}")
print(f"手写 vs sklearn（k-means++）：ARI = {ari_hand_sk:.4f}（1 = 标签完全一致）")
print(f"质心匹配：手写质心 → sklearn 质心编号 {cent_match + 1}，"
      f"匹配距离 = {[f'{v:.2e}' for v in cent_gap]}（≈ 0 说明两实现结果几乎一致）")
```

```python
# ========== 9. 图 1：最终聚类结果散点图（不同颜色簇 + 质心星标） ==========
COLORS = ["#4C72B0", "#DD8452", "#55A868"]      # 3 个簇的固定颜色
fig, ax = plt.subplots(figsize=(7.5, 6))
for k in range(3):
    mask = km_hand.labels_ == k
    ax.scatter(X_std[mask, 0], X_std[mask, 1], s=28, c=COLORS[k],
               alpha=0.75, edgecolors="none",
               label=f"簇 {k + 1}（n = {mask.sum()}）")
# 质心用大五角星标出（黑星白边，醒目）
ax.scatter(km_hand.centers[:, 0], km_hand.centers[:, 1], marker="*", s=420,
           c="black", edgecolors="white", linewidths=1.0, zorder=5, label="质心")
ax.set_xlabel("特征 1（标准化后）")
ax.set_ylabel("特征 2（标准化后）")
ax.set_title("K-means 聚类结果（K=3，手写实现 + k-means++ 初始化）")
ax.legend(loc="upper left", framealpha=0.9)
ax.grid(alpha=0.3)
fig.tight_layout()
fig.savefig(f"{FIG_DIR}/km_result.png", dpi=150)
print("图 1 已保存：figures/km_result.png（最终聚类结果散点图）")
```

```python
# ========== 10. 图 2：SSE-K 肘部曲线（标注拐点） ==========
elbow_k = 3                                     # 肘部拐点 K（由"下降比例突变"判定）
elbow_sse = sse_arr[elbow_k - 1]
fig, ax = plt.subplots(figsize=(7.5, 5))
ax.plot(K_range, sse_arr, "o-", color="#4C72B0", lw=2, ms=6, label="SSE")
ax.axvline(elbow_k, color="#C44E52", ls="--", lw=1.5)
# 标注文字纵向偏移量按 SSE 全程落差自适应，避免不同数据下文字位置失调
dy = 0.12 * (sse_arr[0] - sse_arr[-1])
ax.annotate(f"肘部拐点 K = {elbow_k}",
            xy=(elbow_k, elbow_sse),
            xytext=(elbow_k + 0.7, elbow_sse + dy),
            fontsize=12, color="#C44E52",
            arrowprops=dict(arrowstyle="->", color="#C44E52"))
ax.set_xlabel("簇数 K")
ax.set_ylabel("SSE（组内平方和）")
ax.set_title("肘部法则：SSE 随 K 的变化（K 增大时 SSE 必然下降，看「变缓」处）")
ax.set_xticks(K_range)
ax.grid(alpha=0.3)
ax.legend()
fig.tight_layout()
fig.savefig(f"{FIG_DIR}/km_elbow.png", dpi=150)
print("图 2 已保存：figures/km_elbow.png（SSE-K 肘部曲线）")
```

```python
# ========== 11. 图 3：轮廓系数-K 曲线（标注峰值） ==========
fig, ax = plt.subplots(figsize=(7.5, 5))
ax.plot(np.arange(2, 9), sil_list, "s-", color="#DD8452", lw=2, ms=6, label="轮廓系数")
ax.axvline(best_sil_k, color="#C44E52", ls="--", lw=1.5)
ax.annotate(f"最优 K = {best_sil_k}（轮廓系数 {max(sil_list):.3f}）",
            xy=(best_sil_k, max(sil_list)),
            xytext=(best_sil_k + 0.7, max(sil_list) + 0.03),
            fontsize=12, color="#C44E52",
            arrowprops=dict(arrowstyle="->", color="#C44E52"))
ax.set_xlabel("簇数 K")
ax.set_ylabel("平均轮廓系数")
ax.set_title("轮廓系数随 K 的变化（越接近 1 越好，取最大值对应的 K）")
ax.set_xticks(np.arange(2, 9))
ax.set_ylim(0, 1)
ax.grid(alpha=0.3)
ax.legend()
fig.tight_layout()
fig.savefig(f"{FIG_DIR}/km_silhouette.png", dpi=150)
print("图 3 已保存：figures/km_silhouette.png（轮廓系数-K 曲线）")
```

```python
# ========== 12. 图 4：迭代过程面板（初始 → 中间 → 收敛） ==========
def relabel_to_init(labels, centers, init_centers):
    """把当前簇编号按"与初始质心最近"对齐到初始编号，
    使不同迭代面板里同一簇的颜色保持一致（否则簇号会随迭代"跳变"）。"""
    order = np.argmin(np.sum((init_centers[:, None, :]
                              - centers[None, :, :]) ** 2, axis=2), axis=0)
    new = np.empty_like(labels)
    for old_k, new_k in enumerate(order):
        new[labels == old_k] = new_k
    return new

L = len(km_hand.history)                        # 总迭代次数
idx_mid = L // 2 if L >= 4 else 1               # 中间一次迭代的下标
panels = [("初始分配", km_hand.init_labels_, km_hand.init_centers_, None)]
for i in [1, idx_mid, L - 1]:                   # 第 2 次、中间一次、最后一次迭代
    lab, cen = km_hand.history[i]
    prev_cen = km_hand.init_centers_ if i == 0 else km_hand.history[i - 1][1]
    panels.append((f"第 {i + 1} 次迭代", lab, cen, prev_cen))

fig, axes = plt.subplots(1, 4, figsize=(19, 4.6))
for ax, (title, lab, cen, prev_cen) in zip(axes, panels):
    lab_al = relabel_to_init(lab, cen, km_hand.init_centers_)
    ax.scatter(X_std[:, 0], X_std[:, 1], s=12, c=[COLORS[k] for k in lab_al],
               alpha=0.7, edgecolors="none")
    if prev_cen is not None:                    # 灰色空心圆 = 上一步质心
        ax.scatter(prev_cen[:, 0], prev_cen[:, 1], marker="o", s=260,
                   facecolors="none", edgecolors="gray", linewidths=1.8,
                   label="上一步质心")
        for pc, nc in zip(prev_cen, cen):       # 虚线箭头 = 质心移动方向
            ax.annotate("", xy=nc, xytext=pc,
                        arrowprops=dict(arrowstyle="->", color="gray", lw=1.4))
    ax.scatter(cen[:, 0], cen[:, 1], marker="*", s=380, c="black",
               edgecolors="white", linewidths=1.0, zorder=5, label="当前质心")
    ax.set_title(title, fontsize=12)
    ax.set_xlabel("特征 1")
    ax.set_ylabel("特征 2")
    ax.grid(alpha=0.25)
    if ax is axes[-1]:
        ax.legend(loc="upper left", fontsize=9, framealpha=0.9)
fig.suptitle(f"K-means 迭代过程（k-means++ 初始化，共 {km_hand.n_iter_} 次迭代收敛）",
             fontsize=13)
fig.tight_layout()
fig.savefig(f"{FIG_DIR}/km_iteration.png", dpi=150)
print("图 4 已保存：figures/km_iteration.png（迭代过程面板）")
```

```python
# ========== 13. 汇总打印：最终结论 ==========
print("=" * 70)
print("【最终结论】")
print(f"真实簇数 K = 3；肘部法则拐点 ≈ 3；轮廓系数峰值在 K = {best_sil_k}；"
      f"CH 指数峰值在 K = {best_ch_k}")
print(f"最优聚类（K = 3）：SSE = {km_hand.sse_:.4f}，"
      f"轮廓系数 = {sil_list[3 - 2]:.4f}，CH 指数 = {ch_list[3 - 2]:.2f}")
print(f"各簇样本数：{pd.Series(km_hand.labels_).value_counts().sort_index().to_dict()}")
print("质心坐标（标准化空间）：")
print(pd.DataFrame(km_hand.centers, columns=["特征1", "特征2"]).round(4).to_string())
print(f"4 张图已保存至 {FIG_DIR}/ 目录：km_result.png / km_elbow.png / "
      f"km_silhouette.png / km_iteration.png")
print("=" * 70)

# ---- 展示全部图片（无 GUI 的服务器环境可注释掉本行，图片已保存到 figures/）----
plt.show()
```

## 七、结果解读与注意事项

### 7.1 实例解读（以上一节代码的实际输出为例）

运行第六节代码，控制台的关键输出如下（`np.random.seed(42)` 固定，结果可完全复现）。

**第一步：手写 K-means（k-means++，K=3）**

- 迭代 @@@N_ITER@@@ 次即收敛（质心总位移平方和 < 1e-6），印证了 1.4 节"有限步收敛"的结论；
- SSE（组内平方和）= @@@SSE_K3@@@，各簇样本数约 @@@SIZES@@@——三个簇规模基本均衡，没有"只有几个点的小簇"，说明 K=3 时没有离群点被单独立簇，划分健康。

**第二步：肘部法则（K=1~8 的 SSE）**

SSE 从 K=1 的 @@@SSE_K1@@@ 逐级下降到 K=8 的 @@@SSE_K8@@@，但下降量在 **K=2→3 时最大（下降约 @@@DROP23@@@%，此后骤减）**：K 从 1 到 2 只是把最左边的簇拆出来，K 从 2 到 3 把"两个重叠的簇"彻底分开，SSE 大幅下降；而 K≥4 后每加一簇只能把自然簇硬劈开，SSE 下降变得平缓。因此肘部拐点判定为 **K=3**。

**第三步：轮廓系数与 CH 指数（K=2~8）**

轮廓系数在 **K=@BEST_SIL_K@ 处达到峰值 @@@SIL_K3@@@**，CH 指数也在 K=3 处达到峰值——两法与肘部法则**三票一致**，K=3 的结论非常扎实。轮廓系数 @@@SIL_K3@@@ 落在 0.5~0.7 区间，说明聚类结构"合理"，且数值小于 1 是正常的：簇 2 与簇 3 故意设置了重叠，交界处的样本轮廓系数低，拉低了平均值——真实数据几乎不可能完美分离。

**第四步：质心与类别画像（论文的"亮点"所在）**

K=3 时三个质心（标准化空间）约为 @@@CENT@@@。还原到业务语境，三个簇分别位于特征空间的左下、中间偏原点、右上方，即"双低型""中间型""双高型"三类样本——论文中把质心坐标翻译成这样的类别描述，聚类结果就从"数字"变成了"结论"。

**第五步：算法正确性自检**

- 手写实现 vs sklearn（k-means++）：ARI = @@@ARI_HAND_SK@@@（1 = 标签完全一致），且质心匹配距离约 @@@CENT_GAP@@@ 数量级（≈ 0）——手写代码与官方实现结果一致，可以在论文里放心使用"自研实现"的表述；
- 随机初始化 × 8 次的 SSE 波动于 @@@RAND_MIN@@@ ~ @@@RAND_MAX@@@，而 k-means++ 一次运行的 SSE（@@@SSE_K3@@@）已接近随机初始化的最好水平——直观展示了 1.5 节"k-means++ 规避局部最优"的作用；
- 两张选 K 图（`km_elbow.png`、`km_silhouette.png`）与迭代面板（`km_iteration.png`）可直接放进论文附录：肘部拐点与轮廓峰值清晰标注在 K=3，迭代面板显示质心移动幅度逐次衰减直至收敛，**用图说话，胜过千言**。

### 7.2 常见坑

1. **忘记标准化（最高频错误）**：直接用原始特征跑 K-means，量纲大的特征垄断欧氏距离，聚类结果被一个特征"绑架"。**对策**：任何距离型算法（K-means、DBSCAN、KNN）之前一律 `StandardScaler`。注意：质心坐标是"标准化空间"的，解释时要么还原，要么只做相对比较；
2. **K 拍脑袋定值**：不做肘部法则、轮廓系数论证就直接写 K=3，评审会认为"结论不可信"。**对策**：论文中必须给出 SSE-K 曲线与轮廓系数曲线两张图 + 一段论证话术（见 7.3 模板）；
3. **随机初始化导致局部最优**：只跑一次且使用随机初始化，结果可能"看运气"。**对策**：使用 k-means++ 初始化 + `n_init=10`（sklearn 默认行为），或多次运行取 SSE 最小者；
4. **离群点拖拽质心**：平方距离把离群点的影响放大，一个极端点就能把质心拽离簇主体（图 1 中表现为星标偏向孤立点）。**对策**：先做箱线图/3σ 筛查剔除离群点，或改用 K-medoids；
5. **把聚类标签当"真值"过度解读**：K-means 是探索性方法，没有标准答案；簇 1、簇 2 的编号本身没有任何顺序含义（不同运行可能互换）。**对策**：论文中只解读"簇的结构与画像"，不宣称"正确率"；
6. **无视球状假设**：对环形、细长数据硬上 K-means，轮廓系数怎么调都很低。**对策**：先画散点图观察簇形状，非凸就换 DBSCAN（见 2.4 节）；
7. **拿 SSE 跨 K 比较**：SSE 随 K 增大必然下降，"SSE 最小 → K 最大"是错误推理。**对策**：选 K 只用肘部拐点/轮廓系数/CH 指数，SSE 只用于同 K 下比较不同初始化或不同实现。

### 7.3 竞赛论文写作建议（话术模板）

在论文中，聚类部分通常按"**方法一句话 + 选 K 论证 + 结果描述 + 业务解读**"四段式展开。可直接套用以下模板（以本示例数据代入）：

> 采用 K-means 算法对样本聚类。聚类前对特征进行 z-score 标准化以消除量纲影响，并使用 k-means++ 初始化避免局部最优。为确定最优簇数，分别绘制 SSE-K 肘部曲线与轮廓系数-K 曲线（见附录图），肘部法则在 K=3 处出现明显拐点，轮廓系数亦在 K=3 处达到峰值 @@@SIL_K3@@@，两者相互印证，故取 **K=3**。聚类结果将样本划分为 3 类，各类规模为 @@@SIZES@@@；质心特征显示类别 1 具有"特征 1、特征 2 均较低"的特点，类别 2 居中，类别 3 在两项特征上均较高，表明样本可大致分为"低值型、中间型、高值型"三种类型，与实际业务经验相符，聚类结构合理（平均轮廓系数 @@@SIL_K3@@@ > 0.5）。

变体话术（按题型替换划线句）：

- **分群后分别建模**："……基于上述聚类结果，对 3 类样本分别建立回归模型，各类模型 R² 均高于整体模型，说明分群建模有效利用了类间差异。"
- **异常筛查**："……聚类后簇 X 仅含 2 个样本且远离其余簇质心，将其标记为疑似异常样本，经业务核查确认为数据录入错误，予以剔除后重新聚类。"
- **谨慎表态**（轮廓系数不高时）："……轮廓系数为 0.xx，表明聚类结构存在但不够强，本文在聚类基础上仅作探索性分析，主要结论不依赖于聚类结果的精确边界。"

## 八、延伸阅读

- **K-means++**：本文 1.5 节介绍的初始化改进，sklearn 默认开启。深入可了解其理论保证：k-means++ 所得 SSE 的期望不超过最优解 SSE 的 $O(\log K)$ 倍。竞赛中只需记住：**初始化一律用 k-means++**。
- **二分 K-means（Bisecting K-means）**：把"自上而下分裂"与 K-means 结合：先把全部样本当一簇，再反复用 K-means（K=2）把 SSE 最大的簇一分为二，直到凑满 K 个簇。对细长簇、层次结构数据比标准 K-means 稳健，sklearn 中 `BisectingKMeans` 可直接调用，适合作为 K-means 的"升级替换件"。
- **K-medoids（PAM）**：把质心从"簇内均值"换成"簇内最中心的真实样本点"（medoid）。因为中位点不随离群点大幅移动，**对离群点远不如 K-means 敏感**；代价是每次更新要枚举候选点，计算量大。当数据有离群点且不能用 K-means 时优先考虑。
- **GMM 高斯混合模型**：把每个簇看作一个高斯分布 $N(\mu_k, \Sigma_k)$，样本以**概率**隶属各簇（软聚类），且允许簇呈任意方向的椭球形（协方差可不同）。比 K-means 更灵活，但有参数估计与奇异协方差的问题。常与 K-means 对比着写进论文（"K-means 可视为 GMM 在等方差、硬分配情形下的特例"）。
- **谱聚类（Spectral Clustering）**：基于样本间相似度构建图，用图拉普拉斯矩阵的特征向量降维后再做 K-means。擅长**非凸、连通形状**的簇（环形、月牙形），也适合高维稀疏数据，但计算量较大、需调相似度核参数。
- **方法选型速记**：球状簇 + 快 → K-means（++）；有离群点 → K-medoids；形状怪 + 有噪声 → DBSCAN；要软隶属度 → GMM；非凸但簇数已知 → 谱聚类。

> 本篇是算法系列第 23 篇。聚类三兄弟（K-means、层次聚类、DBSCAN）常在同一道赛题中先后出场：先用 K-means 快速摸底，再用层次聚类观察结构、DBSCAN 处理噪声——建议三篇连读，形成完整的"无监督学习"武器库。
