# DATAHUB-REFACTOR-PLAN.md 修订版复审（2026-09-28）

复审对象：`designs/prototype-work/v1.5/DATAHUB-REFACTOR-PLAN.md`（2026-09-28 修订版，673 行，较上版 352 行重写扩充）。
复审方法：对照《修订清单》（A/G/L/Q/M/R 共 42 项）逐项核对正文落实情况；对修订新增的全部事实断言做实测验证（冻结 seed 解析、台账/阶段2 文档、business-release.js JSON 解析计数、v1.1.0 提取实现检索）。只读复审，未修改方案。

## 1. 复审结论：通过

- 42 项清单条目中 **41 项已按建议或经合理调整落实**；R5 有意部分暂缓且在 §12 如实声明（符合"本次只修订文档"的范围与 AGENTS.md 约束）。
- 修订新增的**全部具体事实断言经实测属实**（见 §2）。
- 修订版还**纠正了原评审的一处错误**（A4 数据敏感性）：台账 D005（:219）明确"演示数据基于《融资一览表脱敏版.xlsx》；金额随机填充、单位名称脱敏；用户明确要求；生效"，阶段2:862 明确"脱敏值已固化、不得再次随机化"。原评审"574 个真实主体名/真实金额"断言不成立，方案的更正有据，处置方式（不把本轮导入说成新做脱敏、不虚构外部授权、新数据接入另定要求）优于原清单的三个选项。
- 若干调整比原建议更准确：L1 改用 Pydantic+JSON Schema（Python 栈正确适配，不为复用 zod 引入 Node）；G10 改用进程内 DataHub Python SDK REST emitter（MCP）/OpenAPI，不强制 GraphQL 也不加 CLI 容器；A3 指出 Cube `/meta` 不提供 schema hash 回执、hash 由部署器核验（并引 S17 v1.7.46 源码佐证）——修正了原建议中"/meta 校验 hash"的不精确表述；M1 给出比原评审更精确的三路径 109/109/109 分布；L6 修正了原评审对 `src/domain.js`/`financing-models.js`/204 项测试范围的过度概括。
- §14 DDL 附录技术复核通过：partial unique index（one_active_release/one_open_business_item/one_success_per_request）语法正确；所有复合外键的目标列均有对应唯一约束；不可变触发器（release content guard、completed query guard、append-only guards）与 §6.2"状态/回执可更新、内容不可变"的叙述一致；已声明缺失表（data_snapshot/import_receipt/identity_alias/部署尝试/单例控制）与"设计草案非可运行迁移"的定位。

## 2. 新增事实断言核验记录（全部属实）

| 断言（方案位置） | 实测证据 |
|---|---|
| §4.1 T008 确认记录 confirmedAt=2026-08-16 08:23:12、confirmedBy=数据工程账号、依据"S001 一期业务数据工作簿及用户确认"、绑定 2025-12-31 | 冻结 portfolio-s001-seed.js t008Confirmation 原文一致 |
| §4.1 V1 发布时间 2026-08-16 08:28:31、发布记录 record-MSVJM48S-TP2Z；快照 T002-FINANCE-WORKBOOK-83232E2DDA91 | seed 中 publishedAt=08:28:31、record-MSVJM48S-TP2Z、sourceChain 首项 T002-… |
| §4.2 D005 脱敏、阶段2"不得再次随机化"、源提取用"演示单位/演示机构" | 台账:219、阶段2:862/176-177；"演示单位/演示机构"见于 v1.1.0 review-v3/portfolio-integration.js、fixtures.js |
| §4.1 三家"原主规则" R01/R02/R03（553/465/561，75/176/50 笔） | authoritative-facts.js：单位553 ruleCode R01（双支路命中）、单位465 R02 浮动占比>80% loanCount 176、单位561 R03 短期占比>30% loanCount 50 |
| §7 R01 语义"或"、严格大于、2.75% 阈值；UNIT-465/561 为 R01 负向案例 | 冻结条件原文"高于集团基准 0.25 个百分点，**或**高成本融资余额占比大于 20%（高成本阈值 2.75%）"；465/561 的 highCost 均为 0 |
| §7 银行归因公式 Σ余额×max(利率−基准−0.25pp,0)、双支路排序 | seed bankRanking 原文："仅由单位成本支路命中时，按各机构正向增量利息成本 Σ余额 × max（当前利率 - 集团基准 - 0.25 个百分点，0）降序取前三；两条支路同时命中时按高成本融资余额贡献排序" |
| §11.1 集团成本 2.3722312046695873%、余额 21,613.387 亿元；欧陆银行 99.586/32.75435059318048（占问题余额） | authoritative-facts.js 三处一致 + balanceYuan 2,161,338,700,000；欧陆银行条目含 balance 99.586、share 32.75435059318048、cost 2.994…、count 16 |
| §13 顶层 33 条 publicationState:Published + status:Draft；validationSnapshot.resourceManifest 109 Draft；releaseEnvelope 109 Draft；resourceManifestSnapshot.resources 109 Published；全文 66 处 status:Draft | JSON 解析实测：33/33、109 Draft/0 Published、109 Draft、109/109 Published/0 Draft、66 处——全部吻合 |
| §13 V2 记录 record-MTUWMQFX-UI1U"尚未切换正式数据" | business-release.js records[] 原文："语义版本已发布……尚未切换正式数据"，status 成功 |
| §3 Cube 最新 tag v1.7.46、DataHub v1.7.0.1 仍最新 | GitHub API 复核（2026-09-28）一致 |

## 3. 清单落实情况（对照 §15 修订记录复核正文）

A1 ✓（§1/§3/§5.1/§6.1 全文一致，无"DataHub 为可编辑权威"残留句）；A2 ✓（§6.2 步骤3 导出+export_hash、§6.4 再生与人工元数据另备份）；A3 ✓（§6.3 专节：互斥、排空 60s 超时、只读挂载重启、部署器回执、锁内切换、≤120s 目标、0b 实测、失败回退与中断恢复）；A4 ✓（以 D005 更正方式解决）；G1–G10 ✓（运营总览并入事项页顶部汇总、分办暂缓声明、P95/冷启动预算、JSON 日志与 correlation_id、安全补丁窗口+补丁重放、DDL 附录、风险表 8 行、i18n 0b 观察、桌面双尺寸、SDK MCP emitter）；L1–L7 ✓（含加强：注入防护"仅过滤标记不构成防护"）；Q1–Q6 ✓（§10.1 量化表+硬门槛区分）；M1–M8 ✓（全部实测吻合）；R1–R4、R6 ✓；R5 部分（提交/清理暂缓，见下）。

自查六项：①语义权威表述全文一致 ✓；②§6.2/6.3/§14 含导出、切换序列、prompt_version ✓；③关键词"C017/脱敏/少数条目/T007/T008/四个模块/v1.7.45"均已按 M 系修订 ✓；④运营总览/分办/性能/桌面/量化表 ✓；⑤DDL 与风险表存在且与正文一致 ✓；⑥§15 修订记录逐项列 A/G/L/Q/M/R 及验证阶段 ✓。

## 4. 遗留事项（不阻断，均为操作类）

1. **方案文档仍 untracked**（`git status` 显示 `?? designs/prototype-work/v1.5/DATAHUB-REFACTOR-PLAN.md`）。方案自身声明"此次不自动提交"是合理范围决策，但建议由用户执行一次提交到 `codex/prototype-v1.5.0`（不推送），避免 673 行定稿仅存在于工作区。
2. **`designs/prototype-work/v1.5/undefined/` 截图目录**仍在。方案已声明"工程初始化时先查明来源再处理、新项目不复制"，建议在阶段 0a 前完成一次处置，避免长期滞留。
3. 工程意义上无其他阻断项：0b 前应定案的 A1–A4 均已在文档层面定案，其工程验证（Cube 重启实测、会话传递、i18n、补丁面）按方案归入 0a/0b 执行。

——复审完毕。修订版可作为进入阶段 0a/0b 的基线方案；后续以 0b 实测结果触发排期重估。
