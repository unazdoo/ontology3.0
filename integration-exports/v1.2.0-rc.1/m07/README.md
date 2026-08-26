# M07 v1.2.0-rc.1 最小原型交付包

本目录只导出 M07 Owner 版多视图探索工作区及其直接运行依赖。它用于挂载到后续统一原型，不包含平台底座副本、其他 canonical 模块、第二套 Shell、截图或归档。

## 版本身份

- `sourceTag = prototype-v1.1.0-frozen`
- `parentVersion = v1.1.0`
- `baselineSnapshotId = BSL-OFW-V110-94ABD0E991B7`
- `targetPrototypeVersion = v1.2.0-rc.1`
- `acceptanceReady = false`
- `moduleId = m07`
- `route = #module/m07`

## 目录

```text
m07/
├── module/                 # canonical workspace-v2 与本地运行依赖
├── resources/s001.json     # S001 脱敏单时点资源
├── resources/s005.json     # S005 脱敏研究资源
├── tests/contracts.test.mjs
├── INTEGRATION-MANIFEST.json
└── SHA256SUMS
```

## 挂载

统一 Shell 只需登记一个模块：

```js
{
  id: "m07",
  name: "多视图探索",
  route: "#module/m07",
  source: "<m07-package>/module/workspace-v2.html?embedded=1&resource=../resources/s001.json&scenarioId=S001&lens=catalog"
}
```

S005 将 `resource` 改为 `../resources/s005.json`，并将 `scenarioId` 改为 `S005`。宿主必须使用同源 iframe；工作区自身不创建外层导航或第二状态树。

## 输出合同

工作区通过 `window.parent.postMessage` 发送 `ofw.m07.prototype.handoff.v1`：

- `sync-breadcrumb`：同步当前 Lens 名称；
- `navigate-parent-module`：请求宿主打开其他 canonical 模块；
- `open-m08`：请求宿主把 `context` 适配给 M08，并转到 `moduleId=modeling`、`route=#module/modeling`。

`open-m08` 保持既有 `type=OFW_M07_OPEN_M08`，其 `payload` 与 `context` 相同，包含 `objectRef`、`lensRef`、可选 `seriesRef`、`timeRange`、`dataVersionId`、`ontologyVersionId`、`bindingId`、`scenarioId` 和 `scenarioRunId`。M08 返回时，宿主应使用消息中的 `returnUrl` 恢复 M07，并继续保持 `#module/m07`。

独立打开页面时不会跳转到任何外部 Shell；交接改为本页 `m07:handoff` 事件，便于本地调试。

## 本地验证

```bash
node --check module/core.js
node --check module/workspace-v2.js
node --test tests/*.test.mjs
shasum -a 256 -c SHA256SUMS
python3 -m http.server 4356
```

S001 入口：

```text
http://127.0.0.1:4356/module/workspace-v2.html?resource=../resources/s001.json&scenarioId=S001&lens=catalog
```

S005 入口：

```text
http://127.0.0.1:4356/module/workspace-v2.html?resource=../resources/s005.json&scenarioId=S005&lens=catalog
```

## 已知边界

- 两份资源均为脱敏研究投影，不是生产事实接口。
- S001 只有一个受治理时点，不能据此宣称趋势。
- S005 的 Published 与 Binding 标识仍是研究引用；空间点仅为技术夹具。
- S005 空间视图使用 OpenStreetMap 瓦片，离线时底图可能不可用，但对象、关系与时序 Lens 不受影响。
- 本包不包含 M08 运行代码；宿主必须按 manifest 完成 M07 到 M08 的消息适配。
- `acceptanceReady=false`；本提交只表示可集成原型包形成。
