# DBSCAN聚类

> DBSCAN（Density-Based Spatial Clustering of Applications with Noise，基于密度的噪声应用空间聚类，1996 年 Ester 等人提出）是数学建模中"**按密度连点成片、自动挑出离群点**"的经典聚类算法。与 K-means 假定"簇是球状"不同，DBSCAN 能发现**任意形状**的簇（月牙形、环形、S 形都行），并且天然区分"簇内点"与"噪声点"。它是聚类三兄弟（K-means、层次聚类、DBSCAN）中唯一**不需要预先指定簇数**的方法，也是竞赛中处理"非凸分布 + 含离群点"数据时的第一选择。本文从原理、适用场景、评价指标、可视化诊断到可运行代码，完整梳理 DBSCAN 的竞赛实战用法。

## 一、算法含义

### 1.1 通俗理解

K-means 问的是"每个点离哪个**质心**最近"，而 DBSCAN 问的是"每个点周围**有多少邻居**"。它的直觉来自一个生活经验：**人多的地方是社区，落单的人是散客**。

想象一张朋友圈关系图：如果一个人有至少 `MinPts` 个朋友住在半径 `eps` 的范围内，他就是"核心人物"；围绕核心人物，把"朋友的朋友"一层层连起来，连成一片的就是一个簇（社区）；任何社区都挨不上的孤立者就是**噪声点**。DBSCAN 的全部逻辑就是这两句话——这就是为什么它既不需要预先给定簇数，又能顺便完成离群点检测。

### 1.2 基本定义：ε-邻域与三类点

设数据集为 $D = \{x_1, x_2, \dots, x_n\}$，$d(p, q)$ 为两点间距离（常用欧氏距离）。

**定义 1（ε-邻域）**：点 $p$ 的 $\varepsilon$-邻域是以 $p$ 为圆心、$\varepsilon$ 为半径的圆内所有样本：

$$N_\varepsilon(p) = \{ q \in D : d(p, q) \le \varepsilon \}$$

注意邻域**包含 $p$ 自身**（$d(p,p)=0$），所以 $|N_\varepsilon(p)| \ge 1$ 恒成立。

**定义 2（三类点）**：给定参数 $\varepsilon$ 和 $MinPts$，每个点被归为三类之一：

- **核心点（core point）**：邻域内点数不少于 $MinPts$，即 $|N_\varepsilon(p)| \ge MinPts$。核心点是"密度达标"的点，簇由核心点撑起来；
- **边界点（border point）**：自身不是核心点，但落在某个核心点的 $\varepsilon$-邻域内。边界点"挂在"簇的边缘，自己不发展新成员；
- **噪声点（noise point）**：既不是核心点，也不在任何核心点的邻域内。噪声点是"密度不达标且无人认领"的孤立点。

一个形象的比喻：核心点是**主干**，边界点是**枝叶**，噪声点是**杂草**——DBSCAN 修剪杂草的能力是它区别于 K-means 的核心竞争力。

### 1.3 密度直达、密度可达与密度相连

三个"密度关系"定义了什么是簇：

- **密度直达（directly density-reachable）**：若 $p$ 是核心点且 $q \in N_\varepsilon(p)$，则称 $q$ 由 $p$ 密度直达。注意该关系**不对称**：$q$ 是边界点/普通点时，$p$ 不一定由 $q$ 密度直达；
- **密度可达（density-reachable）**：存在一条链 $p_1, p_2, \dots, p_m$，其中 $p_1 = p$，$p_m = q$，且每个 $p_{i+1}$ 都由 $p_i$ 密度直达（链上 $p_1, \dots, p_{m-1}$ 都必须是核心点），则称 $q$ 由 $p$ 密度可达。可达性**不对称**（起点必须是核心点），但有**传递性**；
- **密度相连（density-connected）**：若存在核心点 $o$，使 $p$ 和 $q$ 都由 $o$ 密度可达，则称 $p$ 与 $q$ 密度相连。相连关系是**对称**的——这是"属于同一个簇"的严格定义。

$$p \text{ 与 } q \text{ 密度相连} \iff \exists \text{ 核心点 } o : \; o \Rightarrow p \;\text{ 且 }\; o \Rightarrow q$$

**簇的正式定义**：基于密度相连关系的**最大**密度相连点集。即一个簇 $C$ 满足：

$$\forall p, q \in C: p \text{ 与 } q \text{ 密度相连}；且若 p \in C, p \text{ 与 } q \text{ 密度相连} \Rightarrow q \in C$$

而不属于任何簇的点就是噪声。这正是"连点成片"的数学化表述。

### 1.4 算法流程（从核心点扩张簇）

DBSCAN 的执行过程非常简洁，用"队列扩张"（BFS）即可实现：

1. **算邻域**：对每个点 $p$ 计算其 $\varepsilon$-邻域 $N_\varepsilon(p)$ 的大小（朴素实现预先算好 $n \times n$ 距离矩阵，之后邻域查询只是查表）；
2. **标记核心点**：凡 $|N_\varepsilon(p)| \ge MinPts$ 的点标记为核心点，其余标记为非核心点；
3. **逐点扫描**：按任意顺序遍历所有未访问点 $p$：
   - 若 $p$ 不是核心点，暂时标为**噪声**（之后可能被认领为边界点）；
   - 若 $p$ 是核心点，**新建一个簇**，把 $N_\varepsilon(p)$ 中的点全部加入队列；
4. **队列扩张（BFS）**：从队列中弹出点 $q$：若 $q$ 之前是"噪声"，改标为**边界点**并收入当前簇；若 $q$ 未访问，收入当前簇；若 $q$ 也是核心点，再把 $N_\varepsilon(q)$ 中未访问的点压入队列。反复直到队列为空——此时所有与 $p$ 密度相连的点都被"连"进了同一个簇；
5. **收尾**：扫描完全部点后，仍标为噪声的点就是最终噪声点；簇编号 $1, 2, \dots, k$ 即聚类结果（sklearn 中簇编号从 0 开始、噪声记为 $-1$）。

整个流程只有两个参数（$\varepsilon$、$MinPts$），没有随机初始化，**同数据同参数结果完全确定**（这一点比 K-means 强：无需多次运行取最优）。朴素实现的时间复杂度为 $O(n^2)$（距离矩阵），用 kd-tree / ball-tree 空间索引可降到约 $O(n \log n)$。

### 1.5 参数选择：eps 与 MinPts

DBSCAN 成败几乎全在参数上，两个参数各有经验法则：

**MinPts 的选择**（相对容易）：

- 下限：$\ge$ 维度数 $+1$（$p$ 维数据至少 $p+1$，否则高维邻域失去意义）；
- 噪声环境：取 $2 \times p$ 更稳健；
- 经验公式：$\approx \ln(n)$。本例 $n=350$，$\ln 350 \approx 5.9$，取 $MinPts = 6$；
- 规律：**MinPts 越大，抗噪越强、得到的簇越"实在"**，但计算量也越大；一般取 4~10 之间即可。

**eps 的选择**（相对困难，用 **k-距离图**）：

k-距离图的步骤是：取 $k = MinPts - 1$，对每个点计算它到其**第 $k$ 近邻**的距离（记为 k-距离），再把全部 $n$ 个 k-距离**升序排序**画成曲线。曲线在"真实簇点"段平缓上升，进入"噪声点"段后**突然变陡**——这个拐点对应的距离就是合适的 eps：

- eps 取在**拐点处**：真实簇内点都能被连起来（其 k-距离都小于 eps），噪声点够不着任何簇（其 k-距离大于 eps），聚类"恰到好处"；
- eps 取**过小**：簇内点也连不起来，一个大簇碎成许多小簇，噪声漫天；
- eps 取**过大**：相邻的簇被桥接合并，甚至全部并成一个簇，噪声被吞掉。

直观理解：k-距离小说明"这附近很热闹"，k-距离大说明"这附近很荒凉"——拐点就是热闹与荒凉的分界线。本文第六节程序输出的 k-距离分位数与图②给出完整示范。

### 1.6 优缺点

**优点**：

- **能发现任意形状的簇**：月牙形、环形、S 形、细长带状都能正确识别，突破 K-means 的"球状簇"假设——这是 DBSCAN 最大的卖点；
- **自动识别噪声点**：不需要单独写离群检测，聚类的同时就把离群点挑出来（标签为噪声），一石二鸟；
- **不需要预先指定簇数**：簇数由数据密度结构自然涌现，避免了"K 拍脑袋"的问题；
- **对样本输入顺序不敏感**（只要参数固定，结果确定），没有随机初始化的困扰；
- **簇内不要求对称分布**：簇可以"粗细不均"，只要处处密度达标就能连成一片。

**缺点**：

- **对参数 eps 与 MinPts 高度敏感**：两个参数稍有变化，结果可能面目全非，必须借助 k-距离图等方法论证选参（见 1.5 节与第七节）；
- **难以处理密度差异大的数据**：全局只有一个 eps，稠密区域的簇和稀疏区域的簇无法同时适配——稠密区会被合并、稀疏区会被当成噪声（改进方案见第八节 OPTICS）；
- **高维数据基本失效**："维数灾难"使高维空间中距离都差不多，邻域/密度概念失去区分度（一般 $p$ 超过几十维就应降维或换方法）；
- **距离度量的选择影响大**：欧氏距离下对量纲极敏感，必须事先标准化；
- **计算量较大**：朴素实现 $O(n^2)$，百万级样本很吃力（比 K-means 的 $O(tkn)$ 重得多）；
- **边界点归属的"顺序性"**：个别边界点恰好落在两个簇的交界处时，归属取决于扫描顺序（理论上的小瑕疵，实践中影响很小）。

## 二、何时使用（适用场景与条件）

### 2.1 适用场景

1. **任意形状簇的聚类**：数据呈环形、月牙形、螺旋形等非凸分布时，K-means 必然切错而 DBSCAN 是正解。判断方法很简单：**先画散点图看簇的形状**，形状"怪"就用 DBSCAN；
2. **含噪声数据的聚类**：数据中存在大量离群点、异常样本时，K-means 会被离群点拖拽质心，DBSCAN 则把噪声单独标出——聚类质量与抗噪能力同时获得；
3. **离群点检测 / 异常筛查**：许多场景中"谁是噪声"本身就是答案（欺诈交易、故障设备、异常行为），DBSCAN 的噪声标签直接就是检测结果；
4. **地理空间数据聚类**：出租车轨迹热点、地震震中分布、店铺选址、疫情聚集区——地理数据天然不规则、含噪声，且常配经纬度距离（哈弗辛距离），DBSCAN 是地理聚类的标准工具；
5. **连通区域分割**：图像中同一颜色的连通块、社交网络中紧密小团体，本质都是"密度相连"，DBSCAN 可以一站式解决。

### 2.2 竞赛典型题目

- **城市热点区域识别**（出租车 GPS 轨迹题）：把上车点/下车点按空间密度聚类，DBSCAN 直接给出"热点区域 + 散客噪声"，再用核密度估计交叉验证；
- **异常检测类题目**（信用卡欺诈、工业故障诊断）：特征标准化后跑 DBSCAN，把噪声簇拿出来分析"异常样本的共同特征"；
- **客户分群**：当客户分布不规则（画像在特征空间里呈非球状）时，用 DBSCAN 替代 K-means，噪声客户单独归类"低价值/流失风险人群"；
- **选址问题**：基站、配送站、监测站选址中，用 DBSCAN 找"需求点密集区域"，噪声点（偏远孤立需求）单独讨论；
- **图像分割 / 遥感识别**：像素特征聚类成连通区域（农田、城区、水面），配合形态学处理。

### 2.3 使用前提

1. **特征标准化是硬前提**：eps 是一个"全局统一"的距离阈值，如果某特征量纲大（如收入以元计、年龄以岁计），距离被大数值特征垄断，eps 对谁都不合适。**任何距离型算法前一律 `StandardScaler`**；
2. **数据密度大致均匀**：各簇的密度（单位体积内点数）应在一个数量级内。密度相差悬殊时，单一 eps 顾此失彼（稠密簇合并、稀疏簇成噪声）；
3. **eps 与 MinPts 可调、可论证**：必须预留用 k-距离图选参的环节（本文图②），不能拍脑袋定 eps；
4. **特征维度不能太高**：几十维以上距离失去区分度，应先 PCA 降维或改用谱聚类等；
5. **距离度量要匹配业务**：地理坐标用哈弗辛距离、文本用余弦距离、一般数值用标准化后的欧氏距离。

### 2.4 不适用情形

1. **簇间密度差异大**：如"市中心密集团 + 郊区稀疏团"的数据，一个 eps 无法两头兼顾（OPTICS/HDBSCAN 才是正解）；
2. **高维数据**：维度高时所有点两两距离趋于相等，$\varepsilon$-邻域要么全空要么全满，密度概念失效；
3. **题目明确要求固定簇数**：如"请将样本分成恰好 5 类"，DBSCAN 不保证簇数，应改用 K-means（或对 DBSCAN 结果说明"自动发现的簇数为 k"）；
4. **簇内部密度呈梯度变化**（中心密、边缘稀的大团）：密团边缘可能被切断成多段，需反复调参；
5. **超大数据集且对速度敏感**：$O(n^2)$ 的距离矩阵在百万级样本上不可行（可用 HDBSCAN、网格 DBSCAN 等近似替代）；
6. **需要"软聚类"（概率隶属）**：DBSCAN 是硬聚类，每个点只属于一个簇或噪声，概率化需求请用 GMM。

### 2.5 与 K-means、层次聚类的对比选择

| 对比维度 | K-means | 层次聚类 | DBSCAN |
|---|---|---|---|
| 簇形状假设 | **球状 / 凸簇**（硬伤） | 取决于链接方式 | **任意形状** |
| 簇数 | 必须预先给定 K | 树状图切割后定 | **自动确定** |
| 噪声处理 | 无（离群点被强行并入簇） | 无（孤立点常自成一类） | **自动标出噪声** |
| 关键参数 | K、初始化方式 | 链接方式、切割高度 | eps、MinPts |
| 参数敏感度 | 中（K 定错后果严重） | 低（树状图直观） | **高（eps 定错后果严重）** |
| 时间复杂度 | $O(tkn)$，很快 | $O(n^2)$ 起步 | $O(n^2)$（朴素） |
| 高维表现 | 一般 | 一般 | **差**（距离失去意义） |
| 随机性 | 有（初始化） | 无 | 无 |
| 典型失败案例 | 环形数据被横切 | 哑铃结构被误连 | 密度不均数据顾此失彼 |

选择口诀：

- **先画散点图**：簇呈"团状、大致圆润"→ K-means（快、稳）；呈"月牙、环、带"等怪形状→ DBSCAN；
- **数据脏（有离群点）**→ DBSCAN 或先剔除离群点再 K-means；
- **想看"族谱结构"、需要多种切割方案**→ 层次聚类；
- **必须恰好 k 类**→ K-means；**簇数未知且形状任意**→ DBSCAN；
- 三兄弟常在同一道题中**接力出场**：K-means 快速摸底 → 层次聚类看结构 → DBSCAN 处理非凸与噪声，各自扬长避短。

## 三、算法指标

### 3.1 噪声点数与比例

$$n_{noise} = \sum_{i=1}^{n} \mathbb{1}(label_i = \text{噪声}), \qquad r_{noise} = \frac{n_{noise}}{n} \times 100\%$$

- **中文名**：噪声点数 / 噪声比例（DBSCAN 特有的输出指标，K-means 没有）；
- **含义**：被判定为不属于任何簇的样本数及其占比；
- **解读**：
  - 噪声比例**合理偏低**（如本例 $40/350 = 11.43\%$，与注入的 40 个离群点**完全一致**）说明 eps 合适、噪声被精确识别；
  - 噪声比例**畸高**（过半样本是噪声）→ eps 过小，真实簇被"打散"；
  - 噪声比例**接近 0** → eps 过大，噪声被吞并，或数据本来很干净；
  - 竞赛中噪声集合本身就是答案（异常检测题），$r_{noise}$ 是与业务核对的第一指标。

### 3.2 轮廓系数（Silhouette Coefficient）

对每个非噪声样本 $i$，定义 $a(i)$ 为到**同簇**其他样本的平均距离（簇内不相似度），$b(i)$ 为到**最近的其他簇**中所有样本的平均距离（簇间分离度）：

$$s(i) = \frac{b(i) - a(i)}{\max\{a(i), b(i)\}}, \qquad \bar{s} = \frac{1}{n - n_{noise}} \sum_{i \notin \text{噪声}} s(i)$$

- **取值范围**：$s(i) \in [-1, 1]$。接近 $+1$ 分得好，接近 $0$ 骑在簇边界，接近 $-1$ 站错了队；经验分级：$\bar{s} > 0.7$ 结构很强，$0.5 \sim 0.7$ 结构合理，$0.25 \sim 0.5$ 结构较弱，$< 0.25$ 基本无结构；
- **DBSCAN 版本的计算口径**：只对**非噪声点**计算（噪声没有"所属簇"），这也是与 K-means 对比时的第一优势——K-means 没有噪声概念，离群点被强行并入簇中，既污染质心又拉低 $\bar{s}$；
- **与 K-means 的对比优势（本文实例）**：同一数据上 DBSCAN 的轮廓系数 $0.5021$ 高于 K-means 的 $0.4687$（全部 350 点）——K-means 的轮廓系数是被 40 个离群点拖低的，而 DBSCAN 把这些点正确地排除在外后仍取得更高分数，说明其簇结构更优；
- **重要警告**：轮廓系数偏爱"紧凑的凸簇"，对月牙、环形等非凸簇会**系统性低估**（簇内两点最远距离大，$a(i)$ 被拉高）；更坑的是，eps 过小导致簇碎裂时，碎片小簇个个紧凑，轮廓系数反而可能**虚高**（本文 eps=0.10 时 19 个小簇的 $\bar{s}=0.5540$，竟高于正确聚类的 $0.5021$）。因此 DBSCAN 选参**不能只看轮廓系数**，k-距离图才是主依据，轮廓系数只作辅助印证。

### 3.3 各簇样本数

$$|C_k| = \sum_{i=1}^{n} \mathbb{1}(label_i = k), \qquad k = 1, 2, \dots, K$$

- **中文名**：各簇样本数（簇规模）；
- **含义**：每个簇包含的样本个数；
- **解读**：
  - 各簇规模**大致均衡**（如本例 110 / 110 / 90）说明聚类结构健康，没有碎片簇；
  - 出现**极小的簇**（只有几个点）→ 要么是 eps 过小打出的碎片，要么是真实的小众群体，需结合业务判断；
  - 配合真实标签（合成数据）或业务含义（真实数据）核对，簇规模是"聚类对不对"最直观的检验。

### 3.4 核心点 / 边界点统计

$$\text{核心点数} = \sum_{i} \mathbb{1}\big(|N_\varepsilon(x_i)| \ge MinPts\big), \qquad \text{边界点数} = (n - n_{noise}) - \text{核心点数}$$

- **中文名**：核心点数与边界点数；
- **含义**：非噪声点中"密度达标"与"仅被认领"的数量，刻画簇的密度结构；
- **解读**：
  - **边界点比例低**（如本例 310 个非噪声点中核心 298、边界仅 12）：数据密集且 MinPts 较小，几乎所有簇内点都"周围够热闹"——合成数据的典型形态；
  - **边界点比例高**：数据稀疏或 eps 偏小，大量簇边缘点密度勉强不达标；
  - 边界点是簇的"外沿"，其数量可用来判断 eps 是否卡在密度临界区：边界点占比突变处往往就是合理的 eps 下界。

### 3.5 eps 敏感性

- **方法**：固定 MinPts，对 eps 取一列递增的值（如 $0.10, 0.16, 0.24, 0.32, 0.50$）各跑一次，记录簇数、噪声数与轮廓系数，观察**稳定平台**——在某个 eps 区间内结果不变，说明聚类结构在该区间稳健；
- **解读**：
  - eps 过小：簇数爆炸、噪声激增（簇被切碎）；
  - eps 合适：出现稳定平台，簇数、噪声数、指标都合理；
  - eps 过大：簇数骤减（相邻簇合并），噪声被吞掉；
  - 本文实例（MinPts=6 固定）实际结果见下表，平台在 eps = 0.22~0.26（均给出 3 簇 + 40 噪声），故选 eps = 0.24：

| eps | 簇数 | 噪声数 | 轮廓系数 | 现象 |
|---|---|---|---|---|
| 0.10 | 19 | 182 | 0.5540 | 过小：簇严重碎裂，噪声泛滥 |
| 0.16 | 8 | 88 | 0.3614 | 偏小：月牙连成但圆环仍破碎 |
| **0.24** | **3** | **40** | **0.5021** | **合适：3 簇 + 40 噪声，与真值完全一致** |
| 0.32 | 2 | 37 | 0.4354 | 偏大：两个相邻簇被桥接合并 |
| 0.50 | 1 | 19 | — | 过大：全部并成一个簇 |

### 3.6 指标汇总表

| 指标 | 中文名 | 公式 | 取值范围 | 解读 |
|---|---|---|---|---|
| $n_{noise}$ | 噪声点数 | $\sum_i \mathbb{1}(label_i=\text{噪声})$ | $[0, n]$ 整数 | 与业务预期核对；畸高 = eps 过小 |
| $r_{noise}$ | 噪声比例 | $n_{noise} / n$ | $[0, 1]$ | 本例 11.43%，与注入离群点占比一致 |
| $\bar{s}$ | 轮廓系数（非噪声点） | $\frac{1}{n-n_{noise}}\sum_i \frac{b(i)-a(i)}{\max\{a(i),b(i)\}}$ | $[-1, 1]$ | 越接近 1 越好；非凸数据上偏低，勿跨形态比绝对值 |
| $|C_k|$ | 各簇样本数 | $\sum_i \mathbb{1}(label_i=k)$ | 正整数 | 应大致均衡；小簇提示 eps 过小或真实小群体 |
| 核心/边界点数 | 密度结构统计 | 核心：$|N_\varepsilon(x_i)| \ge MinPts$ | 正整数 | 边界比例高 = 数据稀疏或 eps 偏小 |
| eps 敏感性 | 参数稳健性 | 网格化 eps 记录簇数/噪声数 | — | 取"结果不变"的平台区间中点为 eps |
| ARI | 调整兰德指数 | 见第五节点 | $[-1, 1]$ | 有真值时评估正确率，1 = 完全一致 |

## 四、可视化图表

DBSCAN 的"参数敏感"特性决定了它的论证必须**以图说话**：k-距离图证明 eps 有理，聚类散点图证明形状识别成功，对比图证明"为什么不用 K-means"。以下 4 张图覆盖"结果展示 + 选参论证 + 参数敏感性 + 方法对比"，全部代码见第六节，图片自动保存到 `figures/` 目录（`db_` 前缀）。

### 4.1 四张图速查表

| 图名（输出文件） | 用途 | 关键解读点 |
|---|---|---|
| ① DBSCAN 聚类结果散点图（`db_result.png`） | 展示聚类结果：不同颜色 = 不同簇，黑色叉号 = 噪声点，空心圆圈 = 核心点 | 三个月牙/环形簇被完整识别、互不粘连；噪声叉号散布在簇外、无叉号混入簇内；核心点（圈）连成簇的骨架、边界点挂在外沿；若某簇被"拦腰切断"成两色，说明 eps 过小 |
| ② k-距离排序图（`db_kdist.png`） | 论证 eps 的选取依据（1.5 节方法） | 曲线先平缓上升（簇内点），随后**突然变陡**（噪声点）；拐点即合适的 eps（红线标注处）；拐点越明显，参数越好定；若整条曲线平滑无拐点，说明数据没有清晰的密度分层结构 |
| ③ eps 参数对比面板（`db_eps_compare.png`） | 直观展示 eps 过大/合适/过小的后果（敏感性分析） | 左图（eps 过小）簇碎成十几块、黑叉满天；中图（合适）3 簇 + 40 噪声干净利落；右图（eps 过大）所有点并成一团、噪声消失——一眼看懂"参数敏感"的含义 |
| ④ K-means vs DBSCAN 同数据对比（`db_kmeans_vs.png`） | 论证"非凸数据为何选 DBSCAN" | 左图 K-means：月牙的弯钩处被直线决策边界切错、40 个离群点被强行染成簇的颜色；右图 DBSCAN：三个月牙/环形完整、噪声全部用叉号挑出——方法选型的决定性证据 |

### 4.2 每张图"好"与"异常"的特征

**图① DBSCAN 聚类结果散点图**

- 好图特征：三种颜色完整覆盖三个月牙/环形，簇与簇之间有空隙且**没有颜色桥接**；40 个黑色叉号全部落在簇外（叉号在簇内 = 噪声被误吸收，eps 偏大）；空心圈（核心点）连成骨架，只有极少数边缘点是实心（边界点）；
- 异常特征一（eps 过小）：一个大簇裂成多个同色小碎片或多种颜色交替出现，叉号数量远超预期；
- 异常特征二（eps 过大）：两个本应分开的簇被一串点"桥接"成同色，或整个图只有一两种颜色，叉号几乎消失；
- 异常特征三（未标准化）：簇沿某一坐标轴被拉成细长条，另一方向被压扁——距离被大数值特征垄断，应标准化后重跑。

**图② k-距离排序图**

- 好图特征：平缓段与陡升段界限分明（本例前 298 个点的 k-距离不超过 0.24，第 299 个点起曲线抬头，噪声段从 0.32 一路冲到 1.49）；红线（选定 eps）恰好落在拐点；
- 异常特征一（无拐点）：曲线全程平滑上升——密度结构不分层，单一 eps 无法两全，应考虑 OPTICS 或 HDBSCAN；
- 异常特征二（拐点不唯一）：出现多个台阶——数据中同时存在多个密度层级，选 eps 时取"最靠后的明显拐点"，并主动说明其余层级将被并入或丢弃。

**图③ eps 参数对比面板**

- 好图特征：三面板呈现"碎 → 整 → 并"的完整演变，中间面板与真实结构一致；
- 异常特征（平台过窄）：合适 eps 只在极窄区间内成立（如 0.235~0.245），说明数据密度结构脆弱，论文中应说明该脆弱性并尽量用 MinPts 微调拓宽平台。

**图④ K-means vs DBSCAN 对比**

- 好图特征：K-means 一侧能看到明显的"切错"痕迹（月牙弯钩被切到别的簇、离群点被染成簇色），DBSCAN 一侧干净完整；两图并排，DBSCAN 的优势一目了然；
- 异常特征（对比不显著）：两图几乎一样——说明数据其实接近球状簇，DBSCAN 并无必要，此时应老老实实用 K-means（更快、更稳），这也是正确的方法选型结论。

## 五、符号说明

| 符号 | 含义 | 示例/单位 |
|---|---|---|
| $n$ | 样本量 | $n = 350$ |
| $p$ | 特征个数（维度） | $p = 2$ |
| $d(p, q)$ | 点 $p$ 与 $q$ 的距离（常用欧氏距离） | 与特征同单位 |
| $\varepsilon$（eps） | 邻域半径：密度判断的距离阈值 | 本例 $0.24$（标准化空间） |
| $MinPts$ | 邻域最小点数：达到即为核心点 | 本例 $6$（$\approx \ln n$） |
| $N_\varepsilon(p)$ | 点 $p$ 的 $\varepsilon$-邻域（含自身） | $\{q : d(p,q) \le \varepsilon\}$ |
| 核心点 | $|N_\varepsilon(p)| \ge MinPts$ 的点 | 簇的骨架 |
| 边界点 | 非核心但落在某核心点邻域内的点 | 簇的边缘 |
| 噪声点 | 非核心且不在任何核心点邻域内 | 离群点，sklearn 记 $-1$ |
| $k$ | k-距离图中的近邻序号 | $k = MinPts - 1 = 5$ |
| k-距离 | 点到其第 $k$ 近邻的距离 | 选 eps 的依据 |
| $D$ | $n \times n$ 欧氏距离矩阵 | $D[i,j] = d(x_i, x_j)$ |
| $K$ | 自动发现的簇数 | 本例 $K = 3$ |
| $C_k$ | 第 $k$ 个簇的点集 | $|C_1|=110$ 等 |
| $n_{noise}$ | 噪声点数 | 本例 $40$ |
| $r_{noise}$ | 噪声比例 | 本例 $11.43\%$ |
| $a(i)$ | 样本 $i$ 到同簇其他点的平均距离 | 与特征同单位 |
| $b(i)$ | 样本 $i$ 到最近其他簇的平均距离 | 与特征同单位 |
| $s(i)$、$\bar{s}$ | 单个样本 / 整体的轮廓系数 | $[-1, 1]$ |
| $ARI$ | 调整兰德指数：两组标签的一致性 | $[-1, 1]$，1 = 完全一致 |
| $label_i$ | 第 $i$ 个样本的聚类标签 | 手写实现：0 = 噪声，$1..K$ = 簇号 |

## 六、可运行程序（完整代码）

> 环境要求：Python 3.12，依赖 numpy、scipy、scikit-learn、matplotlib、pandas（`pip install numpy scipy scikit-learn matplotlib pandas`）。以下代码保存为 `dbscan_demo.py`，在本文档所在目录运行即可：控制台打印第三节全部指标（k-距离分位数、簇数、噪声数、各簇样本数、核心/边界点数、轮廓系数、ARI 对照、eps 敏感性表），并在 `figures/` 子目录生成 4 张图（`db_` 前缀）。数据为合成数据（两个月牙 + 一个圆环 + 40 个离群点，`np.random.seed(42)` 固定随机种子），无外部文件依赖，可直接复现。

```python
# -*- coding: utf-8 -*-
"""
================================================================
DBSCAN 聚类完整示例：手写实现 + sklearn 对照
----------------------------------------------------------------
数据（合成）：两个月牙形簇 + 一个环形簇 + 40 个离群噪声点，n = 350
流程：数据生成 → 标准化 → 距离矩阵 → k-距离图选 eps → 手写 DBSCAN
      → sklearn DBSCAN 对照（ARI）→ 全部指标 → K-means 同数据对比
      → eps 敏感性分析 → 4 张图（db_ 前缀，figures/ 目录）
输出：控制台打印第三节全部指标 + figures/ 目录下 4 张图
依赖：numpy、scipy、scikit-learn、matplotlib、pandas（Python 3.12）
================================================================
"""

# ========== 0. 导入库与全局设置 ==========
import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import DBSCAN, KMeans
from sklearn.metrics import silhouette_score, adjusted_rand_score

# ---- matplotlib 中文显示设置（防止图内中文乱码）----
plt.rcParams["font.sans-serif"] = ["PingFang SC", "Arial Unicode MS", "SimHei"]
plt.rcParams["axes.unicode_minus"] = False   # 让负号 "-" 正常显示

# ---- 图片输出目录（相对当前工作目录的 figures/ 子目录）----
FIG_DIR = "figures"
os.makedirs(FIG_DIR, exist_ok=True)

# ========== 1. 合成数据：两个月牙 + 一个圆环 + 40 个离群点，n = 350 ==========
# 全部形状都刻意取"非凸"：K-means 假定簇是球状，在这里必然翻车
np.random.seed(42)

# ---- 1.1 月牙形簇：参数化生成（角度均匀 + 半径均匀的扇形圆环），各 110 个 ----
def make_crescent(cx, cy, t0, t1, n_pts, r_lo=0.85, r_hi=1.15):
    """以 (cx, cy) 为圆心、角度 t0~t1、半径 r_lo~r_hi 的扇形圆环上均匀采样。"""
    t = np.random.uniform(t0, t1, n_pts)
    r = np.random.uniform(r_lo, r_hi, n_pts)
    return np.column_stack([cx + r * np.cos(t), cy + r * np.sin(t)])

X_moon_up = make_crescent(0.0, 0.0, 0.0, np.pi, 110)          # 上弦月（开口向下）
X_moon_dn = make_crescent(1.0, 0.0, np.pi, 2 * np.pi, 110)    # 下弦月（开口向上）
# 下弦月整体向左错开 1 个单位：两个月牙的"弯钩"相互咬合，直线切不开

# ---- 1.2 环形簇：极坐标均匀采样 + 半径扰动，90 个 ----
n_ring = 90
theta = np.random.uniform(0, 2 * np.pi, n_ring)
r_ring = np.random.uniform(0.72, 0.98, n_ring)
X_ring = np.column_stack([3.5 + r_ring * np.cos(theta), r_ring * np.sin(theta)])

# ---- 1.3 离群噪声点：包围盒内均匀采样，只保留与任何真实簇距离 > 0.35 的点 ----
X_clusters = np.vstack([X_moon_up, X_moon_dn, X_ring])
X_noise_list = []
n_noise = 40
while len(X_noise_list) < n_noise:                    # 采到 40 个为止
    cand = np.random.uniform(low=[-2.2, -1.7], high=[5.9, 2.1])
    dmin = np.sqrt(((X_clusters - cand) ** 2).sum(axis=1)).min()
    if dmin > 0.35:                                   # 距真实簇太近的不算"离群"
        X_noise_list.append(cand)
X_noise = np.array(X_noise_list)

# ---- 1.4 合并全部数据，打上真实标签（仅用于评估，聚类算法看不到）----
X_raw = np.vstack([X_moon_up, X_moon_dn, X_ring, X_noise])
y_true = np.array([0] * 110 + [1] * 110 + [2] * n_ring + [3] * n_noise)
n = X_raw.shape[0]
print(f"已生成 n = {n} 个样本：上弦月 110 + 下弦月 110 + 圆环 {n_ring} + 离群点 {n_noise}")

# ---- 1.5 特征标准化：eps 是"距离阈值"，量纲不统一会让 eps 失效 ----
scaler = StandardScaler()
X = scaler.fit_transform(X_raw)     # 每维变成 均值0、标准差1，eps 才有统一尺度

# ========== 2. 手写 DBSCAN（距离矩阵 → 区域查询 → 核心点判定 → BFS 扩张）==========

# ---- 2.1 距离矩阵：n×n 的欧氏距离矩阵，D[i, j] = 点 i 与点 j 的距离 ----
D = np.sqrt(((X[:, None, :] - X[None, :, :]) ** 2).sum(axis=-1))

def region_query(D, p, eps):
    """区域查询：返回点 p 的 eps-邻域内所有点的下标（含 p 自身，D[p,p]=0）。"""
    return np.where(D[p] <= eps)[0]

def my_dbscan(D, eps, min_pts):
    """
    手写 DBSCAN：
      1) 遍历所有未访问点 p；
      2) 若 p 的 eps-邻域点数 < MinPts，暂时标为噪声（0），后续可能被改成边界点；
      3) 否则 p 是核心点，新建一个簇，用队列（BFS）把邻域内所有密度相连的点
         不断扩张进同一簇：访问到核心点就继续并入其邻域，访问到噪声就改成边界点。
    返回：labels（0=噪声，1,2,...=簇号）、core_mask（是否核心点）
    """
    n_pts = D.shape[0]
    labels = np.full(n_pts, -1, dtype=int)   # -1 = 尚未访问
    core_mask = np.zeros(n_pts, dtype=bool)  # 核心点标记
    cluster_id = 0
    for p in range(n_pts):
        if labels[p] != -1:                  # 已访问过，跳过
            continue
        Np = region_query(D, p, eps)         # p 的 eps-邻域（含自身）
        if Np.size < min_pts:                # 邻域太稀疏 → 暂时标为噪声
            labels[p] = 0
            continue
        cluster_id += 1                      # 核心点：开一个新簇
        labels[p] = cluster_id
        core_mask[p] = True
        seeds = list(Np)                     # 队列：从核心点的邻域开始扩张
        while seeds:
            q = seeds.pop()
            if labels[q] == 0:               # 之前是"噪声"，被吸收进来 → 边界点
                labels[q] = cluster_id
            if labels[q] != -1:              # 已属于某个簇（本簇或其他簇）→ 不动
                continue
            labels[q] = cluster_id           # 新点并入当前簇
            Nq = region_query(D, q, eps)
            if Nq.size >= min_pts:           # q 也是核心点 → 邻域继续并入队列
                core_mask[q] = True
                for s in Nq:
                    if labels[s] == -1:      # 只把未访问点加入队列
                        seeds.append(s)
    return labels, core_mask

# ---- 2.2 用 k-距离图辅助选 eps：k = MinPts - 1 ----
MIN_PTS = 6      # 经验法则：2 维数据可取 minPts ≈ ln(n) = ln(350) ≈ 5.9 → 取 6
k = MIN_PTS - 1
k_dist = np.sort(D, axis=1)[:, k]            # 每个点到其第 k 近邻的距离
k_dist_sorted = np.sort(k_dist)              # 升序排列，用于画 k-距离排序图
print(f"\nk-距离（k={k}）分位数：50%={np.percentile(k_dist, 50):.4f}, "
      f"75%={np.percentile(k_dist, 75):.4f}, 90%={np.percentile(k_dist, 90):.4f}, "
      f"95%={np.percentile(k_dist, 95):.4f}, 99%={np.percentile(k_dist, 99):.4f}")
EPS = 0.24   # 由 k-距离排序图的"拐点"处确定（见图②与文档第七节）

labels_hand, core_mask = my_dbscan(D, EPS, MIN_PTS)
n_clusters_hand = labels_hand.max()
n_noise_hand = (labels_hand == 0).sum()

# ========== 3. sklearn DBSCAN 对照 ==========
db = DBSCAN(eps=EPS, min_samples=MIN_PTS)
labels_sk = db.fit_predict(X)                # sklearn 用 -1 表示噪声，其余同簇号
# 把手写与 sklearn 的标签统一成"噪声 = -1"便于对比
labels_hand_cmp = np.where(labels_hand == 0, -1, labels_hand)
ari_hand_sk = adjusted_rand_score(labels_hand_cmp, labels_sk)
noise_same = set(np.where(labels_hand_cmp == -1)[0]) == set(np.where(labels_sk == -1)[0])

# ========== 4. 计算第三节要求的全部指标 ==========

# ---- 4.1 噪声点数与比例、各簇样本数 ----
noise_ratio = n_noise_hand / n * 100
sizes = pd.Series(labels_hand[labels_hand > 0]).value_counts().sort_index()

# ---- 4.2 轮廓系数（DBSCAN 只对非噪声点计算，噪声不参与）----
mask_non_noise = labels_hand > 0
sil_db = silhouette_score(X[mask_non_noise], labels_hand[mask_non_noise])

# ---- 4.3 核心点 / 边界点统计 ----
n_core = (core_mask & (labels_hand > 0)).sum()
n_border = ((~core_mask) & (labels_hand > 0)).sum()

# ---- 4.4 与真实标签对比的 ARI（评估合成数据上的正确率）----
# 统一成 4 类标签：簇 → 0,1,2，噪声 → 3，与 y_true 的取值约定一致
lab_db4 = np.where(labels_hand_cmp == -1, 3, labels_hand_cmp - 1)
ari_db_true = adjusted_rand_score(y_true, lab_db4)

# ---- 4.5 K-means 同数据对比（k=3）：轮廓系数 + ARI ----
km = KMeans(n_clusters=3, n_init=10, random_state=42)
labels_km = km.fit_predict(X)
sil_km = silhouette_score(X, labels_km)                     # 全部 350 点（含噪声）
sil_km_nn = silhouette_score(X[y_true != 3], labels_km[y_true != 3])   # 仅非噪声点
ari_km_db = adjusted_rand_score(labels_km[mask_non_noise], labels_hand[mask_non_noise])
ari_km_true = adjusted_rand_score(y_true, np.where(y_true == 3, 3, labels_km))
# K-means 的 3 个簇各自吸收了多少个真实离群点（它没有"噪声"概念）
km_noise_absorbed = pd.Series(labels_km[y_true == 3]).value_counts().sort_index()

# ---- 4.6 eps 敏感性：eps 过小/合适/过大，观察簇数与噪声数的变化 ----
eps_list = [0.10, 0.16, EPS, 0.32, 0.50]
sens_rows = []
for e in eps_list:
    lab, _ = my_dbscan(D, e, MIN_PTS)
    nc = lab.max()
    nn = (lab == 0).sum()
    mnn = lab > 0
    sil = silhouette_score(X[mnn], lab[mnn]) if mnn.sum() > 1 and nc > 1 else np.nan
    sens_rows.append([e, nc, nn, sil])
sens_df = pd.DataFrame(sens_rows, columns=["eps", "簇数", "噪声数", "轮廓系数"])

# ========== 5. 控制台打印全部指标 ==========
print("\n" + "=" * 68)
print(f"DBSCAN 聚类结果（手写实现）    n = {n}，eps = {EPS}，MinPts = {MIN_PTS}")
print("=" * 68)
print(f"簇个数        = {n_clusters_hand}")
print(f"噪声点数      = {n_noise_hand}（占 {noise_ratio:.2f}%）")
for cid in sizes.index:
    print(f"  簇 {cid} 样本数 = {sizes[cid]}")
print(f"核心点数      = {n_core}，边界点数 = {n_border}（合计 {n_core + n_border} 个非噪声点）")
print(f"轮廓系数（非噪声点）= {sil_db:.4f}")
print(f"ARI vs 真实标签 = {ari_db_true:.4f}")
print("-" * 68)
print("【手写 DBSCAN vs sklearn DBSCAN 对照】")
print(f"ARI = {ari_hand_sk:.4f}（=1 表示两种实现完全一致）")
print(f"噪声点集合完全一致？{noise_same}")
print("-" * 68)
print("【K-means 同数据对比（k=3）】")
print(f"K-means 轮廓系数（全部点）= {sil_km:.4f}   （仅非噪声点）= {sil_km_nn:.4f}")
print(f"DBSCAN  轮廓系数（非噪声点）= {sil_db:.4f}")
print(f"ARI vs 真实标签：K-means = {ari_km_true:.4f}，DBSCAN = {ari_db_true:.4f}")
print(f"K-means vs DBSCAN 的 ARI（非噪声点）= {ari_km_db:.4f}")
print(f"K-means 三个簇吸收的离群点个数：{km_noise_absorbed.to_dict()}")
print("-" * 68)
print("【eps 敏感性分析（MinPts = %d 固定）】" % MIN_PTS)
print(sens_df.to_string(index=False, float_format=lambda v: f"{v:.4f}"))
print("=" * 68)

# ========== 6. 可视化：第四节要求的 4 张图 ==========
colors = ["#4C72B0", "#DD8452", "#55A868"]   # 三个真实簇的颜色（蓝/橙/绿）

# ---- 图① DBSCAN 聚类结果散点图（任意形状簇 + 噪声点叉号标注）----
fig, ax = plt.subplots(figsize=(7, 6))
for cid in np.unique(labels_hand[labels_hand > 0]):
    m = labels_hand == cid
    ax.scatter(X[m, 0], X[m, 1], s=28, c=colors[cid - 1], alpha=0.85,
               label=f"簇 {cid}（{m.sum()} 点）", edgecolors="white", linewidths=0.5)
m_noise = labels_hand == 0
ax.scatter(X[m_noise, 0], X[m_noise, 1], s=40, marker="x", c="black",
           linewidths=1.5, label=f"噪声（{m_noise.sum()} 点）")
# 用圆圈标出核心点（视觉上强调"核心点撑起簇、边界点挂在边缘"）
ax.scatter(X[core_mask & (labels_hand > 0), 0], X[core_mask & (labels_hand > 0), 1],
           s=90, facecolors="none", edgecolors="black", linewidths=0.7, alpha=0.35,
           label="核心点（圈出）")
ax.set_title(f"DBSCAN 聚类结果（eps={EPS}, MinPts={MIN_PTS}）：3 个任意形状簇 + {n_noise_hand} 个噪声点")
ax.set_xlabel("标准化特征 x1"); ax.set_ylabel("标准化特征 x2")
ax.legend(loc="lower left", fontsize=8); ax.grid(alpha=0.3)
fig.tight_layout(); fig.savefig(os.path.join(FIG_DIR, "db_result.png"), dpi=150)

# ---- 图② k-距离排序图（选 eps 的依据，看拐点）----
fig, ax = plt.subplots(figsize=(7, 4.5))
ax.plot(np.arange(1, n + 1), k_dist_sorted, ".-", markersize=3, lw=1.2, color="#4C72B0")
ax.axhline(EPS, color="red", ls="--", lw=1.5, label=f"选定 eps = {EPS}")
ax.set_xlabel("样本（按 k-距离升序排列）")
ax.set_ylabel(f"第 {k} 近邻距离（k = MinPts-1 = {k}）")
ax.set_title(f"k-距离排序图：拐点（曲线突然变陡处）即合适的 eps（MinPts={MIN_PTS}）")
ax.legend(); ax.grid(alpha=0.3)
fig.tight_layout(); fig.savefig(os.path.join(FIG_DIR, "db_kdist.png"), dpi=150)

# ---- 图③ eps 参数对比面板（过小 / 合适 / 过大）----
eps_panels = [0.10, EPS, 0.50]
panel_names = ["过小（簇碎裂）", "合适（本文选定）", "过大（簇合并）"]
fig, axes = plt.subplots(1, 3, figsize=(15, 5), sharex=True, sharey=True)
for ax, e, nm in zip(axes, eps_panels, panel_names):
    lab, _ = my_dbscan(D, e, MIN_PTS)
    nn = (lab == 0).sum()
    for cid in np.unique(lab[lab > 0]):
        m = lab == cid
        ax.scatter(X[m, 0], X[m, 1], s=16, alpha=0.85, edgecolors="white", linewidths=0.4)
    ax.scatter(X[lab == 0, 0], X[lab == 0, 1], s=30, marker="x", c="black", linewidths=1.2)
    ax.set_title(f"eps = {e}（{nm}）\n簇数 = {lab.max()}，噪声 = {nn} 点")
    ax.grid(alpha=0.3)
axes[0].set_ylabel("标准化特征 x2")
fig.suptitle(f"eps 参数对比（MinPts={MIN_PTS} 固定）：过小 → 簇碎裂、噪声多；过大 → 簇合并、噪声消失", y=1.02)
fig.tight_layout(); fig.savefig(os.path.join(FIG_DIR, "db_eps_compare.png"), dpi=150)

# ---- 图④ 同一数据 K-means vs DBSCAN 对比（展示非凸数据上的差异）----
fig, axes = plt.subplots(1, 2, figsize=(13, 6))
ax = axes[0]
for cid in range(3):
    m = labels_km == cid
    ax.scatter(X[m, 0], X[m, 1], s=22, alpha=0.85, edgecolors="white", linewidths=0.4)
ax.set_title(f"K-means（k=3）：轮廓系数 = {sil_km:.3f}\n按距离硬切：月牙弯钩被切错，离群点全部被吸进簇里")
ax.set_xlabel("标准化特征 x1"); ax.set_ylabel("标准化特征 x2"); ax.grid(alpha=0.3)
ax = axes[1]
for cid in np.unique(labels_hand[labels_hand > 0]):
    m = labels_hand == cid
    ax.scatter(X[m, 0], X[m, 1], s=22, alpha=0.85, edgecolors="white", linewidths=0.4)
ax.scatter(X[labels_hand == 0, 0], X[labels_hand == 0, 1], s=32, marker="x", c="black",
           linewidths=1.3, label=f"噪声 {n_noise_hand} 点")
ax.set_title(f"DBSCAN（eps={EPS}, MinPts={MIN_PTS}）：轮廓系数 = {sil_db:.3f}\n月牙、环形完整识别，噪声自动挑出")
ax.set_xlabel("标准化特征 x1"); ax.set_ylabel("标准化特征 x2")
ax.legend(fontsize=8); ax.grid(alpha=0.3)
fig.suptitle("同一数据 K-means vs DBSCAN：非凸形状下 DBSCAN 显著占优", y=1.02)
fig.tight_layout(); fig.savefig(os.path.join(FIG_DIR, "db_kmeans_vs.png"), dpi=150)

print(f"\n4 张图已保存到 {FIG_DIR}/ 目录：db_result.png、db_kdist.png、db_eps_compare.png、db_kmeans_vs.png")

# ---- 展示全部图片（无 GUI 的服务器环境可注释掉本行，图片已保存到 figures/）----
plt.show()
```

## 七、结果解读与注意事项

### 7.1 实例解读（以上一节代码的实际输出为例）

运行第六节代码，控制台的关键输出如下（`np.random.seed(42)` 固定，结果可完全复现）。

**第一步：数据与参数确定**

程序生成 $n = 350$ 个样本（上弦月 110 + 下弦月 110 + 圆环 90 + 离群点 40），标准化后计算 k-距离（$k = MinPts - 1 = 5$），分位数为：50% = 0.1299、75% = 0.1770、90% = 0.4316、95% = 0.6115、99% = 0.9821。k-距离排序图显示：**前 298 个点（真实簇内点）的 k-距离都在 0.24 以下**（曲线平缓段），从第 299 个点起曲线离开平台、陡然上升（噪声点段，k-距离从 0.32 一路冲到 1.49）——拐点明确指向 **eps = 0.24**。MinPts 按经验法则取 $\ln 350 \approx 5.9 \to 6$。

**第二步：聚类结果**

- 手写 DBSCAN 输出 **3 个簇 + 40 个噪声点**：簇 1（上弦月）110 点、簇 2（下弦月）110 点、簇 3（圆环）90 点，噪声 40 点占 11.43%——**与合成数据的真实结构（3 簇 + 40 离群点）完全一致**，ARI vs 真实标签 = **1.0000**；
- 非噪声点 310 个中：**核心点 298 个、边界点仅 12 个**。边界点少是因为合成数据密度高、MinPts=6 较小，几乎所有簇内点周围都有至少 6 个邻居——真实稀疏数据中边界点比例会更高；
- 轮廓系数（非噪声点）= **0.5021**，落在"0.5~0.7 结构合理"区间。该值被月牙/圆环的非凸形状系统性拉低（簇内最远点距大导致 $a(i)$ 偏高），并非聚类质量问题——评估非凸聚类应结合 ARI 与可视化。

**第三步：手写实现与 sklearn 对照**

手写 DBSCAN 与 `sklearn.cluster.DBSCAN(eps=0.24, min_samples=6)` 的标签 ARI = **1.0000**，噪声点集合**完全一致**——手写代码与官方实现结果相同，论文中可放心使用"自研实现"的表述。

**第四步：与 K-means 同数据对比（k=3）**

- 轮廓系数：DBSCAN 0.5021 > K-means 0.4687（全部 350 点）；即便只看非噪声点，K-means 也只有 0.4971，仍低于 DBSCAN——K-means 的分数是被 40 个离群点拖低的，而 DBSCAN 把离群点正确排除后分数反而更高；
- ARI vs 真实标签：DBSCAN **1.0000** vs K-means **0.8941**。K-means 的具体错误：上弦月 110 点中 5 个、下弦月 110 点中 8 个被划错（月牙相互咬合的"弯钩"处被直线决策边界切错），且 40 个离群点**全部**被强行并入簇中（三个簇分别吸收 8、21、11 个）——K-means 没有"噪声"概念，离群点必然污染聚类；
- K-means vs DBSCAN 的 ARI（非噪声点）= 0.8791，同样印证差距。

**第五步：eps 敏感性分析（MinPts = 6 固定）**

| eps | 簇数 | 噪声数 | 轮廓系数 | 结论 |
|---|---|---|---|---|
| 0.10 | 19 | 182 | 0.5540 | 过小：簇碎裂、噪声泛滥 |
| 0.16 | 8 | 88 | 0.3614 | 偏小：圆环仍连不成整环 |
| **0.24** | **3** | **40** | **0.5021** | **合适：与真实结构完全一致** |
| 0.32 | 2 | 37 | 0.4354 | 偏大：两个簇被桥接合并 |
| 0.50 | 1 | 19 | — | 过大：全部并成一个簇 |

两个要点：其一，eps 在 0.22~0.26 的**平台区间**内结果都稳定为 3 簇 + 40 噪声，说明选参稳健；其二，注意 eps=0.10 时轮廓系数 **0.5540 反而高于**正确聚类的 0.5021——碎片化产生的小簇个个紧凑，轮廓系数"虚高"。**因此 DBSCAN 选参必须以 k-距离图为主、轮廓系数为辅**，这也是 3.2 节强调的警告。

**第六步：四张图的解读指引**

`db_result.png` 展示 3 个任意形状簇 + 40 个黑色叉号噪声点（核心点以空心圈标出）；`db_kdist.png` 的红线落在 k-距离曲线拐点处，直接作为论文中 eps=0.24 的选参证据；`db_eps_compare.png` 三面板呈现"碎 → 整 → 并"的演变，直观说明参数敏感性的含义；`db_kmeans_vs.png` 并排对比 K-means 的"切错 + 吸噪"与 DBSCAN 的"完整识别 + 噪声挑出"，是"为什么选 DBSCAN"的最有力证据。

### 7.2 常见坑

1. **忘记标准化（最高频错误）**：eps 是全局距离阈值，原始量纲下数值大的特征垄断距离，eps 怎么调都不对。**对策**：任何距离型算法前一律 `StandardScaler`；注意聚类结果在"标准化空间"中解释，还原坐标时乘回标准差即可；
2. **eps 拍脑袋定值**：直接写 `eps=0.5` 而不给依据，评审会质疑参数合理性。**对策**：论文中必须附 k-距离图 + 拐点标注（本文图②），并配一句"取曲线由平转陡的拐点处为 eps"；
3. **MinPts 与 eps 不配套**：MinPts 增大会让同样的 eps 下核心点变少、簇更碎；调参时应**固定 MinPts 调 eps**，两个参数交替乱调永远收敛不了。**对策**：MinPts 用经验公式 $\ln(n)$ 或 $2p$ 一次定死，只调 eps；
4. **高维数据直接硬上**：维度高时距离趋同，k-距离图可能没有拐点，聚类结果随机化。**对策**：先 PCA 降到 2~10 维再聚类，或改用谱聚类；论文中应说明降维步骤；
5. **簇间密度差异大却视而不见**：单一 eps 会把稀疏簇打成噪声、把稠密簇粘成一团。**对策**：先画散点图/核密度图检查密度分布；差异明显时改用 OPTICS/HDBSCAN，并在论文中说明原因；
6. **把轮廓系数当唯一标准**：如 7.1 第五步所示，碎片化的轮廓系数反而更高。**对策**：非凸数据的聚类质量以"k-距离图选参 + 可视化形状核验 +（有真值时）ARI"三件套为准，轮廓系数只作辅助；
7. **把噪声点当失败结果**：噪声是 DBSCAN 的**输出**而不是 bug。**对策**：论文中正面使用噪声集——"聚类同时识别出 40 个离群样本（占 11.43%），经核验为异常/边缘数据"——把噪声解读成发现；
8. **把簇编号当有序真值**：DBSCAN 的簇编号由扫描顺序决定，簇 1、簇 2 无先后含义。**对策**：解读时只说簇的构成与画像，不比较"簇 1 比簇 2 大/好"。

### 7.3 竞赛论文写作建议（话术模板）

在论文中，DBSCAN 部分通常按"**方法一句话 + 选参论证 + 结果描述 + 噪声解读**"四段式展开。可直接套用以下模板（以本示例数据代入）：

> 由于样本在特征空间中呈现月牙形、环形等非凸分布且含有离群点，本文采用基于密度的 DBSCAN 算法进行聚类。聚类前对特征进行 z-score 标准化以消除量纲影响；MinPts 取 $\ln(n) \approx 6$；绘制 k-距离排序图（见附录图），取曲线由平转陡的拐点处作为邻域半径，即 eps = 0.24。聚类结果自动发现 3 个簇，样本数分别为 110、110、90，并识别出 40 个噪声点（占 11.43%）。聚类结果与数据分布形态高度吻合，平均轮廓系数为 0.5021。作为对比，K-means（k=3）在同一数据上的轮廓系数仅为 0.4687，且因算法无噪声概念，40 个离群点全部被错误并入簇中，进一步说明非凸含噪数据下 DBSCAN 的优越性。

变体话术（按题型替换）：

- **离群检测题**："……DBSCAN 在聚类的同时标记出 n_noise 个噪声样本，将其作为疑似异常样本集合，与箱线图、3σ 准则的筛查结果进行交叉验证，三者重合率达到 xx%，说明异常识别结果可信。"
- **空间热点题**："……对标准化后的经纬度坐标进行 DBSCAN 聚类（距离采用哈弗辛距离），识别出 k 个热点区域，噪声点为零散出行记录，占总样本 xx%。热点区域的空间分布与城市功能区划一致。"
- **参数稳健性表态**："……在 eps ∈ [0.22, 0.26] 区间内聚类结果保持稳定（均为 3 簇、40 个噪声点），说明选参具有稳健性，不依赖参数的精细调节。"
- **谨慎表态**（数据密度不均时）："……鉴于数据各区域密度差异较大，单一 eps 难以同时适配，本文在 DBSCAN 基础上进一步采用 OPTICS 方法进行敏感性分析（见 8.x 节），主要结论不依赖于单一聚类的精确边界。"

## 八、延伸阅读

- **OPTICS（Ordering Points To Identify the Clustering Structure）**：DBSCAN 的"密度不均"改良版。不输出单一聚类，而是给样本排一个"密度可达序"，按序画出**可达距离图**，图中每个"山谷"对应一个密度层级——稠密簇、稀疏簇各取各的 eps，一次分析看清全部结构。数据密度差异大时优先考虑；
- **HDBSCAN**：把 DBSCAN 与层次聚类结合：对"不同 MinPts 下的密度树"做层次分析，**自动挑选最稳定的 eps**，还输出每个点属于簇的**概率**（软标签）。基本免调参，scikit-learn 未内置（可用 `hdbscan` 库），是竞赛中 DBSCAN 的"开箱即用"升级版；
- **谱聚类（Spectral Clustering）**：基于样本间相似度构建图，用图拉普拉斯矩阵的特征向量降维后再做 K-means。同样擅长非凸簇（月牙、环形），且在**高维稀疏**数据上比 DBSCAN 可靠；代价是需指定簇数、计算量较大。与 DBSCAN 的区别一句话：**DBSCAN 靠"局部密度"，谱聚类靠"全局连通"**；
- **LOF（Local Outlier Factor，局部离群因子）**：DBSCAN 的"离群检测"近亲。用"样本的局部密度与其邻居局部密度之比"给每个点打离群分数，比 DBSCAN 的"是/否噪声"更细粒度——当题目核心是异常检测而非聚类时，LOF 通常比 DBSCAN 更专业；
- **方法速查**：任意形状 + 含噪声 → DBSCAN；密度不均 → OPTICS / HDBSCAN；高维非凸 → 谱聚类；纯离群检测 → LOF；球状 + 快 → K-means；要族谱结构 → 层次聚类。

> 本篇是算法系列第 25 篇。聚类三兄弟（K-means、层次聚类、DBSCAN）至此收齐：K-means 管"球状快分"，层次聚类管"族谱结构"，DBSCAN 管"任意形状 + 噪声"。建议三篇连读（第 23、24、25 篇），遇到聚类题时先画散点图、再按 2.5 节的口诀选型——方法选对，竞赛就已经赢了一半。
