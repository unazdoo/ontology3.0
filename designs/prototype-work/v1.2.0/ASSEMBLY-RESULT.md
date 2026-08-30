# v1.2.0-rc.1 总装结果

## 当前结果

- 唯一走查入口：`composite/s001-e2e-integration/index.html`
- 总装方式：在只读 v1.1.0 底座上增量挂载候选资产，不复制冻结产品树。
- 平台结构：一个 Shell、一套一级导航、M01 至 M08 与仪表盘共九个业务工作区。
- 场景结构：S001 至 S005 作为统一资源目录中的业务属性与筛选条件，不提供第二套场景壳。
- 品牌与首页：使用 v1.1.0 冻结版脑网络标识、三能力域架构、领域详情和信息层级；M07、M08、S005 与统一资源目录均为增量扩展。
- 仪表盘：保留 v1.1.0 的 S001 至 S003 三个业务驾驶舱，在同一目录加入 S005 投后评价驾驶舱及四个可操作视图。
- 模块入口：模块页直接进入业务内容，不再显示场景资源选择或加载条；首页统一目录负责检索，资源上下文随入口自动传递。
- 回归记录：`COMPOSITE-REGRESSION-MATRIX.json` 共 21 项，当前候选执行结果为 21/21 passed。
- 当前状态：`acceptanceReady=false`。该状态只表示总装候选可走查，不表示正式实施或发布结论。

## 已物化合同

- M01 至 M06 继续相对引用 `prototype-v1.1.0-frozen`。
- Dashboard 使用候选增量入口 `composite/dashboard/index.html`，其 `sourceEntry` 指向冻结 Dashboard；S001 至 S003 保持基线，S005 只增加投后评价内容，不引入第二平台 Shell。
- M07 的唯一身份为 `moduleId=m07`、`route=#module/m07`、`canonicalImplementation=workspace-v2`。
- M08 的唯一身份为 `resourceOwnerId=M08`、`moduleId=modeling`、`route=#module/modeling`。
- M07、宿主和 M08 使用 `scenarioId`、`scenarioVersion`、`scenarioRunId`、`formedAt`、`status` 五字段交接。
- S001 至 S004 的归档身份只读；S005 使用 `S005 / S005-v1` 和按轮次动态生成的 `scenarioRunId`。
- 当前场景重置只处理 S005 当前轮次，上一轮进入本地历史，四个归档场景保持不变。
- M01 至 M08 与仪表盘各登记 S001 至 S005 资源；未登记能力显式显示状态，不回退到其他场景数据。
- `CR-V120-001` 与 `CR-V120-002` 已在候选适配层形成可执行实现和证据，仍待平台总控确认，不代表用户裁决或正式合同生效；源交付包保持不变。

## 实际提交清单

- 候选治理：`VERSION.json`、`WORKSPACE.md`、`PACKAGE-VERIFICATION.json`、`CONTRACT-CHANGE-REQUESTS.json`、`MODULE-REGISTRY.json`、`SCENARIO-REGISTRY.json`。
- 总装记录：`COMPOSITE-MANIFEST.json`、`COMPOSITE-REGRESSION-MATRIX.json`、`ASSEMBLY-RESULT.md`。
- 唯一 Shell：`composite/s001-e2e-integration/`。
- Dashboard 候选增量：`composite/dashboard/`。
- M07 候选：`composite/modules/m07/`。
- M08 候选及本地计算服务：`composite/modules/modeling/`。
- S005 场景运行适配：`composite/scenarios/s005/`。
- S001 至 S005 统一资源目录：`composite/resources/catalog.js`。
- 静态、合同与状态测试：`composite/tests/`、各候选模块和场景目录内的 `tests/`。
- 浏览器证据与三档视口截图：`composite/evidence/`。

候选资产的逐文件大小和 SHA-256 由 `composite/tests/refresh-manifest.mjs` 写入 `COMPOSITE-MANIFEST.json`，该清单是实际文件提交明细。

## 已执行校验

- 总装静态校验：19/19。
- 完整 Node 回归：77/77。
- 品牌、首页与直接模块入口合同：5/5；Dashboard S005 合同：4/4。
- M07 实际 payload 到 M08 bridge 的跨包执行测试：2/2。
- 候选状态与重置隔离：4/4。
- 统一资源目录：4/4，覆盖 9 模块 x 5 场景共 45 项资源。
- M07 候选合同：7/7。
- M08 候选合同：5/5；计算服务：43/43。
- S005 候选合同：3/3。
- 浏览器回归：21/21；覆盖 1440x900、1280x720、390x844。
- 浏览器走查期间：候选页应用错误 0、页面错误层 0、失败资源请求 0、外部地图请求 0。
- 内置浏览器记录过 1 条已知 `MutationObserver.observe` 注入层消息；候选页自身的运行错误与失败资源捕获均为 0。该工具消息也是执行过程中浏览器控制偶发中断的主要证据，不属于页面业务错误。
- v1.1.0 发布完整性和 T056 基线校验继续通过。

## 仍未闭合

- S005 当前五个 `InvestmentProduct` 对象没有可见的受治理时序系列。M08 按合同显示 `SERIES_INPUT_UNAVAILABLE`，不会替换为其他对象的系列；补齐系列后才可从该对象运行对应压力情景。证据：`composite/evidence/browser-regression.json#handoff`。
- S002 至 S004 尚未登记 M07 多视图数据包，S003 尚未登记 M08 Objective。统一目录可以筛选和查看这些登记状态，进入模块时明确显示不可用且不回退其他场景。证据：`composite/resources/catalog.js`。
- M08 页面操作依赖候选本地计算服务；本次因 4357/4358 已被其他工作树占用，走查服务使用 `127.0.0.1:4359`。这不是正式服务或 API 集成。
- 内置浏览器在连续执行多个 iframe 交互时仍可能触发单次执行超时；本轮已改为单视口、单页面和单交互分段验证。证据：`composite/evidence/browser-regression.json#browserToolingNote`。
- 总装范围不包含正式服务、API、数据库、Foundation、CI 或实施分支变更；候选结果不会自动进入这些范围。

本文件只记录候选总装的结构、合同与证据状态，不扩张为模块评审、场景验收、生产联调或一期验收结论。
