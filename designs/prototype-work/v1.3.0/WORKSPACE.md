# v1.3.0 总装原型工作区

本目录只建设 `v1.3.0-rc.1` 总装候选，不承担正式项目实施，不修改 `v1.1.0` 冻结目录，也不在父版本中原地开发。`acceptanceReady=false`。

## 父版本锚点

- 父版本：`v1.2.0-rc.1`
- 父提交：`e4974c23bd223f26bfd04b08dc6f46eb4d9ae5e0`
- 父提交 Tree：`036ace4ea3954cfba9657ef273ea593d1fce78fd`
- `designs/prototype-work/v1.2.0/` 子树：`e57caf36b4a815b4d363ca93ee69305c12228938`
- 冻结底座：`prototype-v1.1.0-frozen@a8b023d7f8d49ad6ed6c24417b79b6f9df3fb716`
- 父版本和冻结目录均只读引用，当前差异为 0。

## 总装方式

唯一入口是 `composite/s001-e2e-integration/index.html`。候选保留 v1.2 的单一 Shell、主导航、首页能力架构和真实模块页面，没有第二套 Shell，也没有说明页替代业务界面。

- 首页只展示 v1.2 风格的平台能力架构，不展示模块目录、场景运行、进度、待办或场景切换组件。
- M01—M08 和 Dashboard 统一使用增强对比度的浅色 Shell 侧纵向二级任务导航，增大文字与点击区域；移动端使用单一任务选择器。`首页 > 模块 > 当前任务` 位于全局顶栏，不再单独占用内容行；iframe 内原有重复菜单隐藏。
- M01—M06 直接加载 v1.2 使用的本体、数据、问数、决策、Agent 和报告工作区。M02 的冻结 DataVersion 作为数据资产目录资源出现，M01 的 Semantic Contract 作为语义资产目录资源出现，不再使用页面顶部的场景说明框。
- M03 保留父版 Composer、推荐问题、最近会话、五步处理动画、回答、追问和证据。51 个推荐问题按“全部问题、融资成本、预算监督、债务风险、贷前评估、投后评价”筛选；原融资管理中的债务结构问题归入债务风险。页签切换只更新显隐，不重载 iframe。每步动画约 680ms；“新会话”会取消过期运行。
- M07 直接加载父版 `workspace-v2.html`，使用 `portfolio.json` 将五类业务资源组织为一个 56 对象目录，不显示场景选择器。对象类型、质量、关系和时序统一筛选；跨模块交接时才从所选对象解析业务上下文、DataVersion、OntologyVersion 和 Binding。
- M08 是唯一授权重构页面，名称为“模型优化中心”，收敛为 5 个任务：优化工作台、业务目标与模型、统一评测、候选观察、发布与监测。模型代码仓从模型详情下钻进入；业务长页和代码仓内部区域均可滚动。
- Dashboard 保留 v1.2 驾驶舱结构，并把 S004 建成真实第五个驾驶舱，而不是注入入口卡。
- S005 不再路由到 `module-workbench.html`，通过真实 M01—M08 页面驱动父版评价引擎。

## S003 数据与模型代码仓

M02 当前形成 6 类脱敏 synthetic 数据资产：企业纵向观察、独立风险事件与结果标签、现金流与可用资金、债务到期与再融资计划、关系网络、评级/诉讼/审计与重大事项事件。每类资产包含粒度、时点、可得时间、行数、消费模型和血缘。

M01 当前形成 10 个逐模型语义绑定，固定输入字段、输出字段、单位、时间粒度、空值策略、结果身份、DataVersion 和代码仓标识。Python 运行收据引用同一冻结 DataVersion、Semantic Contract、质量结果和泄漏检查。

`composite/model-repositories/s003/` 下有 10 个模型仓。每个仓均包含：

- `README.md`
- `model.py`
- `features.py`
- `model-card.json`
- `requirements.txt`
- `tests/test_model.py`

正式 1.0.2 仓整体只读；候选仓的 `main` 受保护。M08 可真实创建研发分支、不可变提交、不可移动标签和代码 Release Candidate，并可启动真实 `python3` 单元测试与模型运行。代码 Release Candidate 不等于模型正式发布。

## 五场景链路

S001—S005 均注册独立模型优化周期，并已在最终 Chrome 回归中完整形成数据与语义、模型组合、AI 洞察、人工审查、不可变候选、3 个 Shadow 成熟窗口、复评、Release Candidate、Binding 应用和压力模拟，五个场景最终状态均为 `BINDING_APPLIED`。S005 还在真实模块页面中形成 9 个模块输出并完成 7 个评价阶段。

S003 完整链路为：

`M02 构建/校验/冻结数据 -> M01 形成模型语义合同 -> M08 运行当前正式模型 Benchmark -> 运行 Challenger 与补充模型 -> AI 洞察 -> 人工审查 -> 不可变 Model Version -> Shadow Trial -> 三个标签成熟窗口 -> 复评 -> Release Candidate -> Dashboard Binding -> Dashboard/M07/M03/M05/M06 同包消费 -> M04 非事实硬拒绝 -> 历史与回退`。

正式 1.0.2 模型和 21 家企业历史结果保持不变。`FACT`、`PREDICTION`、`SHADOW`、`SIMULATION` 独立保存；M04 对非 FACT 返回 `NON_FACT_SOURCE_REJECTED`，外部副作用为 0。

## 验证结果

- v1.3 Node 测试：42/42 通过。
- 模型仓 Python 测试：10 个仓、30/30 用例通过。
- 本机 Google Chrome：S001—S005 × 首页/M01—M08/Dashboard，共 50/50 页面通过。
- 1440×900、1280×720、390×844 均无页面或模块横向溢出。
- 应用 Console、Page Error、资源错误均为 0。
- M03 的 51 个推荐问题、6 个业务分类页签、父版与模型问题五步动画、取消过期运行和零页签重载通过。
- M04 决策工作台与运营驾驶舱往返稳定；隐藏旧控件不删除父 React 节点，运行时错误为 0。
- M08 的 5 个任务页、1280×720 纵向滚动、代码仓内部滚动、分支、提交、标签、代码发布候选、Python 测试和 21 条结果运行通过。
- S001—S005 五个模型优化周期均达到 `BINDING_APPLIED`，各自含 3 个 Shadow 窗口、Release Candidate 和独立模拟结果。
- S004 驾驶舱的 6 个指标、4 个主体、4 类证据、缺失状态和模型结果下钻通过。
- 多标签自动重载为 0；历史后退额外 frame load 为 0；深链与刷新稳定。
- 浏览器证据时间：`2026-09-03T18:34:55.063Z`（上海本地日期 2026-09-04）。

## 启动

```bash
M08_PORT=4363 OFW_STATIC_PORT=4362 node composite/start-candidate.mjs
```

本候选不代表模型有效性正式证明、生产上线完成、用户评审通过或一期验收通过。
