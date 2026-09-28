# DATAHUB-REFACTOR-PLAN.md 全面评审（2026-09-28）

审查对象：`designs/prototype-work/v1.5/DATAHUB-REFACTOR-PLAN.md`（2026-09-27 修订版，352 行）。
审查方法：逐项核对方案对本地文件、冻结基线、交付物合同、各分支（main / codex/prototype-v1.2.0-composite / v1.3.1-composite / review-v1.4-ux / v1.5.0）与外部上游版本的断言；只读审查，未修改方案与原型代码。
性质：方案评审与完善建议；本文件不含新运行证据。

## 1. 总体结论

方案质量高于常见重构方案：数据事实断言经实测几乎全部属实，边界设计（先边界后页面、效果与办理分离、发布状态机、幂等、证据链 hash）完整且与 REFACTOR-REVIEW.md 的结论基本一致。外部版本断言可核查且准确：GitHub 当前 DataHub 最新 release 即 `v1.7.0.1`，Cube `v1.7.45` 存在（最新已到 `v1.7.46`）。

主要改进空间集中在四类：
1. **两处架构内在矛盾**（语义编辑权威的落点、Cube 配置切换机制）——若不在 0b 前解决，阶段 2/6.2 的发布状态机工程上无法落地。
2. **一个合规性缺口**：方案宣称"脱敏演示数据"，但导入链路没有任何脱敏步骤或数据敏感性声明。
3. **若干覆盖缺口**：运营总览、性能预算、可观测性、DataHub 草稿备份、安全补丁策略、i18n、DDL 草案、风险登记表。
4. **事实表述修正**：C017 撞名、"少数条目 Draft"低估规模、稳定 ID 归属、C003 遗漏、§1 五模块与 §9 四模块不一致。

## 2. 事实核对结果

### 2.1 已核实属实

| 方案断言 | 核实证据 |
|---|---|
| 源 SHA-256 `83232e2d…93db12d`、5,218 行、574 主体、2025-12-31 | 实测 `shasum -a 256` 于冻结 `designs/prototype-releases/v1.1.0/…/source-snapshots/融资一览表_一期演示数据.xlsx` 结果一致；`authoritative-facts.js:8-17`（另记录 sizeBytes=807264、columnCount=35、institutionCount=24、ownerCount=24） |
| S001 基线 `ONT-GROUP-FINANCING-OPTIMIZATION` / V1 `semantic-MSVJM48O-VJC6` / `FIN-ASSET-20251231-v02` | 冻结 `portfolio-s001-seed.js` publishedVersions/bindings 命中 |
| `business-finance-source.json` 301 条、summary 却写全量 5,218 | records=301（UNIT-553×75 / UNIT-465×176 / UNIT-561×50），summary.loanCount=5218 |
| 三家别名 ENT-020↔单位553、ENT-007↔单位465、ENT-017↔单位561 | `DATA-AND-MAP-SOURCES.md:9-11` |
| V2 绑定 `V14-ENTERPRISE-VIEW-666586EEFA71`、金融 asOf 与全景 asOf 不同 | `business-source-manifest.json` asOf 2026-08-15；金融事实 2025-12-31；版本号即 business-source.json SHA 前 12 位 |
| 企业地图 `DATA-V14-20251231-DEMO-1` / `ONT-ENTERPRISE-FINANCE-RISK-1.4` 含 84 笔构造贷款 | `public/data/portfolio.json`、README.md:91 |
| `finance-contract-assets.json` 301 合同 + 5,218 可比 | 两资产 rows 实测一致 |
| 24 个月历史为独立虚构演示 | `finance-history-demo.json` classification=SIMULATED_HISTORY_CALIBRATED、504 行 |
| R01（>基准 0.25pp 或高成本占比>20%）、R02、R03 阈值与机构归因双支路 | `deliverables/新项目功能设计-阶段1本体管理-v0.1.md:262-284`（并明确"推荐演示基线，不得写成生产规则已定版"——方案 §13 的谨慎表述正确） |
| 加权成本公式与实现位置 | 阶段1:263 定义；`src/domain.js:218,228`、`composite/shared/financing-models.js:30,52` 实现；2.3722312046695873 在三个文件一致 |
| T019/T007/T008/C017/C011/C012/C033（新项目台账义）全部真实存在 | `deliverables/新项目功能设计-平台总控台账-v0.1.md`（C011 三道安全门、C012 确认、C033 场景上下文，定义与方案用法一致） |
| `.kimi/` 无审查文件 | 仅 `skills/ui-refactor/SKILL.md`（技能定义） |

### 2.2 有出入或需修正的表述

| # | 方案表述 | 实测情况 | 建议 |
|---|---|---|---|
| M1 | §13 "少数条目存在外层已发布但内层 status=Draft" | `business-release.js` 中 version.objects/links/metrics/rules/actions **全部 33 条**均为 publicationState:"Published"+status:"Draft"；另有 validationSnapshot/resourceManifest 109 条 Draft；共 66 处 `"status": "Draft"` | 改为"全部 33 条语义资源存在该冲突"；迁移校验规则明确为"以 publishRecordId/publicationState 为准，status 字段仅作历史遗留告警" |
| M2 | §4.3/§6.2 引用 C017 作为"质量/消费门禁" | 属实，但方案 §13 列为依据的 REFACTOR-REVIEW.md:23 与 DECISION-CENTER-GUIDE.md:13 中 "C017" 是 **v1.5 原型自己的审批依据/质量检查**，编号相同、合同不同 | 在 §4.3 或 §13 增加一句撞名声明："C017 在旧原型与新项目台账中编号相同但含义不同，迁移以台账定义为准并重新映射" |
| M3 | §5.1/§13 暗示稳定 ID 来自阶段1文档 | `OBJ-FINANCING-ENTITY`/`ACTION-FINANCING-OPTIMIZATION` 等稳定 ID **不在** deliverables/阶段1（只有业务名）；实际定义在冻结 `portfolio-s001-seed.js` 与 v1.5 `business-release.js`/`business-preparation.json` | §13 依据清单中明确稳定 ID 的实际来源文件 |
| M4 | §4.3 "T007/T008 数据交付" | 台账体系中真正的交付/回执机制是 **C003（精确交付/接收回执）**；T007/T008 只是被交付的版本与截至时间 | 沿用合同时把 C003 回执纳入重读门禁 |
| M5 | §5.2 "C011/C012/C033 请求合同" | 严格说只有 C011 是请求合同；C012 是提醒/确认合同；C033 是场景上下文合同 | 改为"C011 请求合同、C012 确认合同、C033 场景上下文合同" |
| M6 | §1 五个模块（含最小决策工作台） vs §9 目录注 "service/ # semantic/query/rules/actions 四个模块" | 文档内部不一致 | §9 补 `workbench/`（决策工作台）模块，与 §1 统一 |
| M7 | §3/§4.1 未说明 SHA 登记位置 | `outputs/v1.5-verification/source-fingerprints.json` **不含**工作簿 SHA（只收录 v1.5 工作区文件）；工作簿在工作区有 **三份副本**（冻结 v1.1.0 source-snapshots、v1.1.0 目录、outputs/019fe24f-…/） | manifest 明确唯一受控 artifact = 冻结 source-snapshots 副本；把 sizeBytes=807264、columnCount=35、24 机构/24 负责人一并写入期望值 |
| M8 | §3 "Cube 可选 v1.7.45" | v1.7.45 存在；上游最新已到 **v1.7.46** | 版本清单记录核对日期与最新 tag，说明取 v1.7.45 而非 v1.7.46 的理由（或直接升到 v1.7.46） |

## 3. 架构内在矛盾（P0，建议 0b 前定案）

### A1. 语义编辑权威的落点自相矛盾（§3 vs §5 vs §6.1）

§6.1 说"可编辑语义定义的唯一权威来源是 DataHub 中选定实体的定义/配置"，且受限执行合同（三类模板、字段引用、R01 双分支、ActionType 前置、幂等键规范）存"同一 DataHub 实体"上；但 §3 又承认 Structured Properties"不能当作 JSON Schema 存储引擎"、长度有限、custom aspect 是未经 0b 验证的 spike。R01 双分支 + ActionType 前置 + 指标合同序列化后很可能超过 Structured Properties 实际长度限制，custom aspect 失败时整个 §6.1 权威设计无落点。

**建议**：明确降级架构并改写 §6.1——**受限执行合同、Rule/ActionType 完整定义存业务服务 PG（semantic 配置库，git 导出）；DataHub 实体上只挂短引用（release_id、definition_hash、状态）与目录性描述；编辑界面挂在 DataHub 实体详情页（§5 的"配置面板"），但表单提交目标为业务服务 API。**这样 custom aspect 从"必须通过"降为"可选增强"，0b 风险面减半；同时解决 A2 的草稿备份问题。

### A2. DataHub 草稿无备份/再生机制（§6.1）

把草稿权威放在 DataHub（MySQL/OpenSearch）意味着 DataHub 数据丢失即草稿丢失；阶段 5 的 clean reset/seed 也需要草稿来源。**建议**：规定"所有草稿定义在每次发布前导出为 git 化文件（`semantic/` 目录 as-code 导出）"，DataHub 只是编辑界面而非唯一持久层；或按 A1 直接把草稿放业务服务库。

### A3. Cube 配置切换机制未定义（§6.2 第 3–6 步）

发布状态机要求 `CUBE_DEPLOYED → ACTIVE` 与"Cube 配置 hash 回执"，但未写 Cube 如何加载新配置：Cube data models 默认启动时从 schema 文件加载，同一实例不能同时服务两个 release 的同名指标。方案隐含"短维护窗口重启 Cube"，但未定义在途请求排空与切换顺序，也未验证重启时长。

**建议**：
1. §6.2 第 5 步改写为显式序列：生成新 schema 目录 → 停新请求 → 等待在途回执与 Cube 查询队列排空 → 重启 Cube 容器 → 健康检查 + `/meta` 校验 hash → 数据库锁内切换 `active_release` → 恢复；失败恢复旧配置与指针。
2. **0b 验证项增加"Cube 容器重启时长实测 + schema 热加载 / dynamic schema 可行性"**；若演示中断不可接受（>2 分钟）再评估 Cube 多实例按 release 前缀路由。没有此项，阶段 2 的发布状态机无法工程化落地。

### A4. "脱敏演示数据"宣称与导入链路脱节（§1 vs §10 阶段 1）

§1 说首期是"在脱敏演示数据上真实运行的软件"，但 raw→staging→curated 全链路没有脱敏步骤、敏感性评估或数据授权声明。原始工作簿含 574 个真实主体名、24 个机构、24 个负责人姓名与真实金额（总余额约 2.16 万亿元）。

**建议**（三选一，写进方案）：
- 若数据敏感：新增"数据敏感性分级与脱敏"小节——敏感性评估（主体名/负责人/利率）→ 脱敏发生在 staging→curated（raw 层保留原 SHA，curated 层产出脱敏后新指纹）→ 脱敏验证（字段掩码检查）→ manifest 记录两级指纹；
- 若数据已获演示授权：在 §1 和 §4.1 显式声明"数据提供方已授权该工作簿用于演示，无需脱敏"，删除"脱敏"措辞以免验收时无法自证；
- 折中：机构名/负责人名以映射表受控存放，展示层用代号。

## 4. 覆盖缺口（P1，建议补充章节/条目）

| # | 缺口 | 建议 |
|---|---|---|
| G1 | **运营总览页缺失**：REFACTOR-REVIEW 的结论是决策中心 = 事项工作台 + 运营总览两入口；§8 只规划三个扩展区 | §8 增加第四个轻量区域（或并入事项页顶部汇总条）：事项状态分布、受阻项、平均停留阶段；明确"汇总不建第二队列" |
| G2 | **"分办"环节缺失**：旧流程含"研判、决定、分办、承接"；§5.2 状态机无分办 | 若首期负责人由 LinkType 映射决定，在 §5.2 显式声明"首期不提供人工分办，作为后续扩展"，避免评审者视为遗漏 |
| G3 | **性能预算缺失** | §10 阶段 3 验收加：问数端到端 P95（建议 ≤15s，含 LLM 计划 + Cube 查询）、演示冷启动 checklist（停机→可演示 ≤10 分钟）。8–10 分钟演示里单次问数 >30s 会破坏叙事 |
| G4 | **最小可观测性缺失** | 补一节：结构化 JSON 日志；贯穿 query_run→action_request→work_item 的 correlation_id；错误分级；日志保留期。审计表有了，但"重启后仍可读取"的排障需要应用日志 |
| G5 | **安全补丁策略缺失**：固定版本不跟 master，长期锁定会累积 CVE | 版本策略补一句："上游发布安全修复时的评估窗口（backport 或整版升级 + 补丁重放验证）"；fork 补丁应设计为可重放（rebase 演练列入阶段 5） |
| G6 | **核心表 DDL 草案缺失** | §5.2/附录给出 semantic_release、action_request、action_execution、work_item、query_run、rule_evaluation 六表最小 DDL（幂等唯一键、外键、状态 CHECK 约束、append-only 审计触发器），评审与阶段 2/4 实施直接对表 |
| G7 | **风险登记表缺失**：风险散布各节 | 集中一张表（风险/影响/缓解/验证阶段）：DataHub fork 维护成本、custom aspect 失败、Cube 切换不可原子、LLM 不可用、16GB 内存不足、上游升级破坏补丁、演示当天故障 |
| G8 | **i18n/语言一致性未提**：DataHub 原生界面英文，新增三区中文 | 对中文演示受众，混合语言体验需向干系人提前说明或评估 DataHub i18n 覆盖（并入 0b 观察项）；这是演示接受度风险 |
| G9 | **响应式门禁缺失**：v1.5 有 93 项响应式检查，新方案无 | 显式声明"首期仅桌面 Chrome/Edge，不做移动端验收"，把范围裁剪写成有意决策 |
| G10 | **元数据发布方式未定**：阶段 1"发布元数据"未写走 GraphQL 还是 datahub CLI ingestion | 建议走业务服务 GraphQL mutations，避免新增 ingestion 容器/CLI 版本项；若用 CLI 则纳入版本清单 |

## 5. LLM 与测试细节（P1）

| # | 问题 | 建议 |
|---|---|---|
| L1 | §7 未写结构化计划的校验与重试位置 | LLM 输出必须经 JSON Schema（zod，原型已在用）校验；失败重试 ≤N 次（建议 1 次）后拒答；校验发生在业务服务，不在前端 |
| L2 | 超时/限流未量化 | 单次模型调用超时（建议 20s）、总预算（建议 60s）、重试 1 次；降级路径已有，补触发阈值 |
| L3 | 提示词版本管理 | prompt 模板进 git、变更记录 changelog；plan_hash 已有，补 prompt_version 字段进查询记录 |
| L4 | 提示注入面 | 补一句："用户输入仅作为待解析问题文本，不作为系统指令；解释文本输出前过滤工具调用/指令标记"；计划白名单已限制行为，答案解释环节仍需防注入回显 |
| L5 | §11 的 20 条自然语言评测未定义判定方式 | 固定期望解析结果（指标集合、维度、范围）为 fixtures，自动比对结构化 plan 字段；失败分类统计（解析错/拒答错/数值错）；人工只复核边界案例。否则 90% 通过率无法自动复验 |
| L6 | "独立参考 SQL"易同源同错 | 期望值用异构技术栈离线计算：现有原型 `composite/shared/financing-models.js`、`src/domain.js`（decimal.js，204 单测覆盖口径）与冻结 `authoritative-facts.js` 的单位553 银行归因前三名（欧陆银行 share 32.75 等）都是现成 golden 值；再用 pandas/Decimal 从 raw 层独立重算入 CI。三方对账：历史 golden 值 / 离线重算 / Cube 执行 |
| L7 | §7 "内部用于对账、诊断的 SQL 可以展示" | 明确该 SQL 来自 Cube `/sql` 端点输出，不由业务服务自行拼 SQL，避免两处口径分叉 |

## 6. 0b Go/No-Go 量化标准（P1，现为定性判据）

§10 0b 是全方案唯一的 Go/No-Go 门，但判据只有"构建、路由、custom aspect、许可证审查全部通过"。建议量化，超预算即转 sidecar，防止 0b 无限延长：

| 维度 | 预算建议 |
|---|---|
| fork 补丁面 | ≤300 行 diff、≤5 个文件；只用文档化插件/路由注册 API，不依赖未导出内部组件 |
| 前端构建 | 增量构建 ≤5 分钟（DataHub 前端首次全量构建很慢，直接影响迭代可行性） |
| DataHub 会话传递 | session cookie/JWT 读取 + 同源反代转发 + CSRF 全链路实测 |
| sidecar 兜底 | iframe/CSP 验证（X-Frame-Options 同源嵌入）、路由注入两种方式至少一种通过 |
| Cube | 重启时长实测 + `/meta` hash 校验（见 A3） |
| 0b 内验证顺序 | 三路径改串行：先 fork（最高收益），2 天无结论即转 sidecar，不在三路径上平均分配时间 |

## 7. 迁移与范围细化（P2）

| # | 建议 |
|---|---|
| R1 | **R01 评估范围显式化**：验收题 5 隐含全集团 574 主体；行动前置"负责人唯一、银行关系完整"会大量阻断（正确行为）。建议明确：R01 在全量快照上运行，输出命中清单 + 阻断原因分类（缺负责人/缺机构/证据就绪）；行动入口只对"证据就绪"子集开放，三家演示主体必须位于其中 |
| R2 | **UNIT↔ENT 映射是迁移工件**：冻结层用 UNIT-553 等标识，ENT 编码只在 v1.5 composite。三行映射应作为显式迁移工件（审计表+唯一约束），因为冻结权威事实的银行归因 golden 值锚定在 UNIT-553 |
| R3 | **复用既有口径测试**：`tests/` 与 `composite/tests/` 的加权成本/重定价单测可提取纯计算部分作为参考实现，不必从零写期望值 |
| R4 | **排期偏乐观**：加总实际 15.5–26 天（方案写 16–26，无实质问题），但 DataHub fork 迭代、Playwright 环境、Cube schema 生成器、LLM 评测集建设都易超。建议 0b 后重估设量化触发输入（补丁行数、构建时长、custom aspect 结论），并预留 +30–50% 缓冲；更现实的区间约 25–40 人日 |
| R5 | **工作区卫生**：① 方案文档当前 untracked，建议先提交到 `codex/prototype-v1.5.0`（不推送，符合 AGENTS.md），避免丢失；② `designs/prototype-work/v1.5/undefined/`（7 张截图）是脚本把 undefined 当路径的错误产物，建议阶段 0 前移除，避免进 git；③ §9 目录树建议显式标注"位于新 sibling repo，不在当前 v1.5 目录" |
| R6 | **演示当天预案**：§11 有失败场景，但无演示前 checklist（模型接口连通、容器健康、数据对账快跑、备份数据在场）与"模型接口不可用时的降级演示路径"（展示已保存结果并明确标注非实时，遵守 §7 的不冒充原则） |

## 8. 已正确吸收的既有结论（确认无冲突）

先边界后页面（§1.1）、统一事项工作台不建第二队列（§5.2/§8）、发布不自动切换（§6.2 维护窗口+锁内切换）、效果与办理分离（§1.1-4、依据不足状态）、不按截图复制、单账户不冒充多岗位、人工凭证不自动验证、产品版本与业务数据版本分离（与 README/AGENTS.md 一致）、旧原型退出范围与 v1.4/冻结目录不动（与 AGENTS.md 一致）。Kimi 审查文件确不存在于工作区（`.kimi/` 仅技能定义），方案 §0 行说明字面准确。

## 9. 建议的落实顺序

1. **立即（文档修订，无工程成本）**：M1–M8 表述修正；A1/A2/A3 的架构定案文字；G1/G2/G9 的显式范围声明；R5 的提交与 undefined/ 清理。
2. **阶段 0b 前定案**：A4 脱敏决策（涉及导入管线设计）；G3 性能预算；§6 量化 Go/No-Go 标准。
3. **随阶段 2/4 落地**：G6 DDL；G4 可观测性；L1–L7；R1/R2 迁移工件。
4. **阶段 5 收口**：G5 安全补丁演练；G7 风险登记表终版；R6 演示预案。

——审查完毕。本文件为方案完善建议，未修改 `DATAHUB-REFACTOR-PLAN.md` 本体；如需，可按上述清单直接修订方案。
