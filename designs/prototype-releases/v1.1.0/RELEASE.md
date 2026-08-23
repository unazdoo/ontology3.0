# 智财问策 v1.1.0 实施参考原型冻结基线

`v1.1.0` 由四场景组合候选 `v1.1.0-rc.10` 晋级形成，固定一套统一产品界面：数据工程、本体管理、智能问数、决策中心、Agent 应用、报告中心和一级仪表盘均在同一产品中承载 S001—S004 资源与结果。

## 唯一入口

从项目根目录启动静态服务：

```bash
python3 -m http.server 4342 --directory designs/prototype-releases/v1.1.0
```

打开：

`http://127.0.0.1:4342/s001-e2e-integration/index.html?rev=v1.1.0-frozen#home`

不要直接双击 HTML 文件。部分模块需要同源读取场景资源、证据、报告和源文件快照。

## 冻结内容

- 一套公共 Shell、Foundation、场景注册、跨模块身份及页面返回机制；
- M01—M06 精确页面、源码、静态构建产物、必要测试与资源；
- S001—S004 运行所需场景包、报告、证据索引和源文件下载资产；
- 一级仪表盘及债务风险模型重评、风险处置等场景能力；
- `v1.1.0-rc.10` 的回归矩阵、关键文件完整性记录和来源轮次索引；
- 完整发布树 `manifest.json` 和外置 T056 基线清单。

## 版本边界

1. 本目录冻结后不得原地修改。缺陷修订从本版本复制形成 `v1.1.1`，功能升级形成后续次版本。
2. `v1.0.3` 继续作为治理、Checkpoint 合同和历史兼容父基线；`v1.1.0` 是后续具体项目实施的产品交互与验收参考基线。
3. 四个来源 `scenarioRunId` 仅作为只读证据索引。发布包不声称已经形成四场景正式可恢复运行快照，`runtimeSnapshotIncluded=false`。
4. `acceptanceReady=false`。冻结不表示六模块正式评审、四场景正式验收、生产技术联调、S001 正式验收或一期验收通过。
5. S005、M07、M08 继续在独立研究分支开展；未经总控裁决和版本升版，不进入本冻结目录。

## 校验与回退

```bash
node designs/prototype-releases/verify-release.mjs 1.1.0
node designs/scenario-checkpoints/baselines/v1.1.0/verify-baseline.mjs
```

发布树出现任何文件新增、删除或字节变化，校验必须失败。回退参考为 `v1.0.3`；回退不覆盖本版本来源轮次和证据。
