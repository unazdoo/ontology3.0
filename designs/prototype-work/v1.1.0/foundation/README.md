# v1.1.0 C033 / C034 最小公共运行底座

本目录提供后续 S002—S004 独立建设可共同复用的最小运行底座。它只解决两类公共问题：

1. C033：严格的场景身份、运行轮次、命名空间隔离、错配拒绝和定向重置。
2. C034：不可变 Checkpoint 清单校验、历史只读查看、克隆恢复、隔离回归和基线迁移计划。

当前统一绑定：

- `baselineVersion = 1.0.3`
- `baselineSnapshotId = BSL-S001-V103-DE0119608E26`

本底座不包含任何预算、债务风险、贷前调查或 S001 业务结果，不创建数据资产、Published 本体、Metric、Rule、Action Request、审批、待办、Agent 结果、报告或驾驶舱成功状态。

## 文件

- `ofw-scenario-foundation.js`：无第三方依赖的浏览器/Node 双环境脚本。
- `ofw-scenario-foundation.test.cjs`：Node 正向与负向测试。

## 浏览器直接加载

```html
<script src="./foundation/ofw-scenario-foundation.js"></script>
<script>
  const foundation = window.OFWScenarioFoundation;

  const context = foundation.createScenarioContext({
    scenarioId: "S002",
    scenarioVersion: "S002-v1"
  });

  const m01Storage = foundation.createNamespacedStorage({
    storage: window.localStorage,
    context,
    scope: "m01"
  });

  // 只写入当前 scenarioId + scenarioVersion + scenarioRunId + scope。
  m01Storage.set("draft/current", { draftId: "待真实操作形成" });
</script>
```

脚本以经典 `<script>` 方式加载时只暴露 `window.OFWScenarioFoundation`。通过 Node `require()` 加载时导出同一 API。

## C033 场景身份

场景上下文固定五个字段，未知字段会被拒绝：

```js
{
  scenarioId: "S002",
  scenarioVersion: "S002-v1",
  scenarioRunId: "S002-RUN-20260815083000123-010203040506",
  formedAt: "2026-08-15T08:30:00.123Z",
  status: "active"
}
```

约束如下：

- `scenarioId` 必须为 `S` 加三位数字。
- `scenarioVersion` 必须携带同一场景前缀，例如 `S002-v1`。
- `scenarioRunId` 必须由本底座生成，格式为 `Sxxx-RUN-17位UTC时间-12位安全随机码`。
- 跨模块读取或写入前使用 `assertScenarioContextMatch()`；场景、版本或轮次任一错配即拒绝。
- 查看历史保留原 `scenarioRunId`；重置、恢复、回归和迁移均不得复用历史轮次。

## 命名空间存储边界

运行期键格式为：

```text
ofw:v1.1.0:<scenarioId>:<scenarioVersion>:<scenarioRunId>:<scope>:<logicalKey>
```

`createNamespacedStorage()` 只提供单条 JSON 记录的 `set/get/remove/has/keys` 和当前 scope 清理。它刻意不提供以下能力：

- 导入或导出整个 `localStorage`；
- 复制、轮换或覆盖其他场景的存储快照；
- 调用 `localStorage.clear()`；
- 把浏览器存储当作正式 Checkpoint 真源。

`directionalReset()` 只删除当前场景、当前版本、当前运行轮次下的所有 scope，随后生成新的 `scenarioRunId`。它不删除同场景历史轮次、其他场景、根级偏好或正式证据。

> 浏览器存储只是可丢弃的当前工作投影。正式恢复必须依据 M01—M06 Owner 导出并校验的 C034 引用。

## C034 Checkpoint 清单

`createCheckpointManifest()` 与 `validateCheckpointManifest()` 要求清单至少固定：

- Checkpoint 节点、形成时间和不可变标志；
- `baselineVersion`、`baselineSnapshotId`、`parentVersion`；
- 精确场景三元身份和来源运行轮次；
- 原型版本、构建版本、入口和代码树 SHA-256；
- M01—M06 六个模块的精确版本、导出标识、引用、SHA-256、Owner 校验回执及 `isolated-clone` 恢复模式；
- 数据、语义、配置、结果、报告、决策、测试夹具、功能开关和证据九个状态分区；
- 恢复校验状态和稳定证据入口；
- 禁止历史 Action Request、通知、审批、待办和外部派发重放的固定策略。

每个状态分区必须诚实声明为：

- `referenced`：至少包含一条精确、带版本和 SHA-256 的 Owner 引用；
- `empty`：明确说明当前节点为何尚无该资源；
- `unavailable`：明确说明资源不可定位的原因。

清单会拒绝 `acceptanceReady`、`completedSteps`、`businessSuccess` 等业务成功或验收字段。技术导出校验和恢复校验不得被解释为业务完成。

## 四类操作语义

### 历史查看

```js
const view = foundation.createHistoricalView(checkpoint);
```

- 保持原 `scenarioRunId`；
- `readOnly = true`；
- 不写当前投影，不重跑业务。

### 克隆恢复

```js
const restore = foundation.cloneRestore(checkpoint);
```

- 只接受 `restoreReadiness.status = verified` 的清单；
- 生成新 `scenarioRunId` 和隔离命名空间；
- 不覆盖历史；
- 返回各模块的精确导出引用，不复制浏览器状态。

### 隔离回归

```js
const regression = foundation.createIsolatedRegression(checkpoint);
```

- 生成新 `scenarioRunId`；
- 固定为演练/隔离模式；
- 外发能力默认关闭；
- 历史 Action Request、通知、审批和待办不得重放。

### 基线迁移

```js
const migration = foundation.migrateBaseline(checkpoint, {
  targetBaselineVersion: "1.0.4",
  targetBaselineSnapshotId: "BSL-S001-V104-ABCDEF123456",
  targetScenarioVersion: "S002-v2"
});
```

- 目标基线必须变化；
- 必须使用新的 `scenarioVersion`；
- 自动生成新的 `scenarioRunId`；
- 返回旧新基线、旧新场景版本和旧新轮次对照；
- 不改写来源清单，迁移完成后必须另建新 Checkpoint。

## Checkpoint 节点

底座接受以下统一节点：

1. `initial-configured`
2. `data-connected`
3. `published-switched`
4. `query-integrated`
5. `decision-chain-completed`
6. `agent-report-dashboard-completed`
7. `e2e-integrated`
8. `pre-risk-change`

节点名称只表示清单形成时点，不自动表示对应业务步骤已成功。是否具备恢复资格必须由 `restoreReadiness` 和真实证据单独证明。

## 运行测试

在仓库根目录执行：

```bash
node --check designs/prototype-work/v1.1.0/foundation/ofw-scenario-foundation.js
node --test designs/prototype-work/v1.1.0/foundation/ofw-scenario-foundation.test.cjs
```

测试覆盖：浏览器直接加载、身份格式和错配拒绝、跨场景存储隔离、定向重置、错误 Checkpoint、历史只读查看、克隆恢复、隔离回归、副作用禁用以及禁止原地基线迁移。

## 集成要求

1. M01—M06 分别使用独立 `scope`，但必须传播完全相同的场景三元身份。
2. 每次跨模块请求、回执、稳定深链和业务记录均应携带三元身份并执行错配拒绝。
3. 平台公共层只聚合 Owner 导出和校验回执，不计算或复制模块业务真值。
4. 场景分支不得修改冻结 `v1.0.3`，也不得用 S001 runtime JSON 初始化新场景。
5. 最终同源总装必须反复切换 S001—S004，验证读取、写入、重置、恢复和回归均不串场；独立端口通过不能替代同源负向测试。
