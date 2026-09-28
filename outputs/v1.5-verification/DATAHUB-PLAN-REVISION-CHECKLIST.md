# DATAHUB-REFACTOR-PLAN.md 修订清单（交 Codex 执行）

目标文件：`designs/prototype-work/v1.5/DATAHUB-REFACTOR-PLAN.md`（2026-09-27 修订版，352 行）
任务性质：**只修订方案文档本体**。不修改原型运行代码、业务数据、`designs/prototype-work/v1.4/`、`designs/prototype-releases/`；不推送、不改分支。
配套评审依据：`outputs/v1.5-verification/DATAHUB-PLAN-REVIEW-2026-09-28.md`
完成后：在方案文首"日期"行追加修订日期，并在文末新增"修订记录"小节，逐项标注已落实的清单项号。

---

## 0. 已核实事实（独立审查实测，可直接采信，不必重查）

1. 源 SHA-256 `83232e2dda913e63d2faa1e45aab824270f4ab5bcb96849a44ab8a03f93db12d`：对冻结副本 `designs/prototype-releases/v1.1.0/data-engineering-prototype-review/review-v3/source-snapshots/融资一览表_一期演示数据.xlsx` 实测 `shasum -a 256` 一致。`authoritative-facts.js:8-17` 另记录 sizeBytes=807264、columnCount=35、rowCount=5218、unitCount=574、institutionCount=24、ownerCount=24、asOf=2025-12-31。
2. 该 SHA **不在** `outputs/v1.5-verification/source-fingerprints.json`（该文件只收录 v1.5 工作区文件哈希）。工作簿在工作区有 **3 份副本**：冻结 v1.1.0 source-snapshots、`designs/prototype-releases/v1.1.0` 目录另一处、`outputs/019fe24f-…/`。
3. `composite/resources/business-release.js`：version.objects(11)/links(10)/metrics(8)/rules(3)/actions(1) **全部 33 条**均为 `publicationState:"Published"` + `status:"Draft"`；另有 validationSnapshot/resourceManifest 109 条 `publicationState:"Draft"`；全文件 66 处 `"status": "Draft"`。
4. 稳定 ID `OBJ-FINANCING-ENTITY`、`ACTION-FINANCING-OPTIMIZATION`、`RULE-HIGH-FINANCING-COST` **不在** `deliverables/新项目功能设计-阶段1本体管理-v0.1.md`（该文档只有业务名与阈值描述，且 :278 明示"推荐演示基线，不得写成生产规则已定版"）；实际定义在冻结 `portfolio-s001-seed.js` 与 v1.5 `business-release.js`/`business-preparation.json`。
5. C017 撞名：新项目台账（`deliverables/新项目功能设计-平台总控台账-v0.1.md:174`）中 C017=「数据可信度与可复现摘要」；但方案 §13 列为本地依据的 `REFACTOR-REVIEW.md:23` 与 `DECISION-CENTER-GUIDE.md:13` 中 "C017" 是 **v1.5 原型自己的审批依据/质量检查**。同编号、不同合同。
6. 台账体系：真正的交付/回执合同是 **C003（精确交付/接收回执，阶段2:101/391）**；T007=数据资产版本、T008=数据截至时间；C011=请求合同、C012=提醒/人工确认合同、C033=场景运行上下文合同。
7. 外部版本（GitHub API 核实，2026-09-28）：DataHub 最新 release **即 v1.7.0.1**（方案选型成立）；Cube **v1.7.45 存在，最新 tag 已到 v1.7.46**。
8. 冻结层用 `UNIT-553/UNIT-465/UNIT-561` 标识主体，`ENT-020/ENT-007/ENT-017` 别名只在 v1.5 `DATA-AND-MAP-SOURCES.md:9-11`。301 条投影分布：UNIT-553×75、UNIT-465×176、UNIT-561×50。
9. 现成对账 golden 值：集团加权成本 `2.3722312046695873`（business-finance-source.json、business-source.json、authoritative-facts.js 三处一致）；单位553 银行归因前三名（欧陆银行 balance 99.586、share 32.75 等）在冻结 authoritative-facts.js；口径实现在 `src/domain.js:218,228` 与 `composite/shared/financing-models.js:30,52`（decimal.js，204 项单测覆盖）。

---

## 1. P0 架构定案（改写正文条款，不是加备注）

**A1 语义编辑权威的落点自相矛盾（§3 / §5 / §6.1）**
- 问题：§6.1 规定"可编辑语义定义的唯一权威来源是 DataHub 中选定实体的定义/配置"、受限执行合同（三类模板、字段引用、R01 双分支、ActionType 前置）存"同一 DataHub 实体"上；但 §3 又承认 Structured Properties 值类型/长度有限、"不能当作 JSON Schema 存储引擎"、custom aspect 是未经 0b 验证的 spike。合同序列化后很可能超长度限制，custom aspect 失败时 §6.1 无落点。
- 修改要求：改写 §6.1 权威来源表第二行及 §5 表格"DataHub 承载建议"列，明确降级架构：**受限执行合同、Rule/ActionType 完整定义存业务服务 PostgreSQL（semantic 配置库，每次发布前导出 git 化文件）；DataHub 实体只挂短引用（release_id、definition_hash、状态）与目录性描述；编辑界面挂在 DataHub 实体详情页，但表单提交目标为业务服务 API**。custom aspect 由"必须通过的 spike"降级为"可选增强"。相应同步修改 §3 第 4 条 bullet 与 §10 阶段 0b 的判据。

**A2 DataHub 草稿无备份/再生机制（§6.1 / §9 infra）**
- 问题：草稿权威在 DataHub（MySQL/OpenSearch），DataHub 数据丢失即草稿丢失；阶段 5 clean reset/seed 也需要草稿来源。
- 修改要求：在 §6.2 发布流程中新增一步："每次发布前将全部草稿定义导出为 git 化文件（`semantic/` 目录 as-code 导出），DataHub 仅是编辑界面而非唯一持久层"；§9 `infra/` 注释补"DataHub 元数据再生策略：ingestion 脚本 + 草稿导出重放，而非依赖 MySQL/OpenSearch 快照"。

**A3 Cube 配置切换机制未定义（§6.2 第 3–6 步、§10 阶段 0b）**
- 问题：发布状态机要求 `CUBE_DEPLOYED → ACTIVE` 与"Cube 配置 hash 回执"，但未写 Cube 如何加载新配置：Cube data models 默认启动时从 schema 文件加载，同一实例不能同时服务两个 release 的同名指标；在途请求排空与切换顺序未定义，重启时长未验证。
- 修改要求：① §6.2 第 5 步改写为显式序列：生成新 schema 目录 → 暂停新请求 → 等待在途回执与 Cube 查询队列排空 → 重启 Cube 容器 → 健康检查 + `/meta` 校验配置 hash → 数据库锁内切换 `active_release` → 恢复；失败恢复旧配置与指针。② §10 阶段 0b 验收新增："Cube 容器重启时长实测 + schema 热加载/dynamic schema 可行性验证；若演示中断超过 2 分钟不可接受，评估 Cube 多实例按 release 前缀路由"。③ §3 Cube 条目补一句"同实例不并行服务两个 active release"。

**A4 "脱敏演示数据"宣称与导入链路脱节（§1 / §10 阶段 1）**
- 问题：§1 说首期是"在脱敏演示数据上真实运行的软件"，但 raw→staging→curated 全链路无任何脱敏步骤、敏感性评估或数据授权声明。工作簿含 574 个真实主体名、24 个机构、24 个负责人姓名与真实金额（总余额约 2.16 万亿元）。
- 修改要求：三选一并写进正文（若无法当场定案，则在 §1 改为"数据敏感性处理策略于阶段 0 前由数据提供方确认"并在阶段 1 验收中列为阻断项）：
  - a) 新增"数据敏感性分级与脱敏"小节：敏感性评估（主体名/负责人/利率）→ 脱敏发生在 staging→curated（raw 层保留原 SHA，curated 层产出脱敏后新指纹）→ 脱敏验证（字段掩码检查）→ manifest 记录两级指纹；
  - b) 显式声明"数据提供方已授权该工作簿用于演示，无需脱敏"，并删除 §1 的"脱敏"措辞；
  - c) 折中：机构名/负责人名以受控映射表存放，展示层用代号。

---

## 2. P1 覆盖缺口（补充章节/条目）

**G1 运营总览缺失（§8）**：REFACTOR-REVIEW 结论是决策中心=事项工作台+运营总览两入口；§8 只规划三个扩展区。修改：§8 表格增加第四行"运营总览"（事项状态分布、受阻项、平均停留阶段；实现边界：并入事项页顶部汇总条或轻量路由，明确"汇总不建第二队列"）。

**G2 分办环节缺失（§5.2）**：旧流程含"研判、决定、分办、承接"；新状态机无分办。修改：在 §5.2 显式声明"首期负责人由已发布 LinkType 映射决定，不提供人工分办；人工分办为后续扩展"，避免被视为遗漏。

**G3 性能预算缺失（§10 阶段 3/5）**：新增验收：问数端到端 P95 ≤15s（含 LLM 计划 + Cube 查询）；演示冷启动 checklist（停机→可演示 ≤10 分钟）；超阈值记录为阶段内不通过项。

**G4 最小可观测性缺失**：新增小节：结构化 JSON 日志；贯穿 query_run→action_request→work_item 的 correlation_id；错误分级与日志保留期；容器日志落盘目录。说明其与审计表分工。

**G5 安全补丁策略缺失（§3）**：版本策略补："固定版本不跟随 master，但上游发布安全修复时启动评估窗口（backport 或整版升级 + fork 补丁重放验证）；补丁重放演练列入阶段 5"。

**G6 核心表 DDL 草案缺失（§5.2）**：新增附录：semantic_release、action_request、action_execution、work_item、query_run、rule_evaluation 六表最小 DDL（幂等唯一键、外键、状态 CHECK 约束、append-only 审计触发器）。

**G7 风险登记表缺失**：新增集中风险表（风险/影响/缓解/验证阶段），至少覆盖：DataHub fork 维护成本、custom aspect 失败、Cube 切换不可原子、LLM 不可用、16GB 内存不足、上游升级破坏补丁、演示当天故障。

**G8 i18n 未提（§8）**：补一句"DataHub 原生界面为英文，新增三区为中文；混合语言体验需向干系人提前说明，DataHub i18n 覆盖度列入 0b 观察项"。

**G9 响应式范围未声明（§10/§11）**：显式声明"首期仅桌面 Chrome/Edge，不做移动端/响应式验收"（把裁剪写成有意决策）。

**G10 元数据发布方式未定（§10 阶段 1）**：明确"阶段 1 发布元数据走业务服务 GraphQL mutations，不引入 datahub CLI ingestion 容器；若改用 CLI 则纳入版本清单"。

---

## 3. P1 LLM 与测试细节（§7 / §11）

**L1** 计划校验位置：LLM 输出的结构化计划必须经 JSON Schema（zod）校验，失败重试 ≤1 次后拒答；校验发生在业务服务，不在前端。
**L2** 超时量化：单次模型调用超时 20s、单问总预算 60s、重试 1 次；补降级触发阈值。
**L3** 提示词版本管理：prompt 模板进 git 并记录变更；§6.2 查询记录字段清单补 `prompt_version`。
**L4** 注入防护：补"用户输入仅作为待解析问题文本，不作为系统指令；解释文本输出前过滤工具调用/指令标记"。
**L5** 20 条自然语言评测的判定方式：固定期望解析结果（指标集合、维度、范围）为 fixtures，自动比对结构化 plan 字段；失败分类统计（解析错/拒答错/数值错）；人工只复核边界案例。否则 90% 首过率无法自动复验。
**L6** 参考对账异构化：期望值不用手写参考 SQL 单一来源，改为三方对账——①历史 golden 值（加权成本 2.3722312046695873、单位553 银行归因前三名，见第 0 节第 9 条）；②pandas/Decimal 从 raw 层独立重算入 CI；③Cube 执行结果。并注明现有 `composite/shared/financing-models.js`、`src/domain.js` 的 decimal.js 实现可提取为参考实现。
**L7** §7 "内部用于对账、诊断的 SQL 可以展示"：明确该 SQL 来自 Cube `/sql` 端点输出，不由业务服务自行拼 SQL，避免两处口径分叉。

---

## 4. P1 0b Go/No-Go 量化（§10 阶段 0b）

现判据为定性（"构建、路由、custom aspect、许可证审查全部通过"）。改为量化预算表，超预算即转 sidecar：
- fork 补丁面：≤300 行 diff、≤5 个文件；只用文档化插件/路由注册 API，不依赖未导出内部组件；
- 前端构建：增量构建 ≤5 分钟（DataHub 前端首次全量构建很慢，直接影响迭代可行性）；
- DataHub 会话传递：session cookie/JWT 读取 + 同源反代转发 + CSRF 全链路实测通过；
- sidecar 兜底：iframe/CSP（X-Frame-Options 同源嵌入）验证，路由注入与 iframe 至少一种通过；
- Cube：重启时长实测 + `/meta` hash 校验（对应 A3）；
- 验证顺序：三路径改串行——先 fork（最高收益），2 个工作日无结论即转 sidecar，不在三路径平均分配时间。

---

## 5. P2 事实与表述修正（逐条改文字）

**M1（§13）** "少数条目存在外层已发布但内层 status=Draft 的历史字段冲突" → 改为"全部 33 条语义资源条目（objects/links/metrics/rules/actions）均存在 publicationState:Published + status:Draft 冲突，另有 109 条校验/manifest 条目为 Draft"；迁移校验规则明确为"以 publishRecordId/publicationState 为准，status 字段仅作历史遗留告警"。

**M2（§4.3 或 §13）** 增加撞名声明："C017 在旧原型决策中心语境与新项目台账中编号相同但合同不同；迁移以台账定义（数据可信度与可复现摘要）为准，旧原型 C017 语义另行映射编号。"

**M3（§13 依据清单）** 明确稳定 ID 来源："OBJ-FINANCING-ENTITY、ACTION-FINANCING-OPTIMIZATION、RULE-HIGH-FINANCING-COST 等稳定 ID 定义在冻结 portfolio-s001-seed.js 与 v1.5 business-release.js/business-preparation.json，不在阶段1设计文档（该文档仅含业务名与推荐阈值）。"

**M4（§4.3）** "T007/T008 数据交付" → "T007/T008 版本身份 + C003 精确交付/接收回执"，并把 C003 回执纳入重读门禁清单。

**M5（§5.2）** "C011/C012/C033 请求合同" → "C011 请求合同、C012 提醒/人工确认合同、C033 场景运行上下文合同"。

**M6（§9 目录树）** `service/ # semantic/query/rules/actions 四个模块` → 补 `workbench/`（最小决策工作台），与 §1 的五个模块一致。

**M7（§4.1 manifest）** 明确：唯一受控 artifact = 冻结 `designs/prototype-releases/v1.1.0/…/source-snapshots/融资一览表_一期演示数据.xlsx`（工作区另有 2 份副本不作为导入输入）；期望值除 SHA、5,218 行、574 主体外，补 sizeBytes=807264、columnCount=35、24 机构、24 负责人；注明 SHA 的登记位置在 business-finance-source.json / authoritative-facts.js 等业务资源，而非 source-fingerprints.json。

**M8（§3）** Cube 版本：注明"核对日期 2026-09-28，上游最新 tag v1.7.46"，说明取 v1.7.45 的理由或直接升到 v1.7.46。

---

## 6. P2 迁移与排期细化

**R1（§7/§11）** R01 评估范围显式化：R01 在全量 5,218 行快照上运行，输出命中清单 + 每主体阻断原因分类（缺负责人/缺机构/证据就绪）；行动入口只对"证据就绪"子集开放，三家演示主体必须位于其中。
**R2（§4.1）** UNIT↔ENT 映射作为显式迁移工件：冻结层用 UNIT-553 等标识、ENT 编码只在 v1.5 composite；三行映射（UNIT-553→ENT-020 等）建审计表 + 唯一约束，因银行归因 golden 值锚定 UNIT-553。
**R3（§11/§12）** 复用既有口径测试：`tests/` 与 `composite/tests/` 的加权成本/重定价单测纯计算部分可提取为参考实现，不从零写期望值。
**R4（§10 排期）** 保留 16–26 天区间但补两点：① 0b 后重估设量化触发输入（补丁行数、构建时长、custom aspect 结论）；② 注明区间未含 fork 迭代与 LLM 评测集建设的典型超支，建议预留 30–50% 缓冲（现实区间约 25–40 人日）。
**R5（§12）** 工作区卫生三项：① 本方案文档先提交到 `codex/prototype-v1.5.0`（不推送）；② `designs/prototype-work/v1.5/undefined/` 是脚本把 undefined 当路径写入的错误产物（7 张截图），阶段 0 前移除或移出 git 跟踪；③ §9 目录树显式标注"位于新 sibling repo，不在当前 v1.5 目录"。
**R6（§11）** 演示预案：新增演示前 checklist（模型接口连通、容器健康、数据对账快跑、备份数据在场）与模型接口不可用时的降级演示路径（展示已保存结果并标注非实时，遵守 §7 不冒充原则）。

---

## 7. 修订后自查清单

1. §1/§3/§5/§6.1/§6.2/§9/§10-0b 对"语义定义与执行合同的存储位置、编辑进程、提交目标"的表述完全一致，无残留"DataHub 是可编辑权威+合同存 DataHub 实体"的旧句子。
2. §6.2 发布流程包含：草稿 git 导出（A2）、Cube 重启切换序列（A3）、prompt_version 字段（L3）。
3. 全文检索 "C017"、"脱敏"、"少数条目"、"T007/T008"、"四个模块"、"v1.7.45" 确认已按 M1–M8 修订。
4. §8 有运营总览；§5.2 有分办声明；§10/§11 有性能预算、桌面-only 声明、Go/No-Go 量化表。
5. 附录 DDL 与风险登记表存在且与 §5.2/§6.2 字段清单一致。
6. 文末"修订记录"小节逐项列出已落实的 A/G/L/Q/M/R 编号；未落实项写明原因与计划时间。
