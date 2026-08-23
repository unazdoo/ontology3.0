# v1.1.0 四场景组合总装冻结来源工作区

本目录位于独立分支 `codex/v1.1.0-composite`，用于四场景组合总装。产品功能来源采用 S001 `v1.0.7`，公共治理、Foundation、Checkpoint 和历史兼容继续绑定冻结 `v1.0.3`：

- `parentVersion = v1.0.3`
- `baselineSnapshotId = BSL-S001-V103-DE0119608E26`
- `sourceProductBaseline = v1.0.7`（仍为 review-candidate，不升级为正式 parentVersion）
- `sourceCandidate = v1.1.0-rc.10`
- `promotedVersion = v1.1.0`
- `implementationBaselineSnapshotId = BSL-OFW-V110-94ABD0E991B7`
- `acceptanceReady = false`
- `candidateParentVersion = v1.1.0-rc.9`
- `integrityManifest = RC10-INTEGRITY.json`
- 治理冻结基线：`designs/prototype-releases/v1.0.3/`
- 实施参考冻结目录：`designs/prototype-releases/v1.1.0/`
- T056 清单：`designs/scenario-checkpoints/baselines/v1.1.0/T056-baseline-checkpoint.json`

历史 `sourceParentVersion = v1.0.1` 只用于迁移追溯，不再是当前父版本。

## 当前状态

状态为“已完成组装、已晋级实施参考冻结基线”。M01—M06 各保留一个完整工作台，四个场景的业务资源、已完成运行和证据按统一数据结构进入对应模块；场景作为目录筛选、业务记录和证据身份，不设置全局场景切换，也不加载独立场景页面。该工作区仅作来源和审计记录，冻结发布目录才是用户走查和实施引用入口。

四个已完成来源轮次保持精确身份并只读汇入：

| 场景 | 来源轮次 | 业务链状态 | 适用边界 |
|---|---|---:|---|
| S001 集团融资成本与债务结构优化 | `S001-RUN-20260816081748567-705ac89fb83a` | 15/15 | M01—M06 全部适用 |
| S002 预算监督管理 | `S002-RUN-20260815080000000-6ef5d0ef82f9` | 13/13 | M04 不适用 |
| S003 债务风险监测 | `S003-RUN-20260817163000000-c02200000001` | 15/15 | M01—M06 全部适用；Checkpoint `CP-S003-20260819141420000-c03838000038` |
| S004 财务公司贷款贷前调查 | `S004-RUN-20260815233000000-7f3c8e42a1b6` | 15/15 | M03、M04 不适用 |

组合运行账本为 `COMPOSITE-RUN-RC4.json`。它汇总不可变来源轮次和精确资源引用，不重算或改写各 Owner 的运行事实。旧 `COMPOSITE-RUN-202608211618.json` 已失效，只保留审计。

统一入口加载 `foundation/ofw-scenario-foundation.js`，提供场景三元身份、显式命名空间、错配拒绝、定向重置和 Checkpoint 操作语义。正式快照真源不使用 `localStorage`、临时 JSON、页面 DOM 或目录复制。

## 唯一走查入口

用户走查和实施引用应以冻结发布目录为静态服务根目录：

```bash
python3 -m http.server 4342 --bind 127.0.0.1 --directory designs/prototype-releases/v1.1.0
```

打开：

```text
http://127.0.0.1:4342/s001-e2e-integration/index.html?rev=v1.1.0-frozen#home
```

该入口包含首页、M01—M06 和独立一级“仪表盘”。每个模块只有一个业务工作台；四场景资源在相同目录、筛选、详情和运行模型中呈现。

## 组合能力基线

- M01 本体管理：4 个当前正式使用的本体，均可查看 Published 版本、画布、数据映射、证据并创建修订草稿。
- M02 数据工程：15 个已接入来源与 15 个可下载快照，5 条成功管道和 5 个可消费资产；所有管道和资产详情可定位。
- M03 智能问数：55 项语义资源、1 个智能问数助手身份、3 份精确 C009 领域绑定，以及 34 个已核验推荐问、结果详情、BI、CSV 和证据闭环；S004 进入报告伴读。
- M04 决策中心：S001、S003 共用一套 Action Request、人工确认和任务状态模型；动态接收 S003 看板逐条提交的 C011，并在接收前重新读取 C017；“追踪待办”和 AI 摘要继续使用同一运行事实。
- M05 Agent 应用：报告伴读与报告自动核验使用独立 Agent；核验 Agent 只抽取声明和定位证据，正式判定归报告中心确定性规则引擎。
- M06 报告中心：报告助手默认 440px，推荐问题使用横向 chips；自动核验执行“1 个 Agent 抽取批次 → 5 个规则组 → N 个核验项”。
- 仪表盘：独立一级入口，债务风险看板只显示 5 条风险处置，模型运行仅允许“新数据就绪”或“模型调整发布”两类重评触发。

## 合并与维护规则

1. 不把四个工作区整目录覆盖合并；按场景资源、模块能力和共享变更分层汇入。
2. 每个场景保留稳定 `scenarioId`、`scenarioVersion` 和精确 `scenarioRunId`，不得复制 S001 的轮次或成功状态。
3. 新场景数据、配置、结果和证据进入独立命名空间，不迁移、覆盖或改写其他场景事实。
4. 公共壳、Foundation、版本、资源注册和统一入口由组合总装维护；模块内部能力变更返回对应模块窗口。
5. 跨模块合同冲突必须登记 CR，不由集成层静默改写。
6. 每次修改均回归首页、M01—M06、仪表盘、三档视口和场景间资源隔离。
7. 候选版不得覆盖 `v1.0.3`；后续冻结必须形成新的不可变目录、完整性清单和回退指针。

## 回归与结论边界

`COMPOSITE-REGRESSION-MATRIX.json` 已记录模块资源、来源轮次、功能入口、三档视口和控制台回归。该结果已物化为 `designs/prototype-releases/v1.1.0/` 的不可变实施参考基线，`acceptanceReady=false`。

本状态不表示任一模块正式评审通过、任一场景正式验收通过或一期验收通过。冻结后缺陷必须建立新版本，不得原地修改。
