window.DE_DATA = {
  sourceGroups: [
    { key: "手工工作簿", label: "手工工作簿", status: "可用", description: "人工选择工作簿，创建稳定数据源并持续上传新快照。" },
    { key: "共享文件夹", label: "共享文件夹", status: "可用", description: "同步平台可持续访问的固定目录，发现新文件后形成快照。" },
    { key: "SAP", label: "SAP", status: "后期规划", description: "保留后续真实来源的目录位置，当前不提供连接或同步。" },
    { key: "司库系统", label: "司库系统", status: "后期规划", description: "保留真实司库连接器的扩展位置，当前不提供连接或同步。" },
    { key: "数据中台", label: "数据中台", status: "后期规划", description: "保留 FIS 等中台数据接入位置，当前不提供连接或同步。" }
  ],
  sources: [
    {
      id: "finance-workbook",
      name: "融资一览表",
      category: "手工工作簿",
      access: "按需上传工作簿",
      description: "持续接收融资明细和单位负责人映射；每次上传完整工作簿形成一份新快照。",
      registration: "尚无快照 · 等待上传",
      latestAcquired: "尚未上传",
      asOf: "",
      snapshotCount: 0,
      syncPlan: "按需上传新快照",
      nextSync: "由用户上传触发",
      lastSync: "尚未上传",
      enabled: true,
      workbookKey: "finance",
      fileName: "",
      physicalEvidence: "尚未上传工作簿",
      sourceArtifact: {
        path: "/Users/domi/Public/Vibecoding/ontology3.0/outputs/019fe24f-db30-7da0-9401-1a959656dd7e/融资一览表_一期演示数据.xlsx",
        sha256: "83232e2dda913e63d2faa1e45aab824270f4ab5bcb96849a44ab8a03f93db12d",
        sizeBytes: 807264,
        modifiedAt: "2026-08-09 09:24:31",
        role: "结构核验指纹参考，不是已登记快照"
      },
      structureVerification: {
        sha256: "83232e2dda913e63d2faa1e45aab824270f4ab5bcb96849a44ab8a03f93db12d",
        sizeBytes: 807264,
        statusWhenMatched: "结构已核验",
        statusWhenUnmatched: "已登记 · 结构未核验 · 阻断正式运行"
      },
      contentFindings: [
        { field: "利率形式", checkedCount: 5218, observedCount: 212, finding: "允许缺失 · 必须在质量摘要中披露", forbiddenInterpretation: "不得补为固定利率、浮动利率或 0" },
        { field: "期限种类", checkedCount: 5218, observedCount: 212, finding: "允许缺失 · 必须在质量摘要中披露", forbiddenInterpretation: "不得补为短期、中期、长期或 0" },
        { field: "担保方式", checkedCount: 5218, observedCount: 1868, finding: "允许缺失 · 必须在质量摘要中披露", forbiddenInterpretation: "不得补为信用、无担保或否" }
      ],
      snapshots: [],
      pipelineRefs: [
        { pipelineId: "finance-pipeline", name: "融资数据标准化与发布", definition: "编辑草稿", node: "数据源", lastRun: "尚无正式运行" }
      ],
      downstreamAssets: []
    },
    {
      id: "s003-workbook",
      name: "企业债务风险评估模版",
      category: "手工工作簿",
      access: "按需上传工作簿",
      description: "已取得包含财务数据和调节因子的校正工作簿；内容已核验，等待受控登记。",
      registration: "文件已取得 · 内容已核验 · 待受控登记",
      latestAcquired: "尚未登记",
      asOf: "2025-12-31 · 已确认待登记",
      snapshotCount: 0,
      syncPlan: "按需上传新快照",
      nextSync: "完成受控登记后配置",
      lastSync: "尚未登记",
      enabled: false,
      selectable: false,
      workbookKey: "s003",
      fileName: "企业债务风险评估模版_S003兼容版.xlsx",
      physicalEvidence: "已取得文件 · 企业债务风险评估模版_S003兼容版.xlsx · 尚未登记为正式快照",
      sha256: "dbdab9c870d7f2e456c3a9e0f91b340b372da6d40eb241551e0ee8848cac42a0",
      previousSha256: "dd917b497f43ebf5c72607b49d70ae049969a32505311fb6bf9aa7a85d36a498",
      sourceArtifact: {
        path: "/Users/domi/Public/Vibecoding/ontology3.0/outputs/019fe492-60b5-70e3-a8d2-f5f1844b27da/企业债务风险评估模版_S003兼容版.xlsx",
        sha256: "dbdab9c870d7f2e456c3a9e0f91b340b372da6d40eb241551e0ee8848cac42a0",
        previousSha256: "dd917b497f43ebf5c72607b49d70ae049969a32505311fb6bf9aa7a85d36a498",
        sizeBytes: 16250,
        modifiedAt: "2026-08-10 16:05:11",
        revision: "仅将财务数据!AA1改为“利润总额_本年累计数(上年)”，未修改业务数据"
      },
      compatibilityStatus: {
        authorityStage: "数据工程兼容性验证",
        internalResult: "数据内容已确认 · 待受控发布验证",
        fileObtained: true,
        contentVerified: true,
        controlledRegistration: "待完成",
        contractCompatibility: "兼容",
        consumptionStatus: "不可消费",
        nextOwner: "数据工程",
        nextAction: "完成数据源、快照和正式业务输入登记后执行获准的四步兼容性路径"
      },
      platformEvidence: {
        t001SourceId: null,
        t002SnapshotId: null,
        t053BusinessInputSnapshotId: null,
        t003PipelineDefinitionId: null,
        t005QualityResultId: null,
        t007AssetVersionId: null
      },
      snapshots: [],
      pipelineRefs: [],
      downstreamAssets: []
    },
    {
      id: "finance-folder",
      name: "融资数据共享文件夹",
      category: "共享文件夹",
      access: "固定目录发现",
      description: "从固定目录取得匹配文件；当前使用手工同步，不自动轮询。",
      registration: "已配置 · 尚无快照",
      latestAcquired: "尚未检查",
      asOf: "从文件名识别后人工确认",
      snapshotCount: 0,
      syncPlan: "仅手工同步",
      nextSync: "无定时计划",
      lastSync: "尚未执行",
      enabled: true,
      folderPath: "/Users/domi/Public/Vibecoding/ontology3.0/demo_shared/融资数据待处理/",
      filePattern: "融资一览表_*.xlsx",
      pipelineRefs: [],
      downstreamAssets: []
    },
    {
      id: "sap-journal",
      name: "会计凭证行项目",
      category: "SAP",
      access: "SAP 连接器",
      description: "计划接入总账凭证明细，当前仅保留来源目录信息。",
      registration: "后期规划 · 尚未接入",
      latestAcquired: "尚未接入",
      asOf: "不适用",
      snapshotCount: 0,
      syncPlan: "尚未启用",
      enabled: false,
      planned: true
    },
    {
      id: "sap-account",
      name: "会计科目主数据",
      category: "SAP",
      access: "SAP 连接器",
      description: "计划接入科目编码、名称和层级，当前仅保留来源目录信息。",
      registration: "后期规划 · 尚未接入",
      latestAcquired: "尚未接入",
      asOf: "不适用",
      snapshotCount: 0,
      syncPlan: "尚未启用",
      enabled: false,
      planned: true
    },
    {
      id: "treasury-flow",
      name: "银行账户流水",
      category: "司库系统",
      access: "司库连接器",
      description: "计划接入账户、日期和收支金额，当前仅保留来源目录信息。",
      registration: "后期规划 · 尚未接入",
      latestAcquired: "尚未接入",
      asOf: "不适用",
      snapshotCount: 0,
      syncPlan: "尚未启用",
      enabled: false,
      planned: true
    },
    {
      id: "treasury-finance",
      name: "融资明细",
      category: "司库系统",
      access: "司库连接器",
      description: "计划接入合同、借据和余额，当前仅保留来源目录信息。",
      registration: "后期规划 · 尚未接入",
      latestAcquired: "尚未接入",
      asOf: "不适用",
      snapshotCount: 0,
      syncPlan: "尚未启用",
      enabled: false,
      planned: true
    },
    {
      id: "fis-form",
      name: "FIS 业务流程表单",
      category: "数据中台",
      access: "数据中台连接器",
      description: "计划接入流程、表单和状态，当前仅保留来源目录信息。",
      registration: "后期规划 · 尚未接入",
      latestAcquired: "尚未接入",
      asOf: "不适用",
      snapshotCount: 0,
      syncPlan: "尚未启用",
      enabled: false,
      planned: true
    }
  ],
  workbooks: {
    finance: {
      label: "融资一览表_一期演示数据.xlsx",
      note: "仅当上传文件与已核验指纹一致时识别为 2 个业务输入 Sheet；说明页和问数样例不进入管道输入。",
      sheets: [
        {
          id: "finance-detail",
          name: "2-融资一览表明细",
          input: true,
          range: "A1:AI5219",
          headerRow: 1,
          rows: 5218,
          cols: 35,
          classification: "明细数据",
          fields: ["所属板块","借款人","境内外","融资机构类别","融资机构","提款开始日期","提款结束日期","借据编号","提款日期","提款到期日期","借据币种","提款折算人民币汇率","借据余额（原币）","借据余额（折合人民币）","当前利率","利率形式","年月日利率","计息天数","利率类型名称","基准利率值","浮动方式","浮动值","利率调整周期","利率调整首次生效日","结息方式","结息周期","首次付息日","封顶利率","融资大类","融资类型","融资类别大类","银团贷款编号","金融产品类型","期限种类","担保方式"],
          sampleColumns: ["所属板块","借款人","境内外","融资机构类别","融资机构","借据编号","提款到期日期","借据币种","借据余额（折合人民币）","利率形式","期限种类","担保方式"],
          samples: [
            ["产业金融","演示单位001","境外","银行","演示环球银行","DEMO-DEBT-000001","2026-04-13","人民币",41600000,"浮动利率","中期","信用"],
            ["产业金融","演示单位001","境外","银行","演示亚太银行","DEMO-DEBT-000002","2026-04-13","人民币",48800000,"浮动利率","中期","信用"],
            ["产业金融","演示单位001","境外","银行","演示环球银行","DEMO-DEBT-000003","2026-06-08","人民币",119100000,"固定利率","中期","信用"],
            ["产业金融","演示单位001","境外","银行","演示海岸银行","DEMO-DEBT-000004","2028-03-10","人民币",98800000,"固定利率","中期","信用"],
            ["产业金融","演示单位001","境外","银行","演示环球银行","DEMO-DEBT-000005","2026-07-20","人民币",145100000,"固定利率","中期",null]
          ]
        },
        { id: "finance-readme", name: "Sheet1", input: false, range: "A1:G35", headerRow: 1, rows: 35, cols: 7, classification: "未纳入处理 · 文件说明", fields: ["一期融资演示数据说明与校验"], sampleColumns: ["项目","内容"], samples: [["项目","集团融资成本与债务结构优化演示"],["源文件","融资一览表脱敏版.xlsx"],["金额单位","人民币元；原币余额按汇率反推并取整"],["用途声明","全部金额、单位、融资机构和负责人均为演示数据，不得用于真实融资判断"]] },
        { id: "finance-owner", name: "单位负责人映射", input: true, range: "A1:D577", headerRow: 3, rows: 574, cols: 4, classification: "映射数据", fields: ["借款单位编码","借款单位名称","融资负责人标识","融资负责人名称"], sampleColumns: ["借款单位编码","借款单位名称","融资负责人标识","融资负责人名称"], samples: [["UNIT-001","演示单位001","DEMO-OWNER-001","融资负责人001"],["UNIT-002","演示单位002","DEMO-OWNER-002","融资负责人002"],["UNIT-003","演示单位003","DEMO-OWNER-003","融资负责人003"],["UNIT-004","演示单位004","DEMO-OWNER-004","融资负责人004"]] },
        { id: "finance-questions", name: "场景问数样例", input: false, range: "A1:J44", headerRow: 6, rows: 44, cols: 10, classification: "未纳入处理 · 业务说明", fields: ["主规则","演示单位","融资负责人","融资笔数","融资余额（亿元）","余额加权融资成本","高成本余额占比","浮动利率余额占比","短期债务余额占比","规则校验"], sampleColumns: ["主规则","演示单位","融资负责人","融资笔数","融资余额（亿元）","余额加权融资成本","高成本余额占比","浮动利率余额占比","短期债务余额占比","规则校验"], samples: [["R01 融资成本偏高","演示单位553","融资负责人001",75,393.134,0.028809840156282587,0.7733724378964933,0,0,"仅命中 R01"],["R02 浮动利率暴露","演示单位465","融资负责人009",176,770,0.021966171558441556,0,1,0.011446753246753247,"仅命中 R02"],["R03 短期债务集中","演示单位561","融资负责人009",50,20.016,0.022283802957633894,0,0,0.9354516386890488,"仅命中 R03"]] }
      ]
    },
    s003: {
      label: "企业债务风险评估模版_S003兼容版.xlsx",
      note: "已取得文件包含财务数据和调节因子两个业务输入 Sheet；内容已核验，但尚未受控登记为正式快照。",
      sheets: [
        {
          id: "s003-financial",
          name: "财务数据",
          range: "A1:AA22",
          headerRow: 1,
          rows: 21,
          cols: 27,
          classification: "财务输入",
          fields: ["单位名称","流动负债合计_年初余额","流动负债合计_期末余额","营业总收入_本年累计数","营业利润_本年累计数","净利润_本年累计数","交易性金融资产_期末余额","利润总额_上年同期累计数","利润总额_本年累计数","存货_期末余额","存货_年初余额","实收资本（股本）_期末余额","应收账款_期末余额","应收账款_年初余额","所有者权益（或股东权益）合计_期末余额","所有者权益（或股东权益）合计_年初余额","流动资产合计_期末余额","经营活动产生的现金流量净额_本年累计数","经营活动现金流入小计_本年累计数","营业成本_本年累计数","负债合计_期末余额","财务费用_本年累计数","货币资金_期末余额","资产总计_期末余额","资产总计_年初余额(上年)","利润总额_上年同期累计数(上年)","利润总额_本年累计数(上年)"],
          sampleColumns: ["单位名称","流动负债合计_期末余额","营业总收入_本年累计数","利润总额_本年累计数","资产总计_期末余额","利润总额_本年累计数(上年)"],
          samples: [
            ["风电测试公司01",157604723.54,165253679.04,29592164.73,2401237335.86,80023640.21],
            ["风电测试公司02",149465816.73,139232065.41,24363333.89,1963645551.06,67060516.92],
            ["风电测试公司03",156736382.21,160630633.82,29776922.02,2354869416.43,73009250.98],
            ["风电测试公司04",151003728.71,157375682.06,30099628.66,2309930447.52,74685322.48],
            ["风电测试公司05",193741948.78,131791641.47,13662164.91,1885051891.18,59759475.46]
          ]
        },
        {
          id: "s003-factors",
          name: "调节因子",
          range: "A1:I22",
          headerRow: 1,
          rows: 21,
          cols: 9,
          classification: "人工业务输入",
          fields: ["单位名称","产业板块","公司类别","融资能力（已用授信余额/授信总额）","担保情况","总部支持程度","电价波动率","是否存在重大诉讼","资金余缺预警"],
          sampleColumns: ["单位名称","产业板块","公司类别","融资能力（已用授信余额/授信总额）","总部支持程度","电价波动率","是否存在重大诉讼","资金余缺预警"],
          samples: [
            ["风电测试公司01","新能源","新能源产业-风电","一般","中","电价变化率大于0","无重大诉讼","未来第一个月资金余缺预警"],
            ["风电测试公司02","新能源","新能源产业-风电","良好","高","电价变化率大于0","一般性诉讼","未来第三个月资金余缺预警"],
            ["风电测试公司03","新能源","新能源产业-风电","良好","较高","电价变化率小于等于-15%","无重大诉讼","未来第三个月资金余缺预警"],
            ["风电测试公司04","新能源","新能源产业-风电","良好","中","电价变化率大于0","无重大诉讼","未来第三个月资金余缺预警"],
            ["风电测试公司05","新能源","新能源产业-风电","良好","中","电价变化率小于等于-15%","无重大诉讼","未来第三个月资金余缺预警"]
          ]
        }
      ]
    }
  },
  qualityResults: [],
  failureScenarios: [
    {
      id: "S001-FAILURE-INSTITUTION-MAPPING",
      scene: "S001",
      activation: "仅在失败分支触发时形成新正式运行；不属于初始运行历史",
      failureNode: "数据检查",
      status: "失败",
      qualityStatus: "失败",
      publishStatus: "未执行",
      refreshStatus: "未执行",
      affectedRule: {
        id: "FIN-Q-006",
        ruleVersion: "v1.0.0",
        name: "机构引用完整",
        type: "引用完整性",
        scope: "融资明细.机构编码 → 金融机构参考.机构编码",
        condition: "每条融资明细的机构编码均能匹配一个金融机构",
        severity: "硬阻断",
        failureEffect: "阻断发布数据资产",
        checkedCount: 5218,
        failedCount: 2,
        sampleCount: 2,
        samples: [
          { evidenceRef: "融资明细!第104行", businessKey: "仅在失败分支生成", issue: "机构规范值无法解析为稳定机构编码" },
          { evidenceRef: "融资明细!第271行", businessKey: "仅在失败分支生成", issue: "机构编码没有匹配金融机构参考成员" }
        ],
        impact: "质量硬阻断；发布节点和刷新节点均不得执行",
        owner: "数据工程",
        recovery: "补充机构映射后，使用原快照和原已发布定义创建新的关联重试；原失败运行只读保留"
      },
      authoritativeVersionProtection: {
        authoritativeVersionId: null,
        behavior: "首次联调尚无权威版本；候选失败时保持不可消费，不形成发布、刷新或采用结果"
      }
    }
  ],
  ontologyConsumptionBindings: [],
  ontologyExternalReceipts: null,
  targetAssets: [
    {
      id: "finance-asset-target",
      t006Id: "FIN-ASSET",
      name: "融资标准化数据资产",
      scene: "S001",
      purpose: "为已发布本体提供按业务时点一致发布的融资主体、融资明细、金融机构和融资负责人事实。",
      owner: "当前演示账号",
      published: false,
      status: "尚未发布",
      versionCount: 0,
      currentVersion: "尚未发布",
      currentAuthoritativeVersion: "尚未采用",
      asOf: "无",
      quality: "尚无质量结论",
      publishedAt: "",
      sourceSnapshot: "",
      sourceSnapshotId: "",
      runId: "",
      refreshStatus: "尚未请求",
      consumptionStatus: "不可消费",
      detailViews: [
        { key: "overview", label: "版本概览" },
        { key: "members", label: "包含的数据" },
        { key: "lineage", label: "如何产生" },
        { key: "consumption", label: "如何变为可用" }
      ],
      reusePolicy: {
        allowed: true,
        selectionMode: "显式选择精确版本与成员范围",
        defaultMemberScope: "全部四成员",
        cycleProtection: "禁止同一数据资产的输出回读自身",
        s003CompatibilityVersionAllowed: false
      },
      members: [
        {
          id: "FIN-MEMBER-SUBJECT",
          name: "融资主体参考",
          grain: "一行一融资主体",
          key: "单位编码",
          identityFieldId: "FIELD-FINANCING-ENTITY-UNIT-CODE",
          identityEvidenceLocator: "数据工程 / 身份检查 / FIN-MEMBER-SUBJECT",
          fields: [
            { fieldId: "FIELD-FINANCING-ENTITY-UNIT-CODE", name: "单位编码", type: "文本标识", nullable: false, role: "主键", description: "融资主体稳定标识" },
            { fieldId: "FIELD-FINANCING-ENTITY-UNIT-NAME", name: "单位名称", type: "文本", nullable: false, role: "展示字段", description: "脱敏融资主体名称" },
            { fieldId: "FIELD-FINANCING-ENTITY-SECTOR", name: "产业板块", type: "文本", nullable: false, role: "分类字段", description: "D007 已确认展示值" },
            { fieldId: "FIELD-FINANCING-ENTITY-OWNER-ID", name: "负责人标识", type: "文本标识", nullable: false, role: "外键", description: "引用融资负责人参考" }
          ]
        },
        {
          id: "FIN-MEMBER-DETAIL",
          name: "融资明细",
          grain: "一行一笔融资借据",
          key: "借据编号",
          identityFieldId: "FIELD-FINANCING-DETAIL-LOAN-ID",
          identityEvidenceLocator: "数据工程 / 身份检查 / FIN-MEMBER-DETAIL",
          fields: [
            { fieldId: "FIELD-FINANCING-DETAIL-LOAN-ID", name: "借据编号", type: "文本标识", nullable: false, role: "主键", description: "融资借据稳定标识" },
            { fieldId: "FIELD-FINANCING-DETAIL-ENTITY-CODE", name: "单位编码", type: "文本标识", nullable: false, role: "外键", description: "引用融资主体参考" },
            { fieldId: "FIELD-FINANCING-DETAIL-INSTITUTION-CODE", name: "机构编码", type: "文本标识", nullable: false, role: "外键", description: "引用金融机构参考" },
            { fieldId: "FIELD-FINANCING-DETAIL-CNY-BALANCE", name: "借据余额（折合人民币）", type: "十进制数", nullable: false, role: "事实字段", description: "人民币元" },
            { fieldId: "FIELD-FINANCING-DETAIL-INTEREST-RATE", name: "当前利率", type: "十进制数", nullable: false, role: "事实字段", description: "融资当前利率" },
            { fieldId: "FIELD-FINANCING-DETAIL-RATE-TYPE", name: "利率形式", type: "枚举", nullable: false, role: "分类字段", description: "固定利率或浮动利率" },
            { fieldId: "FIELD-FINANCING-DETAIL-TERM-TYPE", name: "期限种类", type: "枚举", nullable: false, role: "分类字段", description: "短期或中长期" },
            { fieldId: "FIELD-FINANCING-DETAIL-AS-OF-DATE", name: "数据截至时间", type: "日期", nullable: false, role: "版本字段", description: "与该数据资产版本的数据截至时间一致" }
          ]
        },
        {
          id: "FIN-MEMBER-INSTITUTION",
          name: "金融机构参考",
          grain: "一行一金融机构",
          key: "机构编码",
          identityFieldId: "FIELD-FINANCIAL-INSTITUTION-CODE",
          identityEvidenceLocator: "数据工程 / 身份检查 / FIN-MEMBER-INSTITUTION",
          fields: [
            { fieldId: "FIELD-FINANCIAL-INSTITUTION-CODE", name: "机构编码", type: "文本标识", nullable: false, role: "主键", description: "金融机构稳定标识" },
            { fieldId: "FIELD-FINANCIAL-INSTITUTION-NAME", name: "机构名称", type: "文本", nullable: false, role: "展示字段", description: "脱敏金融机构名称" },
            { fieldId: "FIELD-FINANCIAL-INSTITUTION-CATEGORY", name: "机构类别", type: "文本", nullable: false, role: "分类字段", description: "银行或非银" }
          ]
        },
        {
          id: "FIN-MEMBER-OWNER",
          name: "融资负责人参考",
          grain: "一行一负责人",
          key: "负责人标识",
          identityFieldId: "FIELD-FINANCING-OWNER-ID",
          identityEvidenceLocator: "数据工程 / 身份检查 / FIN-MEMBER-OWNER",
          fields: [
            { fieldId: "FIELD-FINANCING-OWNER-ID", name: "负责人标识", type: "文本标识", nullable: false, role: "主键", description: "融资负责人稳定标识" },
            { fieldId: "FIELD-FINANCING-OWNER-NAME", name: "负责人名称", type: "文本", nullable: false, role: "展示字段", description: "脱敏负责人名称" }
          ]
        }
      ],
      relationships: ["融资明细 → 融资主体","融资明细 → 金融机构","融资主体 → 融资负责人"],
      relationshipContracts: [
        { id: "FIN-REL-DETAIL-SUBJECT", name: "融资明细 → 融资主体", sourceMemberId: "FIN-MEMBER-DETAIL", sourceField: "单位编码", sourceFieldId: "FIELD-FINANCING-DETAIL-ENTITY-CODE", targetMemberId: "FIN-MEMBER-SUBJECT", targetField: "单位编码", targetFieldId: "FIELD-FINANCING-ENTITY-UNIT-CODE", endpointEvidenceLocator: "数据工程 / 关系检查 / FIN-REL-DETAIL-SUBJECT" },
        { id: "FIN-REL-DETAIL-INSTITUTION", name: "融资明细 → 金融机构", sourceMemberId: "FIN-MEMBER-DETAIL", sourceField: "机构编码", sourceFieldId: "FIELD-FINANCING-DETAIL-INSTITUTION-CODE", targetMemberId: "FIN-MEMBER-INSTITUTION", targetField: "机构编码", targetFieldId: "FIELD-FINANCIAL-INSTITUTION-CODE", endpointEvidenceLocator: "数据工程 / 关系检查 / FIN-REL-DETAIL-INSTITUTION" },
        { id: "FIN-REL-SUBJECT-OWNER", name: "融资主体 → 融资负责人", sourceMemberId: "FIN-MEMBER-SUBJECT", sourceField: "负责人标识", sourceFieldId: "FIELD-FINANCING-ENTITY-OWNER-ID", targetMemberId: "FIN-MEMBER-OWNER", targetField: "负责人标识", targetFieldId: "FIELD-FINANCING-OWNER-ID", endpointEvidenceLocator: "数据工程 / 关系检查 / FIN-REL-SUBJECT-OWNER" }
      ],
      versions: [],
      versionRoles: {
        latestPublished: { versionId: null, status: "尚未发布" },
        latestDataQualified: { versionId: null, status: "尚无质量结论" },
        currentAuthoritative: { versionId: null, status: "尚未采用", consumable: false },
        candidate: { runId: null, versionId: null, status: "尚未形成候选版本", consumable: false },
        previousTrusted: { versionId: null, status: "尚无上一权威历史", consumable: false }
      },
      lineage: {
        status: "尚未形成",
        versionLocation: "尚无发布版本",
        contentAccess: "不可消费",
        replayCapability: "尚无正式运行可重放",
        replayVerification: "未执行",
        nodes: []
      },
      refreshConsumption: null
    }
  ],
  pipelines: [
    { id: "finance-pipeline", name: "融资数据标准化与发布", purpose: "将确定来源快照经受控 Python、通用质量门、资产发布和提交本体刷新请求形成完整闭环。", definitionState: "草稿", definitionVersion: "草稿 0.1", nodeCount: 5, source: "融资一览表", targetAsset: "融资标准化数据资产", ontologyBindingId: "", latestRun: "尚未运行", schedule: "仅手工正式运行", canOpen: true },
    {
      id: "s003-structure",
      scene: "S003",
      name: "债务风险输入准备",
      purpose: "验证财务数据与调节因子双成员的受控接入和不可消费版本包络。",
      definitionState: "数据内容已确认 · 待受控登记",
      definitionVersion: "尚未形成正式管道定义",
      nodeCount: 0,
      expectedNodeCount: 4,
      expectedNodes: ["数据源","债务风险输入标准化","数据检查","发布兼容性数据资产"],
      source: "企业债务风险评估模版_S003兼容版.xlsx",
      targetAsset: "尚未形成",
      latestRun: "尚未运行",
      schedule: "尚未配置",
      canOpen: false,
      canRun: false,
      canPublish: false,
      canRefresh: false,
      consumptionStatus: "不可消费"
    }
  ],
  formalRuns: [],
  nodeDefinitions: [
    { key: "source", name: "数据源", icon: "database", color: "#3b6bb6", hint: "锁定原始快照或受控资产版本", libraryGroup: "输入", trialEligible: true, formalStep: { order: 1, stage: "读取输入", actionLabel: "锁定输入", resultLabel: "输入已锁定" } },
    { key: "python", name: "Python 处理", icon: "python", color: "#6b56ad", hint: "选择预置受控脚本与版本", libraryGroup: "处理与质量", trialEligible: true, formalStep: { order: 2, stage: "处理数据", actionLabel: "执行处理", resultLabel: "处理已完成" } },
    { key: "quality", name: "数据检查", icon: "shield", color: "#b56a18", hint: "执行通用质量规则和发布门", libraryGroup: "处理与质量", trialEligible: true, formalStep: { order: 3, stage: "检查质量", actionLabel: "执行检查", resultLabel: "质量检查已完成" } },
    { key: "publish", name: "发布数据资产", icon: "package", color: "#1d846c", hint: "生成发布后不被覆盖的数据资产版本", libraryGroup: "发布", trialEligible: false, formalStep: { order: 4, stage: "发布资产", actionLabel: "确认发布数据资产", resultLabel: "资产版本已发布" } },
    { key: "refresh", name: "提交本体刷新请求", icon: "refresh", color: "#356d79", hint: "选择本体侧已建目标并提交本次资产版本", libraryGroup: "发布", trialEligible: false, formalStep: { order: 5, stage: "提交刷新", actionLabel: "提交本体刷新请求", resultLabel: "请求与本体侧回执已记录" } }
  ],
  qualityRules: [
    { id: "FIN-Q-001", version: "v1.0.0", name: "借据编号必填", type: "必填和空值率", scope: "融资明细 · 借据编号", condition: "每条融资明细的借据编号均非空", severity: "硬阻断", failureEffect: "阻断发布数据资产", recovery: "补充缺失借据编号后以同一快照重试，或上传修正快照形成新运行", owner: "数据工程", enabled: true },
    { id: "FIN-Q-002", version: "v1.0.0", name: "借据编号唯一", type: "唯一性", scope: "融资明细 · 借据编号", condition: "借据编号在融资明细成员内不得重复", severity: "硬阻断", failureEffect: "阻断发布数据资产", recovery: "定位重复借据并确认唯一业务键后重新运行", owner: "数据工程", enabled: true },
    { id: "FIN-Q-003", version: "v1.0.0", name: "余额字段类型", type: "字段类型", scope: "融资明细 · 借据余额（折合人民币）", condition: "余额必须为可解析的十进制数值；空值或文本不得静默转为 0", severity: "硬阻断", failureEffect: "阻断发布数据资产", recovery: "修正无法解析的金额格式，不得把文本静默转换为 0", owner: "数据工程", enabled: true },
    { id: "FIN-Q-004", version: "v1.0.0", name: "产业板块展示值", type: "枚举值", scope: "融资明细 · 所属板块", condition: "所属板块必须属于 D007 已确认的 10 个有效展示值，且不得残留六组替换前旧名称或未知名称", severity: "硬阻断", failureEffect: "阻断发布数据资产", recovery: "修正来源展示值后形成新快照；核能、核燃料、集团及直管公司、数字化保持原值，不由数据工程猜测归类", owner: "数据工程", enabled: true },
    { id: "FIN-Q-005", version: "v1.0.0", name: "主体引用完整", type: "引用完整性", scope: "融资明细.单位编码 → 融资主体参考.单位编码", condition: "每条融资明细的单位编码均能匹配一个融资主体", severity: "硬阻断", failureEffect: "阻断发布数据资产", recovery: "补充主体映射或修正单位身份后创建关联重试", owner: "数据工程", enabled: true },
    { id: "FIN-Q-006", version: "v1.0.0", name: "机构引用完整", type: "引用完整性", scope: "融资明细.机构编码 → 金融机构参考.机构编码", condition: "每条融资明细的机构编码均能匹配一个金融机构", severity: "硬阻断", failureEffect: "阻断发布数据资产", recovery: "补充机构映射后创建关联重试", owner: "数据工程", enabled: true },
    { id: "FIN-Q-007", version: "v1.0.0", name: "负责人引用完整", type: "引用完整性", scope: "融资主体参考.负责人标识 → 融资负责人参考.负责人标识", condition: "每个融资主体的负责人标识均能匹配一个负责人", severity: "硬阻断", failureEffect: "阻断发布数据资产", recovery: "补充负责人参考或修正主体外键后创建关联重试", owner: "数据工程", enabled: true }
  ],
  qualityRuleTypes: [
    "必填和空值率","字段类型","唯一性","重复行","数值范围","枚举值","日期和格式","数据量异常","数据新鲜度","字段或结构漂移","跨成员主键集合一致性","引用完整性"
  ],
  pythonCode: [
    "from controlled_modules import finance_standardize",
    "",
    "def run(snapshot, *, as_of_date, currency=\"CNY\"):",
    "    # 1. 只读取融资明细和单位负责人映射两个业务输入 Sheet",
    "    source = finance_standardize.read_workbook(",
    "        snapshot,",
    "        include=[\"2-融资一览表明细\", \"单位负责人映射\"]",
    "    )",
    "",
    "    # 2. 统一板块标签、日期/金额类型、币种和业务键，保留来源定位",
    "    normalized = finance_standardize.normalize(",
    "        source, as_of_date=as_of_date, currency=currency",
    "    )",
    "",
    "    # 3. 拆分四个资产成员并建立三条数据关系",
    "    members = finance_standardize.build_asset_members(normalized)",
    "",
    "    # 4. 附加快照、字段和记录级沿袭后返回候选结构",
    "    return finance_standardize.attach_lineage(members, snapshot)",
    "",
    "# 本节点不计算 Metric、Rule、评分或业务阈值，也不直接发布资产"
  ],
  pythonLogic: [
    { step: "01", title: "选择有效输入", lines: "04–08", copy: "只读取 2-融资一览表明细和单位负责人映射；Sheet1、场景问数样例不进入处理。" },
    { step: "02", title: "统一数据表达", lines: "10–13", copy: "规范板块展示值、日期和金额类型、币种及业务键，同时保留原字段与来源位置。" },
    { step: "03", title: "形成资产结构", lines: "15–16", copy: "拆分融资主体、融资明细、金融机构、融资负责人四个成员，并建立三条数据关系。" },
    { step: "04", title: "附加追溯证据", lines: "18–19", copy: "把输入快照、数据截至时间和记录来源带入候选输出，交给后续质量门验证。" }
  ]
};
