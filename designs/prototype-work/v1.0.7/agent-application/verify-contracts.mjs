import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(here, "app.jsx"), "utf8");
const components = fs.readFileSync(path.join(here, "components.jsx"), "utf8");
const entry = fs.readFileSync(path.join(here, "Agent应用.html"), "utf8");

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exit(1);
  }
}

assert(
  app.includes('const C033_HANDOFF_CONTEXT_KEY = "ontology3.0-s001-handoff-v1:scenario-context"')
    && app.includes('const SCENARIO_CONTEXT_FIELDS = ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"]')
    && app.includes("SCENARIO_CONTEXT_FIELDS.every((field) => normalizedLeft[field] === normalizedRight[field])"),
  "C022/C024/Run 必须使用完整五字段 C033，而不是只比较场景标识、版本和轮次"
);

assert(
  app.includes("c022Issues(candidate, activeScenarioContext)")
    && app.includes("c024Issues(candidate, activeScenarioContext)")
    && app.includes("sameScenarioContext(source.scenarioContext || source.snapshot.scenarioContext || source.snapshot, activeScenarioContext)"),
  "报告生成和报告伴读必须在接收、开始运行和完成前复核当前平台 C033"
);

assert(
  app.includes("function mergeC011Request")
    && app.includes("function readC019Receipt")
    && app.includes("function buildAgentActionRequest")
    && app.includes("同一行动申请稳定标识已对应不同载荷")
    && app.includes("C011 已写入决策中心待接收区")
    && !app.includes("DC-REQUEST-${target.id}"),
  "Agent 行动申请必须真实写入 C011 并只读 C019，不得用延时器伪造决策中心接收"
);

assert(
  app.includes("拒绝并记录")
    && app.includes("由报告中心按当前完整 C033 场景轮次修复缺失或错配字段后")
    && app.includes("旧会话和历史记录不迁移"),
  "C022/C024 错配必须可登记拒绝原因并给出恢复路径"
);

assert(
  app.includes("scenarioFormedAt: run.snapshot.scenarioFormedAt")
    && app.includes("scenarioStatus: run.snapshot.scenarioStatus")
    && app.includes("consumableVersionId: identity.consumableVersionId")
    && app.includes("consumableVersionId: run.snapshot.consumableVersionId")
    && app.includes("dataAsOf: run.snapshot.dataAsOf"),
  "C023/C025 结果必须保留完整场景、精确语义、数据、T018 与 T008 身份"
);

assert(
  app.includes("function compactC024ForStorage(candidate = {})")
    && app.includes("anchorSnapshotId: identity.anchorSnapshotId")
    && app.includes("anchorSnapshotVersion: identity.anchorSnapshotVersion")
    && app.includes("selectedAnchor: identity.selectedAnchor"),
  "C024 持久化后必须保留锚点快照与稳定锚点，供报告中心严格回读 C025"
);

assert(
  components.includes("window.lucide?.icons?.[iconKey]")
    && !components.includes("window.lucide.createIcons()")
    && !app.includes("window.lucide.createIcons()"),
  "图标应由 React 直接渲染，避免运行后再次扫描和改写 DOM"
);

assert(
  entry.includes('components.jsx?v=27') && entry.includes('app.jsx?v=68'),
  "唯一 Agent 应用入口必须加载当前补丁版本"
);

assert(
  app.includes('const asksUnit465Floating = /单位465/.test(reportQuestion)')
    && app.includes('reportTitle = "单位465浮动利率融资关注说明"')
    && app.includes('reportTitle = "单位561短期债务关注说明"')
    && app.includes('reportTitle = "单位553高成本融资协商说明"'),
  "报告伴读必须按问题对象和规则选择固定证据，不得把单位553默认摘要套用于其他主体"
);

const persistSection = app.slice(app.indexOf("function persistAgentModel"), app.indexOf("function hydratePersistedModel"));
assert(
  persistSection.includes("const removeLegacyAgentDirectories")
    && persistSection.includes("removeLegacyAgentDirectories();")
    && persistSection.includes("const oldAgentPayloads")
    && !persistSection.includes('"ontology3.agent-application.task.v7"')
    && !persistSection.includes('"ontology3.agent-application.orchestration.v20"')
    && !persistSection.includes('"ontology3.agent-application.catalog.v8",'),
  "Agent 目录迁移必须在新键成功写入后清理 v7/v8，且不得删除有效任务、编排工作区"
);

console.log("M05 contract verification passed");
