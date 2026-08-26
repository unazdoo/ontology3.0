# v1.2.0 总装原型工作区

本工作区只用于把 M07、M08 和 S005 汇入一套可走查原型，不承担正式项目实施。

## 工作区身份

- 工作树：`/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.2.0`
- 分支：`codex/prototype-v1.2.0-composite`
- 候选版本：`v1.2.0-rc.1`
- 底座标签：`prototype-v1.1.0-frozen`
- 底座提交：`a8b023d7f8d49ad6ed6c24417b79b6f9df3fb716`
- 父版本：`v1.1.0`
- 基线快照：`BSL-OFW-V110-94ABD0E991B7`
- 状态：总装准备中
- `acceptanceReady = false`

冻结目录 `designs/prototype-releases/v1.1.0/` 仅作只读来源，不得原地修改。

## 与正式实施的边界

正式实施继续使用 `implementation-v1.1.x` 及其模块工作树。总装原型中的页面、交互、资源和状态变化不会自动进入正式实施，也不会自动修改 API、数据库、服务、Foundation 或 CI。

用户完成总装原型走查并明确裁决后，必须另行形成“原型差异转实施清单”，再由相应模块 Owner 在实施分支落地。

## 输入交付包

三个来源分支只提交自己的最小包：

1. `integration-exports/v1.2.0-rc.1/m07/`
2. `integration-exports/v1.2.0-rc.1/m08/`
3. `integration-exports/v1.2.0-rc.1/s005/`

交付包不得包含整套 v1.1.0 副本、第二平台 Shell、绝对符号链接、归档截图、原始敏感资料或正式实施代码。

## 合并顺序

1. 核验三个交付提交、清单、哈希和测试。
2. 接入 canonical M07：`moduleId=m07`、`route=#module/m07`、`workspace-v2`。
3. 接入 M08 modeling，并适配 canonical M07 的双向交接。
4. 接入 `S005 / S005-v1` 场景包，不复制第二套 Shell。
5. 最后修改共享 Shell、模块注册、场景注册、VERSION 和 manifest。
6. 生成唯一入口后执行 M01 至 M08、仪表盘、S001 至 S005 和三档视口回归。

## 当前门禁

当前只要求最小原型门：包可移植、单一入口、无双层 Shell、身份一致、主要流程可点击、重置隔离、页面和控制台无新增错误。生产安全、权限、性能、审批和验收证据不作为本轮总装前置门。

总装候选完成不等于模块评审、场景验收、生产技术联调或一期验收通过。
