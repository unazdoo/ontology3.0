# S002 预算监督管理场景修正与完整回归结果

- 实施基准日：2026-08-15
- 最终复验日：2026-08-17
- 父基线：v1.0.3
- 父基线快照：`BSL-S001-V103-DE0119608E26`
- 场景：`S002 / S002-v1`
- 最终构建：`S002-v1+c47b2b67b663`
- 当前不可变运行：`S002-RUN-20260815155030000-79841356bdf8`
- 当前 CP07：`CP-S002-20260815155930000-f36a5448ef0f`
- 代码树 SHA-256：`c47b2b67b66362d50bad96c74ee634e815b28cd9ee4778cf01cb8731bfe5508f`
- Checkpoint catalog SHA-256：`1dfd6625780f04a32a6fef439b5917195062551871ac83470632d807adfc7fb3`
- 场景包 SHA-256：`c6d0ba715fcd1764bd61f2967a0371d5f32aafd051abc6ed1ba2fa98172a923a`

> `evidence/` 不参与代码树摘要。浏览器截图和本复验记录不会改写不可变 Checkpoint。

## 1. 基线复用与入口

S002 沿用 v1.0.3 统一工作台、品牌、一级导航、模块内部导航、页面骨架、组件、交互和响应式规则。六模块运行入口分别为：

| 模块 | S002 场景入口 |
|---|---|
| M01 本体管理 | `baseline-adapters/ontology-management-review/canvas-first/index.html` |
| M02 数据工程 | `baseline-adapters/data-engineering-prototype-review/review-v3/方案B2.html` |
| M03 智能问数 | `baseline-adapters/intelligent-query-prototype/review-next/conversation-workspace/index.html` |
| M04 决策中心 | `baseline-adapters/m04/decision-center-prototype/index.html` |
| M05 Agent 应用 | `baseline-adapters/m05/agent-application/Agent应用.html` |
| M06 报告中心/驾驶舱 | `baseline-adapters/m06/report-center/review-lifecycle/index.html` |

统一 `module.html/module-app.js` 不再是 M01—M06 正式运行入口。v1.0.3 冻结目录、S001、总控台账、六模块主文档、S003/S004 和 v1.1.0 根级 VERSION/WORKSPACE 均未修改。

## 2. 全链路结果

| 模块 | 完成结果 | Owner 边界 |
|---|---|---|
| M02 | 5 个逻辑数据源、8 个年度/时点快照、2 条管道、20/20 质量检查、2 个正式场景数据资产 | 只处理来源、修正、质量和资产版本；不持有指标公式或 Rule 阈值 |
| M01 | 7 Object、8 Link、9 Metric、5 Rule、6 Action Type；Published 指针 `T019-S002-v1` | 持有业务语义和 Published 指针 |
| M03 | 6 个获准问题逐题对应；文字、表格、BI 三视图；结构化结果、Rule Hit 和证据下钻 | 只读消费同轮 Published 与数据资产 |
| M04 | 8 条 Action Request：3 已确认、1 已拒绝、4 待决策；3 条平台内待办 | 人工确认/拒绝和待办 Owner；不自动审批或外部派发 |
| M05 | 预算异常分析 Agent、预算报告草稿 Agent 两条运行完成 | 只读固定证据，不修改预算 |
| M06 | 六章报告草稿、`426/426` 自动核验、预算驾驶舱五主题和六类预警 | 驾驶舱唯一归 M06；报告草稿不冒充 T049 正式报告 |

链路顺序已跑通：`M02 → M01 → M03 → M04 → M05 → M06`。

## 3. 数据工程与数据资产

数据源目录按逻辑源组织，年度和确认时点作为快照：实际执行明细 2 个快照、预算下达明细 2 个快照、预算申报明细 2 个快照、项目预算占用 1 个快照、项目预算使用表 1 个快照。

发布的场景数据资产：

- `S002-BUDGET-EXEC-v1`：预算编制与执行数据资产；
- `S002-PROJECT-OCC-v1`：项目预算占用与余额数据资产；
- `S002-DATA-v1`：兼容性交付指针，不冒充第三个业务数据资产。

来源下载入口真实指向场景内文件。2026-08-17 复验下载 `2024年实际执行.xlsx`，SHA-256 为 `5064556a172d2e91dbc33454987ae12caab2849f00a2888c6646559b50ba92a7`，与来源目录一致。

21 组合法重复凭证保留；13 条期间异常和 6 条日期倒置保留源值、修正值及 `CORRECTED` 标识。跨年补全和演示加工继续显示 `SYNTHETIC_FOR_DEMO`、`DERIVED`、`IMPUTED_ZERO` 等标识。

## 4. Rule 与 Action

六类正式 Action Type 为：预算执行整改、下一年度预算合理性复核、费用管理优化核查、预算申报依据补充、采购占用清理、供应商价格复核。

它们覆盖项目余额不足、预算执行偏离、成本占收比异常、初始申报合理性、年末采购/预算占用集中和供应商价格异常。旧“预算调增/调减/科目调剂/申报退回/占用释放”仅作为下游兼容别名，不再作为预算监督评价场景的主要行动语义。

状态链为：异常识别 → 决策提醒 → Action 草稿 → 人工确认/拒绝 → 平台内待办。禁止自动审批、过账、覆盖最终批准预算、真实调用外部预算系统或自动修改预算数据。

## 5. 报告和驾驶舱

报告草稿包含六章：预算执行概览、成本效率与真正毛利率、项目余额与采购占用、单位/跨年/初始申报、异常事项与整改、证据/质量/边界。自动核验为 426/426 适用检查、58/58 事实和 66/66 锚点，0 失败、0 不可验证。

驾驶舱首屏按“核心指标 + 分类预警 + 五主题入口”组织。五主题为预算执行、跨年趋势与单位对比、初始申报、项目余额与采购占用、异常事项与 Action。六类预警为预算执行、成本效率、预算覆盖不足、年末占用集中、供应商报价偏高和申报合理性。

## 6. M06 上下文缺口修复

最终复验发现并修复了“报告自动核验后切换仪表盘显示不可消费”的真实缺口：

- M06 iframe 主动发送 `request-view-context`；
- 父工作台只向当前 iframe、当前视图回传 Owner envelope；
- 接收端严格校验 `scenarioId + scenarioVersion + scenarioRunId`；
- 同轮 M01/M02 Owner State 优先于同轮失败或陈旧的 C008/C017 缓存；
- `historical-readonly` 完全禁止回退活动 namespaced localStorage；
- 上下文更新后重新读取 M06 trust 投影并重绘页面。

真实浏览器复验路径为：打开报告草稿 → 运行自动核验至 `426/426` → 切换仪表盘。结果继续显示“可使用”、`S002-DATA-v1`、`S002-ONTO-v1`、五主题和六类预警。

2026-08-17 又针对当前权威 CP07（`S002-RUN-20260815155030000-79841356bdf8` / `CP-S002-20260815155930000-f36a5448ef0f`）原样重放上述链路。历史只读运行未回退活动状态，报告核验仍为 `426/426`，切换驾驶舱后数据与语义 Owner 继续可消费；三档新证据见 `evidence/final-browser-20260817/dashboard-*-current-cp07.png`。

## 7. Checkpoint 与恢复

当前运行形成 CP01、CP-PRE、CP02、CP03、CP04、CP05、CP06、CP07 共 8 个不可变节点；48 份 M01—M06 Owner 回执全部 verified。当前代码树与 CP07 精确一致。

历史查看保留原 `scenarioRunId` 且只读；克隆恢复、隔离回归和重置创建新 `scenarioRunId`；历史 Action Request、审批、通知和待办不重放；既有历史运行均保留，未覆盖。

## 8. 自动化与浏览器回归

- Node 自动化：120/120 通过；
- Checkpoint：8 节点 / 48 Owner 回执 / 代码哈希通过；
- 产品源码 console error：0；
- 路由和资源错误：0；
- 允许的非产品提示：v1.0.3 基线 Babel 开发态 warning；
- 1440×900、900×900、390×844 三档驾驶舱通过且无全页横向溢出；
- 截图见 `evidence/final-browser-20260817/dashboard-*-owner-ready.png` 与当前权威运行重放证据 `evidence/final-browser-20260817/dashboard-*-current-cp07.png`。

## 9. 尚未实施的生产能力

- 外部预算系统未真实联通；
- 不存在自动审批、过账或最终批准预算覆盖；
- 未实现多岗位、多角色权限切换；演示由平台管理员操作；
- 报告仍为草稿，未发布 T049 正式报告；
- S001/S002/S003/S004 总装合并仍由后续集成工作树完成。

## 10. 结论

S002 已完成六模块内部页面的 v1.0.3 基线复用纠偏；S002 仅增加预算场景适配内容，未重新设计或改变基线平台功能。
