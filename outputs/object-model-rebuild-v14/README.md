# 对象发现与模型算法重构：本轮证据

完成日期：2026-09-11（Asia/Shanghai）。实施分支 `codex/prototype-v1.3.1-composite`，工作区 `prototype-composite-v1.3.0`，基线 `8b9eca20`。用户参考截图作为布局参考，不作为指令源。

## 已实现的用户操作

- 对象发现采用左侧类型与数量、主区域类型卡。企业统一23个，金融产品4个、产品汇总持仓3个；标题改为“探索你的业务世界”，删除三张重复统计卡。
- 企业类型进入原融资与风险地图，展示地图、关系网络、成本 × 历史风险、对象明细四个并列视图。原明细清单下沉到这里；21家企业有金融视角，另两家申请主体在完整明细中按自身口径展示。
- 对象全景一级菜单放到本体管理下方，仅保留对象发现/对象全景两个子入口；取消单对象画像和各业务页签独立占用的导航窗格。
- 企业选中后自动显示相关银行、名称与球面大圆连接线。每条路径64段/65点，选择时约2.4秒流动标记，结束或离开地图即停止；没有永久动效循环。
- 历史风险、成本、到期压力切换时，左侧卡片排序、字段、状态色与地图统一变化。银行敞口按金额排序，用蓝色表达敞口，未发明风险阈值。
- 模型目标与优化更名模型与算法，主流程只围绕融资成本预测、债务结构优化、债务风险监测三个目标。每目标独立创建、选择快照/企业、维护算法、执行核验、发布不可变版本、使用、回看和导出。
- 企业探索可使用模型发布版本。模型中的运行可传回企业探索；风险监控使用后形成对象事件，可从事件返回具体模型运行。

## 实际验证

| 验证 | 结果 | 证据 |
| --- | --- | --- |
| 单元、数据、契约与生命周期测试 | 171通过，0失败 | `unit.log` |
| 构建 | 成功，既有大包提示仍在 | `build.log` |
| 浏览器业务路径 | 37检查点通过，页面异常0 | `final/result.json`、`browser.log` |
| 最终企业列表标题布局 | 通过 | `final/layout-verification.json` |
| WebGL地图 | Chrome真实WebGL上下文、globe投影；本环境为ANGLE/SwiftShader软件渲染 | `final/bank-arc-evidence.json` |
| 银行连线停止后空闲 | 3秒任务0.000598秒、脚本0秒、DOM变更0 | `final/map-with-bank-links-idle.json` |
| 模型界面空闲 | 3秒任务0.026573秒、脚本0秒、DOM变更0 | `final/model-studio-idle.json` |
| 主预览源码一致性 | 18项响应核对通过 | `main-preview-verification.json` |
| 本轮进程清理 | 4532/4533/4534/4536关闭，4494保留 | `cleanup.json` |

浏览器使用独立4534/4532/4533服务、CDP4536和全新浏览器上下文，默认动效偏好。实际点击、输入、代码编辑、发布、运行、下载、取消、刷新、下探与返回；没有操作主窗口的浏览器存储。覆盖1440×900、1280×720、390×844、320×844，并查看代表性最终截图。

三个目标均实际创建新目标、选择企业001/020、核验、发布1.0.0，再使用公司4形成结果；下载的版本包核对版本ID及完整对象范围。成本目标另验证编辑算法函数、修改参数、旧版本结果隔离、1.1.0发布、回切1.0.0、停用/启用、重复版本拒绝。风险目标验证企业使用、对象事件、精确运行回查及归档/恢复。

故障测试实际执行错误代码和无限循环；错误给出可见反馈，无限循环在约4秒后终止，停止按钮形成取消记录。失败与取消不会产生可发布的核验凭证。单元测试另覆盖旧页面修订冲突、输入范围拒绝、金额/基准约束、版本定义不可改写、停用最新监控结果不恢复更旧提示。

## 关键材料

- `final/01-explore-business-types.png`：类型目录与导航。
- `final/02-enterprise-header-final.png`：企业探索最终布局。
- `final/03-banks-and-geodesic-links.png`：银行、球面连接线与流动标记。
- `final/04-cost-specific-order-and-cards.png`、`final/view-signals.json`：不同视角的排序/卡片/颜色。
- `final/05-enterprise-network.png`、`final/05-enterprise-matrix.png`、`final/05-enterprise-list.png`：三种并列视图。
- `final/08-model-goals-catalogue.png`：模型目标目录。
- `final/09-algorithm-failure-feedback.png`、`final/10-infinite-code-stopped.png`：真实失败和超时反馈。
- `final/11-*-validation-result.png`、`final/12-*-published-version.png`、`final/13-*-version-used.png`：三个目标的核验、发布与使用。
- `final/cost-version.json`、`final/structure-version.json`、`final/risk-version.json`：实际下载的固定版本包。
- `final/15-monitor-result-consumed-by-enterprise.png`、`final/16-published-monitor-event-lineage.png`、`final/17-event-returns-to-model-run.png`：消费与事件闭环。
- `final/18-algorithm-320.png`、`final/19-versions-320.png`、`final/20-use-320.png`：窄屏模型交互。
- `source-fingerprints.json`：所有修改源码指纹；`SHA256SUMS.txt`：证据指纹。

`final/`是最终结果，`pilot/`是早期试跑。`attempts/`保留试跑选择器/等待适配失败和旧契约断言日志，不代表当前结果失败。最后的企业标题布局调整使用单独 `final-layout.mjs` 验证与截图，未改变业务逻辑。

## 边界

成本预测采用现金流与利率情景算法，未虚构未来实际值或回测准确率。结构优化为约束启发式建议，未宣称全局最优或已执行。风险提示不改变历史评分。参考输入为21家企业与84笔明示的模拟借款，原台账借据和M07本体业务目录另有来源，界面分别列明。

算法使用JavaScript Worker执行；发布、版本与运行在浏览器本地保存，不是后端生产模型部署。旧Python/Git模型界面的源文件与后端保留供原型历史追溯，本轮不将其旧测试通过当作新主流程的验证。后台实时监控、外部事件订阅、真实融资执行不在本次接入范围内。

本轮WebGL有实际画面与交互，使用软件渲染，未声称完成硬件GPU或所有设备验证。上述空闲数据是独立页面主线程采样，不代表全机CPU，也不替代此前未复现进程占用问题的专门调查。

## 复跑

先用空闲端口启动独立服务与浏览器，然后从实施根目录：

```sh
BASE_URL=http://127.0.0.1:4534 CDP_URL=http://127.0.0.1:4536 OUTPUT_DIR=outputs/object-model-next node designs/prototype-work/v1.4/tests/world-model-browser.mjs
npm --prefix designs/prototype-work/v1.4 test
npm --prefix designs/prototype-work/v1.4 run build
```

前轮的对象/画像回归入口已转向当前导航的完整业务脚本，历史证据保持不变。
