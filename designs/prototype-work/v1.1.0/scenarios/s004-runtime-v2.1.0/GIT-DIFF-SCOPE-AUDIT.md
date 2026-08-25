# S004 运行时范围审计

审计日期：2026-08-17

## 运行时适配目录

本次 S004 纠偏实现限定在：

```text
designs/prototype-work/v1.1.0/scenarios/s004-runtime-v2.1.0/
```

该目录包含场景配置、运行层适配、一个已登记的 M02 参数化入口、种子投影、自动化测试、交接文档和非正式回归证据。

## 冻结基线

以下检查均通过：

```text
git status --short -- designs/prototype-releases/v1.0.3    -> 无记录
git diff --quiet -- designs/prototype-releases/v1.0.3       -> PASS
git diff --cached --quiet -- designs/prototype-releases/v1.0.3 -> PASS
```

六个入口及 M02 原件 SHA-256 与 `scenario.manifest.json` 一致；v1.0.3 发布目录未修改、未覆盖、未迁移。

## 明确排除的既有工作树变更

以下路径位于运行时目录之外，属于此前 S004 v2.0.1 或历史资料范围，不纳入本次 v2.1.0 兼容性结论：

```text
designs/prototype-work/v1.1.0/scenarios/s004/checkpoints/
designs/prototype-work/v1.1.0/scenarios/s004/artifacts/
designs/prototype-work/v1.1.0/scenarios/s004/evidence/
tmp/
```

尤其是旧 `scenarios/s004/module-views` 目录仅作为历史资料保留；运行时清单和测试证明本版本不加载它作为 M01—M06 主体实现。

当前 `git ls-files --others --exclude-standard` 共识别 69 个未跟踪文件：运行时目录 42 个、旧 `scenarios/s004` 范围 25 个、`tmp/` 归档 2 个。总装提交或清理前必须逐组纳入，避免把完整运行时目录或历史归档整体遗漏。

## 结论

本次运行时变更与 v1.0.3 冻结目录、正式报告、S002/S003 和公共合同隔离。13 份已跟踪历史 Checkpoint 无差异且哈希通过；20 份旧 V2/V201 Checkpoint 仅存在于未跟踪归档，活动目录状态尚待总装裁决。若总装阶段需要恢复或修改上述排除路径、共享合同、Owner、Foundation 或 T019，必须先形成 CR/Q 并暂停合并。

## 最终复核（2026-08-16）

- `node --check`：`baseline-module-runtime.js`、`baseline-module-loader.js`、`seed-data.js`、`native-seeder.js` 全部通过。
- `node --test tests/*.test.cjs`：129/129 通过。
- 新增/修正仅位于 S004 v1.1.0 运行时目录：M01 基线布局恢复与画布 pan/zoom、M02 来源命名/快照下载及跨借款人模板、M05 证据闭环、M06 六问轮换/会话清空/核验动态/即时说明/外部资料来源披露、缓存版本和场景 manifest 语义。
- `artifacts/pdf-preview/` 下 11 个 PNG 仅由既有不可变正式 PDF 确定性渲染，用于规避 Chrome 拦截页内 PDF iframe；它们不是新的正式报告、证据包、发布指针或 Checkpoint。
- 目录级模板下载链接与详情抽屉链接均指向同一 HTML 模板；JSON 字段定义可独立下载。
- 未改动 `prototype-releases/v1.0.3`、S002、S003、已跟踪历史正式报告、13 份已跟踪 Checkpoint 或正式发布指针；旧 V2/V201 Checkpoint 归档状态单独列为总装风险，不在本结论中宣称原位保留。

## 聚焦复核（2026-08-17）

- `node --test tests/*.test.cjs`：129/129 通过；五个运行时 JavaScript 文件 `node --check` 通过。
- 报告管理定义目录只显示 1 条已启用定义；报告生成入口提供 4 个借款人选项、当前公司原生六步向导和未就绪公司 M02 数据准备跳转。
- Agent 卡片与详情已移除 C022、内部绑定编号和差异化技术说明；v1.0.3 的概览、资源与权限、版本记录、运行记录以及 Prompt/Skill/Tool/Published 本体穿透能力均保留。
- 1440×900、1280×720、390×844 聚焦浏览器回归通过，外层和 iframe 无横向溢出，控制台无应用错误；同 Origin 打开 S001 `completed-run.html` 后，S004 五字段场景身份保持不变。
- v1.0.3 发布目录 staged/unstaged/untracked 差异仍为空，目录组合 SHA-256 仍为 `9e5be9d04b059e720c9fa3f5be32e7a9b09da65f487c4611eefc539fda1cdd14`。
- 端口隔离保持：S004 `4339`；S002 `4400`；S003 `48123/48124`。本轮 Playwright 进程已退出，未终止或复用其他场景进程。
