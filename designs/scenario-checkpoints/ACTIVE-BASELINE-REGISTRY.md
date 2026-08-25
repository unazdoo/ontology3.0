# 平台统一活动基线登记

当前统一活动基线是 `v1.1.0` 的实施参考原型，而不是正式运行恢复基线：

- `baselineSnapshotId`：`BSL-OFW-V110-94ABD0E991B7`
- `parentVersion`：`v1.0.3`（版本血缘保持不变）
- 唯一入口：`designs/prototype-releases/v1.1.0/s001-e2e-integration/index.html`
- 冻结标签：`prototype-v1.1.0-frozen`
- 回退版本：`v1.0.3`
- `acceptanceReady=false`

## 继承规则

后续项目实施、S005、M07、M08 和产品升级的新工作区统一使用：

```text
parentVersion = v1.1.0
baselineSnapshotId = BSL-OFW-V110-94ABD0E991B7
```

必须建立新工作区、新场景版本和新运行轮次，保留历史运行和证据，不得原地修改 `v1.1.0` 或静默改写现有研究工作区的父版本。S005、M07、M08 当前登记仍为 `v1.0.3`，已单独列入待迁移清单；迁移前不修改其研究内容。

## 不能越过的证据门

当前 T056 锁定的是发布代码、模块树、四个来源轮次和证据索引。以下证据尚未形成：

1. M01—M06 正式 C034 导出、校验、克隆恢复和隔离回归证据；
2. S004 public Checkpoint；
3. 四场景正式运行快照及生产技术联调证据。

因此 `v1.1.0` 可以作为项目实施的产品交互、功能范围和验收参考基线，但不得称为四场景正式可恢复运行基线。详细机器登记见同目录 `ACTIVE-BASELINE-REGISTRY.json`。
