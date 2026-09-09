# M07 业务全景落地与验收

本轮在用户明确要求「先提交未提交内容、清理无用文件和分支、之后落地方案」后，转为实施与验收。实际修改的是实施工作区，未以旧审查快照替代本轮修复源码。

- 实施目录：`/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0`
- 分支：`codex/prototype-v1.3.1-composite`
- 业务全景实施提交：`db8fe5c3`。
- 既有实施内容检查点：`f4a94fcb`。既有审查证据检查点：`09e4dca5`。
- 本轮证据：[browser-result.json](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/m07-business-v14/browser-result.json)
- 源码指纹：[SOURCE-FINGERPRINTS.json](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/m07-business-v14/SOURCE-FINGERPRINTS.json)
- 详细使用逻辑：[M07-BUSINESS-GUIDE.md](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.4/M07-BUSINESS-GUIDE.md)

## 验收结论

本轮已验证的 M07 业务路径无未解决阻断。通过结论限于下表的实际操作范围，不代表重新完成全平台独立审查。

M07 改为「业务全景」：36 个主要业务对象进入目录，连同下探对象共 57 个对象、54 条关系、31 条业务时序、4 项业务事件。目录不再以技术质量、资料完整度和候选关系核验作为业务主线。

审批和执行复用原 M04 事项；没有新增平行任务存储。报告接收原始数值和逐字段来源，单对象报告范围与返回后的探索范围分别保存。M07 不因办理完成而改变融资成本或风险分档。

## 实操中发现并修正的问题（按严重度）

### P1：单对象报告返回会覆盖原探索对象集

- 复现：选择环保测试公司1与公司4比较，回到公司4全景，加入报告，再点内容块「返回来源」。
- 修正前：报告对象范围正确为公司4，但返回时原来的两对象探索范围缩成一个对象，妨碍继续比较。
- 修正：保留报告本身的单对象范围；返回时通过完整探索 URL 恢复对象集、当前对象、视图和时间。
- 验收：浏览器确认恢复 `ENT-017, ENT-020`，当前对象仍为 `ENT-020`；另增报告返回回归测试。
- 证据：[15-report-return-scope.json](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/m07-business-v14/logs/15-report-return-scope.json)。相关源码为 `composite/shared/report-editor.js`。

### P2：贷前仍可进入资料完整度时序

- 复现：打开申请主体A，原时序入口展示资料完整度的历史数值。
- 影响：继续把数据准备工作作为业务人员的主要分析对象，违反本轮设计约束。
- 修正：从 M07 展示投影移除资料完整度序列，保留资产负债率等业务事实及适用比较。
- 验收：A、C 不显示资料完整度、时序或地图入口；B、D 的资料补齐剧情不进入目录。
- 证据：[19-preloan.png](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/m07-business-v14/screenshots/19-preloan.png)。相关源码为 `composite/modules/m07/business.js`。

### P2：对象时序时点数与持仓截至日使用了全目录范围

- 复现：信息科技费用只有4个预算观测，原刷选器却显示全目录81个日期；持仓A显示了投资数据集的2026年截至日，而自身最近观测在2025年。
- 影响：用户可能误判观测密度和数据时效。
- 修正：时序只读取当前对象业务观测；持仓截止日取其实际最近观测日期。
- 验收：预算显示4个实际时点；持仓B显示79个；持仓A目录截至日为2025-12-31。
- 证据：[18-budget-history-final.json](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/m07-business-v14/logs/18-budget-history-final.json)、[21-holding-history.json](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/m07-business-v14/logs/21-holding-history.json)、[29-final-directory.json](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/m07-business-v14/logs/29-final-directory.json)。相关源码为 `composite/modules/m07/app.js`。

### P2：初次全景遗漏原决策中心的风险处置事项

- 复现：首次进入公司4全景只有融资优化待办，打开原决策中心后才出现已有的专项风险处置待办。
- 修正：初始只读事项投影补齐原 M04 portfolio bootstrap 与 S003 adapter 的既有记录；已运行的 M04 状态优先于初始投影。
- 验收：初始投影包含7个原申请、2个原待办；完成融资待办后只改变对应办理状态，风险处置待办独立保留。
- 证据：[decision-initial-native.json](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/m07-business-v14/decision-initial-native.json)、[26-final-progress-320.png](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/m07-business-v14/screenshots/26-final-progress-320.png)。相关源码为 `composite/modules/m07/resources/decision-seed.json`。

### P3：目录与二级导航选中态不同步

- 复现：从全景返回对象发现，二级导航仍高亮对象全景。
- 修正：M07 路由同步消息同时刷新平台二级导航。
- 验收：面包屑、二级导航和实际目录一致；窄屏文案统一为业务全景。
- 证据：[29-final-directory.png](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/m07-business-v14/screenshots/29-final-directory.png)。相关源码为 `composite/s001-e2e-integration/app.js`。

## 业务覆盖与实测结果

| 场景 | 实际操作与结果 |
| --- | --- |
| 业务目录 | 搜索、类型目录、打开对象；未出现资料缺失、资源质量、未核实发行人或管理人候选剧情 |
| 企业全景 | 公司4展示余额393.134亿元、成本原值2.880984%、75笔、风险23.05分与红灯；业务页面按显示精度呈现，口径面板保留来源精度 |
| 原事项闭环 | 打开 `TD-6872111633` → 确认承接 → 开始处理 → 填写完成结果 → 确认完成 → 返回 → 刷新；原任务反馈可见，成本和风险不被改写 |
| 共同指标比较 | 公司1、公司4共同指标可比；不同规则的通用数值容器不作为共同指标；2026区间仍明确标注2025静态快照 |
| 关系下探 | 公司4为图中心，点融资明细集合切换当前节点；已选两对象范围和图中心均保持，加入范围须显式操作 |
| 企业地图 | 从适用企业下探，SVG城市布点与对象关系可见；明确保留演示位置说明 |
| 报告 | 原始数值、单位、逐字段截至日与来源进入内容块；修改文字、预览、实际下载HTML，返回恢复原范围 |
| 问数 | 公司4切换融资视角，进入问数后定位当前企业；实际提问单位553成本、余额与高成本占比并得到结果，再返回公司4 |
| 预算 | 信息科技费用105.4%超支保留；年度实际/预算依据可见，时序显示4个实际业务观测 |
| 贷前 | A、C保留资产负债率和业务复核优先级；移除资料完整度时序，未提供无关地图入口 |
| 投后 | 持仓B当前观测和79个历史观测可查看；产品与持仓关系可下探 |
| 保存与刷新 | 保存「公司4融资业务跟踪」，刷新后从保存记录重新打开，恢复当前对象和全景视图 |
| 屏幕尺寸 | 1440×900、1280×720、390×844、320×844均操作当前情况与办理进展，未见页面横向溢出；检查实际截图 |

浏览器使用独立端口4464/4462/4463和独立CDP会话4466，从平台Shell进入，未复用主窗口浏览器。M07本轮未注入WebGL降级；其地图为SVG，不能据此推断驾驶舱MapLibre/WebGL全量通过。

本轮重新运行 `npm test`：129/129通过；`npm run build`成功。构建保留原联合态势大包体积提示。测试日志与实际浏览器操作日志都在 [实施证据目录](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/m07-business-v14)。早期失败步骤保留在日志中，后续修正以本报告列出的复测证据为准。

## 清理与保留边界

- 提交既有v1.3.2、v1.4源码、修复记录和审查证据后再实施。
- 删除已合并旧分支 `codex/prototype-v1.3.0-composite`，保留4个活跃工作区及其分支。
- 审查输出中的40份一致依赖目录改为可复用链接；关闭的浏览器临时资料、可重建dist/runtime清理，截图、下载、日志和实际审查源码保留。
- 审查输出约2.6GB降至1.1GB。可复用浏览器二进制移至系统临时目录；未删除用户浏览器记录。
- 原预览服务因本轮HTML变更自动追加的watcher日志改为忽略并保留在磁盘；历史内容仍可从检查点读取，不停止用户原服务。
- 没有推送、部署、修改冻结v1.1基线，也没有把旧审查快照冒充本轮修复。

## 验收范围限制

本轮验证的是M07业务呈现与相邻模块交接，没有重新全面验收驾驶舱WebGL、全部M08模型流程或所有原审批异常分支。M07没有新增行动创建引擎、真实银行执行或新的数据更新机制；其业务动作进入原系统已有事项与分析路径。
