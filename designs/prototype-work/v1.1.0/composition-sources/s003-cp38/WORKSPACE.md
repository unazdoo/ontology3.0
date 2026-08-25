# v1.1.0 公共 bootstrap 与受控总装工作区

本目录已经按受控迁移记录从历史来源父版本 `v1.0.1` 切换到冻结父版本 `v1.0.3`，并绑定唯一基线快照：

- `parentVersion = v1.0.3`
- `baselineSnapshotId = BSL-S001-V103-DE0119608E26`
- 冻结基线：`designs/prototype-releases/v1.0.3/`
- T056 清单：`designs/scenario-checkpoints/baselines/v1.0.3/T056-baseline-checkpoint.json`
- 迁移对照：`MIGRATION-v1.0.1-to-v1.0.3.json`

历史 `sourceParentVersion = v1.0.1` 只用于迁移追溯，不再是当前父版本。

## 当前状态

`s003-baseline-extension-candidate`。本工作树已按用户授权把 S003 以配置化场景包和条件式适配装入 v1.0.3 派生的 v1.1.0 公共壳；S001 默认路径和六模块原功能继续保留。CP31 已锁定 Windows 离线演示交付候选，仍待用户正式验收和总控受控汇入。

统一入口已加载 `foundation/ofw-scenario-foundation.js`。它只提供场景三元身份、显式命名空间、错配拒绝、定向重置和 Checkpoint 操作语义；不包含任何场景业务结果。

目录内 `manifest.json` 仅保留为 v1.0.3 逐文件物化对照，不是 v1.1.0 当前工作区的发布清单；工作区进入候选发布门前才生成新的完整性清单。

独立开发使用下列 Git worktree；每个 worktree 内的原型相对路径均为 `designs/prototype-work/v1.1.0`：

| 用途 | Git worktree | 分支 | 独占场景包 | 端口 |
|---|---|---|---|---:|
| S002 | `../ontology3.0-worktrees/s002` | `codex/s002-v1.1.0` | `scenarios/s002/` | 4332 |
| S003 | `../ontology3.0-worktrees/s003` | `codex/s003-v1.1.0` | `scenarios/s003/` | 4333 |
| S004 | `../ontology3.0-worktrees/s004` | `codex/s004-v1.1.0` | `scenarios/s004/` | 4334 |
| 最终集成 | `../ontology3.0-worktrees/integration` | `codex/v1.1.0-integration` | 受控汇入及共享壳 | 4321 |

注册表中的 `prototype-work/v1.1.0-s002` 等 `path` 是稳定的逻辑工作区标识，不表示仓内另有一套物理原型目录；实际位置以 `gitWorktreePath + prototypePath` 为准。

## 本地启动

```bash
python3 -m http.server 4331 --directory designs/prototype-work/v1.1.0
```

入口：

```text
http://127.0.0.1:4331/s001-e2e-integration/
```

公共 bootstrap 使用 4331；最终集成工作区使用 4321。端口不得与冻结版、最终集成或独立场景工作区共用。

S003 统一入口为：

```text
http://127.0.0.1:4333/s001-e2e-integration/index.html?scenarioId=S003#home
```

不要直接双击 HTML 文件。浏览器的 `file://` 安全策略会阻止 Fetch API 读取场景 JSON，导致仪表盘和模块显示加载失败。macOS 可直接双击工作区内的 `启动S003.command`，它会启动 4333 端口并打开统一入口。

`scenarios/s003/index.html` 只提供兼容跳转，不再启动第二套 S003 产品壳。

当前技术验证 Checkpoint：

```text
CP-S003-20260819141420000-c03838000038
scenarios/s003/checkpoints/CP38-performance-and-m04-ux.json
```

该快照绑定当前正式 Published 运行 `S003-RUN-20260817163000000-c02200000001`。浏览器快速重跑形成的隔离评分预览不作为正式 Published 事实，也不替代该快照的来源运行。CP01—CP37 均保持不可变；CP38 追加 M04 AI 摘要旧投影兼容、详情抽屉三区布局、预编译入口、M06 Checkpoint 按需加载和统一性能缓存版本。CP38 封存后不得回写。

## 开发规则

1. S002、S003、S004 分别在独立工作区、分支、端口和命名空间开发；本目录只接收已通过场景联调门的交付包。
2. 新场景必须拥有稳定 `scenarioId`、`scenarioVersion` 和新 `scenarioRunId`，不得复制 S001 的轮次或成功状态。
3. 新场景数据、配置、结果和证据进入场景命名空间，不迁移、覆盖或改写 S001 已归档事实。
4. 公共壳、场景注册表、共享样式和公共合同适配原则上由受控总装维护；本 S003 工作树仅依据用户明确授权，在 v1.1.0 副本中形成最小、可回归的场景装入候选，禁止修改冻结 v1.0.3。
5. 每个场景交付必须包含基线绑定、模块版本、路由/菜单、状态命名空间、数据与证据引用、Checkpoint、功能开关、测试结果和合并兼容性声明。
6. 模块变更先写入 `CHANGELOG.md`；涉及合同冲突时登记 CR，不由集成层静默改合同。
7. 每次汇入后同时回归 S001 及全部已汇入场景；新增场景成功不能替代 S001 回归。
8. 候选版不得覆盖 `v1.0.3`；通过完整回归后另行冻结为新版本。
9. `localStorage`、临时 JSON、页面 DOM 或目录复制不能成为正式 T056 快照真源。
10. S003 业务资源、证据和 Checkpoint 仍归 `scenarios/s003/`；为把场景装入原六模块而产生的共享副本改动必须条件式生效、默认保持 S001 行为，并在最终集成前逐项审查。

## 结论边界

S003 候选装入完成不等于最终集成、任何模块正式评审通过、S001 正式验收通过或一期验收通过。`acceptanceReady` 继续为 `false`。
