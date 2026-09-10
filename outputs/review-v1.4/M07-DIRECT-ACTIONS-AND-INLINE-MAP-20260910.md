# M07 直接对比与画像内地图：实施验收

日期：2026-09-10。按用户本轮授权实施并验证，源码来自实施工作区 `prototype-composite-v1.3.0`，分支 `codex/prototype-v1.3.1-composite`，基线 `a4d78478`，完成提交 **`9ec2c68f`**。本报告保存在审查目录；未把该目录中的旧快照当成本轮修复结果。

本轮范围为多对象选择到结果的操作路径、单对象画像内地图，以及相关上下文和跨模块回归。147项测试、34个浏览器检查点和地图书签补查通过。限定在本轮覆盖范围内，未发现尚未解决的P0/P1/P2/P3问题；这不是对整个v1.4的全面验收结论。

## 已处理的问题（按严重度排序）

### M07-DIRECT-01 / P2：多选后仍需进入工作台选择展示方式

- 位置：M07对象发现；基金B、基金D及同类企业。
- 复现原路径：在目录勾选两个产品，点击“比较 / 平铺”，再选择指标对比或时序并列。用户在勾选时不能直接确认下一步结果。
- 用户影响：操作意图不清，增加跳转；混合类型与同类可比对象共用入口，容易误以为所有对象都能做数值比较。
- 修正：勾选后显示常驻操作栏，按对象类型和共同业务口径提供“对比企业”“对比产品”“查看持仓走势”“并排查看”。未勾选不自动纳入全部筛选结果，单选直接打开画像。
- 验收标准与结果：两产品直接打开四项关键指标对照；共同历史按相同时间范围和纵轴并排；混合类型只提供通用信息；超过四个优先表格，九对象最后一页仍按对象行展示。移除标签、清空、跨筛选累计和返回保留均通过。
- 证据：[直接操作栏](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/m07-direct-actions-20260910/final/01-direct-product-actions.png)、[默认产品对照](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/m07-direct-actions-20260910/final/02-direct-comparison-result.png)、[混合对象](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/m07-direct-actions-20260910/final/04-mixed-object-direct-view.png)。实现：[app.js:969](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.4/composite/modules/m07/app.js:969)。

### M07-DIRECT-02 / P2：画像地图为静态展示，操作位置需要另开视图

- 位置：环保测试公司4 `ENT-020` 全景画像中的“地理位置”。
- 复现原路径：打开企业画像，在地图上滚轮或拖动，不能操作地图；需要点击“查看地图”切换视图。
- 用户影响：查看位置打断画像阅读，需要额外下钻和返回。
- 修正：画像内直接支持滚轮缩放、拖动、手机双指缩放、键盘方向键和加减键；提供定位对象和全国复位。相机按对象保存，手势结束只更新位置状态和URL，不重绘整页。
- 验收标准与结果：实际滚轮缩放没有带动外层页面，也没有改变对象、分析范围或栏目；拖动、定位、全国复位、按钮和键盘均生效。刷新、栏目切换、书签恢复后位置一致。两秒静止窗口内地图DOM变更为0，退出时断开观察器与事件处理。
- 证据：[缩放与拖动](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/m07-direct-actions-20260910/final/06-inline-wheel-and-drag.png)、[手机双指缩放](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/m07-direct-actions-20260910/final/09-mobile-pinch-map.png)、[书签恢复截图](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/m07-direct-actions-20260910/screenshots/06-final-inline-map-bookmark.png)。实现：[inline-map.js:3](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.4/composite/modules/m07/inline-map.js:3)。

### M07-DIRECT-03 / P2：返回目录后刷新，被旧对象引用带回详情

- 位置：双产品对照 → 报告 → 返回来源 → 关闭对照 → 刷新平台。
- 复现：选择基金B与D，生成对照报告，返回来源，关闭对照，再刷新。修正前回到单个产品或原对照页，未保持目录位置。
- 原因与影响：显式对象集被直接解释成“进入探索”；报告往返留下的旧 `objectRef` 又在 `activeObjectRef:null` 时被当作当前对象，覆盖用户已返回目录的意图。
- 修正：尊重明确的目录路由；明确清空的当前对象不回退到旧交接引用。进入目录时清除“从对照进入画像”的返回标记。
- 验收标准与结果：同一路径刷新后仍为对象发现，两个产品的勾选、产品类型筛选和目录滚动位置均保留。报告与原对照仍可正常往返。
- 证据：[修正前刷新状态](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/m07-direct-actions-20260910/before-fix-directory-after-reload.json)、[最终刷新状态](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/m07-direct-actions-20260910/final/directory-after-reload.json)。实现：[app.js:541](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.4/composite/modules/m07/app.js:541)。

### M07-DIRECT-04 / P2：新增选择栏在窄屏被长列表挤出可视区

- 位置：本轮实施过程中的320px对象发现页。
- 复现：切到窄屏，勾选两个产品。旧手机样式将目录改为普通块布局，选择栏被排在完整列表后，必须滚到底部才能操作。
- 用户影响：勾选后看不到可执行操作，削弱多选入口的可发现性。
- 修正：目录采用受约束的滚动网格，结果区独立滚动，操作栏占独立底部行；名称标签可横向滚动。
- 验收标准与结果：320px下，双产品选择栏的上下边界均位于模块视口中；可直接点击持仓走势。页面没有整体横向溢出。
- 证据：[窄屏操作栏](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/m07-direct-actions-20260910/final/10-mobile-selection-actions.png)。源码依据：[旧手机规则](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.4/composite/modules/m07/styles.css:806)、[本轮布局覆盖](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.4/composite/modules/m07/styles.css:1191)。

### M07-DIRECT-05 / P3：窄屏地图地名密集重叠

- 位置：本轮实施中的画像地图，320px宽、约2.3倍缩放。
- 用户影响：相邻省名重叠，城市定位文字不易阅读。
- 修正：文字保持屏幕字号，优先保留位置附近标签；计算标签边界，避开已显示地名与对象标记。
- 验收标准与结果：三个缩放布局中可见省名无两两重叠；城市名称、标记和操作按钮清晰可用。
- 证据：[最终320px地图](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/m07-direct-actions-20260910/final/08-inline-map-320.png)。实现：[inline-map.js:27](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.4/composite/modules/m07/inline-map.js:27)。

## 实际覆盖与业务闭环

独立服务端口4514/4512/4513，独立浏览器CDP4516。验证从平台Shell进入，通过真实点击、勾选、输入、滚轮、拖动、触摸、刷新和HTML下载进行；没有复用主浏览器会话。

| 检查范围 | 实际结果 | 证据 |
| --- | --- | --- |
| 新交互、返回、刷新、地图、窄屏 | 14检查点通过，页面异常0 | [专项结果](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/m07-direct-actions-20260910/final/result.json) |
| 原画像、预算、预览、本体、行动、报告 | 20检查点通过，页面异常0 | [回归结果](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/m07-direct-actions-20260910/portrait-regression/result.json) |
| 两产品关键指标报告 | 保留两个产品、四项指标共八行，含源精度数值 | [报告内容块](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/m07-direct-actions-20260910/final/comparison-report.json) |
| 两产品走势报告 | 两个对象与两条序列完整导出，可返回来源 | [实际下载HTML](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/m07-direct-actions-20260910/portrait-regression/product-parallel-report.html) |
| M01往返 | 企业画像进入已发布V2画布，定位企业类型，返回原对象 | [画布截图](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/m07-direct-actions-20260910/portrait-regression/09-focused-ontology-canvas.png) |
| M04闭环 | 承接、开始处理、完成并填写反馈，M07回读状态与办理记录 | [行动反馈](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/m07-direct-actions-20260910/portrait-regression/11-action-progress-return.png) |
| 147项测试与构建 | 通过；构建保留既有大包提示 | [测试日志](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/m07-direct-actions-20260910/unit.log)、[构建日志](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/m07-direct-actions-20260910/build.log) |

覆盖1440×900、1280×720、390×844、320×844。除脚本断言外，实际查看了桌面产品对照、窄屏选择栏、窄屏地图和桌面地图的最终截图。

地图书签恢复的相机值完全一致。4.004秒空闲采样窗口内，CDP主线程任务耗时0.014621秒、脚本耗时0.000289秒；这是隔离页面的采样，不是全机CPU百分比。详见[地图书签与空闲记录](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/m07-direct-actions-20260910/map-bookmark-idle.json)。

## 边界与交付

- 地图继续使用城市级演示坐标及本地省界，支持直接交互，不提供街道层级或真实注册地址。本轮未重新验收驾驶舱完整WebGL链路。
- 产品B与D展示的是关联汇总持仓。持仓市值、投资金额、损益和现价不冒充收益率；差异标记不代表优劣排名。日期、单位和来源精度保留。
- 本轮未全面复查全部M08训练、全部审批异常路径及其他模块所有边界；已覆盖与当前改动相关的M01/M04/M06往返。
- 旧画像脚本首次因新增名称按钮导致选择器同时命中名称和箭头，已修正选择器并重新完整通过；该适配失败与产品缺陷分开保存。
- 实施分支提交 `9ec2c68f`，审查工作区仅新增本报告。冻结发布目录未修改。
- 已关闭本轮4512/4513/4514/4516/56940及 `m07direct` 浏览器会话，保留主预览4494。服务提供的四份JS/CSS与已提交源码逐字节一致，HTML新增操作栏与地图入口也已核对。

材料：[源码指纹](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/m07-direct-actions-20260910/source-fingerprints.json)、[完整证据索引](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/m07-direct-actions-20260910/README.md)、[使用说明](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.4/M07-BUSINESS-GUIDE.md)、[主预览](http://127.0.0.1:4494/)。
