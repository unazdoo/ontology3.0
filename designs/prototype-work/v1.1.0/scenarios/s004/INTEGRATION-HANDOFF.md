# S004 → v1.1.0 Integration 交接说明

## 1. 交付结论

S004 独立场景包已经完成独立验收，当前合并准备度为：

```text
READY_FOR_INTEGRATION
```

前端场景壳、数据/本体/Agent/报告制品、六模块导出、CP00—CP60、两次 PRE 保护点以及追加式 post-fix CP50/CP60 均已形成。Checkpoint、Foundation、基线、浏览器、工作簿和 PDF 验证已通过；仍须在 integration 工作区执行跨场景同 Origin 总装回归。

## 2. 场景注册信息

Integration 注册时使用以下固定声明：

```json
{
  "scenarioId": "S004",
  "scenarioVersion": "S004-v1",
  "name": "财务公司贷款贷前调查",
  "entry": "scenarios/s004/index.html#home",
  "baselineVersion": "1.0.3",
  "baselineSnapshotId": "BSL-S001-V103-DE0119608E26",
  "completedDemoRunId": "S004-RUN-20260815124059209-4d35e1ed1b61",
  "recommendedPort": 4334,
  "mergeOrder": 3
}
```

统一壳建议路由：

```text
#/scenario/S004 → scenarios/s004/index.html#home
```

不得把 S004 注册到 S001 的 `scenarioRegistry` 或复用 S001 的运行轮次、报告、任务与证据编号。

## 3. 必须整体汇入的目录

```text
designs/prototype-work/v1.1.0/scenarios/s004/
```

关键入口和索引：

| 作用 | 路径 |
|---|---|
| 场景入口 | `index.html` |
| 场景声明 | `scenario.manifest.json` |
| 场景运行状态 | `state.js` |
| 模块及证据桥接 | `module-bridge.js` |
| 权威制品目录 | `artifacts/index.json` |
| 六模块导出目录 | `module-exports/index.json` |
| Checkpoint 目录 | `checkpoints/index.json` |
| 证据目录 | `evidence/index.json` |
| 固定验收夹具 | `fixtures/s004-demo.json` |
| 合同测试 | `tests/checkpoint-contract.test.mjs` |
| 浏览器验证 | `tools/verify-browser.mjs` |

不得只复制 `index.html` 或前端文件而遗漏 artifacts、Owner 导出、Checkpoint、证据和固定夹具。

## 4. Integration 可修改内容

以下内容只能在 `codex/v1.1.0-integration` 完成：

- 统一场景注册表；
- 顶层场景菜单和公共壳路由；
- `VERSION.json`、`WORKSPACE.md`、根 `CHANGELOG.md`；
- 当前工作区候选发布 manifest；
- 汇入后的同 Origin 多场景回归配置；
- 最终候选版入口和回退记录。

这些修改不得回写 S004 独立分支，也不得改写 S001 冻结证据。

## 5. 禁止在汇入时修改

- `designs/prototype-releases/v1.0.3/`；
- `foundation/` 的 C033/C034 语义；
- `s001-e2e-integration/` 的业务数据和运行结果；
- M01—M06 共享原型入口、固定存储键或 Owner 定义；
- S002、S003 场景包；
- S004 已发布报告、历史 Checkpoint 和 detached SHA 文件；
- S004 固定完成演示的 `scenarioRunId`。

若发现必须修改公共合同、共享壳或模块功能，应停止合并并返回对应平台/模块 Owner，不能在 integration 中静默修补。

## 6. 运行与隔离合同

### 6.1 C033

- 完成演示固定使用 `S004/S004-v1/S004-RUN-20260815124059209-4d35e1ed1b61`。
- 用户新运行、重置、恢复和回归必须生成新的 `scenarioRunId`。
- 浏览器状态键通过 Foundation 命名空间包含场景、版本、轮次和 scope。
- 跨场景、跨版本或跨轮次资源必须拒绝消费。

### 6.2 C034

- 正式快照真值为 manifest、M01—M06 导出和 detached SHA-256。
- 历史查看保持来源轮次且只读。
- 恢复采用克隆语义和空隔离命名空间。
- 隔离回归关闭 Action Request、审批、通知、待办和外部派发。
- PRE 保护点必须锁定修改前代码、配置、报告和证据引用，并提供明确回退目标。

### 6.3 模块边界

- M03 以 `NOT_APPLICABLE` 导出存在，不能从注册表省略。
- M04 无 Action Request 时必须保持零审批、零通知和零待办。
- M05 只消费固定证据，不直接读年报或工作簿。
- M06 拥有报告定义、人工确认、核验和 HTML/PDF 发布。

## 7. 正式演示产物

报告稳定身份保持：

```text
reportId      = RPT-S004-20260815-0001
reportNumber  = S004-PLR-2026-0001
evidencePack  = EVP-S004-20260815-0001
```

当前最新内容版本为 `1.0.1`：

```text
artifacts/report/RPT-S004-CGNPC-20260815-v1.0.1.html
artifacts/report/RPT-S004-CGNPC-20260815-v1.0.1.pdf
artifacts/report/publication-manifest-v1.0.1.json
artifacts/report/same-source-output-v1.0.1.json
```

旧 `1.0` 版本必须原样保留。`1.0.1` 通过新内容版本修复 PDF 封面打印页眉裁切，不允许覆盖旧文件。

## 8. 已关闭的独立场景交付门

### 8.1 Checkpoint 合同测试

2026-08-15 22:17（UTC+08:00）执行：

```bash
node --test designs/prototype-work/v1.1.0/scenarios/s004/tests/checkpoint-contract.test.mjs
```

结果：`28/28` 通过。原 CP00—CP60、既有 PRE 和历史发布制品的 detached SHA 均保持不变。最终 integration 来源快照为 `CP-S004-DELIVERY-20260815145500000`（Checkpoint ID `CP-S004-20260815145500000-95ba973809e9`）。

### 8.2 最新报告版本指针

当前消费指针已统一提升到 `1.0.1`：

- `artifacts/report/current-publication-pointer.json` 指向 `PUB-S004-20260815-0002`；
- `data.js`、`artifacts/index.json` 和 `module-exports/index.json` 均消费 `1.0.1`；
- 当前 M06 Owner 导出为 `module-exports/M06-publication-v1.0.1.json`（`1.1.0-s004.2`）；
- 旧 `module-exports/M06.json`、旧 `1.0` 报告和旧发布清单只读保留。

指针提升前已形成 `CP-S004-PRE-20260815140408000`，提升后追加 `CP-S004-50-POSTFIX-20260815141021000` 与 `CP-S004-60-POSTFIX-20260815141021100`，未覆盖原 CP50/CP60。

## 9. Integration 回归清单

汇入后至少验证：

1. S001 冻结入口仍能恢复原 `15/15` 历史状态；
2. S002、S003、S004 切换时 `scenarioId/scenarioVersion/scenarioRunId` 不串联；
3. 同一 Origin 下模块状态、滚动位置、重置和资源索引不互相覆盖；
4. S004 十个场景路由可访问且无控制台错误；
5. M01—M06 导出全部匹配 S004 固定运行身份；
6. CP00—CP60 和 PRE manifest 通过 Foundation、阶段规则、引用与 SHA 校验；
7. 历史查看、克隆恢复、空命名空间拒绝、隔离回归和损坏哈希负例通过；
8. 受控 HTML/PDF 使用同一报告编号、内容版本、证据包和六个稳定锚点；
9. M03 无问数结果、M04 无 Action Request/通知/待办；
10. `1440×900`、`1280×720`、`390×844` 无页面级横向溢出；
11. S004 最新正式报告入口指向内容版本 `1.0.1`；
12. 候选 manifest 和回退版本在完成全场景回归后生成。

推荐命令：

```bash
python3 -m http.server 4334 --directory designs/prototype-work/v1.1.0
node --test designs/prototype-work/v1.1.0/scenarios/s004/tests/checkpoint-contract.test.mjs
node designs/prototype-work/v1.1.0/scenarios/s004/tools/verify-browser.mjs
```

上述命令用于汇入前复核 S004 独立包。完成 integration 注册后，应另在统一端口 `4321` 执行覆盖 S001 和全部已汇入场景的公共回归。

## 10. 回退

若 S004 汇入导致公共壳或既有场景回归失败：

1. 不修改 S004 历史制品、报告或 Checkpoint；
2. 从 integration 候选中撤销 S004 注册和目录汇入；
3. 回到汇入前 integration 提交；
4. 在 S004 独立分支修复并生成新的场景交付证据；
5. 重新按 S002→S003→S004 顺序执行合并门。

## 11. 一期明确不含

- DOCX 正式交付；
- 电子签章；
- 外部报送；
- 复杂审批流；
- 生产级多角色权限矩阵；
- 自动授信或自动风险可控结论；
- Agent 发布报告、执行 Action 或创建待办；
- S004 独立问数运行；
- 新驾驶舱或新增一级模块功能。

任何增量都需要新的资料证据、Owner 设计、合同复核和授权。
