# v1.1.0 外置 T056 实施基线清单

唯一标识：`BSL-OFW-V110-94ABD0E991B7`

本目录锁定 `v1.1.0` 实施参考原型的发布树、M01—M06 精确组件版本、公共 Shell/Foundation/仪表盘、四个来源场景轮次和证据索引。

```bash
node designs/scenario-checkpoints/baselines/v1.1.0/verify-baseline.mjs
```

冻结提交形成前可用 `ALLOW_PENDING_TAG=1` 执行预校验。正式冻结标签推送后必须不带该变量重新校验。

本清单不是四场景生产级运行状态真源。`runtimeSnapshotIncluded=false`，S004 public Checkpoint 和 M01—M06 C034 正式导出/恢复证据仍待实施；`acceptanceReady=false`。
