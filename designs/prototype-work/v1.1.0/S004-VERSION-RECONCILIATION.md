# S004 版本身份收敛登记

## 当前证据

| 来源 | 当前身份 |
|---|---|
| 最新 `s004-runtime-v2.1.0/scenario.manifest.json` | `scenarioId=S004`、`scenarioVersion=S004-v2.1.0` |
| 最新 `s004-runtime-v2.1.0/INTEGRATION-HANDOFF.md` | `scenarioId=S004`、`scenarioVersion=S004-v2.1.0` |
| 原独立工作区历史注册 | 仍保留 `S004-v1`，属于历史准备登记 |

## 组合处理

组合总装使用 `S004-v2.1.0`，不回写原 S004 工作区的历史登记，不把 `S004-v1` 与 `S004-v2.1.0` 混在同一运行命名空间中。

正式冻结前需要 S004 窗口返回：

1. 原场景注册表的正式版本身份收敛文本；
2. 新版本对应的 `scenarioRunId` 和 Checkpoint；
3. manifest、handoff、入口清单和运行证据的统一哈希；
4. 旧 `S004-v1` 作为历史兼容身份的保留规则。

