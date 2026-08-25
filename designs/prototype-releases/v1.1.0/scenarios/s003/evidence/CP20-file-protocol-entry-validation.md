# S003 CP20 文件入口与本地启动验证

- 基线：`v1.0.3` / `BSL-S001-V103-DE0119608E26`
- 场景：`S003` / `S003-v1`
- 正式来源运行：`S003-RUN-20260815133000000-c03503000001`
- Checkpoint：`CP-S003-20260817160000000-c03520000020`
- `acceptanceReady=false`

## 根因

直接以 `file://` 打开 `scenarios/s003/index.html` 时，公共壳和各模块通过 Fetch API 读取 JSON；Chromium 明确拒绝 `file://` Fetch，导致场景 manifest、Published 模型、数据资产、报告及快照全部不可读。

## 修正

1. S003 文件入口不再自动跳转到失败的 `file://` 公共壳，而是显示启动提示、HTTP 入口和 `启动S003.command`。
2. 公共壳检测 `file:// + scenarioId=S003`，回退到同一启动提示页。
3. macOS 启动器启动独立 4333 端口并打开：
   `http://127.0.0.1:4333/s001-e2e-integration/index.html?scenarioId=S003#home`

## 验证

- 文件入口：提示正常显示，`console error=0`，不再进入失败的公共壳。
- 文件入口专项 Node/合同测试：`38/38 passed`。
- 完整 Node/合同测试：`296/296 passed`。
- M02 静态校验：通过。
- 真实 Chromium：`10/10 passed`；console/page/request/HTTP>=400 错误均为 0。
- v1.0.3 冻结目录差异：`0`。
- CP01—CP19 历史 Checkpoint 未改写，测试没有重放历史 Action、通知、审批或待办。
