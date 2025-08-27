import requests
import json

# API a-pi
# BASE_URL = "http://127.0.0.1:5001"
BASE_URL="https://study-platform.zeabur.app"
DETECT_URL = f"{BASE_URL}/api/task/update/detect"
EXECUTE_URL = f"{BASE_URL}/api/task/update/execute"

task_data = {'type': 'coding', 'difficulty': 'intermediate', 'ppt_slide': '# 使用工具进行简单大模型的训练操作\n## 工具选择\n选择合适的工具对于大模型训练至关重要，常见的有TensorFlow、PyTorch等。这些工具提供了丰富的API和优化器，能帮助我们更高效地完成训练。例如，PyTorch的动态图特性使得模型的构建和调试更加灵活。\n## 数据加载\n在工具中加载已处理好的数据，要注意数据的格式和批次大小。以PyTorch为例，可使用DataLoader类来批量加载数据，这样能提高训练效率。例如：\n```python\nfrom torch.utils.data import DataLoader\nloader = DataLoader(dataset, batch_size=32, shuffle=True)\n```\n## 模型构建\n依据所选工具，按照大模型架构搭建模型。在PyTorch里，可通过继承`nn.Module`类来定义模型结构。\n## 训练过程\n使用优化器和损失函数对模型进行训练，不断迭代更新模型参数，直到达到理想的效果。', 'questions': [{'question': '以下哪个是常见的大模型训练工具？', 'type': 'choice', 'options': ['Scikit - learn', 'PyTorch', 'Numpy'], 'answer': 'PyTorch'}, {'question': '在PyTorch中，用于批量加载数据的类是？', 'type': 'choice', 'options': ['DataLoader', 'DataSet', 'ModelLoader'], 'answer': 'DataLoader'}, {'question': '在PyTorch里，定义模型结构通常继承自哪个类？', 'type': 'choice', 'options': ['nn.Module', 'nn.Linear', 'nn.Conv2d'], 'answer': 'nn.Module'}], 'task': {'title': '使用PyTorch进行简单大模型训练', 'description': '使用PyTorch构建一个简单的全连接神经网络模型，并对给定的数据集进行训练。要求定义模型结构，加载数据，选择合适的优化器和损失函数，进行5个epoch的训练，并打印每个epoch的损失值。', 'starter_code': '```python\nimport torch\nimport torch.nn as nn\nfrom torch.utils.data import DataLoader\n\n# 假设已有数据集dataset\n# dataset = ...\n\n# 定义模型\nclass SimpleModel(nn.Module):\n    def __init__(self):\n        super(SimpleModel, self).__init__()\n        # 这里可以开始定义模型的层\n\n    def forward(self, x):\n        # 这里定义前向传播过程\n        return x\n\n# 创建模型实例\nmodel = SimpleModel()\n\n# 定义优化器和损失函数\noptimizer = ...\nloss_function = ...\n\n# 数据加载\nloader = DataLoader(dataset, batch_size=32, shuffle=True)\n\n# 训练循环\nfor epoch in range(5):\n    for data in loader:\n        # 这里完成训练步骤\n        pass\n```', 'answer': "```python\nimport torch\nimport torch.nn as nn\nfrom torch.utils.data import DataLoader\n\n# 假设已有数据集dataset\n# dataset = ...\n\n# 定义模型\nclass SimpleModel(nn.Module):\n    def __init__(self):\n        super(SimpleModel, self).__init__()\n        self.fc1 = nn.Linear(10, 20)\n        self.fc2 = nn.Linear(20, 1)\n\n    def forward(self, x):\n        x = torch.relu(self.fc1(x))\n        x = self.fc2(x)\n        return x\n\n# 创建模型实例\nmodel = SimpleModel()\n\n# 定义优化器和损失函数\noptimizer = torch.optim.Adam(model.parameters(), lr=0.001)\nloss_function = nn.MSELoss()\n\n# 数据加载\nloader = DataLoader(dataset, batch_size=32, shuffle=True)\n\n# 训练循环\nfor epoch in range(5):\n    running_loss = 0.0\n    for data in loader:\n        inputs, labels = data\n        optimizer.zero_grad()\n        outputs = model(inputs)\n        loss = loss_function(outputs, labels)\n        loss.backward()\n        optimizer.step()\n        running_loss += loss.item()\n    print(f'Epoch {epoch + 1}, Loss: {running_loss / len(loader)}')\n```"}, 'videos': [{'title': '原来大模型还可以这么训练？干得漂亮！', 'url': 'http://www.bilibili.com/video/av1356182736', 'cover': '//i0.hdslb.com/bfs/archive/a0d8f0c2a9aadcc56101c9afe8c4ebb5dfbfd782.jpg', 'duration': '7:25'}, {'title': '【喂饭教程】30分钟学会Qwen2.5-7B微调行业大模型，环境配置+模型微调+模型部署+效果展示详细教程！草履虫都能学会~~~', 'url': 'http://www.bilibili.com/video/av114096393423986', 'cover': '//i0.hdslb.com/bfs/archive/aa0cab99f2ce6dcd58f4c816aa1fb7a34cd5639b.jpg', 'duration': '27:41'}, {'title': 'Deepseek大模型全参数微调训练实践 | 大模型课程分享', 'url': 'http://www.bilibili.com/video/av114200093399212', 'cover': '//i2.hdslb.com/bfs/archive/b70f7e9b21ab37b44870900685e5692bce49f8c1.jpg', 'duration': '28:51'}, {'title': '【AI大模型】十分钟彻底搞懂AI大模型底层原理！带你从0构建对大模型的认知！小白也能看懂！', 'url': 'http://www.bilibili.com/video/av113677265081065', 'cover': '//i2.hdslb.com/bfs/archive/19abee31e45cbf994f8f9ad05dd39b376403cfed.jpg', 'duration': '43:59'}], 'web_res': {'query': '大模型训练实践', 'follow_up_questions': None, 'answer': '本项目是一个系统性的LLM 学习教程，将从NLP 的基本研究方法出发，根据LLM 的思路及原理逐层深入，依次为读者剖析LLM 的架构基础和训练过程。同时，我们会结合目前LLM 领域最 ...', 'images': [], 'results': [{'url': 'https://github.com/datawhalechina/happy-llm', 'title': 'datawhalechina/happy-llm: 从零开始的大语言模型原理与实践教程', 'content': '本项目是一个系统性的LLM 学习教程，将从NLP 的基本研究方法出发，根据LLM 的思路及原理逐层深入，依次为读者剖析LLM 的架构基础和训练过程。同时，我们会结合目前LLM 领域最 ...', 'score': None, 'raw_content': None}, {'url': 'https://github.com/liguodongiot/llm-action', 'title': 'GitHub - liguodongiot/llm-action: 本项目旨在分享大模型相关技术原理 ...', 'content': '下面汇总了我在大模型实践中训练相关的所有教程。从6B到65B，从全量微调到高效微调（LoRA，QLoRA，P-Tuning v2），再到RLHF（基于人工反馈的强化学习）。', 'score': None, 'raw_content': None}, {'url': 'https://zhuanlan.zhihu.com/p/682907673', 'title': '大模型实学习路线-从理论到实践 - 知乎专栏', 'content': '大模型初创或大厂自研大模型岗，具体有预训练组、后训练组（微调、强化学习对齐）、评测组、数据组、Infra优化组，但偏难。更多是大模型应用算法。 参考项目. 1、手把手教学 ...', 'score': None, 'raw_content': None}, {'url': 'https://aws.amazon.com/cn/blogs/china/practical-series-on-fine-tuning-large-language-models-part-one/', 'title': '炼石成丹：大语言模型微调实战系列（一）数据准备篇 - AWS', 'content': '利用社交平台的真实对话数据可以大大提高微调效果， 我们可以从常见的聊天工具或者社交平台上导出数据，作为训练数据，比如使用开源工具（如WeChatMsg）将聊天 ...', 'score': None, 'raw_content': None}, {'url': 'https://intro-llm.github.io/', 'title': '大规模语言模型：从理论到实践', 'content': '本书将介绍大语言模型的基础理论包括语言模型、分布式模型训练以及强化学习，并以Deepspeed-Chat框架为例介绍实现大语言模型和类ChatGPT系统的实践。 image. 张奇. 复旦大学 ...', 'score': None, 'raw_content': None}, {'url': 'https://pdf.dfcfw.com/pdf/H3_AP202502171643162092_1.pdf?1739804714000.pdf', 'title': '[PDF] 大模型概念、技术与应用实践', 'content': '本报告《大模型概念、技术与应用实践》将深入剖析大模型的. 核心 ... 练模型包含了预训练大模型（可以简称为“大模型”），预训练大模型包含了预 ...', 'score': None, 'raw_content': None}, {'url': 'https://www.infoq.cn/article/f55mgfyxqunuk6s1cqa1', 'title': '万字干货！手把手教你如何训练超大规模集群下的大语言模型| QCon', 'content': '快手总结了一套超大规模集群下大语言模型训练方案。该方案在超长文本场景下，在不改变模型表现的情况下，训练效率相较SOTA 开源方案，有显著的吞吐提升。', 'score': None, 'raw_content': None}, {'url': 'https://developer.nvidia.com/zh-cn/blog/fp8-llm-app-challenges/', 'title': 'FP8 在大模型训练中的应用、挑战及实践 - NVIDIA Developer', 'content': 'FP8 的训练效果我们一般通过观察Loss 曲线或下游任务的指标来进行评估。比如，会检查Loss 是否发散，从而判断FP8 是否有问题。同时我们也希望找到一些其他 ...', 'score': None, 'raw_content': None}, {'url': 'https://www.hiascend.com/developer/techArticles/20250623-1', 'title': '基于昇腾MindSpeed LLM的大模型微调训练实践-技术干货', 'content': '基于MindSpeed LLM高效分布式微调训练的关键特性 · 提供120+主流大模型，20种Handler风格数据集灵活切换 · 支持梯度累积/Zero冗余优化器/内存卸载/组合并行 ...', 'score': None, 'raw_content': None}, {'url': 'https://blog.csdn.net/qq_27590277/article/details/136425988', 'title': '从0开始预训练1.4b中文大模型实践 - CSDN博客', 'content': '在大模型的预训练中，数据准备与清洗是首要步骤，直接影响模型的性能和泛化能力。数据的收集应覆盖尽可能广泛的领域，确保多样性和代表性。清洗过程包括去重 ...', 'score': None, 'raw_content': None}], 'response_time': 2.200093509047292}, 'search_keyword': '大模型训练实践'}

# --- Test for /api/task/update/detect ---
print(f"--- Testing {DETECT_URL} ---")
detect_payload = {
    "task_data": task_data,
    "user_message": "This is too basic for me. Can we go deeper into the implementation details?",
    "lang": "zh",
    "chat_id": "test_chat_123"
}

print(f"Request data: {json.dumps(detect_payload, indent=2, ensure_ascii=False)}")

try:
    response = requests.post(DETECT_URL, json=detect_payload)
    response.raise_for_status()
    print("Response:")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
except requests.exceptions.RequestException as e:
    print(f"\nRequest failed: {e}")
    if e.response is not None:
        print(f"Error response: {e.response.text}")

print("\n" + "="*50 + "\n")

print(f"--- Testing {EXECUTE_URL} ---")
execute_payload = {
    "task_data": task_data,
    "suggestion": response.json()['result']['suggestion'],
    "lang": "en",
    "chat_id": "test_chat_456"
}

print(f"Request data: {json.dumps(execute_payload, indent=2, ensure_ascii=False)}")

try:
    response = requests.post(EXECUTE_URL, json=execute_payload)
    response.raise_for_status()
    print("Response:")
    print(json.dumps(response.json(), indent=2, ensure_ascii=False))
except requests.exceptions.RequestException as e:
    print(f"\nRequest failed: {e}")
    if e.response is not None:
        print(f"Error response: {e.response.text}") 