# 对象全景整合与业务交互验收

2026-09-10。按用户六项要求实施，源码来自实施工作区 `prototype-composite-v1.3.0`，分支 `codex/prototype-v1.3.1-composite`，完成提交 **`8b9eca20`**。固定审查目录仅保存本报告，没有使用该目录旧源码作为本轮验收对象。

本轮六项调整已落实，156项单元/数据/契约测试、30个浏览器业务检查点及构建通过。结论限定于下列覆盖范围；未把历史通过记录当作本轮证据。

## 六项要求的实现结果

| 要求 | 当前行为 | 验收依据 |
| --- | --- | --- |
| 对象发现去掉右侧栏 | 取消预览侧栏及普通浏览时的勾选框。名称、类型、地区/类别、关键指标、业务状态、事件数、关联业务和截至日进入表格/手机卡片。名称及记录行直接打开画像，事件数直达事件栏目 | [目录截图](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-panorama-20260910/final/01-directory-with-business-columns.png) |
| 地图与关系显示相关对象 | 企业连接部门、机构、业务记录；机构可查看关联企业位置及原融资借据。地图点击标记/关联卡片就地展示信息，明确点击“打开画像”才切换对象。直接关系与经业务记录连接的路径区分展示 | [地图关联信息](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-panorama-20260910/final/03-related-business-on-map.png)、[机构关联企业](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-panorama-20260910/final/04-institution-related-enterprise.png) |
| 对象内问答、取消对象报告 | 画像右侧对话可回答基本信息、指标、预算、风险、关联对象、持仓历史、办理进展及追问。答案附日期和依据，切换对象隔离会话；对象级加入报告入口移除 | [右侧问答](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-panorama-20260910/final/05-inline-object-answer.png)、[320px问答](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-panorama-20260910/final/17-object-chat-320.png) |
| 经营驾驶舱并入对象全景 | 一级导航统一为对象全景，集团、预算、风险与单对象画像使用同一导航。贷前全景呈现申请主体A/C；投资全景呈现4个产品、3个汇总持仓与实际观测。范围全景可下探对象并返回，预算可直接打开公司4画像 | [风险全景](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-panorama-20260910/final/14-risk-panorama-in-unified-module.png)、[贷前全景](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-panorama-20260910/final/16-panorama-preloan.png)、[投资全景](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-panorama-20260910/final/16-panorama-post-investment.png) |
| 换思路设计对照 | 先选基本信息/业务指标/历史走势，再在同一面板选择对象；明确显示将展示的对象。至少两对象且目的适用才执行。调整、移除统一进入面板，取消不改原结果。关闭结果返回原目录、对象或业务范围 | [目的与对象选择](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-panorama-20260910/final/10-purpose-first-comparison.png)、[产品走势](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-panorama-20260910/final/12-product-holding-trends.png) |
| 事件体现来源 | 区分本体规则、模型监控和业务事实；展示触发条件、命中值、实际时点、来源版本与运行批次。绿灯评分及普通办理日志不生成风险事件，规则/模型入口精确定位对应来源 | [来源与触发依据](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-panorama-20260910/final/07-event-sources-and-trigger-basis.png)、[本体规则](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-panorama-20260910/final/08-exact-ontology-rule.png)、[监控模型](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-panorama-20260910/final/09-exact-monitor-model.png) |

集团或投资台账是业务范围视图，企业、产品、持仓等是已绑定本体定义的对象。此次没有为合并导航创建虚构法人、账户或投资组合，也没有改写冻结发布目录及原业务数据。

## 事件来源的业务解释

用户提出的两类来源是主要来源：规则直接命中形成规则事件；模型输出满足预警条件形成模型预警。除此之外，业务系统确认的逾期、违约、评级调整等已发生事项可以成为业务事实事件，人工核实录入也应注明原始来源与证据。

本轮实际读取三条既有融资规则命中，以及现行债务风险模型的正式评估结果。模型预警依据已发布模型包中的黄/红/黑分档与预警行动条件形成；公司4展示融资成本规则命中和模型红灯预警。模型来源保留 `MODEL-S003-FORMAL-SCORE`、版本 `MV-S003-DEBT-RISK-1.0.2-FORMAL`、运行批次及结果证据；评估截至日为2025-12-31，结果形成时间与办理时间分别保留。

业务事实分类已在界面和投影边界中区分，本轮没有新增外部事件接入或伪造事实事件。普通评分属于对象状态；承接、处理和完成属于办理日志。业务事项完成不等于风险解除，后续风险变化应以新的业务数据或评估为依据。

## 实操中修正的关键问题

### P2：刷新时旧业务范围覆盖刚形成的对照

复现路径：投资业务全景 → 选择基金B/D持仓走势 → 应用 → 立即刷新。旧主壳上下文可能回填四产品范围及集合视图，覆盖当前两个产品的对照，出现“请选择业务记录范围”。

修正后，同模块已保存页面的视图由当前M07 URL恢复，主壳请求它重新发布上下文；来自其他模块的有效交接仍正常消费。验收明确断言刷新后仍为B/D、两条曲线，关闭后返回投资业务全景。

证据：[修正前失败记录](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-panorama-20260910/attempts/scope-restore-before-fix.json)、[最终业务脚本](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.4/tests/object-panorama-browser.mjs)。

### P2：监控模型来源沿用了企业目录版本，产生不兼容提示

从公司4模型事件进入模型来源时，企业目录的V2数据/语义版本与既有正式模型的源版本不同。修正为按事件引用的模型结果传入数据、语义版本和评估时点，准确定位当前正式模型；返回后保留对象、事件栏目和来源筛选。

验收同时核对模型ID、URL中的定位参数、实际选中模型及没有版本不兼容提示。对应截图见“监控模型”。

### P2：旧响应式规则隐藏了新事件列，旧全景内容不适合直接合并

旧表格按列序号隐藏窄屏字段，会把新事件列和地区列隐藏；已调整为完整表格滚动和手机业务卡片。直接沿用旧贷前/投后页面还会把资料完整度和等待评价作为主内容；这两个主入口已改用当前目录对象与实际持仓，全景不再以这些情景为主体。

验收检查九列表头可见、目录无右预览、四档尺寸可操作；贷前范围为A/C两对象，投资范围为四产品/三持仓，最新市值来自实际对象值。截图见对应目录、贷前、投资全景。

## 覆盖与数值核对

- 156项单元/数据/契约测试通过；母本45个继承文件仍验证其原始指纹，允许的本轮界面调整单独列明。驾驶舱数据除标题外保持原值。
- 30个浏览器检查点通过，无页面异常。覆盖1440×900、1280×720、390×844、320×844，使用默认动效偏好。
- 实操涵盖目录、地图相关机构、机构关联企业、对象问答/追问、会话隔离、取消对照、指标/走势/混合信息、立即刷新恢复、五业务全景与对象往返、模型读取失败及重试。
- 原M04待办实际承接、开始、完成并填写反馈，M07回读完成进展；事件数量不因新增办理日志增长。证据：[办理闭环](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-panorama-20260910/final/09b-action-complete-without-false-new-event.png)。
- 公司4费用预算1,097.70万元、实际费用861.7265万元；预算总览与画像在各自显示精度下一致。基金D最近市值源值200156588.1036元，显示200,156,588.1元。投资范围有208条实际历史观测，不跨不同截至日虚构合计或产品收益排名。
- 构建成功，保留既有大包提示。四秒对象页空闲窗口内，主线程任务耗时0.00108秒、脚本耗时0、DOM变更0；该采样不代表全机CPU或全部页面的性能结论。

## 边界与交付

问答是基于当前对象已发布事实的原型能力，支持列明的业务主题，不是通用大模型或收益预测。模型预警按固定正式评估批次读取，没有新增后台实时监听；候选与压力试算不混入正式风险事件。地图为已有城市级演示位置和省界，不含街道及真实注册地址。预算归属公司4沿用此前已说明的演示映射。

本轮未重新全面验收联合地图的WebGL链路、全部模型训练/发布及所有审批异常分支。测试使用独立4524/4522/4523服务和CDP4526浏览器，均已关闭；用户4494服务与浏览器业务状态保留。4494提供的11份JS/CSS与已提交实施源码逐字节一致，HTML入口也已核对。

- [最终浏览器结果](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-panorama-20260910/final/result.json)
- [源码指纹与证据索引](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/object-panorama-20260910/README.md)
- [对象全景详细使用说明](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.4/M07-BUSINESS-GUIDE.md)
- [最新原型（4494）](http://127.0.0.1:4494/)
