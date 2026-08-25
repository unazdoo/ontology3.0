# v1.1.0 四场景组合总装冻结来源

当前状态：**已晋级实施参考原型冻结基线**。

本目录只保留来源候选与审计材料；冻结发布入口位于 `designs/prototype-releases/v1.1.0/`：

```text
http://127.0.0.1:4342/s001-e2e-integration/index.html?rev=v1.1.0-frozen#home
```

M01—M06 各保留一个完整工作台，S001—S004 的业务资源和已完成来源轮次按统一数据结构装入模块目录；仪表盘使用独立一级入口。组合过程不设置全局场景切换，不加载独立场景页面，也不复制场景历史事实形成第二套状态真源。

候选基线：

- `sourceProductBaseline = v1.0.7`
- `governanceBaselineVersion = v1.0.3`
- `baselineSnapshotId = BSL-S001-V103-DE0119608E26`
- `sourceCandidate = v1.1.0-rc.10`
- `implementationBaselineSnapshotId = BSL-OFW-V110-94ABD0E991B7`
- `parentVersion = v1.0.3`
- `integrityManifest = RC10-INTEGRITY.json`
- `acceptanceReady = false`

四场景来源轮次及适用边界记录在 `COMPOSITE-RUN-RC4.json`；模块、入口、三档视口和控制台结果记录在 `COMPOSITE-REGRESSION-MATRIX.json`。旧组合运行账本 `COMPOSITE-RUN-202608211618.json` 已失效，只保留审计。

本来源候选已完成组合产品走查所需的组装与内部回归。冻结发布树锁定完整文件清单、入口和回退版本；冻结后不得原地修改，缺陷必须从 `prototype-v1.1.0-frozen` 建立新版本。该结论不表示模块正式评审通过、场景正式验收通过或一期验收通过。
