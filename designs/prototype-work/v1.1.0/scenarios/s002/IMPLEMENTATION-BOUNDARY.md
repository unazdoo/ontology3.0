# S002 实施、Owner 与合并边界

## 1. 基线与写入范围

S002 只基于 `v1.0.3` 冻结父基线实施，绑定 `BSL-S001-V103-DE0119608E26`。场景分支只拥有 `scenarios/s002/`；不得修改冻结发布目录、公共壳、Foundation、`VERSION.json`、统一注册表、S001 或 S003/S004 场景包。

场景状态必须同时携带：

- `scenarioId=S002`；
- `scenarioVersion=S002-v1`；
- 当前 `scenarioRunId`；
- 模块 scope：`m01`—`m06` 或 `platform`。

重置只清理当前 S002 当前轮次命名空间，并生成新的 `scenarioRunId`。

## 2. 六模块 Owner 边界

| 模块 | 唯一拥有 | 禁止事项 |
|---|---|---|
| M01 | 本体对象、关系、Metric、Rule、Action Type、Published/T019 | 不拥有数据处理运行、Action Request 状态或报告 |
| M02 | 来源、快照、管道、质量、数据资产版本、C017 数据摘要 | 不实现预算公式、阈值、Rule 或 Action 判断 |
| M03 | 预算问数 Agent、Prompt、Skill、Run、结果和 C018 视图 | 不直接写 M04 待办或 M06 报告状态 |
| M04 | 决策提醒、C011 门禁、Action Request、确认/拒绝、内部待办和 C019 | 不派发外部预算系统，不自动审批或过账 |
| M05 | 预算异常分析 Agent、预算报告草稿 Agent 及 C014 轻量编排 | 不发布 Metric/Rule，不直接建待办，不发布正式报告 |
| M06 | Dashboard Version、主题视图、下钻、报告草稿和展示证据 | Dashboard 唯一归 M06；不得复制 M04 决策真值 |

平台层只保存导航、筛选、事件、Checkpoint 引用和只读进度投影，不成为模块业务真值的第二 Owner。

## 3. 数据与语义边界

- 2024/2025 年度下达表示最终批准预算。
- 2025/2026 申报表示部门最初申报。
- 币种为人民币，单位万元，费用不含税；收入源负号表示收益，展示层转正并保留原值。
- 项目余额使用“项目可用立项余额”，不使用合同额。
- 演示补全和修复数据必须保留 `SYNTHETIC_FOR_DEMO`、`CORRECTED` 或 `DERIVED` 标识。
- 8 份物理工作簿按 5 个逻辑数据源管理；不同年度或确认时点只形成快照，不形成新的逻辑数据源。
- 两条 M02 管道分别发布 `S002-BUDGET-EXEC-v1` 与 `S002-PROJECT-OCC-v1`；`S002-DATA-v1` 只是 C003 兼容组合指针，不是第三个业务数据资产。
- M02 只负责数据处理；9 项 Metric、5 项 Rule 和 6 类 Action Type 均由 M01 定义并经 Published 指针消费。

### 3.1 供应商服务人员人月成本边界

- 业务范围仅为 `业务支持费-技术配置`。M02 保存预算申报“技术配置”成员中的年度、部门、项目、预算二级科目、人员分类、供应商、人员级别、币种、税率、年度预算净额和服务人月原子事实，并保留 `SOURCE`；M02 不计算异常阈值或裁决 Rule。
- M01 定义人月成本支持度量和 RULE-005。单条人月成本为 `年度预算净额（万元）×10000 ÷ 服务人月`；比较组键为 `年度 × 预算二级科目 × 人员分类 × 供应商 × 人员级别 × 币种 × 税率`。部门和项目不进入组键，只有至少两个不同部门的组可参与跨部门比较。
- RULE-005 使用 `组内最高人月成本 ÷ 组内最低人月成本`，且只有倍率严格 `>1.2` 才命中；`=1.2` 必须保持正常。该阈值与公式属于 M01 Published 语义，不得下沉为 M02 管道逻辑。
- M03 只能基于 Published 语义查询组汇总和来源明细；M06 负责供应商/人月成本专题、规则图例、组汇总及明细穿透。下钻至少展示部门、项目、年度预算净额、服务人月、人月成本、币种、税率、组内倍率和来源标识。
- `SOURCE` 只证明净额、人月和维度字段来自来源记录；人月成本与最高/最低倍率属于可复算派生值，不得被描述成工作簿原值，也不得覆盖来源记录。
- 当前范围不把供应商比对结果转换为运行态 Action Request。`ACT-SUPPLIER-PRICE-REVIEW` 仅作为 Published Action Type 能力定义保留；M04 仍为零请求、零提醒、零待办，外部供应商系统调用和自动改价均关闭。

## 4. Action Request 与外部系统边界

当前 S002 只保留六类 Published Action Type 的语义能力定义，不设置触发决策中心的运行示例。7 条 Rule 命中和分析关注仅用于监督分析、建议核查方向和证据下钻；跨年计提配对单独保存为质量核验结论，不冒充 Rule，也不转换为 Action：

1. 预算执行整改；
2. 下一年度预算合理性复核；
3. 费用管理优化核查；
4. 预算申报依据补充；
5. 采购占用清理；
6. 供应商价格复核。

M04 仍保留 v1.0.3 的提醒、申请、人工确认/拒绝和待办页面能力，但 S002 当前 Owner State 固定为：

```text
actionPolicy=disabled-for-s002-current-scope
actionRequests=[]
decisionAlerts=[]
todos=[]
decisionSummary.status=no-runtime-actions
```

驾驶舱按六类监督关注展示：

- 预算执行 → 预算执行整改；
- 成本效率 → 费用管理优化核查；
- 项目余额 → 预算执行整改；
- 年末占用 → 采购占用清理；
- 供应商价格 → 供应商价格复核；
- 申报合理性 → 预算申报依据补充。

每张关注卡只允许查看指标口径、Rule/分析依据、建议核查方向和明细证据；不显示行动申请按钮，不提交 C011，也不关联历史请求。平台管理员仍可完成其余演示操作，但本轮不存在需要确认或拒绝的决策事项。

以下能力全部关闭：

- 调用外部预算管理系统；
- 自动执行预算调增、调减或科目调剂；
- 自动退回申报或释放占用；
- 自动触发供应商系统价格复核；
- 自动审批、过账或覆盖最终批准预算；
- 历史 Action Request、通知、审批和待办重放。

预算调增、预算调减、科目调剂、申报退回和占用释放只作为被禁用的下游兼容动作边界保留，不是当前预算管理评价场景的 Action 显示名；系统不自动调用或执行这些动作。

因此“零运行事项”和 `externalDispatch=false` 是验收硬门，而不是临时提示。

M04 场景适配器的运行开关固定为关闭；即使直接访问模块页、查看历史 CP07，或浏览器残留旧 Owner State / 本地缓存，也只能投影 0 请求、0 决策事项和 0 待办。旧事项只存在于不可变历史证据，不得回灌当前运行。

## 5. 报告与 Dashboard 边界

预算驾驶舱唯一归 M06，包含变动成本执行率、项目立项余额、差旅费分析、跨年计提差异、年末采购/预算占用集中度、供应商/人月成本六个专题，并支持年度、单位/部门、科目、项目、期间、异常事项筛选。每个专题都按“指标事实、判定图例、汇总层、明细层”展示，汇总行直接展开具体项目、科目、期间、金额、占比和证据标识，不以空页签或无数据抽屉冒充下钻。

Dashboard Version 可以处于 `published`，但报告保持：

```text
status=draft
formalArtifactPublished=false
t049Ref=null
```

这两个状态不矛盾：发布的是 M06 可消费 Dashboard Version，不是 T049 正式报告。

报告自动核验同样归 M06：核验必须固定报告内容版本、双业务数据资产、Published 本体、T044、C017/C018 与证据锚点。当前事实包包含 58 项事实、426 项适用检查和 66 个呈现锚点。历史快照允许只读内存核验，但不得把结果写回历史状态。

## 6. Checkpoint、恢复与回归边界

`checkpoint-catalog.json` 只是可变当前索引；每次运行写入新的 `checkpoints/runs/<scenarioRunId>/` 不可变目录，禁止覆盖既有运行。`checkpoints/current/` 是便捷目录，其中每个 Checkpoint 文件均为指向当前不可变归档的文件级符号链接；该目录本身不保存第二套业务真值。

- CP01 锁定初始配置。
- CP-PRE 在数据接入高风险操作前形成。
- CP02—CP07 分别锁定数据、Published、问数、决策触发范围核对、Agent/报告/Dashboard 和端到端状态。
- 历史查看保留来源 runId、只读且拒绝写入。
- 克隆恢复创建新 runId，恢复 Owner 状态但不覆盖来源。
- 隔离回归创建新 runId，只恢复数据与 Published 前置，历史 Action、待办和报告均不重放。
- 基线迁移不得原地换父版本；必须创建新的场景版本、运行轮次和迁移对照。

应用级恢复验证仅证明 S002 原型适配器可查看、恢复和回归，不代表生产模块恢复接口、真实组织权限或外部预算系统联通已经完成。

## 7. S003/S004 并行与后续合并

S002、S003、S004 只能在各自 worktree、分支、端口、场景目录和命名空间内并行实施。后续合并遵循：

1. S002 场景包先形成新的完整运行、代码哈希、Checkpoint 和测试证据；
2. 只把 S002 独占目录作为场景增量交给 integration；
3. 公共壳、注册表、共享合同或 Foundation 的变更单独审查，不从场景分支静默带入；
4. integration 在同一 Origin 注册场景并验证切换、返回、重置、恢复和错配拒绝；
5. 每次汇入后回归 S001 及所有已汇入场景；
6. 不复制任何场景的 `scenarioRunId`、localStorage、Action、待办、报告或成功投影给其他场景；
7. S003/S004 的业务资源、数据和 Checkpoint 继续由各自 Owner 和命名空间维护。

独立端口通过不能替代同源多场景负向测试。

## 8. 运行与验收门

推荐顺序：

```bash
node --check designs/prototype-work/v1.1.0/scenarios/s002/data.js
node --check designs/prototype-work/v1.1.0/scenarios/s002/state.js
node --check designs/prototype-work/v1.1.0/scenarios/s002/app.js
node designs/prototype-work/v1.1.0/scenarios/s002/checkpoints/generate-checkpoints.cjs
node designs/prototype-work/v1.1.0/scenarios/s002/checkpoints/validate-checkpoints.cjs
node --test designs/prototype-work/v1.1.0/scenarios/s002/tests/checkpoints.test.cjs
```

浏览器使用端口 4332 打开 `/scenarios/s002/`，完成桌面和移动尺寸下的六模块流程、M04 零运行事项空态、六专题 Dashboard、规则图例、真实明细下钻、历史查看、克隆恢复、隔离回归和定向重置。

合并前必须满足：

- 13 项流程进度可从空状态真实形成；
- M01—M06 只写各自 Owned State；
- 6 类 Action Type 只作为 Published 语义能力定义；当前运行保持 0 请求、0 决策提醒、0 待办，驾驶舱不提供 Action 入口；
- 5 个逻辑数据源、8 个快照、14 个逻辑成员、两条管道和两个业务数据资产均可追溯；8 份快照文件逐份可查看、可下载，下载不写 Owner State、不重跑管道、不生成外部副作用；
- 所有外部派发和历史副作用关闭；
- 报告仍为 draft，Dashboard Owner 为 M06；
- 报告事实包、适用检查和呈现锚点可定位，自动核验可完成，且历史模式不持久化；
- 8 个 Checkpoint、48 份 Owner 回执和代码哈希校验通过；
- S001 与已汇入场景同源回归通过。

上述门通过仍不等于生产部署、外部预算系统联通、正式报告发布或项目业务验收完成。
