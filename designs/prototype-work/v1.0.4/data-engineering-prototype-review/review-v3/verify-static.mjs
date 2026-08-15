import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(fs.readFileSync(path.join(here, "shared/manifest.json"), "utf8"));
const sandbox = { window: {} };
vm.createContext(sandbox);
const fixtures = fs.readFileSync(path.join(here, "shared/fixtures.js"), "utf8");
vm.runInContext(fixtures, sandbox);
const data = sandbox.window.DE_DATA;
const app = fs.readFileSync(path.join(here, "shared/app.js"), "utf8");
const css = fs.readFileSync(path.join(here, "shared/app.css"), "utf8");
const build = fs.readFileSync(path.join(here, "build-standalone.mjs"), "utf8");
const shell = fs.readFileSync(path.join(here, manifest.entries[0].source), "utf8");
const integrationState = fs.readFileSync(path.join(here, "../../s001-e2e-integration/state.js"), "utf8");
const errors = [];
const assert = (ok, message) => { if (!ok) errors.push(message); };
const unique = values => new Set(values).size === values.length;
const byId = (items, id) => items.find(x => x.id === id);
const hashFile = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const fieldExists = (member, fieldName) => member.fields.some(field => field.name === fieldName);
const SCENARIO_CONTEXT_FIELDS = ["scenarioId", "scenarioVersion", "scenarioRunId", "formedAt", "status"];
const RESET_HISTORY_FIELDS = ["runs", "assetVersions", "dataAssetDeliveries", "refreshAttempts", "uploadedSnapshots"];
const functionSource = (name, nextName) => {
  const start = app.indexOf(`function ${name}`);
  if (start < 0) return "";
  const namedEnd = nextName ? app.indexOf(`function ${nextName}`, start + 1) : -1;
  const nextDeclarationOffset = app.slice(start + 1).search(/\n\s*(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(/);
  const fallbackEnd = nextDeclarationOffset >= 0 ? start + 1 + nextDeclarationOffset : app.length;
  const end = namedEnd > start ? namedEnd : fallbackEnd;
  return app.slice(start, end);
};
const integrationFunctionSource = (name, nextName) => {
  const start = integrationState.indexOf(`function ${name}`);
  if (start < 0) return "";
  const namedEnd = nextName ? integrationState.indexOf(`function ${nextName}`, start + 1) : -1;
  const nextDeclarationOffset = integrationState.slice(start + 1).search(/\n\s*(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(/);
  const fallbackEnd = nextDeclarationOffset >= 0 ? start + 1 + nextDeclarationOffset : integrationState.length;
  const end = namedEnd > start ? namedEnd : fallbackEnd;
  return integrationState.slice(start, end);
};
const actionSource = (name, nextName) => {
  const markers = [`if(action==="${name}")`, `if (action === "${name}")`, `if (action==="${name}")`];
  const start = markers.map(marker => app.indexOf(marker)).find(index => index >= 0) ?? -1;
  if (start < 0) return "";
  if (!nextName) return app.slice(start);
  const nextMarkers = [`if(action==="${nextName}")`, `if (action === "${nextName}")`, `if (action==="${nextName}")`];
  const end = nextMarkers.map(marker => app.indexOf(marker, start + 1)).find(index => index > start) ?? -1;
  return end > start ? app.slice(start, end) : app.slice(start);
};

assert(manifest.currentVariant === "B2", "B2 必须是唯一当前评审原型");
assert(manifest.variants.length === 1 && manifest.variants[0].key === "B2", "manifest 不得继续声明 B1/B3 候选");
assert(manifest.entries.length === 1 && manifest.entries[0].output === "方案B2.html", "构建入口必须只写方案B2.html");
assert(manifest.invariants.assetDetailViews?.join(",") === "overview,members,lineage,consumption", "资产详情必须声明四个互不混用的视图");
assert(manifest.invariants.formalRunDetailTabs?.join(",") === "summary,nodes-quality,publish-refresh", "正式运行详情必须声明三个证据页签");
assert(manifest.invariants.s003SnapshotCount === 0 && manifest.invariants.s003PublishedAssetCount === 0 && manifest.invariants.s003RunCount === 0, "manifest 必须保持 S003 尚无快照、正式运行和资产版本");
assert(
  manifest.invariants.s001InitialSnapshotCount === 0 &&
  manifest.invariants.s001InitialDataAsOf === null &&
  manifest.invariants.s001InitialT008Confirmed === false &&
  manifest.invariants.s001InitialFormalRunCount === 0 &&
  manifest.invariants.s001InitialQualityResultCount === 0 &&
  manifest.invariants.s001InitialPublishedAssetVersionCount === 0 &&
  manifest.invariants.s001InitialRefreshAttemptCount === 0 &&
  manifest.invariants.s001InitialOntologyBindingCount === 0 &&
  manifest.invariants.s001InitialAuthorityVersionCount === 0,
  "manifest 必须声明 S001 联调从零快照、空数据截至、零运行、零发布、零刷新和零权威采用开始"
);
assert(
  manifest.invariants.s001VerifiedStructureFingerprint?.sha256 === "83232e2dda913e63d2faa1e45aab824270f4ab5bcb96849a44ab8a03f93db12d" &&
  manifest.invariants.s001VerifiedStructureFingerprint?.sizeBytes === 807264,
  "manifest 必须冻结唯一允许标记结构已核验的融资工作簿指纹和大小"
);
assert(
  manifest.invariants.snapshotRegistration?.readMethod === "file.arrayBuffer" &&
  /crypto\.subtle\.digest/.test(manifest.invariants.snapshotRegistration?.hashMethod || "") &&
  /SHA-256/.test(manifest.invariants.snapshotRegistration?.deduplicationKey || "") &&
  /独立确认/.test(manifest.invariants.snapshotRegistration?.t008Confirmation || ""),
  "manifest 缺少真实文件读取、WebCrypto 内容去重或独立 T008 确认合同"
);
assert(manifest.invariants.scenarioContextFields?.join(",") === "scenarioId,scenarioVersion,scenarioRunId,formedAt,status", "manifest 必须声明完整 C033 场景运行上下文字段");
assert(manifest.invariants.scenarioContextRequiredBefore?.join(",") === "发布管道定义,正式运行,发布数据资产,交付数据资产,提交本体刷新请求", "manifest 缺少 C033 的五个强制门禁位置");
assert(
  manifest.invariants.ontologyHandoff?.channel === "ontology3.0-s001-handoff-v1" &&
  manifest.invariants.ontologyHandoff?.targetModule === "本体管理" &&
  manifest.invariants.ontologyHandoff?.operations?.join(",") === "deliverScenarioContext,deliverDataAsset,discoverRefreshTargets,publishedContext,deliverRefreshRequest,handoffSnapshot",
  "manifest 与本体管理联调通道或操作集合不一致"
);
assert(
  /稳定 deliveryId/.test(manifest.invariants.handoffContracts?.C003 || "") &&
  /首次交付/.test(manifest.invariants.handoffContracts?.C003 || "") &&
  !/attemptNumber|retryOf|previousDeliveryId/.test(manifest.invariants.handoffContracts?.C003 || "") &&
  /同一 deliveryId 幂等重放/.test(manifest.invariants.handoffContracts?.C003 || "") &&
  /拒绝后重新受理身份待总控裁决/.test(manifest.invariants.handoffContracts?.C003 || "") &&
  /handoffSnapshot/.test(manifest.invariants.handoffContracts?.C003 || ""),
  "manifest 缺少 C003 首次交付、同标识幂等、拒绝后待裁决或真实回执边界"
);
assert(/分别读取/.test(manifest.invariants.handoffContracts?.C032 || "") && /漂移即阻断/.test(manifest.invariants.handoffContracts?.C032 || ""), "manifest 缺少 C032 双读与漂移阻断合同");
assert(/currentFormalSnapshot/.test(manifest.invariants.handoffContracts?.C028 || "") && /完整 C033/.test(manifest.invariants.handoffContracts?.C028 || "") && /覆盖/.test(manifest.invariants.handoffContracts?.C028 || "") && /形成时间/.test(manifest.invariants.handoffContracts?.C028 || ""), "manifest 缺少 C028 正式组合快照、完整场景、覆盖或发现形成时间");
assert(/完整证据包/.test(manifest.invariants.handoffContracts?.C017 || "") && /本页面会话/.test(manifest.invariants.handoffContracts?.C017 || "") && /保持阻断/.test(manifest.invariants.handoffContracts?.C017 || ""), "manifest 缺少 C017 本会话重读与失败关闭边界");
const resetBehavior = String(manifest.invariants.resetBehavior || "");
assert(
  /(?:不得|不再|不由|不自行|禁止)[^；。]{0,32}(?:生成|创建|分配)[^；。]{0,20}scenarioRunId|scenarioRunId[^；。]{0,20}(?:不得|不再|不由|不自行|禁止)[^；。]{0,32}(?:生成|创建|分配)/i.test(resetBehavior) &&
  /等待[^；。]{0,40}(?:平台|总控)[^；。]{0,40}(?:新|完整)?[^；。]{0,8}C033/i.test(resetBehavior) &&
  RESET_HISTORY_FIELDS.every(field => resetBehavior.includes(field)),
  "manifest 必须声明定向重置不自行生成 scenarioRunId、等待平台新 C033，并保留五类历史证据"
);
assert(manifest.invariants.s001TargetAssetState === "未发布结构合同", "S001 四成员三关系只能作为未发布目标合同存在");
assert(manifest.invariants.s001TargetAssetMemberCount === 4 && manifest.invariants.s001TargetAssetRelationshipCount === 3, "S001 未发布目标合同必须保留四成员三关系结构");
assert(fixtures.includes('FIELD-FINANCING-DETAIL-RATE-TYPE') && fixtures.includes('FIELD-FINANCING-DETAIL-TERM-TYPE'), "S001 融资明细合同缺少 R02/R03 必需的利率形式或期限种类字段");
assert(fixtures.includes('FIELD-FINANCING-DETAIL-CURRENCY') && fixtures.includes('FIELD-FINANCING-DETAIL-GUARANTEE-TYPE'), "S001 融资明细合同缺少外币及信用融资占比所需的币种或担保方式字段");
assert(manifest.invariants.refreshResultDoesNotImplyT019 === true, "manifest 必须声明刷新结果不自动等于 T019 采用");
assert(build.includes("当前构建只能更新唯一评审原型"), "构建脚本缺少 B2-only 保护");
assert(data.sourceGroups.map(x => x.key).join(",") === "手工工作簿,共享文件夹,SAP,司库系统,数据中台", "来源目录分组不完整");
assert(data.sources.every(x => !Object.prototype.hasOwnProperty.call(x, "scene")), "数据源不得拥有场景字段");
const financeSource = byId(data.sources, "finance-workbook");
const s003Source = byId(data.sources, "s003-workbook");
assert(financeSource?.snapshotCount === 0 && financeSource.snapshots.length === 0, "S001 初始必须为零快照，真实附件只有经用户上传后才能登记");
assert(financeSource?.fileName === "" && financeSource?.asOf === "" && financeSource?.registration === "尚无快照 · 等待上传", "S001 初始不得预置当前文件、T008 或已上传状态");
assert(financeSource?.sourceArtifact?.role === "结构核验指纹参考，不是已登记快照", "S001 本地附件只能作为结构核验指纹参考");
assert(
  financeSource?.structureVerification?.sha256 === manifest.invariants.s001VerifiedStructureFingerprint.sha256 &&
  financeSource?.structureVerification?.sizeBytes === manifest.invariants.s001VerifiedStructureFingerprint.sizeBytes &&
  /阻断正式运行/.test(financeSource?.structureVerification?.statusWhenUnmatched || ""),
  "S001 结构核验必须同时匹配唯一内容指纹和文件大小，其他文件只能登记且阻断正式运行"
);
assert(s003Source?.fileName === "企业债务风险评估模版_S003兼容版.xlsx", "S003 文件名必须与校正附件一致");
assert(s003Source?.snapshotCount === 0 && s003Source.snapshots.length === 0, "S003 文件尚未受控登记，不得冒充 T002 快照");
assert(s003Source?.registration === "文件已取得 · 内容已核验 · 待受控登记", "S003 文件取得、内容核验和受控登记状态未分开");
assert(s003Source?.compatibilityStatus?.contractCompatibility === "兼容" && s003Source?.compatibilityStatus?.consumptionStatus === "不可消费", "S003 合同兼容与不可消费状态必须并列保留");
assert(Object.values(s003Source?.platformEvidence || {}).every(value => value === null), "S003 不得编造 T001/T002/T053/T003/T005/T007 标识");
assert(data.sources.filter(x => x.planned).map(x => x.name).join(",") === "会计凭证行项目,会计科目主数据,银行账户流水,融资明细,FIS 业务流程表单", "后期规划来源缺失");
assert(data.sources.filter(x => x.planned).every(x => !x.enabled && x.snapshotCount === 0), "后期规划来源不得提供真实接入状态");
for (const source of [financeSource, s003Source]) {
  const artifactPath = source?.sourceArtifact?.path;
  assert(Boolean(artifactPath) && fs.existsSync(artifactPath), `${source?.id || "未知来源"} 的真实附件不可定位`);
  if (artifactPath && fs.existsSync(artifactPath)) {
    assert(hashFile(artifactPath) === source.sourceArtifact.sha256, `${source.id} 夹具哈希与磁盘附件不一致`);
    assert(fs.statSync(artifactPath).size === source.sourceArtifact.sizeBytes, `${source.id} 夹具大小与磁盘附件不一致`);
  }
}
assert(data.pipelines.find(x => x.id === "finance-pipeline")?.nodeCount === 5, "S001 必须使用五节点");
assert(data.pipelines.find(x => x.id === "s003-structure")?.canOpen === false, "S003 结构卡不得提供可运行画布");
assert(data.nodeDefinitions.map(x => x.key).join(",") === "source,python,quality,publish,refresh", "五节点顺序不正确");
assert(data.nodeDefinitions.map(x => x.libraryGroup).join(",") === "输入,处理与质量,处理与质量,发布,发布", "节点库必须按输入、处理与质量、发布三组组织");
assert(data.nodeDefinitions.map(x => x.formalStep?.order).join(",") === "1,2,3,4,5", "五类节点缺少稳定的正式步骤顺序");
assert(data.nodeDefinitions.every(x => x.formalStep?.stage && x.formalStep?.actionLabel && x.formalStep?.resultLabel), "五类节点缺少正式步骤、操作或结果文案");
assert(data.nodeDefinitions.filter(x => x.trialEligible).map(x => x.key).join(",") === "source,python,quality", "试运行只能到数据检查，不得执行发布资产或请求刷新");
assert(data.nodeDefinitions.filter(x => x.libraryGroup === "发布").map(x => x.key).join(",") === "publish,refresh", "发布分组必须只包含发布数据资产和提交本体刷新请求");
assert(data.qualityRules?.map(x => x.id).join(",") === "FIN-Q-001,FIN-Q-002,FIN-Q-003,FIN-Q-004,FIN-Q-005,FIN-Q-006,FIN-Q-007", "融资检查配置必须使用 FIN-Q-001 至 FIN-Q-007 稳定编号");
assert(data.qualityRules?.every(x => x.version && x.name && x.type && x.scope && x.condition && x.severity && x.failureEffect && x.recovery && x.owner && x.enabled === true), "融资检查配置缺少版本、范围、条件、严重级别、失败影响或恢复方式");
const boardRule = byId(data.qualityRules, "FIN-Q-004");
assert(/10 个有效展示值/.test(boardRule?.condition || "") && /核能、核燃料、集团及直管公司、数字化保持原值/.test(boardRule?.recovery || "") && !/六类目标板块/.test(boardRule?.condition || ""), "FIN-Q-004 必须落实 D007 的 10 个有效展示值，四个保留值不得再被误判");
assert(data.pythonLogic?.length === 4 && data.pythonCode.some(x => x.includes("只读取融资明细")) && data.pythonCode.some(x => x.includes("不计算 Metric")), "Python 代码查看缺少处理逻辑与边界说明");
assert(data.workbooks.finance.sheets.find(x => x.id === "finance-detail")?.rows === 5218, "S001 主明细必须为真实 5218 条");
assert(data.workbooks.finance.sheets.find(x => x.id === "finance-detail")?.fields.length === 35, "S001 主明细必须为真实 35 字段");
assert(data.workbooks.finance.sheets.filter(x => x.input !== false).map(x => x.id).join(",") === "finance-detail,finance-owner", "S001 管道输入只能包含融资明细和负责人映射");
assert(data.workbooks.s003.sheets.map(x => x.rows + "x" + x.cols).join(",") === "21x27,21x9", "S003 双 Sheet 结构不正确");

const s003Pipeline = byId(data.pipelines, "s003-structure");
assert(s003Pipeline?.nodeCount === 0 && s003Pipeline?.expectedNodeCount === 4, "S003 只能声明四步预期结构，不得冒充已保存管道定义");
assert(s003Pipeline?.expectedNodes?.join(",") === "数据源,债务风险输入标准化,数据检查,发布兼容性数据资产", "S003 四步预期结构不正确");
assert(!s003Pipeline?.expectedNodes?.includes("请求本体刷新") && !s003Pipeline?.canRun && !s003Pipeline?.canPublish && !s003Pipeline?.canRefresh, "S003 当前不得出现运行、发布或刷新能力");
assert(!data.formalRuns.some(run => run.scene === "S003"), "S003 当前不得存在正式运行记录");
assert(!data.qualityResults.some(result => result.scene === "S003"), "S003 当前不得存在正式 T005");
assert(!data.targetAssets.some(asset => asset.scene === "S003"), "S003 当前不得进入数据资产目录");

const financeAsset = byId(data.targetAssets, "finance-asset-target");
assert(financeAsset?.detailViews?.map(view => view.key).join(",") === manifest.invariants.assetDetailViews.join(","), "S001 资产四视图夹具与 manifest 不一致");
assert(financeAsset?.members?.length === 4 && financeAsset.relationshipContracts?.length === 3, "S001 资产必须包含四成员三关系");
assert(unique(financeAsset.members.map(member => member.id)), "S001 成员稳定标识不得重复");
assert(unique(financeAsset.relationshipContracts.map(relation => relation.id)), "S001 关系稳定标识不得重复");
const expectedIdentityFields = new Map([
  ["FIN-MEMBER-SUBJECT", "FIELD-FINANCING-ENTITY-UNIT-CODE"],
  ["FIN-MEMBER-DETAIL", "FIELD-FINANCING-DETAIL-LOAN-ID"],
  ["FIN-MEMBER-INSTITUTION", "FIELD-FINANCIAL-INSTITUTION-CODE"],
  ["FIN-MEMBER-OWNER", "FIELD-FINANCING-OWNER-ID"]
]);
for (const member of financeAsset.members) {
  assert(member.id && member.name && member.grain && member.key, `${member.name || "未知成员"} 缺少结构标识、粒度或主键`);
  assert(fieldExists(member, member.key), `${member.name} 的主键没有出现在字段合同中`);
  assert(member.identityFieldId === expectedIdentityFields.get(member.id) && member.identityEvidenceLocator, `${member.name} 的稳定身份字段或身份检查证据定位不符合本体消费合同`);
  assert(member.fields.every(field => field.fieldId && field.name && field.type && typeof field.nullable === "boolean" && field.role), `${member.name} 的字段合同缺少稳定 fieldId、类型、空值或角色`);
  assert(unique(member.fields.map(field => field.fieldId)), `${member.name} 的稳定字段标识不得重复`);
  assert(member.fields.find(field => field.name === member.key)?.fieldId === member.identityFieldId, `${member.name} 的主键字段没有绑定成员 identityFieldId`);
  assert(!Object.prototype.hasOwnProperty.call(member, "rowCount") && !Object.prototype.hasOwnProperty.call(member, "qualityStatus"), `${member.name} 的未发布结构合同不得预置运行后行数或质量结果`);
}
for (const relation of financeAsset.relationshipContracts) {
  const sourceMember = byId(financeAsset.members, relation.sourceMemberId);
  const targetMember = byId(financeAsset.members, relation.targetMemberId);
  assert(Boolean(sourceMember) && Boolean(targetMember), `${relation.name} 引用了不存在的成员`);
  if (sourceMember && targetMember) {
    assert(fieldExists(sourceMember, relation.sourceField), `${relation.name} 的来源字段不存在`);
    assert(fieldExists(targetMember, relation.targetField), `${relation.name} 的目标字段不存在`);
    assert(sourceMember.fields.find(field => field.name === relation.sourceField)?.fieldId === relation.sourceFieldId, `${relation.name} 的来源端点字段 ID 与成员字段合同不一致`);
    assert(targetMember.fields.find(field => field.name === relation.targetField)?.fieldId === relation.targetFieldId, `${relation.name} 的目标端点字段 ID 与成员字段合同不一致`);
  }
  assert(relation.endpointEvidenceLocator === `数据工程 / 关系检查 / ${relation.id}`, `${relation.name} 缺少稳定端点证据定位`);
  assert(!Object.prototype.hasOwnProperty.call(relation, "checkedCount") && !Object.prototype.hasOwnProperty.call(relation, "unmatchedCount") && !Object.prototype.hasOwnProperty.call(relation, "status"), `${relation.name} 的未发布结构合同不得预置端点检查结果`);
}

assert(financeAsset?.published === false && financeAsset?.status === "尚未发布", "S001 目标资产初始必须是未发布结构合同");
assert(financeAsset?.versionCount === 0 && financeAsset?.versions?.length === 0, "S001 初始不得预置 T007 数据资产版本");
assert(financeAsset?.currentVersion === "尚未发布" && financeAsset?.currentAuthoritativeVersion === "尚未采用", "S001 初始不得预置当前版本或权威版本");
assert(financeAsset?.quality === "尚无质量结论" && financeAsset?.refreshStatus === "尚未请求" && financeAsset?.consumptionStatus === "不可消费", "S001 初始质量、刷新和消费状态不诚实");
assert(financeAsset?.lineage?.nodes?.length === 0 && financeAsset?.refreshConsumption === null, "S001 初始不得预置运行沿袭、C028、C029、T018 或 T019 结果");
assert(financeAsset?.versionRoles?.latestPublished?.versionId === null && financeAsset?.versionRoles?.latestDataQualified?.versionId === null, "S001 初始不得预置最新发布或数据侧合格版本");
assert(financeAsset?.versionRoles?.currentAuthoritative?.versionId === null && financeAsset?.versionRoles?.currentAuthoritative?.consumable === false, "S001 初始不得预置权威消费版本");
assert(data.formalRuns.length === 0, "S001 联调初始态必须为零正式运行");
assert(data.qualityResults.length === 0, "S001 联调初始态必须为零正式质量结果");
assert(data.ontologyConsumptionBindings.length === 0, "S001 联调初始态不得预置本体目标绑定");
assert(data.ontologyExternalReceipts === null, "S001 联调初始态不得预置本体处理或采用回执");
const financePipeline = byId(data.pipelines, "finance-pipeline");
assert(financePipeline?.ontologyBindingId === "" && financePipeline?.latestRun === "尚未运行", "S001 管道初始不得绑定本体目标或引用历史成功运行");

const failureScenario = byId(data.failureScenarios, "S001-FAILURE-INSTITUTION-MAPPING");
const failureRuleConfig = byId(data.qualityRules, failureScenario?.affectedRule?.id);
assert(Boolean(failureRuleConfig) && failureScenario?.affectedRule?.ruleVersion === failureRuleConfig?.version, "失败分支没有引用稳定检查规则版本");
assert(failureScenario?.affectedRule?.condition === failureRuleConfig?.condition && failureScenario?.affectedRule?.failureEffect === failureRuleConfig?.failureEffect, "失败分支的检查条件或失败影响与规则配置不一致");
assert(failureScenario?.affectedRule?.failedCount === 2 && failureScenario?.affectedRule?.sampleCount === failureScenario?.affectedRule?.samples?.length, "失败分支缺少一致的失败总量和有限样例");
assert(Boolean(failureScenario?.affectedRule?.impact) && Boolean(failureScenario?.affectedRule?.recovery), "失败分支缺少影响和恢复证据");
assert(failureScenario?.publishStatus === "未执行" && failureScenario?.refreshStatus === "未执行", "质量硬失败不得提前形成发布或刷新结果");
assert(!data.formalRuns.some(run => run.id === failureScenario?.id), "未触发的失败分支不得混入正式运行历史");

assert(financeAsset?.versionRoles?.candidate?.versionId === null && financeAsset?.versionRoles?.candidate?.consumable === false, "尚未形成的候选不得进入消费");
assert(financeAsset?.versionRoles?.previousTrusted?.versionId === null && financeAsset?.versionRoles?.previousTrusted?.status === "尚无上一权威历史", "无上一权威历史时不得回填当前版本或名称相似版本");
assert(financeAsset?.reusePolicy?.allowed === true && /精确版本/.test(financeAsset.reusePolicy.selectionMode) && /禁止同一数据资产/.test(financeAsset.reusePolicy.cycleProtection), "已发布资产复用缺少精确版本、成员范围或防循环合同");

assert(financeSource.contentFindings?.map(item => item.observedCount).join(",") === "0,212,212,1868", "S001 币种与真实允许缺失事实不完整");
assert(financeSource.contentFindings.every(item => item.checkedCount === 5218 && item.forbiddenInterpretation), "S001 空值披露缺少检查总量或禁止解释");

assert(app.includes("function sourceWizardModal") && app.includes("function newPipelineModal"), "缺少新建数据源或新建管道流程");
assert(app.includes('sourceView: "list"') && app.includes('assetView: "list"') && app.includes('viewToggle("source",ui.sourceView)') && app.includes('viewToggle("asset",ui.assetView)'), "数据源或数据资产缺少默认列表与卡片/列表切换");
assert(app.includes("function sourceTable") && app.includes("function assetTable") && app.includes("source-resource-table") && app.includes("asset-resource-table"), "资源列表必须使用一条记录一行的列表结构");
assert(app.includes("function tabsForNode") && app.includes("刷新请求") && app.includes("代码查看"), "底部动态页签不完整");
const toolbarSource = functionSource("canvasToolbar", "nodeLibrary");
const tabsSource = functionSource("tabsForNode", "normalizeBottomTab");
const pipelineBottomSource = functionSource("pipelineBottom", "sourceBottom");
const unselectedTabs = tabsSource.match(/if\s*\(\s*!node\s*\)\s*return\s*(\[[\s\S]*?\]);/)?.[1] || "";
assert(toolbarSource && !toolbarSource.includes("validate-canvas"), "管道校验不得继续作为画布顶部孤立按钮");
assert(pipelineBottomSource.includes("validate-canvas"), "管道校验操作必须进入未选节点时的管道校验页签");
assert(unselectedTabs && !/debug|当前调试结果/.test(unselectedTabs), "未选择节点时不得保留无法对应操作的当前调试结果页签");
assert(app.includes("const inputs=selectedInputContexts().map") && app.includes("assetContractFingerprint:x.assetContractFingerprint"), "管道校验指纹必须包含精确输入版本、数据截至和资产输入合同");
assert(app.includes("validationSeen:Boolean(c.validationSeen)") && app.includes("validationSeen:Boolean(record.validationSeen)"), "发布定义必须保留发布前校验时间、指纹和逐项证据");
assert(
  app.includes("function pythonLogicGuide") &&
  app.includes("D.pythonLogic.map") &&
  app.includes("function pythonOutputSampleTable") &&
  app.includes("const previewComplete=debugComplete||trialComplete") &&
  app.includes("Python 输入预览已按本次") &&
  app.includes("输入预览已刷新") &&
  app.includes("输出预览已根据本次") &&
  app.includes("调试输出已刷新"),
  "Python 调试后的输入/输出刷新或代码解释不完整"
);
assert(app.includes('const formalReady=!isDraft()&&nodeStateCode(pythonNode)==="success"'), "Python 调试成功不得冒充正式运行输出");
assert(app.includes("data-resize=\"left\"") && app.includes("data-resize=\"right\"") && app.includes("data-resize=\"bottom\""), "分栏拖动入口不完整");
assert(!app.includes('e.key==="Delete"') && !app.includes('e.key==="Backspace"') && app.includes("fitCanvas") && app.includes("undoCanvas") && app.includes('e.key==="Escape"'), "快捷键范围未保持为撤销、保存、适应窗口、缩放和 Esc");
assert(app.includes("发布管道定义") && app.includes("发布数据资产") && app.includes("正式运行"), "定义发布、正式运行和资产发布未区分");
assert(app.includes("来源同步计划") && app.includes("管道运行计划") && app.includes("本体刷新策略"), "三类自动化边界不完整");
assert(app.includes("权威消费采用仍由本体管理负责"), "缺少刷新与权威消费采用边界");
assert(app.includes("上一可信版本继续服务"), "缺少失败继续上一可信版本");
assert(
  app.includes("function assetForNode") &&
  app.includes("function versionForNode") &&
  app.includes('node?.inputKind==="asset"') &&
  app.includes("function sourcePickerModal") &&
  app.includes("已发布数据资产") &&
  !app.includes('<span class="library-label">已发布数据资产</span>'),
  "资产复用必须通过统一数据源节点选择"
);
assert(
  app.includes('key!=="source"&&ui.canvas.nodes.some') &&
  app.includes('d.key==="source"?counts.source<1:counts[d.key]!==1') &&
  app.includes('ui.canvas.nodes.filter(n=>n.key==="source").forEach') &&
  app.includes("数据源节点可按需添加多个"),
  "数据源节点仍被错误限制为一个"
);
const canvasWorldMatch = app.match(/CANVAS_WORLD\s*=\s*\{\s*width:\s*(\d+),\s*height:\s*(\d+)\s*\}/);
assert(
  canvasWorldMatch &&
  Number(canvasWorldMatch[1]) >= 6000 &&
  Number(canvasWorldMatch[2]) >= 3600 &&
  app.includes("CANVAS_ORIGIN") &&
  app.includes("panState") &&
  app.includes('document.addEventListener("pointermove"') &&
  app.includes("restoreCanvasViewport") &&
  app.includes("fitCanvas"),
  "大范围画布或拖动平移不完整"
);
assert(app.includes('selectedNode: ""') && app.includes('action==="clear-node-selection"'), "画布默认选择或空白清除选择不正确");
assert(!app.includes('class="node-port'), "画布节点不得继续显示常驻圆形端口");
assert(app.includes("release-node") && app.includes("node-link-action") && app.includes("link-target-node"), "发布阶段节点、按需连线操作或目标节点反馈不完整");
assert(
  app.includes("trialValidationResult") &&
  app.includes("executionPlanTo") &&
  (app.includes("nodeRank(target)>2") || app.includes("trialEligible")) &&
  (app.includes("nodeRank(n)<=2") || app.includes("filter(n=>defForNode(n).trialEligible)")),
  "试运行边界必须停在数据检查，不能执行发布资产或请求刷新"
);
assert(!app.includes("relationship-bridge ${relation"), "资源目录不得保留拟形成或候选关系桥接线");
assert(app.includes('return [["flow","从发布到消费"]') && app.includes('["lineage","沿袭证据"]'), "沿袭证据必须归入提交本体刷新请求节点");
assert(!/评审原型|高保真交互原型|一期演示|交互演示|非真实|原型夹具/.test(app), "页面仍包含面向评审者的内部说明");
assert(app.includes("localStorage.setItem(FLOW_KEY"), "流程状态未持久化");
assert(!app.includes("localStorage.removeItem(FLOW_KEY)"), "定向重置不得整体删除工作区历史");
const initialFlowStart = app.indexOf("const initialFlow");
const loadFlowStart = app.indexOf("function loadFlow", initialFlowStart + 1);
const initialFlowSource = initialFlowStart >= 0 && loadFlowStart > initialFlowStart ? app.slice(initialFlowStart, loadFlowStart) : "";
assert(initialFlowSource, "缺少可检查的联调初始状态定义");
assert(
  /snapshotConfirmed:\s*false/.test(initialFlowSource) &&
  /asOfDate:\s*""/.test(initialFlowSource) &&
  /t008Confirmation:\s*null/.test(initialFlowSource) &&
  /consumptionStatus:\s*"not-ready"/.test(initialFlowSource) &&
  /refreshAttempts:\s*\[\]/.test(initialFlowSource) &&
  /runs:\s*\[\]/.test(initialFlowSource) &&
  /assetVersions:\s*\[\]/.test(initialFlowSource) &&
  /authorityVersionId:\s*""/.test(initialFlowSource) &&
  /authorityVersionIds:\s*\{\s*\}/.test(initialFlowSource),
  "应用必须从零快照确认、空 T008、零正式运行、零资产版本、零刷新尝试、零权威版本和不可消费状态开始"
);
assert(
  !/\btrustedRun\b|\btrustedVersion\b|\btrustedRefreshAttempt\b/.test(app),
  "应用不得保留预置可信运行、T007 版本或刷新成功夹具"
);
assert(app.includes('flow.runStatus="awaiting-publish"') && app.includes('if(flow.runStatus!=="awaiting-publish")'), "质量通过与资产发布门未分开");
assert(app.includes("flow.assetVersions.push(version)") && app.includes('flow.runStatus="published"'), "资产版本未在发布动作后生成");
assert(
  app.includes("materializePublishedMembers") &&
  app.includes("materializePublishedRelationships") &&
  app.includes("outputMemberRowCount") &&
  app.includes("checkedCount") &&
  app.includes("unmatchedCount") &&
  !functionSource("loadFlow", "let flow").includes("materializePublishedMembers") &&
  !functionSource("loadFlow", "let flow").includes("materializePublishedRelationships"),
  "四成员行数和三关系检查只能在发布动作后形成，不得在加载历史状态时补造"
);
assert(
  app.includes("buildBindingTrustSummary") &&
  app.includes("appendCurrentTrustSummary") &&
  app.includes("trustSummaryPanel") &&
  app.includes("版本绑定摘要") &&
  app.includes("当前状态摘要") &&
  app.includes("五项数据侧状态") &&
  app.includes("生产保留策略") &&
  app.includes("重放核验"),
  "缺少 C017/T047 两类摘要、五维状态或 C030 诚实降级交接视图"
);
assert(
  app.includes("function requestRefresh") &&
  app.includes('flow.refreshStatus="request-created"') &&
  app.includes("等待本体管理") &&
  !/function\s+(?:completeRefreshResultContract|scheduleAuthorityEvidence|syncExternalT019Evidence|applyT019AdoptionEvidence)\b/.test(app) &&
  !/`REFRESH-RES-\$\{/.test(app) &&
  !/`T019-EVIDENCE-\$\{/.test(app),
  "数据工程只能提交刷新请求并等待外部只读回执，不得本地生成 C029、T018 或 T019 采用结果"
);
assert(app.includes("assetContractSnapshot") && app.includes("fieldGrainContract") && app.includes("qualityCondition") && app.includes("assetContractFingerprint"), "受控跟随未把 T006、成员范围、字段粒度与质量条件保存进定义");
assert(app.includes("dependencyClosureForVersion") && app.includes("dependencyVersions") && app.includes("dependencyClosure"), "资产复用缺少传递依赖与间接循环门禁");
assert(app.includes("trialValidationResult") && app.includes("ancestors.has") && app.includes("lockedInputs:copy(inputs)") && app.includes("lockedInputs:copy(trialInputs)"), "试运行链路或调试输入冻结不完整");
assert(app.includes("verifyRetryInputs") && app.includes("不能回退到当前输入") && app.includes("内容指纹与原运行证据不一致"), "正式运行重试缺少原输入可复现核验");
assert(app.includes("内容、时点、成员关系合同与业务输出均未变化，未重复发布") && app.includes("memberContractFingerprint") && app.includes("relationshipContractFingerprint") && app.includes("businessOutputFingerprint") && app.includes("members,relationships"), "无数据变化去重或不可变版本成员合同不完整");
assert(
  /const duplicate=flow\.assetVersions\.find\(v=>sameScenarioContext\(v\.scenarioContext,run\.scenarioContext\)/.test(functionSource("publishAsset", "currentT019Snapshot")) &&
  manifest.invariants.t007DuplicateBoundary?.includes("新的工作轮次形成新的不可变 T007"),
  "T007 去重必须限定在同一完整 C033；新场景工作轮次不得复用旧轮次版本"
);
assert(app.includes("queryRefreshRequest") && app.includes("查询原刷新请求") && !app.includes("登记查询到成功结果") && !app.includes("登记查询到失败结果"), "刷新结果未知必须查询原请求，不能通过测试按钮或本地分支登记成功/失败结果");
assert(!app.includes("formal-quality-outcome") && !app.includes("refresh-processing-outcome") && !app.includes("receive-t019") && !app.includes("pendingAuthorityEvidence"), "正式主路径不得让用户手工选择质量/本体结果或本地补录正式采用");
assert(!app.includes("function ensurePublishedDefinition") && !app.includes("从既有已发布定义恢复的只读快照"), "精确已发布定义缺失时不得用草稿或默认画布补造");
assert(app.includes('s.id==="s003-workbook"?[["overview"') && !app.includes("查看质量详情"), "S003 兼容态应只保留四个只读页签和来源内容核验证据入口");
assert(app.includes('fact("权威阶段",s.compatibilityStatus?.authorityStage') && app.includes('fact("数据工程内部状态",s.compatibilityStatus?.internalResult'), "S003 详情未区分 C021 权威阶段与数据工程内部状态");
assert(app.includes("stopFormalRun") && app.includes("retry-run") && app.includes("上一可信版本"), "停止、失败重试或上一可信版本保护不完整");
assert(app.includes("const memberIdMap=new Map()") && app.includes("sourceMemberId:memberIdMap.get(contract.sourceMemberId)") && app.includes("targetMemberId:memberIdMap.get(contract.targetMemberId)"), "自定义 T006 的成员重命名未同步改写关系合同端点");
assert(
  app.includes("function ontologyBindingGate") &&
  app.includes("尚未选择本体管理中已建立的目标绑定") &&
  !app.includes("function stableT019BindingId"),
  "刷新不得自行生成权威消费绑定，且缺少既有绑定时必须阻断"
);
assert(app.includes('"refresh",false') && app.includes('不影响发布定义或数据资产，但不能提交刷新请求') && app.includes('数据资产仍可发布，但不能提交刷新请求'), "缺少目标绑定只能阻断刷新提交，不得阻断首次发布定义或数据资产");
assert(app.includes("function assetProductionHref") && app.includes("historyContext") && app.includes("历史生产证据不可定位") && app.includes("查看生产画布"), "已发布资产缺少精确生产画布入口或一致性门禁");
assert(app.includes('sourceView: "list"') && app.includes('assetView: "list"') && app.includes('<span>列表</span>') && !app.includes("二维表"), "资源目录必须默认列表并使用用户可懂名称");
assert(app.includes('return [["flow","从发布到消费"]') && data.nodeDefinitions.find(x=>x.key==="refresh")?.name==="提交本体刷新请求", "刷新节点名称或底部业务页签未统一");
assert(!app.includes("正式步骤 · 不参与试运行") && app.includes('button(trialLabel,"trial-to-node"'), "试运行按钮必须常驻，发布节点通过灰态表达不支持");
assert(app.includes("确认数据截至时间") && app.includes("数据截至时间") && app.includes("取得时间"), "快照与数据截至时间确认合同不完整");
assert(css.includes(".splitter-left") && css.includes(".bottom-tabs") && css.includes("@media (prefers-reduced-motion:reduce)"), "分栏、动态底栏或减少动效样式缺失");
assert(css.includes(".btn.icon-only > span:not(.icon)") && css.includes(".canvas-viewport.is-panning"), "工具栏图标按钮或画布平移样式缺失");
assert(app.includes("data-table-scrollbar") && app.includes("function syncTableScrollbars") && app.includes("tableScrollDrag"), "资源列表缺少自定义横向拖动交互");
assert(css.includes(".resource-table-wrap") && css.includes(".table-scrollbar") && css.includes(".table-scroll-thumb") && css.includes("position:sticky"), "资源列表缺少常驻横向拖动条或固定关键列");
assert(css.includes(".code-review-layout") && css.includes(".code-logic-guide") && css.includes(".preview-section-head"), "Python 代码解释或调试预览缺少布局样式");
assert(css.includes(".validation-toolbar") && css.includes(".validation-footer") && css.includes(".rule-row") && css.includes(".execution-log-row"), "校验规则、质量规则或执行日志列表样式不完整");
assert(app.includes('refreshStep("1. 发布数据资产"') && app.includes('refreshStep("5. 消费就绪"') && css.includes(".refresh-stepper") && css.includes("repeat(5") && css.includes(".refresh-primary-action") && css.includes(".contract-identifiers"), "五阶段刷新消费流程或折叠证据样式不完整");

const uploadRegistrationSource = [functionSource("sha256Hex", "registerSnapshotFile"), functionSource("registerSnapshotFile", "resetScenarioRun")].join("\n") || actionSource("register-snapshot", "confirm-snapshot");
const t008ConfirmationSource = functionSource("recordT008Confirmation", "parseScenarioContextCandidate") || actionSource("save-snapshot-confirmation", "source-settings");
assert(
  uploadRegistrationSource.includes("file.arrayBuffer()") &&
  /crypto\.subtle\.digest\(\s*["']SHA-256["']/.test(uploadRegistrationSource) &&
  /file\.size/.test(uploadRegistrationSource) &&
  /acquiredAt|readAt/.test(uploadRegistrationSource),
  "快照登记必须真实读取 file.arrayBuffer、以 WebCrypto 计算 SHA-256，并记录真实大小和读取时间"
);
assert(
  /(?:snapshots|uploadedSnapshots)[\s\S]*(?:some|find)\([\s\S]*(?:hash|sha256)/.test(uploadRegistrationSource) &&
  /重复|复用已有快照|duplicate/i.test(uploadRegistrationSource + actionSource("register-snapshot", "confirm-snapshot")),
  "快照登记缺少按内容哈希去重和重复内容反馈"
);
assert(
  /snapshotReadEvents\.push\(/.test(uploadRegistrationSource) &&
  /readStartedAt/.test(uploadRegistrationSource) && /readCompletedAt/.test(uploadRegistrationSource) &&
  /duplicate:Boolean\(existing\)/.test(uploadRegistrationSource) &&
  /currentSnapshotReadEvents\[sourceId\]=readEvent\.eventId/.test(uploadRegistrationSource),
  "相同内容复用快照身份时也必须保留本轮真实读取事件、时间、指纹和 C033"
);
assert(
  app.includes('const VERIFIED_FINANCE_SHA256 = "83232e2dda913e63d2faa1e45aab824270f4ab5bcb96849a44ab8a03f93db12d"') &&
  app.includes("const VERIFIED_FINANCE_SIZE = 807264") &&
  /hash===VERIFIED_FINANCE_SHA256&&file\.size===VERIFIED_FINANCE_SIZE/.test(uploadRegistrationSource) &&
  /结构已核验/.test(uploadRegistrationSource) &&
  /结构未核验|阻断正式运行/.test(uploadRegistrationSource),
  "只有指定 SHA-256 与 807264 字节同时匹配时才能标记结构已核验，其他文件必须登记但阻断正式运行"
);
assert(
  !/snapshotConfirmed\s*=\s*true/.test(uploadRegistrationSource) &&
  /snapshotConfirmed\s*=\s*false/.test(uploadRegistrationSource) &&
  /asOfDate\s*=\s*""/.test(uploadRegistrationSource) &&
  /t008Confirmation\s*=\s*null/.test(uploadRegistrationSource) &&
  /confirmedBy/.test(t008ConfirmationSource) &&
  /confirmedAt/.test(t008ConfirmationSource) &&
  /basis/.test(t008ConfirmationSource) &&
  /sourceReadEventId:readEvent\.eventId/.test(t008ConfirmationSource) &&
  /currentReadEventForSnapshot/.test(t008ConfirmationSource),
  "T008 必须在上传登记后独立确认并记录确认人、确认时间和依据，上传动作不得顺带确认"
);
assert(
  /currentSnapshotReadEvents/.test(initialFlowSource) &&
  /currentSnapshotReadEvents\?\.\[sourceId\]/.test(functionSource("currentReadEventForSnapshot", "currentT008ForSnapshot")) &&
  /confirmation\.sourceReadEventId===readEvent\.eventId/.test(functionSource("currentT008ForSnapshot", "syncFlowData")) &&
  /flow\.currentSnapshotReadEvents=\{\}/.test(functionSource("resetScenarioRun", "applyPendingScenarioResetRequest")),
  "稳定 T002 的当前轮投影必须绑定最新真实读取事件；重置只清空当前映射并保留读取历史"
);
const sourceWizardCompleteSource = actionSource("source-wizard-complete", "upload-snapshot");
assert(
  !/sourceArtifact|baseSnapshot|snapshotId:\s*`SNAP/.test(sourceWizardCompleteSource) &&
  !/使用当前工作簿/.test(functionSource("sourceWizardModal", "uploadSnapshotModal")),
  "新建手工工作簿来源不得绕过真实文件读取，从本地参考附件或当前夹具直接生成首个快照"
);
const sourceContentSource = functionSource("sourceContent", "sourceSnapshots");
assert(
  /snapshots\?\.length|snapshots\.length/.test(sourceContentSource) &&
  /尚无快照|上传后/.test(sourceContentSource),
  "融资来源尚无快照时不得展示真实工作簿结构或数据样例，内容页必须等待上传登记"
);

assert(app.includes('const SCENARIO_CONTEXT_FIELDS') && ["scenarioId","scenarioVersion","scenarioRunId","formedAt","status"].every(field => app.includes(`"${field}"`)), "C033 缺少完整五字段定义");
assert(
  app.includes("function parseScenarioContextCandidate") &&
  app.includes("function validateScenarioContext") &&
  app.includes("function receiveScenarioContext") &&
  app.includes("function scenarioContextGate"),
  "缺少从平台接收、解析、验证并统一门禁 C033 的实现"
);
assert(app.includes("receiveScenarioContextFromUrl()"), "应用启动时必须真实接收平台深链中的 C033，不能只定义未调用的解析函数");
const scenarioUrlSource = functionSource("receiveScenarioContextFromUrl", "c003ScenarioContractState");
assert(
  app.includes('const SCENARIO_CONTEXT_KEY = `${HANDOFF_CHANNEL}:scenario-context`') &&
  app.includes("function readPlatformScenarioContextFromSharedState") &&
  /shared=readPlatformScenarioContextFromSharedState\(\)/.test(scenarioUrlSource) &&
  /event\.key===SCENARIO_CONTEXT_KEY\)\{const shared=readPlatformScenarioContextFromSharedState\(\);if\(shared\.okay\)receiveScenarioContext\(shared\.context,"平台公共层共享状态变化"\);render\(\);\}/.test(app),
  "M02 必须在统一入口和共享状态变化时重新读取平台公共层完整 C033"
);
const scenarioContextSource = [
  functionSource("parseScenarioContextCandidate", "validateScenarioContext"),
  functionSource("validateScenarioContext", "receiveScenarioContext"),
  functionSource("receiveScenarioContext", "scenarioContextGate"),
  functionSource("scenarioContextGate", "ontologyBridgeRequest")
].join("\n");
assert(
  SCENARIO_CONTEXT_FIELDS.every(field => scenarioContextSource.includes(field)) &&
  /错配|不一致|不匹配|mismatch/i.test(scenarioContextSource) &&
  /缺失|不完整|missing/i.test(scenarioContextSource),
  "C033 验证必须拒绝五字段缺失或与 S001 错配的上下文"
);
const c033GatedActions = [
  ["发布管道定义", functionSource("publishCanvasDefinition", "publishedDefinitionForCanvas")],
  ["正式运行", functionSource("startFormalRun", "stopFormalRun")],
  ["发布数据资产", functionSource("publishAsset", "requestRefresh")],
  ["交付数据资产", functionSource("deliverDataAssetToOntology", "trustEvidenceId")],
  ["提交本体刷新请求", functionSource("submitOntologyRefresh", "queryRefreshRequest")]
];
for (const [label, source] of c033GatedActions) assert(source.includes("scenarioContextGate"), `${label} 缺少完整 C033 门禁`);
assert(
  /scenarioContext:\s*copy\(|scenarioContext:\s*\{/.test(app) &&
  /scenarioRunId/.test(functionSource("publishCanvasDefinition", "publishedDefinitionForCanvas")) &&
  /scenarioRunId/.test(functionSource("startFormalRun", "stopFormalRun")) &&
  /scenarioRunId/.test(functionSource("publishAsset", "requestRefresh")),
  "C033 必须贯穿管道定义、正式运行和数据资产版本，不得只停留在页面状态"
);

const bridgeSource = functionSource("ontologyBridgeRequest", "ontologyHandoffSnapshot");
assert(
  app.includes('const HANDOFF_CHANNEL = "ontology3.0-s001-handoff-v1"') &&
  app.includes('const ONTOLOGY_ENTRY_PATH = "/ontology-management-review/canvas-first/index.html"') &&
  bridgeSource.includes('targetModule:"本体管理"') &&
  /requestId/.test(bridgeSource) && /operation/.test(bridgeSource) && /payload/.test(bridgeSource) &&
  /postMessage/.test(bridgeSource) && /timeout|超时/i.test(bridgeSource),
  "与本体管理的桥接请求缺少通道、请求关联、目标模块、载荷或超时处理"
);
assert(
  bridgeSource.includes("if(frame?.contentWindow)") &&
  bridgeSource.includes("if(!sentToFrame)") &&
  bridgeSource.includes("pending.operation!==payload.operation"),
  "C003 桥接必须优先使用单一同源 M01 iframe，并拒绝操作类型错配的竞态响应；仅在 iframe 不可用时启用广播回退"
);
assert(["deliverScenarioContext","deliverDataAsset","discoverRefreshTargets","publishedContext","deliverRefreshRequest","handoffSnapshot"].every(operation => app.includes(`"${operation}"`) || app.includes(`'${operation}'`)), "数据工程与 M01 的场景、资产、发现、刷新及快照桥接操作未全部实现");
assert(
  app.includes("function platformScenarioContextEnvelope") &&
  app.includes("function ensureOntologyScenarioContext") &&
  /sourceModule:\"平台公共层\"/.test(functionSource("platformScenarioContextEnvelope", "ensureOntologyScenarioContext")) &&
  /contractCode:\"C033\"/.test(functionSource("platformScenarioContextEnvelope", "ensureOntologyScenarioContext")) &&
  /ontologyBridgeRequest\(\"deliverScenarioContext\",envelope\)/.test(functionSource("ensureOntologyScenarioContext", "handleOntologyHandoffResponse")) &&
  /ensureOntologyScenarioContext\(record\.payload\?\.scenarioContext\)/.test(functionSource("sendC003DeliveryRecord", "deliverDataAssetToOntology")),
  "M02 必须先把平台当前同轮完整 C033 原样转交 M01 并取得根回执，再发送 C003"
);

const c003Source = [
  functionSource("c003AcceptedContractIssues", "c003SnapshotEvidence"),
  functionSource("c003SnapshotEvidence", "c003DeliveryRecord"),
  functionSource("c003DeliveryRecord", "settleC003Delivery"),
  functionSource("settleC003Delivery", "dataAssetDeliveryGate"),
  functionSource("dataAssetDeliveryGate", "ontologyHandoffSnapshot"),
  functionSource("verifyC003DeliveryRecord", "sendC003DeliveryRecord"),
  functionSource("sendC003DeliveryRecord", "deliverDataAssetToOntology"),
  functionSource("deliverDataAssetToOntology", "trustEvidenceId")
].join("\n");
const c003PayloadSource = [functionSource("fieldContractArray", "c003Members"), functionSource("c003Members", "c003Relations"), functionSource("c003Relations", "dataAssetDeliveryPayload"), functionSource("dataAssetDeliveryPayload", "ontologyHandoffSnapshot"), c003Source].join("\n");
assert(
  /deliveryId/.test(c003PayloadSource) &&
  /members/.test(c003PayloadSource) && /relations|relationships/.test(c003PayloadSource) && /quality/.test(c003PayloadSource) &&
  /sourceSnapshot|sourceChain|sourceLineage/.test(c003PayloadSource) && /evidence/.test(c003PayloadSource) &&
  /scenarioContext/.test(c003PayloadSource),
  "C003 必须使用稳定 deliveryId 并完整携带资产、T008、质量、来源、四成员三关系、证据和 C033"
);
assert(/qualitySummary:\{status:version\.quality/.test(c003PayloadSource), "C003 质量摘要必须来自精确 T007，不能固定写成通过");
assert(
  /fields:\s*.*map|fieldId/.test(c003PayloadSource) &&
  /sourceFieldId/.test(c003PayloadSource) && /targetFieldId/.test(c003PayloadSource) && /endpointEvidence/.test(c003PayloadSource),
  "C003 成员字段必须转换为含稳定 fieldId 的数组，关系必须携带稳定端点字段 ID 与端点证据"
);
assert(
  /accepted/.test(c003Source) &&
  /inputs\?\.c003/.test(c003Source) &&
  /dataAssetDeliveryReceipts/.test(c003Source) &&
  /scenarioContextReceipts/.test(c003Source) &&
  /targetDraft/.test(c003Source) &&
  /联合证据不完整/.test(c003Source) &&
  !/receipt\s*=\s*\{[\s\S]{0,300}(?:success|成功)/.test(c003Source),
  "C003 mutation 的 accepted 不能冒充完整回执；必须联合核对 M01 已接收合同、完整回执、C033 与目标 Draft"
);
assert(
  app.includes("function c003TargetDraftBindingIssues") &&
  /sourceDeliveryId!==binding\.payloadDeliveryId/.test(functionSource("c003TargetDraftBindingIssues", "c003SnapshotEvidence")) &&
  /sourceAssetVersion!==binding\.payloadAssetVersion/.test(functionSource("c003TargetDraftBindingIssues", "c003SnapshotEvidence")) &&
  /draftRevision!==binding\.receiptDraftRevision/.test(functionSource("c003TargetDraftBindingIssues", "c003SnapshotEvidence")) &&
  /c003TargetDraftBindingIssues\(targetDraft,receipt,payload\)/.test(c003Source) &&
  /c003TargetDraftBindingIssues\(record\.targetDraft,record\.receipt,record\.payload\)/.test(c003Source),
  "C003 联合证据必须证明目标 Draft 与本次 deliveryId、精确 T007 和回执修订号一致；仅有 Draft ID 不得显示已接收"
);
assert(
  /runtimeVerificationId===C003_RUNTIME_VERIFICATION_ID/.test(c003Source) &&
  !/if\(record\.status==="已接收"[\s\S]{0,240}?return\s+settleC003Delivery/.test(c003Source),
  "C003 门禁不得信任跨页面保存的本地已接收状态；每个页面会话都必须重读 M01 持久化证据"
);
assert(
  /function c003DeliveryAttemptId\(version\) \{ return c003DeliverySeriesId\(version\); \}/.test(app) &&
  /attemptNumber:1,retryOf:null,previousDeliveryId:null/.test(c003PayloadSource) &&
  /record\.events\.push/.test(c003Source),
  "C003 必须固定首次交付身份、明确空重试引用并保留不可变状态事件"
);
assert(
  /objectId/.test(c003PayloadSource) && /sourceFingerprint/.test(c003PayloadSource) && /payloadFingerprint/.test(c003PayloadSource) && /resultId:version\.qualityId/.test(c003PayloadSource),
  "C003 载荷缺少 M01 成员选择目标、来源 SHA-256、载荷指纹或精确质量结果身份"
);
assert(
  app.includes("function c003PayloadBindingIssues") &&
  /c003PayloadBindingIssues\(record\.payload,version,run\)/.test(c003Source) &&
  /record\.payloadFingerprint===record\.payload\?\.payloadFingerprint/.test(c003Source) &&
  /sourceFingerprint\?\.algorithm!=="SHA-256"/.test(c003PayloadSource) &&
  /sourceFingerprint\?\.sizeBytes/.test(c003PayloadSource),
  "C003 门禁必须把冻结载荷与精确 T002、T007、T008、正式运行、质量和来源字节数共同绑定"
);
assert(
  app.includes("function c003AttemptNumberFromId") &&
  /deliverySeriesId!==`C003-\$\{payload\?\.assetVersion/.test(c003PayloadSource) &&
  /declaredAttempt!==1\|\|attemptNumber!==1\|\|payload\?\.retryOf\|\|payload\?\.previousDeliveryId/.test(c003PayloadSource) &&
  /canonicalC003Text\(record\.payload\)!==canonicalC003Text\(payload\)/.test(c003Source),
  "C003 首次标识、禁用未裁决重试引用或同标识完整载荷不可变校验不完整"
);
assert(
  /verificationHistory\.push/.test(c003Source) &&
  /historicalAcceptedClaim/.test(c003Source) &&
  app.includes("幂等合同重放原交付标识") &&
  app.includes("存在部分回执证据但联合核对未通过") &&
  app.includes("拒绝后重新受理的新尝试身份尚待总控裁决"),
  "C003 必须保留每次联合核验证据，并区分同标识幂等、部分证据冲突与拒绝后待裁决"
);
assert(
  app.includes("function c033RootReceiptIssues") &&
  /contextId/.test(functionSource("c033RootReceiptIssues", "c003SnapshotEvidence")) &&
  /evidenceLocator/.test(functionSource("c033RootReceiptIssues", "c003SnapshotEvidence")) &&
  /c033RootReceiptIssues\(c033Receipt,payload\)/.test(c003Source),
  "C003 联合证据必须核验 M01 C033 根回执的稳定身份、时间、证据定位和五字段"
);
assert(
  app.includes("let c003RetryInFlight = false") &&
  /navigator\?\.locks\?\.request/.test(functionSource("retryC003Delivery", "exactScenarioContext")) &&
  /ontology3-c003-delivery-/.test(functionSource("retryC003Delivery", "exactScenarioContext")) &&
  /if\(c003RetryInFlight\)/.test(functionSource("retryC003Delivery", "exactScenarioContext")) &&
  /finally\{c003RetryInFlight=false;render\(\);\}/.test(functionSource("retryC003Delivery", "exactScenarioContext")),
  "C003 新尝试缺少页面会话互斥，快速重复操作可能并发生成多个尝试"
);
const c003RetrySource = functionSource("retryC003Delivery", "exactScenarioContext");
assert(
  app.includes("function c003ScenarioContractState") &&
  /platformScenarioContextGate\(\)/.test(functionSource("c003ScenarioContractState", "handoffRequestId")) &&
  /productionContext/.test(functionSource("c003ScenarioContractState", "handoffRequestId")) &&
  /现行 C003\/C033 未授权跨轮次重交付/.test(app) &&
  /if\(scenarioContract\.contractConflict\)return verifyC003DeliveryRecord/.test(functionSource("sendC003DeliveryRecord", "deliverDataAssetToOntology")),
  "C003 必须在发送前对照平台当前 C033 与 T007/正式运行生产 C033，跨轮次时保守阻断"
);
assert(
  /if\(scenarioContract\.contractConflict\)\{await verifyC003DeliveryRecord/.test(c003RetrySource) &&
  /未生成新的交付尝试/.test(c003RetrySource) &&
  /if\(explicitRejected\)/.test(c003RetrySource) &&
  /拒绝后重新受理的新尝试身份尚待总控裁决/.test(c003RetrySource) &&
  /if\(payloadInvalid\)/.test(c003RetrySource) &&
  /if\(hasM01DeliveryEvidence\)/.test(c003RetrySource) &&
  /sendC003DeliveryRecord\(version,previous\)/.test(c003RetrySource) &&
  !/c003DeliveryRecord\(/.test(c003RetrySource),
  "C003 恢复必须只允许原 deliveryId 幂等重放；拒绝、载荷冲突、部分回执或跨轮次时不得生成新尝试"
);
assert(
  app.includes("function c003DeliveryEvidencePanel") &&
  app.includes("重新读取 M01 接收或拒绝证据") &&
  app.includes("按原标识恢复核对") &&
  app.includes("合同冲突，需要总控裁决") &&
  app.includes("平台当前工作轮次") &&
  app.includes("T007 / 正式运行生产轮次") &&
  app.includes("拒绝后新尝试待总控裁决") &&
  app.includes("发送成功、postMessage 返回或页面提示均不能单独证明 M01 已接收"),
  "资产页或刷新节点缺少平台/生产双 C033、合同冲突、可核验 C003 标识及恢复边界"
);
assert(!app.includes("四成员可供选择"), "M02 不得把已接收合同直接宣称为 M01 成员选择器已实际显示四成员");
assert(app.includes("来源文件大小"), "C003 证据面板必须显示与来源 SHA-256 配套的文件字节数");
assert(/setTimeout\(\(\)=>finish\(null\),2400\)/.test(functionSource("ensureOntologyBridgeFrame", "ontologyBridgeRequest")), "M01 隐藏交换帧加载必须有超时，不能让 C003 操作永久等待");

const discoverySource = functionSource("discoverOntologyBindings", "deliverDataAssetToOntology") || functionSource("discoverOntologyBindings", "submitOntologyRefresh");
const c028Source = functionSource("submitOntologyRefresh", "queryRefreshRequest");
const exactC028Source = functionSource("exactC028Received", "c029MatchesAttempt");
const c028ReceiptSource = functionSource("exactC028Receipt", "c028ReceiptEvidence");
const c028EvidenceSource = functionSource("c028ReceiptEvidence", "handoffC028Receipt");
const handoffC028ReceiptSource = functionSource("handoffC028Receipt", "c029MatchesAttempt");
assert(
  discoverySource.includes('"discoverRefreshTargets"') && discoverySource.includes('"publishedContext"') &&
  /ontologyHandoffSnapshot|handoffSnapshot/.test(discoverySource),
  "C032 目标发现必须从本体管理真实读取目标、Published 上下文和交接快照"
);
assert(/raw\.formedAt/.test(discoverySource) && /recorded\.formedAt/.test(discoverySource), "C032 必须同时核对形成时间、读取时间和交接快照中的同一响应");
assert(
  c028Source.includes("discoverOntologyBindings") &&
  ["bindingVersion","targetFingerprint","semanticVersion","mappingVersion","coverage"].every(field => app.includes(field)) &&
  /漂移|drift/i.test(c028Source) && /阻断|拒绝/.test(c028Source),
  "C032 必须在 C028 前再次真实读取，并对绑定、目标指纹、语义版本、映射版本和覆盖执行漂移阻断"
);
assert(
  /currentFormalSnapshot/.test(c028Source) &&
  /assetVersionId|dataAssetVersionId/.test(c028Source) &&
  /members/.test(c028Source) && /relationships/.test(c028Source) && /quality/.test(c028Source) &&
  SCENARIO_CONTEXT_FIELDS.every(field => c028Source.includes(field)),
  "C028 必须携带最新 C032 身份、精确数据版本、T008、成员、关系、质量、完整 C033 和显式 currentFormalSnapshot"
);
assert(
  c028Source.includes('"deliverRefreshRequest"') &&
  c028Source.includes('"refreshRequestStatus"') &&
  /authority\.status==="accepted"/.test(c028Source) &&
  /authority\.status==="pending"/.test(c028Source) &&
  /authority\.status==="rejected"/.test(c028Source) &&
  /结果未知/.test(c028Source),
  "C028 必须按权威状态读取区分 accepted、pending、rejected 与结果未知"
);
assert(
  app.includes("function exactC028Received") && app.includes("function exactC028Receipt") && app.includes("function c028ReceiptEvidence") &&
  /c028ReceiptEvidence\(\{mutation,statusRead:statusResponse\.ok\?statusResponse\.result:null,handoff,payload\}\)/.test(c028Source) &&
  /mutation\.respondedAt/.test(c028Source) && /dataAssetDeliveryId:delivery\.deliveryId/.test(c028Source),
  "C028 必须联合核对持久化接收请求、同请求权威回执和本体管理响应时间"
);
assert(
  /receipt\.status/.test(c028ReceiptSource) && /exactC028Received\(receipt\.originalRequest,payload\)/.test(c028ReceiptSource) &&
  /inputs\?\.c028Receipts/.test(handoffC028ReceiptSource) && /item\.requestId===requestId/.test(handoffC028ReceiptSource) &&
  /item\.requestId===payload\?\.requestId/.test(c028EvidenceSource) && /status:"pending"/.test(c028EvidenceSource) && /status:"rejected"/.test(c028EvidenceSource),
  "C028 权威回执必须按同一 requestId 和原始请求区分受理、等待与拒绝，不能借用其他请求的 deliveryIssues"
);
assert(
  /queryRefreshRequest/.test(app) && /\["request-created","request-accepted","unknown","eligible","failed"\]/.test(app) &&
  /ontologyBridgeRequest\("refreshRequestStatus",\{requestId:attempt\.requestId\}\)/.test(app),
  "C028 后续重读必须允许从本地失败投影恢复，并重新读取 M01 持久化回执"
);
assert(
  /normalizeOntologyCandidate\(ontologyBindingForCanvas\(\)\)/.test(app),
  "目标绑定选择反馈必须使用规范化名称，不能显示 undefined"
);
assert(
  app.includes("function exactC028Received") &&
  /mutation\.respondedAt/.test(c028Source) && /dataAssetDeliveryId:delivery\.deliveryId/.test(c028Source),
  "C028 必须核对交接快照中的完整精确请求，并使用本体管理响应时间及 C003 交付引用"
);
assert(
  ["dataAssetDeliveryId","t008Confirmation","members","memberContracts","relationships","relationshipContracts","coverage","quality","refreshDiscoveryFormedAt"].every(field=>exactC028Source.includes(`received.${field}`)) &&
  /sameRecord\(received\.t008Confirmation,payload\.t008Confirmation\)/.test(exactC028Source) &&
  /sameRecord\(received\.coverage,payload\.coverage\)/.test(exactC028Source),
  "C028 精确回执必须完整核对 C003 引用、T008、成员、关系、覆盖、质量详情和发现形成时间"
);
assert(
  app.includes("function c029MatchesAttempt") && app.includes("function t018MatchesAttempt") && app.includes("function t019MatchesAttempt") &&
  ["sourceMappingVersionId","refreshTarget","bindingVersion","basedOnMatchResult","candidateKey","adoptionEvidenceLocator"].every(field=>app.includes(field)),
  "C029、T018 和 T019 必须按同一请求、T054 绑定、映射版本、候选键与采用证据闭合关联"
);
assert(!/function\s+(?:formC029|deriveC029|formT018|deriveT018|adoptT019|deriveT019)\b/.test(app), "数据工程不得本地推断或生成 C029、T018、T019");

const c017DimensionsSource = functionSource("c017FiveDimensions", "c017ProjectionForVersion");
const c017Source = functionSource("c017ProjectionForVersion", "c017ReportProjection");
const c017ReportSource = functionSource("c017ReportProjection", "c017ProjectionEnvelope");
const c017EnvelopeSource = functionSource("c017ProjectionEnvelope", "writeProjectionStore");
const c017StoreSource = functionSource("syncC017ProjectionStores", "readC017Projection");
const queryRefreshSource = functionSource("queryRefreshRequest", "finishFailedCandidate");
assert(
  /allowConsumption=Boolean\(isAuthority&&qualityAllowed&&!hardFailure&&evidenceComplete&&t008Verified&&t018Verified&&currentFormalVerified\)/.test(c017Source) &&
  /sessionAuthorityVerified/.test(c017Source) && /T019_RUNTIME_VERIFICATION_ID/.test(c017Source) &&
  /readToken/.test(c017Source) && /currentFormalSnapshot/.test(c017Source),
  "C017 allowConsumption 必须同时要求完整 C033、精确 T007/T008、T018、T019/currentFormal、证据完整且无硬质量失败"
);
assert(
  ["version-location","content-access","evidence-integrity","replay-capability","replay-verification"].every(id=>c017DimensionsSource.includes(`id:\"${id}\"`)) &&
  ["versionBindingSummary","currentStateSummary","fiveDimensions","t018EvidenceId","t019EvidenceId","authorityAlignment"].every(field=>c017Source.includes(field)),
  "C017 必须输出版本绑定摘要、当前状态摘要、五维状态及精确 T018/T019 对齐元数据"
);
assert(
  app.includes('const C017_REPORT_PROJECTION_KEY = "ontology3.c017.report-center.projection.v1"') &&
  /consumer==="报告中心"/.test(c017EnvelopeSource) && /projectionId:C017_REPORT_PROJECTION_KEY/.test(c017EnvelopeSource) &&
  /consumer,scenarioContext,formedAt,readStatus/.test(c017EnvelopeSource) && /permissions:/.test(c017EnvelopeSource) &&
  /只提供数据版本、时点、质量、新鲜度、五维状态与证据定位/.test(c017EnvelopeSource) &&
  /writeProjectionStore\(C017_REPORT_PROJECTION_KEY,c017ProjectionEnvelope\("报告中心"\)\)/.test(c017StoreSource),
  "数据工程必须发布 consumer=报告中心 的独立 C017 只读投影，且明确不包含业务明细"
);
assert(
  /item\.allowConsumption&&item\.authorityAlignment\?\.complete/.test(c017ReportSource) &&
  /item\.t008\?\.evidenceId/.test(c017ReportSource) && /item\.refresh\?\.t018EvidenceId/.test(c017ReportSource) &&
  /item\.t019Observation\?\.evidenceId/.test(c017ReportSource) && /item\.t019Observation\?\.currentFormalSnapshot/.test(c017ReportSource) &&
  /readStatus:!gate\.okay\?"context_missing":!reportProjections\.length\?"empty":ready\?"ready":"unavailable"/.test(c017EnvelopeSource),
  "报告中心 C017 正向必须精确闭合；C033、T007/T008、T018、T019/currentFormal 缺失或错配必须保持阻断"
);
assert(
  manifest.invariants.c017ProjectionStores?.["报告中心"] === "ontology3.c017.report-center.projection.v1" &&
  /报告中心/.test(manifest.invariants.handoffContracts?.C017 || "") && /不含业务明细/.test(manifest.invariants.handoffContracts?.C017 || ""),
  "manifest 必须登记报告中心 C017 投影键、只读边界与禁止业务明细"
);
assert(
  /t019SessionObservations\.delete\(version\.id\)/.test(queryRefreshSource) &&
  /t019SessionObservations\.set\(version\.id/.test(queryRefreshSource) &&
  /publishedContext 当前页面会话重读/.test(queryRefreshSource),
  "C017 在每次查询前必须撤销旧会话放行，只有本次真实读取闭合后才能形成新令牌"
);

const resetSource = functionSource("resetScenarioRun", "applyPendingScenarioResetRequest");
const resetActionSource = actionSource("confirm-reset-flow", "resource-shelf");
const currentProjectionDeclaration = initialFlowSource.match(/\b(currentSnapshotSelections|currentRunContext|activeRunContext|activeScenarioContext)\s*:/);
const currentProjectionField = currentProjectionDeclaration?.[1] || "";
const activeProjectionDeclared = /\bactive\s*:\s*(?:\{|null)/.test(initialFlowSource);
const currentProjectionCleared = currentProjectionField
  ? new RegExp(`flow\\.${currentProjectionField}\\s*=\\s*(?:null|\\{\\s*\\})`).test(resetSource)
  : false;
const activeProjectionCleared = /flow\.active\s*=\s*(?:null|\{\s*\}|(?:create|initial|empty|new)[A-Za-z_$][\w$]*\s*\(\s*\))/i.test(resetSource);
const resetGeneratesScenarioRunId =
  /\b(?:new|next|replacement|generated)ScenarioRunId\b/i.test(resetSource) ||
  /scenarioRunId\s*[:=]\s*(?:`[^`]*\$\{|["'][^"']*(?:RUN|S001)|(?:Date\.now|Math\.random|crypto\.randomUUID|dateStamp)\s*\()/i.test(resetSource) ||
  /flow\.scenarioContext\s*=\s*\{[\s\S]{0,500}?scenarioRunId/.test(resetSource);
assert(
  resetSource &&
  /flow\.scenarioContext\s*=\s*null/.test(resetSource) &&
  /flow\.awaitingScenarioContext\s*=\s*true/.test(resetSource) &&
  /(?:awaiting-(?:c033|scenario-context)|waiting-(?:c033|scenario-context)|等待平台[^；。\n]{0,40}(?:C033|轮次))/i.test(resetSource) &&
  !resetGeneratesScenarioRunId,
  "定向重置不得自行生成 scenarioRunId；重置后必须清空当前 C033 并进入等待平台新 C033 状态"
);
assert(
  resetActionSource.includes("resetScenarioRun") &&
  /等待平台[^；。\n]{0,40}(?:C033|新轮次)/.test(resetActionSource) &&
  !/已开始新工作轮次|newScenarioRunId|nextScenarioRunId/i.test(resetActionSource),
  "定向重置后的界面反馈必须说明等待平台新 C033，不得宣称已自行开始新工作轮次"
);
assert(
  (currentProjectionDeclaration || activeProjectionDeclared) &&
  (currentProjectionCleared || activeProjectionCleared),
  "当前轮次输入必须收敛在 currentSnapshotSelections/currentRunContext/active 投影中，定向重置只能清空该投影"
);
assert(
  /scenarioRunHistory/.test(resetSource) &&
  /scenarioContextHistory/.test(initialFlowSource) &&
  RESET_HISTORY_FIELDS.every(field => resetSource.includes(field)) &&
  RESET_HISTORY_FIELDS.every(field => !new RegExp(`flow\\.${field}(?:\\s*=|\\.length\\s*=|\\.(?:splice|pop|shift)\\s*\\()`).test(resetSource)) &&
  !/\bflow\s*=\s*(?:initialFlow\s*\(|loadFlow\s*\(|\{)/.test(resetSource),
  "定向重置必须显式保留 runs、assetVersions、dataAssetDeliveries、refreshAttempts、uploadedSnapshots 和场景历史，不得重建整个 flow"
);
assert(/preservedSnapshotReadEventIds/.test(resetSource) && !/flow\.snapshotReadEvents\s*=/.test(resetSource), "定向重置必须保留真实文件读取事件历史");
assert(
  /preservedAuthorityVersionIds/.test(resetSource) &&
  /flow\.authorityVersionId\s*=\s*""/.test(resetSource) &&
  /flow\.authorityVersionIds\s*=\s*\{\s*\}/.test(resetSource),
  "定向重置必须把本地权威消费指针移出新轮次当前投影，同时把旧指针保留在历史轮次证据中"
);
const formalRunSource = functionSource("startFormalRun", "runFormalTimeline");
assert(
  /original[\s\S]*sameScenarioContext\(original\.scenarioContext,scenarioGate\.context\)/.test(formalRunSource) &&
  /sameScenarioContext\(original\.t008Confirmation\?\.scenarioContext,scenarioGate\.context\)/.test(formalRunSource) &&
  /t008Confirmation,inputs/.test(formalRunSource),
  "关联重试必须同时核对原运行与 T008 确认的完整 C033，跨轮次不得复用旧输入证据"
);
assert(
  /r=>r\.definitionVersion===ui\.canvas\.definitionLabel&&sameScenarioContext\(r\.scenarioContext,flow\.scenarioContext\)/.test(functionSource("runForCanvas", "runStatusForCanvas")),
  "普通已发布画布只能投影当前 C033 轮次的运行；历史运行必须通过显式历史上下文查看，不能阻断新轮次运行"
);
assert(/sameScenarioContext\(run\.scenarioContext,scenarioGate\.context\)/.test(functionSource("publishAsset", "currentT019Snapshot")), "T007 发布必须核对完整五字段 C033，不能只比较 scenarioRunId");
assert(
  !/localStorage\.(?:removeItem|clear)\s*\(/.test(resetSource) &&
  (app.match(/\bconst\s+FLOW_KEY\s*=/g) || []).length === 1 &&
  !/\b(?:let|var)\s+FLOW_KEY\s*=/.test(app) &&
  !/\bFLOW_KEY\s*=(?!=)/.test(app.slice(app.indexOf("const FLOW_KEY") + "const FLOW_KEY".length)) &&
  !/localStorage\.|FLOW_KEY/.test(resetSource),
  "定向重置不得删除、清空、替换或按 scenarioRunId 轮换 localStorage；历史必须保存在同一工作区记录中"
);
const integrationResetStart = integrationState.indexOf("function resetCurrentScenario");
const integrationResetEnd = integrationState.indexOf("function ", integrationResetStart + "function resetCurrentScenario".length);
const integrationResetSource = integrationResetStart >= 0 ? integrationState.slice(integrationResetStart, integrationResetEnd > integrationResetStart ? integrationResetEnd : integrationState.length) : "";
assert(
  /resetScenarioProjection/.test(integrationResetSource) &&
  /SCENARIO_RESET_REQUEST_KEY/.test(integrationResetSource) &&
  !/localStorage\.(?:removeItem|clear)\s*\(/.test(integrationResetSource) &&
  !/sessionStorage\.(?:removeItem|clear)\s*\(/.test(integrationResetSource),
  "平台定向重置只能发布重置请求和新 C033，不得删除任何模块、交换或会话历史键"
);
const integrationDataProjectionStart = integrationState.indexOf("function dataProjection");
const integrationDataProjectionEnd = integrationState.indexOf("function ", integrationDataProjectionStart + "function dataProjection".length);
const integrationDataProjectionSource = integrationDataProjectionStart >= 0 ? integrationState.slice(integrationDataProjectionStart, integrationDataProjectionEnd > integrationDataProjectionStart ? integrationDataProjectionEnd : integrationState.length) : "";
assert(
  /currentSnapshotSelections/.test(integrationDataProjectionSource) &&
  /currentSnapshotReadEvents/.test(integrationDataProjectionSource) &&
  /snapshotReadEvents/.test(integrationDataProjectionSource) &&
  /sourceReadEventId === currentReadEvent\?\.eventId/.test(integrationDataProjectionSource) &&
  /sourceReadScenarioContext/.test(integrationDataProjectionSource),
  "平台 M02 投影必须以稳定 T002、当前轮最新读取事件及其 C033/T008 为准，不能要求改写 T002 首次登记轮次"
);
const integrationRefreshProjectionSource = integrationFunctionSource("refreshProjection", "getProjection");
const integrationPublishContextSource = integrationFunctionSource("publishScenarioContext", "readScenarioContext");
const integrationPersistSource = integrationFunctionSource("persist", "readJson");
assert(
  /refreshStateFromStorage\(\)/.test(integrationRefreshProjectionSource) &&
  integrationRefreshProjectionSource.indexOf("refreshStateFromStorage()") < integrationRefreshProjectionSource.indexOf("publishScenarioContext("),
  "平台重新投影前必须先吸收 STORAGE_KEY 最新状态，旧页签不得用陈旧内存重新发布 C033"
);
assert(
  /newestScenarioContext\(localContext, sharedContext\)/.test(integrationPublishContextSource) &&
  /scenarioContextTime\(candidate\)/.test(integrationFunctionSource("newestScenarioContext", "readSharedScenarioContext")) &&
  /state\.scenarios\[scenarioId\]\.scenarioContext\s*=/.test(integrationPublishContextSource),
  "平台发布 C033 必须按 formedAt 采用同场景最新根，并让旧页签跟随而不是覆盖新 scenarioRunId"
);
assert(
  /state\.revision\s*=\s*Math\.max/.test(integrationPersistSource) &&
  /storedRevision/.test(integrationPersistSource) &&
  /revision:\s*0/.test(integrationState),
  "平台集成状态必须维护跨页签单调 revision，不能让旧页签以较小版本覆盖新状态"
);
assert(!app.includes("c003DeliveryEvidencePanelLegacy") && !app.includes("按证据恢复 C003 交付"), "C003 旧面板和旧恢复按钮不得与唯一合同面板重复出现");

const outputPath = path.join(here, "方案B2.html");
assert(fs.existsSync(outputPath), "缺少方案B2.html");
if (fs.existsSync(outputPath)) {
  const html = fs.readFileSync(outputPath, "utf8");
  const variantMeta = manifest.variants[0];
  const expectedStandalone = shell
    .replace("{{VARIANT_TITLE}}", () => variantMeta.title)
    .replace("{{APP_CSS}}", () => css)
    .replace("{{VARIANT}}", () => "B2")
    .replace("{{VARIANT_JSON}}", () => JSON.stringify("B2"))
    .replace("{{MANIFEST_JSON}}", () => JSON.stringify(manifest).replace(/</g, "\\u003c"))
    .replace("{{APP_JS}}", () => fixtures + "\n" + app);
  assert(
    html === expectedStandalone,
    `方案B2.html 与 shared 源码或 manifest 不一致（期望 ${crypto.createHash("sha256").update(expectedStandalone).digest("hex").slice(0,12)}，实际 ${crypto.createHash("sha256").update(html).digest("hex").slice(0,12)}）；请运行唯一 B2 构建脚本`
  );
  assert(!html.includes("{{"), "方案B2.html 存在未替换模板标记");
  assert(!/https?:\/\//.test(html), "方案B2.html 不得依赖外部网络资源");
  assert(html.includes('提交本体刷新请求') && !html.includes('请求本体刷新'), "方案B2.html 刷新节点仍有旧名称");
  assert(
    html.includes('["overview","版本概览"]') &&
    html.includes('["members","包含的数据"]') &&
    html.includes('["lineage","如何产生"]') &&
    html.includes('["consumption","如何变为可用"]'),
    "方案B2.html 资产详情四页签未使用统一业务名称"
  );
  assert(!html.includes("二维表") && !html.includes("正式步骤 · 不参与试运行"), "方案B2.html 仍包含已废弃的列表或试运行文案");
  assert(!html.includes("精确不可变版本") && !html.includes("不可变版本历史"), "方案B2.html 仍包含用户难理解的版本术语");
  assert(html.includes("查看生产画布") && html.includes('refreshStep("1. 发布数据资产"') && html.includes('refreshStep("5. 消费就绪"'), "方案B2.html 缺少精确生产画布入口或五阶段进度");
}

if (errors.length) {
  console.error(errors.map(x => "FAIL " + x).join("\n"));
  process.exit(1);
}
console.log("PASS 数据工程作业台：唯一入口、诚实初始态、运行后生成资产、只读跨模块回执与失败恢复边界完整。");
