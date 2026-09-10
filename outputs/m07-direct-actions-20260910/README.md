# M07 直接操作与画像内地图验收证据

2026-09-10。实施工作区 `prototype-composite-v1.3.0`，分支 `codex/prototype-v1.3.1-composite`；基线 `a4d78478`。本轮按用户授权实施改动，未使用固定审查工作区的旧源码作为验收对象。

## 最终行为

- 名称直接打开画像；行内其他区域预览；勾选后底部提供对比企业/产品、查看持仓走势或并排查看。
- 同类且同口径的对象显示共同指标；混合对象显示通用基本信息。四个以内按列对照，大集合按行分页，最后一页不改变布局。
- 返回目录保留选择、筛选和滚动位置，刷新不自动进入单个对象。对照结果可打开画像再回原视图；报告包含完整选中范围。
- 画像地图直接滚轮缩放、拖动、手机双指缩放、键盘平移；提供定位对象及全国复位。地名避让，地图位置可刷新和书签恢复。
- 地图采用已有本地省界与城市级演示坐标，不依赖WebGL或外部瓦片，不包含街道和真实经营地址。

## 本轮实际验证

| 验证 | 结果 | 证据 |
| --- | --- | --- |
| 单元与业务测试 | 147通过、0失败 | `unit.log` |
| 构建 | 成功；既有大包提示仍在 | `build.log` |
| 新交互专项 | 14检查点通过、页面异常0 | `final/result.json`、`browser.log` |
| 画像与跨模块回归 | 20检查点通过、页面异常0 | `portrait-regression/result.json`、`portrait-regression.log` |
| 地图书签与空闲采样 | 相机恢复一致；4.004秒窗口内主线程任务0.014621秒、脚本0.000289秒 | `map-bookmark-idle.json` |
| 最新主预览 | 4494的四份JS/CSS与实施源码逐字节一致；HTML新增操作栏和地图脚本已上线，本地Shell会向HTML注入适配代码 | `preview-source-verification.json` |
| 清理本轮服务 | 4512/4513/4514/4516/56940已关闭，4494保留 | `process-cleanup.json` |

独立服务：4514/4512/4513；独立浏览器CDP：4516，新建浏览器上下文。全部业务操作从平台Shell进入，使用实际点击、滚动、输入、刷新、触摸事件及HTML下载。没有操作主窗口的浏览器会话。

专项包括：空选/单选/双选、名称与预览区域区分、移除标签、跨筛选累计、四指标对照、两产品八行报告、报告往返后目录刷新、混合对象基本信息、企业对照、九对象末页布局、滚轮不带动页面或改变范围、拖动、定位、全国复位、加减键与方向键、刷新/栏目恢复、空闲DOM变更为0、移动端双指缩放和底部选择栏可见。

画像回归包括：产品五类预览、同尺度历史与指标切换、空时间段不补旧值、保存/刷新、完整双产品时序HTML导出、本体V2画布精确定位及返回、M04事项承接/处理/完成并回读反馈、事件实际办理时间、企业预算、1440×900/1280×720/390×844/320×844的画像和选择弹窗。

基金D最近市值源值为 `200156588.1036`，界面显示 `200,156,588.1 元`。基金B与D比较的是明确关联的汇总持仓规模及价格，不作为产品收益率或投资建议。

## 关键截图

- `final/01-direct-product-actions.png`：直接操作栏。
- `final/02-direct-comparison-result.png`：默认共同指标对照。
- `final/03-direct-holding-trends.png`：两产品关联持仓走势。
- `final/04-mixed-object-direct-view.png`：混合对象基本信息。
- `final/08-inline-map-320.png`：320px内地图和可读地名。
- `final/09-mobile-pinch-map.png`：双指缩放后。
- `final/10-mobile-selection-actions.png`：窄屏底部操作栏。
- `final/12-large-selection-table.png`：九对象对照的最后一页。
- `screenshots/06-final-inline-map-bookmark.png`：画像地图和书签恢复。

`final/`与`portrait-regression/`是最终结果。`screenshots/01`至`05`、`logs/`是实施过程中人工式浏览器操作的证据。`before-fix-*`记录了刷新后被旧对象引用带离目录的复现；`portrait-selector-adaptation*`记录旧脚本选择器同时命中名称和箭头的适配失败，不是最终产品失败。

## 复跑

在实施根目录，先启动独立4514/4512/4513服务以及CDP4516浏览器，再运行：

```sh
node designs/prototype-work/v1.4/tests/direct-actions-browser.mjs
BASE_URL=http://127.0.0.1:4514 CDP_URL=http://127.0.0.1:4516 OUTPUT_DIR=outputs/m07-direct-actions-next/portrait-regression node designs/prototype-work/v1.4/tests/portrait-browser.mjs
```

源码精确指纹见 `source-fingerprints.json`。脚本通过不替代地图截图与布局检查，本轮已实际查看代表性桌面/窄屏截图。性能样本不是全机CPU百分比，不代表所有页面和设备的性能结论。本轮未重新验收驾驶舱完整WebGL链路、街道瓦片或全部M08训练/审批异常分支。
