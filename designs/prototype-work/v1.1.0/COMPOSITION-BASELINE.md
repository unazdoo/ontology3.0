# v1.1.0-rc.10 四场景组合总装基线

## 基线绑定

| 字段 | 值 |
|---|---|
| sourceProductBaseline | `v1.0.7` |
| governanceBaselineVersion | `v1.0.3` |
| parentVersion | `v1.0.3` |
| baselineSnapshotId | `BSL-S001-V103-DE0119608E26` |
| targetVersion | `v1.1.0-rc.10` |
| branch | `codex/v1.1.0-composite` |
| workspace | `/Users/domi/Public/Vibecoding/ontology3.0-worktrees/integration-composite-v1.1.0/` |
| currentStatus | `已完成组装、待用户走查` |
| acceptanceReady | `false` |

`v1.0.7` 仍是产品功能来源，不作为正式治理 parentVersion。四场景的治理父基线继续是冻结 `v1.0.3`；未登记版本治理 CR 前，不修改 S002、S003、S004 原工作区中的 parentVersion。

## 功能基线矩阵

| 模块 | 公共能力来源 | 四场景组合范围 | 组合策略 |
|---|---|---|---|
| M01 本体管理 | S001 v1.0.7 | S001—S004 共 4 个 Published 本体 | 一个 Published 目录；场景作为资源属性和筛选条件 |
| M02 数据工程 | S001 v1.0.7 | 15 个来源、5 条管道、5 个资产 | 一个来源/管道/资产目录；源快照可下载 |
| M03 智能问数 | S001 v1.0.7 | S001—S003 共 55 项语义资源、1 个助手身份和 3 份精确 C009 领域绑定 | S004 不适用问数，转入报告伴读 |
| M04 决策中心 | S003 CP38 | S001、S003 决策运行 | 动态接收看板 C011、重读 C017；人工确认后才形成待办 |
| M05 Agent 应用 | S001 v1.0.7 | 独立报告伴读 Agent、报告核验 Agent 及其他场景 Agent | 核验 Agent 只形成声明/锚点/待比对请求，不作正式判定 |
| M06 报告中心 | S003 CP38 + S004 v2.1.0 | 24 份正式报告、4 套定义与模板 | 440px 助手、横向推荐问题；Agent 抽取后由 5 组确定性规则执行 N 个核验项 |
| 仪表盘 | 组合总装独立入口 | 融资 4 视图、预算 6 专题、债务风险 4 页签 | 五条风险处置；模型配置作为 M01 Owner 的嵌入式受控客户端，仅两类重评触发 |

## 来源运行基线

| 场景 | scenarioVersion | scenarioRunId | 适用模块 | 结果 |
|---|---|---|---|---|
| S001 | `S001-v1` | `S001-RUN-20260816081748567-705ac89fb83a` | M01—M06 | 15/15 |
| S002 | `S002-v1` | `S002-RUN-20260815080000000-6ef5d0ef82f9` | M01/M02/M03/M05/M06 | 13/13；M04 不适用 |
| S003 | `S003-v1` | `S003-RUN-20260817163000000-c02200000001` | M01—M06 | 15/15；CP38 |
| S004 | `S004-v2.1.0` | `S004-RUN-20260815233000000-7f3c8e42a1b6` | M01/M02/M05/M06 | 15/15；M03/M04 不适用 |

## 合并原则

不把四个工作区整目录覆盖合并。每次汇入只允许三类变更：

1. 场景资源：携带场景身份、业务数据、配置、运行证据和 Checkpoint；
2. 模块能力：登记模块入口、适配器、版本、哈希和适用条件；
3. 共享变更：公共 Shell、Foundation、资源注册和 Checkpoint 语义，由组合总装单独审查。

`COMPOSITE-RUN-RC4.json` 是组合来源账本，`COMPOSITE-REGRESSION-MATRIX.json` 是内部回归记录。两者不改变各模块 Owner，也不将候选状态升级为正式评审或验收结论。
