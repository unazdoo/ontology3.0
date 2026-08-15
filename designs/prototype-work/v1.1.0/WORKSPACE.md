# v1.1.0 公共 bootstrap 与受控总装工作区

本目录已经按受控迁移记录从历史来源父版本 `v1.0.1` 切换到冻结父版本 `v1.0.3`，并绑定唯一基线快照：

- `parentVersion = v1.0.3`
- `baselineSnapshotId = BSL-S001-V103-DE0119608E26`
- 冻结基线：`designs/prototype-releases/v1.0.3/`
- T056 清单：`designs/scenario-checkpoints/baselines/v1.0.3/T056-baseline-checkpoint.json`
- 迁移对照：`MIGRATION-v1.0.1-to-v1.0.3.json`

历史 `sourceParentVersion = v1.0.1` 只用于迁移追溯，不再是当前父版本。

## 当前状态

`public-bootstrap`。公共基线已建立，但 S002、S003、S004 的场景功能均尚未在本目录实现。本目录只承接公共壳和最终受控总装，不允许三个场景同时直接修改。

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

公共 bootstrap 使用 4331；最终集成工作区使用 4321。端口不得与冻结版、最终集成或独立场景工作区共用。该入口用于公共基线核验，不是任何新增场景的初始评审入口。

## 开发规则

1. S002、S003、S004 分别在独立工作区、分支、端口和命名空间开发；本目录只接收已通过场景联调门的交付包。
2. 新场景必须拥有稳定 `scenarioId`、`scenarioVersion` 和新 `scenarioRunId`，不得复制 S001 的轮次或成功状态。
3. 新场景数据、配置、结果和证据进入场景命名空间，不迁移、覆盖或改写 S001 已归档事实。
4. 公共壳、场景注册表、共享样式、公共合同适配和本工作区 `VERSION.json` 仅由受控总装维护。
5. 每个场景交付必须包含基线绑定、模块版本、路由/菜单、状态命名空间、数据与证据引用、Checkpoint、功能开关、测试结果和合并兼容性声明。
6. 模块变更先写入 `CHANGELOG.md`；涉及合同冲突时登记 CR，不由集成层静默改合同。
7. 每次汇入后同时回归 S001 及全部已汇入场景；新增场景成功不能替代 S001 回归。
8. 候选版不得覆盖 `v1.0.3`；通过完整回归后另行冻结为新版本。
9. `localStorage`、临时 JSON、页面 DOM 或目录复制不能成为正式 T056 快照真源。
10. 场景分支只修改 `scenarios/<scenarioId>/` 独占包；共享壳、`VERSION.json`、注册表、Foundation 和统一入口变更返回 base/integration 处理。

## 结论边界

公共 bootstrap 建立不等于新增场景已经实现、任何模块正式评审通过、S001 正式验收通过或一期验收通过。`acceptanceReady` 继续为 `false`。
