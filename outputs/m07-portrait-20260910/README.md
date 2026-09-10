# 对象画像与性能修正证据

- `final/result.json`：全新隔离会话中的20个浏览器检查点。
- `idle-before.json`、`idle-after.json`、`idle-final.json`：同一环境的4秒空闲采样；分别为修正前、消除观察器循环后、停止永久装饰动画后。
- `process-cleanup.json`：确认工作目录后停止的9个原型服务，不包含其他应用进程。
- `unit.log`：145项测试通过；`build.log`：构建成功。
- `final/product-parallel-report.html`：原报告编辑器实际下载的双产品时序报告。
- `event-report.json`：事件栏目交接报告的实际内容块。
- `palantir-reference.json`：本轮读取的Palantir Object Views与Object Explorer公开文档。
- `SOURCE-FINGERPRINTS.json`：实现与测试的源码指纹。
- `screenshots/`、`logs/`：中间检查和操作证据，最终结果以`final/`为准。

完整验收报告位于审查工作区 `outputs/review-v1.4/M07-PORTRAIT-AND-PERFORMANCE-20260910.md`。业务操作说明位于实施目录 `designs/prototype-work/v1.4/M07-BUSINESS-GUIDE.md`。
