const AGENT_WORKSPACE_CONFIG = window.AGENT_WORKSPACE || {
  variant: "catalog",
  title: "Agent 目录工作台",
  storageKey: "ontology3.agent-application.catalog.v8",
  initialRoute: "agents"
};

const AGENT_PROMPTS = [
  {
    id: "prompt-finance-evidence",
    name: "融资证据解释边界",
    owner: "Agent 应用",
    versions: [
      {
        version: "1.2",
        status: "published",
        validatedAt: "2026-08-11 09:12",
        change: "补充 Action 请求候选的证据完整性限制",
        variables: ["任务目标", "固定证据包", "Published 语义引用", "输出合同"],
        contextBoundary: "只接收本次 Generation Evidence Package 中的结构化事实、质量摘要与精确版本引用。",
        outputContracts: ["AI Insight v1"],
        sections: [
          { title: "任务", body: "解释融资指标、Rule 命中和主体归因证据，输出可追溯的结构化洞察与行动候选。" },
          { title: "证据边界", body: "只能使用调用方固定的证据包和其中引用的 Published 资源，不补查企业原始数据，不自行选择当前版本。" },
          { title: "输出要求", body: "每项结论携带证据引用、适用范围、限制、生成时间与未确认状态。" },
          { title: "禁止事项", body: "不得生成 Metric 公式、修改 Rule、替代确定性计算、确认 Action 或创建负责人待办。" }
        ]
      },
      {
        version: "1.1",
        status: "history",
        validatedAt: "2026-07-28 16:40",
        change: "建立固定证据解释与引用要求",
        variables: ["任务目标", "固定证据包", "Published 语义引用"],
        contextBoundary: "只接收固定融资证据包。",
        outputContracts: ["AI Insight v1"],
        sections: [
          { title: "任务", body: "基于固定融资证据形成结构化洞察。" },
          { title: "证据边界", body: "不得使用包外数据。" },
          { title: "输出要求", body: "输出结论、证据与限制。" },
          { title: "禁止事项", body: "不得替代 Metric、Rule 或 Action Type 定义。" }
        ]
      }
    ]
  },
  {
    id: "prompt-report-reading",
    name: "报告固定上下文伴读边界",
    owner: "Agent 应用",
    versions: [
      {
        version: "1.0",
        status: "published",
        validatedAt: "2026-08-11 10:02",
        change: "建立报告版本、稳定锚点与固定证据约束",
        variables: ["问题", "报告内容版本", "稳定锚点", "固定证据包", "核验结果引用"],
        contextBoundary: "只解释报告中心提交并由 Agent 应用正式绑定的报告版本、锚点快照和证据引用。",
        outputContracts: ["Report Copilot Answer v1"],
        sections: [
          { title: "任务", body: "回答报告全文、章节或选区问题，解释指标口径、Rule 命中、证据来源与确定性核验结果。" },
          { title: "证据边界", body: "默认停留在报告固定证据包；上下文变化时不得沿用旧回答。" },
          { title: "输出要求", body: "回答必须给出证据、语义与数据版本、截至时间、质量、新鲜度、生成时间和确认状态。" },
          { title: "禁止事项", body: "不得重算差异、修改报告、创建复核问题、请求重新生成、发布报告或扩大到企业全部数据。" }
        ]
      }
    ]
  },
  {
    id: "prompt-report-draft",
    name: "报告草稿生成边界",
    owner: "Agent 应用",
    versions: [
      {
        version: "1.0",
        status: "published",
        validatedAt: "2026-08-14 17:20",
        change: "接入报告中心 C022 固定报告定义、模板槽位、证据包与精确双版本身份",
        variables: ["报告定义", "模板槽位", "固定证据包", "Published 语义引用", "数据可信度摘要", "目标内容修订号"],
        contextBoundary: "只接收报告中心按同一 C033 场景轮次固定的 C022；不得读取工作簿、数据资产明细或自行改选语义与数据版本。",
        outputContracts: ["Agent Report Draft v1"],
        sections: [
          { title: "任务", body: "按报告定义、章节顺序和模板槽位，把固定证据组织为结构化源草稿。" },
          { title: "证据边界", body: "每个内容项只引用 C022 内的事实项、证据和锚点；缺失时保留缺口，不补猜数值。" },
          { title: "输出要求", body: "返回不可变源草稿标识、内容项清单、事实绑定、生成叙述、限制和精确场景及版本身份。" },
          { title: "禁止事项", body: "不得生成报告中心稳定锚点、修改评审副本、执行确定性核验、确认内容或发布 HTML/PDF。" }
        ]
      }
    ]
  }
];

const AGENT_SKILLS = [
  {
    id: "skill-finance-explain",
    name: "融资证据解释",
    versions: [{
      version: "1.1",
      status: "published",
      purpose: "把固定融资证据组织为带引用的业务解释。",
      prerequisites: "Generation Evidence Package v1；精确 Published 语义版本；数据可信度上下文完整。",
      inputContract: "融资指标、Rule 命中、对象归因与质量摘要",
      outputContract: "AI Insight v1 中的结论项、限制和证据引用",
      evidenceRule: "每个数值和 Rule 结论至少绑定一个包内证据项。",
      toolIds: ["tool-evidence-reader", "tool-ontology-reader", "tool-citation-validator"],
      compatibleTypes: ["洞察 Agent"],
      dependencies: "企业融资 Published 语义资源；获准融资证据包",
      failureLimits: "证据缺失、硬质量失败或双版本不一致时阻断，不得补猜。",
      validatedAt: "2026-08-11 09:10",
      change: "增加对象范围与 Rule 证据一致性校验"
    }, {
      version: "1.0",
      status: "history",
      purpose: "解释固定融资证据。",
      prerequisites: "固定融资证据包。",
      inputContract: "融资证据",
      outputContract: "AI Insight v1",
      evidenceRule: "结论引用包内证据。",
      toolIds: ["tool-evidence-reader", "tool-citation-validator"],
      compatibleTypes: ["洞察 Agent"],
      dependencies: "获准融资证据包",
      failureLimits: "证据缺失时停止。",
      validatedAt: "2026-07-28 16:35",
      change: "初始可用版本"
    }]
  },
  {
    id: "skill-action-collaboration",
    name: "融资行动协作",
    versions: [{
      version: "1.0",
      status: "published",
      purpose: "发现获准 Action Type 并准备标准 Action Request。",
      prerequisites: "AI Insight v1；主体唯一；Published Action Type；版本、时点和证据完整。",
      inputContract: "已形成但未确认的洞察及其固定证据",
      outputContract: "Action Request 提交内容与移交回执",
      evidenceRule: "每次请求只绑定一个主体，并携带来源运行、Metric/Rule 证据和精确版本。",
      toolIds: ["tool-action-discovery", "tool-action-submit"],
      compatibleTypes: ["洞察 Agent"],
      dependencies: "Published Action Type；决策中心标准接收合同",
      failureLimits: "不得确认 Action、创建提醒或待办；提交结果未知时不得宣称成功。",
      validatedAt: "2026-08-11 09:11",
      change: "初始可用版本"
    }]
  },
  {
    id: "skill-report-reading",
    name: "报告证据伴读",
    versions: [{
      version: "1.0",
      status: "published",
      purpose: "在精确报告上下文内回答全文、章节或选区问题。",
      prerequisites: "Report Context Binding v1；报告版本、稳定锚点与固定证据包。",
      inputContract: "问题与固定报告上下文",
      outputContract: "Report Copilot Answer v1",
      evidenceRule: "回答逐项回指稳定锚点和包内证据。",
      toolIds: ["tool-report-context", "tool-evidence-reader", "tool-citation-validator"],
      compatibleTypes: ["报告伴读 Agent"],
      dependencies: "报告中心上下文选择与锚点快照",
      failureLimits: "版本切换后旧会话只读；无证据时明确受限。",
      validatedAt: "2026-08-11 10:00",
      change: "初始可用版本"
    }]
  },
  {
    id: "skill-semantic-rule-explain",
    name: "语义口径与 Rule 解释",
    versions: [{
      version: "1.0",
      status: "published",
      purpose: "忠实解释报告生成时引用的 Published Metric 与 Rule 定义。",
      prerequisites: "资源稳定标识、精确 Published 版本与可解析历史定义。",
      inputContract: "报告证据中的语义引用",
      outputContract: "口径说明、Rule 命中解释与版本限制",
      evidenceRule: "不得把名称匹配或当前版本替代历史版本。",
      toolIds: ["tool-ontology-reader"],
      compatibleTypes: ["报告伴读 Agent"],
      dependencies: "本体管理历史 Published 解析能力",
      failureLimits: "历史版本不可定位时返回限制，不改链到相似资源。",
      validatedAt: "2026-08-11 10:01",
      change: "初始可用版本"
    }]
  },
  {
    id: "skill-verification-explain",
    name: "确定性核验差异解释",
    versions: [{
      version: "1.0",
      status: "published",
      purpose: "汇总报告中心形成的确定性核验与比较结果，生成业务可读建议。",
      prerequisites: "报告中心核验运行标识、四态结果和证据引用。",
      inputContract: "只读确定性核验结果",
      outputContract: "核验解释与限制说明",
      evidenceRule: "保留核验运行与差异项引用。",
      toolIds: ["tool-verification-reader", "tool-report-result-return"],
      compatibleTypes: ["报告伴读 Agent"],
      dependencies: "报告中心确定性核验合同",
      failureLimits: "不得把 LLM 解释写成核验事实，不得修改核验四态。",
      validatedAt: "2026-08-11 10:01",
      change: "初始可用版本"
    }]
  },
  {
    id: "skill-report-organization",
    name: "报告证据组织",
    versions: [{
      version: "1.0",
      status: "published",
      purpose: "按外部报告定义组织不可变源草稿。",
      prerequisites: "C022；C033 场景身份；报告定义、模板槽位、证据包、精确 Published 语义和可消费数据版本完整。",
      inputContract: "Report Generation Request v1",
      outputContract: "Agent Report Draft v1",
      evidenceRule: "所有内容项必须绑定包内证据或标记缺失。",
      toolIds: ["tool-evidence-reader", "tool-ontology-reader", "tool-citation-validator", "tool-output-validator", "tool-report-draft-handoff"],
      compatibleTypes: ["报告草稿 Agent"],
      dependencies: "报告中心报告定义与评审副本接收合同",
      failureLimits: "身份、版本、证据或用途门不完整时拒绝；不得用其他报告或当前数据补齐。",
      validatedAt: "2026-08-14 17:20",
      change: "启用 C022 到 C023 的固定证据组织与源草稿移交"
    }]
  }
];

const AGENT_TOOLS = [
  {
    id: "tool-evidence-reader",
    name: "固定证据包读取器",
    version: "1.0",
    category: "业务只读工具",
    provider: "证据包发起方",
    owner: "证据包发起方；Agent 应用只消费",
    purpose: "读取一次运行已固定的结构化证据目录和引用。",
    allowed: "读取包内证据项、范围、精确版本、时点和质量摘要。",
    forbidden: "读取包外原始数据、工作簿、T002 或 T007 业务明细；改写证据；按当前版本重组证据包。",
    input: "Evidence Package 标识；允许用途；运行快照",
    output: "包内证据项与可信度上下文",
    scope: "仅当前运行固定的一个证据包",
    prerequisites: "调用方已固定证据包且用途匹配",
    recovery: "包缺失时阻断；上下文变化时新建运行",
    timeoutRule: "未在调用合同内返回完整快照时记为超时，不继续生成。",
    failureRule: "包缺失、用途不符或证据不可定位时阻断。",
    retryRule: "同一运行只按原证据包标识与用途重试；上下文变化时新建运行。",
    partialRule: "只返回部分目录时标记部分结果，禁止当作完整证据使用。",
    audit: "记录调用输入摘要、返回证据项和运行引用",
    risk: "中",
    compatible: "洞察、报告伴读、报告草稿 Agent",
    contracts: "Generation Evidence Package v1；Report Context Binding v1",
    availability: "available",
    availabilityLabel: "可用",
    validatedAt: "2026-08-11 09:08"
  },
  {
    id: "tool-ontology-reader",
    name: "Published 本体资源阅读器",
    version: "1.1",
    category: "跨模块只读工具",
    provider: "本体管理",
    owner: "本体管理",
    purpose: "按稳定标识和精确 Published 版本解释 Object、Metric、Rule 与 Action Type。",
    allowed: "读取获准资源的定义、版本、关系端点和证据定位摘要。",
    forbidden: "创建或修改本体；读取未发布资源；自行选择当前或最新版本。",
    input: "资源稳定标识；Published 版本；允许用途",
    output: "权威定义摘要、版本与可定位证据",
    scope: "Agent Release 白名单与本次证据引用交集",
    prerequisites: "精确 Published 版本和兼容权威消费绑定",
    recovery: "版本不可定位时阻断并返回责任位置",
    timeoutRule: "精确版本在约定时限内不可解析时停止本次读取。",
    failureRule: "稳定标识、Published 状态或版本任一不匹配即阻断。",
    retryRule: "仅按原稳定标识和精确版本重试，不改链到当前版本。",
    partialRule: "部分资源不可解析时逐项标明限制，不补猜定义。",
    audit: "记录稳定标识、版本、状态和返回摘要",
    risk: "中",
    compatible: "洞察、报告伴读、报告草稿 Agent",
    contracts: "Published Ontology Binding；C008 只读引用",
    availability: "available",
    availabilityLabel: "可用",
    validatedAt: "2026-08-11 09:09"
  },
  {
    id: "tool-quality-summary",
    name: "数据可信度摘要读取器",
    version: "C017 字段映射 1.0",
    category: "跨模块只读工具",
    provider: "数据工程",
    owner: "数据工程",
    purpose: "读取 C017 中与运行门禁有关的版本、时点、质量和新鲜度摘要。",
    allowed: "读取获准的可信度安全投影。",
    forbidden: "读取工作簿、T002 或 T007 业务明细；切换 C008/T019 权威绑定；定义新鲜度阈值或发起刷新。",
    input: "固定数据版本与运行用途",
    output: "可信度摘要与责任位置",
    scope: "与本次固定证据包相同的数据范围",
    prerequisites: "C017 合同已确认；真实字段交换、权限负向校验和运行联调待验证",
    recovery: "保持合同字段映射只读，取得真实交换证据后重新验证工具 Release",
    timeoutRule: "真实联调前不得把无响应解释为数据状态；运行按输入缺失阻断",
    failureRule: "摘要标识、版本、形成时间或用途所需字段缺失时阻断正式用途",
    retryRule: "同一摘要引用可重读；采用新摘要必须创建新运行或新的用途检查",
    partialRule: "缺失字段逐项显示未知；不得用默认值补成允许消费",
    audit: "记录读取用途、摘要精确引用、返回字段范围和真实联调证据",
    risk: "高",
    compatible: "洞察、报告伴读、报告草稿 Agent",
    contracts: "C017 安全投影",
    availability: "pending-integration",
    availabilityLabel: "合同已确认·待联调",
    validatedAt: null
  },
  {
    id: "tool-verification-reader",
    name: "确定性核验结果读取器",
    version: "1.0",
    category: "跨模块只读工具",
    provider: "报告中心",
    owner: "报告中心",
    purpose: "读取报告中心已形成的核验运行、差异项与四态结果供解释。",
    allowed: "读取指定核验运行的结构化结果和证据引用。",
    forbidden: "执行或重算核验；修改差异；维护核验四态副本。",
    input: "报告版本；核验运行标识；稳定锚点",
    output: "核验结果、差异项与证据引用",
    scope: "当前 Report Context Binding 引用的核验运行",
    prerequisites: "报告中心已形成确定性核验结果",
    recovery: "结果缺失时返回受限回答，不生成差异数值",
    timeoutRule: "核验运行未在调用合同内返回时标记读取失败。",
    failureRule: "核验标识缺失或结果不可定位时返回受限回答。",
    retryRule: "只重读同一核验运行，不触发或重算核验。",
    partialRule: "逐项保留报告中心四态，缺失差异不生成解释数值。",
    audit: "记录核验运行和返回差异项引用",
    risk: "中",
    compatible: "报告伴读 Agent",
    contracts: "Deterministic Verification Result",
    availability: "available",
    availabilityLabel: "可用",
    validatedAt: "2026-08-11 09:58"
  },
  {
    id: "tool-report-context",
    name: "报告固定上下文读取器",
    version: "1.0",
    category: "跨模块只读工具",
    provider: "报告中心",
    owner: "报告中心提供输入；Agent 应用拥有正式绑定",
    purpose: "读取报告版本、章节锚点快照和固定证据引用。",
    allowed: "按本次 Binding 读取报告全文、章节或选区上下文。",
    forbidden: "切换报告版本；扩大证据范围；修改报告内容或锚点。",
    input: "报告内容版本；稳定锚点；固定证据包",
    output: "不可变上下文快照",
    scope: "当前会话绑定的报告版本和选择范围",
    prerequisites: "报告中心提交精确上下文选择",
    recovery: "版本变化时创建新 Binding 和新会话",
    timeoutRule: "上下文快照未完整返回时停止创建问答运行。",
    failureRule: "报告版本、稳定锚点或固定证据任一缺失即阻断。",
    retryRule: "活跃 Binding 可按原快照重试；上下文变化必须新建 Binding。",
    partialRule: "全文、章节或选区不完整时明确限制，不扩大读取范围。",
    audit: "记录报告版本、锚点与会话标识",
    risk: "中",
    compatible: "报告伴读 Agent",
    contracts: "Report Context Binding v1",
    availability: "available",
    availabilityLabel: "可用",
    validatedAt: "2026-08-11 09:58"
  },
  {
    id: "tool-report-result-return",
    name: "报告助手结果回传器",
    version: "1.0",
    category: "跨模块移交工具",
    provider: "Agent 应用",
    owner: "Agent 应用生成；报告中心只读引用",
    purpose: "向报告中心返回 Session、Run 与 Result 标识。",
    allowed: "返回结果引用、限制和权威状态读取位置。",
    forbidden: "维护报告中心状态副本；修改报告；创建复核问题或重新生成请求。",
    input: "Report Copilot Result 与来源运行",
    output: "可回读的运行与结果引用",
    scope: "当前报告伴读请求",
    prerequisites: "结果完成或受限完成",
    recovery: "回传失败可按同一结果重试，不重新生成内容",
    timeoutRule: "报告中心未返回接收结果时保留待确认状态。",
    failureRule: "回传失败不改变 Agent Run 与 Result 的权威状态。",
    retryRule: "按同一 Run 与 Result 标识重试回传，不重新生成回答。",
    partialRule: "只回传已形成的结果、限制和引用，不补齐缺失内容。",
    audit: "记录移交时间和结果引用",
    risk: "低",
    compatible: "报告伴读 Agent",
    contracts: "Report Copilot Result Reference",
    availability: "available",
    availabilityLabel: "可用",
    validatedAt: "2026-08-11 10:00"
  },
  {
    id: "tool-report-draft-handoff",
    name: "报告草稿评审副本移交器",
    version: "1.0",
    category: "跨模块移交工具",
    provider: "Agent 应用与报告中心",
    owner: "源草稿归 Agent 应用；评审副本归报告中心",
    purpose: "按合同移交不可变源内容项，供报告中心形成评审副本。",
    allowed: "移交源内容项、顺序、模板槽位、证据、缺失项和警告。",
    forbidden: "生成稳定锚点；修改评审副本；确认或发布正式报告。",
    input: "Agent Report Draft v1",
    output: "评审副本接收回执",
    scope: "指定报告生成请求",
    prerequisites: "C022 场景、报告根、证据包、精确双版本身份和源内容项完整",
    recovery: "移交失败时按同一 Run 与 Result 标识重新读取；身份或内容改变时创建新 Run",
    timeoutRule: "报告中心未读到结果时保留已完成 Run，不重复生成源草稿。",
    failureRule: "身份不一致时拒绝移交并保留失败原因，源 Run 与 Result 不改写。",
    retryRule: "同一结果只允许幂等重读；重新生成必须形成新 Run 和新源草稿。",
    partialRule: "内容项、事实绑定或生成内容不完整时不得标记 C023 完成。",
    audit: "记录 C022 请求、C023 Run、Result、源草稿、证据包与精确双版本身份",
    risk: "高",
    compatible: "报告草稿 Agent",
    contracts: "Agent Report Draft Review Copy",
    availability: "available",
    availabilityLabel: "可用",
    validatedAt: "2026-08-14 17:20"
  },
  {
    id: "tool-action-discovery",
    name: "Action Type 发现器",
    version: "1.0",
    category: "跨模块只读工具",
    provider: "本体管理",
    owner: "本体管理",
    purpose: "发现 Agent 白名单内、已发布且用途兼容的 Action Type。",
    allowed: "读取 Action Type 稳定标识、精确版本和必填合同。",
    forbidden: "创建、修改或按名称猜测 Action Type。",
    input: "Agent Release 白名单；业务对象；允许用途",
    output: "兼容的 Published Action Type 引用",
    scope: "融资洞察允许的 Action Type",
    prerequisites: "Published 状态、版本和目标对象兼容",
    recovery: "无兼容结果时不显示提交操作",
    timeoutRule: "未取得完整发现结果时不开放 Action 请求入口。",
    failureRule: "无兼容 Published Action Type 时返回受限状态。",
    retryRule: "按原白名单、对象和用途重试，不按名称猜测资源。",
    partialRule: "候选缺少稳定标识、版本或必填合同时视为不可用。",
    audit: "记录发现条件与精确资源引用",
    risk: "中",
    compatible: "洞察 Agent",
    contracts: "Published Action Type Reference",
    availability: "available",
    availabilityLabel: "可用",
    validatedAt: "2026-08-11 09:10"
  },
  {
    id: "tool-action-submit",
    name: "Action 请求提交器",
    version: "1.0",
    category: "跨模块移交工具",
    provider: "决策中心",
    owner: "决策中心拥有 Action Request 及后续状态",
    purpose: "提交一条单主体、引用 Published Action Type 的标准 Action Request。",
    allowed: "提交请求并接收请求标识或明确失败结果。",
    forbidden: "确认 Action；创建提醒或待办；维护后续状态副本。",
    input: "来源运行、主体、Action Type、适用 Rule、Metric 快照、双版本、时点和可信度",
    output: "接收结果与 Action Request 标识",
    scope: "当前 AI Insight 的获准行动候选",
    prerequisites: "全部必填证据完整且当前权威输入未硬质量失败",
    recovery: "接收结果未知时可查询原提交，不得重复创建",
    timeoutRule: "接收结果未知时保持待确认，不宣称提交成功。",
    failureRule: "接收失败保留来源运行与请求内容，显示明确原因。",
    retryRule: "先按原提交查询接收结果；不得重复创建 Action Request。",
    partialRule: "目标主体或必填证据不完整时阻断本次请求，不写成部分成功。",
    audit: "保留移交回执与来源证据引用",
    risk: "高",
    compatible: "洞察 Agent",
    contracts: "Standard Action Request",
    availability: "available",
    availabilityLabel: "可用",
    validatedAt: "2026-08-11 09:11"
  },
  {
    id: "tool-bi-reference",
    name: "分析结果引用读取器",
    version: "待合同",
    category: "跨模块只读工具",
    provider: "缺少能力提供方",
    owner: "未确认",
    purpose: "读取已进入固定证据包的结构化分析或图表引用。",
    allowed: "仅可读取固定证据包中的既有结构化结果引用。",
    forbidden: "调用问数运行、切换图表、重建查询、拥有布局或正式发布。",
    input: "结构化结果引用与固定版本",
    output: "只读结果摘要",
    scope: "待合同",
    prerequisites: "能力提供方、输入输出合同和权限范围完成登记",
    recovery: "合同完成后创建新工具版本并重新验证",
    timeoutRule: "合同未完成；当前不可启用",
    failureRule: "合同未完成；当前不可启用",
    retryRule: "合同未完成；当前不可启用",
    partialRule: "合同未完成；当前不可启用",
    audit: "当前无调用记录",
    risk: "高",
    compatible: "待确认",
    contracts: "未完成",
    availability: "blocked",
    availabilityLabel: "不可用",
    validatedAt: null
  },
  {
    id: "tool-output-validator",
    name: "输出合同校验器",
    version: "1.0",
    category: "Agent 应用内部校验器",
    provider: "Agent 应用",
    owner: "Agent 应用",
    purpose: "校验结构化输出、必填限制、确认状态和类型兼容性。",
    allowed: "检查输出结构并返回通过或问题清单。",
    forbidden: "修改业务证据或把不合格结果转为正式产物。",
    input: "生成结果与目标输出合同",
    output: "校验结果与问题定位",
    scope: "当前调试或运行结果",
    prerequisites: "目标输出合同已固定",
    recovery: "修正 Draft 后重新调试；正式运行则创建新运行",
    timeoutRule: "校验未结束时结果保持处理中，不进入结果目录。",
    failureRule: "任一必填结构、限制或类型不合格即返回问题清单。",
    retryRule: "Draft 修正后重新调试；正式运行按原快照重试校验。",
    partialRule: "只有目标合同明确允许时才返回部分通过，否则判定不合格。",
    audit: "记录合同版本与问题清单",
    risk: "低",
    compatible: "全部 Agent 类型",
    contracts: "AI Insight v1；Report Copilot Answer v1；Agent Report Draft v1",
    availability: "available",
    availabilityLabel: "可用",
    validatedAt: "2026-08-11 09:07"
  },
  {
    id: "tool-citation-validator",
    name: "证据引用校验器",
    version: "1.0",
    category: "Agent 应用内部校验器",
    provider: "Agent 应用",
    owner: "Agent 应用",
    purpose: "验证生成结论是否逐项回指固定证据包。",
    allowed: "检查引用存在、范围一致和版本一致。",
    forbidden: "创建缺失证据或替换到相似资源。",
    input: "生成结果、证据引用和固定证据包",
    output: "引用校验结果",
    scope: "当前结果和当前证据包",
    prerequisites: "证据目录可定位",
    recovery: "缺失引用时判定输出不合格",
    timeoutRule: "引用目录未完成核对时结果保持处理中。",
    failureRule: "引用缺失、越界或版本不一致时判定输出不合格。",
    retryRule: "只按原结果和原证据快照重试校验，不替换引用。",
    partialRule: "逐结论返回通过与失败项；失败结论不得进入正式结果。",
    audit: "记录结论项与证据项映射",
    risk: "低",
    compatible: "全部 Agent 类型",
    contracts: "Evidence Citation Check",
    availability: "available",
    availabilityLabel: "可用",
    validatedAt: "2026-08-11 09:07"
  }
];

const FINANCE_C017_EXTERNAL_FEED = {
  id: "finance-c017-authoritative-feed",
  owner: "数据工程",
  contract: "C017 当前状态摘要",
  cursor: 0,
  lastReadAt: null,
  lastSnapshotId: "finance-current-01",
  timeline: [
    {
      id: "finance-current-01",
      sequence: 1,
      profile: "normal",
      summaryId: "c017-current-finance-2026-07-31",
      summaryVersion: "1.0",
      observedAt: "2026-08-11 11:20",
      owner: "数据工程",
      sourceReference: "C017 当前状态摘要 · 1.0",
      changeReason: "当前权威组合具备消费资格。"
    },
    {
      id: "finance-current-02",
      sequence: 2,
      profile: "refreshing",
      summaryId: "c017-current-finance-2026-07-31",
      summaryVersion: "2.0",
      observedAt: "2026-08-13 09:00",
      owner: "数据工程",
      sourceReference: "C017 当前状态摘要 · 2.0",
      changeReason: "较新候选正在刷新，当前权威组合继续服务。"
    },
    {
      id: "finance-current-03",
      sequence: 3,
      profile: "candidate-failed",
      summaryId: "c017-current-finance-2026-07-31",
      summaryVersion: "3.0",
      observedAt: "2026-08-13 09:06",
      owner: "数据工程",
      sourceReference: "C017 当前状态摘要 · 3.0",
      changeReason: "候选刷新失败且未被采用，当前权威组合继续服务。"
    },
    {
      id: "finance-current-04",
      sequence: 4,
      profile: "warning-allowed",
      summaryId: "c017-current-finance-2026-07-31",
      summaryVersion: "4.0",
      observedAt: "2026-08-13 09:12",
      owner: "数据工程",
      sourceReference: "C017 当前状态摘要 · 4.0",
      changeReason: "当前版本出现范围级质量警告，但仍允许受限使用。"
    },
    {
      id: "finance-current-05",
      sequence: 5,
      profile: "stale-allowed",
      summaryId: "c017-current-finance-2026-07-31",
      summaryVersion: "5.0",
      observedAt: "2026-08-13 09:18",
      owner: "数据工程",
      sourceReference: "C017 当前状态摘要 · 5.0",
      changeReason: "事实年龄越过外部阈值，当前用途仍允许并必须展示陈旧限制。"
    },
    {
      id: "finance-current-06",
      sequence: 6,
      profile: "scope-failure",
      trigger: "action-submit",
      triggerFromSummaryVersion: "3.0",
      summaryId: "c017-current-finance-2026-07-31",
      summaryVersion: "6.0",
      observedAt: "2026-08-13 09:24",
      owner: "数据工程",
      sourceReference: "C017 当前状态摘要 · 6.0",
      changeReason: "当前版本被登记范围级硬质量失败。"
    },
    {
      id: "finance-current-07",
      sequence: 7,
      profile: "ontology-rollback",
      summaryId: "c017-current-finance-2026-06-30",
      summaryVersion: "7.0",
      observedAt: "2026-08-13 09:30",
      owner: "数据工程与本体管理的权威采用证据",
      sourceReference: "C017 当前状态摘要 · 7.0",
      changeReason: "兼容的上一可信组合已受控采用，仅供后续新运行。",
      adoptedCombination: {
        evidenceId: "finance-2026-06-30-rollback",
        evidenceName: "集团融资受控回退证据包",
        bindingSummaryId: "c017-binding-finance-2026-06-30-rollback",
        bindingSummaryVersion: "1.0",
        dataAsset: "融资标准化数据资产",
        dataVersion: "融资标准化数据 · 2026-06-30",
        dataAsOf: "2026-06-30",
        formedAt: "2026-08-13 09:30",
        ontologyVersion: "企业融资语义 · Published 2026.07",
        adoptionReference: "本体管理正式采用证据 · 受控回退",
        items: [
          { id: "rollback-balance", type: "Metric", name: "集团融资余额", value: "123.62 亿元", object: "集团合并范围", source: "Published 融资余额口径" },
          { id: "rollback-cost", type: "Metric", name: "余额加权融资成本", value: "3.71%", object: "集团合并范围", source: "Published 融资成本口径" },
          { id: "rollback-high-cost", type: "Metric", name: "高成本融资余额", value: "25.67 亿元", object: "集团合并范围", source: "Published 高成本融资口径" },
          { id: "rollback-rule-high-cost", type: "Rule", name: "高成本融资关注规则", value: "2 个主体命中", object: "命中主体范围", source: "固定 Rule 评估结果" },
          { id: "rollback-short", type: "Metric", name: "短期债务余额占比", value: "29.8%", object: "集团合并范围", source: "Published 债务期限结构口径" },
          { id: "rollback-action-optimize", type: "Action Type", name: "发起融资结构优化评估", value: "允许请求", object: "2 个高成本融资关注主体", source: "Published Action Type", resourceId: "action-type-financing-structure-review", version: "Published 2026.07", metricRefs: ["rollback-high-cost", "rollback-short"], ruleRefs: ["rollback-rule-high-cost"], targets: [{ id: "FIN-ORG-003", name: "融资主体 003" }, { id: "FIN-ORG-008", name: "融资主体 008" }] }
        ]
      }
    },
    {
      id: "finance-current-08",
      sequence: 8,
      profile: "version-failure",
      summaryId: "c017-current-finance-2026-07-31",
      summaryVersion: "8.0",
      observedAt: "2026-08-13 09:36",
      owner: "数据工程",
      sourceReference: "C017 当前状态摘要 · 8.0",
      changeReason: "精确数据版本被登记版本级硬质量失败。"
    },
    {
      id: "finance-current-09",
      sequence: 9,
      profile: "no-safe-combination",
      summaryId: "c017-current-finance-2026-07-31",
      summaryVersion: "9.0",
      observedAt: "2026-08-13 09:42",
      owner: "数据工程",
      sourceReference: "C017 当前状态摘要 · 9.0",
      changeReason: "当前未提供可被受控采用的安全可信组合。"
    },
    {
      id: "finance-current-10",
      sequence: 10,
      profile: "normal",
      summaryId: "c017-current-finance-history",
      summaryVersion: "10.0",
      observedAt: "2026-08-13 09:48",
      owner: "数据工程",
      sourceReference: "C017 当前状态摘要 · 10.0",
      changeReason: "新的权威组合恢复消费资格，后续历史核对仍需分维记录。"
    },
    {
      id: "finance-current-11",
      sequence: 11,
      profile: "readiness-waiting",
      summaryId: "c017-current-finance-history",
      summaryVersion: "11.0",
      observedAt: "2026-08-13 09:54",
      owner: "数据工程",
      sourceReference: "C017 当前状态摘要 · 11.0",
      changeReason: "消费就绪证据尚未形成，新的正式运行保持等待。"
    },
    {
      id: "finance-current-12",
      sequence: 12,
      profile: "readiness-timeout",
      summaryId: "c017-current-finance-history",
      summaryVersion: "12.0",
      observedAt: "2026-08-13 10:00",
      owner: "数据工程",
      sourceReference: "C017 当前状态摘要 · 12.0",
      changeReason: "消费就绪等待超过约定窗口，新的正式运行被阻断。"
    },
    {
      id: "finance-current-13",
      sequence: 13,
      profile: "normal",
      summaryId: "c017-current-finance-history",
      summaryVersion: "13.0",
      observedAt: "2026-08-13 10:06",
      owner: "数据工程",
      sourceReference: "C017 当前状态摘要 · 13.0",
      changeReason: "消费就绪证据已恢复，后续新运行可重新判断。"
    },
    {
      id: "finance-current-14",
      sequence: 14,
      profile: "history-not-run",
      summaryId: "c017-current-finance-history",
      summaryVersion: "14.0",
      observedAt: "2026-08-13 10:12",
      owner: "数据工程",
      sourceReference: "C017 当前状态摘要 · 14.0",
      changeReason: "历史版本可定位且具备重放条件，但重放核验尚未执行。"
    },
    {
      id: "finance-current-15",
      sequence: 15,
      profile: "history-dependency",
      summaryId: "c017-current-finance-history",
      summaryVersion: "15.0",
      observedAt: "2026-08-13 10:18",
      owner: "数据工程",
      sourceReference: "C017 当前状态摘要 · 15.0",
      changeReason: "历史重放依赖不足，不能据此判断一致或不一致。"
    },
    {
      id: "finance-current-16",
      sequence: 16,
      profile: "history-unavailable",
      summaryId: "c017-current-finance-history",
      summaryVersion: "16.0",
      observedAt: "2026-08-13 10:24",
      owner: "数据工程",
      sourceReference: "C017 当前状态摘要 · 16.0",
      changeReason: "历史版本仍可定位，但固定内容当前不可访问。"
    },
    {
      id: "finance-current-17",
      sequence: 17,
      profile: "history-unknown",
      summaryId: "c017-current-finance-history",
      summaryVersion: "17.0",
      observedAt: "2026-08-13 10:30",
      owner: "数据工程",
      sourceReference: "C017 当前状态摘要 · 17.0",
      changeReason: "缺少重放运行证据，重放核验状态只能记为无法判断。"
    },
    {
      id: "finance-current-18",
      sequence: 18,
      profile: "replay-consistent",
      summaryId: "c017-current-finance-history",
      summaryVersion: "18.0",
      observedAt: "2026-08-13 10:36",
      owner: "数据工程",
      sourceReference: "C017 当前状态摘要 · 18.0",
      changeReason: "权威重放核验已经执行且结果一致。"
    },
    {
      id: "finance-current-19",
      sequence: 19,
      profile: "replay-inconsistent",
      summaryId: "c017-current-finance-history",
      summaryVersion: "19.0",
      observedAt: "2026-08-13 10:42",
      owner: "数据工程",
      sourceReference: "C017 当前状态摘要 · 19.0",
      changeReason: "权威重放核验已经执行并发现差异。"
    },
    {
      id: "finance-current-20",
      sequence: 20,
      profile: "comparison-stale",
      summaryId: "c017-current-finance-history",
      summaryVersion: "20.0",
      observedAt: "2026-08-13 10:48",
      owner: "数据工程",
      sourceReference: "C017 当前状态摘要 · 20.0",
      changeReason: "当前状态摘要再次变化，基于上一摘要形成的显式比较已陈旧。"
    }
  ]
};

const FINANCE_C017_STATE_BY_PROFILE = {
  normal: { status: "ready", label: "当前权威输入", quality: "通过固定证据门", freshness: "新鲜", dataQualification: "允许", refresh: "无待切换刷新", useConclusion: "可在本次固定范围内进入 Agent 用途判断。" },
  refreshing: { status: "ready", label: "当前组合继续服务", quality: "通过固定证据门", freshness: "新鲜", dataQualification: "允许；候选不参与", refresh: "较新候选刷新中", useConclusion: "候选不得混入本次输入；当前权威组合可继续服务。" },
  "candidate-failed": { status: "ready", label: "当前组合继续服务", quality: "通过固定证据门", freshness: "新鲜", dataQualification: "允许；候选禁止", refresh: "候选刷新失败", useConclusion: "候选失败不影响未受损的当前权威组合；不得混入候选内容。" },
  "warning-allowed": { status: "warning", label: "质量警告，允许使用", quality: "存在范围级质量警告", freshness: "新鲜", dataQualification: "带警告允许", refresh: "当前组合继续服务", useConclusion: "数据侧资格为允许并携带警告；Agent 应用按具体用途决定操作门。" },
  "stale-allowed": { status: "stale", label: "数据陈旧，允许使用", quality: "通过固定证据门", freshness: "陈旧", dataQualification: "带新鲜度警告允许", refresh: "当前组合继续服务", useConclusion: "数据侧资格允许；Agent 用途门必须展示事实年龄和限制。" },
  "scope-failure": { status: "quality-blocked", label: "范围级硬质量失败", quality: "范围级硬质量失败", freshness: "新鲜", dataQualification: "禁止", refresh: "当前版本事后受限", useConclusion: "数据侧禁止受影响范围进入新的正式用途。" },
  "version-failure": { status: "quality-blocked", label: "版本级硬质量失败", quality: "版本级硬质量失败", freshness: "新鲜", dataQualification: "禁止", refresh: "当前版本事后受限", useConclusion: "数据侧禁止该精确版本进入新的正式用途。" },
  "no-safe-combination": { status: "quality-blocked", label: "当前不可用于新的正式输出", quality: "当前版本受损且无安全组合", freshness: "未知", dataQualification: "禁止", refresh: "无可采用安全组合", useConclusion: "当前未提供可用于新正式输出的安全组合。" },
  "ontology-rollback": { status: "ready", label: "受控回退组合可供后续运行", quality: "受控回退组合通过固定证据门", freshness: "未知", dataQualification: "允许后续新运行", refresh: "本体已正式采用兼容的上一可信组合", useConclusion: "仅后续新运行可采用受控回退组合；新鲜度未提供时必须显示未知，旧运行和旧结果不改写。" },
  "readiness-waiting": { status: "waiting", label: "等待消费就绪", quality: "等待消费就绪证据", freshness: "未知", dataQualification: "无法判断", refresh: "消费就绪证据形成中", useConclusion: "消费就绪证据尚未形成，保持等待且不启动正式运行。" },
  "readiness-timeout": { status: "blocked", label: "消费就绪等待超时", quality: "消费就绪证据未形成", freshness: "未知", dataQualification: "无法判断", refresh: "等待窗口已结束", useConclusion: "未在约定窗口内取得消费就绪证据，阻断新的正式用途。" }
};

FINANCE_C017_EXTERNAL_FEED.timeline = FINANCE_C017_EXTERNAL_FEED.timeline.map((snapshot) => {
  const factAge = snapshot.profile === "ontology-rollback"
    ? (snapshot.adoptedCombination?.factAge || "上游未随受控回退组合提供，按未知处理")
    : snapshot.observedAt.startsWith("2026-08-13")
      ? `13 天（判断时点：${snapshot.observedAt}）`
      : `11 天（判断时点：${snapshot.observedAt}）`;
  const state = FINANCE_C017_STATE_BY_PROFILE[snapshot.profile] || FINANCE_C017_STATE_BY_PROFILE.normal;
  return {
    ...snapshot,
    dataSidePayload: {
      factAge,
      currentStateSummary: {
        ...state,
        factAge,
        freshnessThreshold: "融资洞察新鲜度规则 · 1.0",
        freshnessThresholdOwner: "融资洞察业务 Owner",
        applicableScope: "集团合并范围融资指标、Rule 命中主体与获准 Action Type"
      },
      complete: true,
      payloadOwner: "数据工程",
      payloadContract: "C017 当前状态摘要安全字段"
    }
  };
});


const S001_FINANCE_SCENARIO_BINDING = {
  id: "AG-SB-S001-FINANCE",
  version: "1.0",
  mode: "fixed",
  scenarioId: "S001",
  scenarioLabel: "S001 · 集团融资成本与债务结构优化",
  objectScope: "集团合并范围融资指标、Rule 命中主体与获准 Action Type",
  status: "ready"
};

const REPORT_CONTEXT_SCENARIO_BINDING = {
  id: "AG-SB-REPORT-CONTEXT",
  version: "1.0",
  mode: "request-context",
  scenarioId: null,
  scenarioLabel: "由报告中心固定上下文继承",
  objectScope: null,
  status: "ready"
};

const REPORT_GENERATION_SCENARIO_BINDING = {
  id: "AG-SB-REPORT-GENERATION",
  version: "1.0",
  mode: "request-context",
  scenarioId: null,
  scenarioLabel: "由报告中心 C022 固定上下文继承",
  objectScope: null,
  status: "ready"
};

const FINANCE_INSIGHT_REQUEST_CONTEXT = {
  id: "AG-CTX-S001-FINANCE-20260731",
  version: "1.0",
  sourceOwner: "Agent 应用（S001 洞察发起）",
  scenarioId: "S001",
  scenarioLabel: "集团融资成本与债务结构优化",
  requestedAt: "2026-08-11 08:40",
  objectScope: "集团合并范围融资指标、Rule 命中主体与获准 Action Type",
  expectedOutput: "AI Insight v1"
};

const FINANCE_CANDIDATE_REQUEST_CONTEXT = {
  ...FINANCE_INSIGHT_REQUEST_CONTEXT,
  id: "AG-CTX-S001-FINANCE-20260810",
  requestedAt: "2026-08-11 11:20"
};

const AGENT_APP_INITIAL_STATE = {
  schemaVersion: 23,
  sequence: { run: 0, debug: 0, handoff: 0, orchestration: 0, orchestrationRun: 0, result: 0, session: 0 },
  agents: [
    {
      id: "financing-insight",
      name: "融资洞察与行动协作 Agent",
      shortName: "融资洞察",
      type: "洞察 Agent",
      purpose: "解释已形成的融资指标、Rule 命中与机构归因证据，生成结构化洞察并准备 Action 请求候选。",
      status: "enabled",
      activeRelease: "1.2",
      scenario: "S001 · 集团融资成本与债务结构优化",
      releases: [
        {
          version: "1.2",
          releasedAt: "2026-08-11 09:15",
          validationAt: "2026-08-11 09:12",
          inputContract: "Generation Evidence Package v1",
          outputContract: "AI Insight v1",
          prompt: { id: "prompt-finance-evidence", version: "1.2" },
          skills: [{ id: "skill-finance-explain", version: "1.1" }, { id: "skill-action-collaboration", version: "1.0" }],
          tools: ["tool-evidence-reader", "tool-ontology-reader", "tool-citation-validator", "tool-output-validator", "tool-action-discovery", "tool-action-submit"],
          ontology: "企业融资语义 · Published 2026.07",
          ontologyScope: "融资主体、融资明细、金融机构、融资负责人及获准 Metric、Rule、Action Type",
          scenarioBinding: { ...S001_FINANCE_SCENARIO_BINDING },
          change: "增加行动候选证据完整性与输出限制"
        },
        {
          version: "1.1",
          releasedAt: "2026-07-28 16:45",
          validationAt: "2026-07-28 16:40",
          inputContract: "Generation Evidence Package v1",
          outputContract: "AI Insight v1",
          prompt: { id: "prompt-finance-evidence", version: "1.1" },
          skills: [{ id: "skill-finance-explain", version: "1.0" }],
          tools: ["tool-evidence-reader", "tool-citation-validator", "tool-output-validator"],
          ontology: "企业融资语义 · Published 2026.07",
          ontologyScope: "融资主体及获准融资 Metric、Rule",
          scenarioBinding: { ...S001_FINANCE_SCENARIO_BINDING },
          change: "建立固定证据解释能力"
        }
      ]
    },
    {
      id: "report-copilot",
      name: "报告伴读与数据核验助手",
      shortName: "报告伴读",
      type: "报告伴读 Agent",
      purpose: "在报告固定证据包内回答全文、章节或选区问题，并解释确定性核验结果与证据来源。",
      status: "enabled",
      activeRelease: "1.0",
      scenario: "报告上下文按请求绑定",
      releases: [
        {
          version: "1.0",
          releasedAt: "2026-08-11 10:05",
          validationAt: "2026-08-11 10:02",
          inputContract: "Report Context Binding v1",
          outputContract: "Report Copilot Answer v1",
          prompt: { id: "prompt-report-reading", version: "1.0" },
          skills: [{ id: "skill-report-reading", version: "1.0" }, { id: "skill-semantic-rule-explain", version: "1.0" }, { id: "skill-verification-explain", version: "1.0" }],
          tools: ["tool-report-context", "tool-evidence-reader", "tool-ontology-reader", "tool-verification-reader", "tool-citation-validator", "tool-output-validator", "tool-report-result-return"],
          ontology: "由报告固定上下文提供精确 Published 版本",
          ontologyScope: "报告版本、稳定锚点、固定证据包、历史语义引用与核验结果引用",
          scenarioBinding: { ...REPORT_CONTEXT_SCENARIO_BINDING },
          change: "建立固定报告上下文伴读和核验解释"
        }
      ]
    },
    {
      id: "report-draft",
      name: "融资经营分析报告生成 Agent",
      shortName: "报告生成",
      type: "报告草稿 Agent",
      purpose: "按报告中心固定的报告定义、模板槽位和证据包形成结构化源草稿，并通过 C023 返回不可变结果引用。",
      status: "enabled",
      activeRelease: "1.0",
      scenario: "报告生成上下文按请求绑定",
      releases: [
        {
          version: "1.0",
          releasedAt: "2026-08-14 17:20",
          validationAt: "2026-08-14 17:20",
          inputContract: "Report Generation Request v1",
          outputContract: "Agent Report Draft v1",
          prompt: { id: "prompt-report-draft", version: "1.0" },
          skills: [{ id: "skill-report-organization", version: "1.0" }],
          tools: ["tool-evidence-reader", "tool-ontology-reader", "tool-citation-validator", "tool-output-validator", "tool-report-draft-handoff"],
          ontology: "由报告生成请求提供精确 Published 版本",
          ontologyScope: "报告定义、模板槽位、固定事实项、内容项、证据与锚点清单",
          scenarioBinding: { ...REPORT_GENERATION_SCENARIO_BINDING },
          change: "建立 C022 接收、C023 独立运行与结构化源草稿移交"
        }
      ]
    }
  ],
  drafts: [],
  evidencePackages: [
    {
      id: "finance-2026-07-31",
      name: "集团融资证据包",
      kind: "finance",
      status: "ready",
      statusLabel: "可用于运行",
      dataVersion: "融资标准化数据 · 2026-07-31",
      dataAsOf: "2026-07-31",
      ontologyVersion: "企业融资语义 · Published 2026.07",
      quality: "通过固定证据门",
      freshness: "新鲜",
      authority: "报告/洞察请求固定的 C008/T019 权威消费引用",
      formedAt: "2026-08-11 08:40",
      previousId: null,
      requestContext: { ...FINANCE_INSIGHT_REQUEST_CONTEXT },
      externalCredibilityFeed: FINANCE_C017_EXTERNAL_FEED,
      credibility: {
        contract: "C017 Agent 安全投影",
        contextStatus: "normal",
        lastReadAt: null,
        externalAuthority: {
          feedId: "finance-c017-authoritative-feed",
          owner: "数据工程",
          sourceReference: "C017 当前状态摘要 · 1.0",
          publishedAt: "2026-08-11 11:20",
          receivedAt: null
        },
        versionBindingSummary: {
          id: "c017-binding-finance-2026-07-31",
          version: "1.0",
          status: "ready",
          label: "精确绑定已固定",
          formedAt: "2026-08-11 08:40",
          observedAt: "2026-08-11 08:40",
          t006: "融资标准化数据资产",
          t007: "融资标准化数据 · 2026-07-31",
          t008: "2026-07-31",
          t008Source: "数据工程权威业务时点",
          ontology: "企业融资语义 · Published 2026.07",
          binding: "当前权威消费组合",
          reason: "证据包同时固定业务版本、数据截至时间与 Published 语义版本。"
        },
        currentStateSummary: {
          id: "c017-current-finance-2026-07-31",
          version: "1.0",
          status: "ready",
          label: "当前权威输入",
          observedAt: "2026-08-11 11:20",
          quality: "通过固定证据门",
          freshness: "新鲜",
          factAge: "11 天（判断时点：2026-08-11 11:20）",
          freshnessThreshold: "融资洞察新鲜度规则 · 1.0",
          freshnessThresholdOwner: "融资洞察业务 Owner",
          applicableScope: "集团合并范围融资指标、Rule 命中主体与获准 Action Type",
          dataQualification: "允许",
          refresh: "较新候选未被采用",
          useConclusion: "可按本证据包固定范围发起新运行；不混入较新候选内容。"
        },
        identities: {
          current: {
            role: "当前权威",
            status: "ready",
            label: "正在服务",
            t006: "融资标准化数据资产",
            t007: "融资标准化数据 · 2026-07-31",
            t008: "2026-07-31",
            reason: "本体采用与消费状态证据完整。"
          },
          candidate: {
            role: "较新候选",
            status: "quality-blocked",
            label: "质量阻断",
            t006: "融资标准化数据资产",
            t007: "融资标准化数据 · 2026-08-10",
            t008: "2026-08-10",
            reason: "机构编码引用完整性未通过，未进入权威消费组合。"
          },
          previousQualified: {
            role: "上一具备采用资格",
            status: "unknown",
            label: "未提供更早版本",
            t006: "融资标准化数据资产",
            t007: null,
            t008: null,
            reason: "本安全投影不将未提供的历史版本推断为上一可用版本。"
          },
          previousAuthoritative: {
            role: "上一权威服务",
            status: "unknown",
            label: "未提供更早版本",
            t006: "融资标准化数据资产",
            t007: null,
            t008: null,
            reason: "当前包只证明正在服务的精确组合，不自行回退到未证明版本。"
          }
        },
        refresh: {
          status: "warning",
          label: "候选未切换",
          observedAt: "2026-08-11 11:20",
          requestState: "候选链路已有质量结论",
          resultState: "较新候选质量阻断",
          recovery: "保留当前权威组合继续服务；候选修正后由上游形成新版本和新状态证据。"
        },
        ontologyAdoption: {
          status: "ready",
          label: "已采用",
          ontology: "企业融资语义 · Published 2026.07",
          dataVersion: "融资标准化数据 · 2026-07-31",
          observedAt: "2026-08-11 08:40",
          source: "只读引用的本体采用证据"
        },
        consumptionReadiness: {
          status: "ready",
          label: "可供 Agent 消费",
          allowedUse: "固定融资洞察证据读取与受控生成",
          observedAt: "2026-08-11 08:40",
          reason: "精确 Published 语义、数据版本、时点与用途门均已固定。"
        },
        stableEvidence: {
          status: "complete",
          label: "稳定证据可核对",
          refs: ["T006 数据资产", "T007 精确版本", "T008 数据截至时间", "Published 语义版本", "固定证据目录"],
          reason: "这些安全字段足以定位本次 Agent 输入；不包含原始业务明细或内部存储信息。"
        },
        postQuality: {
          status: "complete",
          label: "未发现新增硬质量问题",
          checkedAt: "2026-08-11 11:20",
          scope: "融资标准化数据 · 2026-07-31",
          reason: "较新候选的质量失败不会静默改写当前版本的质量状态。",
          recovery: "如上游对本版本登记事后硬质量问题，立即重新计算 Agent 用途门并保留原证据。"
        },
        agentGates: [
          { id: "new-run", name: "发起新洞察运行", status: "ready", label: "允许", reason: "当前权威组合的质量、新鲜度和稳定证据满足本用途。", recovery: "上游状态变化后必须使用新的固定上下文创建新运行。" },
          { id: "confirm-result", name: "确认新生成结果", status: "ready", label: "允许进入人工确认", reason: "输入版本未被标记事后硬质量失败；仍须通过输出合同和人工判断。", recovery: "如用途门变为阻断，保留既有结果并标记陈旧，不自动确认。" },
          { id: "action-request", name: "准备 Action Request", status: "ready", label: "可进入独立确认", reason: "只允许使用本包中获准的 Published Action Type 与完整证据。", recovery: "任一版本、质量或证据门变化时重新校验；不创建提醒或待办。" },
          { id: "report-draft-transfer", name: "移交报告草稿评审副本", status: "blocked", label: "合同不适用", reason: "融资洞察证据包不是报告中心固定的 Report Generation Request。", recovery: "由报告中心提供报告定义、章节合同和固定证据目录后，创建新的报告草稿运行。" }
        ],
        historyDimensions: [
          { id: "version-location", name: "版本定位", status: "available", label: "可定位", reason: "T006、T007 与 T008 精确引用完整。", checkedAt: "2026-08-11 08:40", recovery: "定位失败时停止历史解释，不回退到当前版本。" },
          { id: "content-access", name: "内容访问", status: "available", label: "可访问安全投影", reason: "可读取固定证据目录与可对外解释的结构化摘要。", checkedAt: "2026-08-11 08:40", recovery: "内容不可访问时保留历史结果，同时明确限制并停止新生成。" },
          { id: "evidence-completeness", name: "证据完整", status: "complete", label: "完整", reason: "证据目录、Published 语义和数据时点可相互核对。", checkedAt: "2026-08-11 08:40", recovery: "缺失必填证据时将 Agent 用途门置为阻断。" },
          { id: "replay-capability", name: "重放能力", status: "dependency-missing", label: "依赖不足", reason: "安全投影未提供完整重放依赖和可执行条件。", checkedAt: "2026-08-11 08:40", recovery: "由数据工程补齐真实依赖证据后重新评估；不影响固定证据核对。" },
          { id: "replay-verification", name: "重放核验", status: "not-run", label: "未执行", reason: "当前没有已执行重放的权威记录。", checkedAt: "2026-08-11 08:40", recovery: "只有真实重放运行完成后才可更新为一致或不一致。" }
        ],
        useFlags: {
          isCurrentAuthoritative: true,
          hasNewerCandidate: true,
          canStartNewRun: true,
          canConfirmNewResult: true,
          canPrepareActionRequest: true,
          canUseAsPreviousTrusted: false,
          historyDisclosureRequired: true
        }
      },
      report: null,
      items: [
        { id: "metric-balance", type: "Metric", name: "集团融资余额", value: "126.84 亿元", object: "集团合并范围", source: "固定证据包内 Published 融资余额结果" },
        { id: "metric-cost", type: "Metric", name: "余额加权融资成本", value: "3.76%", object: "集团合并范围", source: "Published 融资成本口径" },
        { id: "metric-high-cost", type: "Metric", name: "高成本融资余额", value: "28.13 亿元", object: "集团合并范围", source: "Published 高成本融资口径" },
        { id: "rule-high-cost", type: "Rule", name: "高成本融资关注规则", value: "3 个主体命中", object: "命中主体范围", source: "固定 Rule 评估结果" },
        { id: "metric-short", type: "Metric", name: "短期债务余额占比", value: "31.4%", object: "集团合并范围", source: "Published 债务期限结构口径" },
        {
          id: "action-optimize",
          type: "Action Type",
          name: "发起融资结构优化评估",
          value: "允许请求",
          object: "3 个高成本融资关注主体",
          source: "Published Action Type",
          resourceId: "action-type-financing-structure-review",
          version: "Published 2026.07",
          purpose: "融资结构优化评估",
          targets: [
            { id: "FIN-ORG-003", name: "融资主体 003" },
            { id: "FIN-ORG-008", name: "融资主体 008" },
            { id: "FIN-ORG-011", name: "融资主体 011" }
          ],
          metricRefs: ["metric-high-cost"],
          ruleRefs: ["rule-high-cost"]
        }
      ]
    },
    {
      id: "finance-2026-08-10",
      name: "集团融资候选证据包",
      kind: "finance",
      status: "quality-blocked",
      statusLabel: "不可用于运行",
      dataVersion: "融资标准化数据 · 2026-08-10",
      dataAsOf: "2026-08-10",
      ontologyVersion: "企业融资语义 · Published 2026.07",
      quality: "机构编码引用完整性未通过",
      freshness: "新鲜",
      authority: "尚未进入权威消费组合",
      formedAt: "2026-08-11 11:20",
      previousId: "finance-2026-07-31",
      requestContext: { ...FINANCE_CANDIDATE_REQUEST_CONTEXT },
      credibility: {
        contract: "C017 Agent 安全投影",
        contextStatus: "quality-blocked",
        versionBindingSummary: {
          id: "c017-binding-finance-2026-08-10",
          version: "1.0",
          status: "blocked",
          label: "候选绑定不可消费",
          formedAt: "2026-08-11 11:20",
          observedAt: "2026-08-11 11:20",
          t006: "融资标准化数据资产",
          t007: "融资标准化数据 · 2026-08-10",
          t008: "2026-08-10",
          t008Source: "数据工程权威业务时点",
          ontology: "企业融资语义 · Published 2026.07",
          binding: "候选组合，未被本体采用",
          reason: "质量结论已固定，但候选版本不得进入 Agent 正式输入。"
        },
        currentStateSummary: {
          id: "c017-current-finance-2026-08-10",
          version: "1.0",
          status: "quality-blocked",
          label: "候选质量阻断",
          observedAt: "2026-08-11 11:20",
          quality: "机构编码引用完整性未通过",
          freshness: "新鲜",
          factAge: "1 天（判断时点：2026-08-11 11:20）",
          freshnessThreshold: "融资洞察新鲜度规则 · 1.0",
          freshnessThresholdOwner: "融资洞察业务 Owner",
          applicableScope: "融资标准化数据候选版本",
          dataQualification: "禁止",
          refresh: "未采用，当前权威组合未切换",
          useConclusion: "禁止发起新洞察、确认新结果或准备 Action Request；只能等待上游明确提供并采用新的固定证据包后创建新运行。"
        },
        identities: {
          current: {
            role: "当前权威",
            status: "ready",
            label: "继续服务",
            t006: "融资标准化数据资产",
            t007: "融资标准化数据 · 2026-07-31",
            t008: "2026-07-31",
            reason: "候选失败未改变当前权威指向。"
          },
          candidate: {
            role: "较新候选",
            status: "quality-blocked",
            label: "质量阻断",
            t006: "融资标准化数据资产",
            t007: "融资标准化数据 · 2026-08-10",
            t008: "2026-08-10",
            reason: "167 笔记录缺失机构编码，引用完整性为 96.8%。"
          },
          previousQualified: {
            role: "上一具备采用资格",
            status: "ready",
            label: "可继续服务",
            t006: "融资标准化数据资产",
            t007: "融资标准化数据 · 2026-07-31",
            t008: "2026-07-31",
            reason: "具备采用资格且本版本自身未受候选质量问题影响。"
          },
          previousAuthoritative: {
            role: "上一权威服务",
            status: "ready",
            label: "仍是当前权威",
            t006: "融资标准化数据资产",
            t007: "融资标准化数据 · 2026-07-31",
            t008: "2026-07-31",
            reason: "候选未被采用，所以前一权威组合没有退出服务。"
          }
        },
        refresh: {
          status: "blocked",
          label: "候选已阻断",
          observedAt: "2026-08-11 11:20",
          requestState: "候选质量结论已形成",
          resultState: "不具备采用资格",
          recovery: "修正机构编码引用后形成新 T007；不在原候选上改写质量结论。"
        },
        ontologyAdoption: {
          status: "blocked",
          label: "未采用",
          ontology: "企业融资语义 · Published 2026.07",
          dataVersion: "融资标准化数据 · 2026-08-10",
          observedAt: "2026-08-11 11:20",
          source: "只读引用的候选质量与本体采用状态"
        },
        consumptionReadiness: {
          status: "blocked",
          label: "不可供 Agent 消费",
          allowedUse: "仅可查看质量摘要与恢复要求",
          observedAt: "2026-08-11 11:20",
          reason: "候选版本质量门未通过且未被权威采用。"
        },
        stableEvidence: {
          status: "complete",
          label: "阻断证据可核对",
          refs: ["T006 数据资产", "T007 候选版本", "T008 数据截至时间", "质量检查摘要", "当前权威组合引用"],
          reason: "证据可证明候选为何不可消费；不因此把候选业务值暴露给 Agent。"
        },
        postQuality: {
          status: "quality-blocked",
          label: "硬质量失败",
          checkedAt: "2026-08-11 11:20",
          scope: "融资标准化数据 · 2026-08-10",
          reason: "机构编码引用完整性不满足固定证据门。",
          recovery: "阻断该版本的新洞察、新确认和 Action Request；修正后以新版本重新评估。"
        },
        agentGates: [
          { id: "new-run", name: "发起新洞察运行", status: "blocked", label: "阻断", reason: "候选版本硬质量失败且未被采用。", recovery: "等待上游明确提供并采用新的固定证据包；Agent 不自行选择上一版本。" },
          { id: "confirm-result", name: "确认新生成结果", status: "blocked", label: "阻断", reason: "不允许基于硬质量失败版本新确认正式洞察。", recovery: "既有历史结果保留原证据并按适用范围标记陈旧，不自动生成替代结果。" },
          { id: "action-request", name: "准备 Action Request", status: "blocked", label: "阻断", reason: "该候选不得作为新行动请求证据。", recovery: "改用符合用途门的固定证据后重新发起；不替换原请求证据。" },
          { id: "report-draft-transfer", name: "移交报告草稿评审副本", status: "blocked", label: "合同与质量双重阻断", reason: "候选包不是 Report Generation Request，且当前存在硬质量失败。", recovery: "先由数据工程形成新的合格版本，再由报告中心提供完整报告生成请求和固定证据。" }
        ],
        historyDimensions: [
          { id: "version-location", name: "版本定位", status: "available", label: "可定位", reason: "T006、T007 与 T008 候选引用完整。", checkedAt: "2026-08-11 11:20", recovery: "定位失败时只保留已有摘要，不回退到其他版本。" },
          { id: "content-access", name: "内容访问", status: "limited", label: "仅质量安全投影", reason: "只提供失败项、影响范围和恢复要求，不向 Agent 提供候选业务明细。", checkedAt: "2026-08-11 11:20", recovery: "待修正版本通过门禁后，以新的安全投影重新评估。" },
          { id: "evidence-completeness", name: "证据完整", status: "complete", label: "阻断证据完整", reason: "质量失败的版本、时点、范围和责任位置可核对。", checkedAt: "2026-08-11 11:20", recovery: "如阻断证据缺失，状态降为无法判断并继续禁止消费。" },
          { id: "replay-capability", name: "重放能力", status: "dependency-missing", label: "依赖不足", reason: "安全投影未提供完整重放依赖和可执行条件。", checkedAt: "2026-08-11 11:20", recovery: "由数据工程补齐真实依赖证据后重新评估。" },
          { id: "replay-verification", name: "重放核验", status: "not-run", label: "未执行", reason: "硬质量结论来自固定检查结果，不等于历史重放已验证。", checkedAt: "2026-08-11 11:20", recovery: "只有真实重放运行完成后才可更新为一致或不一致。" }
        ],
        useFlags: {
          isCurrentAuthoritative: false,
          hasNewerCandidate: false,
          canStartNewRun: false,
          canConfirmNewResult: false,
          canPrepareActionRequest: false,
          canUseAsPreviousTrusted: true,
          historyDisclosureRequired: true
        }
      },
      report: null,
      items: [
        { id: "quality-institution", type: "质量摘要", name: "机构编码引用完整性", value: "96.8%", object: "融资明细", source: "固定质量检查结果" },
        { id: "quality-missing", type: "质量摘要", name: "缺失机构编码记录", value: "167 笔", object: "融资明细", source: "固定质量检查结果" }
      ]
    },
  ],
  currentScenarioContext: null,
  inboundRequests: [],
  c022Rejections: [],
  c024Rejections: [],
  runs: [],
  sessions: [],
  handoffs: [],
  orchestrations: []
};

const NAV_BY_VARIANT = {
  catalog: [
    { id: "agents", label: "Agent 目录", icon: "bot" },
    { id: "resources", label: "配置资源", icon: "blocks" },
    { id: "runs", label: "运行中心", icon: "activity" },
    { id: "evidence", label: "证据与结果", icon: "files" },
    { id: "orchestrations", label: "协作编排", icon: "workflow" }
  ],
  task: [
    { id: "runs", label: "任务工作台", icon: "list-checks" },
    { id: "evidence", label: "结果与证据", icon: "files" },
    { id: "agents", label: "Agent 目录", icon: "bot" },
    { id: "resources", label: "配置资源", icon: "blocks" },
    { id: "orchestrations", label: "协作编排", icon: "workflow" }
  ],
  orchestration: [
    { id: "orchestrations", label: "协作工作台", icon: "workflow" },
    { id: "agents", label: "Agent 目录", icon: "bot" },
    { id: "resources", label: "配置资源", icon: "blocks" },
    { id: "runs", label: "运行中心", icon: "activity" },
    { id: "evidence", label: "证据与结果", icon: "files" }
  ]
};

Object.assign(window, {
  AGENT_WORKSPACE_CONFIG,
  AGENT_PROMPTS,
  AGENT_SKILLS,
  AGENT_TOOLS,
  AGENT_APP_INITIAL_STATE,
  AGENT_NAV_ITEMS: NAV_BY_VARIANT[AGENT_WORKSPACE_CONFIG.variant] || NAV_BY_VARIANT.catalog
});
