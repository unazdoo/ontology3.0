# v1.1.0 工作区发布说明

本目录当前是 `public-bootstrap`，不是冻结发布版。当前父版本、基线快照、隔离工作区和合并规则以 `VERSION.json`、`WORKSPACE.md` 与 `MIGRATION-v1.0.1-to-v1.0.3.json` 为准。

源冻结基线是 `designs/prototype-releases/v1.0.3/`，唯一基线身份为：

`BSL-S001-V103-DE0119608E26`

目录内的 S001 历史入口、runtime 快照和 `manifest.json` 只用于基线回归与物化对照，不得作为 S002—S004 的初始化数据或成功状态。

S002、S003、S004 必须先在各自 Git worktree 内独立建设并通过场景联调门，再按 S002→S003→S004 的顺序汇入集成工作区。每次汇入均须在同一 Origin 回归 S001 和所有已汇入场景。

只有完成全场景回归、形成新的完整性清单并取得后续发布授权后，才能把候选内容复制到新的不可变发布目录。当前 `acceptanceReady=false`，不表示任何模块评审、S001 正式验收或一期验收通过。
