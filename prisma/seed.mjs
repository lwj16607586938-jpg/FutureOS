// FutureOS seed — curated concept graph (决策 D2).
// Idempotent: upserts by slug / by unique relation triple. Run via `prisma db seed`.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_NAME = process.env.DEFAULT_USER_NAME || "FutureOS Learner";

const NODES = [
  { slug: "gpu", title: "GPU", category: "Technology", difficulty: 3,
    description: "图形处理器（GPU）是一种擅长大规模并行计算的处理器。\n\n与 CPU 顺序处理不同，GPU 拥有数千个核心，能同时执行大量简单运算。这一特性使它成为深度学习训练与推理的核心硬件，也是现代 AI 算力的基石。" },
  { slug: "cuda", title: "CUDA", category: "Technology", difficulty: 3,
    description: "CUDA 是 NVIDIA 推出的并行计算平台与编程模型。\n\n它让开发者能够直接调度 GPU 的数千个核心，把矩阵运算、神经网络前向/反向传播等任务映射到 GPU 上。没有 CUDA，GPU 很难被用于通用科学计算与 AI。" },
  { slug: "hbm", title: "HBM", category: "Technology", difficulty: 3,
    description: "高带宽内存（HBM）是一种堆叠在芯片附近、通过硅中介层与 GPU 互联的先进内存。\n\nAI 训练是“算力喂不饱”的任务，瓶颈常不在计算而在访存带宽。HBM 以极高的带宽缓解了这一问题，是高端 GPU 的关键部件，也是当前供给最紧张的环节之一。" },
  { slug: "tsmc", title: "TSMC", category: "Business", difficulty: 2,
    description: "台积电（TSMC）是全球最大的半导体代工企业。\n\n绝大多数先进制程芯片（包括 GPU、HBM 的逻辑基底）都由 TSMC 代工。它的产能与良率，直接决定了高端 AI 硬件的全球供给节奏。" },
  { slug: "semiconductor", title: "Semiconductor", category: "Technology", difficulty: 2,
    description: "半导体是制造芯片的基础材料与产业总称。\n\nGPU、HBM、各类处理器都建立在半导体之上。半导体产业具有重资产、长周期、强周期性的特点，是科技与地缘的交汇点。" },
  { slug: "chip", title: "Chip", category: "Technology", difficulty: 2,
    description: "芯片（Chip）是把晶体管集成到一块半导体上的完整集成电路。\n\nGPU、CPU、HBM 控制芯片等都是芯片。芯片是“概念—制造—系统”链条中承上启下的实体产品。" },
  { slug: "data-center", title: "Data Center", category: "Technology", difficulty: 2,
    description: "数据中心是集中部署大量服务器、网络与制冷设施的建筑。\n\nAI 训练与推理在数据中心内完成。一个 AI 数据中心 = 大量 GPU + 高带宽互联 + 海量电力。它是把“算力”变成“服务”的物理场所。" },
  { slug: "electricity", title: "Electricity", category: "Physics", difficulty: 1,
    description: "电力是现代计算的根本能源。\n\n训练大模型消耗巨大电力，数据中心的扩张直接受限于电网与发电能力。AI 的尽头是能源：算力的上限，部分由电力上限决定。" },
  { slug: "neural-network", title: "Neural Network", category: "Technology", difficulty: 3,
    description: "神经网络是一类受生物神经元启发的数学模型。\n\n它由多层“神经元”通过权重连接而成，靠反向传播调整权重来拟合数据。它是深度学习与当代 AI 的数学基础。" },
  { slug: "transformer", title: "Transformer", category: "Technology", difficulty: 4,
    description: "Transformer 是 2017 年提出的神经网络架构，以“自注意力机制”取代循环结构。\n\n它擅长在长序列中建模依赖关系，是 GPT、大模型、多模态系统的共同基石。可以认为：现代 AI 浪潮 = Transformer + 算力 + 数据。" },
  { slug: "linear-algebra", title: "Linear Algebra", category: "Mathematics", difficulty: 1,
    description: "线性代数是研究向量、矩阵与线性变换的数学分支。\n\n神经网络的全部计算本质上都是矩阵乘法。不理解线性代数，就难以真正理解深度学习“为什么能算、为什么能学”。" },
  { slug: "ai-training", title: "AI Training", category: "Technology", difficulty: 3,
    description: "AI 训练是用海量数据调整模型权重的过程。\n\n它需要 GPU 集群、高速互联与稳定电力，周期从几天到数月。训练成本与供给，决定了前沿模型的迭代速度。" },
  { slug: "agent", title: "Agent", category: "Technology", difficulty: 3,
    description: "智能体（Agent）是能感知环境、自主规划并调用工具完成目标的系统。\n\n它建立在大模型（如 Transformer）之上，把“会说话的模型”变成“会做事的助手”。Agent 是 AI 从“生成内容”走向“完成任务”的关键形态。" },
  { slug: "robot", title: "Robot", category: "Technology", difficulty: 3,
    description: "机器人是具身化的智能体，把 AI 的决策落到物理世界。\n\n当 Agent 获得身体（传感器+执行器），便成为机器人。具身智能被认为是 AI 的下一个前沿。" },
  { slug: "supply-chain", title: "Supply Chain", category: "Business", difficulty: 2,
    description: "供应链是从原材料到成品交付的全过程网络。\n\n半导体供应链极长且全球化：设计、设备、材料、制造、封装分散在不同国家。任一环节卡顿，都会传导到终端芯片供给。" },
  { slug: "demand", title: "Demand", category: "Economics", difficulty: 1,
    description: "需求是市场愿意且能够购买的数量。\n\nAI 爆发带来对 GPU、HBM、电力与数据中心的强烈需求，进而拉动上游投资与产能扩张。需求节奏决定产业景气度。" },
  { slug: "inflation", title: "Inflation", category: "Economics", difficulty: 2,
    description: "通货膨胀是一般物价水平的持续上升。\n\n它侵蚀购买力，也会推高原材料与人工成本。通胀是宏观经济的核心变量之一。" },
  { slug: "interest-rate", title: "Interest Rate", category: "Economics", difficulty: 2,
    description: "利率是资金的价格，由中央银行调控。\n\n为抑制通胀，央行往往加息；为刺激经济，往往降息。利率影响投资、估值与资产价格，是连接宏观与市场的枢纽。" },
  { slug: "economy", title: "Economy", category: "Economics", difficulty: 1,
    description: "经济体是生产、分配、交换、消费的总和。\n\n利率、通胀、科技投资共同塑造经济冷热。理解经济，才能理解技术变革的真实代价与红利。" },
  { slug: "cloud", title: "Cloud", category: "Technology", difficulty: 2,
    description: "云计算把算力、存储以服务形式按需提供。\n\nAI 能力大多通过云平台交付。云厂商是 GPU 的最大采购方之一，也是 AI 普惠化的通道。" },
  { slug: "model", title: "Foundation Model", category: "Technology", difficulty: 3,
    description: "基础模型是在海量数据上预训练、可适配多种任务的大模型。\n\n它建立在 Transformer 之上，是 Agent 与应用的底座。模型的规模、数据与训练，决定其能力上限。" },
  { slug: "data", title: "Data", category: "Technology", difficulty: 1,
    description: "数据是训练模型的燃料。\n\n质量、规模与多样性直接决定模型能力。在数据见顶的讨论中，“数据墙”成为前沿训练的新约束。" },

  // ===== 主题精选集（2026-07-17 扩图）：AI/LLM · 机器人 · 半导体 · 金融/市场 · 基础设施 =====
  // —— AI / LLM ——
  { slug: "llm", title: "Large Language Model", category: "AI", difficulty: 4,
    description: "大语言模型（LLM）是在海量文本上预训练、以自回归方式生成自然语言的模型。\n\n它建立在 Transformer 之上，能续写、问答、翻译、编程。GPT 系列是其代表，是现代 AI 应用的直接底座。" },
  { slug: "pretraining", title: "Pretraining", category: "AI", difficulty: 3,
    description: "预训练是在超大规模无标注语料上训练基础模型的过程。\n\n它让模型先“读懂世界”，再经微调适配具体任务。预训练消耗海量 GPU 与数据，是前沿模型壁垒的主要来源。" },
  { slug: "finetuning", title: "Fine-tuning", category: "AI", difficulty: 3,
    description: "微调是在预训练模型上用特定任务数据继续训练，使其适配下游。\n\n从全量微调到 LoRA 等参数高效方法，微调把“通用底座”变成“专用助手”，成本远低于从头训练。" },
  { slug: "rlhf", title: "RLHF", category: "AI", difficulty: 4,
    description: "人类反馈强化学习（RLHF）用人的偏好给模型输出打分，再用强化学习对齐回答。\n\n它是 ChatGPT 类助手“听话、有用、安全”的关键一步，弥补了纯下一词预测在“意图对齐”上的不足。" },
  { slug: "inference", title: "Inference", category: "AI", difficulty: 2,
    description: "推理是模型“用已有权重生成回答”的过程，与训练相对。\n\n推理追求低延迟、高吞吐、低成本，决定了 AI 服务能否规模化交付。它主要受 GPU 算力与显存带宽约束。" },
  { slug: "quantization", title: "Quantization", category: "AI", difficulty: 3,
    description: "量化把模型权重从高精度（如 FP16）压缩到低精度（如 INT8/INT4）。\n\n它显著减小显存占用、提升推理速度，是模型“落地部署”的常用手段，代价是轻微精度损失。" },
  { slug: "moe", title: "Mixture of Experts", category: "AI", difficulty: 4,
    description: "混合专家（MoE）让模型在每次前向只激活部分“专家”子网络。\n\n它以近似稠密模型的参数量获得更低推理成本，是当代前沿大模型扩容的主流架构之一。" },
  { slug: "multimodal", title: "Multimodal", category: "AI", difficulty: 4,
    description: "多模态模型能同时处理文本、图像、音频、视频等多种输入。\n\n它在 LLM 基础上接入视觉/语音编码器，使 AI 从“读字”走向“看世界、听世界”，是 Agent 感知的前提。" },
  { slug: "rag", title: "RAG", category: "AI", difficulty: 3,
    description: "检索增强生成（RAG）在生成前先从知识库检索相关片段，再据以作答。\n\n它让模型“带外部记忆上岗”，缓解幻觉、便于更新知识，是企业落地的主流范式。" },
  { slug: "embedding", title: "Embedding", category: "AI", difficulty: 3,
    description: "向量嵌入把文本/图像映射为稠密向量，使语义相近者距离更近。\n\n它是检索、聚类、去重的基础，RAG 与推荐系统都依赖它。嵌入质量决定了“语义搜索”准不准。" },
  { slug: "attention", title: "Attention", category: "AI", difficulty: 4,
    description: "注意力机制让模型在生成每个词时动态权衡输入各位置的重要性。\n\n它是 Transformer 的核心，取代了 RNN 的顺序依赖，使长序列并行训练成为可能。" },
  { slug: "context-window", title: "Context Window", category: "AI", difficulty: 2,
    description: "上下文窗口是模型单次能“看到”的最大 token 数。\n\n窗口越大，能处理的文档/对话越长，但注意力计算量随长度平方增长，对显存与算力要求陡增。" },
  { slug: "tokenizer", title: "Tokenizer", category: "AI", difficulty: 2,
    description: "分词器把原始文本切成模型可处理的 token（子词/字）。\n\n分词策略影响序列长度与多语种表现，也直接关系到推理成本（token 数=账单）。" },
  { slug: "diffusion", title: "Diffusion", category: "AI", difficulty: 4,
    description: "扩散模型通过逐步去噪从随机噪声生成图像/视频/音频。\n\n它是 Stable Diffusion、Sora 类生成式视觉模型的底座，与自回归 LLM 是两条并行的生成范式。" },
  { slug: "slm", title: "Small Language Model", category: "AI", difficulty: 2,
    description: "小语言模型（SLM）是参数较少、可跑在端侧的轻量模型。\n\n它在成本、隐私、延迟上优于大模型，适合手机/车载等场景，常以“大模型蒸馏”得到。" },
  { slug: "edge-ai", title: "Edge AI", category: "AI", difficulty: 2,
    description: "边缘 AI 把推理放到终端（手机、车、摄像头）而非云端。\n\n它降低延迟与隐私风险，依赖 NPU 与量化后的小模型，是 AI 普惠化的重要形态。" },
  { slug: "agent-memory", title: "Agent Memory", category: "AI", difficulty: 3,
    description: "智能体记忆让 Agent 跨会话保留经验、用户偏好与中间结论。\n\n它把“一次性对话”升级为“可持续进化的助手”，是 Agent 从玩具走向工具的关键能力。" },
  { slug: "tool-use", title: "Tool Use", category: "AI", difficulty: 3,
    description: "工具调用让模型能发起搜索、跑代码、查数据库、操作软件。\n\n它是 Agent“会做事”而非“只会说”的核心，把语言模型接入真实世界行动。" },
  { slug: "evaluation", title: "Evaluation", category: "AI", difficulty: 3,
    description: "评测用基准（Benchmark）与人工打分衡量模型能力。\n\n没有评测就没有进步：它决定模型迭代方向，也揭示幻觉、偏见与失效边界。" },
  { slug: "guardrail", title: "Guardrail", category: "AI", difficulty: 2,
    description: "安全护栏是约束模型输出、拦截有害内容的规则与过滤器。\n\n它在有用性与安全性之间设边界，是企业合规部署 LLM 的必选项。" },

  // —— 机器人 / 具身 ——
  { slug: "actuator", title: "Actuator", category: "Robotics", difficulty: 3,
    description: "执行器把电信号转为物理动作（电机、液压、气动）。\n\n它是机器人的“肌肉”，决定了力量、精度与速度，也是人形机器人量产的难点。" },
  { slug: "sensor", title: "Sensor", category: "Robotics", difficulty: 2,
    description: "传感器（相机、激光雷达、IMU、力觉）让机器人感知世界。\n\n它是具身智能的入口，数据质量直接决定感知与控制的下限。" },
  { slug: "kinematics", title: "Kinematics", category: "Robotics", difficulty: 3,
    description: "运动学研究物体（关节、连杆）的空间运动而不考虑受力。\n\n它是机械臂/人形规划动作的基础数学，正运动学求末端位姿、逆运动学求关节角。" },
  { slug: "control-theory", title: "Control Theory", category: "Robotics", difficulty: 4,
    description: "控制理论用反馈闭环让系统稳定追踪目标（PID、LQR 等）。\n\n它是机器人“动得稳”的底层，与线性代数、最优化紧密相关。" },
  { slug: "slam", title: "SLAM", category: "Robotics", difficulty: 4,
    description: "SLAM（同步定位与建图）让机器人在未知环境边走边建地图并定位自身。\n\n它是移动机器人/自动驾驶的刚需，融合激光、视觉与里程计数据。" },
  { slug: "imitation-learning", title: "Imitation Learning", category: "Robotics", difficulty: 3,
    description: "模仿学习让模型从人类示教中直接学策略（行为克隆）。\n\n它比从零强化学习快得多，是机器人“先照着做、再自己练”的常用起点。" },
  { slug: "reinforcement-learning", title: "Reinforcement Learning", category: "AI", difficulty: 4,
    description: "强化学习让智能体在环境中试错、靠奖励信号优化策略。\n\n它在博弈、控制、LLM 对齐（RLHF）中卓有成效，但样本效率低、调参难。" },
  { slug: "sim-to-real", title: "Sim-to-Real", category: "Robotics", difficulty: 3,
    description: "仿真到现实把在模拟器里训好的策略迁移到真实机器人。\n\n它用廉价仿真替代昂贵的真实试错，但需克服“现实差距”（动力学/传感器差异）。" },
  { slug: "dexterity", title: "Dexterity", category: "Robotics", difficulty: 3,
    description: "灵巧操作指机器人完成抓、捏、插、拧等精细手部动作。\n\n它是人形机器人实用化的最后堡垒，依赖高自由度手、力控与触觉反馈。" },
  { slug: "humanoid", title: "Humanoid", category: "Robotics", difficulty: 3,
    description: "人形机器人以双足、双臂、类人形态适应为人类设计的环境。\n\n它无需改造世界即可上岗（工厂、家庭），但平衡、泛化与成本仍是挑战。" },
  { slug: "embodied-ai", title: "Embodied AI", category: "Robotics", difficulty: 4,
    description: "具身智能让 AI 拥有身体，在物理世界中感知—决策—行动。\n\n它被认为是从“语言智能”走向“通用智能”的下一前沿，依赖机器人+大模型。" },
  { slug: "computer-vision", title: "Computer Vision", category: "AI", difficulty: 3,
    description: "计算机视觉让机器理解图像与视频（检测、分割、识别）。\n\n它建立在神经网络之上，是感知、自动驾驶、机器人的眼睛。" },
  { slug: "perception", title: "Perception", category: "Robotics", difficulty: 3,
    description: "感知把多传感器数据融合为对环境的统一理解。\n\n它依赖计算机视觉与传感器，是机器人“看得见、认得清”的前提。" },

  // —— 半导体 / 硬件 ——
  { slug: "asic", title: "ASIC", category: "Semiconductor", difficulty: 3,
    description: "专用集成电路（ASIC）为特定任务定制，效率远高于通用芯片。\n\nTPU、NPU、矿机等都是 ASIC，在 AI 推理/训练中与 GPU 形成替代与互补。" },
  { slug: "npu", title: "NPU", category: "Semiconductor", difficulty: 3,
    description: "神经网络处理器（NPU）专为矩阵/卷积运算设计，主打端侧低功耗。\n\n它让手机、汽车能本地跑小模型（Edge AI），是端侧智能的核心。" },
  { slug: "cowos", title: "CoWoS", category: "Semiconductor", difficulty: 4,
    description: "CoWoS 是台积电的先进封装技术，把 GPU 裸片与 HBM 高密度互联。\n\n它是高端 AI 芯片算力的关键封装环节，当前供给极度紧张，是产能瓶颈之一。" },
  { slug: "euv", title: "EUV Lithography", category: "Semiconductor", difficulty: 4,
    description: "极紫外（EUV）光刻用 13.5nm 波长在晶圆上刻出纳米级电路。\n\n它是先进制程（≤7nm）的唯一路径，设备由 ASML 独家供应，是地缘焦点。" },
  { slug: "foundry", title: "Foundry", category: "Semiconductor", difficulty: 2,
    description: "晶圆代工替设计公司制造芯片，不卖自有品牌。\n\n台积电、三星、中芯是主要玩家；产能与良率决定全球芯片供给节奏。" },
  { slug: "wafer", title: "Wafer", category: "Semiconductor", difficulty: 2,
    description: "晶圆是制造芯片的圆形硅基底，一片可切出数百颗芯片。\n\n良率（合格 die 比例）直接决定单颗成本，是制造经济学的核心。" },
  { slug: "eda", title: "EDA", category: "Semiconductor", difficulty: 3,
    description: "EDA（电子设计自动化）工具链负责芯片从设计到版图验证。\n\n它被 Synopsys/Cadence/西门子三家垄断，是芯片设计无法绕开的“工业软件”。" },
  { slug: "ip-core", title: "IP Core", category: "Semiconductor", difficulty: 2,
    description: "IP 核是可复用的电路模块（CPU、接口、PHY），设计公司买来拼装。\n\n它降低了芯片设计门槛，ARM 架构即最典型的授权 IP。" },
  { slug: "chiplet", title: "Chiplet", category: "Semiconductor", difficulty: 3,
    description: "小芯片（Chiplet）把大芯片拆成多个小裸片，再先进封装互联。\n\n它用成熟制程拼出高性能，规避单 die 良率与光刻限制，是后摩尔时代主流路线。" },
  { slug: "advanced-packaging", title: "Advanced Packaging", category: "Semiconductor", difficulty: 3,
    description: "先进封装在制造之后把多裸片高密度集成，提升带宽与能效。\n\n当制程逼近物理极限，封装成为算力提升的新战场（CoWoS、Chiplet 皆属此）。" },

  // —— 金融 / 市场 ——
  { slug: "equity", title: "Equity", category: "Finance", difficulty: 2,
    description: "股票（权益）代表对公司的一部分所有权，收益来自资本利得与分红。\n\n它是企业融资与居民投资的核心载体，价格由预期与资金共同决定。" },
  { slug: "bond", title: "Bond", category: "Finance", difficulty: 2,
    description: "债券是借款人向持有人按期付息、到期还本的债务凭证。\n\n它与股票构成资产两端：债看票息与信用，股看成长与风险，二者常负向轮动。" },
  { slug: "valuation", title: "Valuation", category: "Finance", difficulty: 3,
    description: "估值是对资产内在价值的计算，是投资决策的锚。\n\n方法分绝对（DCF）与相对（倍数），本质是给不确定的未来现金流定价。" },
  { slug: "dcf", title: "DCF", category: "Finance", difficulty: 4,
    description: "现金流折现（DCF）把未来自由现金流按贴现率折算为当前价值。\n\n它是估值的黄金基准，但对增长率与折现率极度敏感，小参数大结论。" },
  { slug: "capm", title: "CAPM", category: "Finance", difficulty: 3,
    description: "资本资产定价模型（CAPM）用系统性风险（β）定价的预期收益。\n\n它给出“承担市场风险应得多少补偿”，是组合与估值的理论基石。" },
  { slug: "risk-premium", title: "Risk Premium", category: "Finance", difficulty: 3,
    description: "风险溢价是投资者承担额外风险要求的超额回报。\n\n股权风险溢价决定股市长期吸引力，受利率、恐慌与流动性影响。" },
  { slug: "etf", title: "ETF", category: "Finance", difficulty: 2,
    description: "交易型开放式指数基金（ETF）在交易所买卖、跟踪一篮子资产。\n\n它费低、透明、分散，是个人配置赛道（如机器人、创新药）的优选工具。" },
  { slug: "index-fund", title: "Index Fund", category: "Finance", difficulty: 1,
    description: "指数基金被动跟踪某个指数（如沪深300、标普500）。\n\n它不押个股、长期跑赢多数主动基金，是“懒人投资”的基石。" },
  { slug: "liquidity", title: "Liquidity", category: "Finance", difficulty: 2,
    description: "流动性指资产能以合理价格快速买卖的程度。\n\n它由货币与信贷供给决定：流动性宽松则风险资产普涨，紧缩则杀估值。" },
  { slug: "earnings", title: "Earnings", category: "Finance", difficulty: 2,
    description: "盈利是公司一段时期的净利润，是股价的根本支撑。\n\n市场既看绝对盈利，也看增速与指引；预期差往往比绝对值更驱动股价。" },
  { slug: "pe-ratio", title: "P/E Ratio", category: "Finance", difficulty: 2,
    description: "市盈率（P/E）= 股价 / 每股收益，是最常用的相对估值倍数。\n\n它高代表市场给成长更高期待，也意味着更拥挤、对失望更敏感。" },
  { slug: "roe", title: "ROE", category: "Finance", difficulty: 2,
    description: "净资产收益率（ROE）= 净利润 / 净资产，衡量股东回报效率。\n\n高且稳定的 ROE 是优质公司的标志，巴菲特式选股的核心指标。" },
  { slug: "moat", title: "Moat", category: "Finance", difficulty: 2,
    description: "护城河是阻止竞争对手侵蚀利润的持续优势（品牌、网络、牌照）。\n\n它决定高 ROE 能否维持，是长期复利的前提。" },
  { slug: "cyclicality", title: "Cyclicality", category: "Finance", difficulty: 2,
    description: "周期性指业绩随宏观冷热大幅波动的特性。\n\n半导体、可选消费属强周期，公用事业、必选消费偏防御；仓位需顺周期调节。" },
  { slug: "capex", title: "Capex", category: "Finance", difficulty: 2,
    description: "资本开支（Capex）是企业购置长期资产的投入。\n\nAI 数据中心的巨额 Capex 拉动半导体与电力需求，是产业景气的领先指标。" },
  { slug: "fcf", title: "Free Cash Flow", category: "Finance", difficulty: 3,
    description: "自由现金流是扣非、扣必要开支后真正可自由支配的现金。\n\n它是 DCF 的基石，比会计利润更难操纵，更能反映企业真实现金生成能力。" },
  { slug: "sector-rotation", title: "Sector Rotation", category: "Finance", difficulty: 2,
    description: "板块轮动是资金在不同行业间随景气与政策迁移。\n\n典型如 AI→机器人→创新药的赛道接力；把握轮动是相对收益的来源之一。" },
  { slug: "monetary-policy", title: "Monetary Policy", category: "Finance", difficulty: 3,
    description: "货币政策由央行通过利率与购债调节货币与信用。\n\n宽松推升资产价格、宽松流动性；紧缩则压制估值，是市场的宏观主线。" },
  { slug: "fiscal-policy", title: "Fiscal Policy", category: "Finance", difficulty: 2,
    description: "财政政策由政府通过税收与支出影响经济。\n\n基建、补贴、减税直接拉动需求与产业（如半导体补贴），与货币配合定冷热。" },

  // —— 基础设施 / 跨簇 ——
  { slug: "networking", title: "Networking", category: "Infrastructure", difficulty: 2,
    description: "网络互联把算力节点连成集群。\n\n万卡训练靠高速网络（IB/光）同步梯度，网络带宽与拓扑直接决定集群有效算力，是 AI 基础设施的隐形瓶颈。" },
  { slug: "infiniband", title: "InfiniBand", category: "Infrastructure", difficulty: 3,
    description: "InfiniBand 是 AI 集群常用的高带宽、低延迟网络。\n\n万卡训练要求 GPU 间极速互联，IB 与 NVLink 共同决定集群有效算力。" },
  { slug: "optical", title: "Optical Module", category: "Infrastructure", difficulty: 3,
    description: "光模块在电与光信号间转换，是数据中心互联的物理层。\n\n800G/1.6T 光模块随 AI 带宽需求升级，是算力网络的弹性环节。" },
  { slug: "cooling", title: "Liquid Cooling", category: "Infrastructure", difficulty: 2,
    description: "液冷用液体带走服务器热量，效率远高于风冷。\n\n高功率 AI 芯片使液冷从可选项变必选项，是数据中心 PUE 的关键。" },
  { slug: "power-grid", title: "Power Grid", category: "Infrastructure", difficulty: 2,
    description: "电网把发电输送到负载，是 AI 算力的终极约束之一。\n\n数据中心扩张受限于当地供电与并网周期，算力上限部分由电网决定。" },
];

// source -> target : relation
const EDGES = [
  ["gpu", "cuda", "ENABLE"],
  ["gpu", "hbm", "DEPEND_ON"],
  ["gpu", "tsmc", "DEPEND_ON"],
  ["gpu", "chip", "PART_OF"],
  ["cuda", "neural-network", "DEPEND_ON"],
  ["hbm", "tsmc", "DEPEND_ON"],
  ["hbm", "data-center", "PART_OF"],
  ["tsmc", "semiconductor", "PART_OF"],
  ["chip", "semiconductor", "PART_OF"],
  ["data-center", "gpu", "PART_OF"],
  ["data-center", "electricity", "DEPEND_ON"],
  ["data-center", "cloud", "PART_OF"],
  ["neural-network", "linear-algebra", "DEPEND_ON"],
  ["transformer", "neural-network", "EXTENDS"],
  ["transformer", "linear-algebra", "DEPEND_ON"],
  ["ai-training", "gpu", "DEPEND_ON"],
  ["ai-training", "data-center", "DEPEND_ON"],
  ["model", "transformer", "DEPEND_ON"],
  ["model", "data", "DEPEND_ON"],
  ["agent", "model", "DEPEND_ON"],
  ["agent", "ai-training", "DEPEND_ON"],
  ["robot", "agent", "DEPEND_ON"],
  ["robot", "model", "DEPEND_ON"],
  ["semiconductor", "supply-chain", "DEPEND_ON"],
  ["hbm", "supply-chain", "DEPEND_ON"],
  ["gpu", "demand", "CAUSE"],
  ["ai-training", "demand", "CAUSE"],
  ["inflation", "interest-rate", "CAUSE"],
  ["interest-rate", "economy", "CAUSE"],
  ["inflation", "economy", "CAUSE"],
  ["cloud", "demand", "CAUSE"],
  ["data", "model", "ENABLE"],
  ["agent", "robot", "ENABLE"],

  // ===== 主题精选集边（2026-07-17） =====
  // AI / LLM 内部
  ["llm", "transformer", "DEPEND_ON"],
  ["llm", "data", "DEPEND_ON"],
  ["llm", "pretraining", "DEPEND_ON"],
  ["llm", "tokenizer", "PART_OF"],
  ["llm", "attention", "PART_OF"],
  ["llm", "context-window", "PART_OF"],
  ["llm", "evaluation", "PART_OF"],
  ["llm", "guardrail", "PART_OF"],
  ["llm", "moe", "EXTENDS"],
  ["llm", "multimodal", "EXTENDS"],
  ["llm", "slm", "EXTENDS"],
  ["pretraining", "gpu", "DEPEND_ON"],
  ["pretraining", "data-center", "DEPEND_ON"],
  ["finetuning", "pretraining", "EXTENDS"],
  ["rlhf", "finetuning", "DEPEND_ON"],
  ["inference", "gpu", "DEPEND_ON"],
  ["inference", "quantization", "DEPEND_ON"],
  ["quantization", "slm", "ENABLE"],
  ["moe", "llm", "PART_OF"],
  ["multimodal", "computer-vision", "DEPEND_ON"],
  ["rag", "embedding", "DEPEND_ON"],
  ["rag", "llm", "DEPEND_ON"],
  ["embedding", "linear-algebra", "DEPEND_ON"],
  ["attention", "linear-algebra", "DEPEND_ON"],
  ["context-window", "hbm", "DEPEND_ON"],
  ["diffusion", "neural-network", "EXTENDS"],
  ["slm", "edge-ai", "ENABLE"],
  ["edge-ai", "npu", "DEPEND_ON"],
  ["edge-ai", "chip", "DEPEND_ON"],
  ["agent-memory", "agent", "PART_OF"],
  ["tool-use", "agent", "PART_OF"],

  // 机器人 / 具身
  ["actuator", "robot", "PART_OF"],
  ["sensor", "robot", "PART_OF"],
  ["kinematics", "robot", "PART_OF"],
  ["control-theory", "kinematics", "DEPEND_ON"],
  ["control-theory", "linear-algebra", "DEPEND_ON"],
  ["slam", "perception", "PART_OF"],
  ["slam", "sensor", "DEPEND_ON"],
  ["imitation-learning", "neural-network", "EXTENDS"],
  ["reinforcement-learning", "neural-network", "EXTENDS"],
  ["reinforcement-learning", "rlhf", "ENABLE"],
  ["sim-to-real", "reinforcement-learning", "PART_OF"],
  ["dexterity", "robot", "PART_OF"],
  ["humanoid", "robot", "PART_OF"],
  ["embodied-ai", "robot", "DEPEND_ON"],
  ["embodied-ai", "model", "DEPEND_ON"],
  ["computer-vision", "neural-network", "EXTENDS"],
  ["perception", "computer-vision", "DEPEND_ON"],
  ["perception", "sensor", "DEPEND_ON"],
  ["robot", "semiconductor", "DEPEND_ON"],
  ["robot", "demand", "CAUSE"],

  // 半导体 / 硬件
  ["asic", "chip", "PART_OF"],
  ["npu", "chip", "PART_OF"],
  ["npu", "ai-training", "DEPEND_ON"],
  ["cowos", "advanced-packaging", "PART_OF"],
  ["cowos", "hbm", "DEPEND_ON"],
  ["euv", "foundry", "PART_OF"],
  ["foundry", "tsmc", "PART_OF"],
  ["foundry", "semiconductor", "PART_OF"],
  ["wafer", "chip", "PART_OF"],
  ["eda", "chip", "PART_OF"],
  ["ip-core", "chip", "PART_OF"],
  ["chiplet", "advanced-packaging", "PART_OF"],
  ["advanced-packaging", "semiconductor", "PART_OF"],
  ["advanced-packaging", "hbm", "DEPEND_ON"],
  ["euv", "supply-chain", "DEPEND_ON"],

  // 金融 / 市场
  ["equity", "economy", "PART_OF"],
  ["bond", "economy", "PART_OF"],
  ["valuation", "earnings", "DEPEND_ON"],
  ["valuation", "fcf", "DEPEND_ON"],
  ["dcf", "valuation", "PART_OF"],
  ["dcf", "fcf", "DEPEND_ON"],
  ["capm", "valuation", "PART_OF"],
  ["risk-premium", "equity", "PART_OF"],
  ["etf", "equity", "PART_OF"],
  ["index-fund", "etf", "PART_OF"],
  ["liquidity", "monetary-policy", "DEPEND_ON"],
  ["earnings", "equity", "PART_OF"],
  ["pe-ratio", "valuation", "PART_OF"],
  ["roe", "earnings", "PART_OF"],
  ["moat", "equity", "PART_OF"],
  ["cyclicality", "economy", "PART_OF"],
  ["capex", "fcf", "DEPEND_ON"],
  ["capex", "semiconductor", "DEPEND_ON"],
  ["sector-rotation", "equity", "PART_OF"],
  ["monetary-policy", "economy", "CAUSE"],
  ["monetary-policy", "interest-rate", "CAUSE"],
  ["fiscal-policy", "economy", "CAUSE"],

  // 基础设施 / 跨簇
  ["infiniband", "networking", "PART_OF"],
  ["infiniband", "data-center", "DEPEND_ON"],
  ["optical", "networking", "PART_OF"],
  ["optical", "data-center", "DEPEND_ON"],
  ["cooling", "data-center", "PART_OF"],
  ["power-grid", "data-center", "DEPEND_ON"],
  ["power-grid", "electricity", "DEPEND_ON"],
  ["networking", "data-center", "PART_OF"],

  // 跨簇：AI/产业 → 需求
  ["llm", "demand", "CAUSE"],
  ["ai-training", "demand", "CAUSE"],
  ["capex", "demand", "CAUSE"],
  ["semiconductor", "demand", "CAUSE"],
  ["economy", "demand", "CAUSE"],
  ["gpu", "demand", "CAUSE"],
  ["hbm", "demand", "CAUSE"],
];

async function main() {
  // 1) default user
  const user = await prisma.user.upsert({
    where: { id: "default-user" },
    update: {},
    create: { id: "default-user", name: DEFAULT_NAME },
  });
  console.log("user:", user.id);

  // 2) concepts (upsert by slug)
  const slugToId = new Map();
  for (const n of NODES) {
    const created = await prisma.knowledgeNode.upsert({
      where: { slug: n.slug },
      update: { title: n.title, category: n.category, difficulty: n.difficulty, description: n.description },
      create: { slug: n.slug, title: n.title, category: n.category, difficulty: n.difficulty, description: n.description },
    });
    slugToId.set(n.slug, created.id);
  }
  console.log("nodes:", slugToId.size);

  // 3) edges (upsert by unique triple)
  let edgeCount = 0;
  for (const [s, t, rel] of EDGES) {
    const sourceNodeId = slugToId.get(s);
    const targetNodeId = slugToId.get(t);
    if (!sourceNodeId || !targetNodeId) continue;
    await prisma.knowledgeEdge.upsert({
      where: { sourceNodeId_targetNodeId_relation: { sourceNodeId, targetNodeId, relation: rel } },
      update: {},
      create: { sourceNodeId, targetNodeId, relation: rel },
    });
    edgeCount++;
  }
  console.log("edges:", edgeCount);

  // 4) ensure ability + daily stats exist for the user
  await prisma.ability.upsert({
    where: { id: "default-ability" },
    update: {},
    create: { id: "default-ability", userId: user.id, observe: 50, understand: 50, connect: 50, reason: 50, predict: 50, update: 50 },
  });
  await prisma.dailyStatistics.upsert({
    where: { id: "default-stats" },
    update: {},
    create: { id: "default-stats", userId: user.id, missionCount: 0, predictionCount: 0, knowledgeCount: 0, currentStreak: 0, longestStreak: 0 },
  });
  console.log("seed done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
