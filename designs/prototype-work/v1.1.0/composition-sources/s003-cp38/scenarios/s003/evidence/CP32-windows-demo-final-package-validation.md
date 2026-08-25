# CP32 · Windows 最终包固定验证

- 父基线：`v1.0.3 / BSL-S001-V103-DE0119608E26`
- 正式来源运行：`S003-RUN-20260817163000000-c02200000001`
- 形成时间：`2026-08-19T03:20:00.000Z`
- `acceptanceReady=false`

## 包内容

- 当前 `prototype/v1.1.0` 完整复制，包内逐文件校验缺失 0、额外 0、差异 0。
- 附带 `prototype/prototype-releases/v1.0.3` 只读基线副本，便于离线对照测试；不作为 S003 运行入口。
- 附带 Windows PowerShell 启停服务、ASCII/中文 BAT、文档、CP31/CP32 证据和 SHA-256 清单。

## 回归

- S003 场景测试：202/202。
- M01、M02、M03 原生适配测试：44/44。
- M04、M05、M06 适配与集成测试：86/86。
- `node --check`、`git diff --check` 通过；v1.0.3 冻结目录差异 0。
- 从包内原型副本启动 HTTP 服务，入口、CP32 快照、C035、M04 决策结果、M06 报告清单及六模块入口均返回 HTTP 200。
- 正式入口显示 21 家企业、集团平均评分 52.23、预警企业 5 家；风电测试公司10—12最低指标为“—”。

## Windows 边界

- 完整解压后运行 `Start-S003-Demo.bat`；不要从 ZIP 预览或 `file://` 打开。
- 默认 127.0.0.1:4333，端口占用时自动选择后续空闲端口。
- 不依赖 Node.js、Python 或数据库；需要 Windows PowerShell 5+ 或 PowerShell 7。
- 快速重跑仅为隔离评分预览，不提升为 Published，不重放历史副作用。

CP01—CP31 保持不可变；CP32 仅追加最终 Windows 包和交付回归证据。
