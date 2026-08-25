# S001 六模块全链路统一工作台

## 启动入口

以 `designs/` 为静态服务根目录，打开：

```text
http://127.0.0.1:4311/s001-e2e-integration/#home
```

当前场景轮次：`S001-RUN-20260814062516042-e1fd5e6ab3f4`。

## 当前状态

- 首页真实投影：`15/15`。
- M02 数据工程：`3/3`。
- M01 本体管理：`2/2`。
- M03 智能问数：`2/2`。
- M04 决策中心：`3/3`。
- M05 Agent 应用：`1/1`。
- M06 报告中心：`4/4`。
- 刷新后仍为 `15/15`。
- `acceptanceReady: false`。

该状态只代表 S001 原型全链路联调完整，不表示模块评审通过、S001 正式验收通过或一期验收通过。

## 当前唯一入口

| 页面 | 路径 |
|---|---|
| 首页 | `../ontology3-homepage-review/方案A-经典复刻版.html` |
| 数据工程 | `../data-engineering-prototype-review/review-v3/方案B2.html` |
| 本体管理 | `../ontology-management-review/canvas-first/index.html` |
| 智能问数 | `../intelligent-query-prototype/review-next/conversation-workspace/index.html` |
| 决策中心 | `../decision-center-prototype/index.html` |
| Agent 应用 | `../agent-application/Agent应用.html` |
| 报告中心 | `../report-center/review-lifecycle/index.html` |

## 已联通业务链

```text
数据上传与管道运行
→ 发布 FIN-ASSET-20251231-v01
→ 本体映射、V1 发布与 T019 正式采用
→ 智能问数 RUN-MSST9EZK-014
→ 三条 Rule 命中与三条 Action Request
→ 决策中心三次安全门、人工确认与三条负责人待办
→ 报告生成、确定性核验与 HTML/PDF 发布
→ 报告伴读 Session/Run/Result
→ C027 当前数据比较
```

关键下游证据：

- 正式报告：`RPT-20260814-201940-010 / 2.0`。
- 证据包：`EP-20260814-201553-003 / 1.0`。
- 生成 Run：`RUN-20260814-019`。
- 核验 Run：`VRF-20260814-201851-005`。
- 伴读：`RSESSION-20260814-007 / RUN-20260814-020 / RES-20260814-020`。
- 当前比较：`CMP-20260814-202319-011`。

## 状态与 Owner 边界

- 集成层只读取六模块保存状态并计算首页进度，不创建数据资产、本体版本、行动申请、提醒、待办、报告或 Agent 结果。
- 数据工程拥有数据源、管道、资产版本和数据可信度状态。
- 本体管理拥有 Published 本体、语义定义和 T019 权威消费绑定。
- 智能问数拥有问数运行和结果；决策中心拥有 Action Request 后续运行事实。
- 报告中心拥有报告、仪表盘、确定性核验和 C027 比较记录。
- Agent 应用拥有 Agent 配置、Session、Run 和 Result；报告中心只读回读。
- HTML 与 PDF 共享同一正式报告编号、内容版本和证据链；发布失败时不形成分叉正式产物。

## 场景与恢复

- 集成状态采用 schema v3：根级只保存公共界面偏好，各场景状态位于 `scenarios[scenarioId]`。
- C033 包含 `scenarioId / scenarioVersion / scenarioRunId / formedAt / status`。
- 跨模块跳转和返回携带同一场景轮次；缺失、未知或不匹配时模块应拒绝业务写入。
- 首页按保存时间读取报告中心最新共享或当前标签页备用恢复点，备用恢复只解决浏览器容量问题，不改变报告中心 Owner。
- “重置当前场景”会开启新轮次，不得用复制或整体替换其他模块状态模拟场景隔离。

## 回归结果

- 首页、报告、C027 比较和伴读记录刷新后可恢复。
- 当前 `1176×891` 视口下平台壳与报告模块均无横向溢出；该宽度小于 1280。
- 既有 `1440×900`、`1280×720`、`390×844` 外壳布局基线继续有效。
- 控制台 error 为 0；M03/M04/M05 仅保留已知浏览器内 Babel warning。
- 核验失败重试、PDF 发布失败重试和上一正式报告冻结均已实际验证。

## 文件职责

- `index.html`：统一工作台入口与资源加载。
- `styles.css`：平台壳、首页能力架构和响应式布局。
- `data.js`：入口、场景和 15 步业务定义。
- `state.js`：场景命名空间、跨模块只读投影、批次选择、最新恢复点和严格完成条件。
- `app.js`：模块挂接、导航、返回、滚动恢复和重置交互。
- `联调结果.md`：本轮真实证据、修复、回归和结论边界。
- `总控联调交接.md`：供平台总控复核的证据摘要和后续治理事项。

详细证据见 [联调结果.md](./联调结果.md)。
