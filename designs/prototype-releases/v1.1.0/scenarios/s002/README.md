# S002 预算监督管理独立场景包

S002 已在独立工作树中形成基于 `v1.0.3` 统一壳层的可运行原型、六模块场景闭环和真实运行 Checkpoint。它仍是 `v1.1.0` 的独立场景交付包，不是统一总装版本，也不表示生产部署或业务验收完成。

## 场景身份

- 父基线：`v1.0.3`
- 基线快照：`BSL-S001-V103-DE0119608E26`
- 场景身份：`scenarioId=S002`、`scenarioVersion=S002-v1`
- 分支：`codex/s002-v1.1.0`
- 独立端口：`4332`
- 独占目录：`designs/prototype-work/v1.1.0/scenarios/s002/`
- 数据命名空间：`scenarioId + scenarioVersion + scenarioRunId + module scope`
- 演示账号：单一平台管理员

当前 Checkpoint catalog 是可变索引，指向不可变运行归档。文档更新不得覆盖既有归档；进入合并或验收前应重新执行一次完整运行，生成新的 `scenarioRunId`、代码哈希和 Checkpoint 目录。

## 已实现闭环

1. M02 将 8 份物理工作簿登记为 5 个逻辑数据源的 8 个年度/确认快照，并通过两条独立管道分别发布 `S002-BUDGET-EXEC-v1` 与 `S002-PROJECT-OCC-v1`；`S002-DATA-v1` 仅作为 C003 兼容组合指针。8 个快照均可查看和同源下载，历史只读恢复只接受同轮 Owner State，并按不可变资产身份恢复管道、资产和画布证据。
2. M01 形成 7 类预算对象、62 项属性、8 条关系、9 项 Metric、5 项 Rule、6 类 Action Type、Published 本体和 `T019-S002-v1`；数据消费上下文联合展示双资产、双管道、C003、C033、目标 Draft 与 T019 证据。
3. M03 运行 6 个固定预算问题、规则检查和 `C018-S002-v1` 结果视图，消费 97 项 Published 语义资源，并保留文字、表格、BI 三种结果视图及 Agent/Skill/Tool 详情；混合金额与比例的答案采用独立量纲 BI 分面，表格列与逐题业务语义保持一致。
4. M04 保留 v1.0.3 决策中心页面和六类 Published Action Type 的能力定义，但当前 S002 运行范围不生成 Action Request、决策提醒或平台内待办；`actionPolicy=disabled-for-s002-current-scope`，决策摘要为 `no-runtime-actions`。
5. M03、M05 和 M06 只展示预算查询、异常解释、建议核查方向和证据下钻，不提供行动申请入口，也不把 Rule 命中或分析关注包装成已提交决策事项。
6. M05 运行预算异常分析 Agent 与预算报告草稿 Agent 的受约束轻量编排；两条完成运行固定证据包、Published 语义、双数据资产、Prompt、Skill 和 Tool 追溯快照。
7. M06 形成“变动成本执行率、项目立项余额、差旅费分析、跨年计提差异、年末采购/预算占用集中度、供应商/人月成本”六专题预算驾驶舱。每个专题均先展示用户可理解的判定图例和单位/供应商汇总，再行内展开到具体项目、科目、期间、金额、占比和数据标识；Dashboard Version 可发布，报告始终保持 `draft`，未形成 T049 正式报告。报告自动核验覆盖 426 项适用检查、58 项事实与 66 个呈现锚点。

六类 Action Type 显示名为：预算执行整改、下一年度预算合理性复核、费用管理优化核查、预算申报依据补充、采购占用清理、供应商价格复核。它们只作为 M01 Published 语义能力定义保留；当前运行没有请求、确认、拒绝或待办实例。预算调增、预算调减、科目调剂、申报退回和占用释放仅作为被禁用的下游兼容别名。

当前跨模块权威 Action Type ID 依次为 `ACT-BUDGET-EXECUTION-RECTIFICATION`、`ACT-NEXT-YEAR-BUDGET-REASONABLENESS-REVIEW`、`ACT-EXPENSE-MANAGEMENT-OPTIMIZATION-REVIEW`、`ACT-BUDGET-SUBMISSION-EVIDENCE-SUPPLEMENT`、`ACT-PROCUREMENT-COMMITMENT-CLEANUP`、`ACT-SUPPLIER-PRICE-REVIEW`。旧 `ACT-BUDGET-INCREASE` 等 ID 仅通过 `legacyCompatibleId` 接受历史快照输入，当前运行、Rule 路由、决策事项和驾驶舱统一输出新 ID。

## 供应商服务人员人月成本比对

- 适用范围仅为预算申报明细中的 `业务支持费-技术配置`，来源逻辑成员为“技术配置”；不把其他业务支持费、采购物料或差旅费用混入可比组。
- 每条明细的人月成本按 `年度预算净额（万元）×10000 ÷ 服务人月` 计算，币种为人民币、费用为不含税口径；净额和服务人月必须保留来源原值。
- 比较组键锁定 `年度 × 预算二级科目 × 人员分类 × 供应商 × 人员级别 × 币种 × 税率`。部门和项目不进入组键，而是作为同组成员及下钻维度；只有至少涉及两个不同部门的组才具有跨部门可比性。
- 组内倍率为 `最高人月成本 ÷ 最低人月成本`。倍率严格 `>1.2` 才显示异常，倍率恰好等于 `1.2` 不命中。
- M06 先展示供应商与级别组汇总，再穿透到部门、项目、年度预算净额、服务人月、人月成本、币种、税率、组内倍率和数据标识。`SOURCE` 表示净额、人月及维度字段来自技术配置来源记录；人月成本和倍率是基于这些来源字段的公式派生结果，不改写源记录。
- 该异常当前只用于监督展示、证据下钻和建议复核方向。S002 当前范围仍保持 0 个 Action Request、0 个决策提醒和 0 个待办，不自动调用供应商系统或改价。

## 六模块 Owner

| 模块 | Owner 与当前场景资源 | 明确边界 |
|---|---|---|
| M01 本体管理 | 对象、关系、Metric、Rule、Action Type、Published/T019 | 不拥有数据管道、决策状态或报告发布 |
| M02 数据工程 | 5 个逻辑源、8 个快照、两条管道、两个业务数据资产、兼容组合指针和 C017 摘要 | 不计算预算 Metric、Rule 或业务阈值 |
| M03 智能问数 | 预算问数 Agent、Prompt、Skill、运行和确定性结果 | 不直接创建待办或发布报告 |
| M04 决策中心 | 保留提醒、Action Request、C011 门禁、人工确认/拒绝、平台内待办和 C019 的基线能力 | 当前范围不创建运行实例，不自动审批、过账、改写批准预算或派发外部系统 |
| M05 Agent 应用 | 双 Agent Definition/Release/Run/Result 与轻量编排 | 不发布 Metric/Rule，不直接建待办或发布正式报告 |
| M06 报告中心 | Dashboard Version、六专题视图、六类预警、分层明细下钻、六章报告草稿、证据包及确定性自动核验 | Dashboard 唯一归 M06；不复制或拥有 M04 决策真值；历史核验结果不持久化 |

## Checkpoint 与恢复

真实运行按以下节点归档：

- CP01：初始配置；
- CP-PRE：数据接入高风险修改前；
- CP02：数据接入；
- CP03：Published 切换；
- CP04：问数联调；
- CP05：决策触发范围核对；
- CP06：Agent、报告草稿和驾驶舱；
- CP07：端到端联调。

每个 Checkpoint 锁定场景三元身份、代码树哈希、M01—M06 场景适配器版本、v1.0.3 六模块精确路径/版本/treeSha256、Owner 导出与回执、状态分区、证据摘要和副作用策略。

- 历史查看：保留原 `scenarioRunId`，严格只读并拒绝写入。
- 克隆恢复：生成新的 `scenarioRunId`，恢复模块投影，不覆盖历史，外部副作用不重放。
- 隔离回归：生成新的 `scenarioRunId`，只恢复必要前置；历史 Action Request、待办和报告均为零重放，外部能力默认关闭。
- 当前索引：`checkpoints/checkpoint-catalog.json`。
- 运行历史索引：`checkpoints/run-history-catalog.json`。
- 场景包清单：`scenario-package-manifest.json`。
- 不可变归档：`checkpoints/runs/<scenarioRunId>/`。
- 便捷入口：`checkpoints/current/` 目录中的文件级符号链接只指向当前不可变归档；该目录本身不是业务真源，浏览器读取固定使用 `cache=no-store`，避免升版后继续装载旧 runId。

## 本地运行

从独立 S002 工作树根目录执行：

```bash
python3 -m http.server 4332 --directory designs/prototype-work/v1.1.0
```

打开：

```text
http://127.0.0.1:4332/scenarios/s002/index.html?delivery=cp07#home
```

该地址打开当前权威 CP07 的只读全链路版本。当前范围不包含决策事项演练；历史快照始终只读，恢复或回归必须创建新的 `scenarioRunId`。

## 生成与验收

文档或代码发生变化后，先形成新的真实运行归档，再校验和测试：

```bash
node designs/prototype-work/v1.1.0/scenarios/s002/checkpoints/generate-checkpoints.cjs
node designs/prototype-work/v1.1.0/scenarios/s002/checkpoints/validate-checkpoints.cjs
node --test designs/prototype-work/v1.1.0/scenarios/s002/tests/*.test.cjs designs/prototype-work/v1.1.0/scenarios/s002/baseline-adapters/m04/tests/*.test.cjs designs/prototype-work/v1.1.0/scenarios/s002/baseline-adapters/m06/tests/*.test.cjs
```

同时执行语法检查和浏览器走查：

```bash
node --check designs/prototype-work/v1.1.0/scenarios/s002/data.js
node --check designs/prototype-work/v1.1.0/scenarios/s002/state.js
node --check designs/prototype-work/v1.1.0/scenarios/s002/app.js
```

验收至少核对：13 项流程进度、六模块命名空间隔离、5 逻辑源/8 快照/14 成员、两条管道、两个业务数据资产、6 类 Action Type 只作为 Published 能力定义、运行态 0 请求/0 决策提醒/0 待办、驾驶舱无 Action 入口、外部派发全关闭、报告保持 draft、Dashboard 归 M06、六专题规则图例与真实明细下钻、六维筛选、8 份快照文件逐份下载、报告自动核验、CP-PRE 顺序、历史只读、摘要校验、克隆恢复和零副作用隔离回归。

浏览器回归证据位于 `evidence/browser-regression-20260817-final/`：M01—M06 与预算驾驶舱分别在 `1440×900`、`900×900`、`390×844` 三档完成真实 Chrome 走查，共 21 个路由/视口组合；产品控制台错误、页面异常、资源失败和横向溢出均为 0。M04 同时验证完成态、CP07 历史只读和直接访问均保持零事项空态，旧缓存不能恢复行动示例。

本轮六专题专项回归证据位于 `evidence/dashboard-regression-20260817/`：三个视口均逐页签验证汇总行、展开按钮、行内明细表和真实业务记录；差旅费明确“2025实际/2026初始申报”，六类预警名称与中文判定规则一致，产品控制台错误和 404 资源均为 0。

M01—M06 运行入口分别来自各自的 v1.0.3 场景本地基线副本；旧 `module.html/module-app.js` 仅保留为历史证据，不再承载正式运行。M02 已保留真实发布前校验快照；只有定义版本、锁定输入、配置指纹与逐项结果一致时才展示校验证据。

## 合并约束

S002 与 S003、S004 并行开发。场景包不得直接修改公共壳、Foundation、版本文件、统一入口或其他场景目录。后续只能由 integration 工作树受控汇入，并在同一 Origin 下回归 S001 和所有已汇入场景；不得把 S002 的 `scenarioRunId`、业务记录、localStorage 或成功投影复制给 S003/S004。

详细边界见 [IMPLEMENTATION-BOUNDARY.md](./IMPLEMENTATION-BOUNDARY.md)，变更记录见 [CHANGELOG.md](./CHANGELOG.md)。
