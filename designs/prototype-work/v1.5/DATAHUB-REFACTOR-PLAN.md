# DataHub 底座重构落地方案

日期：2026-09-26 初稿；2026-09-27 修订；2026-09-28 结合专项审查及 20 项语义清单修订；2026-09-29 修正 Draft 计数、负责人基数并注明架构决策来源。
交付性质：实施方案，尚未部署验证新系统。本次只修订本文；不修改运行代码、业务数据、v1.4、冻结版本，不提交、不推送、不切换分支。

本方案依据用户提供的《修订清单》、仓库 `outputs/v1.5-verification/DATAHUB-PLAN-REVIEW-2026-09-28.md`、20 项语义修正清单及 2026-09-29 的两项复核意见修订，逐项处置见文末。既有业务数据身份和规则口径保留，本轮仅修正 Draft 统计口径、负责人关系表述并补记已有架构决策来源。

## 1. 推荐定案与首期边界

**DataHub OSS + Cube Core + 一个 Python/FastAPI 业务服务 + PostgreSQL**。保留 DataHub 的导航、搜索、资产目录、Schema、术语、指标目录、血缘和主要前端；围绕已发布场景 **S001 集团融资成本与债务结构优化** 增加语义配置、问数、事项三个扩展区。下文“S001 融资样例”为该场景的简称。

演示闭环：**查看本体定义 → 查询余额加权平均融资成本 → 查看规则与银行/借据证据 → 发起融资优化建议 → 人工确认 → 创建并办理内部待办 → 登记凭证，区分实际效果是否得到验证。**

| 组件 | 明确承担的责任 |
|---|---|
| DataHub | 产品入口、元数据目录、发现与治理；保存业务语义的目录投影和稳定引用 |
| 业务服务 `semantic` | 完整语义合同的唯一编辑 API、校验、导出、发布与回退；草稿和发布产物保存到业务 PG |
| Cube Core | 执行发布合同生成的指标和维度查询；一个实例在首期只服务一个激活版本 |
| 业务服务 `query/rules` | 受约束的自然语言计划、只读执行、规则判断和证据保存 |
| 业务服务 `actions/workbench` | `actions` 接收/检查请求并执行创建待办；`workbench` 是唯一事项工作台，承接人工确认、办理与效果记录 |
| 业务 PostgreSQL | 融资事实、语义草稿/发布、查询证据、请求、待办和审计；与 DataHub 内部存储隔离 |

首期要交付在**既有演示工作簿**上真实运行的软件：数据库实际计算，业务记录持久化，任务 ID 和回执可核验。已有脱敏/演示处理的来源见 §4.2，不把本轮导入说成新做了脱敏。真实副作用限定为创建内部融资优化待办；不发送银行消息、不执行融资交易、不因任务完成改写融资成本。银行询价可以是待办内容，首期不另建第二个询价系统或行动类型。

实施原则：先锁定数据和语义、再接问数与行动；只有三个扩展区；一个服务进程；一个事项身份；一个可编辑语义来源；一个指标执行器。后端逻辑边界不要求拆微服务、恢复旧模块或移植旧页面协议。

## 2. 开源项目取舍

| 项目 | 采用方式 | 首期不引入 |
|---|---|---|
| DataHub OSS | 实际主应用；沿用主要前端与目录能力 | 不把每笔借据变成 DataHub Dataset，不承诺原生业务问数或行动执行 |
| Cube Core | 实际部署；维度、指标、关联、受控 REST 查询 | 不另建同名指标引擎，不上预聚合集群和商业聊天能力 |
| OpenMetadata | 借鉴概念关系、属性、概念到物理资产的映射 | 不部署第二个目录，不双向同步两套治理平台 |
| Wren AI | 借鉴语义描述、澄清、查询解释和评测 | 不部署旧聊天平台，不同时维护 Wren MDL 与 Cube 两套指标真值 |
| Lightdash | 借鉴指标解释、筛选、结果下钻和已验证答案 | 不新增 BI 门户、仪表盘编辑器或复制 EE AI 代码 |

先选 Cube，是因为当前业务重在固定指标口径、筛选、组合和可解释行动。LLM 只产生受限 QueryPlan，复杂计算由确定性引擎完成。未来若开放式 SQL 探索成为主需求，再验证当前维护中的 Wren Core/SDK，作为替代路线评估，不在首期叠加。

## 3. 候选版本、源码核实与运行验证

- DataHub 候选基线为 `v1.7.0.1`；前轮审查记录截至 2026-09-28 为最新 release，不将该记录视为持续更新结论。阶段 0 复核后锁定 Git commit、镜像 digest、Compose 和 SDK 版本，不自动跟随 `master`。[S1]
- 候选版本源码核实到 `semanticModel`、`metric` 的实体注册及相应 React 页面；配置为 `metricsEnabled: ${METRICS_ENABLED:false}`，默认关闭。本项目尚未运行验证，阶段 0 显式开启、复核后锁定可用能力。它们是定义目录，不是执行引擎。若指标页面不稳定，以术语目录承载兼容投影，业务 ID 与执行合同不变。[S2][S11]
- GlossaryTerm 承载 ObjectType/LinkType/Rule/ActionType 的目录身份。Structured Properties 仅保存短字段，例如 `resource_id`、`release_id`、`definition_hash`、状态和编辑链接。完整合同统一放业务 PG，不依赖字符串长度，也不把嵌套 JSON 当作 DataHub 原生类型。[S3]
- **Custom aspect 是可选增强，不是阶段 0b 或首期发布门槛。** 若以后引入，也只增加目录投影/渲染能力；完整执行合同的编辑权威仍在业务服务，避免因扩展成功或失败而切换权威来源。[S4]
- DataHub Actions Framework 面向元数据事件；Ask DataHub 和部分本体关系查询属于 Cloud 范围。首期业务问数和行动不依赖这些能力。目录权限不会自动授权业务数据库行。[S5][S13]
- Cube 候选基线为 `v1.7.45`，已核对该 tag 的 REST 和 memory 配置源码；前轮审查记录 2026-09-28 的最新 tag 为 `v1.7.46`。不为追最新版无条件升级；阶段 0 检查修复说明、镜像可用性并运行验证，复核后锁定版本。两个版本都尚未在本项目实测，源码中存在配置不代表该组合已运行通过。[S14]
- Cube `/meta` 用于校验模型/成员，`/load` 执行结构化查询，`/sql` 解释生成的 SQL。**公开 `/meta` 不提供本项目定义的 schema SHA-256 回执**；部署哈希校验由自建部署器完成，详见 §6.3。同实例不并行服务两套同名指标的 active release。[S17]
- 当前 WrenAI 将 Engine 并入 `core/`；旧聊天产品在 `legacy/v1` / `v1-final`，上游声明不再提供功能/安全维护。使用当前 OSS SDK 与采用旧 Docker 产品是不同选择。[S6]

许可：DataHub、OpenMetadata 开源核心为 Apache-2.0；Cube 后端 Apache-2.0、客户端 MIT；Lightdash 核心 MIT，EE AI 后端另受 Source Available License 约束。Wren 在 [S6] 固定提交的根 LICENSE 中明确 `core/**`、`sdk/**`、`skills/**`、`examples/**` 为 Apache-2.0，`docs/**` 为 CC BY 4.0；实际 core 子目录 LICENSE 也为 Apache-2.0，发布包与总览冲突时以包清单为准。[S19] 只审核实际引入的路径、镜像和传递依赖，不以根目录许可替代所有组件许可，也不因仅参考产品体验引入整套许可扫描平台；完整依赖许可仍需阶段 0 核实。

安全补丁：相关上游安全修复发布后进入评估队列，建议两个工作日内完成适用性判断；按严重程度安排 backport 或整版升级。固定版本不等于拒绝修复。阶段 5 在临时分支重放一次上游补丁并运行 smoke，不自动改动本工作区分支。

## 4. 数据、身份与旧项目迁移

### 4.1 不可变源头、范围和身份

只使用冻结的 `designs/prototype-releases/v1.1.0/data-engineering-prototype-review/review-v3/source-snapshots/融资一览表_一期演示数据.xlsx` 作为受控导入源；它是**不可变源头与对账基准**，不是运行查询的第二读取源。另两份副本不参与输入选择。后续在独立项目内按 manifest 提供该 artifact，运行不依赖 `/Users/...` 路径或旧静态页面。

| 校验项 | 基线 |
|---|---|
| 文件 SHA-256 | `83232e2dda913e63d2faa1e45aab824270f4ab5bcb96849a44ab8a03f93db12d` |
| 文件与明细 | 807,264 bytes；融资明细 35 列、5,218 行 |
| 参考对象 | 574 个融资主体、24 个机构、24 个负责人 |
| 历史本体 | `ONT-GROUP-FINANCING-OPTIMIZATION`，V1 `semantic-MSVJM48O-VJC6` |
| 历史资产 | `FIN-ASSET-20251231-v02`，快照 `T002-FINANCE-WORKBOOK-83232E2DDA91` |
| 历史 V2 | `semantic-MTUWMQFP-C5JF`，`basedOnVersionId=semantic-MSVJM48O-VJC6`；绑定 `V14-ENTERPRISE-VIEW-666586EEFA71`，整体 `asOf=2026-08-15`；不替换本方案 V1 融资快照 |
| 历史演示截至日 | `authoritative-facts.js` 明确记录 2025-12-31；作为迁移 manifest 的有来源基线，不是从上传时间猜测 |

新导入必须核验源指纹、历史截止时间证据和数据关系，写新的导入/接收回执；缺证据或发现日期矛盾时阻断对应消费，不静默更改时间或删除不符合日期的借据。历史草案中的“无 Published/截至时间待确认”不是后续冻结实现的当前状态证明；冻结 Published 记录同样不代表新系统已经部署通过。新运行验收与原业务版本身份分开。

具体迁移证据：冻结 S001 包的 T008 确认记录为 `confirmedAt=2026-08-16 08:23:12`、`confirmedBy=数据工程账号`，依据为“S001 一期业务数据工作簿及用户确认”，绑定选定快照与 2025-12-31。V1 发布时间为 `2026-08-16 08:28:31`，发布记录 `record-MSVJM48S-TP2Z`。manifest 必须引用这些确认记录，不能声称截至日来自工作簿原字段，也不能用 2026-08-14 设计稿的“0 Published”否定后续发布。

SHA 登记在 `business-finance-source.json`、`authoritative-facts.js` 等业务来源中，不在只收录 v1.5 文件的 `outputs/v1.5-verification/source-fingerprints.json` 中。导入不修改这份历史指纹文件。

| 来源主体 ID | v1.5 企业别名 ID | 原三家投影借据数 | 原主规则 |
|---|---|---:|---|
| UNIT-553 | ENT-020 | 75 | R01 |
| UNIT-465 | ENT-007 | 176 | R02 |
| UNIT-561 | ENT-017 | 50 | R03 |

保存显式 `identity_alias` 映射工件：来源命名空间、来源 ID、目标命名空间、目标 ID、依据与校验时间；来源键与目标键在该映射范围各自唯一。融资查询主键保留 UNIT，ENT 只作已有别名。银行归因 golden 值仍锚定 UNIT-553，不能按名称重新造身份或把其余主体合并到三家。

`business-finance-source.json` 的 records 只有 301 条，summary 描述全量 5,218 条；它只能用作投影对账。`V14-ENTERPRISE-VIEW-666586EEFA71` 是跨域投影，金融成员与整体截至时间不同；`DATA-V14-20251231-DEMO-1` / `ONT-ENTERPRISE-FINANCE-RISK-1.4` 属地图合成模型。上述资源及虚构 24 个月历史均不替代原 S001 全量事实。

### 4.2 既有演示处理与导入质量

本地总控 D005 记录名称脱敏和金额演示处理；阶段 2 设计明确脱敏值已固化、不得再次随机化；源提取实现使用“演示单位”“演示机构”和演示负责人。审查 A4 所称“574 个真实主体名和真实金额”缺少依据，本方案不采纳该断言，也不虚构已取得外部公开授权。

首期延续已有本地演示用途，manifest 记录 `classification=EXISTING_FINANCING_DEMO_SNAPSHOT` 及上述来源依据。导入检查展示字段、日志和发往模型的数据是否仍在演示范围，不重新随机化名称/金额。模型只接收所需语义、代号和受限结果，不把整份工作簿送入上下文。以后若接入新原始数据或扩大公开范围，再确定新的处理要求；必要脱敏发生在 staging→curated，保留 raw 原 SHA、转换版本和新 curated 指纹，不覆盖既有资产或冒充同一业务版本。

`raw → staging → curated` 是同一导入脚本和 PG schema 的三个逻辑层，不增加 ETL 平台。raw 保留受控 artifact；staging 保存源行号、原值与解析错误；curated 保存类型化数据及外键。相同源 SHA、转换版本、映射版本的重复导入必须幂等；转换改变生成新派生指纹。原币、人民币元、百分数值的利率单位明确，金额用精确十进制；空值保持 unknown，不解释为信用融资、固定利率或零。

查询失败范围按依赖决定：缺负责人不阻断已就绪金额查询，但阻断行动；缺机构不妨碍总额计算时可以返回总额并说明无法银行归因；指标必需金额/利率缺失或 Join 放大则阻断对应指标。导入验收覆盖全量/三家行数、金额、身份唯一性、关系端点、源行追溯、各字段缺失分布和日期一致性。

### 4.3 合同迁移与编号消歧

保留业务含义，**不把旧六模块平台及所有 T/C 编号重新建设成首期服务**。新系统用一个运行上下文封装必要证据，旧合同用显式映射接入：

| 台账合同/资源 | 新系统落点 |
|---|---|
| T007 数据资产版本、T008 数据截至时间 | manifest 的 data_version、as_of 及其来源 |
| C003 数据资产版本及精确交付/接收回执 | import_receipt，含导入验证结果、源 SHA、接受/拒绝原因 |
| T019 权威语义/数据组合 | 锁定的 release_id + data_version + definition_hash |
| C017 数据可信度与可复现摘要 | quality_snapshot 与引用的检查结果 |
| C011 Action Request | action_request |
| C012 提醒/人工确认 | 同一事项中的待确认投影与人工决定事件 |
| C033 场景运行上下文 | scenario_id / scenario_version / scenario_run_id |

旧原型 `REFACTOR-REVIEW.md`、`DECISION-CENTER-GUIDE.md` 中的 C017 指审批依据/质量检查，与台账 C017 同号不同义。迁移记录使用带命名空间的 `legacy.prototype.C017` 与 `ledger.C017`，不能仅按编号自动关联。C003 是交付回执，T007/T008 不是回执合同。问数、提交请求、人工确认在各自入口重新检查同一 release、快照、质量和请求状态；复用证据不等于从浏览器接收“通过”标记。

旧浏览器业务状态、iframe、跨页面广播、主题补丁不迁移为运行依赖。保留来源、稳定 ID、口径、规则、ActionType、纯计算测试和失败案例。地图、大屏、模型工作台、预测、Agent 市场、完整报告中心、通用 DAG/流程设计器退出首期。

## 5. 本体包含行动的设计

### 5.1 定义与目录映射

完整业务合同只有一个编辑来源：业务 PG 的 `semantic_definition`，由 `semantic` API 管理修订。DataHub 实体详情中的扩展表单提交给该 API；DataHub 保存短引用和目录描述。初次导入可由历史定义生成草稿，校验后发布。Git 导出是受版本控制的恢复产物，不是第二套在线编辑库；手工改导出文件必须通过校验导入成为新草稿。

**受限执行合同**是业务服务可校验、可编译为 Cube 模型及运行白名单的结构化定义，不是自然语言说明或任意 SQL。最小字段为 `resource_id/kind/revision`、计算种类、输入字段 ID 及类型/单位、分子/分母或聚合输入、允许维度/过滤及取值类型、连接引用与基数/空值策略；不适用的分子分母显式为空。Rule 另含依赖指标与条件，ActionType 另含目标、`ruleIds`、输入 schema 和前置/人工确认/执行合同。

按本方案既定架构，完整合同仍存 PG 草稿与冻结 `semantic_release`；DataHub Structured Properties 优先保存短引用和分类标记。投影字段超出候选版本限制时缩为引用，custom aspect 仍只是可选投影增强，不能转为完整合同的另一存储权威。该权威来源调整相对初稿属于实质架构变更，依据是此前用户提供的《修订清单》A1 修改要求；20 项语义清单阶段保留这一已落实方案，并非由其中第 6 项推导出本次变更。具体来源见 §15 的 2026-09-29 记录。DataHub 仍是主应用与元数据治理底座，“目录投影”限定于本项目自定义的可执行业务语义合同，不代表其全部原生元数据均降为投影。

GlossaryTerm 分类采用受发布器管理的结构化属性 `resource_kind`，允许值固定为 ObjectType、LinkType、Rule、ActionType；原生 Metric 不可用而降级为术语时使用 Metric。发布器从 PG 的 `kind` 筛选权威依赖集合，目录投影按 `resource_kind + release_id` 筛选并核对；禁止根据显示名称猜种类。属性写入/过滤能力在阶段 0 复核，不依赖新增自定义实体。

| 语义资源 | 完整执行合同 | DataHub 目录投影 |
|---|---|---|
| ObjectType | 稳定 ID、实例主键、字段来源、允许属性 | GlossaryTerm + 关联 Dataset/SchemaField |
| Property | 类型、单位、空值和源字段映射 | SchemaField、术语和简短属性 |
| LinkType | 两端类型、方向、基数、连接键、缺失策略 | GlossaryTerm 目录说明与合同引用；不是任意业务 Join 引擎 |
| Metric | 聚合类型、字段引用、分子分母、允许范围/维度 | 优先原生 Metric + SemanticModel；表达式为生成的展示投影 |
| Rule | 指标依赖、条件、参数、命中分支和解释 | Rule 分类术语、依赖链接、hash 和编辑入口 |
| ActionType | 目标、输入 schema、前置、确认、效果、执行器、幂等、失败策略 | ActionType 分类术语、对象/规则引用、hash 和编辑入口 |

语义一等元素不要求新增 DataHub entity：ActionType 有自己的稳定 ID、版本、约束、依赖和执行记录。DataHub 搜索目录定义；574 个主体和 5,218 笔借据由业务数据库/API 查询。元数据血缘与业务对象关系分别表达，不把一笔借据建成 Dataset 或把业务关系画成数据血缘。

首期采用冻结 V1 的以下资源，不因技术迁移重编号：

| 资源 | 保留的稳定 ID 与范围 |
|---|---|
| 四类对象 | 主体 `OBJ-FINANCING-ENTITY`；借据 `OBJ-FINANCING-DETAIL`；机构 `OBJ-FINANCIAL-INSTITUTION`；负责人 `OBJ-FINANCING-OWNER` |
| 三条关系 | `LINK-ENTITY-FINANCING` 明细→主体；`LINK-FINANCING-INSTITUTION` 明细→机构；`LINK-ENTITY-OWNER` 主体→负责人；保留发布方向 |
| 三个指标 | 融资余额 `MET-FINANCING-BALANCE`；余额加权平均融资成本 `MET-WAVG-FINANCING-COST`；高成本余额占比 `MET-HIGH-COST-BALANCE-RATIO`；集团/主体是查询范围，不另建重复指标 |
| 规则与行动 | R01 `RULE-HIGH-FINANCING-COST`；`ACTION-FINANCING-OPTIMIZATION`；其余规则仅保留定义与引用 |

### 5.2 首期行动合同

保留 `ACTION-FINANCING-OPTIMIZATION`“发起融资优化建议”，目标为 `OBJ-FINANCING-ENTITY` 的单一主体。**ActionType 声明适用规则集合；规则命中是行动前置条件之一。** 原定义 `ActionType.ruleIds` 绑定 R01/R02/R03，迁移保留此方向及集合；首期运行支持清单仅启用 R01，R02/R03 标记 deferred，不把裁剪写回冻结原定义。

“可信快照”指同一 `data_version + source_sha256 + as_of` 的业务库快照，并通过导入/质量回执核验；运行还核对 `curated_hash`，不能仅凭三项标识相同就宣称质量通过。

| 合同项 | 最小实现 |
|---|---|
| 输入 | 单主体、evaluation_id、query_id、精确语义/数据/场景上下文；不增加未定义取值的“建议方向/建议参数”，只接收合同声明字段 |
| 前置 | 当前已发布资源；R01 实际命中；同一主体/可信快照的证据就绪；机构关系完整；目标主体恰有一位负责人（多主体可共享同一负责人）；无等价进行中事项 |
| 预览 | 显示依据、将创建的待办、负责人、期限与影响；对象入口先生成同版查询和规则证据 |
| 提交 | 建立待确认请求和唯一 work_item 身份，返回 request_id / item_id |
| 人工确认 | 后端锁定请求并复核条件；本地执行器创建/激活该事项的待办内容，保存回执；task_id 引用该 item_id |
| 执行器 | 白名单本地函数；输入 schema 不能指定任意 URL、SQL 或可执行代码 |
| 幂等 | actor + 客户端请求键防网络重试；另以主体、ActionType 版本、语义/数据/场景和规范化参数生成业务键，不把随机 query_id 当去重依据 |
| 实际效果 | 创建一个内部待办；人工承接、凭证和效果另记，不修改融资事实 |

首期负责人按已发布 LinkType 映射从同一数据快照中决定，**不做人工分办**。约束针对单个目标主体：该主体缺少负责人或同时关联多位负责人时，须修复来源或映射，再产生新证据；不在表单随便挑人绕过。多家主体共享同一负责人是合法关系，不要求负责人只对应一个主体，也不表示全系统只有一位负责人。人工改派/分办为后续扩展。

### 5.3 请求、技术执行、人工办理分开

| 记录 | 状态与责任 |
|---|---|
| action_request | PENDING_CONFIRMATION（待确认）→ CONFIRMED（已确认，同事务创建待办与回执）；也可进入 REJECTED / CANCELLED / RETURNED。语义或数据快照激活切换使仍待确认的旧请求进入 EXPIRED（已失效）。退回补充将原请求置 RETURNED，不可再次确认；重新提交形成有前序引用的请求 |
| action_execution | 每次本地“创建/激活待办”尝试为 SUCCEEDED 或 FAILED。成功只表示任务和回执已同事务落库；它没有人工“待承接”状态 |
| work_item | PENDING_CONFIRMATION（待确认）→ AWAITING_ACCEPTANCE（待处理）→ IN_PROGRESS（执行中）→ EFFECT_REVIEW（执行完成、待复核）→ CLOSED（效果达成后结项）；拒绝/取消/退回/失效有明确状态。复核结论另存 unknown / insufficient / not_met / met，不为每种结论造队列 |
| audit_event | 追加记录提交、确认、拒绝、承接、凭证、失败、重试和复核。历史事件不覆盖 |

人工确认、请求状态、待办激活和成功回执在同一短事务中提交；首期没有持久化的“创建待办中”中间态。失败整体回滚，请求仍待确认，失败尝试在回滚后单独留痕。响应丢失先用幂等键回读；双击确认只允许一次成功；不持有数据库事务等待 LLM 或人工操作。人工承接发生在任务创建之后，不重复创建任务。`action_execution.SUCCEEDED` 仅表示创建任务成功，不等于人工执行完成。

沿用现有决策中心口径：凭证是人工填写的材料编号/来源引用；**无凭证不能执行完成，无晚于原依据日的后续材料不能宣称效果达成**。凭证不等于材料已被自动核验；标记执行完成后进入 EFFECT_REVIEW。效果未达成（not_met）或依据不足（insufficient）均留在待复核，补材料后再复核，不能因人工执行完成改写资金/成本事实或直接结项。初期可完整演示到“执行完成、效果待复核”，不为结项编造成本下降。退回/补充保留请求链；已结束事项如需重开，建立关联 followup 事项，保留原终态和历史。

语义或数据激活切换后，仍待确认的旧请求及对应事项进入 EXPIRED，需重算并重新确认；已经拒绝、取消、退回或失效的终态保留，已创建任务继续办理，始终保留原证据。新效果观察记录自己的时点和材料，不覆盖原查询快照。

## 6. 唯一权威、发布与恢复

### 6.1 权威来源定案

| 内容 | 权威层次 | 其他位置 |
|---|---|---|
| 融资数据 | 经验证的 PG 数据快照是运行期唯一权威读取源 | 原 artifact 是不可变源头与对账基准；DataHub 保存资产/字段/来源目录，Cube 只读 PG |
| 完整业务定义与草稿 | PG semantic_definition，通过业务服务 API 编辑 | DataHub 表单是入口；短引用、目录说明和指标表达式是投影 |
| 已发布运行定义 | PG semantic_release 的不可变 manifest、hash、原版本引用 | Cube schema、运行白名单、DataHub 投影均由它生成 |
| 查询/规则/行动事实 | PG 的运行表 | 页面、图表、CSV 使用同一结果，不重算 |
| 定义备份 | 发布前导出的 semantic/ 文件 + 导出 hash；PG 备份 | 经版本控制保存和校验重放，不能绕过编辑 API 直接影响运行 |

DataHub 的原生 owner、描述、标签仍可管理；影响执行的公式、阈值、对象映射和 ActionType 合同只能经 semantic API 修改。目录编辑不自动改变执行合同；发现执行投影与 release 不一致时显示同步状态并修复。不能把“DataHub 为项目底座”误解成必须把业务合同和交易状态塞进其内部存储。

### 6.2 草稿冻结、导出与发布

| 发布名词 | 定义与映射 |
|---|---|
| semantic_release 快照 | 新系统一次发布包的冻结内容，以 `release_id` 定位；保存定义、数据引用及生成产物，生命周期状态可更新但冻结内容不可覆盖 |
| 发布清单 manifest | 上述快照内的规范化定义、依赖、身份和数据来源清单；是发布包的组成部分，不是另一个版本身份 |
| deployment_release_id | 部署请求/回执中“目标发布包”的字段名，与 `semantic_release.release_id` 同值；不另造业务语义版本。一次尝试由独立的 `deployment_attempt_id` 标识 |
| active release | 单例运行控制指针选中、且实际 Cube 配置核验通过的 `semantic_release`；首期最多一个。READY 不代表 active，历史 V1/V2 身份另存 source_semantic_version |

1. 在 PG 一致性事务中读完整草稿依赖集合、各项 revision/hash 和源数据回执，验证所有引用。JSON 规范化后计算 definition_hash；不从多个 DataHub 页面拼装运行快照。长校验/导出不持有编辑锁。
2. 校验有限合同：求和、加权平均、条件占比三类公共模板；另将 R01 专用的银行归因表达式作为固定受限派生计算编译到 Cube，不扩展成任意公式编辑器。验证双分支与行动前置。历史自由文本要一次性映射成结构化合同并对账，不用 LLM 临时翻译成业务公式。
3. 将该冻结修订的全部定义、身份映射、来源引用导出到 `semantic/releases/<release_id>/`，记录 export_hash，并纳入新项目版本控制。导出文件不得含凭据或整份业务数据；PG 日常备份保留尚未发布草稿。导出失败不能进入 READY。
4. 生成不可变 `cube/releases/<release_id>/` schema 目录，记录 schema_hash、Cube 镜像版本、prompt_version 和受支持资源清单。完成静态校验及独立数值对账；进入 READY 前，在短事务中锁定并复核完整依赖集合及 revision/hash，发现并发编辑、新增或删除则中止本次发布，记录 FAILED，不混合新旧修订。该核对与 READY 提交使用同一编辑互斥边界；校验通过才进入 READY。
5. **发布为 READY 与激活运行分开。** 用户在明确的维护窗口执行激活；只有 §6.3 验证通过才能 ACTIVE。草稿和 READY 不影响当前运行。

状态：DRAFT（仅草稿表）→ VALIDATING → READY → DEPLOYING → ACTIVE；校验/部署失败为 FAILED；被替换的运行版本为 RETIRED。manifest 一旦冻结不改内容；状态/部署回执可更新，重试保留部署尝试审计。因并发编辑中止后须基于最新草稿重新发起发布；READY 后继续编辑草稿不改变该冻结包。每次新的业务合同生成新发布身份，技术移植保留 `source_semantic_version`，不把旧版本号用于修改后的业务定义。

### 6.3 Cube 单实例切换协议

首期采用显式重启，不依赖未经验证的热加载。所有 Cube 请求只来自业务服务，不给浏览器/外部直连入口。

1. 预先生成候选 schema 目录及 manifest，保持旧目录与配置可回退。
2. 单部署器取得互斥权，先持久化 deployment_attempt_id、目标 deployment_release_id 和 maintenance 状态，停止新查询、行动提交/确认；等待业务请求完成并确认 Cube 队列排空。服务负责追踪其全部查询；队列状态接口若不可用，实测请求退出/取消及容器终止边界。60 秒内不能确认排空则取消切换、继续旧版，不无限等待。
3. 将新目录以只读方式挂载，使用同一固定镜像重建/重启 Cube 容器。验收必须证明真实进程读取该目录；不只修改宿主机文件名就宣称成功。
4. 部署器核验目录 SHA、实际容器镜像/挂载/启动回执；检查健康状态、`/meta` 暴露的模型/成员，以及 `/sql` 和固定 `/load` 的预期口径。**schema_hash 由部署器回执提供，`/meta` 只作模型检查**；如注入 release marker，必须标明是自建字段且经过 0b 验证。
5. PG 锁内核对候选和回执，将旧版设 RETIRED、新版设 ACTIVE，并将旧版仍为 PENDING_CONFIRMATION 的请求及对应事项置 EXPIRED；写审计后才恢复接入。仅发布为 READY 不使请求失效。进程重启默认关闭接入，只有当前容器/目录与 PG active 状态一致才开放。
6. 失败时恢复旧挂载并重启旧 Cube，重验旧 golden 查询，再恢复旧 ACTIVE 指针。旧版也恢复失败则保持维护状态，显示故障，不返回旧答案冒充当前执行。

部署长操作不占用数据库事务；只有持久化尝试、最终指针切换等步骤使用短事务。部署器中断后，依据未结束的 attempt、实际容器/目录及 active 指针继续核验或回退，不能仅因锁释放而恢复接入。首期用单部署器和持久控制记录即可；不新增分布式发布平台。

目标维护窗口 ≤120 秒，0b 实测。热加载/dynamic schema 只作为后续观察项；若超过目标，先定位构建/挂载/健康检查，改为演示前激活。只有连续演示确需无中断且维护窗口不能满足时，另行评估按 release 路由两个 Cube 实例，不自动增加首期服务。

执行前锁定输入上下文：release_id、definition_hash、data_version、source_sha256、curated_hash、as_of、场景版本/轮次、quality_snapshot、import_receipt、prompt_version、模型/工具配置，由此生成 context_hash。plan/evidence/result 及各自 hash 随执行分别保存，不纳入执行前的 context_hash；查询完成后整体只读。查询与行动携带同一输入上下文和证据引用，来源合同编号只作为映射引用。每个激活 release 首期绑定一个数据快照；数据切换也走激活协议。

历史回答读取保存结果；重放旧语义需要显式切回对应 release，并核验旧数据快照。切回不能复活旧 EXPIRED 请求或触发历史行动。

### 6.4 DataHub 投影、备份和再生

元数据写入默认采用业务服务进程内固定版本的 DataHub Python SDK REST emitter（MCP），或该版本支持的 OpenAPI；0a 实测 Dataset/Schema/Lineage、术语、Metric/SemanticModel 和短引用。GraphQL 用于已支持的 UI 查询/特定变更，**不规定所有实体 ingestion 必须走 GraphQL**。无需新增 CLI ingestion 容器。

投影按稳定 URN 幂等 upsert，业务定义对应 resource_id。只写受管字段/aspect 白名单，保留原生人工 Owner、标签和描述；不能用全量覆盖冒充幂等。按 release/revision 串行投影，重试前核对当前目标版本，丢弃过时写入；保存 pending/failed/succeeded receipt，用同一服务的重试任务处理，无需新增消息平台。初次演示前必须验证目录可见和引用正确。ACTIVE 后短暂索引延迟展示“目录同步中”，运行以 PG active release 为准，不使用过期目录值作为证据，也不因 DataHub 搜索延迟重复激活。[S16]

DataHub 再生输入为：原资产 manifest、字段/血缘映射、semantic 导出与目录 seed。经 SDK 重放并检查引用。原生人工标签/Owner 等非派生元数据另做导出或存储备份，不能假定只靠业务定义能恢复整个 DataHub。阶段 5 同时恢复业务 PG、未发布草稿、发布导出、Cube 配置与目录投影；OpenSearch 重建索引不代替草稿备份。

## 7. 问数、规则和模型边界

路径：**DataHub 问数入口 → 业务服务锁定上下文 → LLM 生成 QueryPlan → 服务校验 → Cube /load → 保存证据 → 解释与行动预览。**

FastAPI 使用 **Pydantic + JSON Schema** 检查结构，另验证发布指标/维度白名单、过滤值类型、主体范围、时间、最大行数和只读操作。前端校验只改善输入体验。Python 服务不为复用旧前端 Zod 再引入 Node 服务。

计划支持单家、多家去重、板块、集团、按银行分组、排序和借据下钻。问句可自由改写，但不支持的意图必须澄清或拒绝。LLM 不编写执行 SQL、不修改语义、不直接确认或执行行动。诊断 SQL 来自 Cube `/sql`，业务服务不另拼一条生产查询；独立对账 SQL/Decimal 只用于验收。

模型调用约束：每次调用超时 20 秒，每问最多一次修复/重试，包含所有解析/解释调用的总预算 60 秒；429/暂时故障仅在剩余预算内重试，结构或语义校验二次失败则拒绝执行。解释生成失败时，已计算的表格和证据仍可返回，并注明解释不可用。正常请求 P95 ≤15 秒是体验目标，60 秒是异常封顶，不是把超时包装成达标。

提示词放 `prompts/` 版本控制，记录 prompt_version、模型标识及参数。用户问题、目录文本和数据值均作为不可信数据，不拼成高优先级指令；工具权限和主体白名单在服务端落实。解释按文本渲染，不执行其中的工具/HTML/指令标记；仅过滤特殊标记不能构成注入防护。模型没有人工确认/行动执行/业务写入工具。

计算要求：

- 余额加权平均融资成本为 `Σ折合人民币余额×当前利率 / Σ折合人民币余额`；余额字段对应 `FIELD-FINANCING-DETAIL-CNY-BALANCE`，不是仅筛选人民币币种。多主体取借据并集，不能平均单位成本；“平均利率”不是本指标的规范名。利率单位明确为百分数值，25 bp 为 0.25 个百分点。
- 冻结 V1 定义高成本借据为当前利率 **>2.75%**，高成本占比为这些借据的折合人民币余额/主体融资余额。R01 为“主体成本−集团成本 **>0.25 个百分点**，或高成本余额占比 **>20%**”；均为严格大于，边界值不按大于等于处理。
- Cube 基础模型保持借据粒度；连接机构/负责人需唯一键、many_to_one 和余额不变/fan-out 对账。全集团基准使用全量 5,218 行，主体筛选不能改变该基准范围。
- 零分母/未知值有独立状态；所有“现在”问题明确指向既有演示快照，不宣称实时。
- R01 在全量快照上逐主体评估，分别返回 matched、未命中、无法评估，以及行动阻断原因（缺负责人、缺机构、证据失效等）。Rule 只判断已发布条件，数值聚合/归因由同一执行定义确定。
- **UNIT-553 是首期 R01 正向行动案例；UNIT-465、UNIT-561 是 R01 不满足条件的负向案例。** 三家均可查数，但不要求三家都能发起 R01 行动。R02/R03 deferred 不改阈值、不伪造命中。
- R01 的两条命中分支和银行归因优先顺序从同一冻结定义迁移。仅成本偏离分支命中时，以 `Σ[折合人民币余额 × max(当前利率 − 集团基准 − 0.25个百分点, 0)]` 按银行归因；双支路同时命中时按高成本融资余额贡献排序。该受限派生计算由同版 Cube 执行，不能统一用高成本余额排名，也不在 Python 另建聚合口径。必须有双分支/单分支/未命中测试；旧推荐文本不覆盖历史发布定义，差异需记录再定版。

答案、表格、有限图表、CSV 和行动证据引用同一个 query_run。追问改变范围生成新 query_id；纯展示切换不重查。模型不可用时可以展示明确标注生成时间/版本的历史结果，或让用户用结构化查询继续读取当前数据；不得将缓存历史答案说成本次新问数。

## 8. 前端复用与范围裁剪

| 区域 | 用户功能 | 实现边界 |
|---|---|---|
| 语义配置区 | 对象映射、三个指标、R01、ActionType、校验/发布/激活 | 原 DataHub 详情扩展入口；表单提交业务 API，保存 PG 合同；目录返回可追踪 |
| 问数页 | 输入、范围、结果、证据、借据下钻、行动预览 | 一个路由；沿用原生布局/可复用组件，不做通用 BI 编辑器 |
| 事项页 | 待确认、承接、办理、凭证、复核 | 一个事项工作台和详情抽屉；不按来源另造队列 |
| 运营总览 | 状态数量、受阻项、各阶段平均停留时间 | **并入事项页顶部汇总条**；无记录显示“暂无”，点击筛选同一队列，不新增第四个主页面 |

对象发现/画像是问数页内的主体选择和详情抽屉，能恢复对象、观察日、查询与事项引用，不建设独立探索中心。原生 DataHub 搜索覆盖目录实体，不宣称可以直接搜索所有业务实例。

DataHub 原生界面默认可能以英文为主，新增业务区中文；0b 检查实际 i18n 覆盖并在演示说明中说明混合语言。首期不承担 DataHub 全站翻译。

桌面验收限定 Chrome/Edge 当前稳定版、1280×800 与 1440×900；桌面窄窗口的基本可用性需验证，不带入旧原型移动端/多断点回归。基本键盘和错误提示可用性仍保留。

优先在固定 DataHub fork 中注册有限入口并使用其现有组件。没有官方稳定插件契约时如实登记内部扩展依赖。[S18] 备选为同源 sidecar：优先链接跳转，嵌入 iframe 仅在同源身份、CSP、导航、返回和可访问性验证后使用；它不恢复旧 v1.5 iframe/消息桥。sidecar 仍需业务页面实现，不能当作零成本原生前端替代。

## 9. 部署、可观测性和工程结构

沿用阶段 0 锁定的官方 DataHub 依赖组合。候选 `v1.7.0.1` 的固定 Quickstart Compose 源码列出六个常驻服务：frontend、GMS、Kafka、MySQL、OpenSearch、Actions；另有 `system-update-quickstart` 初始化任务，这不是本项目已运行的容器统计。固定文档的官方已测试配置为 2 CPU、8GB RAM、2GB Swap、13GB 磁盘，仅针对 DataHub，不能当作完整系统保证。[S12] 首期对整套演示以 16GB 可用内存做预算，0a 实测。只禁用已验证不需要的可选组件，不为减容器数删除消费者/消息设施。

数据规模按资源范围区分：四类核心事实约 6 千行（5,218 + 574 + 24 + 24 = 5,840）；含台账扩展资产（301 + 5,218）及虚构历史演示（21 家 × 24 月 = 504）约 1.2 万行。历史资产为 `DATA-FINANCE-HISTORY-DEMO-2025-V1`；扩展资产的规模说明不代表将它们带入首期查询或与核心借据合并去重，首期输入仍按 §4.1。工程资源结论不由“只有几千行”单独推导，DataHub 底座开销仍需实测。

Cube 用单实例 memory cache/queue、无预聚合、REST、关闭开发模式的候选配置；不增加 Redis、CubeStore、向量库、Neo4j、Airflow、工作流平台或 Kubernetes。以选定镜像实测为准，不能宣称该配置适合生产多实例。

**以下目录属于后续独立 sibling repo，不在当前 v1.5 中创建：**

```text
datahub-finance-demo/
  infra/                 # Compose、部署回执、备份/恢复、DataHub seed 重放
  upstream/              # 固定版本、已修改上游文件和可重放补丁
  frontend-extension/    # 三个扩展区及事项顶部汇总
  service/
    semantic/            # PG 草稿、发布、投影与恢复
    query/               # 计划和只读执行
    rules/               # 发布条件判断
    actions/             # 预览、请求和创建任务的本地执行器
    workbench/           # 唯一事项状态和人工办理
  semantic/              # 版本化合同 schema、冻结导出及恢复种子
  prompts/               # prompt 模板和版本记录
  ingestion/             # 受控源 manifest、身份映射、导入与对账
  cube/releases/         # 按 release 生成；不手工编辑生产公式
  tests/                 # fixtures、独立计算、API 与业务闭环
  outputs/               # 新项目自己的日志和验收产物
```

本工作区内的方案/阶段验证证据仍归 `outputs/v1.5-verification/datahub-refactor/`；独立项目建立后按它自己的约定归档，不强迫新仓库继承 v1.5 命名。保护现有 4594/4592/4593 和 v1.4 4494 预览；新容器端口独立选择，当前工作区浏览器检查使用独立 CDP4596，结束后关闭临时测试资源。

身份：业务 API 通过受保护的同源入口可达；不能假设 DataHub cookie 就是可供 FastAPI 验签的 JWT。0b 选择服务端会话校验或可信代理的短期签名身份声明，验证过期/登出/伪造头部均失败。采用签名声明时，每次变更还须核验原会话或撤销状态，短 TTL 本身不能保证登出立即阻断。边缘剥离客户端传入的身份头，内网/API 端口不暴露。浏览器不读取 HttpOnly cookie 拼接 actor。Cookie 认证的变更接口验证 CSRF 和 Origin，模型与人工 API 权限分离。单演示账户不宣称多岗位审批。

API 读取边界：`GET /api/query-runs/{query_id}` 返回已保存的查询/证据及 evaluation_ids；规则证据单列 `GET /api/rule-evaluations/{evaluation_id}`，返回关联 query_id、主体、规则版本、命中分支和阻断原因。两个端点均复核身份与主体读取范围，只读已有记录，不能因读取而重算或执行行动；路径是本方案接口约定，尚未实现。

Cube REST `/meta`、`/sql`、`/load` 均由业务服务携带服务端签名 JWT 调用（Authorization 头），Cube 端启用验签并固定算法、有效期及签发者/受众配置；签名密钥与模型调用凭据只留在服务端，不给浏览器或 LLM。候选源码已核实默认验签路径，缺失/过期/伪造令牌与合法调用仍须阶段 0 实测。[S20] 该 JWT 不替代业务 API 对用户和主体范围的校验。

PG 分导入写入、Cube 只读、业务运行写入角色；迁移使用单独角色。应用无任意删除审计权限。持久化时间 UTC、界面显示当地时区；备份/恢复覆盖语义与运行数据。模型密钥仅服务端保存。

最小可观测性：结构化 JSON 日志，字段含 timestamp、level、event、correlation_id、query_id/request_id/item_id、release_id、耗时、error_code。跨多轮操作保存 parent correlation 和稳定资源引用，避免只靠聊天文本串联。校验/业务阻断为明确 4xx、外部超时/依赖故障为 5xx，返回可读恢复建议。

日志写容器 stdout 并用 Docker 轮转（建议每服务 10MB×3 文件）；演示/故障导出到新项目 `outputs/logs/`，默认保留 7 天，阶段验收证据单独保留。日志用于诊断且可轮转；audit_event 用于业务留痕，保留至演示项目显式归档。不记录密钥、完整模型请求或完整工作簿，不为此引入日志平台。

## 10. 分阶段实现和量化预算

| 阶段 | 可演示交付 | 完成条件 |
|---|---|---|
| 0a 底座冒烟 | 原生 DataHub Dataset、候选指标页；Cube /meta、/load | 固定版本/SDK；启动、重启恢复、机器资源实测；不改变现有预览 |
| 0b 扩展验证 | 一个真实详情入口、受保护业务 API、一次 Cube 切换/回退 | 按下表串行验证并定案 UI 方式；custom aspect 不在关键路径 |
| 1 数据入库 | 全量 5,218 行与四类对象、源行追溯、目录 Schema/血缘 | manifest/SHA/数量/金额/身份/日期/质量及 C003 映射通过；导入幂等；SDK 元数据 upsert 可复现 |
| 2 可执行本体 | 四类对象、三关系、三个指标、R01、一个 ActionType | PG 完整合同、Git 导出、Cube 派生配置、DataHub 目录一致；校验/READY/激活/回退分别验证 |
| 3 问数 | 真实自然语言计划、集团/主体/银行结果及借据证据 | 黄金计划/数值、正负语言题、上下文、失败行为通过；正常 P95 ≤15s |
| 4 行动 | 从 UNIT-553 证据创建请求、确认激活唯一待办、承接/凭证/复核 | 幂等、并发确认、响应丢失、过期、拒绝/补充和两家负向案例通过；重启持久化 |
| 5 演示交付 | 8–10 分钟闭环与模型失败备用流程 | 全栈干净恢复、演示前检查、桌面浏览器、补丁重放、依赖清单与证据通过 |

### 10.1 0b 预算与验证顺序

先验证有限 fork，最多两个工作日形成可用结论；未达标再验证 sidecar，不平行铺开三套实现。0b 总预算 2–4 个工作日。两种方式都无法可信传递身份或维持 DataHub 主要体验时，记录具体缺口并重估，不跳过验证开始铺业务页面。

| 项目 | 预算/通过条件 | 超限处理 |
|---|---|---|
| 上游补丁面 | 目标 ≤300 行 diff、≤5 个既有上游文件；只计入口/适配改动，新增业务组件另列规模 | 超限评估 sidecar；不靠排除大面积移动代码规避统计 |
| 扩展接口 | 优先稳定入口；如必须用内部组件，固定具体文件/版本及升级验证 | 不虚构官方插件 API；深改 GMS/搜索不进入首期 |
| 构建 | 指定硬件/缓存条件下，三次“改一个业务组件→可访问”的增量构建均 ≤5 分钟；全量构建另记 | 优先查缓存，仍不达标切 sidecar；如两条都失败重估 |
| 会话/CSRF | 有效会话成功，伪造/过期/直接端口/缺 CSRF 的写入失败 | 硬门槛，不以开发模式关闭认证放行 |
| sidecar | 真实入口和返回、同源身份通过；如 iframe 再测 CSP/frame-ancestors、X-Frame-Options | 优先跳转，嵌入失败不降低头部保护 |
| Cube | 实测排空、重启、schema 目录回执、/meta 成员、golden query、回退 | 目标切换 ≤120 秒；先安排演示前切换，不自动启用双实例 |
| 资源/语言 | 记录峰值、磁盘、原生中文覆盖和缺失文案 | 资源不足优先转独立服务器；语言覆盖不足不重写全站 |

补丁行数和构建预算是控制维护成本的工程目标；认证、数据/版本一致性与正确性是硬门槛。不能为满足行数预算省掉必要检查。

### 10.2 性能与排期

演示机、模型版本、网络条件固定，使用 20 条代表题、三轮实测，含 LLM 计划、Cube、持久化和回答。P95 ≤15 秒为正常体验门槛；评测集每轮一次通过率 ≥90% 作为进入验收的条件，未通过项必须澄清或明确拒绝，不得给错数充通过。拒答、失败和超时单列且不算快速成功。首次启动后第一题另报冷请求耗时，不用预热缓存掩盖。缓存仅用确定性结果且含 release/data/plan 键。

容器已下载、数据已初始化的“停机→可演示”目标 ≤10 分钟；首次拉镜像/全量构建另记，不混入冷启动定义。超过体验预算在该阶段整改或明确缩减可演示范围，不默认为通过。单问 60 秒硬超时保留异常封顶。

基础估计仍为约 16–26 个工程工作日：0a 0.5–1，0b 2–4，数据 2–3，语义 3–5，问数 3–5，行动 3–5，交付 2–3。其前提是后端主导、前端配合、模型/环境可用。0b 后用实际补丁量、构建/切换时间、鉴权路径和评测集工作量重新估算；custom aspect 已从关键路径移除。

基础估计未充分包含 fork 反复适配、环境排错和语言评测集扩充，按 30–50% 缓冲约为 21–39 人日，可按 25–40 人日准备人力预算；这不是 16–26 天的等值换算，也不等于日历交付承诺。

### 10.3 风险登记与退出条件

| 风险 | 对演示的影响 | 缓解与退出条件 | 验证阶段 |
|---|---|---|---|
| DataHub fork 修改面扩大、构建过慢 | 时间耗在底座改造，业务闭环迟迟不可见 | 按 0b 预算先试有限入口；超限转同源 sidecar，仍保留 DataHub 主入口 | 0b |
| custom aspect 不可用 | 无法按设想显示复杂定义 | 首期本就由 PG 保存完整定义、短引用投影；暂缓 aspect，无需更换权威来源 | 0b 观察；后续增强 |
| Cube、PG 指针与目录版本不一致 | 混用口径或错误确认 | 持久部署尝试、关闭接入、排空、实测目录回执、短事务切换、启动核验；不能恢复一致就保持维护 | 0b、2、5 |
| LLM 不可用或计划不合规 | 自然语言演示中断或错误查询 | 服务端白名单与超时；结构化当前查询或标明时间的历史结果；不伪造新答案 | 3、5 |
| 16GB 可用内存不足 | 容器重启或问数延迟 | 记录全栈峰值和 OOM；先关闭可选任务，仍不足转独立服务器，不删除必要 DataHub 依赖 | 0a、5 |
| 上游修复破坏入口补丁/鉴权 | 升级后入口或写入权限失效 | 固定源码/镜像与受管文件清单，重放补丁、鉴权及闭环 smoke；失败保留现版本并评估 backport | 0b、5及升级时 |
| 投影重试覆盖人工字段或新版本 | 目录说明与运行证据冲突 | 字段/aspect 所有权、串行版本检查、投影回执；执行不读取旧投影作为权威 | 1、2、5 |
| 演示当天依赖故障 | 无法完成闭环 | 按 §11.3 预检和恢复；数据库/Cube 故障只读历史、禁止新行动；演示期间不升级/激活 | 5及演示前 |

## 11. 验收、三方对账与演示预案

黄金验收覆盖：集团余额/成本；三家各自成本；两家/三家组合；重复主体去重；全主体 R01 结果及阻断原因；UNIT-553 两条命中分支与银行/借据证据；UNIT-465/561 无 R01 行动；预览/确认/唯一任务/承接；重启恢复；凭证与效果依据不足。

### 11.1 三方数值对账

| 来源 | 使用方式 |
|---|---|
| 历史 golden | 冻结 authoritative-facts.js：集团成本 2.3722312046695873%（百分数值）、余额 21,613.387 亿元；UNIT-553 银行归因及两/三家组合 |
| 独立重算 | Python Decimal 从相同源快照独立实现已核对口径；可用 pandas 读取，不用浮点中间值当金额权威 |
| 新执行 | Cube /load；对照生成 SQL、维度范围、Join 和原始未舍入值 |

例如 UNIT-553 首名欧陆银行的问题余额 99.586 亿元、占问题余额 32.75435059318048%，不是占主体总余额。机构显示别名不同应按稳定机构映射对齐。历史 JS 中只提取与本场景口径相同的纯函数/测试；`src/domain.js` 也服务合成地图数据、`financing-models.js` 含其他融资算法，不能将整套实现或“历史204项测试通过”直接视为 S001 当前正确性证明。R01 单分支路径若历史样本未覆盖，用独立小型测试夹具验证，不改演示原数据。

金额按源精度精确对账；比率定义展示舍入与未舍入容差，建议绝对误差 ≤1e-10 个百分点，0b/2 确认 Cube 序列化精度后锁定。差异先查单位、范围、精度和口径，不放宽容差掩盖规则错误。

### 11.2 可重复语言与运行验收

至少 20 条 fixtures 固定期望 metrics、dimensions、主体集合、filters、排序、时间和期望澄清/拒答；规范化后自动比较 plan 字段，分类统计解析错误、错误拒答/错误放行、数值错误。人工只复核歧义边界。评测集一次通过率 ≥90% 作为进入验收的条件；未通过项必须澄清或明确拒绝，不得给错数充通过。fixture 本就要求澄清/拒答的按其预期判定，不能靠拒答可支持问题凑通过率。服务端校验通过的结构化计划和数值测试必须 100% 通过，任何不确定计划不得绕过校验出错数。LLM 输出仍可能变化，固定版本/参数及保存响应不能宣称绝对确定。

其余验收：导入幂等、关键未知值、fan-out、发布期间并发编辑导致发布中止、查询期间切换、目录投影延迟、数据/版本错配、并发确认、幂等键同键异参、响应丢失、失败重试、过期证据、无凭证不能执行完成、后续材料不晚于原依据日不能判效果达成、未达成/依据不足仍在待复核、匿名/伪造身份、提示注入、模型/Cube 不可用。检查 API、数据库、manifest 与页面一致，截图仅作界面证据。

只运行与本次新实现有关的测试，不复制旧全平台回归或因一个文档修改执行旧 npm 全套。后续必要检查包括迁移向前/备份恢复、全栈重建、浏览器闭环和一次补丁重放。依赖交付记录版本、镜像 digest、实际 LICENSE/NOTICE 和简单 SBOM；不复制 Lightdash EE/Wren legacy，若未采用则不建立无关检查流水线。

### 11.3 演示当天

演示前检查：模型连通、容器健康、active release 与 schema 回执匹配、源/curated 指纹、集团和 UNIT-553 对账快跑、无未处理旧请求、备份与恢复脚本在场、准备好的历史结果带生成时间/版本标签。演示期间不做语义激活或上游升级。

模型故障：显示“自然语言服务不可用”，可用结构化表单查当前数据并重新预览行动；历史结果明确标注“已保存结果，非本次新问数”。Cube/数据库故障只能只读查看历史，阻断新行动，不伪造实时成功。演示用重置限于该场景新轮次，保留旧审计，不抹掉未知执行结果后再重试。

## 12. 开发任务和工作区边界

1. 0a/0b 固定版本、原生目录入口、可信会话、最小 Cube 查询与一次切换/回退。
2. 受控 S001 导入、UNIT↔ENT 映射、质量回执、独立计算和 DataHub 元数据 seed。
3. PG semantic_definition、三个计算模板、R01/ActionType、Git 导出、release、Cube 生成配置及目录投影。
4. 结构化查询先通，再接 LLM 与评测 fixtures；显示相同结果的表格、证据和有限图表。
5. 请求/预览/人工确认、本地幂等创建待办、唯一事项状态与顶部汇总。
6. 干净恢复、异常演示、桌面验证、补丁重放与交付说明。

当前只修订方案，不执行新项目开发。方案保留在现有分支；此次不自动提交、不清理 `undefined/` 截图、不移动任何既有产物。清单 R5 的提交/清理属于另一类操作，不能从审查建议推导为本次必要动作。后续工程初始化时先查明截图来源和引用，再单独处理；新项目不复制它们即可。

## 13. 依据与事实修正

### 本地依据

- 用户附件《DATAHUB-REFACTOR-PLAN.md 修订清单》及 `outputs/v1.5-verification/DATAHUB-PLAN-REVIEW-2026-09-28.md`：本次逐项处置来源；审查不是部署证据。
- `README.md`、`DATA-AND-MAP-SOURCES.md`：数据与模型边界、UNIT/ENT 别名、旧本地状态实现。
- `deliverables/新项目功能设计-平台总控台账-v0.1.md` D005 与阶段2设计：既有演示/脱敏处理；台账提供 C003/C017/C011/C012/C033 的明确含义。
- 冻结 `ontology-management-review/canvas-first/authoritative-facts.js`：源 SHA、大小、行列数、演示 asOf、黄金金额、成本、银行归因和三个规则案例。
- 冻结 `portfolio-s001-seed.js`、v1.5 `composite/resources/business-release.js` / `business-preparation.json`：`OBJ-FINANCING-ENTITY`、`ACTION-FINANCING-OPTIMIZATION`、`RULE-HIGH-FINANCING-COST` 等稳定 ID 的实际定义；它们不在阶段1业务设计文档中。
- `composite/resources/business-finance-source.json` / `business-source.json`：301 条投影与全量 summary 的不同范围；`finance-contract-assets.json` 的可比利率投影不是完整四成员资产。
- 原阶段1/3/4设计作为业务含义参考，文中推荐阈值/早期未就绪状态不能覆盖后续冻结记录；迁移验收不等于生产审批或新数据授权。
- `REFACTOR-REVIEW.md` 与 `DECISION-CENTER-GUIDE.md`：提取单一事项身份、确认/执行/效果分离；不因此恢复旧八模块或要求继承每个历史页面。

Draft 冲突精确到文件：冻结 `designs/prototype-releases/v1.1.0/ontology-management-review/canvas-first/portfolio-s001-seed.js` 中存在遗留 `publicationState:Draft` 标记与外层发布状态冲突。文件内 `Draft` 字面命中共 168 处，其中 `status:"Draft"` 字段值 1 处、`publicationState:"Draft"` 字段值 148 处；其余包括 `draftName:"融资语义 Draft"` 等文本命中。168 是字面命中数，不是 `status:Draft` 字段数，也不等于冲突资源数；148 处标记同样不能全部当作冲突，须结合发布对象路径解析。`authoritative-facts.js` 未检出该字段冲突，不能将此问题归给它。

另在 v1.5 `composite/resources/business-release.js` 中，version.objects/links/metrics/rules/actions 共 33 条资源均存在 `publicationState:Published` 与 `status:Draft` 冲突；`version.validationSnapshot.resourceManifest` 有 109 条 Draft，其 releaseEnvelope 中另存同样 109 条 Draft；`version.resourceManifestSnapshot.resources` 则有 109 条 Published。该文件共 66 处 `status:Draft`。这些是不同文件/路径/快照，不能笼统说所有 manifest 都为 Draft。

迁移解析优先检查外层发布记录、publishRecordId、publicationState、语义版本、成员归属和内容一致性；有效记录下的遗留 status 只告警，不直接判定当前业务未发布。若发布记录无法定位、指纹或版本冲突则隔离，不仅凭一个 Published 字符串自动启用。V2 这些冲突也不意味着选用其 301 行投影替代 V1 全量。

33 条资源指向的 V2 记录 `record-MTUWMQFX-UI1U` 存在，但记录说明“尚未切换正式数据”；解析发布记录后还要核对实际消费绑定。历史发布、正式采用、新系统激活是三个不同事实。

### 官方来源

- [S1 DataHub v1.7.0.1](https://github.com/datahub-project/datahub/releases/tag/v1.7.0.1)
- [S2 DataHub 实体注册](https://github.com/datahub-project/datahub/blob/v1.7.0.1/metadata-models/src/main/resources/entity-registry.yml)
- [S3 DataHub Structured Properties](https://github.com/datahub-project/datahub/blob/v1.7.0.1/docs/api/tutorials/structured-properties.md)
- [S4 DataHub 模型扩展文档](https://github.com/datahub-project/datahub/blob/v1.7.0.1/docs/modeling/extending-the-metadata-model.md)
- [S5 DataHub Actions](https://github.com/datahub-project/datahub/blob/v1.7.0.1/docs/actions/README.md)
- [S6 WrenAI 当前开源范围与迁移说明，固定来源版本](https://github.com/Canner/WrenAI/blob/d26ab6af5e7e641f3e67f3ea9125486f5425fd30/README.md)
- [S7 Cube 官方仓库](https://github.com/cube-js/cube)
- [S8 Cube REST API](https://cube.dev/docs/product/apis-integrations/rest-api)
- [S9 OpenMetadata 概念定义与物理资产绑定](https://github.com/open-metadata/OpenMetadata/blob/7512ec3e4bf5296aaf192fb81b812848ed4716ac/openmetadata-spec/src/main/resources/json/schema/entity/data/glossaryTerm.json)
- [S10 Lightdash 官方仓库](https://github.com/lightdash/lightdash)
- [S11 DataHub 指标开关](https://github.com/datahub-project/datahub/blob/v1.7.0.1/metadata-service/configuration/src/main/resources/application.yaml#L1624)；[语义模型页面](https://github.com/datahub-project/datahub/blob/v1.7.0.1/datahub-web-react/src/app/entityV2/semanticModel/SemanticModelEntity.tsx)
- [S12 DataHub Quickstart](https://github.com/datahub-project/datahub/blob/v1.7.0.1/docs/quickstart.md)；[对应 Compose](https://github.com/datahub-project/datahub/blob/v1.7.0.1/docker/quickstart/docker-compose.quickstart-profile.yml)
- [S13 Ask DataHub 的 Cloud 边界](https://github.com/datahub-project/datahub/blob/master/docs/features/feature-guides/ask-datahub.md)；[本体查询的 Cloud 边界](https://github.com/datahub-project/datahub/blob/master/docs/features/feature-guides/ontology/querying-your-ontology.md)（这两项引用滚动文档，仅用于辨别版本/产品边界）
- [S14 Cube v1.7.45 REST 实现](https://github.com/cube-js/cube/blob/v1.7.45/packages/cubejs-api-gateway/src/gateway.ts#L380)；[memory 查询队列支持](https://github.com/cube-js/cube/blob/v1.7.45/packages/cubejs-query-orchestrator/src/orchestrator/QueryOrchestrator.ts#L41)
- [S15 Lightdash EE License](https://github.com/lightdash/lightdash/blob/06f8cc3d45a30f12dc5ac3813036a00dc86c9a74/packages/backend/src/ee/LICENSE)；[AI Agent 后端所在路径](https://github.com/lightdash/lightdash/blob/06f8cc3d45a30f12dc5ac3813036a00dc86c9a74/packages/backend/src/ee/controllers/aiAgentController.ts)
- [S16 DataHub API 选择](https://github.com/datahub-project/datahub/blob/v1.7.0.1/docs/api/datahub-apis.md)；[SemanticModel SDK 示例](https://github.com/datahub-project/datahub/blob/v1.7.0.1/metadata-ingestion/examples/library/semantic_model_create.py)
- [S17 Cube v1.7.46 meta 响应实现](https://github.com/cube-js/cube/blob/v1.7.46/packages/cubejs-api-gateway/src/gateway.ts#L497)（用于核对公开返回字段，不把自定义 schema hash 归为原生能力）
- [S18 DataHub 前端实体扩展说明](https://github.com/datahub-project/datahub/blob/v1.7.0.1/datahub-web-react/README.md#adding-an-entity)（源码扩展指引，不等于稳定插件 SDK）
- [S19 Wren 固定提交的许可范围](https://github.com/Canner/WrenAI/blob/d26ab6af5e7e641f3ea9125486f5425fd30/LICENSE#L14)；[Core 子目录 LICENSE](https://github.com/Canner/WrenAI/blob/d26ab6af5e7e641f3ea9125486f5425fd30/core/wren-core/core/LICENSE#L1)（源码路径许可已核实，不代表所有发布包/传递依赖已审计）
- [S20 Cube v1.7.45 默认 JWT 验签](https://github.com/cube-js/cube/blob/v1.7.45/packages/cubejs-api-gateway/src/gateway.ts#L2638)（源码确认，不代表本项目运行鉴权已验证）

## 14. 附录：核心持久化设计草案

以下是 PostgreSQL **设计草案，不是完整可运行迁移，也未做数据库执行验证**。目的是让阶段 2/4 对齐身份、证据和并发边界。六张核心表之外，补列语义草稿与审计；`data_snapshot`、`import_receipt`、`identity_alias`、部署/投影尝试和单例运行控制记录仍需实现并补外键，不能据此宣称八张表即可构成完整系统。

`manifest` 保存冻结的定义、源语义版本、data_version、源/curated 指纹、as_of 和依赖引用；`artifacts` 保存 export_hash、schema_hash、镜像版本等生成产物。前者插入后不可改，后者在 VALIDATING 完成生成时写入一次；状态和最新部署回执允许更新，尝试历史写审计。`query_run.context` 另锁定场景/轮次、质量/导入回执、prompt_version、模型/工具配置；完整 plan、result、evidence 与 hash 一同保存，不只存散列。

```sql
CREATE TABLE semantic_definition (
  resource_id text PRIMARY KEY,
  revision bigint NOT NULL CHECK (revision > 0),
  kind text NOT NULL CHECK (kind IN
    ('ObjectType','Property','LinkType','Metric','Rule','ActionType')),
  definition jsonb NOT NULL,
  definition_hash char(64) NOT NULL,
  edited_by text NOT NULL,
  edited_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE semantic_release (
  release_id text PRIMARY KEY,
  definition_hash char(64) NOT NULL,
  manifest jsonb NOT NULL,
  artifacts jsonb,
  state text NOT NULL CHECK (state IN
    ('VALIDATING','READY','DEPLOYING','ACTIVE','RETIRED','FAILED')),
  deployment_receipt jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (state IN ('VALIDATING','FAILED') OR artifacts IS NOT NULL)
);
CREATE UNIQUE INDEX one_active_release ON semantic_release ((1))
  WHERE state = 'ACTIVE';  -- 首期一个运行环境；不是多租户全局方案

CREATE TABLE query_run (
  query_id uuid PRIMARY KEY,
  release_id text NOT NULL REFERENCES semantic_release(release_id),
  correlation_id uuid NOT NULL,
  actor_id text NOT NULL,
  context jsonb NOT NULL,
  context_hash char(64) NOT NULL,
  prompt_version text NOT NULL,
  plan jsonb, plan_hash char(64),
  result jsonb, result_hash char(64),
  evidence jsonb, evidence_hash char(64),
  state text NOT NULL CHECK (state IN ('RUNNING','SUCCEEDED','FAILED')),
  error_code text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (query_id, context_hash),
  CHECK ((state = 'RUNNING') = (completed_at IS NULL)),
  CHECK (state <> 'SUCCEEDED' OR
    (plan IS NOT NULL AND plan_hash IS NOT NULL AND result IS NOT NULL
     AND result_hash IS NOT NULL AND evidence IS NOT NULL AND evidence_hash IS NOT NULL))
);

CREATE TABLE rule_evaluation (
  evaluation_id uuid PRIMARY KEY,
  query_id uuid NOT NULL REFERENCES query_run(query_id),
  target_id text NOT NULL,
  rule_id text NOT NULL,
  rule_version text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('MATCHED','NOT_MATCHED','UNKNOWN')),
  action_ready boolean NOT NULL,
  blockers jsonb NOT NULL DEFAULT '[]',
  evidence jsonb NOT NULL,
  evidence_hash char(64) NOT NULL,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evaluation_id, query_id, target_id),
  CHECK (NOT action_ready OR (outcome = 'MATCHED' AND blockers = '[]'::jsonb))
);

CREATE TABLE action_request (
  request_id uuid PRIMARY KEY,
  predecessor_request_id uuid REFERENCES action_request(request_id),
  query_id uuid NOT NULL,
  context_hash char(64) NOT NULL,
  evaluation_id uuid NOT NULL,
  target_id text NOT NULL,
  action_type_id text NOT NULL,
  action_type_version text NOT NULL,
  actor_id text NOT NULL,
  client_key text NOT NULL,
  payload jsonb NOT NULL,
  payload_hash char(64) NOT NULL,
  state text NOT NULL CHECK (state IN
    ('PENDING_CONFIRMATION','CONFIRMED','REJECTED','CANCELLED','RETURNED','EXPIRED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (actor_id, client_key),
  FOREIGN KEY (query_id, context_hash) REFERENCES query_run(query_id, context_hash),
  FOREIGN KEY (evaluation_id, query_id, target_id)
    REFERENCES rule_evaluation(evaluation_id, query_id, target_id)
);

CREATE TABLE work_item (
  item_id uuid PRIMARY KEY,  -- task_id 是该 ID 的接口别名，不另造任务身份
  request_id uuid NOT NULL UNIQUE REFERENCES action_request(request_id),
  predecessor_item_id uuid REFERENCES work_item(item_id),
  business_key char(64) NOT NULL,
  owner_id text NOT NULL,
  state text NOT NULL CHECK (state IN
    ('PENDING_CONFIRMATION','AWAITING_ACCEPTANCE','IN_PROGRESS','EFFECT_REVIEW',
     'CLOSED','REJECTED','CANCELLED','RETURNED','EXPIRED')),
  task_payload jsonb,
  handling_evidence jsonb NOT NULL DEFAULT '[]',
  effect_outcome text NOT NULL DEFAULT 'unknown'
    CHECK (effect_outcome IN ('unknown','insufficient','not_met','met')),
  created_at timestamptz NOT NULL DEFAULT now(),
  state_entered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, request_id),
  CHECK (jsonb_typeof(handling_evidence) = 'array'),
  CHECK (state NOT IN ('EFFECT_REVIEW','CLOSED') OR handling_evidence <> '[]'::jsonb),
  CHECK (state <> 'CLOSED' OR effect_outcome = 'met'),
  CHECK (effect_outcome NOT IN ('insufficient','not_met') OR state = 'EFFECT_REVIEW')
);
CREATE UNIQUE INDEX one_open_business_item ON work_item (business_key)
  WHERE state IN ('PENDING_CONFIRMATION','AWAITING_ACCEPTANCE','IN_PROGRESS','EFFECT_REVIEW');

CREATE TABLE action_execution (
  execution_id uuid PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES action_request(request_id),
  item_id uuid NOT NULL,
  attempt_no integer NOT NULL CHECK (attempt_no > 0),
  state text NOT NULL CHECK (state IN ('SUCCEEDED','FAILED')),
  receipt jsonb,
  error_code text,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, attempt_no),
  FOREIGN KEY (item_id, request_id) REFERENCES work_item(item_id, request_id),
  CHECK ((state = 'SUCCEEDED' AND receipt IS NOT NULL AND error_code IS NULL)
      OR (state = 'FAILED' AND error_code IS NOT NULL))
);
CREATE UNIQUE INDEX one_success_per_request ON action_execution(request_id)
  WHERE state = 'SUCCEEDED';

CREATE TABLE audit_event (
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  correlation_id uuid NOT NULL,
  actor_id text NOT NULL,
  event_type text NOT NULL,
  query_id uuid REFERENCES query_run(query_id),
  request_id uuid REFERENCES action_request(request_id),
  item_id uuid REFERENCES work_item(item_id),
  details jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION reject_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append-only history: %', TG_TABLE_NAME;
END;
$$;
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON audit_event
  FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER execution_append_only BEFORE UPDATE OR DELETE ON action_execution
  FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER evaluation_append_only BEFORE UPDATE OR DELETE ON rule_evaluation
  FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();

CREATE FUNCTION guard_release_content() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'release deletion forbidden'; END IF;
  IF ROW(NEW.release_id, NEW.definition_hash, NEW.manifest, NEW.created_at)
      IS DISTINCT FROM ROW(OLD.release_id, OLD.definition_hash, OLD.manifest, OLD.created_at)
     OR (OLD.artifacts IS NOT NULL AND NEW.artifacts IS DISTINCT FROM OLD.artifacts)
  THEN RAISE EXCEPTION 'release content is immutable'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER release_content_guard BEFORE UPDATE OR DELETE ON semantic_release
  FOR EACH ROW EXECUTE FUNCTION guard_release_content();

CREATE FUNCTION guard_completed_query() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'query deletion forbidden'; END IF;
  IF OLD.state <> 'RUNNING' THEN RAISE EXCEPTION 'completed query is immutable'; END IF;
  IF ROW(NEW.query_id, NEW.release_id, NEW.context, NEW.context_hash,
         NEW.actor_id, NEW.prompt_version, NEW.correlation_id, NEW.started_at)
      IS DISTINCT FROM ROW(OLD.query_id, OLD.release_id, OLD.context, OLD.context_hash,
                           OLD.actor_id, OLD.prompt_version, OLD.correlation_id, OLD.started_at)
  THEN RAISE EXCEPTION 'query context is immutable'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER completed_query_guard BEFORE UPDATE OR DELETE ON query_run
  FOR EACH ROW EXECUTE FUNCTION guard_completed_query();
```

实现必须同时满足以下事务与权限约束；表中的 CHECK 只限制取值，不自动实现授权、合法迁移和跨记录上下文检查：

1. 提交事务先核验查询 SUCCEEDED、同 release/快照/主体的有效规则证据、当前 active 状态、行动资源版本及目标主体恰有一位负责人；不限制同一负责人承接其他主体。`action_ready` 是当时的评估结果，确认时必须重新检查，不能当永久通行证。保存规范化前后内容并重算 hash，不信任客户端提供的 hash/actor/owner。
2. 首次成功提交才持久绑定 `actor_id + client_key`；已绑定键同 payload 返回原请求，同键异参返回冲突。business_key 按 §5.2 定义；尚未绑定的新键若命中开放业务事项，返回 409 及已有 request/item 引用，不创建请求、不消耗该新键，界面提供“查看已有事项”。请求和唯一 work_item 在一个事务建立，唯一索引处理并发竞争，不能先创建孤立请求再查重复。
3. 确认使用行锁核对请求仍为 PENDING_CONFIRMATION，在同一短事务写 CONFIRMED、待办内容、AWAITING_ACCEPTANCE、SUCCEEDED 回执和审计。该执行器只是本地数据库操作；成功后重读返回原 task_id。失败回滚后追加 FAILED 尝试，不能把成功执行记录改成失败。attempt_no 由服务串行分配，失败留痕再次失败须记诊断日志并允许核对，不能报告成功。
4. REJECTED/CANCELLED/RETURNED/EXPIRED 同步结束尚未激活的事项；已确认任务的后续人工状态只在 work_item 推进。凭证/复核追加审计，最新投影可更新；进入 EFFECT_REVIEW 必须有人工填写的有效材料编号/来源引用，不能以空对象充凭证。判定 met 和进入 CLOSED 前，服务须核验后续材料观察日严格晚于原依据日且内容支持效果结论；材料与时点写入审计，不能仅靠 CHECK 或人工勾选宣称事实已核验。`not_met`/`insufficient` 均保持 EFFECT_REVIEW，补材料后重新复核，不能用通用取消/结项接口绕过。补充/重开创建前序关联的新请求和事项，旧终态不复活。
5. query_run 完成后、rule_evaluation 和每次 action_execution 只读；回放创建新记录。程序崩溃遗留 RUNNING 查询由恢复流程标记 FAILED，不能改写旧 SUCCEEDED 结果。audit_event/rule_evaluation/action_execution 仅授予所需 INSERT/SELECT；query_run/semantic_release 通过受限接口或数据库函数更新允许字段，并由触发器保护不可变内容。上述表禁止运行角色 DELETE/TRUNCATE；迁移/维护角色与运行角色分开，触发器不宣称防住数据库管理员。
6. snapshot/import receipt/identity_alias 增补外键和唯一约束；单例运行控制记录维护接入开关、active 指针与 deployment_attempt_id，部署请求/回执的 deployment_release_id 引用同一个 semantic_release.release_id。按 §6.3 锁定和恢复，索引只能保证“最多一个 ACTIVE”，不能证明 Cube 实际加载一致。投影写入与导出失败分别记录可重试状态，不占用人工确认事务。

阶段 2 验证发布内容不可变、发布期间并发编辑使本次发布中止、READY 后草稿修订不改冻结包、唯一 ACTIVE 和部署恢复；阶段 4 验证同键异参、业务重复、并发确认、失败尝试留痕、状态错配、退回重提及凭证/后续材料/待复核要求。届时补完整迁移和真实数据库测试，不把本附录当已完成工程。

## 15. 修订记录（2026-09-28、2026-09-29）

以下“落实”均指**方案条款已改写**，不代表功能已实现或验收通过。编号来自用户《修订清单》；其第 4 节六项预算原无编号，本文依原顺序记为 Q1–Q6，方便追踪。

| 项号 | 处置与落点 | 工程验证阶段 |
|---|---|---|
| A1 | 落实：§1/3/5/6/9/10 统一 PG 完整合同、业务 API 编辑、DataHub 目录投影；aspect 可选 | 0b、2 |
| A2 | 调整落实：§6.2/6.4 发布前冻结导出及 PG 草稿备份；再生受管投影，原生人工元数据另备份 | 2、5 |
| A3 | 调整落实：§6.3 排空、显式重启、部署回执和回退；/meta 只核模型成员，hash 由部署器核验；长操作不用长事务 | 0b、2 |
| A4 | 更正事实后落实：§4.2 依据 D005/阶段 2 延续既有演示处理；不采信“真实名称/金额”断言，不再次随机化或虚构外部授权 | 1 |
| G1 | 落实：§8 运营总览并入事项顶部汇总，不增加第四主页面或第二队列 | 4 |
| G2 | 落实：§5.2 负责人来自快照关系；人工分办暂缓，非首期遗漏 | 后续扩展 |
| G3 | 落实：§10.2 P95、首题、失败统计与初始化后启动预算；超限需整改 | 3、5 |
| G4 | 落实：§9 JSON 日志、关联 ID、错误分级、轮转/导出与审计保留分工 | 3–5 |
| G5 | 落实：§3/10/11 安全修复评估和一次补丁重放演练 | 5及升级时 |
| G6 | 落实为设计草案：§14 六张核心表、两张支撑表及必须补充的迁移/事务约束；未声称数据库已验证 | 2、4 |
| G7 | 落实：§10.3 风险、影响、缓解和验证阶段集中登记 | 各阶段 |
| G8 | 调整落实：§8/10.1 观察实际原生 i18n、说明中英文边界，不承诺全站翻译 | 0b、5 |
| G9 | 落实：§8/11 限定桌面 Chrome/Edge 两个尺寸，不继承旧移动端回归 | 5 |
| G10 | 调整落实：§6.4 用版本锁定 Python SDK REST emitter/MCP 或受支持 OpenAPI；不强制 GraphQL 承担通用 ingestion | 0a、1 |
| L1 | 调整落实：§7 服务端 Pydantic + JSON Schema；Python 服务不引入 Zod/Node 服务 | 3 |
| L2 | 落实：§7/10.2 单调用 20 秒、全问 60 秒、至多一次修复/重试；与 P95 分开 | 3 |
| L3 | 落实：§6.2/6.3/7/9/14 prompt 版本、配置与查询证据绑定 | 2、3 |
| L4 | 调整落实：§7 不可信文本隔离、服务端工具权限与安全渲染；不把过滤指令标记当完整防护 | 3 |
| L5 | 落实：§11.2 固定计划 fixtures、规范化比较和失败分类，人工复核边界 | 3 |
| L6 | 更正后落实：§11.1 历史 golden / 独立 Decimal / Cube 三方对账；不称旧实现全为 decimal.js 或 204 测试全覆盖 S001 | 1–3 |
| L7 | 落实：§7 诊断 SQL 来自 Cube /sql；离线参考计算不成为第二运行引擎 | 3 |
| Q1 | 调整落实：§10.1 300 行/5 个既有上游文件，新增功能另计；有界内部组件可用并登记，不假设官方插件 SDK | 0b |
| Q2 | 落实：§10.1 指定条件下三次组件修改到可访问 ≤5 分钟，全量构建另记 | 0b |
| Q3 | 调整落实：§9/10.1 服务端验证身份、CSRF/撤销/伪造头检查，不让浏览器读 HttpOnly cookie 或假设 cookie=JWT | 0b |
| Q4 | 调整落实：§8/10.1 sidecar 优先同源链接；确需 iframe 再验 CSP、身份及返回，不恢复旧消息桥 | 0b |
| Q5 | 调整落实：§6.3/10.1 实测重启/回退与真实目录回执；/meta 不承诺原生配置 hash | 0b |
| Q6 | 落实：§10.1 fork 最多两天，再试 sidecar；0b 总预算 2–4 天 | 0b |
| M1 | 更正后落实：§13 写明 33 条冲突、两处 109 Draft manifest 与另一处 109 Published；联合发布记录/内容/采用绑定判断，不只看外层标签 | 1、2 |
| M2 | 落实：§4.3 命名空间区分两个 C017，禁止按编号混接 | 1、2 |
| M3 | 落实：§13 稳定 ID 引用实际 seed/release/preparation 文件，推荐阈值文档不冒充发布定义 | 2 |
| M4 | 落实：§4.3 T007/T008 身份/时点加 C003 回执，并纳入入口复核 | 1、3、4 |
| M5 | 落实：§4.3/5 区分 C011 请求、C012 确认、C033 场景上下文 | 4 |
| M6 | 落实：§1/9 统一 semantic/query/rules/actions/workbench 五个逻辑模块，一个进程 | 0b–4 |
| M7 | 落实：§4.1 唯一冻结 artifact、文件/列/行/机构/负责人计数及实际 SHA 登记来源 | 1 |
| M8 | 落实：§3 记录 Cube 9 月 28 日最新 tag 与保留 1.7.45 候选理由；0a 再定镜像 | 0a |
| R1 | 调整落实：§7/11 全量 R01 评估和行动阻断分类；553 正向、465/561 负向，不为使三家可行动改规则 | 3、4 |
| R2 | 落实：§4.1 显式 UNIT↔ENT 映射、双向唯一及依据，保留 UNIT 主键 | 1 |
| R3 | 落实：§11.1 只提取同口径纯计算测试；重定价等非首期算法不扩大交付范围 | 1–3 |
| R4 | 调整落实：§10.2 0b 后按实测重估；30–50% 为约 21–39 人日，25–40 是准备预算 | 0b后 |
| R5 | 部分落实：§9 明确后续 sibling repo；§12 本轮仅改方案，不执行提交/删除截图。工程初始化时再核对产物来源，不设为当前阻断 | 后续初始化 |
| R6 | 落实：§11.3 演示预检、备用路径、时间标签和故障时行动限制 | 5及演示前 |

额外修正：保留已确认的 T008 截至时间和 V1 发布记录，区分历史发布与新系统激活；分开创建任务的技术尝试和人工办理；补充投影字段所有权/版本顺序、部署中断恢复、会话撤销校验、R01 专用派生归因和 RETURNED 终态。上述均是明确已有闭环的实现边界，不新增业务中心。

### 本轮 20 项语义修正对应表

本表对应本轮用户清单 1–20，与上表 A/G/L/Q/M/R 编号分开。技术选型、阶段划分和验收体系结构不变；数据身份、哈希、数量及规则口径沿用已核实事实，没有重新解释或重算。清单行号与当前文档不同的，按内容锚点处理。

| 编号 | 所在小节 | 修正要点 |
|---|---|---|
| 1 | §3 | DataHub/Cube 统一为候选基线；区分源码核实与阶段 0 运行复核后锁定 |
| 2 | §1 | 恢复“S001 集团融资成本与债务结构优化”，S001 融资样例仅为简称 |
| 3 | §4.1、§6.1 | 工作簿为不可变源头与对账基准；PG 快照为运行期唯一权威读取源 |
| 4 | §4.1 | 补 V2 的版本 ID、basedOnVersionId、绑定资产与整体观察日；不替换 V1 快照 |
| 5 | §3、§5.1 | 固定 resource_kind 分类标记；PG kind 决定权威依赖集合，目录投影按种类和 release 过滤核对 |
| 6 | §5.1、§6.1 | 补受限执行合同定义及最小字段；按“架构不变”保留 PG 完整合同，Structured Properties/custom aspect 仅为投影，不迁回完整合同 |
| 7 | §5.2 | 统一 ActionType.ruleIds 引用规则的方向；保留原 R01/R02/R03 集合，首期只启用 R01 |
| 8 | §5.2 | 删除未定义“建议方向/建议参数”输入，仅接收合同声明字段 |
| 9 | §5.2 | 定义可信快照的 data_version + source_sha256 + as_of，并保留 curated_hash/质量回执核验 |
| 10 | §5–7、§10–11、§14 | 行动术语统一人工确认/CONFIRMED；计划使用“服务端校验通过”，不增加问数人工确认 |
| 11 | §5.3、§6.3、§14 | 待确认→已确认，同事务创建任务与回执，无持久中间态；激活切换将旧待确认请求置 EXPIRED |
| 12 | §5.3、§11.2、§14 | 待处理→执行中→执行完成/待复核；无凭证不能完成，后续材料须晚于原依据日，未达成/依据不足保持待复核；DDL 同步约束 |
| 13 | §6.2–6.3、§14 | 定义 semantic_release、manifest、deployment_release_id、active release；部署目标 ID 与 release_id 同值，尝试 ID 独立 |
| 14 | §6.2、§11.2、§14 | READY 前核对依赖集合/revision/hash，并发编辑则中止；失败验收补同一场景 |
| 15 | §1、§5.1、§7 | 使用“余额加权平均融资成本”；公式使用“折合人民币余额”并引用原字段 ID |
| 16 | §9 | 核心事实约 6 千行、含扩展资产约 1.2 万行；不将扩展资产自动并入首期输入 |
| 17 | §9 | 单列规则证据读取端点；明确 Cube REST 签名 JWT、服务端凭据及运行鉴权待验 |
| 18 | §10.2、§11.2 | 一次通过率 ≥90% 是进入验收条件；未通过必须澄清/拒绝，不能以错数充通过 |
| 19 | §13 | 冻结 seed 的 Draft 字面命中 168 处，其中 status:Draft 1 处、publicationState:Draft 148 处；与 v1.5 release 的 66 处 status:Draft 分开，不归因于 authoritative-facts.js |
| 20 | §3、§9、§13 | 固定源码确认实体注册、指标开关、Quickstart 清单和 Wren 路径许可；Cube 运行与全栈资源仍待阶段 0 验证 |

本轮只做文档一致性检查和指定上游源码复核；不代表新系统、DDL、JWT 配置或发布流程已经运行通过。未提交、未推送，未修改其他文件。

### 2026-09-29 复核修正与架构来源说明

- §13 及上表第 19 项纠正 seed 的统计口径：168 是 Draft 字面命中数，status:Draft 为 1 处、publicationState:Draft 为 148 处；不能从字面或字段命中数直接推导冲突资源数。business-release.js 的既有计数和路径说明保持不变。
- §5.2 与 §14 将负责人前置明确为“目标主体恰有一位负责人，多主体可共享同一负责人”；不改变既有关系基数和业务数据。
- 权威来源调整发生于 2026-09-28 处理 A1 时，属于相对初稿的实质架构变更。用户当时所附《DATAHUB-REFACTOR-PLAN.md 修订清单》A1 的“修改要求”明确写明：“受限执行合同、Rule/ActionType 完整定义存业务服务 PostgreSQL……DataHub 实体只挂短引用……表单提交目标为业务服务 API。”配套报告 `outputs/v1.5-verification/DATAHUB-PLAN-REVIEW-2026-09-28.md` §3/A1 有同方向建议。此前按用户“结合审查完善方案”的任务落实，来源不是后来的 20 项清单第 6 项，也不单凭 DataHub/Cube/FastAPI/PostgreSQL 四个技术名称推导存储权威。本轮保留这一已落实决策，不再次改变权威来源。

本轮只修改本方案并核对上述计数与指令来源；不代表新系统已部署或验证通过，未提交、未推送，未修改其他文件。
