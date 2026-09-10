# 对象发现、企业探索与模型算法重构验收

日期：2026-09-11（Asia/Shanghai）。实施工作区 `prototype-composite-v1.3.0`，分支 `codex/prototype-v1.3.1-composite`；完成提交 **`b990d448`**，基线 `8b9eca20`。本轮按用户要求实施并实操验证，固定审查目录只保存报告。用户提供的Palantir截图用于参考类型目录与结果布局，没有将图中内容当作任务指令。

## 本轮要求与实现

| 用户要求 | 当前行为 | 证据 |
| --- | --- | --- |
| 恢复对象类型，企业统一分类与数量 | 左侧类型目录与主区域类型卡：企业23个、金融产品4个、产品汇总持仓3个。企业点击进入企业探索，名称改为“探索你的业务世界”，原三张统计卡删除 | [类型目录](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-model-rebuild-v14/final/01-explore-business-types.png) |
| 对象明细下沉，与地图等视图并列 | 企业探索有地图、关系网络、成本 × 历史风险、对象明细四个并列视图。完整明细可查看事件、关联业务并打开画像。21家为金融视角，另2家申请主体按贷前口径保留在明细 | [企业探索](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-model-rebuild-v14/final/02-enterprise-header-final.png)、[明细](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-model-rebuild-v14/final/05-enterprise-list.png) |
| 简化导航并调整一级菜单位置 | 对象全景位于本体管理下方，只显示对象发现/对象全景两个子入口。单对象画像、各业务页签不再独占导航窗格；总览标题改为对象全景 | [导航与全景入口](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-model-rebuild-v14/final/07-object-panorama-entry.png) |
| 选企业显示银行和地球弧线动效 | 自动显示该企业关联银行、名称及球面大圆路径；每线64段/65点，约2.4秒流动标记，结束/隐藏/离开地图停止 | [银行连线](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-model-rebuild-v14/final/03-banks-and-geodesic-links.png)、[WebGL与几何证据](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-model-rebuild-v14/final/bank-arc-evidence.json) |
| 左侧随视角重排、换色与换内容 | 历史风险、成本、到期压力采用各自判定与指标；列表和地图共用同一信号。敞口按金额排序并用蓝色，未将未经定义的集中度当作风险分档 | [成本视角](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-model-rebuild-v14/final/04-cost-specific-order-and-cards.png)、[四种排序及卡片快照](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-model-rebuild-v14/final/view-signals.json) |
| 删除地图第二排横向菜单 | 原业务切换工具条及统计条不再占据地图顶部；分析视角、窗口与筛选归入左侧，地图上方保留展示视图与必要操作 | [地图布局](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-model-rebuild-v14/final/02-enterprise-header-final.png) |
| 模型与算法围绕三个目标全闭环 | 重构目标目录及每目标的概览、数据、算法核验、版本、使用记录。三个目标均可新建、编辑代码/参数、核验、发布、切换/停用、运行与导出，且业务页面能消费相同发布版本及运行 | [目标目录](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-model-rebuild-v14/final/08-model-goals-catalogue.png)、[模型使用进入企业](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-model-rebuild-v14/final/15-monitor-result-consumed-by-enterprise.png) |

企业目录总数与地图金融范围分别说明，未给申请主体补造融资或坐标。地图上的银行关系来自84笔明示模拟借款；原台账借据、本体绑定机构仍在对象画像中按各自来源展示，未把两类数据混称为同一份原始借据。

## 三个模型目标的实际算法

| 目标 | 本轮实际计算 | 核验内容与输出边界 |
| --- | --- | --- |
| 融资成本预测 | 按借款现金流、浮息变化、到期续作比例和利差预测成本率、利息与平均本金占用 | 校验基准、观察日、预测期、利息与差额、逐笔汇总。没有未来实际标签，不虚构回测准确度 |
| 债务结构优化 | 按到期优先与成本优先，在调整额度和整体成本上限内生成逐笔期限调整建议 | 校验借款本金、调整额度、期限、成本差额及调整后占比。约束不足时保留部分改善，不声称全局最优或交易已执行 |
| 债务风险监测 | 结合历史评分、有效授信/现金、到期缺口和成本偏离输出关注等级及原因 | 不改写历史评分/分档；提示必须有具体条件和数值。发布并实际使用后才向对象事件提供本地模型提示 |

统一使用绑定快照 `DATA-V14-20251231-DEMO-1` 与观察日2025-12-31，源金额百万元转换为算法输入元。内置三个参考版本可直接体验，新创建的目标使用同一真实运行、核验和发布机制。

工作草稿与发布快照分离。版本保留目标定义、代码、参数、数据范围、核验编号、指纹、发布人与时间。运行另保留具体企业和本次实参；风险策略阈值不能在使用时任意覆盖，须通过新版本发布。页面时间按北京时间显示，导出保留标准时间戳。

## 已验证的完整闭环

浏览器为三个目标分别创建新目标，选择企业001/020、维护/核验算法、发布1.0.0、使用公司4形成具体结果，且实际下载版本包核对身份和范围。成本目标进一步发布1.1.0，回切1.0.0，并测试停用/启用。风险目标实际经过“发布 → 企业探索运行 → 对象事件 → 模型运行回查”。

- [成本目标核验](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-model-rebuild-v14/final/11-cost-validation-result.png)、[发布](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-model-rebuild-v14/final/12-cost-published-version.png)、[使用](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-model-rebuild-v14/final/13-cost-version-used.png)
- [结构目标核验](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-model-rebuild-v14/final/11-structure-validation-result.png)、[发布](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-model-rebuild-v14/final/12-structure-published-version.png)、[使用](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-model-rebuild-v14/final/13-structure-version-used.png)
- [风险目标核验](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-model-rebuild-v14/final/11-risk-validation-result.png)、[发布](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-model-rebuild-v14/final/12-risk-published-version.png)、[使用](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-model-rebuild-v14/final/13-risk-version-used.png)
- [模型提示进入对象事件](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-model-rebuild-v14/final/16-published-monitor-event-lineage.png)、[事件返回准确运行](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-model-rebuild-v14/final/17-event-returns-to-model-run.png)

## 可靠性与界面检查

| 检查 | 实际结果 |
| --- | --- |
| 错误算法代码 | 显示业务错误，运行记为失败，不允许发布 |
| 无限循环 | 约4秒后终止Worker并给出超时反馈，页面保持可操作 |
| 停止计算 | 终止当前计算，留下取消记录 |
| 未保存切换 | 继续编辑、保存切换、放弃三种明确选择 |
| 修改发布后的草稿 | 旧版本算法及结果不变，新草稿需重新核验 |
| 重复版本号 | 拒绝覆盖，原版本保持固定 |
| 版本切换/停用/启用 | 应用指针与可用性真实变更，历史版本和运行保留 |
| 目标归档/恢复 | 归档阻止新运行，恢复后继续使用 |
| 跨页面旧草稿保存 | 修订号检查拒绝覆盖更新内容 |
| 停用最新监控版本 | 不恢复更旧版本的提示；历史运行仍可追溯 |
| 320px模型步骤 | 五步分两行显示，业务参数置于代码前，表格局部横向滚动 |
| 企业探索面板关闭 | 右侧可关闭，地图恢复空间；无被隐藏的桌面关闭按钮 |

界面重构时发现原联合地图网格仍保留第二行，会将地图挤成150px高；现已统一为单行完整高度。另修正企业列表标题挤压和异步目录刷新遗漏图标。窄屏步骤原为横向滚动，截图复核后改为全部可见的两行布局。

相关源码：[模型生命周期](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.4/composite/shared/model-studio.js:168)、[算法输出校验](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.4/composite/shared/model-studio.js:109)、[视角信号与球面几何](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.4/src/exploration-view.js:4)、[企业明细](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.4/src/app.js:1058)。

## 验证范围与环境

171项测试通过，37个浏览器业务检查点通过，页面异常0，构建成功。旧固定母本指纹仍检查，明确允许本轮修改的入口单列；历史通过记录未用于替代本轮结论。

使用独立4534/4532/4533服务、独立Chrome CDP4536与全新浏览器上下文，默认动效偏好。覆盖1440×900、1280×720、390×844、320×844，实际操作与代表性截图均检查。

本轮有真实WebGL画面、globe投影、银行点和大圆线，渲染器为ANGLE/SwiftShader软件渲染；没有将其称为硬件GPU测试。3秒空闲样本中，银行动效结束后的地图主线程任务耗时0.000598秒、脚本0、DOM变更0；模型页任务0.026573秒、脚本0、DOM变更0。这些是隔离页面测量，不等于全机CPU，也不能替代此前未复现的系统进程问题调查。

## 交付与限制

算法为JavaScript Worker中的实际计算，模型发布、版本及运行保存在浏览器本地。没有接入后端生产模型部署、后台实时监控、外部事件订阅或真实融资执行。旧Python/Git模型界面的源码及后端保留作历史追溯，本轮主体验聚焦用户指定的三个目标，未重新验收其他旧模型目标。融资预测方法与结构优化性质如前述明确说明，未声称具有未经验证的机器学习预测精度或全局最优性。

4532/4533/4534/4536及本轮浏览器会话已清理，主预览4494保留。18项服务响应核对已确认4494在提供最新入口、算法与地图逻辑；静态JS/CSS按字节一致性检查，Vite转换结果按关键入口和逻辑检查。冻结发布目录未修改。

- [完整证据索引与源码指纹](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-model-rebuild-v14/README.md)
- [最终浏览器结果](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-model-rebuild-v14/final/result.json)
- [模型与算法使用说明](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.4/MODEL-ALGORITHMS-GUIDE.md)
- [对象探索使用说明](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.4/M07-BUSINESS-GUIDE.md)
- [最新原型](http://127.0.0.1:4494/)
