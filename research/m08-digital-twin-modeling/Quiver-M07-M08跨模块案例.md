# Quiver、M07、M08 跨模块案例：利率上行下的融资组合压力

> 状态：S001 隔离研究案例；`SYNTHETIC_RESEARCH_ONLY`
> 活动基线：v1.1.0
> 研究命名空间：`ofw.m08.research.v1`
> 本案例不代表正式 Published 模型、真实预测准确率或生产决策结论。

## 1. 案例问题

用户先在融资成本时序中发现组合成本持续抬升，再定位到具体融资对象和到期关系，最后询问：

> 如果利率上行、信用利差扩大、评级下调、流动性折价和赎回同时发生，组合价值和评价结果会怎样？

案例默认选择“单位553”作为 M07 当前 ObjectRef：

- `FIN-UNIT-553`
- 余额：合成研究映射值 393.134 亿元
- 当前成本：2.880984%
- 当前关注：融资成本偏高
- 模拟基线成员：`SYN-HOLDING-001`

## 2. 三模块职责

| 阶段 | 模块 | 做什么 | 不做什么 |
|---|---|---|---|
| 1 | Quiver | 读取 2025-01 至 2025-12 观测时序；计算 3 个月滚动均值和期末差分 | 不选择模型、不创建预测、不改变事实 |
| 2 | M07 | 维护 `ObjectRef`、关系一跳、时间范围和 Lens 上下文；显示当前对象与到期关系 | 不重算模型、不拥有模拟真值、不写 Action |
| 3 | M08 | 固定 Baseline、Parameter Set、Model Graph，运行单模型或复合压力 Case，产生 `SimulationResult` | 不覆盖 FACT、不改 M02/M01 投影、不触发 M04 行动链 |

三模块共用以下研究上下文，但不复制业务事实：

```text
dataVersionId       = DATA-SYN-S001-EVAL-v1
ontologyVersionId   = ONT-SYN-S001-FINANCING-v1
bindingId           = MB-S001-EVALUATION-v1
timeRange           = 2025-01 至 2025-12
purpose             = 研究验证 · 不进入生产工作流
```

## 3. 合成时序

Quiver 观察值为单位553的合成融资成本序列（单位：%）：

```text
2.61, 2.64, 2.66, 2.68, 2.70, 2.72,
2.75, 2.78, 2.80, 2.83, 2.86, 2.880984
```

页面默认展示：

- 观测值：`FACT`，实线；
- 3 个月滚动均值：确定性派生序列，虚线；
- 期末差分：完整 12 个月约为 `+0.27pp`，最近 6 个月约为 `+0.13pp`。

这些值只证明“探索层先发现趋势”，不构成预测。

## 4. M08 Case

### 单模型 Case

```text
SC-S001-SINGLE-RATE-v1
利率上行 +100bp
Baseline → Market Shock → Shocked Portfolio
```

单模型只产生受冲击组合，不生成评价节点。页面明确显示“评价节点：不适用”。

### 复合压力 Case（默认）

```text
SC-S001-COMPOSITE-v1
利率 +150bp
信用利差 +200bp
评级 -1 档
流动性折价 8%
赎回 12%
Baseline → Market Shock → Evaluation → Simulation Result
```

调用现有 4357 隔离运行时后，当前合成验证结果为：

| 输出 | 结果 |
|---|---:|
| `SimulationResult.resultKind` | `SIMULATION` |
| 模拟评价分数 | `43.3245` |
| coverage | `100%` |
| 组合价值影响 | 约 `-11.74 百万元` |
| side-effect attempts | `0` |
| side-effects emitted | `0` |

结果 ID、Run ID 每次运行重新生成，不能复用历史运行身份。

## 5. 三态比较

复合 Case 在 M08 页面并列显示：

| `resultKind` | 研究结果 |
|---|---:|
| `FACT` | 72.4 |
| `PREDICTION` | 64.9209 |
| `SIMULATION` | 43.3245 |

三者使用不同 Result ID、权限和证据链。模拟结果不能覆盖真实评价，也不能直接转成 Action Request、审批、待办、通知或交易。

## 6. 原型入口与验证

入口是 v1.1.0 统一工作台中的“探索分析”：

```text
http://127.0.0.1:4358/s001-e2e-integration/index.html#module/exploration
```

完整操作链为：

1. 在 M07 选择业务对象；
2. 在概览、关系、时间和空间 Lens 间保持同一 ObjectRef；
3. 从时间 Lens 形成包含 ObjectRef、SeriesRef、时间范围、数据/本体版本的模拟上下文；
4. 在 M08 选择单模型或复合 Case，并调用 4357；
5. 输入变化时旧结果明确标记过期；重新运行后返回 M07；
6. 在原对象和时间上下文中并列查看观察事实与模拟结果。

该案例独立使用 `ofw.m08.research.v1` 的 session 状态，不解锁 M02/M01 真实上游门禁，也不改变 S001 生产 15-step workflow。

验证证据：

- M08 validation `npm test`：33/33 通过；
- `npm run evidence`：`overallStatus=PASSED`；
- 浏览器交互：对象选择、四 Lens、时间窗口、M07→M08 交接、输入过期、对象级影响、复合 Case、三态结果、M08→M07 返回和上下文恢复均已验证。
