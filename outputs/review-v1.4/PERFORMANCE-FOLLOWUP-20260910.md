# 原型进程占用复查

日期：2026-09-10。检查实施工作区提交 `9ec2c68f` 的实际源码。本轮未修改业务源码，尚未复现用户所述的持续高占用，不能认定问题已修复。

## 当前证据

| 检查 | 本轮结果 |
| --- | --- |
| 主服务4494、PID188 | CPU采样约0%，服务正常 |
| 用户已打开的M07页面 | 浏览器控制台无警告/错误；保留原页面状态 |
| 默认动画模式、五组空闲测量 | 首页、目录、画像、勾选后目录、双标签页共享存储均未出现循环执行/重绘 |
| 四秒内页面主线程任务耗时 | 五组依次为0.003619、0.000979、0.000558、0.000598、0.001570秒 |
| 四秒内脚本、DOM与布局 | 脚本执行耗时、DOM变更增量、布局与样式重算计数均为0 |
| 首次打开 | 首页主线程约0.031秒，M07约0.131秒；M07的JS堆约14.6MB |
| 普通Chrome实操 | 另开4514测试标签，进入M07。短时CPU峰值18.4%，随后约9秒为0–0.9%；后续交互有短时峰值，未复现持续满占用 |
| 同期其他进程 | WindowServer、Codex渲染、远程桌面占用较高；尚无证据证明由原型触发 |

页面主线程耗时与JS堆不等于全部浏览器CPU或内存。普通Chrome数值聚合PID96002及其直接子进程，涵盖该浏览器已有页面，不当作单个原型标签页的独占数值。

## 环境与证据

使用独立4514/4512/4513服务。最终稳定CDP测量连接IPv6回环4516，未覆盖reducedMotion偏好；正常Chrome另通过浏览器扩展操作独立4514标签页。最初自动浏览器的端口冲突导致一次诊断连接中断，重新建立稳定环境后完整采集结果；该工具中断没有作为产品缺陷。

- [诊断报告与运行说明](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/performance-20260910/README.md)
- [五组实际测量](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/performance-20260910/diagnostic-results.json)
- [打开阶段测量](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/performance-20260910/startup-results.json)
- [普通Chrome采样](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/performance-20260910/normal-chrome-summary.json)
- [源码指纹](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/performance-20260910/source-fingerprints.json)
- [进程与端口清理](/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/outputs/performance-20260910/cleanup.json)

本轮测试标签页、测试浏览器和服务均已关闭，保留用户两个4494原型标签页和原服务。没有结束用户Chrome、Codex、窗口服务或远程桌面。

## 待补充的复现信息

需要高占用进程的名称，以及升高的是CPU、内存还是进程数量；活动监视器截图可以同时提供。还需确认具体页面和触发操作。当前只能确认已测路径没有持续循环，不能据此宣称用户报告不存在或已经解决。
