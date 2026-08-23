(function () {
  "use strict";

  const ADAPTER = window.OFWBaselineModuleAdapter;
  if (!ADAPTER) throw new Error("基线模块适配器未加载。");

  const baselineModuleSources = {
    M01: "../../../../prototype-releases/v1.0.3/ontology-management-review/canvas-first/index.html",
    // v1.0.3 M02 将 SCENARIO_ID 固定为 S001，无法接受 S004 C033。
    // 使用 PATCH-REGISTRY.md 已登记、带原件哈希的最小参数化副本；页面结构、
    // 路由和业务实现仍来自同一冻结 B2 页面。
    M02: "./baseline-modules/m02-data-engineering.html",
    M03: "../../../../prototype-releases/v1.0.3/intelligent-query-prototype/review-next/conversation-workspace/index.html",
    // Use the actual frozen workbench entry.  The v1.0.3 index is only a
    // redirect page, which would otherwise navigate away from the runtime
    // loader and lose the scenario storage adapter.
    M04: "../../../../prototype-releases/v1.0.3/decision-center-prototype/review-v2/action-portfolio.html",
    M05: "../../../../prototype-releases/v1.0.3/agent-application/Agent应用.html",
    M06: "../../../../prototype-releases/v1.0.3/report-center/review-lifecycle/index.html"
  };

  function loaderSource(moduleId) {
    return `./baseline-module-loader.html?moduleId=${encodeURIComponent(moduleId)}&source=${encodeURIComponent(baselineModuleSources[moduleId])}`;
  }

  const moduleSources = Object.fromEntries(Object.keys(baselineModuleSources).map((moduleId) => [moduleId, loaderSource(moduleId)]));

  const config = {
    scenarioId: "S004",
    scenarioVersion: "S004-v2.1.0",
    baselineVersion: "v1.0.3",
    baselineSnapshotId: "BSL-S001-V103-DE0119608E26",
    name: "财务公司贷款贷前调查",
    organization: "财务公司",
    focus: "集团成员单位贷款申请",
    borrowerScope: "集团成员单位",
    dataAsOf: "2026-08-15",
    sourceFile: "财务报告（已有事实）及贷前调查外部合成资料",
    sourceArtifactFile: "S004 运行时场景配置，不替代正式报告和历史制品",
    // These are authoritative identities exported by the immutable S004-v2
    // artifacts.  The v2.1 runtime projects them into an isolated scenario
    // namespace; it must not mint a second set of "RUNTIME" authority IDs.
    dataVersion: "DATA-ASSET-S004-20260815-V01",
    ontologyVersion: "T019-S004-PUBLISHED-002",
    trustedOntologyVersion: "T019-S004-PUBLISHED-002",
    bindingId: "C008-S004-AUTHORITATIVE-FACTS-002",
    companionRunId: "ARUN-S004-20260815-0002-COPILOT",
    selectedEntities: ["BORR-CN-USCC-91440300093677087R"],
    runtimeConfig: {
      configVersion: "S004-RUNTIME-CONFIG-2.1.4",
      demoClock: {
        enabled: true,
        scenarioId: "S004",
        mode: "FIXED",
        date: "2026-08-16",
        now: "2026-08-16T08:00:00.000Z",
        timeZone: "Asia/Shanghai",
        appliesTo: ["scenario-context", "directional-reset", "M01", "M02", "M03", "M04", "M05", "M06"],
        rule: "只影响 S004 v1.1.0 运行层；S001 与 v1.0.3 冻结基线默认时钟不变。"
      },
      artifactMode: "formal-http",
      artifactIntegrity: {
        algorithm: "SHA-256",
        required: true,
        expected: {
          sourceSnapshot: "2a86077a7afcbe4217c875f94a9db9ada3d02c6d7118ed904782ca333092c64a",
          publishedResources: "d8e62b08a0ea20411cd206edafee8cea1d3da075bebacd7f1ece3dd663998074",
          c008Facts: "ce9b89c15416899a68f293b57fdbac578eab587d1d18492594d1eaa86bbfa85d",
          quality: "c0ca1834bb00834465a8b491ee77fcf1d756d2ba561df35e1ff4d7086f90c717",
          c017: "6c327f875e2eeeca081e98637009451f389e2c3a6e2e4ddf1204ae1324c66ae1",
          agentConfig: "3ab6ca3bad33f8225d23033e17e9210015d9b1360e8533c520734d5820b26cdb",
          reportDefinition: "8e2c583b18b2ed72e0a56e914ee33ec7c8b1b84c9dea7ef561d45a2a1fdedb65",
          evidencePackage: "e21effe26c29b139e4be7f84e322ff0c6085ead3553d51130fb13539e33aeda1",
          draftOutput: "0c5a3ecdd91acb4f7d5bded433cdb53853850fc100999faec7d676b9aa16a915",
          reportData: "92ce0ead12f4009eaec21bb9aeeb3ac7db3781659585fafd067ecda98f361e00",
          deterministicVerification: "5ebf8c00a0da3a2dcf8c74952af8fc9df4b3d47ed22cd4e0c75b23fb2c09cdaa",
          humanConfirmation: "4a0766a9133f5882e48035f870deb4e95e4f0603f894a13471bac6454a0e38c7",
          publicationManifest: "3e35f38510fe6bd60a87ab457056f116177e0db86356bc8a7b49201e9922fe96"
        }
      },
      businessSubject: "财务公司",
      borrowerScope: "集团成员单位",
      authoritativeContractIdentities: {
        dataAssetId: "DATA-ASSET-S004",
        dataAssetVersionId: "DATA-ASSET-S004-20260815-V01",
        publishedPointer: "T019-S004-PUBLISHED-002",
        c008BundleId: "C008-S004-AUTHORITATIVE-FACTS-002",
        t019EvidenceId: "EVID-T019-S004-001",
        evidencePackageId: "EVID-S004-20260815-0002",
        rule: "M01、M02、M05、M06 展示及校验必须引用同一组身份；运行层只增加投影上下文，不改写权威标识。"
      },
      historicalArtifactProjection: {
        mode: "EXPLICIT_IMMUTABLE_ARTIFACT_PROJECTION",
        deliveryVersionLabel: "S004-v2.0.1",
        sourceScenarioContext: {
          baselineVersion: "v1.0.3",
          baselineSnapshotId: "BSL-S001-V103-DE0119608E26",
          scenarioId: "S004",
          scenarioVersion: "S004-v2",
          scenarioRunId: "S004-RUN-20260815233000000-7f3c8e42a1b6",
          formedAt: "2026-08-15T23:30:00.000Z"
        },
        targetRuntimeContextSource: "active scenario adapter",
        identityPolicy: "正式报告、Published/C008、证据包及其原始业务标识保持不变；当前 v2.1.0 只形成显式运行时投影和新增 Run/Result/Session。",
        mutationPolicy: "历史正式制品与历史 Checkpoint 禁止覆盖；新借款人、新申请或新正式内容必须形成新的 scenarioVersion/scenarioRunId 和报告身份。"
      },
      borrowerProfiles: {
        activeBorrowerId: "BORR-CN-USCC-91440300093677087R",
        selectionPolicy: "每个 scenarioRunId 只绑定一个集团成员借款人；更换借款人必须形成新的数据快照、固定证据包和报告内容版本。",
        profiles: [{
          borrowerId: "BORR-CN-USCC-91440300093677087R",
          legalName: "中国广核电力股份有限公司",
          shortName: "中国广核电力",
          unifiedSocialCreditCode: "91440300093677087R",
          memberId: "MEM-CGN-003816",
          memberStatus: "ACTIVE",
          groupName: "中国广核集团有限公司",
          currency: "CNY",
          financialStatementUnit: "亿元",
          reportDisplayUnit: "万元",
          financialStatementPeriods: [2023, 2024, 2025],
          financialStatementAsOf: "2025-12-31",
          sourceBindingProfileId: "SRC-BINDING-S004-CGN-20260815",
          ontologyInstanceBindingId: "ONTO-BINDING-S004-CGN-20260815"
        }]
      },
      applicationProfiles: {
        activeApplicationId: "APP-S004-20260815-0001",
        applications: [{
          applicationId: "APP-S004-20260815-0001",
          borrowerId: "BORR-CN-USCC-91440300093677087R",
          productType: "一年期流动资金贷款",
          requestedAmount: 100000,
          currency: "CNY",
          amountUnit: "万元",
          termMonths: 12,
          loanType: "流动资金信用贷款",
          guaranteeMode: "CREDIT",
          guaranteeStatus: "NOT_APPLICABLE",
          collateralStatus: "NOT_APPLICABLE",
          purpose: "核电运营相关日常经营周转",
          purposeDetail: "核燃料、备品备件及运维服务采购",
          repaymentMode: "本金到期一次偿还、按季付息",
          repaymentSource: "核电运营收入和经营活动现金流",
          purposeContractAmount: 120000,
          purposeContractCoverageRatio: 1.2,
          supportingMaterialStatus: {
            creditSummary: "REGISTERED_REQUIRES_HUMAN_VERIFICATION",
            internalRating: "REGISTERED_REQUIRES_HUMAN_VERIFICATION",
            internalFacility: "REGISTERED_REQUIRES_HUMAN_VERIFICATION",
            historicalFinancing: "REGISTERED_REQUIRES_HUMAN_VERIFICATION",
            onsiteInvestigation: "REGISTERED_REQUIRES_HUMAN_VERIFICATION"
          },
          internalFacility: {
            approvedAmount: 300000,
            usedAmount: 120000,
            availableAmount: 180000,
            asOf: "2026-08-14"
          },
          applicationDate: "2026-08-15",
          dataAsOf: "2026-08-15",
          reportingYear: 2025
        }]
      },
      sourceSlotDefinitions: [
        {
          slotId: "SRC-SLOT-FINANCIAL-REPORTS",
          name: "正式财务报告",
          required: true,
          scope: "per-borrower",
          sourceClass: "official-public",
          ingestionPolicy: "已有财务报告事实通过数据工程快照和 Published/C008 消费，不重复建立上传型模拟数据。",
          currentBinding: "s004-official-annual-reports"
        },
        {
          slotId: "SRC-SLOT-LOAN-INVESTIGATION-PACK",
          name: "贷款调查补充资料",
          required: true,
          scope: "per-application",
          sourceClass: "synthetic-demo / authorized-external / human-input",
          ingestionPolicy: "仅承接贷款申请、内部授信、征信、历史融资、担保抵质押和现场调查等财务报告未覆盖资料。",
          currentBinding: "s004-synthetic-demo-pack"
        }
      ],
      sourceTemplateDefinitions: [
        {
          templateId: "SRC-TPL-PUBLIC-ANNUAL-REPORT-v1.0",
          name: "集团成员借款人公开年报来源模板",
          sourceSlotId: "SRC-SLOT-FINANCIAL-REPORTS",
          instanceScope: "per-borrower",
          sourceClass: "official-public",
          parameterKeys: ["borrowerId", "borrowerLegalName", "unifiedSocialCreditCode", "reportYears[]", "statementAsOf", "sourceFiles[]"],
          currentInstanceId: "SRC-INSTANCE-S004-CGN-ANNUAL-REPORTS-20260815",
          currentBinding: "s004-official-annual-reports",
          reusePolicy: "新借款人复用来源模板和字段合同，但必须形成新的来源实例、不可变快照和 scenarioRunId；不得复制当前借款人的事实或证据。"
        },
        {
          templateId: "SRC-TPL-PREFLIGHT-EVIDENCE-PACK-v1.0",
          name: "集团成员借款人贷前调查资料包模板",
          sourceSlotId: "SRC-SLOT-LOAN-INVESTIGATION-PACK",
          instanceScope: "per-application",
          sourceClass: "synthetic-demo / authorized-external / human-input",
          parameterKeys: ["borrowerId", "memberId", "applicationId", "asOfDate", "sourceFile"],
          currentInstanceId: "SRC-INSTANCE-S004-CGN-PREFLIGHT-PACK-20260815",
          currentBinding: "s004-synthetic-demo-pack",
          reusePolicy: "新申请复用资料包字段合同和质量门，但必须上传或绑定该申请自己的资料，并形成新的来源实例、快照和 scenarioRunId。"
        }
      ],
      borrowerRunInstantiation: {
        mode: "CLONE_TEMPLATES_TO_NEW_ISOLATED_SCENARIO_RUN",
        entryOwner: "平台公共层场景运行入口",
        m02Role: "数据工程仅提供来源模板选择、参数校验和隔离装配预演；不在当前页面创建正式 C033、Checkpoint 或报告。",
        currentBindingMode: "IMMUTABLE_CURRENT_INSTANCE",
        immutableCurrentKeys: ["borrowerId", "unifiedSocialCreditCode", "memberId", "applicationId", "scenarioRunId"],
        requiredNewKeys: ["borrowerId", "unifiedSocialCreditCode", "memberId", "applicationId", "scenarioRunId", "reportId"],
        isolatedOutputs: ["sourceInstanceId", "sourceSnapshotId", "dataAssetVersion", "Published/C008 binding", "evidencePackId", "contentVersion"],
        historyRule: "新借款人、新申请或新数据时点创建新的隔离轮次；中国广核当前快照、正式运行、数据资产版本、报告和历史证据均不覆盖。"
      },
      ontologyInstanceBindings: {
        bindingId: "ONTO-BINDING-S004-CGN-20260815",
        publishedPointer: "T019-S004-PUBLISHED-002",
        c008BindingId: "C008-S004-AUTHORITATIVE-FACTS-002",
        objectTypeBindings: {
          borrower: "OBJ-GROUP-MEMBER-BORROWER",
          application: "OBJ-LOAN-APPLICATION",
          financialStatementFact: "OBJ-FINANCIAL-STATEMENT-FACT",
          report: "OBJ-PREFLIGHT-REPORT"
        },
        instanceKeys: {
          borrowerId: "BORR-CN-USCC-91440300093677087R",
          applicationId: "APP-S004-20260815-0001",
          reportId: "RPT-S004-20260815-0001"
        },
        reusePolicy: "复用通用对象、关系、Metric、Rule 定义；仅按新借款人和新申请形成独立实例绑定与 C008 权威事实包。"
      },
      reportDefinitionBinding: {
        reportDefinitionId: "RDEF-S004-PREFLIGHT-002",
        reportTemplateId: "RT-S004-PREFLIGHT-002",
        reportAgentId: "AGENT-S004-PREFLIGHT-REPORT-002",
        appliesTo: "集团成员单位贷款申请",
        borrowerIdPath: "borrowerProfiles.activeBorrowerId",
        applicationIdPath: "applicationProfiles.activeApplicationId",
        reusableAcrossBorrowers: true
      },
      reportRunSelection: {
        selectionMode: "BORROWER_AND_APPLICATION",
        currentBorrowerId: "BORR-CN-USCC-91440300093677087R",
        options: [
          {
            borrowerId: "BORR-CN-USCC-91440300093677087R",
            legalName: "中国广核电力股份有限公司",
            applicationId: "APP-S004-20260815-0001",
            productType: "一年期流动资金贷款",
            readiness: "READY",
            readinessLabel: "资料已就绪，可生成"
          },
          {
            borrowerId: "BORR-PENDING-CGN-ENGINEERING",
            legalName: "中广核工程有限公司",
            applicationId: null,
            productType: null,
            readiness: "REQUIRES_DATA_PREPARATION",
            readinessLabel: "待完成数据准备"
          },
          {
            borrowerId: "BORR-PENDING-LINGAO-NUCLEAR",
            legalName: "岭澳核电有限公司",
            applicationId: null,
            productType: null,
            readiness: "REQUIRES_DATA_PREPARATION",
            readinessLabel: "待完成数据准备"
          },
          {
            borrowerId: "__OTHER_GROUP_MEMBER__",
            legalName: "选择其他集团成员单位",
            applicationId: null,
            productType: null,
            readiness: "REQUIRES_DATA_PREPARATION",
            readinessLabel: "选择成员单位后准备数据"
          }
        ],
        readyGate: "借款人、贷款申请、数据快照、Published/C008 与固定证据包均已就绪",
        preparationRoute: "#module/data",
        historyPolicy: "每次生成使用独立场景运行身份，不覆盖既有报告与运行记录。"
      },
      reportNamingPolicy: {
        policyId: "RNP-S004-BORROWER-YEAR-ISSUE-DATE-V1",
        pattern: "{borrowerLegalName}{reportingYear}年度贷款贷前调查报告（出具日期：{issueDateZh}）",
        reportingYearSource: "applicationProfiles.applications[].reportingYear",
        issueDateSource: "publicationManifest.publishedAt",
        borrowerNameSource: "borrowerProfiles.profiles[].legalName",
        currentReportingYear: 2025,
        currentIssueDate: "2026-08-15",
        currentIssueDateZh: "2026年8月15日",
        currentTitle: "中国广核电力股份有限公司2025年度贷款贷前调查报告（出具日期：2026年8月15日）",
        immutablePublicationRule: "历史报告名称和文件不可原地改写；新借款人、新申请或新出具时点形成新的报告身份与内容版本。"
      },
      formalOutputBinding: {
        baseRef: "../s004/artifacts/report/",
        controlledHtml: {
          format: "CONTROLLED_HTML",
          file: "RPT-S004-CGNPC-20260815-v2.0.html",
          viewMode: "new-tab",
          downloadable: true
        },
        sameSourcePdf: {
          format: "SAME_SOURCE_PDF",
          file: "RPT-S004-CGNPC-20260815-v2.0.pdf",
          viewMode: "in-page-rendered-preview",
          downloadable: true,
          preview: {
            mode: "RASTERIZED_IMMUTABLE_PDF_PAGES",
            baseRef: "./artifacts/pdf-preview/",
            fileStem: "RPT-S004-CGNPC-20260815-v2.0-page-",
            pageCount: 11,
            renderDpi: 120,
            authoritative: false,
            sourceRule: "预览页仅由不可变 SAME_SOURCE_PDF 确定性渲染；正式产物仍以原 PDF 文件为准。"
          }
        }
      },
      stableIdentities: {
        financialCompanyId: "FC-DEMO-001",
        borrowerId: "BORR-CN-USCC-91440300093677087R",
        memberId: "MEM-CGN-003816",
        applicationId: "APP-S004-20260815-0001",
        reportId: "RPT-S004-20260815-0001",
        reportNumber: "S004-PLR-2026-0001",
        evidencePackId: "EVID-S004-20260815-0002"
      },
      dataSources: {
        officialPublic: ["财务报告已有财务、经营、股权和公开融资事实"],
        syntheticDemo: ["贷款申请", "内部授信", "征信", "历史融资", "现场调查", "还款计划"],
        rule: "财务报告已有事实不重复设置上传型模拟数据"
      },
      semanticResources: {
        publishedPointer: "T019-S004-PUBLISHED-002",
        c008: "C008-S004-AUTHORITATIVE-FACTS-002",
        metrics: ["申请金额", "期限", "资金用途", "偿债覆盖"],
        rules: ["成员资格校验", "用途与申请一致性", "证据完整性"]
      },
      applicability: {
        M03: "NOT_APPLICABLE",
        M04: "EMPTY_ACTION_REQUEST_QUEUE"
      },
      artifactRefs: {
        sourceSnapshot: "../s004/artifacts/data/source-snapshot-v2.json",
        publishedResources: "../s004/artifacts/ontology/published-resources-v2.json",
        c008Facts: "../s004/artifacts/ontology/c008-authoritative-facts-v2.json",
        quality: "../s004/artifacts/data/data-quality-v2.json",
        c017: "../s004/artifacts/data/c017-confidence-summary-v2.json",
        agentConfig: "../s004/artifacts/agent/report-agent-config-v2.json",
        reportDefinition: "../s004/artifacts/report/report-definition-v2.json",
        evidencePackage: "../s004/artifacts/agent/evidence-package-v2.json",
        draftOutput: "../s004/artifacts/agent/draft-output-v2.json",
        reportData: "../s004/artifacts/report/report-data-v2.json",
        deterministicVerification: "../s004/artifacts/report/deterministic-verification-v2.json",
        humanConfirmation: "../s004/artifacts/report/human-confirmation-v2.json",
        publicationManifest: "../s004/artifacts/report/publication-manifest-v2.json"
      },
      // 正式 HTTP 模式必须完整读取上述全部不可变 JSON 制品并形成 SHA-256
      // 指纹；禁止逐项回退。以下内联包只供显式 inline-demo 整体降级，
      // 不具备正式报告或验收资格，也不改变正式制品或历史 Checkpoint。
      inlineArtifacts: {
        sourceSnapshot: {
          snapshotId: "DS-S004-20260815-V2-001",
          snapshotVersion: "2.0.0",
          sourceNodes: [
            { sourceNodeId: "SRC-CGN-AR-2023", sourceClass: "official-document", name: "中国广核2023年年度报告", periodEnd: "2023-12-31", dataAlreadyInFinancialReport: true, uploadSimulationCreated: false },
            { sourceNodeId: "SRC-CGN-AR-2024", sourceClass: "official-document", name: "中国广核2024年年度报告", periodEnd: "2024-12-31", dataAlreadyInFinancialReport: true, uploadSimulationCreated: false },
            { sourceNodeId: "SRC-CGN-AR-2025", sourceClass: "official-document", name: "中国广核2025年年度报告", periodEnd: "2025-12-31", dataAlreadyInFinancialReport: true, uploadSimulationCreated: false },
            { sourceNodeId: "SIM_BUSINESS_REGISTRY_UPLOAD", sourceClass: "synthetic-demo", name: "工商登记与股东信息演示上传节点", asOfDate: "2025-12-31", dataAlreadyInFinancialReport: false, uploadSimulationCreated: true },
            { sourceNodeId: "SIM_PUBLIC_DISCLOSURE_UPLOAD", sourceClass: "synthetic-demo", name: "公司公告及业绩发布会资料演示上传节点", asOfDate: "2026-08-15", dataAlreadyInFinancialReport: false, uploadSimulationCreated: true },
            { sourceNodeId: "SIM_RATING_REPORT_UPLOAD", sourceClass: "synthetic-demo", name: "外部评级报告演示上传节点", asOfDate: "2026-06-26", dataAlreadyInFinancialReport: false, uploadSimulationCreated: true },
            { sourceNodeId: "SIM_INDUSTRY_POLICY_UPLOAD", sourceClass: "synthetic-demo", name: "核电行业与电力市场政策资料演示上传节点", asOfDate: "2026-08-15", dataAlreadyInFinancialReport: false, uploadSimulationCreated: true },
            { sourceNodeId: "SIM_MEMBER_REGISTRY", sourceClass: "synthetic-demo", name: "集团成员名录模拟节点", asOfDate: "2026-08-15", dataAlreadyInFinancialReport: false, uploadSimulationCreated: true },
            { sourceNodeId: "SIM_LOAN_APPLICATION", sourceClass: "synthetic-demo", name: "贷款申请模拟节点", asOfDate: "2026-08-15", dataAlreadyInFinancialReport: false, uploadSimulationCreated: true },
            { sourceNodeId: "SIM_INTERNAL_CREDIT", sourceClass: "synthetic-demo", name: "内部授信额度模拟节点", asOfDate: "2026-08-14", dataAlreadyInFinancialReport: false, uploadSimulationCreated: true },
            { sourceNodeId: "SIM_LOAN_LEDGER", sourceClass: "synthetic-demo", name: "历史融资及营运资金来源模拟节点", asOfDate: "2026-08-14", dataAlreadyInFinancialReport: false, uploadSimulationCreated: true }
          ]
        },
        quality: { qualityRunId: "DQR-S004-20260815-V2-001", status: "PASS_WITH_DISCLOSURES" },
        c017: { status: "CONDITIONALLY_TRUSTED_FOR_DEMO" },
        publishedResources: {
          resourcePackageId: "ONTO-S004-LOAN-PREFLIGHT-002",
          resourcePackageVersion: "2.0.0",
          lifecycleStatus: "Published",
          publishedPointer: "T019-S004-PUBLISHED-002",
          objects: [
            { objectTypeId: "OBJ-FINANCIAL-COMPANY", name: "财务公司", stableKey: "financialCompanyId" },
            { objectTypeId: "OBJ-GROUP-MEMBER-BORROWER", name: "集团成员借款人", stableKey: "borrowerId", alternateKey: "unifiedSocialCreditCode" },
            { objectTypeId: "OBJ-LOAN-APPLICATION", name: "贷款申请", stableKey: "applicationId" },
            { objectTypeId: "OBJ-FINANCIAL-STATEMENT-FACT", name: "财务报表事实", stableKey: "factId" },
            { objectTypeId: "OBJ-SHAREHOLDING", name: "股权事实", stableKey: "shareholdingFactId" },
            { objectTypeId: "OBJ-OPERATING-FACT", name: "经营事实", stableKey: "operatingFactId" },
            { objectTypeId: "OBJ-CREDIT-FACILITY", name: "内部授信额度", stableKey: "facilityId" },
            { objectTypeId: "OBJ-PREFLIGHT-REPORT", name: "贷前调查报告", stableKey: "reportId" }
          ],
          relations: [
            { relationTypeId: "REL-MEMBER-OF-GROUP", name: "借款人属于集团", from: "OBJ-GROUP-MEMBER-BORROWER", to: "OBJ-FINANCIAL-COMPANY" },
            { relationTypeId: "REL-SUBMITS-APPLICATION", name: "借款人提交贷款申请", from: "OBJ-GROUP-MEMBER-BORROWER", to: "OBJ-LOAN-APPLICATION" },
            { relationTypeId: "REL-STATEMENT-DESCRIBES-BORROWER", name: "财务事实描述借款人", from: "OBJ-FINANCIAL-STATEMENT-FACT", to: "OBJ-GROUP-MEMBER-BORROWER" },
            { relationTypeId: "REL-SHAREHOLDER-HOLDS-BORROWER", name: "股东持有借款人股份", from: "OBJ-SHAREHOLDING", to: "OBJ-GROUP-MEMBER-BORROWER" },
            { relationTypeId: "REL-REPORT-EVALUATES-APPLICATION", name: "报告调查贷款申请", from: "OBJ-PREFLIGHT-REPORT", to: "OBJ-LOAN-APPLICATION" }
          ],
          metrics: ["资产负债率", "流动比率", "EBIT/利息", "主营业务利润率", "总资产报酬率", "净资产收益率", "存货周转率", "应收账款周转率", "总资产周转率", "流动资产周转率", "总资产增长率", "净资产增长率", "净利润增长率", "销售增长率", "营运资金周转次数", "营运资金量", "新增流动资金贷款额度"].map((name, index) => ({ metricId: `MET-S004-INLINE-${String(index + 1).padStart(2, "0")}`, name })),
          rules: ["集团成员资格校验", "人民币一年期流动资金信用贷款范围校验", "申请金额不超过资金需求测算额度", "申请金额不超过可用授信额度", "权威示例章节与字段完整性校验", "正式事实可追溯至Published本体和C008", "授信综合判断必须来自人工确认", "风险可控判断必须来自人工确认", "正式构建禁止直读工作簿或来源节点"].map((name, index) => ({ ruleId: `RULE-S004-INLINE-${String(index + 1).padStart(2, "0")}`, name, effect: "DETERMINISTIC_GATE" }))
        },
        c008Facts: {
          bundleId: "C008-S004-AUTHORITATIVE-FACTS-002",
          bundleVersion: "2.0.0",
          identity: { applicationId: "APP-S004-20260815-0001", reportId: "RPT-S004-20260815-0001", reportNumber: "S004-PLR-2026-0001" },
          facts: { formalBusinessSubject: { name: "财务公司", displayName: "集团财务公司（演示）" }, memberStatus: { value: "ACTIVE" } }
        },
        agentConfig: {
          agentDefinitionId: "AGENT-S004-PREFLIGHT-REPORT-002",
          agentReleaseVersion: "2.0.0",
          owner: "M05",
          toolWhitelist: ["READ_FIXED_EVIDENCE_PACKAGE", "WRITE_STRUCTURED_DRAFT"],
          generationPolicy: { maySelectLatestData: false, mayReadWorkbook: false, mayReadSourceNodes: false, mayReadAnnualReportsDirectly: false, mayRecalculateFormalMetrics: false, mayGenerateCreditDecision: false, mayGenerateRiskControllability: false, mayPublishReport: false, mayCreateActionRequest: false, mayCreateTodo: false }
        },
        evidencePackage: { evidencePackageId: "EVID-S004-20260815-0002", evidencePackageVersion: "2.0.0", consumer: "AGENT-S004-PREFLIGHT-REPORT-002" },
        draftOutput: { status: "STRUCTURED_DRAFT_COMPLETED", agentRunId: "ARUN-S004-20260815-0002" },
        reportDefinition: {
          reportDefinitionId: "RDEF-S004-PREFLIGHT-002",
          status: "Published",
          formalBusinessSubject: "财务公司",
          sections: ["贷前调查报告", "第一部分 借款人评价（工商信息）", "第二部分 借款人经营情况", "第三部分 借款人财务情况", "第四部分 借款风险分析", "第五部分 授信结论", "数据来源"].map((title, order) => ({ title, order }))
        },
        reportData: { reportNumber: "S004-PLR-2026-0001", contentVersion: "2.0.0", publicationStatus: "PUBLISHED", evidencePackageId: "EVID-S004-20260815-0002" }
      },
      agentBoundary: {
        allowed: ["读取固定证据包", "读取报告定义", "生成结构化草稿", "解释已发布报告"],
        denied: ["直接读取工作簿", "选择最新数据", "重算正式指标", "发布报告", "修改本体", "提交 Action Request", "创建待办"]
      }
    },
    baselineModuleSources,
    moduleSources,
    initialFramePositions: {
      data: `${moduleSources.M02}#/resources`,
      ontology: `${moduleSources.M01}#published`,
      query: `${moduleSources.M03}#/ask`,
      decision: `${moduleSources.M04}#workbench`,
      agent: `${moduleSources.M05}#/agents`,
      report: `${moduleSources.M06}#/reports?tab=products`
    },
    moduleMeta: {
      M01: { description: "直接复用 v1.0.3 本体画布、工作台、Published 生命周期与校验入口。", color: "violet" },
      M02: { description: "直接复用 v1.0.3 数据资源、管道、快照、质量和资产发布入口。", color: "blue" },
      M03: { description: "直接复用 v1.0.3 完整问数页面；当前 S004 场景状态为 NOT_APPLICABLE。", color: "cyan" },
      M04: { description: "直接复用 v1.0.3 决策中心；当前 S004 无 Action Request，队列为空。", color: "orange" },
      M05: { description: "直接复用 v1.0.3 Agent 目录、配置、运行、证据和伴读入口。", color: "teal" },
      M06: { description: "直接复用 v1.0.3 报告定义、证据、核验、复核、发布和伴读入口。", color: "green" }
    },
    workflow: [
      { id: "configure", moduleId: "M02", title: "确认场景配置", action: "查看场景配置", summary: "锁定财务公司、集团成员借款人、贷款申请、数据时点、币种和单位。", initialStatus: "complete" },
      { id: "registerSources", moduleId: "M02", title: "登记权威来源", action: "查看来源登记", summary: "财务报告已有事实复用 official-public；仅缺口资料使用 synthetic-demo。", initialStatus: "complete", prerequisite: "configure" },
      { id: "qualityGate", moduleId: "M02", title: "通过数据质量门", action: "查看质量结果", summary: "核验主体、申请、期间、截至时间、币种、单位、缺失、冲突和过期状态。", initialStatus: "complete", prerequisite: "registerSources" },
      { id: "publishAsset", moduleId: "M02", title: "发布调查数据资产", action: "查看数据资产", summary: "形成带来源标签、质量摘要和稳定键的数据资产版本。", initialStatus: "complete", prerequisite: "qualityGate" },
      { id: "mapOntology", moduleId: "M01", title: "完成语义映射", action: "进入本体工作台", summary: "绑定借款人、贷款申请、财务报表、股权、融资、征信和调查资料。", initialStatus: "complete", prerequisite: "publishAsset" },
      { id: "publishSemantics", moduleId: "M01", title: "切换 Published 语义", action: "查看 Published", summary: "Published 对象、关系、Metric、Rule 与 C008 权威消费指针已配置。", initialStatus: "complete", prerequisite: "mapOntology" },
      { id: "queryBoundary", moduleId: "M03", title: "确认问数不适用", action: "进入完整问数页面", summary: "边界确认完成：S004 问数状态为 NOT_APPLICABLE，Run/Result 均为 0；完整问数页面和内部路由原生保留。", initialStatus: "complete", prerequisite: "publishSemantics" },
      { id: "decisionBoundary", moduleId: "M04", title: "确认决策链条件门", action: "进入完整决策中心", summary: "边界确认完成：S004 无标准 Action Request，队列为空；完整决策中心原生保留。", initialStatus: "complete", prerequisite: "queryBoundary" },
      { id: "freezeEvidence", moduleId: "M06", title: "冻结报告证据包", action: "查看证据包", summary: "按申请、借款人、数据时点和 Published 版本固定报告可消费事实。", initialStatus: "complete", prerequisite: "decisionBoundary" },
      { id: "generateDraft", moduleId: "M05", title: "生成结构化草稿", action: "查看 Agent 运行", summary: "报告 Agent 只基于固定证据包组织贷前调查报告草稿。", initialStatus: "complete", prerequisite: "freezeEvidence" },
      { id: "bindAnchors", moduleId: "M06", title: "绑定事实和稳定锚点", action: "查看事实绑定", summary: "章节、内容项、事实、语义资源、证据和核验要求绑定稳定锚点。", initialStatus: "complete", prerequisite: "generateDraft" },
      { id: "verifyFacts", moduleId: "M06", title: "完成确定性核验", action: "查看核验结果", summary: "核验稳定身份、数据口径、事实引用、证据定位和同源发布条件。", initialStatus: "complete", prerequisite: "bindAnchors" },
      { id: "humanReview", moduleId: "M06", title: "人工复核调查意见", action: "查看人工复核", summary: "调查意见、授信结论和高风险判断均保留人工确认标签。", initialStatus: "complete", prerequisite: "verifyFacts" },
      { id: "publishReport", moduleId: "M06", title: "发布 HTML/PDF", action: "查看正式报告", summary: "HTML/PDF 共享报告编号、内容版本、证据链和稳定锚点。", initialStatus: "complete", prerequisite: "humanReview" },
      { id: "companionRun", moduleId: "M05", title: "报告伴读", action: "进入伴读入口", summary: "伴读仅解释已发布报告和固定证据，不重新计算正式指标。", initialStatus: "complete", prerequisite: "publishReport" }
    ],
    entities: [{
      id: "BORR-CN-USCC-91440300093677087R",
      name: "中国广核电力股份有限公司",
      balance: "申请 10 亿元",
      cost: "利率待人工确认",
      loans: "1 笔贷前调查申请",
      rule: "贷前调查",
      ruleMetricLabel: "申请金额",
      ruleMetricValue: "10 亿元",
      owner: "财务公司调查岗",
      banks: ["财务公司"]
    }],
    groupMetrics: [
      { label: "申请金额", value: "10", unit: "亿元" },
      { label: "期限", value: "1", unit: "年" },
      { label: "数据来源", value: "2", unit: "类" },
      { label: "人工结论", value: "1", unit: "项" }
    ],
    combinations: [],
    report: {
      id: "RPT-S004-20260815-0001",
      version: "内容版本 2.0.0",
      evidence: "EVID-S004-20260815-0002",
      borrowerId: "BORR-CN-USCC-91440300093677087R",
      borrowerName: "中国广核电力股份有限公司",
      applicationId: "APP-S004-20260815-0001",
      reportingYear: 2025,
      issueDate: "2026-08-15",
      title: "中国广核电力股份有限公司2025年度贷款贷前调查报告（出具日期：2026年8月15日）",
      namingPolicyId: "RNP-S004-BORROWER-YEAR-ISSUE-DATE-V1",
      formats: ["HTML", "PDF"],
      outputs: {
        html: "../s004/artifacts/report/RPT-S004-CGNPC-20260815-v2.0.html",
        pdf: "../s004/artifacts/report/RPT-S004-CGNPC-20260815-v2.0.pdf"
      },
      sections: [
        "第一部分 借款人评价",
        "第二部分 借款人经营情况",
        "第三部分 借款人财务情况",
        "第四部分 借款风险分析",
        "第五部分 授信结论（人工确认）",
        "第六部分 数据来源"
      ]
    }
  };

  const adapter = ADAPTER.createAdapter(config);
  ADAPTER.install(adapter);
  window.OFW_S004_RUNTIME_CONFIG = Object.freeze({
    ...config,
    foundationBaselineVersion: adapter.config.foundationBaselineVersion,
    scenarioRunId: adapter.context().scenarioRunId
  });
})();

(function installS004RuntimeRelay() {
  "use strict";
  if (window.__OFW_S004_RUNTIME_RELAY__) return;
  const allowedKinds = new Set(["C022", "M05_RUNTIME_STATE", "M06_RUNTIME_STATE"]);
  const records = new Map();
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const normalizeContext = (value = {}) => {
    const source = value.scenarioContext || value.context || value;
    return {
      scenarioId: source.scenarioId || null,
      scenarioVersion: source.scenarioVersion || null,
      scenarioRunId: source.scenarioRunId || null,
      formedAt: source.formedAt || source.contextFormedAt || source.scenarioFormedAt || null,
      status: source.status || source.contextStatus || source.scenarioStatus || null
    };
  };
  const currentContext = () => normalizeContext(window.OFW_ACTIVE_SCENARIO_ADAPTER?.context?.() || {});
  const contextReady = (value) => ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"].every((field) => value?.[field]);
  const sameContext = (left, right) => ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"]
    .every((field) => String(left?.[field] || "") === String(right?.[field] || ""));
  const recordKey = (kind, value) => `${kind}:${value.scenarioId}:${value.scenarioVersion}:${value.scenarioRunId}`;
  const publish = ({ kind, context, payload } = {}) => {
    const supplied = normalizeContext(context || payload || {});
    const current = currentContext();
    if (!allowedKinds.has(kind) || !contextReady(supplied) || !contextReady(current) || !sameContext(supplied, current) || payload == null) return false;
    records.set(recordKey(kind, supplied), { kind, context: clone(supplied), payload: clone(payload) });
    if (window.document?.documentElement?.dataset) {
      window.document.documentElement.dataset.ofwS004RuntimeRelay = `${kind}:published`;
    }
    return true;
  };
  const read = ({ kind, context } = {}) => {
    const supplied = normalizeContext(context || {});
    const current = currentContext();
    if (!allowedKinds.has(kind) || !contextReady(supplied) || !contextReady(current) || !sameContext(supplied, current)) return null;
    const record = records.get(recordKey(kind, supplied));
    return record && sameContext(record.context, supplied) ? clone(record.payload) : null;
  };
  const clear = () => records.clear();
  window.addEventListener?.("ofw:scenario-registry:S004:reset", clear);
  window.OFW_S004_RUNTIME_RELAY = Object.freeze({ publish, read, clear, allowedKinds: Object.freeze([...allowedKinds]) });
  window.__OFW_S004_RUNTIME_RELAY__ = true;
})();

(function installS004NavigationBridge() {
  "use strict";
  if (window.__OFW_S004_NAVIGATION_BRIDGE__ || typeof window.addEventListener !== "function") return;
  const allowedRoutes = new Set(["#module/data", "#module/agent", "#module/report"]);
  const allowedModuleFragments = Object.freeze({
    "#module/data": new Set(["#/resources"]),
    "#module/report": new Set(["#/reports/generate", "#/reports/view"])
  });
  let pendingModuleNavigation = null;

  function currentContextMatches(message) {
    const context = window.OFW_ACTIVE_SCENARIO_ADAPTER?.context?.();
    return context?.scenarioId === "S004"
      && message.scenarioId === context.scenarioId
      && message.scenarioVersion === context.scenarioVersion
      && message.scenarioRunId === context.scenarioRunId;
  }

  function deliverPendingModuleNavigation() {
    const pending = pendingModuleNavigation;
    if (!pending || window.location.hash !== pending.route) return false;
    const frame = document.getElementById?.("module-frame");
    if (!frame?.contentWindow) return false;
    let moduleId = null;
    let frameSource = null;
    try {
      frameSource = new URL(frame.getAttribute?.("src") || frame.src || "", window.location.href);
      moduleId = frameSource.searchParams.get("moduleId");
    } catch (_) {
      return false;
    }
    if ((pending.route === "#module/data" && moduleId !== "M02")
      || (pending.route === "#module/report" && moduleId !== "M06")
      || (pending.route === "#module/agent" && moduleId !== "M05")) return false;
    try {
      // The shared shell replaces the iframe when switching modules. During
      // that short window its src already identifies M06/M05, while the live
      // contentWindow is still about:blank. Writing location.hash there
      // cancels the pending loader navigation and strands the iframe at
      // about:blank#/reports/generate. Bind the requested fragment to the
      // declared loader URL first; once the real same-origin document exists,
      // use the native hash router without reloading the module.
      let liveHref = "";
      try { liveHref = String(frame.contentWindow.location?.href || ""); } catch (_) { liveHref = ""; }
      if (!liveHref || liveHref.startsWith("about:blank")) {
        if (frameSource.hash !== pending.moduleFragment) {
          frameSource.hash = pending.moduleFragment;
          const nextSource = frameSource.href;
          if (typeof frame.setAttribute === "function") frame.setAttribute("src", nextSource);
          else frame.src = nextSource;
        }
        document.documentElement.dataset.ofwS004NavigationBridgeState = "fragment-bound-before-module-ready";
        return false;
      }
      frame.contentWindow.location.hash = pending.moduleFragment;
      document.documentElement.dataset.ofwS004NavigationBridgeFragment = pending.moduleFragment;
      document.documentElement.dataset.ofwS004NavigationBridgeState = "delivered-to-ready-module";
      return true;
    } catch (_) {
      return false;
    }
  }

  function schedulePendingModuleNavigation() {
    const scheduled = pendingModuleNavigation;
    [0, 80, 240, 700, 1600].forEach((delay) => window.setTimeout?.(deliverPendingModuleNavigation, delay));
    window.setTimeout?.(() => {
      if (pendingModuleNavigation === scheduled) pendingModuleNavigation = null;
    }, 2200);
  }

  function hookModuleFrame() {
    const frame = document.getElementById?.("module-frame");
    if (!frame || frame.dataset?.ofwS004NavigationBridgeHook === "true") return;
    if (frame.dataset) frame.dataset.ofwS004NavigationBridgeHook = "true";
    frame.addEventListener?.("load", schedulePendingModuleNavigation);
  }

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    const message = event.data || {};
    if (message.type !== "OFW_S004_NAVIGATE" || !allowedRoutes.has(message.route)) return;
    if (!currentContextMatches(message)) return;
    const fragment = String(message.moduleFragment || "");
    const allowedFragments = allowedModuleFragments[message.route];
    pendingModuleNavigation = allowedFragments?.has(fragment)
      ? { route: message.route, moduleFragment: fragment }
      : null;
    window.location.hash = message.route;
    document.documentElement.dataset.ofwS004NavigationBridge = message.route;
    hookModuleFrame();
    schedulePendingModuleNavigation();
  });
  if (window.MutationObserver && document.documentElement) {
    const observer = new window.MutationObserver(() => {
      hookModuleFrame();
      deliverPendingModuleNavigation();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
  window.__OFW_S004_NAVIGATION_BRIDGE__ = true;
})();
