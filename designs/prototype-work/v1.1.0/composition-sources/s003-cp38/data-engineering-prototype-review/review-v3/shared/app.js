(function () {
  "use strict";

  const D = window.DE_DATA;
  const root = document.getElementById("app");
  const ENTRY_PARAMS = new URLSearchParams(location.search);
  const REQUESTED_SCENARIO_ID = ENTRY_PARAMS.get("scenarioId");
  const SCENARIO_ID = REQUESTED_SCENARIO_ID === "S003" ? "S003" : "S001";
  const SCENARIO_VERSION = ENTRY_PARAMS.get("scenarioVersion") || (SCENARIO_ID === "S003" ? "S003-v1" : "S001-v1");
  const SCENARIO_RUN_ID = ENTRY_PARAMS.get("scenarioRunId") || (SCENARIO_ID === "S003" ? "s003-awaiting-context" : "s001-awaiting-delivery");
  const FLOW_KEY = SCENARIO_ID === "S001"
    ? "ontology3.data-engineering.workspace.v5-handoff"
    : `ontology3.data-engineering.workspace.v5-handoff:${SCENARIO_ID}:${SCENARIO_VERSION}:${SCENARIO_RUN_ID}`;
  const HANDOFF_CHANNEL = "ontology3.0-s001-handoff-v1";
  const SCENARIO_CONTEXT_KEY = `${HANDOFF_CHANNEL}:scenario-context`;
  const ONTOLOGY_ENTRY_PATH = "/ontology-management-review/canvas-first/index.html";
  const C003_RUNTIME_VERIFICATION_ID = `C003-RUNTIME-${Date.now()}-${Math.random().toString(16).slice(2,10)}`;
  const C017_IQ_PROJECTION_KEY = "ontology3.c017.intelligent-query.projection.v1";
  const C017_DECISION_PROJECTION_KEY = "ontology3.c017.decision-center.projection.v1";
  const SCENARIO_CONTEXT_FIELDS = ["scenarioId","scenarioVersion","scenarioRunId","formedAt","status"];
  const VERIFIED_FINANCE_SHA256 = "83232e2dda913e63d2faa1e45aab824270f4ab5bcb96849a44ab8a03f93db12d";
  const VERIFIED_FINANCE_SIZE = 807264;
  const CANVAS_WORLD = { width: 16000, height: 10000 };
  const CANVAS_ORIGIN = { x: 6000, y: 4200 };
  let platformScenarioObservation = { context:null, source:"尚未读取", observedAt:"", problems:["平台公共 C033 尚未读取"] };
  const BASE_SOURCE_STATE = new Map(D.sources.map(source=>[source.id,{snapshots:copy(source.snapshots||[]),fileName:source.fileName||"",asOf:source.asOf||"",registration:source.registration||"",latestAcquired:source.latestAcquired||"",physicalEvidence:source.physicalEvidence||"",lastSync:source.lastSync||""}]));
  function scenarioExtension() {
    const extension=window.DE_SCENARIO_EXTENSION;
    return extension?.scenarioId===SCENARIO_ID?extension:null;
  }
  const initialFlow = () => ({
    scenarioId: SCENARIO_ID,
    scenarioContext: null,
    scenarioContextHistory: [],
    scenarioRunHistory: [],
    snapshotConfirmed: false,
    asOfDate: "",
    t008Confirmation: null,
    definitionPublished: false,
    definitionVersion: "",
    definitionRevision: 0,
    publishedDefinitions: [],
    canvasDrafts: {},
    pipelineSchedule: "仅手工正式运行",
    pipelineSchedules: {},
    pipelineCounter: 0,
    qualityRules: copy(D.qualityRules || []),
    selectedInputSource: "finance-workbook",
    runCounter: 0,
    currentRunId: "",
    runStatus: "idle",
    runStep: -1,
    qualityStatus: "idle",
    refreshStatus: "idle",
    consumptionStatus: "not-ready",
    refreshRequestId: "",
    refreshResultId: "",
    refreshFailureReason: "",
    refreshAttempts: [],
    refreshBindingSelections: {},
    ontologyDiscovery: null,
    ontologyDiscoveryHistory: [],
    ontologyDiscoveryStatus: "not-read",
    ontologyDiscoveryError: "",
    dataAssetDeliveries: [],
    t018Status: "尚未形成",
    t019Status: "未提交",
    t019EvidenceId: "",
    t019AdoptedAt: "",
    t019Owner: "",
    authorityVersionId: "",
    previousAuthorityVersionId: "",
    authorityVersionIds: {},
    previousAuthorityVersionIds: {},
    candidateVersionId: "",
    runPlan: [],
    runNodeStates: {},
    runs: [],
    assetVersions: [],
    customSources: [],
    customPipelines: [],
    customAssets: [],
    uploadedSnapshots: [],
    snapshotReadEvents: [],
    currentSnapshotSelections: {},
    sourceSettings: {},
    folderSyncAt: "",
    awaitingScenarioContext: false,
    scenarioResetRequestedAt: ""
  });
  function loadFlow() {
    try {
      const defaults=initialFlow();
      const saved=JSON.parse(localStorage.getItem(FLOW_KEY) || "{}");
      const next={ ...defaults, ...saved };
      let recovered=false;
      next.publishedDefinitions=Array.isArray(saved.publishedDefinitions)?saved.publishedDefinitions:[];
      next.canvasDrafts=saved.canvasDrafts&&typeof saved.canvasDrafts==="object"?saved.canvasDrafts:{};
      next.pipelineSchedules=saved.pipelineSchedules&&typeof saved.pipelineSchedules==="object"?saved.pipelineSchedules:{};
      next.runPlan=Array.isArray(saved.runPlan)?saved.runPlan:[];
      next.runNodeStates=saved.runNodeStates&&typeof saved.runNodeStates==="object"?saved.runNodeStates:{};
      next.refreshAttempts=Array.isArray(saved.refreshAttempts)?saved.refreshAttempts:defaults.refreshAttempts;
      next.refreshBindingSelections=saved.refreshBindingSelections&&typeof saved.refreshBindingSelections==="object"?saved.refreshBindingSelections:{};
      next.dataAssetDeliveries=Array.isArray(saved.dataAssetDeliveries)?saved.dataAssetDeliveries:[];
      next.dataAssetDeliveries.forEach(record=>{
        const legacyStatus=record.status||"历史状态未记录",legacyReceiptStatus=record.receiptStatus||"历史回执状态未记录";
        const attemptMatch=String(record.deliveryId||"").match(/-A(\d+)$/i);
        record.deliverySeriesId=record.deliverySeriesId||String(record.deliveryId||"").replace(/-A\d+$/i,"");
        record.attemptNumber=Number.isInteger(record.attemptNumber)?record.attemptNumber:(attemptMatch?Number(attemptMatch[1]):1);
        record.payloadFingerprint=record.payloadFingerprint||(record.payload?c003Fingerprint({...record.payload,payloadFingerprint:undefined}):"");
        record.events=Array.isArray(record.events)&&record.events.length?record.events:[{at:record.completedAt||record.submittedAt||"历史时间未记录",status:legacyStatus,receiptStatus:legacyReceiptStatus,note:"升级前保留的交付状态；未经当前页面会话重新读取 M01 持久化快照，不作为接收真值。"}];
        record.verificationHistory=Array.isArray(record.verificationHistory)?record.verificationHistory:[];
        record.historicalAcceptedClaim=Boolean(record.historicalAcceptedClaim||legacyStatus==="已接收"||record.events.some(event=>event.status==="已接收"));
        record.runtimeVerificationId="";
        record.currentVerification={status:"本会话待重读",checkedAt:"",exchangeOrigin:location.origin,issues:["尚未在当前页面会话重新读取 M01 的已接收合同、完整回执与目标 Draft"]};
      });
      next.scenarioContext=saved.scenarioContext&&typeof saved.scenarioContext==="object"?saved.scenarioContext:null;
      next.scenarioContextHistory=Array.isArray(saved.scenarioContextHistory)?saved.scenarioContextHistory:[];
      next.scenarioRunHistory=Array.isArray(saved.scenarioRunHistory)?saved.scenarioRunHistory:[];
      next.t008Confirmation=saved.t008Confirmation&&typeof saved.t008Confirmation==="object"?saved.t008Confirmation:null;
      next.ontologyDiscovery=saved.ontologyDiscovery&&typeof saved.ontologyDiscovery==="object"?saved.ontologyDiscovery:null;
      next.ontologyDiscoveryHistory=Array.isArray(saved.ontologyDiscoveryHistory)?saved.ontologyDiscoveryHistory:[];
      next.ontologyDiscoveryStatus=saved.ontologyDiscoveryStatus||defaults.ontologyDiscoveryStatus;
      next.ontologyDiscoveryError=saved.ontologyDiscoveryError||"";
      next.qualityRules=Array.isArray(saved.qualityRules)&&saved.qualityRules.length?saved.qualityRules:copy(D.qualityRules||[]);
      next.runs=Array.isArray(saved.runs)?saved.runs:defaults.runs;
      next.assetVersions=Array.isArray(saved.assetVersions)?saved.assetVersions:defaults.assetVersions;
      next.customSources=Array.isArray(saved.customSources)?saved.customSources:[];
      next.customPipelines=Array.isArray(saved.customPipelines)?saved.customPipelines:[];
      next.customAssets=Array.isArray(saved.customAssets)?saved.customAssets:[];
      next.uploadedSnapshots=Array.isArray(saved.uploadedSnapshots)?saved.uploadedSnapshots:[];
      next.snapshotReadEvents=Array.isArray(saved.snapshotReadEvents)?saved.snapshotReadEvents:[];
      next.currentSnapshotSelections=saved.currentSnapshotSelections&&typeof saved.currentSnapshotSelections==="object"?saved.currentSnapshotSelections:{};
      next.awaitingScenarioContext=Boolean(saved.awaitingScenarioContext);
      next.scenarioResetRequestedAt=saved.scenarioResetRequestedAt||"";
      next.authorityVersionIds=saved.authorityVersionIds&&typeof saved.authorityVersionIds==="object"?saved.authorityVersionIds:{};
      next.previousAuthorityVersionIds=saved.previousAuthorityVersionIds&&typeof saved.previousAuthorityVersionIds==="object"?saved.previousAuthorityVersionIds:{"FIN-ASSET":saved.previousAuthorityVersionId||""};
      next.runs.forEach(run=>{
        const definition=next.publishedDefinitions.find(d=>d.id===run.definitionVersion);
        run.pipelineId=run.pipelineId||definition?.pipelineId||"finance-pipeline";
        run.pipelineName=run.pipelineName||D.pipelines.find(p=>p.id===run.pipelineId)?.name||(SCENARIO_ID==="S003"?"债务风险输入标准化与候选发布":"融资数据标准化与发布");
        run.executionStatus=run.executionStatus||"历史执行证据不可定位";
        run.executionEndedAt=run.executionEndedAt||"";
        run.closureStatus=run.closureStatus||"历史闭环证据不可定位";
        run.closedLoopEndedAt=run.closedLoopEndedAt||"";
        run.scenarioIdentityStatus=validateScenarioContext(run.scenarioContext).okay?"已证明":"场景身份不可证明";
      });
      next.assetVersions.forEach(version=>{
        const memberEvidence=Array.isArray(version.members)&&version.members.length>0&&version.members.every(member=>member.stableId&&Number.isFinite(member.rowCount));
        const relationshipEvidence=Array.isArray(version.relationships)&&version.relationships.length>0&&version.relationships.every(relationship=>typeof relationship==="object"&&relationship.stableId&&Number.isFinite(relationship.checkedCount)&&Number.isFinite(relationship.unmatchedCount)&&relationship.status);
        const identityEvidence=Boolean(version.inputContentFingerprint&&version.memberContractFingerprint&&version.relationshipContractFingerprint&&version.businessOutputFingerprint);
        version.evidenceIntegrity=memberEvidence&&relationshipEvidence&&identityEvidence?"完整":"历史证据不可定位";
        version.scenarioIdentityStatus=validateScenarioContext(version.scenarioContext).okay?"已证明":"场景身份不可证明";
      });
      if(next.refreshStatus==="querying"){
        recovered=true;
        next.refreshStatus="unknown";
        next.refreshFailureReason="页面恢复后，原刷新请求的最终结果尚未重新核对";
        next.t018Status="结果待核对";
        next.t019Status="未切换";
        const activeAttempt=next.refreshAttempts.find(x=>x.requestId===next.refreshRequestId);
        if(activeAttempt){
          activeAttempt.requestStatus="结果待核对";
          activeAttempt.failureReason=next.refreshFailureReason;
          activeAttempt.recovery="查询原请求，不要直接创建重复请求";
          activeAttempt.events=Array.isArray(activeAttempt.events)?activeAttempt.events:[];
          activeAttempt.events.push({stage:"查询",status:"页面恢复后待核对",at:nowText(),evidenceId:activeAttempt.requestId});
        }
        const interruptedRun=next.runs.find(r=>r.id===next.currentRunId);if(interruptedRun){interruptedRun.status="已发布 · 刷新结果未知";interruptedRun.refresh=`${next.refreshRequestId} · 结果未知`;const refreshExecution=interruptedRun.nodeExecutions?.find(x=>x.key==="refresh");if(refreshExecution){refreshExecution.status="结果未知";refreshExecution.endedAt=nowText();refreshExecution.outputSummary=next.refreshFailureReason;next.runNodeStates[refreshExecution.id]="waiting-confirmation";const attemptExecution=refreshExecution.attempts?.find(x=>x.requestId===next.refreshRequestId);if(attemptExecution){attemptExecution.status="结果未知";attemptExecution.endedAt=nowText();attemptExecution.outputSummary=next.refreshFailureReason;}}}
        const interruptedVersion=next.assetVersions.find(v=>v.id===next.candidateVersionId);if(interruptedVersion){interruptedVersion.refreshStatus="结果未知";interruptedVersion.t018Status="结果待核对";interruptedVersion.t019Status="未切换";}
      }
      if(next.runStatus==="running"){
        recovered=true;
        const interruptedRun=next.runs.find(r=>r.id===next.currentRunId),runningExecution=interruptedRun?.nodeExecutions?.find(x=>x.status==="运行中");
        next.runStatus="failed";next.qualityStatus="not-run";
        if(interruptedRun){interruptedRun.status="失败";interruptedRun.endedAt=nowText();interruptedRun.failureNode=runningExecution?.name||"正式运行";interruptedRun.failureReason="页面恢复时检测到上次正式运行已中断";interruptedRun.recovery="按原输入和已发布定义创建关联重试";interruptedRun.quality=interruptedRun.qualityId?interruptedRun.quality:"未完成";}
        if(runningExecution){runningExecution.status="失败";runningExecution.endedAt=nowText();runningExecution.outputSummary="运行中断，未形成后续正式结果";next.runNodeStates[runningExecution.id]="failed";}
      }
      if(recovered)localStorage.setItem(FLOW_KEY,JSON.stringify(next));
      return next;
    }
    catch (_) { return initialFlow(); }
  }
  let flow = loadFlow();
  const ui = {
    resourceQuery: "",
    sourceView: "list",
    assetView: "list",
    selectedSourceId: "finance-workbook",
    collapsedGroups: new Set(),
    selectedSheet: { "finance-workbook": "finance-detail", "s003-workbook": "s003-financial" },
    modal: null,
    toast: "",
    sourceDraft: { step: 1, type: "", name: "", description: "", asOfMode: "人工确认", schedule: "manual", timezone: "Asia/Shanghai", time: "09:00", template: "workbook", fileChosen: false, folderPath: "/data/inbound/finance/" },
    uploadDraft: { fileName: "" },
    pipelineDraft: { step: 1, name: "新数据管道", assetName:"新数据资产", purpose: "", template: "five", schedule: "manual" },
    canvasId: "",
    canvas: null,
    codeSearch: "",
    versionMenu: false,
    moreMenu: false,
    pendingCanvasTransition: null
  };
  let toastTimer = 0;
  let demoTimer = 0;
  let runTimer = 0;
  let dragState = null;
  let panState = null;
  let suppressCanvasClick = false;
  let tableScrollDrag = null;
  let resizeState = null;
  let framePending = false;
  const pendingHandoffRequests = new Map();
  let ontologyFramePromise = null;
  let c003RetryInFlight = false;

  function parseScenarioContextCandidate(value) {
    if(!value||typeof value!=="object")return null;
    const context={};SCENARIO_CONTEXT_FIELDS.forEach(field=>context[field]=String(value[field]??"").trim());
    return context;
  }
  function validateScenarioContext(value) {
    const context=parseScenarioContextCandidate(value),problems=[];
    if(!context)return {okay:false,context:null,problems:["平台场景上下文尚未取得"]};
    SCENARIO_CONTEXT_FIELDS.forEach(field=>{if(!context[field])problems.push(`${field} 缺失`);});
    if(context.scenarioId&&context.scenarioId!==SCENARIO_ID)problems.push(`场景不匹配：需要 ${SCENARIO_ID}`);
    if(context.formedAt&&Number.isNaN(Date.parse(context.formedAt.replace(" ","T"))))problems.push("形成时间无效");
    if(context.status&&/成功|完成|就绪|采用/.test(context.status))problems.push("平台场景状态不得携带业务成功结论");
    if(context.status&&/(?:停用|未知|无效|已结束|inactive|unknown|disabled)/i.test(context.status))problems.push("平台场景上下文当前不可用");
    return {okay:problems.length===0,context,problems};
  }
  function sameScenarioContext(left,right) {
    const a=parseScenarioContextCandidate(left?.scenarioContext||left),b=parseScenarioContextCandidate(right?.scenarioContext||right);
    return Boolean(a&&b&&SCENARIO_CONTEXT_FIELDS.every(field=>a[field]===b[field]));
  }
  function observePlatformScenarioContext(value,source="平台公共层") {
    const candidate=value?.scenarioContext||value,gate=validateScenarioContext(candidate);
    platformScenarioObservation={context:gate.context?copy(gate.context):null,source,observedAt:nowText(),problems:copy(gate.problems||[])};
    return gate;
  }
  function platformScenarioContextGate() {
    const gate=validateScenarioContext(platformScenarioObservation.context);
    return {...gate,source:platformScenarioObservation.source,observedAt:platformScenarioObservation.observedAt};
  }
  function readPlatformScenarioContextFromSharedState() {
    try{
      const raw=localStorage.getItem(SCENARIO_CONTEXT_KEY);
      if(!raw)return {okay:false,context:null,problems:["平台公共层共享状态中尚无 C033"]};
      return observePlatformScenarioContext(JSON.parse(raw),"平台公共层共享状态");
    }catch(_){return {okay:false,context:null,problems:["平台公共层 C033 共享状态无法读取"]};}
  }
  function receiveScenarioContext(value,source="平台") {
    const gate=observePlatformScenarioContext(value,source);if(!gate.okay)return gate;
    const previous=flow.scenarioContext;
    const resetPrevious=flow.awaitingScenarioContext?flow.scenarioRunHistory.at(-1):null;
    if(resetPrevious?.scenarioRunId===gate.context.scenarioRunId)return {okay:false,context:gate.context,problems:["平台尚未提供新的 scenarioRunId；旧轮次不能重新进入当前工作投影"]};
    if(previous&&!sameScenarioContext(previous,gate.context)&&!flow.awaitingScenarioContext)return {okay:false,context:gate.context,problems:["当前场景工作轮次已存在；请先执行定向重置，再由平台提供新轮次"]};
    if(previous&&!sameScenarioContext(previous,gate.context))flow.scenarioContextHistory.push({...previous,replacedAt:nowText(),replacedBy:gate.context.scenarioRunId});
    flow.scenarioContext={...gate.context,receivedAt:nowText(),source};flow.scenarioId=gate.context.scenarioId;flow.awaitingScenarioContext=false;flow.scenarioResetRequestedAt="";saveFlow();return gate;
  }
  function scenarioContextGate() {
    const work=validateScenarioContext(flow.scenarioContext),platform=platformScenarioContextGate(),problems=[];
    if(!work.okay)problems.push(...work.problems.map(problem=>`数据工程工作投影：${problem}`));
    if(!platform.okay)problems.push(...platform.problems.map(problem=>`平台公共层：${problem}`));
    if(work.okay&&platform.okay&&!sameScenarioContext(work.context,platform.context))problems.push("数据工程工作投影与平台公共 C033 五字段不一致");
    return {okay:problems.length===0,context:work.context,platformContext:platform.context,platformSource:platform.source,platformObservedAt:platform.observedAt,problems:[...new Set(problems)]};
  }
  function receiveScenarioContextFromUrl() {
    const params=new URLSearchParams(location.search),candidate={scenarioId:params.get("scenarioId"),scenarioVersion:params.get("scenarioVersion"),scenarioRunId:params.get("scenarioRunId"),formedAt:params.get("contextCreatedAt")||params.get("formedAt"),status:params.get("contextStatus")||params.get("status")};
    if(SCENARIO_CONTEXT_FIELDS.some(field=>candidate[field]))receiveScenarioContext(candidate,"平台统一入口深链");
    else {const shared=readPlatformScenarioContextFromSharedState();if(shared.okay)receiveScenarioContext(shared.context,"平台公共层共享状态");}
  }
  function c003ScenarioContractState(version,run,record=null) {
    const platformGate=platformScenarioContextGate(),productionContext=parseScenarioContextCandidate(version?.scenarioContext||run?.scenarioContext),runContext=parseScenarioContextCandidate(run?.scenarioContext),deliveryContext=parseScenarioContextCandidate(record?.payload?.scenarioContext),issues=[];
    if(!platformGate.okay)issues.push(...platformGate.problems.map(problem=>`平台公共 C033：${problem}`));
    if(!validateScenarioContext(productionContext).okay)issues.push("已发布数据资产缺少完整生产轮次 C033");
    if(runContext&&!sameScenarioContext(productionContext,runContext))issues.push("正式运行与已发布数据资产的生产轮次不一致");
    if(deliveryContext&&!sameScenarioContext(productionContext,deliveryContext))issues.push("交付尝试与已发布数据资产的生产轮次不一致");
    const crossRound=Boolean(platformGate.okay&&productionContext&&!sameScenarioContext(productionContext,platformGate.context));
    if(crossRound)issues.push("旧 T007/正式运行的生产轮次与平台当前工作轮次不一致；现行 C003/C033 未授权跨轮次重交付");
    return {okay:issues.length===0,crossRound,contractConflict:crossRound,platformContext:platformGate.context,platformSource:platformGate.source,platformObservedAt:platformGate.observedAt,productionContext,runContext,deliveryContext,issues:[...new Set(issues)]};
  }
  function handoffRequestId(operation) { return `DE-${operation}-${Date.now()}-${Math.random().toString(16).slice(2,8)}`; }
  function ontologyBridgeEntryUrl() {
    const observed=platformScenarioObservation.context||flow.scenarioContext||{};
    const url=new URL(ONTOLOGY_ENTRY_PATH,location.origin);
    const values={
      scenarioId:SCENARIO_ID,
      scenarioVersion:observed.scenarioVersion||SCENARIO_VERSION,
      scenarioRunId:observed.scenarioRunId||SCENARIO_RUN_ID,
      formedAt:observed.formedAt||ENTRY_PARAMS.get("formedAt")||ENTRY_PARAMS.get("contextCreatedAt")||ENTRY_PARAMS.get("scenarioFormedAt")||"",
      status:observed.status||ENTRY_PARAMS.get("status")||ENTRY_PARAMS.get("contextStatus")||ENTRY_PARAMS.get("scenarioStatus")||"",
      baselineVersion:ENTRY_PARAMS.get("baselineVersion")||"v1.0.3",
      baselineSnapshotId:ENTRY_PARAMS.get("baselineSnapshotId")||"BSL-S001-V103-DE0119608E26",
      prototypeVersion:ENTRY_PARAMS.get("prototypeVersion")||"v1.1.0"
    };
    Object.entries(values).forEach(([key,value])=>{if(value)url.searchParams.set(key,value);});
    url.hash="modeling";
    return url.href;
  }
  function ontologyFrameReadyForC003(frame) {
    try{
      const bridge=frame?.contentWindow?.ontologyReview;
      if(!bridge?.handoffSnapshot)return false;
      if(SCENARIO_ID!=="S003")return true;
      const snapshot=bridge.handoffSnapshot(),expected=platformScenarioObservation.context||flow.scenarioContext;
      if(!snapshot||!expected||!sameScenarioContext(snapshot.scenarioContext,expected))return false;
      const published=(snapshot.published||[]).filter(item=>sameScenarioContext(item.scenarioContext,expected));
      const drafts=(snapshot.drafts||[]).filter(item=>item.integrationOnly===true&&sameScenarioContext(item.scenarioContext,expected));
      return published.length>0&&drafts.some(item=>published.some(version=>version.versionId===item.basedOnVersionId));
    }catch(_){return false;}
  }
  function waitForOntologyFrameReady(frame,timeoutMs=7000) {
    return new Promise(resolve=>{
      const started=Date.now();
      const check=()=>{
        if(ontologyFrameReadyForC003(frame))return resolve(true);
        if(Date.now()-started>=timeoutMs)return resolve(false);
        setTimeout(check,40);
      };
      check();
    });
  }
  function ensureOntologyBridgeFrame() {
    if(ontologyFramePromise)return ontologyFramePromise;
    ontologyFramePromise=new Promise(resolve=>{
      let settled=false;const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);if(!value)ontologyFramePromise=null;resolve(value);},timer=setTimeout(()=>finish(null),8500);
      const expectedSrc=ontologyBridgeEntryUrl();
      const afterLoad=async frame=>{
        frame.dataset.ready="true";
        const ready=await waitForOntologyFrameReady(frame);
        finish(ready?frame:null);
      };
      let existing=document.getElementById("ontology-handoff-frame");
      if(existing&&existing.src!==expectedSrc){existing.remove();existing=null;}
      if(existing){if(existing.dataset.ready==="true")return void afterLoad(existing);existing.addEventListener("load",()=>afterLoad(existing),{once:true});existing.addEventListener("error",()=>finish(null),{once:true});return;}
      const frame=document.createElement("iframe");frame.id="ontology-handoff-frame";frame.title="本体管理合同交换";frame.hidden=true;frame.setAttribute("aria-hidden","true");frame.src=expectedSrc;frame.addEventListener("load",()=>afterLoad(frame),{once:true});frame.addEventListener("error",()=>finish(null),{once:true});document.body.appendChild(frame);
    });
    return ontologyFramePromise;
  }
  async function ontologyBridgeRequest(operation,payload,timeoutMs=2400) {
    const frame=await ensureOntologyBridgeFrame();
    return new Promise(resolve=>{
      const requestId=handoffRequestId(operation),message={channel:HANDOFF_CHANNEL,targetModule:"本体管理",requestId,operation,payload};
      const timer=setTimeout(()=>{pendingHandoffRequests.delete(requestId);resolve({ok:false,error:"本体管理未在规定时间内返回结果",result:null,timeout:true});},timeoutMs);
      pendingHandoffRequests.set(requestId,{operation,resolve:response=>{clearTimeout(timer);pendingHandoffRequests.delete(requestId);resolve(response);}});
      let sentToFrame=false;
      try{if(frame?.contentWindow){frame.contentWindow.postMessage(message,location.origin);sentToFrame=true;}}catch(_){/* The same-origin fallback below remains available. */}
      if(!sentToFrame){
        try{if(window.parent&&window.parent!==window)window.parent.postMessage(message,location.origin);}catch(_){/* Storage fallback remains available. */}
        try{localStorage.setItem(`${HANDOFF_CHANNEL}:request`,JSON.stringify(message));}catch(_){/* Timeout reports the unresolved result. */}
      }
    });
  }
  function platformScenarioContextEnvelope(context=platformScenarioObservation.context) {
    const gate=validateScenarioContext(context);if(!gate.okay)return null;
    return {
      sourceModule:"平台公共层",
      contractCode:"C033",
      contextId:`C033-${gate.context.scenarioId}-${gate.context.scenarioRunId}`,
      deliveredAt:gate.context.formedAt,
      evidenceLocator:`统一平台 / 场景工作区 / ${gate.context.scenarioId} / ${gate.context.scenarioRunId}`,
      scenarioContext:copy(gate.context),
      relayedBy:"数据工程",
      relayedAt:nowText()
    };
  }
  async function ensureOntologyScenarioContext(payloadContext) {
    const platformGate=platformScenarioContextGate(),issues=[];
    if(!platformGate.okay)issues.push(...platformGate.problems.map(problem=>`平台公共 C033：${problem}`));
    if(platformGate.okay&&!sameScenarioContext(platformGate.context,payloadContext))issues.push("平台当前 C033 与本次 C003 生产轮次不一致，不能代为转交");
    const envelope=issues.length?null:platformScenarioContextEnvelope(platformGate.context);
    if(!envelope)return {okay:false,envelope:null,receipt:null,issues:[...new Set(issues.length?issues:["平台公共 C033 完整包络不可形成"])]};
    const response=await ontologyBridgeRequest("deliverScenarioContext",envelope),receipt=response?.result||null;
    const receiptIssues=response?.ok?c033RootReceiptIssues(receipt,{scenarioContext:payloadContext}):[response?.error||receipt?.reason||"M01 未返回 C033 接收回执"];
    return {okay:Boolean(response?.ok&&receipt?.status==="accepted"&&!receiptIssues.length),envelope,receipt,issues:[...new Set(receiptIssues)]};
  }
  function handleOntologyHandoffResponse(payload) {
    if(!payload||payload.channel!==HANDOFF_CHANNEL||payload.targetModule!=="本体管理"||!payload.requestId)return;
    const pending=pendingHandoffRequests.get(payload.requestId);if(!pending||pending.operation!==payload.operation)return;
    pending.resolve(payload);
  }
  async function sha256Hex(file) {
    const buffer=await file.arrayBuffer();
    const digest=await crypto.subtle.digest("SHA-256",buffer);
    return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
  }
  async function registerSnapshotFile(file,sourceId) {
    const scenarioGate=scenarioContextGate();
    if(!scenarioGate.okay)throw new Error(`当前不能登记本轮快照：${scenarioGate.problems.join("；")}`);
    const readStartedAt=nowText(),started=performance.now(),hash=await sha256Hex(file),readCompletedAt=nowText(),readDurationMs=Math.max(0,Math.round(performance.now()-started));
    const existing=D.sources.flatMap(source=>(source.snapshots||[]).map(snapshot=>({source,snapshot}))).find(item=>item.source.id===sourceId&&item.snapshot.hash===hash);
    const readEvent={eventId:`READ-${Date.now()}-${hash.slice(0,8).toUpperCase()}`,sourceId,fileName:file.name,sizeBytes:file.size,hash,readStartedAt,readCompletedAt,readDurationMs,scenarioContext:copy(scenarioGate.context),duplicate:Boolean(existing),snapshotId:existing?.snapshot?.snapshotId||null};
    flow.snapshotReadEvents.push(readEvent);
    if(existing){flow.currentSnapshotSelections[sourceId]=existing.snapshot.snapshotId;if(sourceId==="finance-workbook"){flow.snapshotConfirmed=false;flow.asOfDate="";flow.t008Confirmation=null;}saveFlow();return {duplicate:true,existing,hash,readEvent,reusedForCurrentRun:true};}
    const structureVerified=hash===VERIFIED_FINANCE_SHA256&&file.size===VERIFIED_FINANCE_SIZE;
    const sourceToken=String(sourceId).replace(/[^A-Za-z0-9]/g,"-").toUpperCase();
    const snapshotId=`T002-${sourceToken}-${hash.slice(0,12).toUpperCase()}`;
    readEvent.snapshotId=snapshotId;
    const downloadUrl=typeof URL!=="undefined"&&URL.createObjectURL?URL.createObjectURL(file):"";
    const snapshot={snapshotId,t002Id:snapshotId,fileName:file.name,acquiredAt:readCompletedAt,asOf:"待确认",hash,size:`${new Intl.NumberFormat("zh-CN").format(file.size)} 字节`,sizeBytes:file.size,downloadUrl,readStartedAt,readCompletedAt,readDurationMs,scope:structureVerified?"2 个业务输入 Sheet · 结构已核验":"工作簿已登记 · 结构待核验",status:structureVerified?"已登记":"已登记 · 正式运行阻断",structureStatus:structureVerified?"结构已核验":"结构未核验",structureEvidence:structureVerified?"内容指纹与已核验融资工作簿一致":"当前内容指纹未命中已核验结构",current:true};
    flow.uploadedSnapshots.push({sourceId,snapshot,registeredInScenario:copy(scenarioGate.context),registeredAt:readCompletedAt});
    flow.currentSnapshotSelections[sourceId]=snapshotId;
    if(sourceId==="finance-workbook"){flow.snapshotConfirmed=false;flow.asOfDate="";flow.t008Confirmation=null;}
    saveFlow();return {duplicate:false,snapshot};
  }
  function resetScenarioRun() {
    const previous=flow.scenarioContext;
    if(previous){flow.scenarioRunHistory.push({...previous,resetAt:nowText(),preservedRunIds:flow.runs.map(run=>run.id),preservedAssetVersionIds:flow.assetVersions.map(version=>version.id),preservedDeliveryIds:flow.dataAssetDeliveries.map(delivery=>delivery.deliveryId).filter(Boolean),preservedRefreshRequestIds:flow.refreshAttempts.map(attempt=>attempt.requestId).filter(Boolean),preservedSnapshotIds:flow.uploadedSnapshots.map(entry=>entry.snapshot?.snapshotId).filter(Boolean),preservedSnapshotReadEventIds:flow.snapshotReadEvents.map(event=>event.eventId).filter(Boolean),preservedAuthorityVersionIds:copy(flow.authorityVersionIds||{})});flow.scenarioContextHistory.push({...previous,resetAt:nowText(),resetStatus:"等待平台新轮次"});}
    flow.scenarioContext=null;
    flow.snapshotConfirmed=false;flow.asOfDate="";flow.t008Confirmation=null;flow.definitionPublished=false;flow.definitionVersion="";flow.currentRunId="";flow.runStatus="idle";flow.runStep=-1;flow.qualityStatus="idle";flow.refreshStatus="idle";flow.refreshRequestId="";flow.refreshResultId="";flow.refreshFailureReason="";flow.candidateVersionId="";flow.runPlan=[];flow.runNodeStates={};flow.canvasDrafts={};
    flow.consumptionStatus="not-ready";flow.t018Status="尚未形成";flow.t019Status="未提交";flow.t019EvidenceId="";flow.t019AdoptedAt="";flow.t019Owner="";flow.authorityVersionId="";flow.previousAuthorityVersionId="";flow.authorityVersionIds={};flow.previousAuthorityVersionIds={};
    flow.currentSnapshotSelections={};flow.refreshBindingSelections={};flow.ontologyDiscovery=null;flow.ontologyDiscoveryStatus="not-read";flow.ontologyDiscoveryError="";flow.folderSyncAt="";flow.awaitingScenarioContext=true;flow.scenarioResetRequestedAt=nowText();
    saveFlow();return {status:"等待平台提供新轮次",requestedAt:flow.scenarioResetRequestedAt};
  }

  function nowText() { return new Intl.DateTimeFormat("zh-CN", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false }).format(new Date()).replaceAll("/","-"); }
  function dateStamp() { const d=new Date(); return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`; }
  function nextDefinitionVersion() { return `DEF-${dateStamp()}-${String(flow.definitionRevision + 1).padStart(2,"0")}`; }
  function stableString(value) { return JSON.stringify(value); }
  function relationLabel(value) { return typeof value==="string"?value:(value?.name||value?.label||`${value?.fromMember||value?.from||"上游成员"} → ${value?.toMember||value?.to||"下游成员"}`); }
  function outputMemberRowCount(member) {
    const counts={"融资主体参考":574,"融资明细":5218,"金融机构参考":24,"融资负责人参考":24};
    return counts[member?.name]??null;
  }
  function materializePublishedMembers(asset,versionId) {
    return copy(asset?.members||[]).map((member,index)=>({...member,stableId:`${versionId}-M${String(index+1).padStart(2,"0")}`,rowCount:outputMemberRowCount(member),qualityStatus:"通过"}));
  }
  function materializePublishedRelationships(asset,members,versionId) {
    const memberById=new Map((members||[]).map(member=>[member.id,member]));
    return copy(asset?.relationshipContracts||asset?.relationships||[]).map((relationship,index)=>{
      const contract=typeof relationship==="object"&&relationship?relationship:{name:String(relationship)};
      const checkedCount=memberById.get(contract.sourceMemberId)?.rowCount??null;
      return {...contract,stableId:`${versionId}-R${String(index+1).padStart(2,"0")}`,checkedCount,unmatchedCount:checkedCount===null?null:0,status:checkedCount===null?"待核验":"通过"};
    });
  }
  function fieldContractArray(field,index,memberId) {
    if(Array.isArray(field))return field;
    return [field.name,field.type||fieldType(field.name),field.sample||field.description||"",field.fieldId||`${memberId}-FIELD-${String(index+1).padStart(2,"0")}`];
  }
  function c003Members(asset,version) {
    return (version.members||[]).map(published=>{
      const contract=(asset.members||[]).find(member=>member.id===published.id)||published,fields=(contract.fields||[]).map((field,index)=>fieldContractArray(field,index,contract.id));
      const identityField=fields.find(field=>field[0]===contract.key)||fields[0];
      const objectIds={"FIN-MEMBER-SUBJECT":"OBJ-FINANCING-ENTITY","FIN-MEMBER-DETAIL":"OBJ-FINANCING-DETAIL","FIN-MEMBER-INSTITUTION":"OBJ-FINANCIAL-INSTITUTION","FIN-MEMBER-OWNER":"OBJ-FINANCING-OWNER"};
      return {id:contract.id,name:contract.name,objectId:contract.objectId||objectIds[contract.id]||null,grain:contract.grain,identity:contract.key,identityFieldId:contract.identityFieldId||identityField?.[3],identityCheckStatus:"通过",identityMissingCount:0,identityDuplicateCount:0,identityEvidenceLocator:`数据工程 / 身份检查 / ${contract.id} / ${version.id}`,rows:published.rowCount,fields};
    });
  }
  function c003Relations(asset,version) {
    return (version.relationships||[]).map(published=>{
      const contract=(asset.relationshipContracts||[]).find(relation=>relation.id===published.id)||published;
      return {id:contract.id,name:contract.name,sourceMemberId:contract.sourceMemberId,sourceFieldId:contract.sourceFieldId,targetMemberId:contract.targetMemberId,targetFieldId:contract.targetFieldId,cardinality:contract.cardinality||"多对一",endpointCheckStatus:"通过",unmatchedSourceCount:published.unmatchedCount??0,unmatchedTargetCount:0,endpointEvidenceLocator:contract.endpointEvidenceLocator||`数据工程 / 关系检查 / ${contract.id} / ${version.id}`};
    });
  }
  function t008EvidenceId(snapshotId,asOf) {
    return trustEvidenceId("T008",`${snapshotId||"UNKNOWN"}-${asOf||"UNKNOWN"}`);
  }
  const C003_RECEIPT_FIELDS=["sourceModule","contractCode","deliveryId","status","receivedAt","reason","scenarioContext","targetDraftId","targetDraftRevision","t006Id","t007Version","t008AsOf","previousDraftId","previousAssetVersion","replacement"];
  function t008ConfirmationForDelivery(version,run) {
    const snapshotId=version?.sourceSnapshotId||"",snapshot=flow.uploadedSnapshots.find(entry=>entry.snapshot?.snapshotId===snapshotId)?.snapshot||D.sources.flatMap(source=>source.snapshots||[]).find(item=>item.snapshotId===snapshotId)||null;
    const candidate=run?.t008Confirmation||snapshot?.t008Confirmation||(flow.t008Confirmation?.snapshotId===snapshotId?flow.t008Confirmation:null);
    return {snapshotId,asOf:version?.asOf||"",confirmedBy:candidate?.confirmedBy||null,confirmedAt:candidate?.confirmedAt||null,basis:candidate?.basis||null,sizeBytes:Number(snapshot?.sizeBytes)||null,scenarioContext:copy(parseScenarioContextCandidate(candidate?.scenarioContext)),evidenceId:candidate?.evidenceId||t008EvidenceId(snapshotId,version?.asOf),evidenceLocator:candidate?`数据工程 / 数据截至时间确认 / ${snapshotId} / ${version?.asOf||"未确认"}`:null};
  }
  function canonicalC003Value(value) {
    if(Array.isArray(value))return value.map(canonicalC003Value);
    if(!value||typeof value!=="object")return value;
    return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonicalC003Value(value[key])]));
  }
  function canonicalC003Text(value) { return JSON.stringify(canonicalC003Value(value)); }
  function c003Fingerprint(value) {
    const text=canonicalC003Text(value);let hash=2166136261;
    for(let index=0;index<text.length;index+=1){hash^=text.charCodeAt(index);hash=Math.imul(hash,16777619);}
    return `C003-PF-${(hash>>>0).toString(16).padStart(8,"0").toUpperCase()}-${text.length}`;
  }
  function c003DeliverySeriesId(version) { return `C003-${version?.id||"UNKNOWN"}`; }
  function c003DeliveryAttemptId(version,attemptNumber=1) { const base=c003DeliverySeriesId(version);return attemptNumber<=1?base:`${base}-A${String(attemptNumber).padStart(2,"0")}`; }
  function c003AttemptNumberFromId(seriesId,deliveryId) {
    if(deliveryId===seriesId)return 1;
    const escaped=String(seriesId||"").replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),match=String(deliveryId||"").match(new RegExp(`^${escaped}-A(\\d+)$`));
    return match?Number(match[1]):null;
  }
  function c003DeliveryRecords(version) {
    const seriesId=c003DeliverySeriesId(version);
    return flow.dataAssetDeliveries.filter(item=>item.assetVersionId===version?.id||item.deliverySeriesId===seriesId||c003AttemptNumberFromId(seriesId,item.deliveryId)!==null).sort((left,right)=>(Number(left.attemptNumber||1)-Number(right.attemptNumber||1))||String(left.submittedAt||"").localeCompare(String(right.submittedAt||"")));
  }
  function latestC003DeliveryRecord(version) { return c003DeliveryRecords(version).at(-1)||null; }
  function dataAssetDeliveryPayload(asset,version,run,attempt={}) {
    const attemptNumber=attempt.attemptNumber||1,deliveryId=attempt.deliveryId||c003DeliveryAttemptId(version,attemptNumber),scenarioContext=parseScenarioContextCandidate(version.scenarioContext),t008Confirmation=t008ConfirmationForDelivery(version,run);
    const s003 = SCENARIO_ID === "S003";
    const publishedDefinitionRecord = publishedDefinition(version.definitionVersion);
    const payload={sourceModule:"数据工程",contractCode:"C003",deliveryId,deliverySeriesId:c003DeliverySeriesId(version),attemptNumber,retryOf:attempt.retryOf||null,previousDeliveryId:attempt.retryOf||null,deliveryStatus:"已发送",deliveredAt:nowText(),scenarioContext,evidenceLocator:`数据工程 / 已发布数据资产 / ${version.id}`,assetId:asset.t006Id,t006Id:asset.t006Id,assetName:asset.name,assetVersion:version.id,t007Version:version.id,asOf:version.asOf,t008AsOf:version.asOf,t008Confirmation,sourceSnapshotId:version.sourceSnapshotId,sourceFingerprint:{algorithm:"SHA-256",value:version.sourceHash||run.snapshotHash||"",sizeBytes:t008Confirmation.sizeBytes},processingModuleVersion:`${publishedDefinitionRecord?.pythonModule?.name||(s003?"债务风险数据标准化":"融资工作簿标准化")} ${publishedDefinitionRecord?.pythonModule?.version||"v1.0.0"}`,publishedAt:version.publishedAt,versionDescription:`形成 ${version.members.length} 个成员及 ${version.relationships.length} 条成员关系。`,source:version.sourceSnapshot,sourceChain:[version.sourceSnapshotId,version.definitionVersion,version.runId,version.qualityId,version.id].filter(Boolean),publicationState:"已发布",purpose:s003?"支撑 S003 债务风险语义建模":"S001 融资语义建模",consumptionRestriction:s003?"仅供获准的 S003 本体映射与债务风险评估消费":"仅供获准的 S001 本体映射与候选验证",lineageCheckStatus:"通过",lineageEvidenceLocator:`数据工程 / 数据沿袭 / ${version.id}`,mappingEligibility:{status:"可供本体映射",evidenceLocator:`数据工程 / 已发布数据资产 / ${version.id}`},qualitySummary:{status:version.quality,resultId:version.qualityId,checkedAt:run.executionEndedAt||version.publishedAt,evidenceLocator:`数据工程 / 质量结果 / ${version.qualityId}`},runEvidence:{runId:version.runId,definitionVersion:version.definitionVersion,qualityResultId:version.qualityId,evidenceLocator:`数据工程 / 正式运行 / ${version.runId}`},members:c003Members(asset,version),relations:c003Relations(asset,version)};
    payload.payloadFingerprint=c003Fingerprint(payload);return payload;
  }
  function c003PayloadIssues(payload) {
    const confirmation=payload?.t008Confirmation,issues=[];
    const attemptNumber=c003AttemptNumberFromId(payload?.deliverySeriesId,payload?.deliveryId),declaredAttempt=Number(payload?.attemptNumber);
    if(!payload?.deliveryId||!payload?.deliverySeriesId||!Number.isSafeInteger(declaredAttempt)||declaredAttempt<1||attemptNumber!==declaredAttempt||payload.deliverySeriesId!==`C003-${payload?.assetVersion||"UNKNOWN"}`)issues.push("交付尝试标识、系列、精确资产版本或尝试序号不一致");
    const previousAttempt=c003AttemptNumberFromId(payload?.deliverySeriesId,payload?.retryOf);
    if((payload?.retryOf||null)!==(payload?.previousDeliveryId||null)||(declaredAttempt===1&&payload?.retryOf)||(declaredAttempt>1&&(!previousAttempt||previousAttempt>=declaredAttempt)))issues.push("新交付尝试没有精确回指同系列更早尝试，或首次尝试错误携带重试来源");
    if(payload?.deliveryStatus!=="已发送")issues.push("交付状态不是已发送");
    if(!payload?.deliveredAt||Number.isNaN(Date.parse(String(payload.deliveredAt).replace(" ","T"))))issues.push("交付时间缺失或无效");
    const payloadContextGate=validateScenarioContext(payload?.scenarioContext);if(!payloadContextGate.okay)issues.push(`C003 缺少完整有效的生产轮次 C033：${payloadContextGate.problems.join("；")}`);
    if(!confirmation||confirmation.snapshotId!==payload?.sourceSnapshotId||confirmation.asOf!==payload?.asOf||!confirmation.confirmedBy||!confirmation.confirmedAt||Number.isNaN(Date.parse(String(confirmation.confirmedAt).replace(" ","T")))||!confirmation.basis||!confirmation.evidenceLocator||!sameScenarioContext(confirmation.scenarioContext,payload?.scenarioContext))issues.push("T008 缺少精确快照、确认人、确认时间、依据、C033 或证据定位");
    if(!payload?.assetId||!payload?.assetVersion||payload.assetVersion!==payload.t007Version||!payload?.asOf||payload.asOf!==payload.t008AsOf)issues.push("C003 缺少精确 T006、T007 或 T008，或版本字段不一致");
    if(payload?.publicationState!=="已发布"||payload?.qualitySummary?.status!=="通过"||!payload?.qualitySummary?.resultId||!payload?.qualitySummary?.evidenceLocator)issues.push("数据资产尚未发布或质量结果身份、状态、证据不完整");
    if(!payload?.sourceSnapshotId||payload?.sourceFingerprint?.algorithm!=="SHA-256"||!/^[a-f0-9]{64}$/i.test(payload?.sourceFingerprint?.value||"")||!Number.isFinite(Number(payload?.sourceFingerprint?.sizeBytes))||Number(payload.sourceFingerprint.sizeBytes)<=0||!payload?.sourceChain?.length||!payload?.lineageEvidenceLocator)issues.push("来源快照、SHA-256、文件字节数、来源链或沿袭证据不完整");
    if(payload?.scenarioContext?.scenarioId==="S001"&&(payload.members?.length!==4||payload.relations?.length!==3))issues.push("S001 必须精确交付四个成员和三条关系");
    if(payload?.members?.some(member=>!member.id||!member.objectId||!member.grain||!member.identity||!member.identityFieldId||!Number.isFinite(member.rows)||!Array.isArray(member.fields)||member.fields.some(field=>!Array.isArray(field)||!field[0]||!field[3])))issues.push("成员的对象目标、粒度、稳定键、行数或字段稳定标识不完整");
    if(payload?.relations?.some(relation=>!relation.id||!relation.sourceMemberId||!relation.sourceFieldId||!relation.targetMemberId||!relation.targetFieldId||relation.endpointCheckStatus!=="通过"||!relation.endpointEvidenceLocator))issues.push("关系端点身份、检查状态或证据定位不完整");
    if(payload?.payloadFingerprint!==c003Fingerprint({...payload,payloadFingerprint:undefined}))issues.push("交付载荷指纹与当前内容不一致");
    return issues;
  }
  function c003PayloadBindingIssues(payload,version,run) {
    const registeredSnapshots=D.sources.flatMap(source=>(source.snapshots||[]).map(snapshot=>({source,snapshot})));
    const snapshot=flow.uploadedSnapshots.find(entry=>entry.snapshot?.snapshotId===version?.sourceSnapshotId)?.snapshot
      ||registeredSnapshots.find(entry=>entry.snapshot?.snapshotId===version?.sourceSnapshotId)?.snapshot
      ||null;
    const financialInput=(run?.inputs||[]).find(item=>item?.slotId==="financialWorkbook"||item?.resourceId==="s003-workbook"||item?.nodeId==="node-source-workbook")||null;
    const runSourceFingerprint=payload?.scenarioContext?.scenarioId==="S003"?financialInput?.fingerprint:run?.snapshotHash;
    const issues=[];
    if(!version||!run)issues.push("精确数据资产版本或正式运行不可定位");
    if(payload?.assetVersion!==version?.id||payload?.assetId!==version?.targetAssetId||payload?.asOf!==version?.asOf||payload?.sourceSnapshotId!==version?.sourceSnapshotId)issues.push("交付载荷与精确 T007、T006、T008 或 T002 不一致");
    if(run?.id!==version?.runId||run?.assetVersion!==version?.id||payload?.runEvidence?.runId!==run?.id||payload?.runEvidence?.definitionVersion!==version?.definitionVersion||payload?.runEvidence?.qualityResultId!==version?.qualityId)issues.push("交付载荷与正式运行、处理定义或质量结果不一致");
    if(!sameScenarioContext(payload?.scenarioContext,version?.scenarioContext)||!sameScenarioContext(payload?.scenarioContext,run?.scenarioContext))issues.push("交付、数据版本与正式运行的 C033 五字段不一致");
    if(payload?.sourceFingerprint?.value!==version?.sourceHash||!runSourceFingerprint||payload?.sourceFingerprint?.value!==runSourceFingerprint)issues.push("交付来源 SHA-256 与发布版本或正式运行中的财务工作簿输入不一致");
    if(!snapshot)issues.push("精确来源快照登记证据不可定位");else if(payload?.sourceFingerprint?.value!==snapshot.hash||Number(payload?.sourceFingerprint?.sizeBytes)!==Number(snapshot.sizeBytes))issues.push("交付来源指纹或文件字节数与精确快照登记证据不一致");
    if(payload?.qualitySummary?.resultId!==version?.qualityId||payload?.qualitySummary?.status!==version?.quality)issues.push("交付质量摘要与精确发布版本不一致");
    return issues;
  }
  function c003ReceiptIssues(receipt,payload) {
    const issues=[];
    if(!receipt||typeof receipt!=="object")return ["回执不存在"];
    C003_RECEIPT_FIELDS.forEach(field=>{if(!Object.prototype.hasOwnProperty.call(receipt,field))issues.push(`${field} 缺失`);});
    if(receipt.sourceModule!=="本体管理")issues.push("回执来源模块不匹配");
    if(receipt.contractCode!=="C003")issues.push("回执合同编号不匹配");
    if(receipt.deliveryId!==payload?.deliveryId)issues.push("回执交付标识不匹配");
    if(!["accepted","rejected"].includes(receipt.status))issues.push("回执状态无效");
    if(!receipt.receivedAt||Number.isNaN(Date.parse(String(receipt.receivedAt).replace(" ","T"))))issues.push("回执时间缺失或无效");
    if(!sameScenarioContext(receipt.scenarioContext,payload?.scenarioContext))issues.push("回执 C033 五字段与交付不一致");
    if(receipt.t006Id!==payload?.assetId)issues.push("回执 T006 不匹配");
    if(receipt.t007Version!==payload?.assetVersion)issues.push("回执 T007 不匹配");
    if(receipt.t008AsOf!==payload?.asOf)issues.push("回执 T008 不匹配");
    if(receipt.status==="accepted"){
      if(!receipt.targetDraftId||typeof receipt.targetDraftRevision!=="number"||!Number.isInteger(receipt.targetDraftRevision)||receipt.targetDraftRevision<1)issues.push("接收回执缺少目标 Draft 或精确修订号");
      if(receipt.reason!==null)issues.push("接收回执不应携带拒绝原因");
    }else{
      if(!String(receipt.reason||"").trim())issues.push("拒绝回执缺少原因");
      if(receipt.targetDraftId!==null||receipt.targetDraftRevision!==null)issues.push("拒绝回执不得声称已形成目标 Draft");
    }
    const hasPrevious=Boolean(receipt.previousDraftId||receipt.previousAssetVersion);
    if(Boolean(receipt.previousDraftId)!==Boolean(receipt.previousAssetVersion))issues.push("上一 Draft 与上一资产版本引用不成对");
    if(!hasPrevious&&(receipt.previousDraftId!==null||receipt.previousAssetVersion!==null))issues.push("首次接收必须将上一 Draft 与上一资产版本明确记为 null");
    if(hasPrevious){
      const replacement=receipt.replacement;
      if(!replacement||replacement.previousDraftId!==receipt.previousDraftId||replacement.newDraftId!==receipt.targetDraftId||replacement.previousAssetVersion!==receipt.previousAssetVersion||replacement.newAssetVersion!==payload?.assetVersion||replacement.relation!=="替代")issues.push("替代关系与新旧 Draft、资产版本不一致");
    }else if(receipt.replacement!==null)issues.push("没有上一版本时 replacement 必须明确为 null");
    return issues;
  }
  function sameC003Receipt(left,right) {
    if(!left||!right)return false;
    const project=value=>Object.fromEntries(C003_RECEIPT_FIELDS.map(field=>[field,value[field]]));
    return stableString(project(left))===stableString(project(right));
  }
  function c003ContractProjection(value) {
    if(!value||typeof value!=="object")return null;
    return {sourceModule:value.sourceModule||null,contractCode:value.contractCode||null,deliveryId:value.deliveryId||value.deliveryStableId||null,deliverySeriesId:value.deliverySeriesId||null,attemptNumber:Number.isInteger(value.attemptNumber)?value.attemptNumber:null,retryOf:value.retryOf||null,previousDeliveryId:value.previousDeliveryId||null,deliveryStatus:value.deliveryStatus||value.status||null,deliveredAt:value.deliveredAt||null,scenarioContext:parseScenarioContextCandidate(value.scenarioContext||value),evidenceLocator:value.evidenceLocator||null,assetId:value.assetId||value.t006Id||null,t006Id:value.t006Id||value.declaredT006Id||null,assetName:value.assetName||null,assetVersion:value.assetVersion||value.t007Version||null,t007Version:value.t007Version||value.declaredT007Version||null,asOf:value.asOf||value.t008||value.t008AsOf||null,t008AsOf:value.t008AsOf||value.t008||null,t008Confirmation:copy(value.t008Confirmation||null),sourceSnapshotId:value.sourceSnapshotId||null,sourceFingerprint:copy(value.sourceFingerprint||null),processingModuleVersion:value.processingModuleVersion||null,runEvidence:copy(value.runEvidence||null),publishedAt:value.publishedAt||null,versionDescription:value.versionDescription||null,source:value.source||null,sourceChain:copy(value.sourceChain||[]),publicationState:value.publicationState||null,purpose:value.purpose||null,consumptionRestriction:value.consumptionRestriction||null,lineageCheckStatus:value.lineageCheckStatus||null,lineageEvidenceLocator:value.lineageEvidenceLocator||null,mappingEligibility:copy(value.mappingEligibility||null),qualitySummary:copy(value.qualitySummary||null),members:copy(value.members||[]),relations:copy(value.relations||[]),payloadFingerprint:value.payloadFingerprint||null};
  }
  function c003AcceptedContractIssues(contract,payload) {
    const issues=[];if(!contract)return ["M01 已接收合同不存在"];
    if(contract.deliveryId!==payload?.deliveryId)issues.push("M01 合同交付标识不匹配");
    if(contract.assetVersion!==payload?.assetVersion||contract.asOf!==payload?.asOf)issues.push("M01 合同的精确 T007 或 T008 不匹配");
    if(!sameScenarioContext(contract.scenarioContext,payload?.scenarioContext))issues.push("M01 合同的 C033 五字段不匹配");
    if(contract.members?.length!==payload?.members?.length||contract.relations?.length!==payload?.relations?.length)issues.push("M01 合同的成员或关系数量不匹配");
    if(JSON.stringify(canonicalC003Value(c003ContractProjection(contract)))!==JSON.stringify(canonicalC003Value(c003ContractProjection(payload))))issues.push("M01 持久化合同内容与本次交付载荷不一致");
    return issues;
  }
  function c033RootReceiptIssues(receipt,payload) {
    const issues=[];
    if(!receipt||typeof receipt!=="object")return ["M01 C033 根回执不存在"];
    if(receipt.sourceModule!=="本体管理"||receipt.contractCode!=="C033")issues.push("M01 C033 根回执的来源模块或合同编号不匹配");
    if(!String(receipt.contextId||"").trim())issues.push("M01 C033 根回执缺少稳定上下文标识");
    if(receipt.status!=="accepted")issues.push("M01 C033 根回执不是已接收状态");
    if(!receipt.receivedAt||Number.isNaN(Date.parse(String(receipt.receivedAt).replace(" ","T"))))issues.push("M01 C033 根回执时间缺失或无效");
    if(receipt.reason!==null)issues.push("M01 C033 已接收根回执不应携带拒绝原因");
    if(!String(receipt.evidenceLocator||"").trim())issues.push("M01 C033 根回执缺少证据定位");
    if(!sameScenarioContext(receipt.scenarioContext,payload?.scenarioContext))issues.push("M01 C033 根回执五字段与 C003 交付不一致");
    return issues;
  }
  function c003TargetDraftBinding(targetDraft,receipt,payload) {
    const sourceContract=targetDraft?.sourceDataContract||targetDraft?.dataAssetContract||null;
    return {
      sourceDeliveryId:targetDraft?.sourceDeliveryId||targetDraft?.deliveryId||null,
      sourceAssetVersion:targetDraft?.sourceAssetVersion||targetDraft?.assetVersion||sourceContract?.assetVersion||sourceContract?.t007Version||null,
      draftRevision:Number.isInteger(targetDraft?.draftRevision)?targetDraft.draftRevision:(Number.isInteger(targetDraft?.revision)?targetDraft.revision:null),
      receiptDraftRevision:Number.isInteger(receipt?.targetDraftRevision)?receipt.targetDraftRevision:null,
      payloadDeliveryId:payload?.deliveryId||null,
      payloadAssetVersion:payload?.assetVersion||null
    };
  }
  function c003TargetDraftBindingIssues(targetDraft,receipt,payload) {
    if(!targetDraft)return ["M01 回执指向的目标 Draft 或其发布版本在当前工作投影中不可定位"];
    const binding=c003TargetDraftBinding(targetDraft,receipt,payload),issues=[];
    if(binding.sourceDeliveryId!==binding.payloadDeliveryId)issues.push("M01 目标 Draft 未证明绑定本次交付标识");
    if(binding.sourceAssetVersion!==binding.payloadAssetVersion)issues.push("M01 目标 Draft 未证明绑定本次精确数据资产版本");
    if(!Number.isInteger(binding.draftRevision)||binding.draftRevision!==binding.receiptDraftRevision)issues.push("M01 目标 Draft 快照缺少与回执一致的精确修订号");
    return issues;
  }
  function c003SnapshotEvidence(snapshot,payload) {
    const acceptedContract=snapshot?.inputs?.c003?.find(item=>item.deliveryId===payload?.deliveryId)||null;
    const receipt=snapshot?.outputs?.dataAssetDeliveryReceipts?.find(item=>item.deliveryId===payload?.deliveryId)||null;
    const c033Receipt=snapshot?.scenarioContextReceipts?.find(item=>item.contractCode==="C033"&&item.status==="accepted"&&sameScenarioContext(item.scenarioContext,payload?.scenarioContext))||null;
    const activeTargetDraft=receipt?.targetDraftId?snapshot?.drafts?.find(item=>item.id===receipt.targetDraftId&&sameScenarioContext(item.scenarioContext,payload?.scenarioContext))||null:null;
    const publishedTarget=receipt?.targetDraftId?snapshot?.published?.find(item=>item.sourceDraftId===receipt.targetDraftId&&sameScenarioContext(item.scenarioContext,payload?.scenarioContext))||null:null;
    const targetDraft=activeTargetDraft||publishedTarget;
    const issues=[];
    if(!snapshot)issues.push("未取得 M01 持久化交接快照");
    else if(!sameScenarioContext(snapshot.scenarioContext,payload?.scenarioContext))issues.push("M01 当前工作投影与本次 C033 不一致");
    if(!c033Receipt)issues.push("M01 尚无同一场景轮次的 C033 已接收根回执");else issues.push(...c033RootReceiptIssues(c033Receipt,payload));
    if(!acceptedContract)issues.push("M01 的已接收 C003 合同中没有同一交付标识");else issues.push(...c003AcceptedContractIssues(acceptedContract,payload));
    if(!receipt)issues.push("M01 的持久化输出中没有同一交付标识回执");else issues.push(...c003ReceiptIssues(receipt,payload));
    if(receipt?.status==="accepted")issues.push(...c003TargetDraftBindingIssues(targetDraft,receipt,payload));
    return {acceptedContract,receipt,c033Receipt,targetDraft,targetDraftBinding:c003TargetDraftBinding(targetDraft,receipt,payload),issues:[...new Set(issues)]};
  }
  function c003DeliveryRecord(version,payload=null) {
    const deliveryId=payload?.deliveryId||c003DeliveryAttemptId(version,1);
    let record=flow.dataAssetDeliveries.find(item=>item.deliveryId===deliveryId);
    if(!record){record={deliveryId,deliverySeriesId:payload?.deliverySeriesId||c003DeliverySeriesId(version),attemptNumber:payload?.attemptNumber||1,retryOf:payload?.retryOf||null,previousDeliveryId:payload?.previousDeliveryId||null,assetVersionId:version?.id||"",scenarioContext:copy(version?.scenarioContext||null),submittedAt:payload?.deliveredAt||nowText(),status:"正在交付",receiptStatus:"等待完整回执",payload:payload?copy(payload):null,payloadFingerprint:payload?.payloadFingerprint||"",sendCount:0,events:[],verificationHistory:[],historicalAcceptedClaim:false,currentVerification:{status:"尚未核对",checkedAt:"",exchangeOrigin:location.origin,issues:[]},runtimeVerificationId:""};flow.dataAssetDeliveries.push(record);}
    else if(payload&&!record.payload){record.payload=copy(payload);record.payloadFingerprint=payload.payloadFingerprint||c003Fingerprint(payload);}
    else if(payload&&canonicalC003Text(record.payload)!==canonicalC003Text(payload)){record.localConflict=`同一交付标识 ${deliveryId} 的载荷内容发生变化，已拒绝覆盖历史尝试`;}
    return record;
  }
  function settleC003Delivery(record,version,{status,receiptStatus,receipt=null,acceptedContract=null,c033Receipt=null,targetDraft=null,failureReason="",recovery="",accepted=false,verificationIssues=[]}) {
    record.events=Array.isArray(record.events)?record.events:[];record.verificationHistory=Array.isArray(record.verificationHistory)?record.verificationHistory:[];
    if(record.status||record.receiptStatus)record.events.push({at:nowText(),status:record.status||"未记录",receiptStatus:record.receiptStatus||"未记录",note:"状态变更前保留"});
    const checkedAt=nowText(),verified=accepted&&receipt?.status==="accepted"&&acceptedContract;
    record.verificationHistory.push({checkedAt,status,receiptStatus,receipt:receipt?copy(receipt):null,acceptedContract:acceptedContract?copy(acceptedContract):null,c033Receipt:c033Receipt?copy(c033Receipt):null,targetDraft:targetDraft?copy(targetDraft):null,issues:copy(verificationIssues),failureReason});
    record.status=status;record.receiptStatus=receiptStatus;record.receipt=receipt?copy(receipt):null;record.acceptedContract=acceptedContract?copy(acceptedContract):null;record.c033Receipt=c033Receipt?copy(c033Receipt):null;record.targetDraft=targetDraft?copy(targetDraft):null;record.completedAt=receipt?.receivedAt||checkedAt;record.failureReason=failureReason;record.recovery=recovery;record.refreshBlockedByC003=!verified;record.refreshBlockedReason=verified?"":failureReason||"尚未取得 M01 同标识已接收合同与完整持久化回执";record.currentVerification={status:verified?"已验证接收":receipt?.status==="rejected"?"已验证拒绝":"未验证接收",checkedAt,exchangeOrigin:location.origin,issues:copy(verificationIssues)};record.runtimeVerificationId=verified?C003_RUNTIME_VERIFICATION_ID:"";record.events.push({at:checkedAt,status,receiptStatus,note:verified?"M01 合同、回执、C033 与目标 Draft 联合核验通过":failureReason||"未取得完整联合证据"});
    version.dataAssetDeliveryId=record.deliveryId;version.dataAssetDeliveryStatus=status;version.dataAssetDeliveryReceiptStatus=receiptStatus;version.dataAssetDeliveryReceipt=receipt?copy(receipt):null;version.refreshBlockedByC003=!verified;version.refreshBlockedReason=verified?"":failureReason||"尚未取得 M01 同标识已接收合同与完整持久化回执";
    if(flow.candidateVersionId===version.id&&["idle","awaiting-c003-receipt","c003-blocked"].includes(flow.refreshStatus))flow.refreshStatus=verified?"idle":"c003-blocked";
    saveFlow();return record;
  }
  function dataAssetDeliveryGate(version) {
    const record=latestC003DeliveryRecord(version),verification=record?.currentVerification,run=versionRun(version),scenarioContract=c003ScenarioContractState(version,run,record);
    const okay=Boolean(version&&record&&scenarioContract.okay&&record.runtimeVerificationId===C003_RUNTIME_VERIFICATION_ID&&verification?.status==="已验证接收"&&record.status==="已接收"&&record.receiptStatus==="完整回执"&&record.payloadFingerprint===record.payload?.payloadFingerprint&&!c003PayloadIssues(record.payload).length&&!c003PayloadBindingIssues(record.payload,version,run).length&&!c003ReceiptIssues(record.receipt,record.payload).length&&!c003AcceptedContractIssues(record.acceptedContract,record.payload).length&&!c033RootReceiptIssues(record.c033Receipt,record.payload).length&&!c003TargetDraftBindingIssues(record.targetDraft,record.receipt,record.payload).length);
    const scenarioReason=scenarioContract.contractConflict?`合同冲突，需要总控裁决：${scenarioContract.issues.join("；")}`:scenarioContract.issues.join("；");
    return {okay,record,scenarioContract,reason:okay?"":scenarioReason||record?.failureReason||version?.refreshBlockedReason||"尚未在当前页面会话取得 M01 同标识合同、回执、C033 与目标 Draft 精确绑定的联合证据"};
  }
  async function ontologyHandoffSnapshot() {
    const response=await ontologyBridgeRequest("handoffSnapshot",{});if(!response.ok||!response.result)return null;return {...response.result,_handoffObservedAt:response.respondedAt||nowText(),_handoffOrigin:location.origin};
  }
  async function verifyC003DeliveryRecord(version,record) {
    if(!record?.payload)return settleC003Delivery(record,version,{status:"交付被阻断",receiptStatus:"未发送",failureReason:"交付尝试缺少冻结载荷",recovery:"保留该历史尝试并创建新的完整交付尝试",verificationIssues:["冻结载荷不存在"]});
    const run=versionRun(version),payloadProblems=[...c003PayloadIssues(record.payload),...c003PayloadBindingIssues(record.payload,version,run)];if(record.payloadFingerprint!==record.payload?.payloadFingerprint)payloadProblems.push("交付记录指纹与冻结载荷指纹不一致");if(payloadProblems.length)return settleC003Delivery(record,version,{status:"交付被阻断",receiptStatus:"未发送",failureReason:[...new Set(payloadProblems)].join("；"),recovery:"保留原历史尝试；使用新的交付尝试标识重发完整合同，不覆盖原记录",verificationIssues:[...new Set(payloadProblems)]});
    const scenarioContract=c003ScenarioContractState(version,run,record),snapshot=await ontologyHandoffSnapshot();
    if(scenarioContract.contractConflict){
      const evidence=snapshot?c003SnapshotEvidence(snapshot,record.payload):{acceptedContract:null,receipt:null,c033Receipt:null,targetDraft:null,issues:["未取得 M01 持久化交接快照"]},issues=[...scenarioContract.issues,...evidence.issues];
      return settleC003Delivery(record,version,{status:"交付被阻断 · 待总控裁决",receiptStatus:evidence.receipt?.status==="rejected"?"已取得拒绝回执":"跨轮次合同未定义",receipt:evidence.receipt,acceptedContract:evidence.acceptedContract,c033Receipt:evidence.c033Receipt,targetDraft:evidence.targetDraft,failureReason:`合同冲突，需要总控裁决：${scenarioContract.issues.join("；")}`,recovery:"保留原正式运行、T007 与当前交付尝试，不改写其生产轮次，不生成后续尝试。现行合同要求同一 C033 轮次重跑；若本轮继续禁止重跑，须由总控先接受“历史 T007 跨轮导入交付”合同，再按新合同处理。",verificationIssues:[...new Set(issues)]});
    }
    if(!snapshot)return settleC003Delivery(record,version,{status:"结果未知",receiptStatus:"未取得持久化回执",failureReason:"未能读取 M01 持久化交接快照",recovery:"保持 T007 候选不可消费；确认统一 127.0.0.1:4311 同源入口和 M01 C033 后重新读取",verificationIssues:["handoffSnapshot 不可用"]});
    const evidence=c003SnapshotEvidence(snapshot,record.payload),receipt=evidence.receipt;
    if(receipt?.status==="rejected"){
      const receiptIssues=c003ReceiptIssues(receipt,record.payload),reason=receipt.reason||"M01 拒绝数据资产交付";
      return settleC003Delivery(record,version,{status:"交付被拒绝",receiptStatus:receiptIssues.length?"拒绝回执不完整":"完整拒绝回执",receipt,c033Receipt:evidence.c033Receipt,failureReason:[reason,...receiptIssues].filter(Boolean).join("；"),recovery:"保留原尝试；修正拒绝原因后使用新的交付尝试标识重发，不覆盖原记录",verificationIssues:evidence.issues});
    }
    if(evidence.issues.length){const targetDraftBindingBlocked=evidence.issues.some(issue=>/目标 Draft/.test(issue));return settleC003Delivery(record,version,{status:"已发送 · 结果待核对",receiptStatus:"联合证据不完整",receipt,acceptedContract:evidence.acceptedContract,c033Receipt:evidence.c033Receipt,targetDraft:evidence.targetDraft,failureReason:evidence.issues.join("；"),recovery:targetDraftBindingBlocked?"保持 T007 候选不可消费且不创建新交付尝试；由本体管理补齐目标 Draft 对本次 deliveryId、精确资产版本和修订号的持久化绑定证据，再重新读取":"先确保 M01 已接收同轮 C033，再使用统一 127.0.0.1:4311 入口重新读取；如原尝试已拒绝，创建新尝试，不提交刷新",verificationIssues:evidence.issues});}
    return settleC003Delivery(record,version,{status:"已接收",receiptStatus:"完整回执",receipt,acceptedContract:evidence.acceptedContract,c033Receipt:evidence.c033Receipt,targetDraft:evidence.targetDraft,recovery:"无需恢复",accepted:true,verificationIssues:[]});
  }
  async function sendC003DeliveryRecord(version,record) {
    if(record.localConflict)return settleC003Delivery(record,version,{status:"交付被阻断",receiptStatus:"未发送",failureReason:record.localConflict,recovery:"创建新的交付尝试标识，不得改写同一标识的冻结载荷",verificationIssues:[record.localConflict]});
    const run=versionRun(version),scenarioContract=c003ScenarioContractState(version,run,record);
    if(scenarioContract.contractConflict)return verifyC003DeliveryRecord(version,record);
    const c033Delivery=await ensureOntologyScenarioContext(record.payload?.scenarioContext);
    if(!c033Delivery.okay){
      const reason=`M01 尚未接收本次平台 C033：${c033Delivery.issues.join("；")}`;
      return settleC003Delivery(record,version,{status:"交付被阻断",receiptStatus:"未发送 C003",c033Receipt:c033Delivery.receipt,failureReason:reason,recovery:"保持原交付尝试与 T007 不变；先由统一平台提供同轮完整 C033，重新读取后再按证据恢复",verificationIssues:c033Delivery.issues});
    }
    record.status="正在交付";record.receiptStatus="等待 M01 持久化联合证据";record.sendCount=Number(record.sendCount||0)+1;record.lastSentAt=nowText();record.runtimeVerificationId="";record.currentVerification={status:"正在读取",checkedAt:"",exchangeOrigin:location.origin,issues:[]};saveFlow();
    const mutation=await ontologyBridgeRequest("deliverDataAsset",record.payload),verified=await verifyC003DeliveryRecord(version,record);
    if(verified.status!=="已接收"&&mutation?.result?.status==="rejected"&&!verified.receipt){
      verified.failureReason=mutation.result.reason||mutation.error||verified.failureReason;verified.recovery="保留原尝试；按 M01 拒绝原因修正后创建新的交付尝试";saveFlow();
    }
    return verified;
  }
  async function deliverDataAssetToOntology(asset,version,run,options={}) {
    const scenarioGate=scenarioContextGate();
    if(!scenarioGate.okay||!sameScenarioContext(version?.scenarioContext,scenarioGate.context)||!sameScenarioContext(run?.scenarioContext,scenarioGate.context)){
      const record=latestC003DeliveryRecord(version)||c003DeliveryRecord(version),reason=`场景运行上下文不完整或五字段与当前轮次不一致：${scenarioGate.problems.join("；")||"版本、运行与当前 C033 不一致"}`;
      return settleC003Delivery(record,version,{status:"交付被阻断",receiptStatus:"未发送",failureReason:reason,recovery:"从平台总控重新取得当前场景工作轮次后，以原 T007 保留证据并重新核对交付"});
    }
    const previous=latestC003DeliveryRecord(version),attemptNumber=options.newAttempt?Math.max(2,...c003DeliveryRecords(version).map(item=>Number(item.attemptNumber||1)+1)):previous?.attemptNumber||1,retryOf=options.newAttempt?(options.retryOf||previous?.deliveryId||null):previous?.retryOf||null;
    const freshPayload=previous&&!options.newAttempt&&previous.payload?previous.payload:dataAssetDeliveryPayload(asset,version,run,{attemptNumber,deliveryId:c003DeliveryAttemptId(version,attemptNumber),retryOf}),record=previous&&!options.newAttempt?previous:c003DeliveryRecord(version,freshPayload),payload=record.payload||freshPayload,payloadProblems=c003PayloadIssues(payload);
    if(payloadProblems.length)return settleC003Delivery(record,version,{status:"交付被阻断",receiptStatus:"未发送",failureReason:payloadProblems.join("；"),recovery:"补齐同一快照的 T008 确认与完整 C033；已发布 T007 保留且不得进入刷新"});
    version.dataAssetDeliveryId=payload.deliveryId;version.dataAssetDeliveryStatus="正在交付";version.dataAssetDeliveryReceiptStatus="等待 M01 持久化联合证据";version.refreshBlockedByC003=true;version.refreshBlockedReason="等待 M01 同标识合同、回执、C033 与目标 Draft 联合证据";if(flow.candidateVersionId===version.id)flow.refreshStatus="awaiting-c003-receipt";saveFlow();
    return sendC003DeliveryRecord(version,record);
  }
  function trustEvidenceId(prefix,versionId,revision=1) {
    return `${prefix}-${String(versionId).replace(/[^A-Za-z0-9_-]/g,"-")}-${String(revision).padStart(2,"0")}`;
  }
  function buildBindingTrustSummary(version,run) {
    return {
      id:trustEvidenceId("TRUST-BIND",version.id),version:"v1.0",formedAt:version.publishedAt,
      targetAssetId:version.targetAssetId,assetVersionId:version.id,asOf:version.asOf,
      scenarioContext:copy(parseScenarioContextCandidate(version.scenarioContext||run?.scenarioContext)),
      qualityId:version.qualityId,quality:version.quality,sourceSnapshot:version.sourceSnapshot,
      runId:version.runId,definitionVersion:version.definitionVersion,
      refreshRequestId:version.refreshRequestId||"尚未提交",refreshResultId:version.refreshResultId||"尚未返回",
      retentionPolicyId:"尚未取得",retentionPolicyVersion:"尚未取得",
      note:"冻结记录本版本发布时的数据身份、时点、质量和证据定位；后续状态变化不会改写本摘要。",
      evidenceRefs:[version.sourceSnapshot,version.definitionVersion,version.runId,version.qualityId,version.id].filter(Boolean)
    };
  }
  function versionTrustState(version) {
    return version?.currentTrustSummaries?.at(-1)||null;
  }
  function trustSummaryPanel(version) {
    const binding=version?.bindingTrustSummary,current=versionTrustState(version),dimensions=current?.dimensions||{};
    if(!binding||!current)return notice("该历史版本没有完整的可信度摘要证据，不能由页面字段反向补造。","danger","可信度摘要不可定位");
    return `<section class="panel"><div class="panel-head"><div><span class="panel-title">给其他模块的可信度摘要</span><p>只提供版本、时点、质量、刷新和证据定位，不包含工作簿、源字段或业务明细。</p></div>${badge("只读交接","info")}</div><div class="panel-body"><div class="detail-grid"><article class="confirmation-card"><span class="eyebrow">发布时固定</span><h3>版本绑定摘要</h3><div class="summary-grid">${fact("摘要编号",binding.id)}${fact("摘要版本",binding.version)}${fact("形成时间",binding.formedAt)}${fact("数据资产版本",binding.assetVersionId)}${fact("数据截至",binding.asOf)}${fact("发布时质量",`${binding.quality} · ${binding.qualityId}`)}</div><p>${esc(binding.note)}</p></article><article class="confirmation-card"><span class="eyebrow">按核验时点新增</span><h3>当前状态摘要</h3><div class="summary-grid">${fact("摘要编号",current.id)}${fact("摘要版本",current.version)}${fact("形成时间",current.formedAt)}${fact("当前权威版本",current.currentAuthorityVersionId)}${fact("刷新请求",current.refreshRequestId)}${fact("本体处理结果",current.refreshResultId)}</div><p>状态变化形成新摘要，不覆盖发布时摘要或较早核验记录。</p></article></div><div class="quality-section"><div class="quality-section-head"><strong>五项数据侧状态</strong>${badge("不得合并成单一可复现结论","neutral")}</div><div class="schema-matrix"><div><strong>版本定位</strong><span>${esc(dimensions.versionLocation||"无法判断")}</span></div><div><strong>内容访问</strong><span>${esc(dimensions.contentAccess||"无法判断")}</span></div><div><strong>证据完整</strong><span>${esc(dimensions.evidenceIntegrity||"无法判断")}</span></div><div><strong>重放能力</strong><span>${esc(dimensions.replayCapability||"未执行")}</span></div><div><strong>重放核验</strong><span>${esc(dimensions.replayVerification||"未执行")}</span></div></div></div><div class="summary-grid">${fact("生产保留策略",current.retentionPolicyId==="尚未取得"?"尚未取得平台治理策略":current.retentionPolicyId)}${fact("策略版本",current.retentionPolicyVersion)}${fact("T018 资格",current.t018Status)}${fact("正式采用证据",current.t019EvidenceId)}</div>${notice("当前一期历史保留不等于已取得生产保留策略，也不承诺永久在线或永久可重放。最终是否回答、展示、导出或发起行动由相应下游模块按自己的合同决定。","warning")}</div></section>`;
  }
  function appendCurrentTrustSummary(version,reason) {
    if(!version)return null;
    version.currentTrustSummaries=Array.isArray(version.currentTrustSummaries)?version.currentTrustSummaries:[];
    const revision=version.currentTrustSummaries.length+1,authority=authorityVersion(version.targetAssetId),previous=previousAuthorityVersion(version.targetAssetId);
    const summary={
      id:trustEvidenceId("TRUST-STATE",version.id,revision),version:`v1.${revision-1}`,formedAt:nowText(),reason,
      assetVersionId:version.id,asOf:version.asOf,quality:version.quality,
      scenarioContext:copy(parseScenarioContextCandidate(version.scenarioContext)),
      refreshRequestId:version.refreshRequestId||"尚未提交",refreshResultId:version.refreshResultId||"尚未返回",
      t018Status:version.t018Status||"尚未形成",t019EvidenceId:version.t019EvidenceId||"尚未取得",
      currentAuthorityVersionId:authority?.id||"尚无权威消费版本",previousAuthorityVersionId:previous?.id||"尚无上一权威版本",
      retentionPolicyId:version.retentionPolicyId||"尚未取得",retentionPolicyVersion:version.retentionPolicyVersion||"尚未取得",
      dimensions:{
        versionLocation:version.evidenceIntegrity==="完整"?"可定位":"证据不可定位",
        contentAccess:version.contentAccess||"无法判断",
        evidenceIntegrity:version.evidenceIntegrity||"无法判断",
        replayCapability:"未执行",
        replayVerification:"未执行"
      }
    };
    version.currentTrustSummaries.push(summary);return summary;
  }
  function versionRun(version) { return flow.runs.find(run=>run.id===version?.runId)||null; }
  function versionRefreshAttempt(version) { return refreshAttemptsForVersion(version?.id).at(-1)||null; }
  function previousDataQualifiedVersion(version) {
    const candidates=flow.assetVersions.filter(item=>item.targetAssetId===version?.targetAssetId),index=candidates.findIndex(item=>item.id===version?.id);
    return [...(index<0?candidates:candidates.slice(0,index))].reverse().find(item=>item.dataQualification!=="不合格"&&qualityAllowsConsumption(item.quality))||null;
  }
  function versionHardQualityFailure(version,current) {
    return Boolean(version?.hardQualityFailure===true||current?.hardQualityFailure===true||version?.postPublishQuality?.status==="硬质量失败");
  }
  function c017ProjectionForVersion(version) {
    const run=versionRun(version),binding=version?.bindingTrustSummary,current=versionTrustState(version);
    if(!version||!run||!binding||!current||!sameScenarioContext(version.scenarioContext,run.scenarioContext))return null;
    const confirmation=t008ConfirmationForDelivery(version,run),attempt=versionRefreshAttempt(version),authority=authorityVersion(version.targetAssetId),candidate=candidateVersion(),previous=previousDataQualifiedVersion(version),hardFailure=versionHardQualityFailure(version,current);
    const isAuthority=Boolean(authority?.id===version.id&&version.t019Status==="已采用"&&version.t019EvidenceId),qualityAllowed=qualityAllowsConsumption(version.quality),allowConsumption=Boolean(isAuthority&&qualityAllowed&&!hardFailure);
    const memberEvidence=(version.members||[]).map(member=>member.stableId).filter(Boolean),relationshipEvidence=(version.relationships||[]).map(relation=>relation.stableId).filter(Boolean),freshnessEvidenceId=trustEvidenceId("FRESHNESS",version.id);
    const evidenceIds=[version.id,confirmation.evidenceId,version.sourceSnapshotId,version.qualityId,...memberEvidence,...relationshipEvidence,attempt?.requestId,attempt?.resultId,attempt?.t018EvidenceId,version.t019EvidenceId].filter(Boolean);
    const evidenceComplete=Boolean(confirmation.snapshotId&&confirmation.asOf&&confirmation.confirmedBy&&confirmation.confirmedAt&&confirmation.basis&&confirmation.evidenceId&&version.sourceSnapshotId&&version.qualityId&&memberEvidence.length===version.members.length&&relationshipEvidence.length===version.relationships.length&&version.evidenceIntegrity==="完整");
    const discovery=attempt?.publishedContext?.discovery||null,t019Observation=isAuthority?{recordId:null,evidenceId:version.t019EvidenceId,observedAt:version.adoptedAt||current.formedAt,semanticVersionId:discovery?.versionId||attempt?.targetT017||"",semanticVersion:discovery?.semanticVersion||attempt?.c032Candidate?.semanticVersion||"",dataVersion:version.id,asOf:version.asOf,scenarioContext:copy(parseScenarioContextCandidate(version.scenarioContext))}:null;
    const refreshStatus=!attempt?"尚未提交":attempt.t019Status==="已采用"?"本体侧已正式采用":attempt.resultStatus==="失败"?"本体处理失败":attempt.requestStatus==="结果未知"?"结果未知":attempt.t018Status==="可消费候选"?"本体处理通过，待正式采用":attempt.requestStatus||"处理中";
    const refreshPhase=!attempt?"未开始":attempt.t019Status==="已采用"?"正式采用":attempt.resultStatus==="失败"?"本体处理失败":attempt.t018Status==="可消费候选"?"候选资格":attempt.requestStatus==="已受理"?"本体处理中":"请求提交";
    const qualityWarnings=/警告/.test(version.quality)?[{status:"警告",reason:run.qualityWarningReason||"发布前质量警告已由操作者说明",scopeSummary:"本次正式检查记录所列范围",recovery:"按质量结果中的说明持续观察",evidenceId:version.qualityId}]:[];
    const qualityStatus=hardFailure?"硬质量失败":version.quality||"无法判断",dataEligibility=hardFailure?"禁止":qualityAllowed?(/警告/.test(version.quality)?"带警告允许":"允许"):"无法判断";
    const currentSummary={
      id:current.id,version:current.version,formedAt:current.formedAt,qualityStatus:allowConsumption?"允许推进":hardFailure?"事后硬质量失败":isAuthority?"状态未知":"不可消费",hardQualityFailure:hardFailure,
      detectedAt:hardFailure?(version.postPublishQuality?.detectedAt||current.formedAt):"不适用",impactScope:hardFailure?(version.postPublishQuality?.impactScope||"所引精确数据版本及其固定证据"):"无硬质量失败影响",
      businessFieldCategories:hardFailure?(version.postPublishQuality?.businessFieldCategories||"当前已确认的受影响字段类别"):"无受影响业务字段类别",
      reason:hardFailure?(version.postPublishQuality?.reason||current.reason||"精确数据版本存在已确认的发布后硬质量失败"):allowConsumption?"当前摘要未登记版本级或范围级硬质量失败，且已取得本体正式采用证据":isAuthority?"当前质量或证据状态无法确认":"该版本未处于当前正式消费组合",
      recovery:hardFailure?(version.postPublishQuality?.recovery||"修复来源并形成新的正式版本；由本体管理决定受控切换或回退"):allowConsumption?"无需恢复":"重新读取同一精确版本的质量与正式采用证据",
      evidenceLocator:`数据工程 / 数据可信度摘要 / ${current.id}`,scenarioContext:copy(parseScenarioContextCandidate(version.scenarioContext))
    };
    return {
      contextId:trustEvidenceId("C017-CONTEXT",version.id),contextVersion:current.version,formedAt:current.formedAt,scenarioContext:copy(parseScenarioContextCandidate(version.scenarioContext)),
      assetId:version.targetAssetId,t006Id:version.targetAssetId,dataVersion:version.id,asOf:version.asOf,asOfSource:`用户明确确认：${confirmation.basis||"依据不可定位"}`,asOfPrecision:"日",timezone:"不适用（日期型）",t008EvidenceId:confirmation.evidenceId,publishedAt:version.publishedAt,lastSuccessfulAt:run.executionEndedAt||version.publishedAt,
      t008:{value:version.asOf,source:`用户明确确认：${confirmation.basis||"依据不可定位"}`,precision:"日",timezone:"不适用（日期型）",evidenceId:confirmation.evidenceId},
      versionBindingSummary:{id:binding.id,version:binding.version,formedAt:binding.formedAt},currentStateSummary:currentSummary,
      dataEligibility,allowConsumption,consumptionStatus:allowConsumption?"可消费":hardFailure?"不可消费 · 硬质量失败":isAuthority?"不可消费 · 状态无法判断":"不可消费 · 未被正式采用",
      quality:{status:qualityStatus,evidenceId:version.qualityId,hardFailure,warnings:qualityWarnings},
      freshness:{label:`截至 ${version.asOf}`,status:"截至时间已确认",basis:"S001 当前未配置业务陈旧阈值；只允许按已确认的数据截至时间回答，不宣称为今日最新。",evidenceId:freshnessEvidenceId},
      candidate:candidate?{dataVersion:candidate.id,asOf:candidate.asOf,status:candidate.consumptionStatus||"不可消费",phase:candidate.refreshStatus||"候选",reason:candidate.id===authority?.id?"当前版本已正式采用":"候选尚未被本体管理正式采用",recovery:candidate.id===authority?.id?"无需恢复":"完成质量、刷新与正式采用后由下游重新读取",evidenceId:candidate.currentTrustSummaries?.at(-1)?.id||candidate.id}:null,
      previousTrusted:previous?{dataVersion:previous.id,asOf:previous.asOf,status:"数据侧上一合格版本",consumable:previous.id===authority?.id,evidenceId:previous.bindingTrustSummary?.id||previous.id}:null,
      refresh:attempt?{requestId:attempt.requestId||"尚未提交",resultId:attempt.resultId||"尚未返回",status:refreshStatus,time:attempt.resultAt||attempt.acceptedAt||attempt.createdAt||version.publishedAt,phase:refreshPhase,failureReason:attempt.failureReason||"无",recovery:attempt.recovery||"等待本体管理返回真实结果",t018Eligibility:attempt.t018Status||"尚未形成",evidenceId:attempt.resultId||attempt.requestId}:null,
      t019Observation,evidence:{complete:evidenceComplete,ids:[...new Set(evidenceIds)],categories:{version:true,source:Boolean(version.sourceSnapshotId),quality:Boolean(version.qualityId),members:memberEvidence.length===version.members.length,relationships:relationshipEvidence.length===version.relationships.length,refresh:Boolean(attempt)}},
      consistency:evidenceComplete?"数据侧一致":"无法判断"
    };
  }
  function c017ProjectionEnvelope(consumer) {
    const gate=scenarioContextGate(),scenarioContext=gate.okay?copy(gate.context):null,projections=gate.okay?flow.assetVersions.filter(version=>sameScenarioContext(version.scenarioContext,gate.context)).map(c017ProjectionForVersion).filter(Boolean):[];
    const formedAt=projections.map(item=>item.currentStateSummary?.formedAt).filter(Boolean).sort().at(-1)||scenarioContext?.formedAt||null,projectionVersion=`v1.${projections.reduce((sum,item)=>sum+Number(String(item.currentStateSummary?.version||"v1.0").split(".").at(-1)||0),0)}`;
    if(consumer==="决策中心"){
      return {schemaVersion:1,projectionId:C017_DECISION_PROJECTION_KEY,projectionVersion,contractCode:"C017",sourceModule:"数据工程",consumer,scenarioContext,formedAt,readStatus:gate.okay?(projections.length?"ready":"empty"):"context_missing",reason:gate.okay?(projections.length?null:"当前场景轮次尚无已发布数据资产版本"):gate.problems.join("；"),projections:projections.map(item=>{const base={currentStateSummary:item.currentStateSummary,qualityStatus:item.currentStateSummary.qualityStatus,hardQualityFailure:item.currentStateSummary.hardQualityFailure,detectedAt:item.currentStateSummary.detectedAt,impactScope:item.currentStateSummary.impactScope,businessFieldCategories:item.currentStateSummary.businessFieldCategories,reason:item.currentStateSummary.reason,recovery:item.currentStateSummary.recovery,evidenceLocator:item.currentStateSummary.evidenceLocator};return {dataVersion:item.dataVersion,scenarioContext:copy(item.scenarioContext),currentStateSummary:copy(item.currentStateSummary),...base,gates:{request_receipt:copy(base),confirmation_submit:copy(base),task_formation:copy(base)}};})};
    }
    return {schemaVersion:1,projectionId:C017_IQ_PROJECTION_KEY,projectionVersion,contractCode:"C017",sourceModule:"数据工程",consumer:"智能问数",scenarioContext,formedAt,readStatus:gate.okay?(projections.length?"ready":"empty"):"context_missing",reason:gate.okay?(projections.length?null:"当前场景轮次尚无已发布数据资产版本"):gate.problems.join("；"),projections};
  }
  function writeProjectionStore(key,value) {
    try{const serialized=JSON.stringify(value);if(localStorage.getItem(key)!==serialized)localStorage.setItem(key,serialized);return true;}catch(_){return false;}
  }
  function syncC017ProjectionStores() {
    writeProjectionStore(C017_IQ_PROJECTION_KEY,c017ProjectionEnvelope("智能问数"));
    writeProjectionStore(C017_DECISION_PROJECTION_KEY,c017ProjectionEnvelope("决策中心"));
  }
  function readC017Projection(query={}) {
    const consumer=query.consumer==="决策中心"?"决策中心":"智能问数",envelope=c017ProjectionEnvelope(consumer),requestedContext=parseScenarioContextCandidate(query.scenarioContext),currentContext=parseScenarioContextCandidate(envelope.scenarioContext);
    if(requestedContext&&!sameScenarioContext(requestedContext,currentContext))return {...envelope,readStatus:"context_mismatch",reason:"请求的场景、场景版本或运行轮次与当前数据工程投影不一致",projections:[],readAt:nowText()};
    const projections=query.dataVersion?envelope.projections.filter(item=>item.dataVersion===query.dataVersion):envelope.projections;
    return {...envelope,readStatus:envelope.readStatus==="ready"&&!projections.length?"not_found":envelope.readStatus,reason:envelope.readStatus==="ready"&&!projections.length?"未找到请求的精确数据资产版本":envelope.reason,projections:copy(projections),readAt:nowText()};
  }
  function relationshipFingerprint(relationships) { return (relationships||[]).map(relationLabel).sort().join("|"); }
  function inputContentFingerprint(inputs) { return (inputs||[]).map(x=>`${x.slotId||x.slot||x.nodeId}:${x.fingerprint}`).sort().join("|"); }
  function qualityConditionsFingerprint(definition) { return stableString((definition?.qualityRules||[]).map(x=>({id:x.id,version:x.version,type:x.type,scope:x.scope,condition:x.condition,severity:x.severity,failureEffect:x.failureEffect,recovery:x.recovery,enabled:x.enabled!==false}))); }
  function elapsedText(start,end) { if(!start||!end)return "尚未结束";const a=Date.parse(start.replace(" ","T")),b=Date.parse(end.replace(" ","T"));if(!Number.isFinite(a)||!Number.isFinite(b)||b<a)return `${start} → ${end}`;const s=Math.round((b-a)/1000);return s<60?`${s} 秒`:`${Math.floor(s/60)} 分 ${s%60} 秒`; }
  function flowPersistenceSnapshot() {
    if(SCENARIO_ID!=="S003")return flow;
    const snapshot=copy(flow);
    const registeredDefinitions=new Set(snapshot.publishedDefinitions.filter(item=>item?.trustedScenarioRegistration===true).map(item=>item.id));
    const registeredRuns=new Set(snapshot.runs.filter(item=>item?.trustedScenarioRegistration===true||item?.trigger==="正式场景装载").map(item=>item.id));
    const registeredVersions=new Set(snapshot.assetVersions.filter(item=>item?.trustedScenarioRegistration===true).map(item=>item.id));
    snapshot.publishedDefinitions=snapshot.publishedDefinitions.filter(item=>!registeredDefinitions.has(item.id));
    snapshot.runs=snapshot.runs.filter(item=>!registeredRuns.has(item.id));
    snapshot.assetVersions=snapshot.assetVersions.filter(item=>!registeredVersions.has(item.id));
    snapshot.refreshAttempts=snapshot.refreshAttempts.filter(item=>item?.trustedScenarioRegistration!==true);
    if(registeredRuns.has(snapshot.currentRunId)){
      snapshot.currentRunId="";
      snapshot.runStatus="idle";
      snapshot.runStep=-1;
      snapshot.runPlan=[];
      snapshot.runNodeStates={};
      snapshot.qualityStatus="idle";
      snapshot.refreshStatus="idle";
      snapshot.consumptionStatus="not-ready";
    }
    const nextAuthority={...snapshot.authorityVersionIds};
    delete nextAuthority["S003-T006-DEBT-RISK-ASSET"];
    snapshot.authorityVersionIds=nextAuthority;
    snapshot.candidateVersionId=registeredVersions.has(snapshot.candidateVersionId)?"":snapshot.candidateVersionId;
    return snapshot;
  }
  function saveFlow() { localStorage.setItem(FLOW_KEY, JSON.stringify(flowPersistenceSnapshot())); syncFlowData(); syncC017ProjectionStores(); }
  function currentRun() { return flow.runs.find(r => r.id === flow.currentRunId) || null; }
  function runForCanvas() {
    if(isDraft()||!ui.canvas?.definitionLabel)return null;
    if(ui.canvas.historyContext){
      if(!ui.canvas.historyContext.consistent)return null;
      const exact=flow.runs.find(r=>r.id===ui.canvas.historyContext.runId);
      return exact&&exact.definitionVersion===ui.canvas.definitionLabel&&exact.assetVersion===ui.canvas.historyContext.assetVersionId?exact:null;
    }
    const requestedRun=ui.canvas.historyContext?.runId||route().params.get("run");
    if(requestedRun){const exact=flow.runs.find(r=>r.id===requestedRun);return exact?.definitionVersion===ui.canvas.definitionLabel?exact:null;}
    return flow.runs.find(r=>r.definitionVersion===ui.canvas.definitionLabel)||null;
  }
  function runStatusForCanvas() {
    const run=runForCanvas();
    if(!run)return "idle";
    if(run.id===flow.currentRunId)return flow.runStatus;
    if(/失败|无法判断/.test(run.status))return "failed";
    if(run.assetVersion){const version=assetVersionForRun(run),current=authorityVersion(version?.targetAssetId||"FIN-ASSET");return version?.id===current?.id?"ready":"published";}
    return /通过|有警告/.test(run.quality)?"awaiting-publish":"finished";
  }
  function actionRunForCanvas() { const run=runForCanvas();return run?.id===flow.currentRunId?run:null; }
  function assetVersionForRun(run) { return flow.assetVersions.find(v=>v.id===run?.assetVersion)||null; }
  function canvasInputContexts() {
    const run=runForCanvas();
    if(!isDraft()&&run?.inputs?.length)return run.inputs.map(x=>({...x,node:ui.canvas?.nodes.find(n=>n.id===x.nodeId)||null,allowed:true,reason:x.gate||"正式运行已锁定"}));
    return selectedInputContexts();
  }
  function activeRefreshAttempt() { return flow.refreshAttempts.find(x=>x.requestId===flow.refreshRequestId)||null; }
  function refreshAttemptsForVersion(versionId) { return flow.refreshAttempts.filter(x=>x.assetVersionId===versionId); }
  function appendRefreshEvent(attempt,stage,status,evidenceId="") { if(!attempt)return;attempt.events=Array.isArray(attempt.events)?attempt.events:[];attempt.events.push({stage,status,at:nowText(),evidenceId}); }
  function latestPublishedVersion() { return flow.assetVersions[flow.assetVersions.length - 1] || null; }
  function qualityAllowsConsumption(value) { return value==="通过"||value==="有警告 · 已说明"; }
  function authorityServiceText(version, options={}) {
    const { prefix="当前正式消费版本", whenMissing="尚无正式消费版本" }=options;
    return version?`${prefix} ${version.id} 继续服务`:whenMissing;
  }
  function dataQualifiedVersion() { return [...flow.assetVersions].reverse().find(v=>v.dataQualification!=="不合格"&&qualityAllowsConsumption(v.quality)) || null; }
  function versionBelongsToAsset(version,asset) { return Boolean(version&&asset&&(version.targetAssetId===asset.t006Id||(!version.targetAssetId&&asset.id==="finance-asset-target"))); }
  function versionsForAsset(asset) { return flow.assetVersions.filter(v=>versionBelongsToAsset(v,asset)); }
  function latestVersionForAsset(asset) { return versionsForAsset(asset).at(-1)||null; }
  function dataQualifiedVersionForAsset(asset) { return [...versionsForAsset(asset)].reverse().find(v=>v.dataQualification!=="不合格"&&qualityAllowsConsumption(v.quality))||null; }
  function contextualTargetAssetId() { const run=currentRun();return run?.targetAssetId||publishedDefinition(run?.definitionVersion)?.targetAssetId||ui.canvas?.targetAssetId||"FIN-ASSET"; }
  function authorityVersion(targetAssetId=contextualTargetAssetId()) { const id=flow.authorityVersionIds?.[targetAssetId]||(targetAssetId==="FIN-ASSET"?flow.authorityVersionId:"");const version=flow.assetVersions.find(v=>v.id===id)||null;return version?.t019Status==="已采用"&&version.t019Owner==="本体管理"&&version.t019EvidenceId?version:null; }
  function previousAuthorityVersion(targetAssetId=contextualTargetAssetId()) { const id=flow.previousAuthorityVersionIds?.[targetAssetId]||(targetAssetId==="FIN-ASSET"?flow.previousAuthorityVersionId:"");return flow.assetVersions.find(v=>v.id===id) || null; }
  function candidateVersion() { return flow.assetVersions.find(v=>v.id===flow.candidateVersionId) || null; }
  function authorityVersionForAsset(asset) { return asset?authorityVersion(asset.t006Id||asset.id):null; }
  function previousAuthorityVersionForAsset(asset) { return asset?previousAuthorityVersion(asset.t006Id||asset.id):null; }
  function candidateVersionForAsset(asset) { const version=candidateVersion();return versionBelongsToAsset(version,asset)?version:null; }
  function publishedDefinitionsForPipeline(pipelineId) { return flow.publishedDefinitions.filter(d=>d.pipelineId===pipelineId); }
  function latestDefinitionForPipeline(pipelineId) { return publishedDefinitionsForPipeline(pipelineId).at(-1)||null; }
  function runsForPipeline(pipelineId) { return flow.runs.filter(r=>r.pipelineId===pipelineId||publishedDefinition(r.definitionVersion)?.pipelineId===pipelineId); }
  function latestRunForPipeline(pipelineId) { return runsForPipeline(pipelineId)[0]||null; }
  function currentPipelineSchedule(pipelineId=ui.canvas?.id) { return flow.pipelineSchedules[pipelineId]||ui.canvas?.pipelineSchedule||(pipelineId==="finance-pipeline"?flow.pipelineSchedule:"仅手工正式运行"); }
  function financeSource() { return D.sources.find(x=>x.id==="finance-workbook") || D.sources[0]; }
  function currentSnapshotForSource(sourceId) {
    const selectedId=flow.currentSnapshotSelections?.[sourceId];
    return selectedId?D.sources.find(source=>source.id===sourceId)?.snapshots?.find(snapshot=>snapshot.snapshotId===selectedId)||null:null;
  }
  function currentFinanceSnapshot() { return currentSnapshotForSource("finance-workbook"); }
  function currentFinanceFileName() { return currentFinanceSnapshot()?.fileName || "尚未选择本轮工作簿"; }
  function currentT008ForSnapshot(snapshot) {
    const confirmation=flow.t008Confirmation;
    return confirmation&&snapshot&&confirmation.snapshotId===snapshot.snapshotId&&sameScenarioContext(confirmation.scenarioContext,flow.scenarioContext)?confirmation:null;
  }
  function upsertBy(list,key,value) {
    const index=list.findIndex(item=>item?.[key]===value?.[key]);
    if(index>=0)list[index]=value;else list.push(value);
    return value;
  }
  function registerScenarioResourceBundle(resources) {
    if(SCENARIO_ID!=="S003"||!resources?.source||!resources?.input||!resources?.candidate||!resources?.quality||!resources?.pipeline||!resources?.sourceRegistry||!resources?.pipelineProjection||!resources?.publishedPointer)return false;
    const source=resources.source,input=resources.input,candidate=resources.candidate,quality=resources.quality,pipeline=resources.pipeline,sourceRegistry=resources.sourceRegistry,pipelineProjection=resources.pipelineProjection,publishedPointer=resources.publishedPointer;
    const projectedContext=pipelineProjection.scenarioIdentity||publishedPointer.scenarioIdentity||{};
    const currentContext=flow.scenarioContext||{};
    const context=copy({
      scenarioId:projectedContext.scenarioId||currentContext.scenarioId||SCENARIO_ID,
      scenarioVersion:projectedContext.scenarioVersion||currentContext.scenarioVersion||SCENARIO_VERSION,
      scenarioRunId:projectedContext.scenarioRunId||currentContext.scenarioRunId||SCENARIO_RUN_ID,
      formedAt:projectedContext.formedAt||currentContext.formedAt||ENTRY_PARAMS.get("formedAt")||ENTRY_PARAMS.get("contextCreatedAt")||publishedPointer.switchedAt||source.formedAt,
      status:projectedContext.status||currentContext.status||ENTRY_PARAMS.get("status")||ENTRY_PARAMS.get("contextStatus")||"active"
    });
    const registeredWorkbook=sourceRegistry.sources?.find(item=>item.nativeResourceId==="s003-workbook")||{};
    const s001SourceIds=new Set(["finance-workbook","finance-folder","sap-journal","sap-account","treasury-flow","treasury-finance","fis-form"]);
    const s001PipelineIds=new Set(["finance-pipeline","s003-structure"]);
    D.sources.splice(0,D.sources.length,...D.sources.filter(item=>!s001SourceIds.has(item.id)));
    D.pipelines.splice(0,D.pipelines.length,...D.pipelines.filter(item=>!s001PipelineIds.has(item.id)));
    D.targetAssets.splice(0,D.targetAssets.length,...D.targetAssets.filter(item=>item.id!=="finance-asset-target"&&item.scene!=="S001"));
    flow.customSources=flow.customSources.filter(item=>!s001SourceIds.has(item.id));
    flow.customPipelines=flow.customPipelines.filter(item=>!s001PipelineIds.has(item.id));
    flow.customAssets=flow.customAssets.filter(item=>item.id!=="finance-asset-target"&&item.scene!=="S001");
    flow.selectedInputSource="s003-workbook";
    if(!D.sources.some(item=>item.id===ui.selectedSourceId))ui.selectedSourceId="s003-workbook";
    ["s003-factor-config","s003-risk-band-config","s003-enterprise-factor-input"].forEach(sourceId=>{
      const index=D.sources.findIndex(item=>item.id===sourceId);
      if(index>=0)D.sources.splice(index,1);
      flow.customSources=flow.customSources.filter(item=>item.id!==sourceId);
      delete flow.currentSnapshotSelections[sourceId];
    });
    const legacyConfigGroup=D.sourceGroups.findIndex(group=>group.key==="手工配置");
    if(legacyConfigGroup>=0)D.sourceGroups.splice(legacyConfigGroup,1);
    const sourceSnapshot={
      snapshotId:source.sourceId,t002Id:source.sourceId,fileName:source.fileName,
      acquiredAt:source.formedAt,readStartedAt:source.formedAt,readCompletedAt:source.formedAt,
      asOf:source.assessmentAt,hash:source.sourceSha256,size:`${new Intl.NumberFormat("zh-CN").format(source.sourceSizeBytes||16250)} 字节`,sizeBytes:Number(source.sourceSizeBytes||16250),downloadUrl:"../../scenarios/s003/resources/m02/企业债务风险评估模版_S003兼容版.xlsx",
      scope:`财务数据 · ${candidate.enterpriseCount||21} 家企业`,
      status:"已登记 · 结构已核验",structureStatus:"结构已核验",structureEvidence:"S003 正式来源登记与数据合同一致",current:true,
      scenarioContext:copy(context),immutable:source.immutable===true,
      t008Confirmation:{snapshotId:source.sourceId,asOf:source.assessmentAt,confirmedBy:"S003 正式数据登记",confirmedAt:source.formedAt,basis:"权威工作簿与 S003 数据合同共同确认评估时点",scenarioContext:copy(context)}
    };
    const sourceRecord=D.sources.find(item=>item.id==="s003-workbook");
    if(sourceRecord){
      Object.assign(sourceRecord,{
        enabled:true,selectable:true,description:"S003 财务工作簿来源；当前管道只消费财务数据成员。企业当期因子取值不属于该数据源，也不作为模型配置项；由独立 T053 人工输入快照随运行绑定。",
        registration:"正式来源已登记 · 当前快照已确认",latestAcquired:String(source.formedAt||"").slice(0,16),
        asOf:source.assessmentAt,snapshotCount:1,lastSync:`${String(source.formedAt||"").slice(0,16)} · 正式来源登记`,
        syncPlan:"按需上传 · 当前来源不设置同步计划",nextSync:"由用户上传触发",acquisitionStrategy:registeredWorkbook.acquisitionStrategy||"按需上传完整工作簿",
        fileName:source.fileName,physicalEvidence:`正式来源 ${source.sourceId} · SHA-256 ${source.sourceSha256}`,
        sha256:source.sourceSha256,snapshots:[sourceSnapshot],scenarioContext:copy(context),
        compatibilityStatus:{authorityStage:"S003 正式场景",internalResult:"财务来源与质量结果已登记",fileObtained:true,contentVerified:true,controlledRegistration:"已完成",contractCompatibility:"兼容",consumptionStatus:"已由 M01 Published 正式采用",nextOwner:"本体管理",nextAction:"绑定独立 T053 企业因子输入快照与 Published 模型，形成权威风险事实"}
      });
      BASE_SOURCE_STATE.set(sourceRecord.id,{snapshots:[copy(sourceSnapshot)],fileName:source.fileName,asOf:source.assessmentAt,registration:sourceRecord.registration,latestAcquired:sourceRecord.latestAcquired,physicalEvidence:sourceRecord.physicalEvidence,lastSync:sourceRecord.lastSync});
      flow.currentSnapshotSelections[sourceRecord.id]=sourceSnapshot.snapshotId;
    }
    const financialFields=[
      {fieldId:"S003-FIELD-ENTERPRISE-ID",name:"enterpriseId",type:"文本",nullable:false,role:"身份",description:"企业稳定标识"},
      {fieldId:"S003-FIELD-ENTERPRISE-NAME",name:"enterpriseName",type:"文本",nullable:false,role:"标题",description:"企业名称"},
      {fieldId:"S003-FIELD-SECTOR",name:"sector",type:"枚举",nullable:true,role:"普通属性",description:"产业板块"},
      {fieldId:"S003-FIELD-CATEGORY",name:"category",type:"枚举",nullable:true,role:"普通属性",description:"企业类别"},
      {fieldId:"S003-FIELD-ASSESSMENT-AT",name:"assessmentAt",type:"日期",nullable:false,role:"普通属性",description:`评估时点 ${candidate.assessmentAt}`},
      {fieldId:"S003-FIELD-CURRENCY",name:"currency",type:"枚举",nullable:false,role:"普通属性",description:"币种 CNY"},
      {fieldId:"S003-FIELD-AMOUNT-UNIT",name:"amountUnit",type:"文本",nullable:false,role:"普通属性",description:"金额单位 元"},
      ...Object.keys(candidate.records?.[0]?.financialData||{}).map((name,index)=>({fieldId:`S003-FIELD-FIN-${String(index+1).padStart(2,"0")}`,name,type:fieldType(name),nullable:true,role:"事实字段",description:`评估时点 ${candidate.assessmentAt}` }))
    ];
    const members=[
      {id:"S003-MEMBER-FINANCIAL",stableId:"S003-MEMBER-FINANCIAL",name:"财务数据",objectId:"S003-OBJ-DEBT-RISK-ENTERPRISE",grain:"一行一企业 × 评估时点",key:"enterpriseId",identityFieldId:"S003-FIELD-ENTERPRISE-ID",rowCount:candidate.enterpriseCount,fields:financialFields}
    ];
    const asset={
      id:"s003-debt-risk-asset",t006Id:"S003-T006-DEBT-RISK-ASSET",name:"债务风险正式候选数据资产",scene:"S003",
      purpose:"向 M01 提供与评估时点及质量结果一致的财务数据事实；企业当期因子由独立 T053 输入快照提供，模型参数由 M01 Published 模型提供。",
      owner:"M02 数据工程",published:true,status:"消费就绪",versionCount:1,currentVersion:candidate.dataAssetId,currentAuthoritativeVersion:candidate.dataAssetId,
      asOf:candidate.assessmentAt,quality:"通过",publishedAt:candidate.formedAt,sourceSnapshot:source.fileName,sourceSnapshotId:source.sourceId,runId:pipeline.pipelineRunId,
      refreshStatus:"本体侧已正式采用",consumptionStatus:"消费就绪",detailViews:[{key:"overview",label:"版本概览"},{key:"members",label:"包含的数据"},{key:"lineage",label:"如何产生"},{key:"consumption",label:"如何变为可用"}],
      reusePolicy:{allowed:true,selectionMode:"仅经 Published 本体消费",defaultMemberScope:"财务数据",cycleProtection:"禁止输出回读自身",s003CompatibilityVersionAllowed:false},members,relationships:[],relationshipContracts:[],versions:[]
    };
    upsertBy(D.targetAssets,"id",asset);
    const definitionId=`${pipeline.pipelineId}-DEF-v1.0.0`;
    const mappingVersionId=`S003-MAPPING-${publishedPointer.activeTarget?.packageVersion||"1.0.1"}`;
    const nodes=[
      {id:"node-source-workbook",key:"source",x:5810,y:4210,sourceId:"s003-workbook",inputKind:"source",inputSlotId:"financialWorkbook",memberScope:"财务数据"},
      {id:"node-python",key:"python",x:6000,y:4210},{id:"node-quality",key:"quality",x:6190,y:4210},{id:"node-publish",key:"publish",x:6380,y:4210},{id:"node-refresh",key:"refresh",x:6570,y:4210}
    ];
    const edges=[
      {id:"edge-s003-workbook",from:"node-source-workbook",to:"node-python",slotId:"financialWorkbook",slot:"财务工作簿输入"},
      {id:"edge-s003-quality",from:"node-python",to:"node-quality",slotId:"main"},
      {id:"edge-s003-publish",from:"node-quality",to:"node-publish",slotId:"main"},
      {id:"edge-s003-refresh",from:"node-publish",to:"node-refresh",slotId:"main"}
    ];
    const qualityRuleLabels={
      "member-shape":["财务成员结构","字段或结构漂移","财务工作簿","必须存在已确认的财务数据逻辑成员"],
      "enterprise-count":["企业数量完整","数据量异常","工作簿 · 企业集合","企业数量应与本轮正式夹具一致"],
      "stable-enterprise-id":["企业稳定标识唯一","唯一性","财务数据 · enterpriseId","企业标识非空且在企业集合内唯一"],
      "finance-finite-values":["财务数值可解析","字段类型","财务数据 · I / AA 财务字段","财务数值必须为有限数值，不得把文本静默转为 0"],
      "factor-enum":["企业因子枚举合法","枚举值","企业因子输入 · 人工取值","显式值必须命中已声明枚举；缺失使用 DEFAULTED_ZERO"],
      "factor-applicability":["不适用语义明确","跨成员主键集合一致性","企业因子输入 · 条件不适用","NOT_APPLICABLE 与缺失 0 档必须分离"],
      "assessment-context":["评估上下文完整","日期和格式","评估时点 / 币种 / 金额单位","评估时点、CNY 和人民币元必须同时存在"],
      "source-integrity":["来源内容完整性","字段或结构漂移","工作簿快照 · SHA-256","正式运行锁定的来源哈希必须与登记快照一致"]
    };
    const qualityRules=(quality.checks||[]).filter(check=>!["factor-enum","factor-applicability"].includes(check.checkId)).map((check,index)=>{const label=qualityRuleLabels[check.checkId]||[check.checkId,"通用数据检查","S003 工作簿","按登记的数据合同执行"];return {id:`S003-DQ-${String(index+1).padStart(3,"0")}`,sourceCheckId:check.checkId,version:"v1.1.0",name:label[0],type:label[1],scope:label[2],condition:label[3],severity:"硬阻断",failureEffect:"阻断发布候选数据资产",recovery:"修正财务来源快照后，以新运行身份重跑",owner:"M02 数据工程",enabled:true};});
    const definition={pipelineId:pipeline.pipelineId,id:definitionId,name:"债务风险财务数据标准化与候选发布",purpose:"财务工作簿进入受控标准化和通用数据质量门；企业当期因子由独立 T053 输入快照随运行绑定，调节系数、评分权重、固定计算语义与风险阈值由 M01 Published 模型提供。",nodes,edges,pythonModule:{id:"s003_financial_normalize.py",name:"债务风险财务数据标准化",version:"v1.1.0",description:"只标准化财务字段、企业身份和评估上下文；不读取模型配置，不计算风险评分。",inputSlots:[{id:"financialWorkbook",name:"财务工作簿输入",required:true,accepts:["source"],contentMode:"full-data"}]},targetAssetId:asset.t006Id,ontologyBindingId:publishedPointer.pointerId,qualityRules,pipelineSchedule:"仅手工正式运行",validationSeen:true,validationFingerprint:"",validationAt:pipeline.startedAt,trustedScenarioRegistration:true,immutable:true,publishedAt:pipeline.startedAt,scenarioContext:copy(context)};
    upsertBy(flow.publishedDefinitions,"id",definition);
    const pipelineRecord={id:pipeline.pipelineId,name:definition.name,purpose:definition.purpose,definitionState:"已发布定义",definitionVersion:definitionId,nodeCount:nodes.length,source:`${sourceRecord?.name||source.fileName} · 财务数据`,targetAsset:asset.name,targetAssetId:asset.t006Id,ontologyBindingId:publishedPointer.pointerId,latestRun:`${pipelineProjection.sourcePipelineRunId||pipeline.pipelineRunId} · 消费就绪`,schedule:"仅手工正式运行",canOpen:true};
    upsertBy(D.pipelines,"id",pipelineRecord);
    const runInputs=[
      {nodeId:"node-source-workbook",slotId:"financialWorkbook",resourceId:"s003-workbook",name:`${source.fileName} · 财务数据`,kind:"数据源",version:source.sourceId,snapshot:source.fileName,fingerprint:source.sourceSha256,asOf:source.assessmentAt,status:"已确认"}
    ];
    const adoptedAt=pipelineProjection.adoptionEvidence?.adoptedAt||publishedPointer.switchedAt;
    const run={id:pipelineProjection.sourcePipelineRunId||pipeline.pipelineRunId,pipelineId:pipeline.pipelineId,pipelineName:definition.name,definitionVersion:definitionId,scenarioContext:copy(context),scenarioRunId:context.scenarioRunId,trigger:"正式场景装载",trustedScenarioRegistration:true,startedAt:pipeline.startedAt,endedAt:adoptedAt,executionStatus:"成功",executionEndedAt:pipeline.completedAt,closureStatus:"本体侧已正式采用",closedLoopEndedAt:adoptedAt,status:"成功 · 消费就绪",quality:"通过",qualityId:quality.qualityResultId,assetVersion:candidate.dataAssetId,targetAssetId:asset.t006Id,asOf:candidate.assessmentAt,snapshot:runInputs.map(item=>item.snapshot).join("；"),snapshotHash:runInputs.map(item=>item.fingerprint).join("|"),sourceSnapshotId:source.sourceId,inputs:runInputs,nodeExecutions:nodes.map(node=>{const sourceItem=D.sources.find(item=>item.id===node.sourceId);return {id:node.id,executionId:`${pipeline.pipelineRunId}-${node.id}`,key:node.key,name:node.key==="source"?`数据源 · ${sourceItem?.name||node.sourceId}`:node.key==="python"?"债务风险财务数据标准化":node.key==="quality"?"数据质量检查":node.key==="publish"?"发布候选资产":"提交本体刷新请求",status:node.key==="refresh"?"消费就绪":"成功",startedAt:pipeline.startedAt,endedAt:node.key==="refresh"?adoptedAt:pipeline.completedAt,outputSummary:node.key==="quality"?`${quality.qualityResultId} · passed`:node.key==="publish"?candidate.dataAssetId:node.key==="refresh"?`${publishedPointer.pointerId} · 已正式采用`:"已完成"};}),refresh:`${publishedPointer.pointerId} · 已取得正式采用证据`,consumption:`消费就绪 · ${candidate.dataAssetId}`,plan:nodes.map(node=>({id:node.id,key:node.key,name:defForNode(node).name})),qualityChecks:copy(qualityRules)};
    upsertBy(flow.runs,"id",run);
    const version={id:candidate.dataAssetId,asOf:candidate.assessmentAt,quality:"通过",qualityId:quality.qualityResultId,publishedAt:candidate.formedAt,scenarioContext:copy(context),trustedScenarioRegistration:true,sourceSnapshot:runInputs.map(item=>item.snapshot).join("；"),sourceSnapshotId:source.sourceId,sourceHash:source.sourceSha256,inputContentFingerprint:run.snapshotHash,memberContractFingerprint:`${members.map(member=>member.stableId).join("|")}@${candidate.dataAssetVersion}`,relationshipContractFingerprint:"NO-RELATIONSHIP",businessOutputFingerprint:`${candidate.dataAssetId}@${candidate.assessmentAt}`,runId:run.id,definitionVersion:definitionId,targetAssetId:asset.t006Id,refreshStatus:"本体侧已正式采用",consumptionStatus:"消费就绪",dataQualification:"数据侧合格",allowReuse:true,refreshRequestId:"",refreshResultId:"",t018Status:"可消费候选",t018EvidenceId:publishedPointer.pointerId,t019Status:"已采用",t019EvidenceId:publishedPointer.pointerId,t019BindingId:publishedPointer.pointerId,t019Owner:"本体管理",adoptedAt,refreshCompletedAt:adoptedAt,contentAccess:"可访问",retentionStatus:"一期历史保留",retentionPolicyId:"尚未取得",retentionPolicyVersion:"尚未取得",evidenceIntegrity:"完整",members:copy(members),relationships:[],dependencies:[],dependencyVersions:[],dependencyClosure:[],bindingTrustSummary:null,currentTrustSummaries:[]};
    version.bindingTrustSummary=buildBindingTrustSummary(version,run);
    upsertBy(flow.assetVersions,"id",version);
    const adoptionAttempt={requestId:"",resultId:"",runId:run.id,assetVersionId:version.id,scenarioContext:copy(context),ontologyBindingId:publishedPointer.pointerId,targetT017:pipelineProjection.adoptionEvidence?.publishedSemanticVersionId||"S003-M01-DEBT-RISK-V1",sourceMappingVersion:mappingVersionId,requestStatus:"正式采用证据已定位",resultStatus:"成功",resultAt:adoptedAt,t018Status:"可消费候选",t018EvidenceId:publishedPointer.pointerId,t019Status:"已采用",t019EvidenceId:publishedPointer.pointerId,t019BindingId:publishedPointer.pointerId,adoptedVersionId:version.id,adoptedAt,adoptionOwner:"本体管理",evidenceMode:"adoption-projection",trustedScenarioRegistration:true,failureReason:"",recovery:"详细刷新请求号未在当前投影中伪造；以 Published 指针和原运行证据回溯。",events:[{stage:"正式采用",status:"已取得本体管理正式采用证据",at:adoptedAt,evidenceId:publishedPointer.pointerId}]};
    if(!flow.refreshAttempts.some(item=>item.assetVersionId===version.id&&item.t019Status==="已采用"&&item.t019EvidenceId))flow.refreshAttempts.push(adoptionAttempt);
    flow.currentRunId=run.id;flow.runStatus="ready";flow.qualityStatus="passed";flow.candidateVersionId="";flow.refreshStatus="adopted";flow.consumptionStatus="ready";flow.t018Status="可消费候选";flow.t019Status="已采用";flow.t019EvidenceId=publishedPointer.pointerId;flow.t019AdoptedAt=adoptedAt;flow.t019Owner="本体管理";flow.authorityVersionIds[asset.t006Id]=version.id;flow.pipelineSchedules[pipeline.pipelineId]="仅手工正式运行";flow.qualityRules=copy(qualityRules);
    appendCurrentTrustSummary(version,"正式场景装载并取得本体正式采用证据");
    // Trusted S003 registration includes the last known target-binding receipt as
    // a read-only discovery projection. It is not a new C028 refresh request and
    // still requires a fresh C032 read before any user-submitted refresh.
    const discoveryTargetId = "S003-T054-DEBT-RISK-REFRESH-TARGET";
    const discoveryResponseId = "S003-C032-DEBT-RISK-DISCOVERY-20260815-001";
    const discoveryTarget = {
      refreshTargetId: discoveryTargetId,
      bindingVersion: "1",
      bindingName: "企业债务风险评估模型 · 数据刷新目标",
      currentStatus: "可用",
      allowRefreshSubmission: true,
      semanticVersionId: "S003-M01-DEBT-RISK-V1",
      semanticVersion: "V1.0.1",
      sourceMappingVersionId: mappingVersionId,
      dataAssetId: asset.t006Id,
      memberIds: members.map(member => member.id),
      relationIds: [],
      memberCoverage: { expected: members.length, covered: members.length, complete: true, memberIds: members.map(member => member.id), missingMemberIds: [], extraMemberIds: [] },
      relationCoverage: { expected: 0, covered: 0, complete: true, relationIds: [], missingRelationIds: [], extraRelationIds: [] },
      owner: "M01 本体管理",
      lastCheckedAt: adoptedAt,
      evidenceLocator: publishedPointer.pointerId,
      targetFingerprint: `${asset.t006Id}|${version.id}|${mappingVersionId}|${context.scenarioRunId}`,
      scenarioContext: copy(context),
      publishedContext: {
        discovery: { versionId: "S003-M01-DEBT-RISK-V1", semanticVersion: "V1.0.1", name: "企业债务风险评估模型", publicationState: "Published" },
        consumption: { currentFormal: true, dataVersion: version.id, asOf: version.asOf, candidateKey: `${version.id}|${version.id}|${version.asOf}` }
      }
    };
    flow.ontologyDiscovery = {
      sourceModule: "本体管理",
      contractCode: "C032",
      responseId: discoveryResponseId,
      responseVersion: "1",
      responseFingerprint: `${discoveryResponseId}|${discoveryTarget.targetFingerprint}`,
      queryDataAssetId: asset.t006Id,
      scenarioContext: copy(context),
      formedAt: adoptedAt,
      readAt: adoptedAt,
      readPurpose: "正式场景装载",
      status: "可用",
      candidates: [discoveryTarget],
      trustedScenarioRegistration: true,
      requiresSubmitReread: true,
      reason: null,
      recoverySuggestion: "提交新的刷新前，仍需由数据工程执行一次提交前 C032 重读。"
    };
    flow.ontologyDiscoveryStatus="ready";flow.ontologyDiscoveryError="";flow.refreshBindingSelections[`asset:${version.id}`]=discoveryTargetId;
    [sourceRecord].forEach(item => {
      if (!item) return;
      item.pipelineRefs = [{ pipelineId: pipeline.pipelineId, name: definition.name, definition: definitionId, node: "财务工作簿输入", lastRun: `${run.id} · 消费就绪` }];
      item.downstreamAssets = [{ name: asset.name, version: version.id, status: "消费就绪" }];
    });
    const activeCategories=new Set(D.sources.map(item=>item.category));
    D.sourceGroups.splice(0,D.sourceGroups.length,...D.sourceGroups.filter(group=>activeCategories.has(group.key)));
    syncFlowData();render();
    return true;
  }
  let s003FormalDeliveryPromise = null;
  function s003FormalVersion() {
    return flow.assetVersions.find(item => item?.trustedScenarioRegistration === true
      && item.targetAssetId === "S003-T006-DEBT-RISK-ASSET")
      || flow.assetVersions.find(item => item?.id?.startsWith?.("S003-T007-FORMAL-CANDIDATE-"));
  }
  async function ensureS003FormalDelivery() {
    if (SCENARIO_ID !== "S003") return { okay: false, reason: "仅 S003 支持正式场景装载交付" };
    if (s003FormalDeliveryPromise) return s003FormalDeliveryPromise;
    s003FormalDeliveryPromise = (async () => {
      const version = s003FormalVersion();
      const run = version ? flow.runs.find(item => item.assetVersion === version.id) : null;
      const asset = version ? D.targetAssets.find(item => item.t006Id === version.targetAssetId || item.id === version.targetAssetId) : null;
      if (!version || !run || !asset) return { okay: false, reason: "S003 正式数据资产、运行或资产合同不可定位" };
      const existingGate = dataAssetDeliveryGate(version);
      if (existingGate.okay) return { okay: true, record: existingGate.record, reused: true };
      const latest = latestC003DeliveryRecord(version);
      // A prior accepted/unknown attempt is never replayed automatically; only
      // re-read its immutable evidence.  A complete rejection or a local
      // pre-send block may receive a new, explicitly linked attempt.
      if (latest && (latest.receipt?.status === "accepted" || latest.status === "结果未知" || latest.status === "已发送 · 结果待核对")) {
        const checked = await verifyC003DeliveryRecord(version, latest);
        const rereadGate = dataAssetDeliveryGate(version);
        if (rereadGate.okay || checked.status === "结果未知" || checked.status === "已发送 · 结果待核对") return { okay: rereadGate.okay, record: latest, checked, reused: true };
      }
      const attempts=c003DeliveryRecords(version);
      if(latest&&attempts.some(item=>Number(item.attemptNumber||1)>1)){
        const checked=await verifyC003DeliveryRecord(version,latest);
        const rereadGate=dataAssetDeliveryGate(version);
        return {okay:rereadGate.okay,record:latest,checked,reused:true,reason:rereadGate.reason||"已保留一次关联恢复尝试；不会在页面加载时继续生成后续 Axx"};
      }
      const recoverable=latest&&(
        latest.receipt?.status==="rejected"
        ||latest.status==="交付被拒绝"
        ||(latest.status==="交付被阻断"&&latest.receiptStatus==="未发送")
      );
      if(latest&&!recoverable){
        const checked=await verifyC003DeliveryRecord(version,latest);
        const rereadGate=dataAssetDeliveryGate(version);
        return {okay:rereadGate.okay,record:latest,checked,reused:true,reason:rereadGate.reason||"当前交付证据只允许重读，不具备自动重发条件"};
      }
      const record = await deliverDataAssetToOntology(asset, version, run, latest ? { newAttempt: true, retryOf: latest.deliveryId } : {});
      const gate = dataAssetDeliveryGate(version);
      return { okay: gate.okay, record, reason: gate.reason || "", reused: false };
    })().finally(() => { s003FormalDeliveryPromise = null; });
    return s003FormalDeliveryPromise;
  }
  function syncFlowData() {
    flow.customSources.forEach(saved => {
      if (!D.sources.some(x => x.id === saved.id)) D.sources.push(JSON.parse(JSON.stringify(saved)));
    });
    flow.customPipelines.forEach(saved => {
      if (!D.pipelines.some(x => x.id === saved.id)) D.pipelines.push(JSON.parse(JSON.stringify(saved)));
    });
    flow.customAssets.forEach(saved => {
      if (!D.targetAssets.some(x => x.id === saved.id)) D.targetAssets.push(JSON.parse(JSON.stringify(saved)));
    });
    Object.entries(flow.sourceSettings || {}).forEach(([id,settings]) => {
      const item=D.sources.find(x=>x.id===id); if(item) Object.assign(item,settings);
    });
    D.sources.forEach(item=>{
      const base=BASE_SOURCE_STATE.get(item.id),history=[...(base?.snapshots||[]),...flow.uploadedSnapshots.filter(entry=>entry.sourceId===item.id).map(entry=>entry.snapshot)].filter(Boolean);
      const unique=new Map();history.forEach(snapshot=>{if(snapshot.snapshotId&&!unique.has(snapshot.snapshotId))unique.set(snapshot.snapshotId,copy(snapshot));});
      item.snapshots=[...unique.values()].sort((left,right)=>String(right.acquiredAt||"").localeCompare(String(left.acquiredAt||""),"zh-CN"));
      const selectedId=flow.currentSnapshotSelections?.[item.id]||"",selected=item.snapshots.find(snapshot=>snapshot.snapshotId===selectedId)||null,latest=item.snapshots[0]||null;
      item.snapshots.forEach(snapshot=>snapshot.current=snapshot.snapshotId===selectedId);
      item.snapshotCount=item.snapshots.length;
      item.fileName=item.id==="s003-workbook"?(base?.fileName||latest?.fileName||""):(selected?.fileName||"");
      item.latestAcquired=latest?.acquiredAt?.slice?.(0,16)||base?.latestAcquired||"尚未取得";
      item.asOf=selected?(selected.asOf||"待确认"):item.id==="s003-workbook"?(base?.asOf||item.asOf||""):"本轮未选择";
      item.lastSync=latest?`${item.latestAcquired} · 最近成功读取`:base?.lastSync||item.lastSync||"尚未执行";
      item.physicalEvidence=item.id==="s003-workbook"?(base?.physicalEvidence||item.physicalEvidence||""):(selected?`本轮所选快照 · ${selected.fileName}`:"本轮尚未选择快照");
      if(!item.planned&&item.id!=="s003-workbook")item.registration=selected?(selected.asOf&&selected.asOf!=="待确认"?"本轮快照已确认 · 可运行":"本轮快照已登记 · 待确认数据截至"):item.snapshots.length?`本轮未选择 · 历史 ${item.snapshots.length} 个快照`:"尚无快照 · 等待上传或发现";
      if(item.sourceType==="manual-business-input"){
        item.registration=selected?"输入快照已发布 · 当前版本已锁定":item.snapshots.length?`当前未选择 · 历史 ${item.snapshots.length} 个输入版本`:"尚无 Published 输入快照";
        item.lastSync=selected?`${item.latestAcquired} · 人工输入发布`:base?.lastSync||"尚未发布";
        item.physicalEvidence=selected?`人工业务输入 · ${selected.snapshotId}`:"尚无当前人工输入版本";
      }
      if(item.sourceType==="manual-config"){
        item.registration=selected?"配置已发布 · 可切换版本":item.snapshots.length?`当前未选择 · 历史 ${item.snapshots.length} 个配置版本`:"尚无 Published 配置版本";
        item.lastSync=selected?`${item.latestAcquired} · 系统配置发布`:base?.lastSync||"尚未发布";
        item.physicalEvidence=selected?`系统配置输入 · ${item.configResourceId||item.id} · ${selected.configVersion||selected.snapshotId}`:"尚无当前配置版本";
      }
    });
    const source = D.sources.find(x => x.id === "finance-workbook");
    const asset = D.targetAssets.find(x => x.id === "finance-asset-target");
    const version = latestVersionForAsset(asset);
    if (source) {
      const selected=currentFinanceSnapshot();
      const confirmation=currentT008ForSnapshot(selected);
      source.asOf=selected?(confirmation?confirmation.asOf:"待确认"):"本轮未选择";
      source.registration=selected?(confirmation?"本轮快照已确认 · 可运行":"本轮快照已登记 · 待确认数据截至"):source.snapshots?.length?`本轮未选择 · 历史 ${source.snapshots.length} 个快照`:"尚无快照 · 等待上传";
      if(selected)selected.asOf=source.asOf;
      if (source.pipelineRefs?.[0]) {
        source.pipelineRefs[0].definition = flow.definitionPublished ? flow.definitionVersion : "草稿 0.1";
        source.pipelineRefs[0].lastRun = flow.runs[0]?.status || "尚无正式运行";
      }
      source.downstreamAssets = version ? [{ name:asset.name, version:version.id, status:version.consumptionStatus }] : [];
    }
    D.pipelines.forEach(item=>{
      if(!item.canOpen)return;
      const definition=latestDefinitionForPipeline(item.id),draft=flow.canvasDrafts[item.id],record=definition||draft;
      const latestRun=latestRunForPipeline(item.id);
      if(record?.name)item.name=record.name;
      if(record?.purpose)item.purpose=record.purpose;
      item.definitionState=definition?"已发布定义":draft?"草稿":item.definitionState||"尚未形成管道定义";
      item.definitionVersion=definition?.id||(draft?"编辑草稿":"尚未形成管道定义");
      item.nodeCount=record?.nodes?.length??item.nodeCount;
      item.targetAsset=D.targetAssets.find(a=>a.t006Id===record?.targetAssetId)?.name||item.targetAsset;
      item.latestRun=latestRun?`${latestRun.id} · ${latestRun.status}`:"尚未运行";
      item.schedule=currentPipelineSchedule(item.id);
    });
    D.targetAssets.forEach(item=>{
      const itemVersion=latestVersionForAsset(item),itemAuthority=authorityVersionForAsset(item),itemVersions=versionsForAsset(item);
      item.published=Boolean(itemVersion);
      item.versionCount=itemVersions.length;
      item.currentVersion=itemVersion?.id||"尚未发布";
      item.currentAuthoritativeVersion=itemAuthority?.id||"尚未采用";
      item.asOf=itemVersion?.asOf||"无";
      item.quality=itemVersion?.quality||"尚无质量结论";
      item.publishedAt=itemVersion?.publishedAt||"";
      item.sourceSnapshot=itemVersion?.sourceSnapshot||"";
      item.runId=itemVersion?.runId||"";
      item.refreshStatus=itemVersion?.refreshStatus||"尚未请求";
      item.consumptionStatus=itemVersion?.id===itemAuthority?.id?"消费就绪":itemVersion?"最新版本不可消费":"不可消费";
      item.status=itemVersion?(itemVersion.id===itemAuthority?.id?"消费就绪":/刷新失败/.test(itemVersion.refreshStatus)?`最新版本刷新失败 · ${authorityServiceText(itemAuthority)}`:`最新版本待采用 · ${authorityServiceText(itemAuthority)}`):"尚未发布";
    });
    const folder=D.sources.find(x=>x.id==="finance-folder");
    if(folder&&flow.folderSyncAt){folder.lastSync=`${flow.folderSyncAt} · 未发现新文件`;folder.latestAcquired="未发现新文件";}
    D.formalRuns = flow.runs;
  }
  syncFlowData();

  const icons = {
    database: '<ellipse cx="12" cy="5" rx="7" ry="3"></ellipse><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5"></path><path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"></path>',
    workflow: '<rect x="3" y="3" width="6" height="6" rx="1"></rect><rect x="15" y="15" width="6" height="6" rx="1"></rect><path d="M9 6h4a4 4 0 0 1 4 4v5"></path><path d="m14 12 3 3 3-3"></path>',
    search: '<circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path>',
    file: '<path d="M6 2h8l4 4v16H6z"></path><path d="M14 2v5h5M9 13h6M9 17h6"></path>',
    folder: '<path d="M3 6h7l2 2h9v11H3z"></path>',
    package: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"></path><path d="m4 7.5 8 4.5 8-4.5M12 12v9"></path>',
    chevron: '<path d="m9 18 6-6-6-6"></path>',
    down: '<path d="m6 9 6 6 6-6"></path>',
    plus: '<path d="M12 5v14M5 12h14"></path>',
    close: '<path d="m6 6 12 12M18 6 6 18"></path>',
    info: '<circle cx="12" cy="12" r="9"></circle><path d="M12 11v6M12 7h.01"></path>',
    alert: '<path d="M12 3 2 21h20L12 3Z"></path><path d="M12 9v5M12 18h.01"></path>',
    check: '<path d="m5 12 4 4L19 6"></path>',
    refresh: '<path d="M20 6v5h-5"></path><path d="M4 18v-5h5"></path><path d="M18 9a7 7 0 0 0-12-2L4 11M6 15a7 7 0 0 0 12 2l2-4"></path>',
    upload: '<path d="M12 16V4"></path><path d="m7 9 5-5 5 5"></path><path d="M5 15v4h14v-4"></path>',
    settings: '<circle cx="12" cy="12" r="3"></circle><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A7 7 0 0 0 15 6l-.3-2.5h-4L10.4 6A7 7 0 0 0 8 7.1l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1A7 7 0 0 0 10.4 18l.3 2.5h4L15 18a7 7 0 0 0 1.6-1.1l2.4 1 2-3.4-2-1.5a7 7 0 0 0 0-1Z"></path>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"></path><path d="M3 3v5h5M12 7v5l3 2"></path>',
    python: '<rect x="3" y="3" width="18" height="18" rx="3"></rect><path d="M9 8h4a2 2 0 0 1 2 2v4M15 16h-4a2 2 0 0 1-2-2v-4"></path><circle cx="11" cy="7" r=".5"></circle><circle cx="13" cy="17" r=".5"></circle>',
    shield: '<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z"></path><path d="m9 12 2 2 4-4"></path>',
    save: '<path d="M5 3h12l2 2v16H5z"></path><path d="M8 3v6h8V3M8 21v-7h8v7"></path>',
    undo: '<path d="m9 7-5 5 5 5"></path><path d="M4 12h9a6 6 0 0 1 6 6"></path>',
    play: '<path d="m8 5 11 7-11 7V5Z"></path>',
    bug: '<path d="M8 9h8M9 5l-2-2M15 5l2-2M5 13H2M22 13h-3M5 18l-2 2M19 18l2 2"></path><rect x="6" y="6" width="12" height="15" rx="6"></rect>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1"></path><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1"></path>',
    clock: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
    keyboard: '<rect x="3" y="6" width="18" height="12" rx="2"></rect><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h8M18 14h.01"></path>',
    more: '<circle cx="5" cy="12" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle>',
    expand: '<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"></path>',
    collapse: '<path d="m15 18-6-6 6-6"></path>',
    trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"></path>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path>',
    edit: '<path d="m4 17-.5 3.5L7 20l11-11-3-3L4 17Z"></path><path d="m13.5 7.5 3 3"></path>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"></path><circle cx="4" cy="6" r="1"></circle><circle cx="4" cy="12" r="1"></circle><circle cx="4" cy="18" r="1"></circle>'
  };

  function icon(name) { return `<span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24">${icons[name] || icons.info}</svg></span>`; }
  function localizeUiText(value) {
    return String(value == null ? "" : value)
      .replaceAll("行动请求", "行动申请")
      .replaceAll("Action Request", "行动申请")
      .replaceAll("目标 Draft", "目标草稿")
      .replaceAll("Draft 绑定", "草稿绑定")
      .replace(/\bPublished\b/g, "已发布")
      .replace(/\bDraft\b/g, "草稿")
      .replace(/\bOwner\b/g, "责任人");
  }
  function localizeMainInterface(container) {
    if (!container) return;
    const walker=document.createTreeWalker(container,NodeFilter.SHOW_TEXT),nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      const parent=node.parentElement;
      if(!parent||parent.closest("script,style,code,pre,.mono,[data-preserve-technical]"))return;
      const localized=localizeUiText(node.nodeValue);
      if(localized!==node.nodeValue)node.nodeValue=localized;
    });
    container.querySelectorAll("[title],[aria-label],[placeholder],input:not(.mono):not([data-preserve-technical]),textarea:not(.mono):not([data-preserve-technical])").forEach(control=>{
      ["title","aria-label","placeholder"].forEach(attribute=>{
        if(!control.hasAttribute?.(attribute))return;
        control.setAttribute(attribute,localizeUiText(control.getAttribute(attribute)));
      });
      if("value" in control&&control.value)control.value=localizeUiText(control.value);
    });
  }
  function esc(value) { return String(value == null ? "" : value).replace(/[&<>\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;"}[c])); }
  function badge(text, tone) { return `<span class="badge ${tone || "neutral"}">${esc(text)}</span>`; }
  function button(label, action, kind, iconName, disabled, attrs) { return `<button class="btn ${kind || ""}" data-action="${action}" ${disabled ? "disabled" : ""} ${attrs || ""}>${iconName ? icon(iconName) : ""}<span>${esc(label)}</span></button>`; }
  function fact(label, value, note) { return `<div class="fact"><span>${esc(label)}</span><strong title="${esc(value)}">${esc(value)}</strong>${note ? `<small>${esc(note)}</small>` : ""}</div>`; }
  function emptyState(title, copy, action) { return `<div class="empty-state">${icon("info")}<strong>${esc(title)}</strong><p>${esc(copy)}</p>${action || ""}</div>`; }
  function notice(copy, tone, title) { return `<div class="notice ${tone || "info"}">${icon(tone === "danger" ? "alert" : tone === "success" ? "check" : "info")}<div>${title ? `<strong>${esc(title)}</strong>` : ""}<span>${copy}</span></div></div>`; }
  function toneFor(text) { return /通过|可用|完成|就绪|已确认/.test(text) ? "success" : /阻断|失败/.test(text) ? "danger" : /待|尚未|无 /.test(text) ? "neutral" : "warning"; }
  function formatValue(v) { return typeof v === "number" ? new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(v) : (v == null || v === "" ? "空" : String(v)); }
  function fieldType(name) { if (/日期|生效日|付息日|到期/.test(name)) return "日期"; if (/编号|编码|标识/.test(name)) return "文本标识"; if (/形式|类型|名称|方式|周期|币种|境内外|板块|类别|借款人|机构|负责人|担保|结息/.test(name)) return "文本"; if (/余额|金额|利率|汇率|天数|值|总计|收入|利润|成本|资产|负债|权益|资金|费用|存货|资本|应收/.test(name)) return "数值"; return "文本"; }
  function route() { const raw = (location.hash || "#/resources?shelf=sources").slice(1); const q = raw.indexOf("?"); const path = q < 0 ? raw : raw.slice(0, q); return { path: path || "/resources", parts: (path || "/resources").split("/").filter(Boolean), params: new URLSearchParams(q < 0 ? "" : raw.slice(q + 1)) }; }
  function withParams(patch) { const r = route(); Object.entries(patch).forEach(([k,v]) => v == null || v === "" ? r.params.delete(k) : r.params.set(k, v)); const q = r.params.toString(); return `#${r.path}${q ? `?${q}` : ""}`; }
  function ontologyManagementHref() {
    const candidate=ontologyBindingForCanvas();if(candidate?.managementEntry){try{const url=new URL(candidate.managementEntry,location.origin);if(url.origin===location.origin&&url.pathname===ONTOLOGY_ENTRY_PATH)return url.href;}catch(_){/* Fall through to the stable M01 entry. */}}
    const run=runForCanvas(),version=assetVersionForRun(run),params=new URLSearchParams({sourceModule:"data-engineering",dataAssetId:version?.targetAssetId||ui.canvas?.targetAssetId||"",returnTo:location.href});
    if(candidate?.semanticVersionId)params.set("semanticVersionId",candidate.semanticVersionId);
    if(candidate?.refreshTargetId)params.set("refreshTargetId",candidate.refreshTargetId);
    if(candidate?.bindingVersion)params.set("bindingVersion",candidate.bindingVersion);
    return `${ONTOLOGY_ENTRY_PATH}#published/version?${params.toString()}`;
  }
  function go(hash,force=false) { if(!force&&queueCanvasTransition({type:"hash",value:hash}))return;if (location.hash === hash) render(); else location.hash = hash; }
  function toast(message) { ui.toast = message; render(); clearTimeout(toastTimer); toastTimer = setTimeout(() => { ui.toast = ""; render(); }, 2600); }
  function openModal(type, data) { ui.modal = { type, data: data || {} }; ui.versionMenu = false; ui.moreMenu = false; render(); }
  function closeModal() {
    if(ui.modal?.type==="unsaved-draft")ui.pendingCanvasTransition=null;
    if(ui.modal?.type==="run-detail"&&ui.modal.data.routeDriven){
      ui.modal=null;
      history.replaceState(null,"",withParams({run:null,view:null}));
      return render();
    }
    ui.modal = null; render();
  }
  function isSection(name) { return route().parts[0] === name; }

  function currentPageLabel() {
    const parts = route().parts;
    if (parts[0] === "resources" && parts[1] === "source") return "数据源详情";
    if (parts[0] === "resources" && parts[1] === "asset") return "数据资产详情";
    if (parts[0] === "resources") return "数据资源目录";
    if (parts[0] === "pipelines" && parts[2] === "canvas") return "管道画布";
    if (parts[0] === "pipelines") return "数据管道目录";
    return "数据工程";
  }

  function shell(content, canvas) {
    const latest=flow.runs[0];
    const workspaceStatus=latest?`${latest.id} · ${latest.status}`:flow.definitionPublished?`${flow.definitionVersion} · 等待运行`:"尚无正式运行";
    return `<div class="app-shell">
      <aside class="platform-rail" aria-label="平台模块栏"><span class="platform-logo" title="智财问策">${icon("workflow")}</span><a class="platform-button active" href="#/resources" title="数据工程">${icon("database")}</a><span class="platform-spacer"></span><button class="platform-button" data-action="reset-flow" title="重置工作区状态">${icon("refresh")}</button></aside>
      <nav class="product-nav" aria-label="数据工程导航"><div class="product-nav-head"><span>${icon("workflow")}</span><div><strong>数据工程</strong><small>来源 · 处理 · 质量 · 发布 · 刷新</small></div></div><div class="product-nav-list"><span class="product-nav-label">工作区</span><a class="product-nav-item ${isSection("resources") ? "active" : ""}" href="#/resources">${icon("database")}<span>数据资源</span></a><a class="product-nav-item ${isSection("pipelines") ? "active" : ""}" href="#/pipelines?tab=definitions">${icon("workflow")}<span>数据管道</span></a></div><div class="product-nav-foot"><strong>最近运行</strong><span>${esc(workspaceStatus)}</span><span>${flow.consumptionStatus==="ready"?(SCENARIO_ID==="S003"?"债务风险数据可消费":"融资数据已可消费"):"消费状态未就绪"}</span></div></nav>
      <section class="app-workspace"><header class="topbar"><div class="breadcrumb"><span>智财问策</span>${icon("chevron")}<span>数据工程</span>${icon("chevron")}<strong>${esc(currentPageLabel())}</strong></div></header><main class="main ${canvas ? "canvas-main" : ""}">${content}</main></section>
      ${ui.modal ? renderModal() : ""}${ui.toast ? `<div class="toast" role="status">${esc(ui.toast)}</div>` : ""}
    </div>`;
  }
  function pageHeader(title, subtitle, actions) { return `<div class="page-header"><div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="header-actions">${actions || ""}</div></div>`; }
  function topTabs(items, active, action) { return `<div class="tabs" role="tablist">${items.map(x => `<button class="tab ${active === x[0] ? "active" : ""}" data-action="${action}" data-value="${x[0]}">${esc(x[1])}${x[2] ? `<span>${esc(x[2])}</span>` : ""}</button>`).join("")}</div>`; }

  function viewToggle(kind, active) {
    return `<div class="view-toggle" role="group" aria-label="${kind === "source" ? "数据源" : "数据资产"}展示方式"><button class="${active === "cards" ? "active" : ""}" data-action="${kind}-view" data-value="cards" title="卡片视图">${icon("grid")}<span>卡片</span></button><button class="${active === "list" ? "active" : ""}" data-action="${kind}-view" data-value="list" title="列表视图">${icon("list")}<span>列表</span></button></div>`;
  }
  function sourceDirectoryState(s) {
    if(s.planned)return {label:"未接入",tone:"neutral"};
    const extensionState=scenarioExtension()?.sourceDirectoryState?.(s);
    if(extensionState)return extensionState;
    if(s.id==="s003-workbook")return {label:"内容已核验",tone:"warning"};
    const selected=currentSnapshotForSource(s.id);
    if(s.category==="共享文件夹")return {label:selected?"本轮已选择":s.snapshotCount?"本轮未选择":"已配置",tone:selected?"success":"neutral"};
    if(selected&&s.enabled)return {label:s.id==="finance-workbook"&&currentT008ForSnapshot(selected)?"可运行":"本轮已选择",tone:"success"};
    if(s.snapshotCount>0&&s.enabled)return {label:"本轮未选择",tone:"neutral"};
    if(s.enabled)return {label:"待同步",tone:"neutral"};
    return {label:"不可选用",tone:"neutral"};
  }
  function selectedSource() { return D.sources.find(x => x.id === ui.selectedSourceId) || filteredSources()[0] || D.sources[0]; }
  function resourceDirectory() {
    const actions = button("新建数据源", "new-source", "primary", "plus");
    const publishedAssets = D.targetAssets.filter(a => a.published);
    const visibleSourceCount = D.sources.filter(source => source.catalogVisible !== false).length;
    return shell(`<div class="page" data-screen-label="数据资源目录">${pageHeader("数据资源", "在同一页面管理数据源和已发布的数据资产。", actions)}<div class="resource-board"><section class="resource-column source-column"><div class="resource-column-head"><div><span class="eyebrow">输入</span><h2>数据源目录 <em>${visibleSourceCount}</em></h2></div>${viewToggle("source",ui.sourceView)}</div>${sourceDirectory()}</section><section class="resource-column asset-column"><div class="resource-column-head"><div><span class="eyebrow">输出</span><h2>数据资产目录 <em>${publishedAssets.length}</em></h2></div>${viewToggle("asset",ui.assetView)}</div>${assetDirectory()}</section></div></div>`, false);
  }
  function filteredSources() { const q = ui.resourceQuery.trim().toLowerCase(); return D.sources.filter(s => s.catalogVisible !== false && (!q || [s.name,s.category,s.access,s.description,s.registration].join(" ").toLowerCase().includes(q))); }
  function sourceDirectory() {
    const sources = filteredSources();
    const content = ui.sourceView==="cards" ? `<div class="source-groups">${D.sourceGroups.map(g => sourceGroup(g, sources)).join("")}</div>` : sourceTable(sources);
    const current=sources.filter(x=>!x.planned).length,planned=sources.filter(x=>x.planned).length;
    return `<div class="directory-toolbar"><label class="search-box">${icon("search")}<input id="resource-search" value="${esc(ui.resourceQuery)}" placeholder="搜索数据源、来源分类或状态" /></label><span>${current} 个当前来源${planned?` · ${planned} 个规划来源`:""}</span></div>${content}`;
  }
  function sourceGroup(group, sources) {
    const items = sources.filter(s => s.category === group.key); if (!items.length && ui.resourceQuery) return "";
    const collapsed = ui.collapsedGroups.has(group.key);
    const available = items.filter(x => x.enabled).length;
    const tone=available?"success":"neutral";
    return `<section class="source-group"><button class="source-group-head" data-action="toggle-source-group" data-group="${esc(group.key)}"><span class="group-arrow">${icon(collapsed ? "chevron" : "down")}</span><span class="group-copy"><strong>${esc(group.label)}</strong><small>${esc(group.description)}</small></span><span class="group-summary">${items.length} 个来源</span>${badge(group.status,tone)}</button>${collapsed ? "" : `<div class="source-card-grid">${items.length ? items.map(sourceCard).join("") : emptyState("没有匹配的数据源", "请调整搜索条件。")}</div>`}</section>`;
  }
  function sourceCard(s) {
    const selected = ui.selectedSourceId === s.id;
    const sourceIcon=s.category==="共享文件夹"?"folder":s.planned?"database":"file";
    const action=s.planned?`<span class="source-action-placeholder">尚未接入</span>`:`<button class="text-link" data-action="open-source-detail" data-id="${s.id}">查看详情 ${icon("chevron")}</button>`;
    const attrs=s.planned?"":`data-action="select-source-card" data-id="${s.id}" tabindex="0" aria-selected="${selected}"`;
    const footerCopy=scenarioExtension()?.sourceFooterCopy?.(s)||(s.id==="s003-workbook"?"核验文件已取得 · 尚未受控登记":s.snapshotCount ? `最近取得：${s.latestAcquired}` : s.planned?"后期建设":"尚无快照");
    const directoryState=sourceDirectoryState(s);
    const acquisition=scenarioExtension()?.sourceAcquisition?.(s)||null;
    const body = `<div class="source-card-head"><span class="source-icon">${icon(sourceIcon)}</span><div><h3>${esc(s.name)}</h3><p>${esc(s.description)}</p></div><span title="${esc(s.registration)}">${badge(directoryState.label,directoryState.tone)}</span></div><div class="source-card-facts">${fact("接入方式",s.access)}${fact("快照",`${s.snapshotCount} 个`)}${fact("数据截至",s.asOf)}${fact(acquisition?.label||"同步计划",acquisition?.value||s.syncPlan)}</div><div class="card-foot"><span>${footerCopy}</span>${action}</div>`;
    return `<article class="source-card ${selected&&!s.planned ? "selected" : ""} ${s.planned?"planned":""}" ${attrs}>${body}</article>`;
  }
  function sourceTable(sources) {
    if(!sources.length) return emptyState("没有匹配的数据源", "请调整搜索条件。");
    const rows=sources.map(s=>{const sourceIcon=s.category==="共享文件夹"?"folder":s.planned?"database":"file",directoryState=sourceDirectoryState(s),acquisition=scenarioExtension()?.sourceAcquisition?.(s)||null;const action=s.planned?`<span class="table-muted">尚未接入</span>`:`<button class="text-link" data-action="open-source-detail" data-id="${s.id}">查看详情 ${icon("chevron")}</button>`;return `<tr class="${s.planned?"planned":""}"><td><div class="table-resource-name"><span class="source-icon">${icon(sourceIcon)}</span><div><strong>${esc(s.name)}</strong><small>${esc(s.description)}</small></div></div></td><td>${esc(s.category)}</td><td>${esc(s.access)}</td><td title="${esc(s.registration)}">${badge(directoryState.label,directoryState.tone)}</td><td class="numeric">${s.snapshotCount}</td><td>${esc(s.asOf)}</td><td>${esc(acquisition?.value||s.syncPlan)}</td><td>${esc(s.latestAcquired||"—")}</td><td>${action}</td></tr>`;}).join("");
    return `<div class="resource-table-frame"><div class="resource-table-wrap" data-table-scroll="source"><table class="resource-table source-resource-table"><thead><tr><th>数据源</th><th>来源类型</th><th>接入方式</th><th>当前状态</th><th>快照数</th><th>数据截至</th><th>取得 / 同步策略</th><th>最近取得</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div><div class="table-scrollbar" data-table-scrollbar="source" role="scrollbar" aria-label="数据源列表横向滚动" aria-orientation="horizontal" tabindex="0"><div class="table-scroll-thumb"></div></div></div>`;
  }
  function assetDirectory() {
    const assets = D.targetAssets.filter(a => a.published);
    if (!assets.length) return `<div class="directory-toolbar asset-toolbar"><div>${badge("0 个已发布资产", "neutral")}<span class="toolbar-copy">这里只显示通过正式运行和质量门后发布的数据版本。</span></div></div>${emptyState("尚无已发布数据资产", "完成管道正式运行并通过质量门后，发布结果会在此出现，并可作为后续管道的数据源。", `<a class="btn soft" href="#/pipelines/finance-pipeline/canvas">打开发布节点</a>`)}`;
    const content=ui.assetView==="list"?assetTable(assets):`<div class="asset-grid">${assets.map(a => assetCard(a)).join("")}</div>`;
    return `<div class="directory-toolbar asset-toolbar"><div>${badge(`${assets.length} 个已发布资产`, "success")}<span class="toolbar-copy">最新发布版本与当前正式消费版本分别展示，历史版本仍可追溯。</span></div></div>${content}`;
  }
  function assetCard(a) {
    const tone=a.consumptionStatus==="消费就绪"?"success":"warning";
    const authority=authorityVersionForAsset(a),latest=latestVersionForAsset(a),productionHref=assetProductionHref(a,latest);
    return `<article class="asset-card"><div><span class="eyebrow">已发布数据资产</span><h3>${esc(a.name)}</h3><p>${a.members.length} 个成员 · ${a.relationships.length} 条关系 · 新数据生成新版本，历史记录不被覆盖。</p></div><div class="summary-strip">${fact("最新发布版本",a.currentVersion)}${fact("数据截至",a.asOf)}${fact("质量",a.quality)}${fact("正在给下游使用",authority?.id||"尚未采用")}</div><div class="card-foot">${badge(a.consumptionStatus,tone)}<div class="card-foot-actions">${productionHref?`<a class="text-link" href="${productionHref}">查看生产画布</a>`:""}<a class="text-link" href="#/resources/asset/${a.id}?tab=overview">查看详情 ${icon("chevron")}</a></div></div></article>`;
  }
  function assetTable(assets) {
    const rows=assets.map(a=>{const authority=authorityVersionForAsset(a),latest=latestVersionForAsset(a),productionHref=assetProductionHref(a,latest);return `<tr><td><div class="table-resource-name"><span class="source-icon">${icon("package")}</span><div><strong>${esc(a.name)}</strong><small>${a.members.length} 个成员 · ${a.relationships.length} 条关系</small></div></div></td><td>${esc(a.currentVersion)}</td><td>${esc(authority?.id||"尚未采用")}</td><td>${esc(a.asOf)}</td><td>${badge(a.quality,toneFor(a.quality))}</td><td>${a.members.length}</td><td>${a.relationships.length}</td><td>${esc(a.publishedAt)}</td><td>${badge(a.consumptionStatus,a.consumptionStatus==="消费就绪"?"success":"warning")}</td><td><div class="table-actions">${productionHref?`<a class="text-link" href="${productionHref}">生产画布</a>`:""}<a class="text-link" href="#/resources/asset/${a.id}?tab=overview">查看详情 ${icon("chevron")}</a></div></td></tr>`;}).join("");
    return `<div class="resource-table-frame"><div class="resource-table-wrap" data-table-scroll="asset"><table class="resource-table asset-resource-table"><thead><tr><th>数据资产</th><th>最新发布版本</th><th>正在给下游使用</th><th>数据截至</th><th>质量</th><th>成员</th><th>关系</th><th>发布时间</th><th>消费状态</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div><div class="table-scrollbar" data-table-scrollbar="asset" role="scrollbar" aria-label="数据资产列表横向滚动" aria-orientation="horizontal" tabindex="0"><div class="table-scroll-thumb"></div></div></div>`;
  }

  function sourceDetail(id) {
    const s = D.sources.find(x => x.id === id); if (!s) return notFound();
    const tab = route().params.get("tab") || "overview";
    const managedScenarioSource=scenarioExtension()?.managesSource?.(s)===true;
    const tabs = s.id==="s003-workbook"&&!managedScenarioSource?[["overview","概览"],["content","内容与字段"],["snapshots","快照历史"],["references","引用关系"]]:[["overview","概览"],["content","内容与字段"],["snapshots","快照历史"],["references","引用关系"],["settings","设置"]];
    const extensionTabs=scenarioExtension()?.sourceTabs?.(s)||[];
    extensionTabs.forEach(item=>{if(Array.isArray(item)&&item.length>=2&&!tabs.some(tabItem=>tabItem[0]===item[0]))tabs.push(item);});
    const financeSnapshot=currentFinanceSnapshot(),financeConfirmation=currentT008ForSnapshot(financeSnapshot);
    const confirmAction=s.id==="finance-workbook"&&financeSnapshot&&!financeConfirmation?button("确认数据截至时间","confirm-snapshot","primary","check"):"";
    const extensionActions=scenarioExtension()?.sourceActions?.(s,{button,esc})||"";
    const actions = extensionActions|| (s.id==="s003-workbook"
      ? `${button("查看修订证据","revision-evidence","soft","history")}${button("查看来源内容核验证据","quality-evidence","","shield")}`
      : s.category === "共享文件夹" ? `${button("立即同步","folder-check","soft","refresh")}${button("编辑设置","source-settings","","settings",false,`data-id="${s.id}"`)}` : `${confirmAction}${button("上传新快照","upload-snapshot","soft","upload",false,`data-id="${s.id}"`)}${button("编辑设置","source-settings","","settings",false,`data-id="${s.id}"`)}`);
    const acquisition=scenarioExtension()?.sourceAcquisition?.(s)||null;
    return shell(`<div class="page" data-screen-label="数据源详情">${pageHeader(s.name, s.description, `<a class="btn" href="#/resources?shelf=sources">返回目录</a>${actions}`)}<section class="detail-hero"><div><span class="eyebrow">${esc(s.category)} · ${esc(s.access)}</span><h2>${esc(s.registration)}</h2><p>${esc(s.physicalEvidence || "尚未形成快照")}</p></div><div class="hero-facts">${fact("最近取得",s.latestAcquired)}${fact("当前数据截至",s.asOf)}${fact("快照总数",`${s.snapshotCount} 个`)}${fact(acquisition?.label||"同步计划",acquisition?.value||s.syncPlan)}</div></section>${topTabs(tabs,tab,"source-detail-tab")}${sourceDetailBody(s,tab)}</div>`, false);
  }
  function sourceDetailBody(s, tab) {
    const extended=scenarioExtension()?.renderSourceTab?.(s,tab,{esc,badge,fact,notice,button,emptyState,formatValue,nowText,icon});
    if(typeof extended==="string"){
      // S003 extends the native detail view. The baseline overview/content/history
      // remain visible; only explicit extension tabs render without a native body.
      if(tab==="overview")return `${sourceOverview(s)}${extended}`;
      if(tab==="content"&&s.sourceType==="manual-config")return extended;
      if(tab==="snapshots"||tab==="references"||tab==="settings"){
        const native=tab==="snapshots"?sourceSnapshots(s):tab==="references"?sourceReferences(s):sourceSettings(s);
        return `${native}${extended}`;
      }
      return extended;
    }
    if (tab === "content") return sourceContent(s);
    if (tab === "snapshots") return sourceSnapshots(s);
    if (tab === "references") return sourceReferences(s);
    if (tab === "settings") return sourceSettings(s);
    return sourceOverview(s);
  }
  function sourceOverview(s) {
    const s003 = s.id === "s003-workbook";
    const acquisition=scenarioExtension()?.sourceAcquisition?.(s)||null;
    const pipelineScheduleLink = acquisition?.pipelineHref ? `<div class="button-row"><a class="btn soft" href="${esc(acquisition.pipelineHref)}">${esc(acquisition.pipelineLabel || "前往管道设置运行计划")}</a></div>` : "";
    const plan = s.category === "共享文件夹" ? `<div class="plan-grid">${fact("当前模式",s.syncPlan)}${fact("时区","Asia/Shanghai")}${fact("上次同步",s.lastSync)}${fact("下次同步",s.nextSync)}${fact("状态","可启用或停用")}</div><div class="button-row">${button("立即同步","folder-check","soft","refresh")}${button("编辑同步计划","source-settings","","settings",false,`data-id="${s.id}"`)}</div>` : s.sourceType === "manual-business-input" ? `<div class="plan-grid">${fact("当前模式","系统在线填报")}${fact("保存语义","Draft")}${fact("发布语义","形成不可变输入快照")}${fact("最近结果",s.lastSync)}</div>` : s.sourceType === "manual-config" ? `<div class="plan-grid">${fact("当前模式","系统手工配置")}${fact("保存语义","Draft")}${fact("发布语义","形成不可变输入版本")}${fact("最近结果",s.lastSync)}</div>` : `<div class="plan-grid">${fact("来源取得",acquisition?.value||"按需上传新快照")}${fact("来源自动同步","不适用")}${fact("管道运行计划",acquisition?.pipelineSchedule||"在数据管道中配置")}${fact("最近取得",s.lastSync)}</div>${pipelineScheduleLink}`;
    const compatibility = s003 ? (() => {
      const managed = scenarioExtension()?.managesSource?.(s) === true;
      const stage = managed ? "S003 正式场景 · 已受控登记" : (s.compatibilityStatus?.authorityStage || "数据工程兼容性验证");
      const internal = managed ? "来源、人工输入与质量结果已登记" : (s.compatibilityStatus?.internalResult || "数据内容已确认 · 待受控发布验证");
      return `<section class="panel"><div class="panel-head"><div><span class="panel-title">来源核验状态</span><p>内容、结构、受控登记和消费状态</p></div>${badge(managed?"消费就绪":"兼容性核验",managed?"success":"neutral")}</div><div class="panel-body"><div class="summary-grid">${fact("权威阶段",stage)}${fact("数据工程内部状态",internal)}${fact("合同结构",s.compatibilityStatus?.contractCompatibility||"兼容")}${fact("下一责任方",s.compatibilityStatus?.nextOwner||"数据工程")}</div><div class="status-lanes"><div>${badge("已核验","success")}<strong>财务输入范围</strong><span>当前数据源和工作簿详情只包含财务数据；企业当期因子通过独立 T053 输入快照随运行绑定，调节系数、评分权重和风险阈值由 M01 模型配置维护。</span></div><div>${badge("已确认","success")}<strong>文件内容</strong><span>评估时点、币种、金额单位和 I / AA 财务字段口径已确认。</span></div><div>${badge(managed?"已登记":"未开始",managed?"success":"neutral")}<strong>受控登记与处理</strong><span>${managed?"财务快照、质量结果和正式资产均已登记。":"尚未登记财务来源、快照、质量结果或正式资产版本。"}</span></div><div>${badge(managed?"消费就绪":"不可消费",managed?"success":"neutral")}<strong>当前消费状态</strong><span>${managed?"正式数据资产已由 M01 Published 指针采用。":"核验文件不会进入数据资产目录或下游消费。"}</span></div></div>${notice(managed?"当前财务资产已获得本体管理正式采用证据；企业当期因子通过独立 T053 输入快照随运行绑定，调节系数、评分权重和风险阈值随 M01 Published 模型版本生效。":"当前只证明已取得文件的内容和结构可被合同表达。完成受控登记后才会形成首份快照。",managed?"success":"warning")}</div></section>`;
    })() : "";
    const financeSnapshot=currentFinanceSnapshot(),financeConfirmation=currentT008ForSnapshot(financeSnapshot);
    const financeConfirm=s.id==="finance-workbook"?(financeSnapshot?`${financeConfirmation?notice(`本轮快照的数据截至时间已确认为 ${financeConfirmation.asOf}，正式运行将锁定该快照和时点。`,"success","运行输入已就绪"):notice("本轮快照已经真实读取并登记，确认数据截至时间后才能发布定义并发起正式运行。","warning","还需确认时点")}<div class="button-row">${financeConfirmation?`<a class="btn primary" href="#/pipelines/finance-pipeline/canvas">进入融资管道</a>`:button("确认数据截至时间","confirm-snapshot","primary","check")}</div>`:`${notice(s.snapshotCount?"历史快照仍可追溯，但当前场景轮次尚未选择输入；请重新上传文件形成本轮读取证据。":"当前来源尚无快照；请上传完整工作簿并完成真实读取。","warning","本轮输入尚未形成")}<div class="button-row">${button("上传工作簿","upload-snapshot","primary","upload",false,`data-id="${s.id}"`)}</div>`):"";
    const selectedSnapshot=s003?null:currentSnapshotForSource(s.id);
    const sourceNotice=s003
      ? (scenarioExtension()?.managesSource?.(s) ? "文件已完成受控登记并形成当前场景快照；历史快照和下载证据保持可追溯。" : "文件已取得且内容已核验，但尚未受控登记为数据源快照；完成受控登记后才会形成首份快照记录。")
      : s.sourceType === "manual-business-input" ? "当前 Published 人工输入已形成不可变快照；继续编辑只改变 Draft，显式发布后才形成新输入版本。" : s.sourceType === "manual-config" ? "当前 Published 配置输入已形成不可变版本；后续保存、校验、发布和切换均不会覆盖历史版本。" : selectedSnapshot ? "本轮所选文件已作为快照保留。上传新文件会新增历史记录，不覆盖当前或更早快照。" : s.snapshotCount ? "历史快照仍可追溯，但当前场景轮次尚未选择输入；只有本轮真实上传或发现后才能进入管道。" : "来源已配置，成功读取文件后才会形成可选快照。";
    const displayedCurrentFile=s003?(s.fileName||"尚未取得核验文件"):(selectedSnapshot?.fileName||"本轮尚未选择");
    return `<div class="detail-grid"><div class="stack"><section class="panel"><div class="panel-head"><span class="panel-title">来源状态</span>${badge(s.registration,toneFor(s.registration))}</div><div class="panel-body"><div class="summary-grid">${fact("数据源名称",s.name)}${fact("来源分类",s.category)}${fact("接入方式",s.access)}${fact("快照",`${s.snapshotCount} 个`)}${fact(s003&&scenarioExtension()?.managesSource?.(s)?"当前快照文件":s003?"当前核验文件":"当前文件",displayedCurrentFile)}${fact("数据截至",s.asOf)}</div>${notice(sourceNotice,"info")}${financeConfirm}</div></section>${compatibility}</div><aside class="stack"><section class="panel"><div class="panel-head"><span class="panel-title">${esc(acquisition?.settingsTitle||"来源同步计划")}</span>${badge(acquisition?.value||s.syncPlan,s.category === "共享文件夹" ? "info" : "neutral")}</div><div class="panel-body">${plan}<p class="section-note">${esc(acquisition?.settingsDetail||"来源同步只负责取得文件、内容去重和形成快照，不代表管道成功、资产发布或消费就绪。")}</p></div></section>${s003 ? `<section class="panel"><div class="panel-head"><span class="panel-title">文件身份</span></div><div class="panel-body compact"><code>${esc(s.sha256)}</code><span>当前 SHA-256</span><code>${esc(s.previousSha256)}</code><span>修订前 SHA-256</span></div></section>` : ""}</aside></div>`;
  }
  function workbookFor(s) { return s.workbookKey ? D.workbooks[s.workbookKey] : null; }
  function selectedSheet(s) { const wb = workbookFor(s); if (!wb) return null; const id = ui.selectedSheet[s.id] || wb.sheets[0].id; return wb.sheets.find(x => x.id === id) || wb.sheets[0]; }
  function sourceContent(s) {
    const wb = workbookFor(s); if (!wb) return `<section class="panel"><div class="panel-body">${emptyState("尚无可查看内容", "共享文件夹尚未同步到匹配文件。", button("立即同步","folder-check","soft","refresh"))}</div></section>`;
    const s003=s.id==="s003-workbook";
    const snapshots=s.snapshots||[];
    const currentSnapshot=s003?null:currentSnapshotForSource(s.id);
    if(!s003&&!snapshots.length)return `<section class="panel"><div class="panel-body">${emptyState("尚无快照内容","上传工作簿或发现真实文件并完成登记后，系统才会展示读取到的结构、字段和有限样例。",button("上传工作簿","upload-snapshot","primary","upload",false,`data-id="${s.id}"`))}</div></section>`;
    if(!s003&&!currentSnapshot)return `<section class="panel"><div class="panel-body">${emptyState("本轮尚无快照内容","完成本轮真实上传或发现后，系统才会展示读取到的工作簿结构、字段和有限样例。",button("上传工作簿","upload-snapshot","primary","upload",false,`data-id="${s.id}"`))}</div></section>`;
    if(!s003&&currentSnapshot.structureStatus!=="结构已核验")return `<section class="panel"><div class="panel-body">${emptyState("当前快照结构尚未核验","文件身份和读取证据已保留，但不能使用参考附件的结构或样例代替本次真实核验。")}</div></section>`;
    let sheet = selectedSheet(s);
    const sheetScope=scenarioExtension()?.workbookSheetScope?.(s,wb)||null;
    const inputSheets = wb.sheets.filter(x => x.input !== false && (!sheetScope?.inputSheetIds || sheetScope.inputSheetIds.includes(x.id)));
    const excludedSheets = sheetScope?.hideExcludedSheets ? [] : wb.sheets.filter(x => x.input === false || (sheetScope?.inputSheetIds && !sheetScope.inputSheetIds.includes(x.id)));
    if(!inputSheets.some(item=>item.id===sheet?.id))sheet=inputSheets[0]||null;
    if(!sheet)return `<section class="panel"><div class="panel-body">${emptyState("当前来源没有可查看的管道输入成员","请核对来源注册与场景输入范围。")}</div></section>`;
    const s003Managed=s003&&scenarioExtension()?.managesSource?.(s)===true;
    const contentTitle=s003?(s003Managed?"正式快照内容":"已取得文件内容"):"快照内容";
    const contentPath=s003?(s003Managed?"按正式快照 → 逻辑成员 → 字段与样例逐层查看。":"按核验文件 → 逻辑成员 → 字段与样例逐层查看。"):"按快照 → 业务输入 Sheet → 字段与样例逐层查看。";
    const pickerLabel=s003?(s003Managed?"当前快照":"当前核验文件"):"当前快照";
    const pickerHint=s003?(s003Managed?"快照、数据截至、结构与有限样例已按当前场景身份锁定；历史记录不会被后续上传覆盖。":"文件修订后，结构和样例会同步切换；当前内容尚未登记为快照。"):"切换快照时，数据截至时间、结构和样例会一并切换。";
    const displayedFileName=s003?s.fileName:currentSnapshot.fileName;
    return `<section class="panel"><div class="panel-head"><div><span class="panel-title">${contentTitle}</span><p>${contentPath}</p></div>${badge(`${inputSheets.length} 个业务输入 Sheet`,"info")}</div><div class="panel-body"><div class="snapshot-picker"><label>${pickerLabel}</label><select><option>${esc(displayedFileName)} · ${esc(s003?"内容已核验":currentSnapshot.readCompletedAt||currentSnapshot.acquiredAt)}</option></select><span>${pickerHint}</span></div>${sheetScope?.excludedReason?notice(sheetScope.excludedReason,"info","当前输入范围"):""}<div class="workbook-browser"><aside><span class="eyebrow">工作簿</span><strong>${esc(displayedFileName)}</strong><small>${esc(wb.note)}</small><div class="sheet-list">${inputSheets.map(x => `<button class="sheet-item ${sheet.id === x.id ? "active" : ""}" data-action="select-sheet" data-source="${s.id}" data-sheet="${x.id}"><span>${esc(x.name)}</span><small>${x.rows} 条 · ${x.cols} 列 · 表头第 ${x.headerRow} 行</small></button>`).join("")}</div>${excludedSheets.length ? `<div class="excluded-sheets"><span>未纳入当前管道输入</span>${excludedSheets.map(x=>`<small>${esc(x.name)}</small>`).join("")}</div>` : ""}</aside><div class="sheet-detail"><div class="sheet-title"><div><span class="eyebrow">${esc(sheet.classification)}</span><h3>${esc(sheet.name)}</h3></div><div>${badge(sheet.range,"plain")}${badge(`${sheet.rows} 条 · ${sheet.cols} 列`,"info")}</div></div><div class="content-subtabs"><span>字段结构</span><strong>${sheet.fields.length} 个字段</strong></div><div class="field-table-wrap"><table class="data-table"><thead><tr><th>#</th><th>字段名称</th><th>推断类型</th><th>空值概况</th><th>来源位置</th></tr></thead><tbody>${sheet.fields.map((f,i) => `<tr><td>${i+1}</td><td><strong>${esc(f)}</strong></td><td>${fieldType(f)}</td><td>${s003 && sheet.id === "s003-factors" && f === "电价波动率" ? "4 个业务不适用空值" : s003?"已核验文件统计":"随当前快照统计"}</td><td>${esc(sheet.name)} · 第 ${i+1} 列</td></tr>`).join("")}</tbody></table></div><div class="content-subtabs"><span>数据样例</span><strong>最多 5 行</strong></div>${sampleTable(sheet)}</div></div></div></section>`;
  }
  function sampleTable(sheet) { return `<div class="data-table-wrap sample-table"><table class="data-table"><thead><tr>${sheet.sampleColumns.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${sheet.samples.map(row => `<tr>${row.map(v => `<td>${esc(formatValue(v))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`; }
  function sourceSnapshots(s) {
    if(s.id==="s003-workbook"&&!scenarioExtension()?.managesSource?.(s)) return `<section class="panel"><div class="panel-head"><div><span class="panel-title">快照历史</span><p>这里只展示已完成受控登记的快照；核验文件不会冒充正式快照。</p></div>${badge("0 个快照","neutral")}</div><div class="panel-body">${emptyState("尚未形成受控快照","文件已取得且内容已核验。完成受控登记后，首份快照才会出现在这里。")}${notice("当前核验文件、修订前后哈希和内容检查可从“概览”查看；本阶段不提供普通上传或管道运行入口。","info")}</div></section>`;
    const snapshots = s.snapshots || [];
    const latestReadEvent=[...flow.snapshotReadEvents].reverse().find(event=>event.sourceId===s.id&&sameScenarioContext(event.scenarioContext,flow.scenarioContext))||null;
    const rows = snapshots.map((x,index)=>{
      const historicalConfirmations=Array.isArray(x.t008Confirmations)?x.t008Confirmations:[];
      const confirmation=x.current?(currentT008ForSnapshot(x)||x.t008Confirmation||null):(historicalConfirmations.at(-1)||x.t008Confirmation||null);
      const missingConfirmation=x.current?"本轮尚未确认":"历史未记录",effectiveAsOf=confirmation?.asOf||(s.id==="s003-workbook"?x.asOf:x.current?"待确认":x.asOf||"历史未记录");
      const downloadLabel=s.sourceType==="manual-config"?"下载配置版本":"下载数据表";
      const download = x.downloadUrl ? `<a class="btn soft" download href="${esc(x.downloadUrl)}">${downloadLabel}</a>` : `<button class="btn soft" data-action="toast-only" data-message="该快照未附带可下载的本地文件证据">${downloadLabel}</button>`;
      return `<article class="snapshot-row"><div class="snapshot-file"><span class="source-icon">${icon("file")}</span><div><strong>${esc(x.fileName)}</strong><small>${esc(x.scope)}</small></div></div><div>${fact("读取完成",x.readCompletedAt||x.acquiredAt)}${fact("数据截至",effectiveAsOf)}</div><div>${fact("文件大小",x.size)}${fact("读取耗时",Number.isFinite(x.readDurationMs)?`${x.readDurationMs} 毫秒`:"历史记录")}</div><div class="snapshot-state">${badge(x.current?"本轮已选择":`历史快照 ${index+1}`,x.current?"info":"neutral")}${badge(x.status,toneFor(x.status))}${download}</div><details class="snapshot-evidence"><summary>查看快照身份与确认依据</summary><div class="summary-grid">${fact("原始快照标识",x.t002Id||x.snapshotId)}${fact("读取开始",x.readStartedAt||"历史未记录")}${fact("读取完成",x.readCompletedAt||x.acquiredAt)}${fact("SHA-256",x.hash)}${fact("确认场景轮次",confirmation?.scenarioContext?.scenarioRunId||x.scenarioContext?.scenarioRunId||missingConfirmation)}${fact("确认人",confirmation?.confirmedBy||missingConfirmation)}${fact("确认时间",confirmation?.confirmedAt||missingConfirmation)}${fact("确认依据",confirmation?.basis||missingConfirmation)}</div></details></article>`;
    }).join("");
    const action = s.category === "共享文件夹" ? button("立即同步","folder-check","soft","refresh") : s.sourceType==="manual-business-input" ? `<a class="btn soft" href="#/resources/source/${esc(s.id)}?tab=factors">打开在线填报</a>` : s.sourceType==="manual-config" ? `<a class="btn soft" href="#/resources/source/${esc(s.id)}?tab=config">打开配置编辑</a>` : button("上传新快照","upload-snapshot","soft","upload",false,`data-id="${s.id}"`);
    const readEvidence=latestReadEvent?.duplicate?notice(`本轮已于 ${latestReadEvent.readCompletedAt} 真实读取 ${latestReadEvent.fileName} 并计算 SHA-256；内容与 ${latestReadEvent.snapshotId} 相同，因此复用原始快照身份，同时保留本次读取事件 ${latestReadEvent.eventId}。`,"info","重复内容读取证据"):"";
    return `<section class="panel"><div class="panel-head"><div><span class="panel-title">快照历史</span><p>新内容形成不可变快照；重复内容复用已有快照身份并单独保留本轮读取事件。</p></div><div class="button-row">${badge(`${snapshots.length} 个快照`,snapshots.length?"info":"neutral")}${action}</div></div><div class="panel-body">${readEvidence}${rows ? `<div class="snapshot-history">${rows}</div>` : emptyState("尚无快照", "上传工作簿或同步共享文件夹后，新内容会按取得时间追加在这里。", action)}${notice("数据截至时间属于单个快照。新快照到达后，目录摘要切换到当前快照的截至时间；旧快照及其截至时间保持不变。","info")}</div></section>`;
  }
  function sourceReferences(s) {
    const pipelines = s.pipelineRefs || []; const assets = s.downstreamAssets || [];
    return `<div class="reference-sections"><section class="panel"><div class="panel-head"><span class="panel-title">当前管道引用</span>${badge(`${pipelines.length} 条`,pipelines.length?"info":"neutral")}</div><div class="panel-body">${pipelines.length ? pipelines.map(p => {const registered=D.pipelines.find(item=>item.id===p.pipelineId);const href=registered?.canOpen?`#/pipelines/${p.pipelineId}/canvas`:`#/resources/source/${s.id}?tab=overview`;return `<div class="reference-row"><div><strong>${esc(p.name)}</strong><p>${esc(p.definition)} · 节点：${esc(p.node)}</p></div><div>${fact("最近正式运行",p.lastRun)}</div><a class="text-link" href="${href}">${registered?.canOpen?"进入管道画布":"查看来源状态"} ${icon("chevron")}</a></div>`;}).join("") : emptyState("没有管道引用", "创建并保存管道定义后会形成引用。")}</div></section><section class="panel"><div class="panel-head"><span class="panel-title">下游已发布资产</span>${badge(`${assets.length} 个版本`,assets.length?"success":"neutral")}</div><div class="panel-body">${assets.length ? assets.map(a => {const target=D.targetAssets.find(item=>item.name===a.name||item.currentVersion===a.version);return `<div class="reference-row"><div><strong>${esc(a.name)}</strong><p>${esc(a.version)} · ${esc(a.status)}</p></div><a class="text-link" href="#/resources/asset/${esc(target?.id||"finance-asset-target")}?tab=lineage">查看沿袭 ${icon("chevron")}</a></div>`;}).join("") : emptyState("没有已发布资产版本", "运行通过质量门并执行发布后，资产沿袭会在此出现。")}</div></section></div>`;
  }
  function sourceSettings(s) {
    const shared = s.category === "共享文件夹";
    const manualConfig = s.sourceType === "manual-config";
    const acquisition=scenarioExtension()?.sourceAcquisition?.(s)||null;
    const pipelineScheduleLink = acquisition?.pipelineHref ? `<a class="btn soft" href="${esc(acquisition.pipelineHref)}">${esc(acquisition.pipelineLabel || "前往管道设置运行计划")}</a>` : "";
    return `<div class="detail-grid"><section class="panel"><div class="panel-head"><span class="panel-title">数据源设置</span>${badge("可编辑","info")}</div><div class="panel-body form-grid"><label class="field"><span>数据源名称</span><input id="source-setting-name" value="${esc(s.name)}" /></label><label class="field span-2"><span>说明</span><textarea id="source-setting-description">${esc(s.description)}</textarea></label>${shared ? `<label class="field span-2"><span>可持续访问目录</span><input id="source-setting-folder" value="${esc(s.folderPath)}" /></label><label class="field"><span>文件匹配规则</span><input id="source-setting-pattern" value="${esc(s.filePattern)}" /></label>` : ""}</div></section><section class="panel"><div class="panel-head"><span class="panel-title">${esc(acquisition?.settingsTitle||"来源同步计划")}</span>${badge(shared?"仅手工同步":acquisition?.value||(manualConfig?"手工配置":"按需上传"),"neutral")}</div><div class="panel-body">${shared ? syncPlanForm(s) : acquisition ? notice(acquisition.settingsDetail,"info") : manualConfig ? notice("配置输入通过专用“配置编辑”页签保存 Draft、校验、发布和切换；不上传 Python 配置文件。","info") : notice("手工工作簿不定时同步；用户通过“上传新快照”提交下一份完整全量文件。","info")}<div class="button-row">${pipelineScheduleLink}${button("保存设置","save-source-settings","primary","save",false,`data-source-id="${esc(s.id)}"`)}</div></div></section></div>`;
  }
  function syncPlanForm(s) { return `${notice("一期不配置定时扫描；需要检查共享文件夹时，由用户手工触发同步。","info")}<div class="summary-grid">${fact("当前模式","仅手工同步")}${fact("时区","Asia/Shanghai")}${fact("上次同步",flow.folderSyncAt||s.lastSync||"尚未执行")}${fact("下次同步","无自动计划")}${fact("目录状态",s.enabled===false?"停用":"可访问")}${fact("最近结果",flow.folderSyncAt?"未发现新文件":"尚未执行")}</div><div class="button-row">${button("立即同步","folder-check","soft","refresh")}</div>`; }

  function assetProductionHref(asset,version,focus="publish") {
    const run=flow.runs.find(x=>x.id===version?.runId),pipelineId=run?.pipelineId||publishedDefinition(version?.definitionVersion)?.pipelineId;
    if(!version||!run||!pipelineId||run.definitionVersion!==version.definitionVersion||run.assetVersion!==version.id)return "";
    return `#/pipelines/${encodeURIComponent(pipelineId)}/canvas?definition=${encodeURIComponent(version.definitionVersion)}&run=${encodeURIComponent(run.id)}&assetVersion=${encodeURIComponent(version.id)}&focus=${encodeURIComponent(focus)}&returnAsset=${encodeURIComponent(asset.id)}`;
  }
  function assetVersionRole(version,latest,authority,candidate,previous) {
    if(version?.id===authority?.id)return ["当前正式消费","success"];
    if(version?.id===candidate?.id)return ["候选待采用","warning"];
    if(version?.id===previous?.id)return ["上一可信版本","neutral"];
    if(version?.id===latest?.id)return ["最新发布","info"];
    return ["历史发布版本","neutral"];
  }
  function c003DeliveryEvidencePanelLegacy(version,{compact=false}={}) {
    const records=c003DeliveryRecords(version),latest=records.at(-1)||null,gate=dataAssetDeliveryGate(version),payload=latest?.payload||null,receipt=latest?.receipt||null,targetDraftBinding=latest?.targetDraftBinding||c003TargetDraftBinding(latest?.targetDraft,receipt,payload),context=parseScenarioContextCandidate(payload?.scenarioContext||version?.scenarioContext),canAct=version?.id===flow.candidateVersionId&&sameScenarioContext(version?.scenarioContext,flow.scenarioContext);
    if(!latest)return `<section class="panel c003-evidence-panel"><div class="panel-head"><div><span class="panel-title">数据资产交付 M01</span><p>发布版本形成后，数据工程会把精确资产合同交给本体管理；发送动作本身不代表 M01 已接收。</p></div>${badge("尚未发送","neutral")}</div><div class="panel-body">${notice("尚无 C003 交付尝试。数据资产版本保持候选不可消费，也不能提交本体刷新请求。","warning")}</div></section>`;
    const stateLabel=gate.okay?"M01 已接收":latest.currentVerification?.status||latest.status||"待核对",stateTone=gate.okay?"success":latest.receipt?.status==="rejected"||/拒绝|阻断/.test(latest.status||"")?"danger":"warning";
    const attempts=`<details class="c003-attempt-history" ${records.length>1?"open":""}><summary>交付尝试记录（${records.length}）</summary><div class="c003-attempt-list">${records.map((record,index)=>`<article class="c003-attempt ${record.deliveryId===latest.deliveryId?"current":""}"><div><span class="eyebrow">尝试 ${String(record.attemptNumber||index+1).padStart(2,"0")}${record.deliveryId===latest.deliveryId?" · 当前":""}</span><strong class="mono">${esc(record.deliveryId)}</strong><small>发送 ${esc(record.payload?.deliveredAt||record.submittedAt||"未记录")} · ${esc(record.payloadFingerprint||record.payload?.payloadFingerprint||"未记录载荷指纹")}</small></div>${badge(record.currentVerification?.status||record.status||"待核对",record.runtimeVerificationId===C003_RUNTIME_VERIFICATION_ID&&record.currentVerification?.status==="已验证接收"?"success":record.receipt?.status==="rejected"?"danger":"warning")}<div>${fact("原尝试引用",record.retryOf||"首次尝试")}${fact("M01 回执",record.receipt?.status||record.receiptStatus||"尚未取得")}${fact("目标 Draft",record.receipt?.targetDraftId||"尚未取得")}${fact("接收时间",record.receipt?.receivedAt||"尚未取得")}</div></article>`).join("")}</div></details>`;
    const issue=gate.okay?notice(`M01 的已接收合同、同标识完整回执、同轮 C033，以及目标 Draft 对本次交付与精确资产版本的绑定证据，已于 ${latest.currentVerification?.checkedAt||receipt?.receivedAt} 联合核对。已证明四成员合同被 M01 持久化；成员选择器是否实际显示四成员仍须在 M01 页面核验。`,"success","联合证据通过"):notice(`${latest.failureReason||"尚未取得 M01 持久化联合证据"}。恢复：${latest.recovery||"重新读取；必要时按证据幂等重放原标识或创建新尝试"}`,stateTone==="danger"?"danger":"warning","当前不可继续刷新");
    const actions=canAct?`<div class="button-row">${button("重新读取 M01 接收证据","recheck-c003-delivery","soft","refresh",false,`data-asset-version-id="${esc(version.id)}"`)}${gate.okay?"":button("按证据恢复 C003 交付","retry-c003-delivery","primary","refresh",c003RetryInFlight,`data-asset-version-id="${esc(version.id)}"`)}</div>${notice("恢复前先重读：明确拒绝、历史误标或旧载荷不完整时保留原记录并新建尝试；无接收记录且冻结载荷完整时按原标识幂等重放；部分证据冲突时停止发送并要求核对。","info","恢复策略")}`:"";
    return `<section class="panel c003-evidence-panel ${compact?"compact":""}"><div class="panel-head"><div><span class="panel-title">数据资产交付 M01</span><p>只有 M01 持久化合同、完整回执、同轮场景和目标 Draft 绑定证据同时成立，才显示“已接收”。</p></div>${badge(stateLabel,stateTone)}</div><div class="panel-body"><div class="c003-evidence-grid">${fact("当前交付标识",latest.deliveryId)}${fact("精确数据资产版本",payload?.assetVersion||version.id)}${fact("数据截至",payload?.asOf||version.asOf)}${fact("发送时间",payload?.deliveredAt||latest.submittedAt)}${fact("交付结构",`${payload?.members?.length||0} 个成员 · ${payload?.relations?.length||0} 条关系`)}${fact("来源快照",payload?.sourceSnapshotId||version.sourceSnapshotId||"未记录")}${fact("来源 SHA-256",payload?.sourceFingerprint?.value||version.sourceHash||"未记录")}${fact("来源文件大小",Number.isFinite(Number(payload?.sourceFingerprint?.sizeBytes))?`${new Intl.NumberFormat("zh-CN").format(Number(payload.sourceFingerprint.sizeBytes))} 字节`:"未记录")}${fact("M01 目标 Draft",receipt?.targetDraftId?`${receipt.targetDraftId} · R${receipt.targetDraftRevision}`:"尚未取得")}${fact("Draft 绑定交付",targetDraftBinding.sourceDeliveryId||"快照未提供")}${fact("Draft 绑定资产版本",targetDraftBinding.sourceAssetVersion||"快照未提供")}</div><details class="contract-identifiers" open><summary>查看完整场景与接收证据</summary><div class="c003-contract-proof"><span><b>场景</b><small>${esc(context?.scenarioId||"缺失")} / ${esc(context?.scenarioVersion||"缺失")}</small></span><span><b>场景轮次</b><small class="mono">${esc(context?.scenarioRunId||"缺失")}</small></span><span><b>形成时间</b><small>${esc(context?.formedAt||"缺失")}</small></span><span><b>场景状态</b><small>${esc(context?.status||"缺失")}</small></span><span><b>M01 C033 根回执</b><small>${esc(latest.c033Receipt?.contextId||"尚未取得")} · ${esc(latest.c033Receipt?.status||"未接收")}${latest.c033Receipt?.receivedAt?` · ${esc(latest.c033Receipt.receivedAt)}`:""}</small></span><span><b>M01 已接收合同</b><small>${latest.acceptedContract?`${latest.acceptedContract.members?.length||0} 成员 · ${latest.acceptedContract.relations?.length||0} 关系`:"尚未定位"}</small></span><span><b>M01 完整回执</b><small>${esc(receipt?.status||"尚未取得")} · ${esc(latest.receiptStatus||"待核对")}</small></span><span><b>目标 Draft 绑定</b><small>${esc(targetDraftBinding.sourceDeliveryId||"交付标识未提供")} · ${esc(targetDraftBinding.sourceAssetVersion||"资产版本未提供")} · ${Number.isInteger(targetDraftBinding.draftRevision)?`R${targetDraftBinding.draftRevision}`:"修订号未提供"}</small></span><span><b>载荷指纹</b><small class="mono">${esc(latest.payloadFingerprint||payload?.payloadFingerprint||"未记录")}</small></span></div></details>${issue}${actions}${attempts}<p class="section-note">发送成功、postMessage 返回或页面提示均不能单独证明 M01 已接收；当前候选 ${esc(version.id)} 在联合证据通过前保持不可消费。</p></div></section>`;
  }
  function c033EvidenceCard(title,context,meta,tone="neutral") {
    const value=parseScenarioContextCandidate(context);
    return `<article class="c033-evidence-card ${tone}"><div class="c033-evidence-head"><strong>${esc(title)}</strong>${badge(value?"五字段完整":"不可定位",value?tone:"danger")}</div><small>${esc(meta||"未记录读取来源")}</small><dl><div><dt>场景</dt><dd>${esc(value?.scenarioId||"缺失")}</dd></div><div><dt>场景版本</dt><dd>${esc(value?.scenarioVersion||"缺失")}</dd></div><div class="wide"><dt>工作轮次</dt><dd class="mono">${esc(value?.scenarioRunId||"缺失")}</dd></div><div><dt>形成时间</dt><dd>${esc(value?.formedAt||"缺失")}</dd></div><div><dt>状态</dt><dd>${esc(value?.status||"缺失")}</dd></div></dl></article>`;
  }
  function c003DeliveryEvidencePanel(version,{compact=false}={}) {
    const records=c003DeliveryRecords(version),latest=records.at(-1)||null,run=versionRun(version),gate=dataAssetDeliveryGate(version),adoptionProjection=trustedFormalAdoptionProjection(version,run),scenarioContract=gate.scenarioContract||c003ScenarioContractState(version,run,latest),payload=latest?.payload||null,receipt=latest?.receipt||null,targetDraftBinding=latest?.targetDraftBinding||c003TargetDraftBinding(latest?.targetDraft,receipt,payload),canAct=version?.id===flow.candidateVersionId&&sameScenarioContext(version?.scenarioContext,flow.scenarioContext),contractConflict=scenarioContract.contractConflict;
    if(!latest&&adoptionProjection.okay)return `<section class="panel c003-evidence-panel"><div class="panel-head"><div><span class="panel-title">数据资产交付 M01</span><p>当前投影只回溯精确 Published 正式采用结果，不补造早期交付请求或回执编号。</p></div>${badge("正式采用证据可定位","success")}</div><div class="panel-body"><div class="summary-grid">${fact("数据资产版本",version.id)}${fact("正式采用证据",adoptionProjection.evidenceId)}${fact("本体绑定",version.t019BindingId||adoptionProjection.evidenceId)}${fact("采用时间",version.adoptedAt||"已由 Published 指针锁定")}</div>${notice("运行、数据资产、权威版本、刷新目标、Published 指针、同轮场景和 T019 证据已精确一致。详细 C003 发送与接收编号未纳入当前只读投影，系统没有补造历史请求号；任何新候选仍须重新通过 C003/C032。","success","历史闭环证据")}</div></section>`;
    if(!latest)return `<section class="panel c003-evidence-panel"><div class="panel-head"><div><span class="panel-title">数据资产交付 M01</span><p>发布版本形成后，数据工程会把精确资产合同交给本体管理；发送动作本身不代表 M01 已接收。</p></div>${badge("尚未发送","neutral")}</div><div class="panel-body">${notice("尚无 C003 交付尝试。数据资产版本保持候选不可消费，也不能提交本体刷新请求。","warning")}</div></section>`;
    const stateLabel=gate.okay?"M01 已接收":contractConflict?"合同冲突 · 待总控裁决":latest.currentVerification?.status||latest.status||"待核对",stateTone=gate.okay?"success":contractConflict||latest.receipt?.status==="rejected"||/拒绝|阻断/.test(latest.status||"")?"danger":"warning";
    const attempts=`<details class="c003-attempt-history" ${records.length>1?"open":""}><summary>交付尝试记录（${records.length}）</summary><div class="c003-attempt-list">${records.map((record,index)=>`<article class="c003-attempt ${record.deliveryId===latest.deliveryId?"current":""}"><div><span class="eyebrow">尝试 ${String(record.attemptNumber||index+1).padStart(2,"0")}${record.deliveryId===latest.deliveryId?" · 当前":""}</span><strong class="mono">${esc(record.deliveryId)}</strong><small>发送 ${esc(record.payload?.deliveredAt||record.submittedAt||"未记录")} · ${esc(record.payloadFingerprint||record.payload?.payloadFingerprint||"未记录载荷指纹")}</small></div>${badge(contractConflict&&record.deliveryId===latest.deliveryId?"待总控裁决":record.currentVerification?.status||record.status||"待核对",record.runtimeVerificationId===C003_RUNTIME_VERIFICATION_ID&&record.currentVerification?.status==="已验证接收"?"success":record.receipt?.status==="rejected"||contractConflict&&record.deliveryId===latest.deliveryId?"danger":"warning")}<div>${fact("原尝试引用",record.retryOf||"首次尝试")}${fact("M01 回执",record.receipt?.status||record.receiptStatus||"尚未取得")}${fact("目标 Draft",record.receipt?.targetDraftId||"尚未取得")}${fact("接收时间",record.receipt?.receivedAt||"尚未取得")}</div></article>`).join("")}</div></details>`;
    const comparison=`<section class="c033-comparison"><div class="c033-comparison-head"><div><span class="eyebrow">C033 轮次对照</span><h3>平台当前工作轮次与资产生产轮次</h3></div>${badge(contractConflict?"不一致":"一致",contractConflict?"danger":"success")}</div><div class="c033-evidence-pair">${c033EvidenceCard("平台当前工作轮次",scenarioContract.platformContext,`${scenarioContract.platformSource||"平台公共层"} · 读取 ${scenarioContract.platformObservedAt||"未记录"}`,contractConflict?"danger":"success")}${c033EvidenceCard("T007 / 正式运行生产轮次",scenarioContract.productionContext,`${version.id} · ${run?.id||"正式运行不可定位"}`,contractConflict?"warning":"success")}</div>${contractConflict?notice(`现行 C003/C033 要求正式运行、T007、交付和回执原样传播同一工作轮次。${version.id} 与 ${run?.id||"正式运行"} 保持原生产轮次，不能改写为平台当前轮次；${latest.deliveryId} 已冻结保留，不会自动生成 A03。若坚持免重跑，须先由总控裁决并接受“历史 T007 跨轮导入交付”合同。`,"danger","合同冲突，需要总控裁决"):notice("平台公共 C033、正式运行、T007 与本次交付属于同一工作轮次，可以继续核对 M01 持久化回执。","success","轮次一致")}</section>`;
    const issue=gate.okay?notice(`M01 的已接收合同、同标识完整回执、同轮 C033，以及目标 Draft 对本次交付与精确资产版本的绑定证据，已于 ${latest.currentVerification?.checkedAt||receipt?.receivedAt} 联合核对。`,"success","联合证据通过"):notice(`${gate.reason||latest.failureReason||"尚未取得 M01 持久化联合证据"}。恢复：${contractConflict?"保留旧运行、T007 和 A02，等待总控裁决；不要重发或创建 A03":latest.recovery||"重新读取；仅在完整正式拒绝回执要求新尝试时创建后续尝试"}`,stateTone==="danger"?"danger":"warning",contractConflict?"当前不可跨轮交付":"当前不可继续刷新");
    const actions=canAct?`<div class="button-row">${button("重新读取 M01 接收或拒绝证据","recheck-c003-delivery","soft","refresh",c003RetryInFlight,`data-asset-version-id="${esc(version.id)}"`)}${contractConflict?button("等待总控裁决","toast-only","","alert",true,'data-message="现行合同未授权跨轮次重交付，已阻止生成 A03"'):gate.okay?"":button("按证据恢复 C003 交付","retry-c003-delivery","primary","refresh",c003RetryInFlight,`data-asset-version-id="${esc(version.id)}"`)}</div>${notice(contractConflict?"当前只允许重新读取 M01 证据；不得重放 A02、改写旧轮次或生成 A03。":"恢复前先重读：从未被 M01 接收且未被错误标为成功的首个尝试按原标识幂等重放；历史误标或旧载荷不完整时保留原尝试并形成 A02；A02 没有完整正式拒绝回执时只允许继续重读，不会盲目生成 A03。","info","恢复边界")}`:"";
    return `<section class="panel c003-evidence-panel ${compact?"compact":""}"><div class="panel-head"><div><span class="panel-title">数据资产交付 M01</span><p>只有 M01 持久化合同、完整回执、同轮场景和目标 Draft 绑定证据同时成立，才显示“已接收”。</p></div>${badge(stateLabel,stateTone)}</div><div class="panel-body">${comparison}<div class="c003-evidence-grid">${fact("当前交付标识",latest.deliveryId)}${fact("精确数据资产版本",payload?.assetVersion||version.id)}${fact("数据截至",payload?.asOf||version.asOf)}${fact("发送时间",payload?.deliveredAt||latest.submittedAt)}${fact("交付结构",`${payload?.members?.length||0} 个成员 · ${payload?.relations?.length||0} 条关系`)}${fact("来源快照",payload?.sourceSnapshotId||version.sourceSnapshotId||"未记录")}${fact("来源 SHA-256",payload?.sourceFingerprint?.value||version.sourceHash||"未记录")}${fact("来源文件大小",Number.isFinite(Number(payload?.sourceFingerprint?.sizeBytes))?`${new Intl.NumberFormat("zh-CN").format(Number(payload.sourceFingerprint.sizeBytes))} 字节`:"未记录")}${fact("M01 目标 Draft",receipt?.targetDraftId?`${receipt.targetDraftId} · R${receipt.targetDraftRevision}`:"尚未取得")}${fact("Draft 绑定交付",targetDraftBinding.sourceDeliveryId||"快照未提供")}${fact("Draft 绑定资产版本",targetDraftBinding.sourceAssetVersion||"快照未提供")}</div><details class="contract-identifiers" open><summary>查看 M01 联合接收证据</summary><div class="c003-contract-proof"><span><b>M01 C033 根回执</b><small>${esc(latest.c033Receipt?.contextId||"尚未取得")} · ${esc(latest.c033Receipt?.status||"未接收")}${latest.c033Receipt?.receivedAt?` · ${esc(latest.c033Receipt.receivedAt)}`:""}</small></span><span><b>M01 已接收合同</b><small>${latest.acceptedContract?`${latest.acceptedContract.members?.length||0} 成员 · ${latest.acceptedContract.relations?.length||0} 关系`:"尚未定位"}</small></span><span><b>M01 完整回执</b><small>${esc(receipt?.status||"尚未取得")} · ${esc(latest.receiptStatus||"待核对")}</small></span><span><b>目标 Draft 绑定</b><small>${esc(targetDraftBinding.sourceDeliveryId||"交付标识未提供")} · ${esc(targetDraftBinding.sourceAssetVersion||"资产版本未提供")} · ${Number.isInteger(targetDraftBinding.draftRevision)?`R${targetDraftBinding.draftRevision}`:"修订号未提供"}</small></span><span><b>载荷指纹</b><small class="mono">${esc(latest.payloadFingerprint||payload?.payloadFingerprint||"未记录")}</small></span></div></details>${issue}${actions}${attempts}<p class="section-note">发送成功、postMessage 返回或页面提示均不能单独证明 M01 已接收；当前候选 ${esc(version.id)} 在联合证据通过前保持不可消费。</p></div></section>`;
  }
  function assetDetail(id) {
    const a=D.targetAssets.find(x=>x.id===id&&x.published);if(!a)return notFound();
    const requestedTab=route().params.get("tab")||"overview",tab=requestedTab==="versions"?"overview":requestedTab,versions=versionsForAsset(a),latest=versions.at(-1)||null,requestedVersionId=route().params.get("version"),selected=versions.find(v=>v.id===requestedVersionId)||latest;
    if(!selected)return notFound();
    const authority=authorityVersionForAsset(a),previous=previousAuthorityVersionForAsset(a),candidate=candidateVersionForAsset(a),members=selected.members?.length?selected.members:a.members,relationships=selected.relationships?.length?selected.relationships:(a.relationshipContracts||a.relationships||[]),role=assetVersionRole(selected,latest,authority,candidate,previous),productionHref=assetProductionHref(a,selected);
    const tabs=[["overview","版本概览"],["members","包含的数据"],["lineage","如何产生"],["consumption","如何变为可用"]];
    const versionHeader=`<section class="asset-version-header"><div><span class="eyebrow">正在查看的数据资产版本</span><h2>${esc(selected.id)}</h2><p>数据截至 ${esc(selected.asOf)} · 发布于 ${esc(selected.publishedAt)}。新数据会形成新版本，这条发布记录不会被覆盖。</p></div><div class="asset-version-status">${badge(role[0],role[1])}${badge(`质量${selected.quality}`,toneFor(selected.quality))}${badge(selected.id===authority?.id?"正在给下游使用":"未被下游正式采用",selected.id===authority?.id?"success":"neutral")}</div><div class="asset-version-actions">${productionHref?`<a class="btn primary" href="${productionHref}">${icon("workflow")}<span>查看生产画布</span></a>`:button("生产画布不可定位","toast-only","", "alert",true,'data-message="该版本的定义、运行与资产版本无法组成一致证据"')}</div></section>`;
    const versionHistory=`<section class="panel"><div class="panel-head"><div><span class="panel-title">发布版本记录</span><p>每次发布都会新增一条记录；选择某条记录后，页面只展示该版本自己的来源、质量和刷新证据。</p></div>${badge(`${versions.length} 个版本`,"info")}</div><div class="panel-body"><div class="asset-version-list">${[...versions].reverse().map(v=>{const itemRole=assetVersionRole(v,latest,authority,candidate,previous);return `<article class="asset-version-row ${v.id===selected.id?"selected":""}"><div><div class="role-badges">${badge(itemRole[0],itemRole[1])}</div><strong>${esc(v.id)}</strong><small>数据截至 ${esc(v.asOf)} · 发布于 ${esc(v.publishedAt)}</small></div><div>${fact("质量",v.quality)}${fact("消费状态",v.id===authority?.id?"消费就绪":"不可正式消费")}</div><a class="btn soft" href="#/resources/asset/${esc(a.id)}?tab=overview&version=${encodeURIComponent(v.id)}">查看此版本</a></article>`;}).join("")}</div></div></section>`;
    let body="";
    if(tab==="members"){
      body=`<section class="panel"><div class="panel-head"><div><span class="panel-title">${members.length} 个数据成员</span><p>成员说明一份资产内部包含哪些可独立复用的数据集合；关系说明这些集合如何通过稳定键对应。</p></div>${badge(`${relationships.length} 条数据关系`,"info")}</div><div class="panel-body"><div class="member-grid">${members.map((m,i)=>`<article><span class="eyebrow">成员 ${String(i+1).padStart(2,"0")}</span><h3>${esc(m.name)}</h3>${fact("一行代表",m.grain)}${fact("唯一识别字段",m.key)}${fact("记录数",m.rowCount??"未记录")}<details class="contract-identifiers"><summary>查看成员编号</summary><small>${esc(m.stableId||"历史证据未记录")}</small></details></article>`).join("")}</div><div class="asset-relationship-flow">${relationships.map(x=>`<span>${icon("link")}<strong>${esc(relationLabel(x))}</strong><small>通过成员中的稳定键建立数据层对应</small></span>`).join("")}</div>${notice("这里展示的是数据资产内部关系，不是本体中的业务关系；业务对象和关系只能在本体管理中建立。","info")}</div></section>`;
    }else if(tab==="lineage"){
      const run=flow.runs.find(x=>x.id===selected.runId),source=D.sources.find(x=>x.snapshots?.some(s=>s.fileName===selected.sourceSnapshot||s.snapshotId===run?.inputs?.[0]?.version))||financeSource();
      const pythonHref=assetProductionHref(a,selected,"python"),qualityHref=assetProductionHref(a,selected,"quality"),publishHref=assetProductionHref(a,selected,"publish");
      body=`<section class="panel"><div class="panel-head"><div><span class="panel-title">这份资产是怎样产生的</span><p>以下步骤全部对应 ${esc(selected.id)}，不会跳到最新文件、其他定义或其他运行。</p></div>${badge(productionHref?"证据可定位":"证据不完整",productionHref?"success":"danger")}</div><div class="panel-body"><div class="production-flow"><a href="#/resources/source/${esc(source?.id||"finance-workbook")}?tab=snapshots"><span class="flow-number">1</span>${icon("file")}<strong>来源快照</strong><small>${esc(selected.sourceSnapshot||"未记录")}</small><em>查看快照</em></a><a href="${pythonHref||"#"}" class="${pythonHref?"":"disabled"}"><span class="flow-number">2</span>${icon("workflow")}<strong>Python 处理</strong><small>${esc(selected.definitionVersion)} · ${esc(selected.runId)}</small><em>在画布中查看</em></a><a href="${qualityHref||"#"}" class="${qualityHref?"":"disabled"}"><span class="flow-number">3</span>${icon("shield")}<strong>正式质量检查</strong><small>${esc(selected.quality)} · 0 个硬失败</small><em>在画布中查看</em></a><a href="${publishHref||"#"}" class="${publishHref?"":"disabled"}"><span class="flow-number">4</span>${icon("package")}<strong>发布数据资产</strong><small>${esc(selected.id)}</small><em>在画布中查看</em></a></div><div class="evidence-summary">${fact("来源文件",selected.sourceSnapshot||"未记录")}${fact("数据截至",selected.asOf)}${fact("处理定义",selected.definitionVersion||"未记录")}${fact("正式运行",selected.runId||"未记录")}${fact("质量结论",selected.quality)}${fact("发布时间",selected.publishedAt)}</div><details class="contract-identifiers"><summary>查看技术证据编号与内容指纹</summary><small>质量结果：${esc(selected.qualityId||"未记录")}；输入内容指纹：${esc(selected.inputContentFingerprint||selected.sourceHash||"未记录")}；数据结构指纹：${esc(selected.memberContractFingerprint||"未记录")}；关系结构指纹：${esc(selected.relationshipContractFingerprint||"未记录")}</small></details></div></section>`;
    }else if(tab==="consumption"){
      const attempts=refreshAttemptsForVersion(selected.id),attempt=attempts.at(-1),adoptionProjection=attempt?.evidenceMode==="adoption-projection",requestDone=Boolean(attempt?.requestId)||adoptionProjection,processed=Boolean(attempt?.resultId)||adoptionProjection,processingPassed=attempt?.resultStatus==="成功",processingFailed=attempt?.resultStatus==="失败",adopted=Boolean(attempt?.t019Status==="已采用"&&attempt?.t019EvidenceId),ready=selected.id===authority?.id&&adopted;
      body=`<div class="stack">${c003DeliveryEvidencePanel(selected)}<section class="panel"><div class="panel-head"><div><span class="panel-title">从发布到可以正式使用</span><p>数据工程负责发布资产和提交请求；本体管理负责处理、兼容性校验和正式采用。</p></div>${badge(ready?"消费就绪":processingFailed?"本体处理失败":"尚未消费就绪",ready?"success":processingFailed?"danger":"warning")}</div><div class="panel-body"><div class="consumption-journey">${refreshStep("1. 发布数据资产",`${selected.id} · 数据截至 ${selected.asOf}`,"done","success","数据工程",selected.publishedAt)}${refreshStep("2. 提交刷新请求",adoptionProjection?"正式采用证据已回溯；当前投影不补造历史请求号":requestDone?`数据工程已提交 · ${attempt.requestStatus||"等待受理"}`:"尚未提交",requestDone?"done":"waiting",requestDone?"success":"neutral","数据工程",attempt?.createdAt||attempt?.adoptedAt||"")}${refreshStep("3. 本体处理与兼容性校验",adoptionProjection?"Published 指针证明该资产已通过本体采用门":processed?(processingPassed?"本体处理通过，已成为可采用候选":attempt.failureReason||"处理失败"):"等待本体管理处理",processed?(processingPassed?"done":"error"):"waiting",processed?(processingPassed?"success":"danger"):"neutral","本体管理",attempt?.resultAt||attempt?.adoptedAt||"")}${refreshStep("4. 本体侧正式采用",adopted?"本体管理已正式采用该版本":processingPassed?"等待本体管理正式采用":processingFailed?"处理失败，不能采用":"等待前序步骤",adopted?"done":processingPassed?"active":processingFailed?"blocked":"waiting",adopted?"success":processingFailed?"danger":processingPassed?"warning":"neutral","本体管理",attempt?.adoptedAt||"")}${refreshStep("5. 消费就绪",ready?"当前可经已发布本体供下游使用":`正在给下游使用：${authority?.id||"无"}`,ready?"done":processingFailed?"blocked":"waiting",ready?"success":processingFailed?"danger":"neutral","平台消费入口",attempt?.adoptedAt||"")}</div>${attempt?.failureReason&&!adoptionProjection?notice(`${attempt.failureReason}。恢复方式：${attempt.recovery||"由责任方修正问题后，对同一资产版本重新提交请求"}`,"danger","本次刷新未完成"):notice(ready?(adoptionProjection?"该资产版本已通过不可变 Published 指针取得正式采用证据；详细历史请求号没有在当前投影中伪造。":"该资产版本已获得本体管理的正式采用证据，可经权威语义路径使用。"):`该版本尚未获得正式采用；${authority?.id?`当前继续使用 ${authority.id}`:"当前没有可消费版本"}。`,ready?"success":"warning")}<div class="ownership-strip"><span><strong>数据工程</strong><small>发布资产、选择已有目标绑定、提交版本、展示回执</small></span><span><strong>本体管理</strong><small>维护目标与映射、处理兼容性、正式采用、维护下游使用版本</small></span></div><details class="contract-identifiers"><summary>查看请求、处理和采用证据编号</summary><small>目标绑定：${esc(attempt?.ontologyBindingId||"未记录")}；刷新请求：${esc(attempt?.requestId||"历史请求号未纳入当前投影")}；本体处理结果：${esc(attempt?.resultId||"由正式采用证据回溯")}；正式采用证据：${esc(attempt?.t019EvidenceId||"尚未取得")}；目标已发布本体版本：${esc(attempt?.targetT017||"未记录")}</small></details></div></section></div>`;
    }else{
      body=`<div class="stack"><div class="detail-grid"><section class="panel"><div class="panel-head"><span class="panel-title">这个版本包含什么</span>${badge(selected.id===authority?.id?"正在给下游使用":"未被正式采用",selected.id===authority?.id?"success":"neutral")}</div><div class="panel-body"><div class="summary-grid">${fact("数据截至",selected.asOf)}${fact("质量状态",selected.quality)}${fact("发布时间",selected.publishedAt)}${fact("来源文件",selected.sourceSnapshot||"未记录")}${fact("数据成员",`${members.length} 个`)}${fact("数据关系",`${relationships.length} 条`)}</div>${notice("选择历史版本时，本页的来源、质量、刷新和消费信息会一起切换，不会混入其他版本。","info")}</div></section><section class="panel"><div class="panel-head"><span class="panel-title">当前发布与下游使用状态</span></div><div class="panel-body"><div class="summary-grid">${fact("最新发布版本",latest?.id||"无")}${fact("正在给下游使用",authority?.id||"无")}${fact("等待采用的版本",candidate?.id||"无")}${fact("上一可信版本",previous?.id||"无")}${fact("本版本刷新状态",selected.refreshStatus||"尚未请求")}${fact("本版本使用状态",selected.id===authority?.id?"消费就绪":"不可正式消费")}</div><p>新版本只有在本体管理正式采用后才会给下游使用；处理中或失败的版本不会混入下游。</p></div></section></div>${c003DeliveryEvidencePanel(selected,{compact:true})}${trustSummaryPanel(selected)}${versionHistory}</div>`;
    }
    const headerActions=`<a class="btn" href="#/resources?shelf=assets">返回资产目录</a>${productionHref?`<a class="btn soft" href="${productionHref}">${icon("workflow")}<span>查看生产画布</span></a>`:""}`;
    return shell(`<div class="page" data-screen-label="数据资产详情">${pageHeader(a.name,"查看已发布版本的数据结构、生产质量证据和消费进度。",headerActions)}${versionHeader}${topTabs(tabs,tab,"asset-detail-tab")}${body}</div>`,false);
  }

  function pipelinesPage() {
    const tab = route().params.get("tab") || "definitions";
    const tabs = [["definitions","管道目录",D.pipelines.length],["runs","正式运行历史",flow.runs.length]];
    return shell(`<div class="page" data-screen-label="数据管道">${pageHeader("数据管道",tab === "runs" ? "只保留正式运行、正式失败重试和手工同步触发记录。" : "管理可复现的管道定义、正式运行计划和发布闭环。",tab === "definitions" ? button("新建管道","new-pipeline","primary","plus") : button("查看字段规范","run-field-contract","soft","info"))}${topTabs(tabs,tab,"pipeline-tab")}${tab === "runs" ? formalRunHistory() : pipelineDirectory()}</div>`,false);
  }
  function pipelineDirectory() {
    return `<div class="pipeline-list">${D.pipelines.map(p => {
      const latestRun=latestRunForPipeline(p.id),running=latestRun?.id===flow.currentRunId&&flow.runStatus==="running";
      const status=p.canOpen?(running?"运行中":p.definitionState):p.definitionState;
      const tone=p.canOpen?(running?"warning":"info"):"neutral";
      const canvasLabel=latestDefinitionForPipeline(p.id)?"查看画布":"打开画布";
      const actions=p.canOpen?`<a class="btn primary" href="#/pipelines/${p.id}/canvas">${esc(canvasLabel)}</a>${button("运行计划","pipeline-schedule","","clock",false,`data-pipeline-id="${esc(p.id)}"`)}`:`${button("打开画布","disabled-action","", "workflow",true)}${button("运行计划","disabled-action","","clock",true)}`;
      return `<article class="pipeline-card ${p.canOpen ? "" : "blocked"}"><div><span class="eyebrow">${p.canOpen?"标准发布管道":"来源准备"}</span><h3>${esc(p.name)}</h3><p>${esc(p.purpose)}</p></div><div class="pipeline-facts">${fact("管道定义版本",p.definitionVersion)}${fact("节点",`${p.nodeCount} 个`)}${fact("输入来源",p.source)}${fact("目标资产",p.targetAsset)}${fact("最近正式运行",p.latestRun)}${fact("运行计划",p.schedule)}</div><div class="pipeline-actions">${badge(status,tone)}<div class="pipeline-action-buttons">${actions}</div></div></article>`;
    }).join("")}</div>`;
  }
  function formalRunHistory() {
    if(!flow.runs.length) return `<section class="panel"><div class="panel-head"><div><span class="panel-title">正式运行历史</span><p>调试结果只保留在画布当前上下文，不进入长期历史。</p></div>${badge("0 条记录","neutral")}</div><div class="panel-body">${emptyState("尚无正式运行记录", "确认来源时点并发布管道定义后，可以发起第一次正式运行。", button("返回管道目录","pipeline-tab","soft","workflow",false,'data-value="definitions"'))}</div></section>`;
    return `<section class="panel"><div class="panel-head"><div><span class="panel-title">正式运行历史</span><p>执行完成与发布、刷新、采用闭环分别记录；每次运行绑定精确输入和定义版本。</p></div>${badge(`${flow.runs.length} 条记录`,"info")}</div><div class="panel-body"><div class="run-list">${flow.runs.map(r=>{const executionRetryable=/失败|无法判断/.test(r.executionStatus||"")&&!r.assetVersion,tone=r.status==="成功"?"success":/失败|无法判断/.test(r.status)?"danger":"warning";return `<article class="run-row"><div><span class="eyebrow">${esc(r.pipelineName||"数据管道")} · ${esc(r.trigger)}</span><strong>${esc(r.id)}</strong><small>${esc(r.startedAt)}${r.retryOf?` · 重试 ${esc(r.retryOf)}`:""}</small></div>${badge(r.status,tone)}<div>${fact("执行状态",r.executionStatus||"未记录")}${fact("执行结束",r.executionEndedAt||"尚未结束")}${fact("执行耗时",elapsedText(r.startedAt,r.executionEndedAt))}</div><div>${fact("闭环状态",r.closureStatus||"未记录")}${fact("闭环结束",r.closedLoopEndedAt||"尚未收敛")}${fact("闭环总耗时",elapsedText(r.startedAt,r.closedLoopEndedAt))}</div><div>${fact("质量",r.quality)}${fact("资产版本",r.assetVersion||"未形成")}</div><div class="run-actions"><a class="btn soft" href="#/pipelines?tab=runs&run=${encodeURIComponent(r.id)}&view=summary">${icon("info")}<span>查看详情</span></a>${executionRetryable?button("应用修复并重试","retry-run","primary","refresh",false,`data-run-id="${r.id}"`):""}</div>${r.failureReason?notice(`${r.failureNode}：${r.failureReason}。恢复：${r.recovery}`,"danger"):""}</article>`;}).join("")}</div></div></section>`;
  }

  function syncRouteModal() {
    const r=route(),runId=r.params.get("run"),allowedViews=new Set(["summary","nodes","publish-refresh"]),view=allowedViews.has(r.params.get("view"))?r.params.get("view"):"summary";
    if(r.parts[0]==="pipelines"&&r.parts.length===1&&r.params.get("tab")==="runs"&&runId){
      if(ui.modal?.type!=="run-detail"||ui.modal.data.runId!==runId||ui.modal.data.tab!==view||!ui.modal.data.routeDriven)ui.modal={type:"run-detail",data:{runId,tab:view,routeDriven:true}};
    }else if(ui.modal?.type==="run-detail"&&ui.modal.data.routeDriven){
      ui.modal=null;
    }
  }

  function notFound() { return shell(`<div class="page">${emptyState("页面不存在","请从数据资源或数据管道目录重新进入。",'<a class="btn primary" href="#/resources?shelf=sources">返回数据资源</a>')}</div>`,false); }

  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function defaultCanvasLayout() { return { left:184,right:304,bottom:264,leftCollapsed:false,rightCollapsed:false,bottomCollapsed:false,bottomMax:false }; }
  function defaultViewport() { return { x:CANVAS_ORIGIN.x-820,y:CANVAS_ORIGIN.y-420 }; }
  function defaultPythonModule() {
    return {
      id:"finance_standardize.py",
      name:"融资工作簿标准化",
      version:"v1.0.0",
      inputSlots:[
        {id:"main",name:"主输入",required:true,accepts:["source","asset"]},
        {id:"reference",name:"参考输入",required:false,accepts:["source","asset"]}
      ]
    };
  }
  function emptyDemoState() { return { kind:"",status:"idle",step:-1,message:"尚未执行",startedAt:"",completedAt:"",targetNodeId:"",plan:[],nodeStates:{},lockedInputs:[],events:[] }; }
  function defaultQualityRules() { return copy(D.qualityRules||[]); }
  function makeCanvas(id, template) {
    const useFive = template !== "blank";
    const module=defaultPythonModule();
    const pipeline=D.pipelines.find(x=>x.id===id),latestDefinition=latestDefinitionForPipeline(id);
    const ontologyBinding=D.ontologyConsumptionBindings?.find(x=>x.id===pipeline?.ontologyBindingId)||null;
    const nodes = useFive ? D.nodeDefinitions.map((d,i) => ({ id: `node-${d.key}`, key: d.key, x: CANVAS_ORIGIN.x + i * 220, y: CANVAS_ORIGIN.y, sourceId:d.key==="source"?"finance-workbook":undefined, inputKind:d.key==="source"?"source":undefined, inputSlotId:d.key==="source"?"main":undefined, memberScope:d.key==="source"?"不适用":undefined })) : [];
    const edges = useFive ? nodes.slice(0,-1).map((n,i) => ({ id: `edge-${i}`, from: n.id, to: nodes[i+1].id, slot:i===0?"主输入":"主输入" })) : [];
    return {
      id,
      name: pipeline?.name || ui.pipelineDraft.name || "新数据管道",
      purpose: pipeline?.purpose || ui.pipelineDraft.purpose || "尚未填写用途",
      mode: latestDefinition ? "published" : "draft",
      definitionLabel: latestDefinition?.id || "编辑草稿",
      dirty: false,
      validationSeen: false,
      validationFingerprint: "",
      validationAt: "",
      nodes,
      edges,
      selectedNode: "",
      linkFrom: "",
      zoom: 88,
      viewport: defaultViewport(),
      initialFitPending: true,
      layout: defaultCanvasLayout(),
      bottomTab: "validation",
      demo: emptyDemoState(),
      baseVersion: "",
      pythonModule:module,
      targetAssetId:pipeline?.targetAssetId||(id==="finance-pipeline"?"FIN-ASSET":""),
      refreshTarget:ontologyBinding?.publishedSemanticName||"",
      refreshTargetId:ontologyBinding?.publishedSemanticVersionId||"",
      sourceMappingVersion:ontologyBinding?.sourceMappingVersionId||"",
      qualityRules:id==="finance-pipeline"?copy(flow.qualityRules?.length?flow.qualityRules:defaultQualityRules()):[],
      pipelineSchedule:currentPipelineSchedule(id),
      ontologyBindingId:pipeline?.ontologyBindingId||"",
      undo: []
    };
  }
  function canvasRecord(c) {
    return { pipelineId:c.id,name:c.name,purpose:c.purpose,nodes:copy(c.nodes),edges:copy(c.edges),baseVersion:c.baseVersion||"",pythonModule:copy(c.pythonModule||defaultPythonModule()),targetAssetId:c.targetAssetId||"",ontologyBindingId:c.ontologyBindingId||"",refreshTarget:c.refreshTarget||"",refreshTargetId:c.refreshTargetId||"",sourceMappingVersion:c.sourceMappingVersion||"",qualityRules:copy(c.qualityRules||[]),pipelineSchedule:c.pipelineSchedule||currentPipelineSchedule(c.id),validationSeen:Boolean(c.validationSeen),validationFingerprint:c.validationFingerprint||"",validationAt:c.validationAt||"",savedAt:nowText() };
  }
  function hydrateCanvas(record, mode, label) {
    const base=makeCanvas(record.pipelineId||"finance-pipeline","blank");
    const hydrated={ ...base,...copy(record),mode,definitionLabel:label,dirty:false,selectedNode:"",linkFrom:"",bottomTab:"validation",layout:defaultCanvasLayout(),viewport:defaultViewport(),zoom:88,initialFitPending:true,demo:emptyDemoState(),validationSeen:Boolean(record.validationSeen),validationFingerprint:record.validationFingerprint||"",validationAt:record.validationAt||"",undo:[] };
    hydrated.pythonModule=copy(record.pythonModule||defaultPythonModule());
    hydrated.qualityRules=copy(record.qualityRules?.length?record.qualityRules:(record.pipelineId==="finance-pipeline"?defaultQualityRules():[]));
    if(mode==="published"&&record.trustedScenarioRegistration===true&&hydrated.validationSeen)hydrated.validationFingerprint=validationFingerprint(hydrated);
    return hydrated;
  }
  function publishedDefinition(version) { return flow.publishedDefinitions.find(d=>d.id===version) || null; }
  function persistDraftCanvas() {
    if(!ui.canvas||!isDraft()) return;
    flow.canvasDrafts[ui.canvas.id]=canvasRecord(ui.canvas);
    if(ui.canvas.id==="finance-pipeline")flow.qualityRules=copy(ui.canvas.qualityRules||[]);
    ui.canvas.dirty=false;
    saveFlow();
  }
  function hasUnsavedCanvasDraft() { return Boolean(route().parts[0]==="pipelines"&&route().parts[2]==="canvas"&&isDraft()&&ui.canvas?.dirty); }
  function queueCanvasTransition(transition) {
    if(!hasUnsavedCanvasDraft())return false;
    if(transition.type==="hash"&&transition.value===location.hash)return false;
    ui.pendingCanvasTransition=transition;openModal("unsaved-draft");return true;
  }
  function discardUnsavedCanvasChanges() {
    if(!ui.canvas)return;
    const id=ui.canvas.id,saved=flow.canvasDrafts[id],published=latestDefinitionForPipeline(id);
    if(saved)ui.canvas=hydrateCanvas(saved,saved.baseVersion?"draft-new":"draft",saved.baseVersion?`基于 ${saved.baseVersion} 的新草稿`:"编辑草稿");
    else if(published)ui.canvas=hydrateCanvas(published,"published",published.id);
    else ui.canvas=makeCanvas(id,"five");
    ui.canvasId=id;
  }
  function continueCanvasTransition(save) {
    const transition=ui.pendingCanvasTransition;if(!transition)return closeModal();
    if(save)persistDraftCanvas();else discardUnsavedCanvasChanges();
    ui.pendingCanvasTransition=null;ui.modal=null;
    if(transition.type==="hash")return go(transition.value,true);
    if(transition.type==="definition")return transition.value==="draft"?openEditableDraft():openPublishedDefinition(transition.value);
  }
  function ensureCanvas(id) {
    const params=route().params,requestedDefinition=params.get("definition"),historyKey=requestedDefinition?[id,requestedDefinition,params.get("run")||"",params.get("assetVersion")||"",params.get("returnAsset")||"",params.get("focus")||""].join("|"):"";
    const historyChanged=requestedDefinition?ui.canvas?.historyContextKey!==historyKey:Boolean(ui.canvas?.historyContext);
    if (ui.canvasId !== id || !ui.canvas || requestedDefinition&&ui.canvas.definitionLabel!==requestedDefinition || historyChanged) {
      ui.canvasId = id;
      const published=requestedDefinition?publishedDefinition(requestedDefinition):latestDefinitionForPipeline(id);
      const draft=flow.canvasDrafts[id];
      if(requestedDefinition&&!published) return null;
      if(published) ui.canvas=hydrateCanvas(published,"published",published.id);
      else if(draft) ui.canvas=hydrateCanvas(draft,draft.baseVersion?"draft-new":"draft",draft.baseVersion?`基于 ${draft.baseVersion} 的新草稿`:"编辑草稿");
      else ui.canvas = makeCanvas(id, "five");
      if(requestedDefinition){
        const requestedRun=route().params.get("run"),requestedAssetVersion=route().params.get("assetVersion"),run=flow.runs.find(x=>x.id===requestedRun);
        const consistent=Boolean(run&&run.definitionVersion===requestedDefinition&&(!requestedAssetVersion||run.assetVersion===requestedAssetVersion));
        ui.canvas.historyContext=consistent?{runId:run.id,assetVersionId:requestedAssetVersion||run.assetVersion,returnAssetId:route().params.get("returnAsset")||"",consistent:true}:{runId:requestedRun||"",assetVersionId:requestedAssetVersion||"",returnAssetId:route().params.get("returnAsset")||"",consistent:false};
        ui.canvas.historyContextKey=historyKey;
        if(consistent){
          const focus=params.get("focus")||"publish",node=ui.canvas.nodes.find(n=>n.key===focus),focusTabs={source:"snapshot",python:"description",quality:"results",publish:"release",refresh:"flow"};
          ui.canvas.selectedNode=node?.id||"";
          ui.canvas.bottomTab=focusTabs[focus]||"validation";
          ui.canvas.layout.leftCollapsed=true;
          ui.canvas.layout.left=44;
        }
      }
    }
    return ui.canvas;
  }
  function openPublishedDefinition(version) {
    const definition=publishedDefinition(version);if(!definition)return toast("未找到该已发布定义版本");
    ui.canvas=hydrateCanvas(definition,"published",definition.id);ui.canvasId=definition.pipelineId||ui.canvasId;ui.versionMenu=false;render();
  }
  function openEditableDraft() {
    if(flow.runStatus==="running")return toast("正式运行期间不能切换到编辑草稿");
    const existing=flow.canvasDrafts[ui.canvas.id];
    if(existing){ui.canvas=hydrateCanvas(existing,existing.baseVersion?"draft-new":"draft",existing.baseVersion?`基于 ${existing.baseVersion} 的新草稿`:"编辑草稿");}
    else{
      const base=!isDraft()?publishedDefinition(ui.canvas.definitionLabel):latestDefinitionForPipeline(ui.canvas.id);
      if(base){const draft=copy(base);delete draft.id;delete draft.publishedAt;draft.baseVersion=base.id;ui.canvas=hydrateCanvas(draft,"draft-new",`基于 ${base.id} 的新草稿`);}
      else ui.canvas=makeCanvas(ui.canvas.id,ui.canvas.nodes.length?"five":"blank");
      flow.canvasDrafts[ui.canvas.id]=canvasRecord(ui.canvas);saveFlow();
    }
    ui.versionMenu=false;render();
  }
  function publishCanvasDefinition() {
    if(!isDraft())return toast("当前不是可发布的编辑草稿");
    const scenarioGate=scenarioContextGate();if(!scenarioGate.okay)return toast(`不能发布管道定义：${scenarioGate.problems.join("；")}。请从平台总控进入当前场景工作轮次`);
    const validation=validationResult();if(!validation.okay||!ui.canvas.validationSeen||ui.canvas.validationFingerprint!==validation.fingerprint)return toast("请先在底部“管道校验”页签校验当前草稿并修正全部问题");
    const version=nextDefinitionVersion(),record={...canvasRecord(ui.canvas),id:version,immutable:true,publishedAt:nowText(),scenarioContext:copy(scenarioGate.context),scenarioRunId:scenarioGate.context.scenarioRunId,publishNote:"节点、连线、参数、脚本版本、命名输入槽与质量规则已锁定"};
    flow.definitionRevision+=1;flow.publishedDefinitions.push(record);delete flow.canvasDrafts[ui.canvas.id];if(record.pipelineId==="finance-pipeline")flow.qualityRules=copy(record.qualityRules||[]);
    if(record.pipelineId==="finance-pipeline"){flow.definitionPublished=true;flow.definitionVersion=version;}
    ui.canvas=hydrateCanvas(record,"published",version);ui.canvasId=record.pipelineId;saveFlow();ui.modal=null;render();toast(`${version} 已发布，可发起正式运行`);
  }
  function nodeById(id) { return ui.canvas?.nodes.find(n => n.id === id); }
  function defForNode(node) {
    const base = D.nodeDefinitions.find(d => d.key === node?.key) || { name: "管道", icon: "workflow", color: "#607080", hint: "未选择节点" };
    if (SCENARIO_ID === "S003" && node?.key === "source") {
      const source = sourceForNode(node);
      if (source) {
        const memberScope = node.memberScope && node.memberScope !== "不适用" ? ` · ${node.memberScope}` : "";
        return { ...base, name: source.name, hint: `${source.category || "数据源"}${memberScope} · ${source.asOf || "待确认"}` };
      }
    }
    return base;
  }
  function selectedNode() { return nodeById(ui.canvas?.selectedNode); }
  function isDraft() { return ui.canvas?.mode === "draft" || ui.canvas?.mode === "draft-new"; }
  function canEditCanvas() { return Boolean(isDraft()&&flow.runStatus!=="running"&&ui.canvas?.demo?.status!=="running"); }
  function cloneCanvasState() { return { nodes:copy(ui.canvas.nodes),edges:copy(ui.canvas.edges),selectedNode:ui.canvas.selectedNode,dirty:ui.canvas.dirty }; }
  function pushUndo() { if (!ui.canvas) return; ui.canvas.undo.push(cloneCanvasState()); if (ui.canvas.undo.length > 30) ui.canvas.undo.shift(); }
  function pushUndoState(state) { if(!ui.canvas||!state)return;ui.canvas.undo.push(state);if(ui.canvas.undo.length>30)ui.canvas.undo.shift(); }
  function undoCanvas() { if(!canEditCanvas())return toast("当前画布不可编辑");const prev = ui.canvas?.undo.pop(); if (!prev) return toast("没有可撤销的画布操作"); ui.canvas.nodes = prev.nodes; ui.canvas.edges = prev.edges; ui.canvas.selectedNode = prev.selectedNode; ui.canvas.dirty = true; render(); toast("已撤销上一步画布操作"); }
  function nextNodePosition(key) {
    if(key==="source") {
      const count=ui.canvas.nodes.filter(n=>n.key==="source").length;
      return { x:CANVAS_ORIGIN.x, y:CANVAS_ORIGIN.y + count * 170 };
    }
    const semanticIndex = D.nodeDefinitions.findIndex(n => n.key === key);
    if (semanticIndex >= 0) return { x: CANVAS_ORIGIN.x + semanticIndex * 220, y: CANVAS_ORIGIN.y };
    const count = ui.canvas.nodes.length;
    return { x: CANVAS_ORIGIN.x + (count % 5) * 220, y: CANVAS_ORIGIN.y + Math.floor(count / 5) * 170 };
  }
  function pythonInputSlots(canvas=ui.canvas) { return canvas?.pythonModule?.inputSlots||defaultPythonModule().inputSlots; }
  function slotForSource(node,canvas=ui.canvas) { return pythonInputSlots(canvas).find(s=>s.id===node?.inputSlotId)||null; }
  function availableSlotFor(from,to,canvas=ui.canvas) {
    const source=canvas.nodes.find(n=>n.id===from),target=canvas.nodes.find(n=>n.id===to);if(source?.key!=="source"||target?.key!=="python")return null;
    const occupied=new Set(canvas.edges.filter(e=>e.to===to&&e.from!==from).map(e=>e.slotId||canvas.nodes.find(n=>n.id===e.from)?.inputSlotId).filter(Boolean)),kind=source.inputKind||"source";
    const accepted=s=>!s.accepts||s.accepts.includes(kind);
    const preferred=pythonInputSlots(canvas).find(s=>s.id===source.inputSlotId&&!occupied.has(s.id)&&accepted(s));
    return preferred||pythonInputSlots(canvas).find(s=>!occupied.has(s.id)&&accepted(s))||null;
  }
  function addNode(key, point) {
    if (!canEditCanvas()) return toast("已发布定义或运行中的画布不可编辑；请先创建可编辑草稿");
    if (key!=="source"&&ui.canvas.nodes.some(n => n.key === key)) return toast("该处理节点已在画布中；数据源节点可按需添加多个");
    if(key==="source"&&ui.canvas.nodes.filter(n=>n.key==="source").length>=pythonInputSlots().length)return toast(`当前 Python 模块只声明 ${pythonInputSlots().length} 个命名输入槽，不能继续增加来源节点`);
    pushUndo(); const p = point || nextNodePosition(key); const node = { id: `node-${key}-${Date.now()}`, key, x: Math.max(240,Math.min(CANVAS_WORLD.width-360,p.x)), y: Math.max(180,Math.min(CANVAS_WORLD.height-280,p.y)), sourceId:key==="source"?"finance-workbook":undefined, inputKind:key==="source"?"source":undefined };
    ui.canvas.nodes.push(node); ui.canvas.selectedNode = node.id; ui.canvas.bottomTab = tabsForNode(node)[0][0]; ui.canvas.dirty = true; render();
  }
  function removeSelectedNode() {
    if (!ui.canvas?.selectedNode) return;
    if (!canEditCanvas()) return toast("当前画布不能删除节点");
    pushUndo(); const id = ui.canvas.selectedNode; ui.canvas.nodes = ui.canvas.nodes.filter(n => n.id !== id); ui.canvas.edges = ui.canvas.edges.filter(e => e.from !== id && e.to !== id); ui.canvas.selectedNode = ""; ui.canvas.bottomTab = "validation"; ui.canvas.dirty = true; render(); toast("已删除节点及关联连线，可撤销");
  }
  function connectNodes(from,to) {
    if (!canEditCanvas()) return toast("当前画布不可修改连线");
    const check=connectionCheck(from,to);
    if(!check.ok) return toast(check.reason);
    const target=nodeById(to),source=nodeById(from),declared=target.key==="python"?availableSlotFor(from,to):null;
    const slot=declared?.name||"主输入";
    pushUndo();if(declared)source.inputSlotId=declared.id;ui.canvas.edges.push({ id:`edge-${Date.now()}`,from,to,slot,slotId:declared?.id||"main" }); ui.canvas.linkFrom="";ui.canvas.selectedNode=to;ui.canvas.dirty=true;render();toast(`连线已建立 · ${slot}`);
  }
  function markCanvasChanged() {
    if(!ui.canvas)return;
    ui.canvas.dirty=true;
  }
  function nodeRank(node) { return D.nodeDefinitions.findIndex(d=>d.key===node?.key); }
  function pathExists(start,target,edges=ui.canvas.edges) {
    const seen=new Set(),queue=[start];
    while(queue.length){const id=queue.shift();if(id===target)return true;if(seen.has(id))continue;seen.add(id);edges.filter(e=>e.from===id).forEach(e=>queue.push(e.to));}
    return false;
  }
  function connectionCheck(from,to) {
    const a=nodeById(from),b=nodeById(to);
    if(!a||!b) return {ok:false,reason:"请选择有效的起点和终点节点"};
    if(from===to) return {ok:false,reason:"节点不能连接到自身"};
    if(ui.canvas.edges.some(e=>e.from===from&&e.to===to)) return {ok:false,reason:"该连线已存在"};
    if(pathExists(to,from)) return {ok:false,reason:"该连线会形成循环，已阻止"};
    const allowed=(a.key==="source"&&b.key==="python")||(a.key==="python"&&b.key==="quality")||(a.key==="quality"&&b.key==="publish")||(a.key==="publish"&&b.key==="refresh");
    if(!allowed) return {ok:false,reason:`不支持“${defForNode(a).name} → ${defForNode(b).name}”；请按发布主链顺序连接`};
    if(ui.canvas.edges.some(e=>e.from===from)) return {ok:false,reason:"一期不支持一个输出连接多个下游，已阻止分支"};
    if(b.key!=="python"&&ui.canvas.edges.some(e=>e.to===to)) return {ok:false,reason:"该节点的主输入槽已被占用"};
    if(b.key==="python"&&ui.canvas.edges.some(e=>e.to===to&&e.from===from)) return {ok:false,reason:"同一输入不能重复占用 Python 输入槽"};
    if(a.key==="source"&&b.key==="python"&&!availableSlotFor(from,to))return {ok:false,reason:"当前 Python 模块声明的命名输入槽已全部占用"};
    if(nodeRank(a)>=nodeRank(b)) return {ok:false,reason:"不允许逆序连线"};
    return {ok:true,reason:""};
  }
  function validationFingerprint(canvas=ui.canvas) {
    if(!canvas)return "";
    const inputs=selectedInputContexts(canvas).map(x=>({nodeId:x.node.id,resourceId:x.resourceId,version:x.version,asOf:x.asOf,allowed:x.allowed,fingerprint:x.fingerprint,memberScope:x.memberScope,assetContractFingerprint:x.assetContractFingerprint||""}));
    return stableString({name:canvas.name,purpose:canvas.purpose,nodes:canvas.nodes.map(n=>({id:n.id,key:n.key,sourceId:n.sourceId,inputKind:n.inputKind,inputSlotId:n.inputSlotId,assetId:n.assetId,assetVersionId:n.assetVersionId,memberScope:n.memberScope})),edges:canvas.edges.map(e=>({from:e.from,to:e.to,slotId:e.slotId})),inputs,pythonModule:canvas.pythonModule,targetAssetId:canvas.targetAssetId,ontologyBindingId:canvas.ontologyBindingId,qualityRules:canvas.qualityRules});
  }
  function validationResult() {
    const counts=Object.fromEntries(D.nodeDefinitions.map(d=>[d.key,ui.canvas.nodes.filter(n=>n.key===d.key).length]));
    const missing=D.nodeDefinitions.filter(d=>d.key==="source"?counts.source<1:counts[d.key]!==1).map(d=>d.key==="source"?"至少一个数据源":`${d.name}（必须且只能一个）`);
    const nodeProblems=[...missing],edgeProblems=[],slotProblems=[],inputProblems=[],pythonProblems=[],qualityProblems=[],assetProblems=[];
    ui.canvas.edges.forEach(e=>{const a=nodeById(e.from),b=nodeById(e.to);if(!a||!b)edgeProblems.push("存在失效连线");else{const allowed=(a.key==="source"&&b.key==="python")||(a.key==="python"&&b.key==="quality")||(a.key==="quality"&&b.key==="publish")||(a.key==="publish"&&b.key==="refresh");if(!allowed)edgeProblems.push(`${defForNode(a).name} → ${defForNode(b).name} 顺序不合法`);}});
    ui.canvas.nodes.filter(n=>n.key==="source").forEach(n=>{if(ui.canvas.edges.filter(e=>e.from===n.id&&nodeById(e.to)?.key==="python").length!==1)edgeProblems.push(`${sourceInputLabel(n)} 未连接到 Python 输入槽`);});
    ["python","quality","publish"].forEach(key=>{const n=ui.canvas.nodes.find(x=>x.key===key);if(n&&ui.canvas.edges.filter(e=>e.from===n.id).length!==1)edgeProblems.push(`${defForNode(n).name} 必须连接一个下游`);});
    ["quality","publish","refresh"].forEach(key=>{const n=ui.canvas.nodes.find(x=>x.key===key);if(n&&ui.canvas.edges.filter(e=>e.to===n.id).length!==1)edgeProblems.push(`${defForNode(n).name} 的主输入槽必须且只能连接一次`);});
    const python=ui.canvas.nodes.find(n=>n.key==="python");
    if(python){
      const incoming=ui.canvas.edges.filter(e=>e.to===python.id),occupied=incoming.map(e=>e.slotId||nodeById(e.from)?.inputSlotId).filter(Boolean);
      if(incoming.length<1)slotProblems.push("Python 至少需要一个已连接的数据源输入槽");
      if(new Set(occupied).size!==occupied.length)slotProblems.push("Python 命名输入槽存在重复占用");
      const declared=new Set(pythonInputSlots().map(s=>s.id));if(occupied.some(id=>!declared.has(id)))slotProblems.push("存在未声明的输入槽");
      pythonInputSlots().filter(s=>s.required).forEach(s=>{if(!occupied.includes(s.id))slotProblems.push(`必需输入槽“${s.name}”尚未连接`);});
    }
    ui.canvas.nodes.filter(n=>n.key==="source").forEach(n=>{const context=sourceInputContext(n);if(!context.allowed)inputProblems.push(`${sourceInputLabel(n)}：${context.reason}`);});
    if(!ui.canvas.pythonModule?.id||!ui.canvas.pythonModule?.version)pythonProblems.push("尚未选择受控 Python 模块或版本");
    if(!ui.canvas.qualityRules?.length)qualityProblems.push("尚未配置发布前检查集");
    (ui.canvas.qualityRules||[]).forEach(rule=>{if(!rule.id||!rule.scope||!rule.condition||!rule.severity||!rule.failureEffect)qualityProblems.push(`${rule.name||rule.id||"未命名规则"} 的范围、条件、级别或失败处理不完整`);});
    const targetAsset=targetAssetForCanvas();
    if(!targetAsset)assetProblems.push("尚未绑定稳定目标数据资产");
    else if(!targetAsset.members?.length)assetProblems.push("目标数据资产尚未声明成员、字段与业务粒度合同");
    const bindingGate=ontologyBindingGate(),refreshProblems=bindingGate.problems;
    const check=(id,name,content,items,recovery,focus,blocking=true)=>({id,name,content,okay:items.length===0,blocking,issues:[...new Set(items)],impact:items.length?(blocking?"不能安全发布管道定义":"不影响发布定义或数据资产，但不能提交刷新请求"):"无",recovery,focus});
    const checks=[
      check("structure","节点组成","至少一个数据源，其余四类节点各一个",nodeProblems,"从节点库补齐或删除重复节点","source"),
      check("edges","主链与连线","数据源汇入 Python，之后检查→发布→刷新；无断链、分支或循环",edgeProblems,"在画布中补齐合法连线","python"),
      check("slots","命名输入槽","每个来源占用一个已声明槽，必需槽完整且不重复",slotProblems,"聚焦 Python 节点核对输入槽","python"),
      check("inputs","输入准备状态","每个来源具有确定快照或资产版本及权威数据截至时间",inputProblems,"打开对应数据源节点确认输入和时点","source"),
      check("python","Python 模块和版本","使用已登记的受控处理模块、固定版本和必需参数",pythonProblems,"在 Python 节点完成配置","python"),
      check("quality","检查集配置","每条规则具备稳定编号、范围、条件、级别和失败处理",qualityProblems,"打开数据检查节点查看并补齐规则","quality"),
      check("asset","目标数据资产合同","发布目标具备稳定身份、成员、字段、粒度和关系合同",assetProblems,"打开发布节点核对目标资产合同","publish"),
      check("refresh","本体目标绑定","只读选择本体管理中已建立且与目标资产匹配的目标绑定",refreshProblems,"数据资产仍可发布；提交刷新前需前往本体管理建立可用绑定并返回选择","refresh",false)
    ];
    const problems=checks.filter(x=>x.blocking).flatMap(x=>x.issues);
    return {okay:checks.filter(x=>x.blocking).every(x=>x.okay),refreshReady:bindingGate.okay,missing:[...new Set(missing)],problems,checks,passed:checks.filter(x=>x.okay).length,failed:checks.filter(x=>!x.okay&&x.blocking).length,warnings:checks.filter(x=>!x.okay&&!x.blocking).length,fingerprint:validationFingerprint()};
  }
  function trialValidationResult(target) {
    const problems=[];
    if(!target||nodeRank(target)>2)return {okay:false,problems:["请选择数据源、Python 或数据检查节点"]};
    if(target.key==="source"){
      const context=sourceInputContext(target);if(!context.allowed)problems.push(context.reason);
      return {okay:problems.length===0,problems};
    }
    const python=ui.canvas.nodes.find(n=>n.key==="python");
    if(!python)return {okay:false,problems:["缺少 Python 处理节点"]};
    const incoming=ui.canvas.edges.filter(e=>e.to===python.id&&nodeById(e.from)?.key==="source");
    const occupied=incoming.map(e=>e.slotId||nodeById(e.from)?.inputSlotId).filter(Boolean);
    if(!incoming.length)problems.push("Python 尚未连接数据源输入");
    if(new Set(occupied).size!==occupied.length)problems.push("Python 命名输入槽重复占用");
    pythonInputSlots().filter(s=>s.required).forEach(s=>{if(!occupied.includes(s.id))problems.push(`必需输入槽“${s.name}”尚未连接`);});
    connectedInputContexts(python.id).forEach(x=>{if(!x.allowed)problems.push(`${x.slot}：${x.reason}`);});
    if(target.key==="quality"){
      const quality=ui.canvas.nodes.find(n=>n.key==="quality");
      if(!quality||!ui.canvas.edges.some(e=>e.from===python.id&&e.to===quality.id))problems.push("Python 尚未连接到数据检查节点");
    }
    return {okay:problems.length===0,problems:[...new Set(problems)]};
  }
  function topologicalNodes(canvas=ui.canvas) {
    const indegree=new Map(canvas.nodes.map(n=>[n.id,0]));canvas.edges.forEach(e=>indegree.set(e.to,(indegree.get(e.to)||0)+1));
    const queue=canvas.nodes.filter(n=>indegree.get(n.id)===0).sort((a,b)=>nodeRank(a)-nodeRank(b)||a.y-b.y||a.x-b.x),result=[];
    while(queue.length){const n=queue.shift();result.push(n);canvas.edges.filter(e=>e.from===n.id).forEach(e=>{indegree.set(e.to,indegree.get(e.to)-1);if(indegree.get(e.to)===0){queue.push(canvas.nodes.find(x=>x.id===e.to));queue.sort((a,b)=>nodeRank(a)-nodeRank(b)||a.y-b.y||a.x-b.x);}});}
    return result;
  }
  function executionPlanTo(targetId,canvas=ui.canvas) {
    const target=canvas.nodes.find(n=>n.id===targetId);if(!target)return [];
    const ancestors=new Set([targetId]),queue=[targetId];while(queue.length){const id=queue.shift();canvas.edges.filter(e=>e.to===id).forEach(e=>{if(!ancestors.has(e.from)){ancestors.add(e.from);queue.push(e.from);}});}
    return topologicalNodes(canvas).filter(n=>ancestors.has(n.id)&&nodeRank(n)<=2);
  }

  function canvasPage(id) {
    const p = D.pipelines.find(x => x.id === id);
    if (!p || !p.canOpen) return notFound(); const c = ensureCanvas(id);
    if(!c)return shell(`<div class="page">${pageHeader("无法打开生产画布","所选资产版本引用的历史管道定义已不可定位。",`<a class="btn" href="#/resources?shelf=assets">返回数据资产目录</a>`)}${notice("系统不会回退到最新定义，因为那会把不同版本的生产证据混在一起。请从版本详情核对定义、运行和资产版本编号。","danger","历史生产证据不可定位")}</div>`,false);
    const layout = c.layout; const workbenchClass = `${layout.leftCollapsed ? "left-closed" : ""} ${layout.rightCollapsed ? "right-closed" : ""} ${layout.bottomCollapsed ? "bottom-closed" : ""} ${layout.bottomMax ? "bottom-max" : ""}`;
    return shell(`<div class="canvas-shell ${c.demo.status === "running" || runStatusForCanvas() === "running" || ["request-created","request-accepted","querying"].includes(flow.refreshStatus)&&actionRunForCanvas() ? "is-running" : ""}" data-screen-label="管道画布">${canvasToolbar(c)}<div id="canvas-workbench" class="canvas-workbench ${workbenchClass}" style="--library-w:${layout.left}px;--rail-w:${layout.right}px;--bottom-h:${layout.bottom}px">${nodeLibrary(c)}${canvasStage(c)}${nodeRail(c)}${bottomPanel(c)}<div class="splitter splitter-left" data-resize="left" title="拖动调整节点库宽度"></div><div class="splitter splitter-right" data-resize="right" title="拖动调整配置栏宽度"></div><div class="splitter splitter-bottom" data-resize="bottom" title="拖动调整底部面板高度"></div></div></div>`,true);
  }
  function canvasToolbar(c) {
    const validation = validationResult();
    const draft=isDraft();
    const visibleRun=runForCanvas(),visibleStatus=runStatusForCanvas(),globalCandidate=currentRun()&&["running","quality-warning","awaiting-publish","published"].includes(flow.runStatus);
    const target=selectedNode(),trialCheck=trialValidationResult(target),trialEligible=Boolean(target?.key&&defForNode(target).trialEligible!==false),trialable=Boolean(trialEligible&&trialCheck.okay);
    const trialLabel=c.demo.kind==="trial"&&c.demo.status==="running"?"试运行中":"试运行此节点";
    const trialTitle=!target?"先选择数据源、Python 处理或数据检查节点":!trialEligible?"发布与刷新节点只在正式流程中执行，不能单独试运行":trialable?"使用完整输入试运行到当前所选节点":trialCheck.problems.join("；");
    const validatedCurrent=Boolean(c.validationSeen&&c.validationFingerprint===validation.fingerprint&&validation.okay);
    const draftActions = `${button("撤销","undo","","undo",!c.undo.length,'data-labelled-action="undo" title="撤销 · ⌘/Ctrl+Z"')}${button("保存草稿","save-canvas","","save",false,'title="保存草稿 · ⌘/Ctrl+S"')}${button(trialLabel,"trial-to-node","soft","play",!trialable||c.demo.status==="running",`data-labelled-action="trial" title="${esc(trialTitle)}"`)}${button("发布管道定义","publish-definition","primary","package",!validatedCurrent,'title="先在底部管道校验页签完成当前草稿校验"')}`;
    let runAction=button(visibleRun?"重新运行":"正式运行","formal-run","primary","play",false,'title="正式运行必须绑定已发布定义和确定输入"');
    if(globalCandidate&&visibleRun?.id!==flow.currentRunId)runAction=button("处理未收敛候选","open-finish-pending-candidate","soft","clock",false,'title="保留当前候选及交付证据并显式结束后，再从此定义发起运行"');
    else if(visibleStatus==="running") runAction=button("停止运行","stop-run","danger","close",false,'title="停止当前候选运行"');
    else if(visibleStatus==="quality-warning")runAction=button("质量警告待处理","formal-run","","alert",true,'title="先确认警告理由或结束本次运行"');
    else if(visibleStatus==="awaiting-publish")runAction=button("候选待发布","formal-run","","clock",true,'title="先发布或结束当前候选"');
    else if(visibleStatus==="published")runAction=button("候选待刷新","formal-run","","clock",true,'title="先完成当前候选刷新或处理失败"');
    const readonlyTrialTitle=!target?"已发布画布只读；需创建草稿并选择可试运行节点":"已发布画布只读；试运行只在编辑草稿中执行";
    const readonlyTrial=button("试运行此节点","trial-to-node","soft","play",true,`data-labelled-action="trial" title="${esc(readonlyTrialTitle)}"`);
    const publishedActions = `${button("编辑","edit-definition","","edit",flow.runStatus==="running",'title="基于当前已发布定义创建新草稿"')}${readonlyTrial}${runAction}`;
    const definitions=flow.publishedDefinitions.filter(d=>d.pipelineId===c.id);
    const history=c.historyContext?.consistent,backHref=history&&c.historyContext.returnAssetId?`#/resources/asset/${encodeURIComponent(c.historyContext.returnAssetId)}?tab=lineage&version=${encodeURIComponent(c.historyContext.assetVersionId)}`:"#/pipelines?tab=definitions",backLabel=history?"返回资产证据":"管道目录";
    const historyActions=`${badge(`资产版本 ${c.historyContext?.assetVersionId||""}`,"success")}${button("试运行此节点","trial-to-node","soft","play",true,'data-labelled-action="trial" title="生产证据画布只读，不执行新的试运行"')}`;
    return `<header class="canvas-toolbar"><a class="canvas-back" href="${backHref}" style="flex:0 0 auto;min-width:max-content">${icon("collapse")}<span>${backLabel}</span></a><div class="canvas-title"><strong>${esc(c.name)}</strong><span>${history?`${c.historyContext.runId} · 生产证据视图`:c.dirty ? "有未保存修改" : draft ? "草稿已保存" : visibleStatus==="running"?"正式运行中":"只读视图"}</span></div><div class="definition-selector"><button data-action="toggle-version-menu" ${history?"disabled":""}><span>管道定义版本</span><strong>${esc(c.definitionLabel)}</strong>${history?icon("lock"):icon("down")}</button>${ui.versionMenu&&!history ? `<div class="popover version-popover"><button data-action="select-definition" data-value="draft"><strong>${flow.canvasDrafts[c.id]?"编辑草稿":"新建编辑草稿"}</strong><span>可修改节点、连线和参数</span></button>${definitions.map(d=>`<button data-action="select-definition" data-value="${esc(d.id)}"><strong>${esc(d.id)}</strong><span>已发布 · 只读 · ${esc(d.publishedAt||"")}</span></button>`).join("")}</div>` : ""}</div><div class="canvas-actions">${history?historyActions:draft ? draftActions : publishedActions}<div class="more-wrap">${button("更多","toggle-more","icon-only","more",false,'title="运行计划、快捷键与布局"')}${ui.moreMenu ? `<div class="popover more-popover"><button data-action="pipeline-schedule">${icon("clock")}管道运行计划</button><button data-action="shortcut-help">${icon("keyboard")}快捷键帮助</button><button data-action="reset-layout">${icon("expand")}恢复默认布局</button><button data-action="reset-flow">${icon("refresh")}重置工作区状态</button></div>` : ""}</div></div></header>`;
  }
  function nodeLibrary(c) {
    if (c.layout.leftCollapsed) return `<aside class="node-library collapsed"><button data-action="toggle-library" title="展开节点库">${icon("chevron")}</button><span>节点库</span></aside>`;
    const groups=["输入","处理与质量","发布"];
    return `<aside class="node-library"><div class="pane-head"><div><strong>节点库</strong><span>拖入画布或点击添加</span></div><button class="icon-button" data-action="toggle-library" title="收起节点库">${icon("collapse")}</button></div><div class="library-scroll">${groups.map(group=>`<section class="library-group"><span class="library-label">${group}</span>${D.nodeDefinitions.filter(n=>n.libraryGroup===group).map(n => `<button class="library-card" draggable="true" data-node-key="${n.key}" data-action="add-node" data-key="${n.key}"><span style="color:${n.color}">${icon(n.icon)}</span><div><strong>${esc(n.name)}</strong><small>${esc(n.hint)}</small></div></button>`).join("")}</section>`).join("")}</div></aside>`;
  }
  function edgeSvg(c) {
    return `<svg class="edge-layer" viewBox="0 0 ${CANVAS_WORLD.width} ${CANVAS_WORLD.height}" aria-hidden="true"><defs><marker id="edge-arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z"></path></marker></defs>${c.edges.map(e => { const a=nodeById(e.from),b=nodeById(e.to); if(!a||!b)return "";const aState=nodeStateCode(a),bState=nodeStateCode(b);const active=bState==="running"&&aState==="success";const passed=aState==="success"&&["success","waiting-confirmation"].includes(bState);return `<path class="canvas-edge ${active?"active":""} ${passed?"passed":""}" data-edge-id="${e.id}" data-from="${e.from}" data-to="${e.to}" d="M ${a.x+150} ${a.y+75} C ${a.x+172} ${a.y+75}, ${b.x-22} ${b.y+75}, ${b.x} ${b.y+75}" marker-end="url(#edge-arrow)"></path>`; }).join("")}</svg>`;
  }
  function canvasStage(c) {
    const sel = selectedNode(); const connected = new Set([sel?.id]); c.edges.forEach(e => { if(e.from===sel?.id) connected.add(e.to); if(e.to===sel?.id) connected.add(e.from); });
    const draft=isDraft();
    const statusCopy = draft ? "可编辑节点、连线和配置；先在底部完成管道校验，再发布定义。" : "当前定义只读；正式运行会锁定这份定义和所选输入。";
    const authoritative=authorityVersion(),viewRun=runForCanvas(),viewStatus=runStatusForCanvas();
    const flowCopy=viewStatus==="running"?`正式运行 ${viewRun?.id} 正在执行；${authorityServiceText(authoritative)}`:viewStatus==="quality-warning"?"正式质量产生警告；填写继续理由，或结束本次不发布":viewStatus==="awaiting-publish"?"正式质量门已通过，请在发布数据资产节点确认":viewStatus==="published"?`数据资产版本已发布；${authorityServiceText(authoritative)}`:viewStatus==="ready"?`${viewRun?.id} 已消费就绪；当前正式消费版本 ${authoritative?.id||"尚未采用"}`:viewStatus==="failed"?`${viewRun?.id} 执行或质量门已阻断；${authoritative?`当前正式消费版本 ${authoritative.id} 未切换`:"尚无正式消费版本"}`:viewRun?`正在查看 ${viewRun.id} 的历史执行证据`:"尚无本定义的正式运行";
    const linkCopy=c.linkFrom?`正在连线：请选择高亮的下游目标节点` : flowCopy;
    return `<section class="canvas-stage ${c.linkFrom?"linking":""}" id="canvas-stage"><div class="canvas-mode-banner">${badge(draft ? "编辑草稿" : "只读定义",draft?"info":"neutral")}<span>${esc(statusCopy)}</span><em>${esc(linkCopy)}</em></div><div class="canvas-viewport" data-action="clear-node-selection" data-drop-zone="true"><div id="canvas-world" class="canvas-world" style="--canvas-scale:${c.zoom/100};width:${CANVAS_WORLD.width}px;height:${CANVAS_WORLD.height}px">${edgeSvg(c)}${c.nodes.map((n,i) => canvasNode(n,i,connected)).join("")}${!c.nodes.length ? `<div class="canvas-empty" style="left:${CANVAS_ORIGIN.x}px;top:${CANVAS_ORIGIN.y}px"><strong>空白编辑草稿</strong><span>从左侧拖入节点，使用节点内的“连接下一节点”按钮后选择目标。</span></div>` : ""}</div></div><div class="canvas-pan-hint">拖动背景平移 · 鼠标滚轮缩放</div><div class="zoom-tools"><button data-action="zoom" data-value="-10" title="缩小 · -">−</button><span>${c.zoom}%</span><button data-action="zoom" data-value="10" title="放大 · +">＋</button><button data-action="fit-canvas" title="适应窗口 · F">适应窗口</button></div></section>`;
  }
  function nodeStateCode(node) {
    const demo=ui.canvas?.demo;if(isDraft()&&demo&&["running","complete"].includes(demo.status)&&demo.nodeStates[node.id])return demo.nodeStates[node.id];
    const run=runForCanvas();
    if(!run)return "idle";
    if(run.id===flow.currentRunId&&flow.runNodeStates[node.id])return flow.runNodeStates[node.id];
    const execution=run.nodeExecutions?.find(x=>x.id===node.id),map={"运行中":"running","成功":"success","失败":"failed","无法判断":"failed","待确认":"waiting-confirmation","待请求":"waiting-confirmation","等待":"waiting","未执行":"idle"};
    if(execution)return map[execution.status]||"idle";
    return "idle";
  }
  function nodeVisualStatus(node) {
    const state=nodeStateCode(node),demo=ui.canvas.demo,demoActive=isDraft()&&demo.status!=="idle",run=runForCanvas();
    if(node.key==="refresh"&&run?.id===flow.currentRunId){if(flow.refreshStatus==="adopted")return {label:"消费就绪",tone:"success"};if(flow.refreshStatus==="eligible")return {label:"本体处理通过 · 待正式采用",tone:"warning"};if(flow.refreshStatus==="adoption-querying")return {label:"正在核对正式采用状态",tone:"running"};if(flow.refreshStatus==="awaiting-c003-receipt")return {label:"正在核对资产交付回执",tone:"running"};if(flow.refreshStatus==="c003-blocked")return {label:"资产交付尚未完成",tone:"danger"};if(flow.refreshStatus==="request-created")return {label:"请求已创建 · 等待受理",tone:"running"};if(flow.refreshStatus==="request-accepted")return {label:"请求已提交 · 本体处理中",tone:"running"};if(flow.refreshStatus==="querying")return {label:"正在查询原请求",tone:"running"};if(flow.refreshStatus==="unknown")return {label:"本体处理结果待核对",tone:"warning"};if(flow.refreshStatus==="failed")return {label:"本体处理失败",tone:"danger"};}
    if(node.key==="refresh"&&run){const attempt=refreshAttemptsForVersion(run.assetVersion).at(-1);if(attempt?.t019Status==="已采用")return {label:"消费就绪",tone:"success"};if(attempt?.resultStatus==="失败")return {label:"本体处理失败",tone:"danger"};if(attempt?.requestStatus==="结果未知")return {label:"本体处理结果待核对",tone:"warning"};if(attempt?.t018Status==="可消费候选")return {label:"本体处理通过 · 待正式采用",tone:"warning"};if(attempt?.requestStatus==="已受理")return {label:"请求已提交 · 本体处理中",tone:"running"};}
    if(state==="running") return {label:demoActive?(demo.kind==="node-debug"?"节点调试中":"试运行中"):"正式运行中",tone:"running"};
    if(state==="success") { if(!demoActive&&node.key==="publish")return {label:"资产已发布",tone:"success"};if(!demoActive&&node.key==="refresh"&&flow.refreshStatus!=="adopted")return {label:"本体处理通过 · 待正式采用",tone:"warning"};return {label:demoActive?(demo.kind==="node-debug"?"节点调试通过":"试运行通过"):"正式运行通过",tone:"success"}; }
    if(state==="failed") return {label:"运行失败",tone:"danger"};
    if(state==="waiting-confirmation") return {label:node.key==="publish"?"待发布":node.key==="refresh"?"待提交刷新请求":"等待确认",tone:"warning"};
    if(state==="waiting") return {label:"等待上游",tone:"neutral"};
    return {label:isDraft()?"待配置":run?"本次未执行":"尚未运行",tone:"neutral"};
  }
  function canvasNode(n,index,connected) {
    const d=defForNode(n),st=nodeVisualStatus(n),dim=Boolean(ui.canvas.selectedNode&&!connected.has(n.id));
    const targetCheck=ui.canvas.linkFrom?connectionCheck(ui.canvas.linkFrom,n.id):{ok:false};
    const release=d.libraryGroup==="发布",canLink=canEditCanvas()&&n.key!=="refresh"&&!ui.canvas.edges.some(e=>e.from===n.id);
    return `<div class="canvas-node ${canEditCanvas()?"editable":""} ${ui.canvas.selectedNode===n.id?"selected":""} ${dim?"dim":""} ${st.tone} ${release?`release-node node-type-${n.key}`:""} ${targetCheck.ok?"link-target-node":""} ${ui.canvas.linkFrom===n.id?"link-origin-node":""}" data-action="select-node" data-node-key="${n.key}" data-node-id="${n.id}" data-node-card="true" tabindex="0" role="button" aria-label="选择${esc(d.name)}节点" title="${targetCheck.ok?"连接到此节点":ui.canvas.linkFrom?esc(targetCheck.reason):esc(d.name)}" style="left:${n.x}px;top:${n.y}px;--node-color:${d.color}"><span class="node-index">${String(index+1).padStart(2,"0")}</span><span class="node-icon" style="color:${d.color}">${icon(d.icon)}</span><h3>${esc(d.name)}</h3><p>${esc(d.hint)}</p><span class="node-status">${st.tone==="running"?icon("refresh"):st.tone==="success"?icon("check"):st.tone==="danger"||st.tone==="warning"?icon("alert"):""}${esc(st.label)}</span>${canLink?`<button class="node-link-action" data-action="start-link" data-node-id="${n.id}" aria-label="从${esc(d.name)}连接下一节点" title="连接下一节点">${icon("link")}</button>`:""}</div>`;
  }

  function nodeRail(c) {
    if (c.layout.rightCollapsed) return `<aside class="node-rail collapsed"><button data-action="toggle-rail" title="展开节点配置">${icon("collapse")}</button><span>节点配置</span></aside>`;
    const node=selectedNode(), d=defForNode(node); const readonly=!isDraft();
    return `<aside class="node-rail"><div class="pane-head"><div><span>节点配置</span><strong>${node?esc(d.name):"管道属性"}</strong></div><div>${readonly?badge("只读","neutral"):badge("草稿","info")}<button class="icon-button" data-action="toggle-rail" title="收起配置栏">${icon("chevron")}</button></div></div><div class="rail-scroll">${node ? nodeConfiguration(node,readonly) : pipelineProperties(readonly)}</div></aside>`;
  }
  function readonlyAttr(readonly) { return readonly ? "disabled" : ""; }
  function pipelineProperties(readonly) { return `<div class="rail-section"><span>管道名称</span><input data-bind="canvas.name" value="${esc(ui.canvas.name)}" ${readonlyAttr(readonly)} /><span>用途说明</span><textarea data-bind="canvas.purpose" ${readonlyAttr(readonly)}>${esc(ui.canvas.purpose)}</textarea>${readonly?"":`<small class="field-help">修改后会标记为未保存；点击顶部“保存草稿”后写入当前草稿。</small>`}</div>${notice("未选择节点时，底栏展示整条管道的定义校验和本次执行日志。","info")}`; }
  function sourceForNode(node) { if(!node)return financeSource();if(!node.sourceId)return null;return D.sources.find(s=>s.id===node.sourceId)||null; }
  function assetForNode(node) { return D.targetAssets.find(a=>a.id===node?.assetId) || null; }
  function targetAssetForCanvas(canvas=ui.canvas) { return D.targetAssets.find(a=>a.t006Id===canvas?.targetAssetId||a.id===canvas?.targetAssetId)||null; }
  function refreshBindingSelectionKey(versionId) { return versionId?`asset:${versionId}`:""; }
  function ontologyDiscoveryCandidates() { return Array.isArray(flow.ontologyDiscovery?.candidates)?flow.ontologyDiscovery.candidates:[]; }
  function normalizeOntologyCandidate(candidate,publishedContext=null) {
    if(!candidate)return null;
    const discovery=publishedContext?.discovery||null,memberCoverage=candidate.memberCoverage||{},relationCoverage=candidate.relationCoverage||{};
    return {...candidate,id:candidate.refreshTargetId,name:candidate.bindingName||"本体消费绑定",status:candidate.currentStatus,owner:candidate.owner||"本体管理",targetAssetId:candidate.dataAssetId,publishedSemanticName:discovery?.name||candidate.bindingName||candidate.semanticVersionId,publishedSemanticVersionId:candidate.semanticVersionId,sourceMappingName:`来源映射 ${candidate.sourceMappingVersionId||"未提供"}`,memberMappingCount:Number(memberCoverage.covered||candidate.memberIds?.length||0),relationshipMappingCount:Number(relationCoverage.covered||candidate.relationIds?.length||0),mappingSummary:`覆盖 ${Number(memberCoverage.covered||0)}/${Number(memberCoverage.expected||0)} 个成员、${Number(relationCoverage.covered||0)}/${Number(relationCoverage.expected||0)} 条关系`,lastVerifiedAt:candidate.lastCheckedAt||flow.ontologyDiscovery?.readAt||"尚未读取"};
  }
  function selectedOntologyBindingId(canvas=ui.canvas) {
    const run=runForCanvas(),versionId=run?.assetVersion||candidateVersion()?.id,attempt=refreshAttemptsForVersion(versionId).at(-1);
    if(canvas===ui.canvas&&isDraft())return canvas?.ontologyBindingId||"";
    const canChooseForCandidate=Boolean(run?.id===flow.currentRunId&&versionId===flow.candidateVersionId&&["idle","failed"].includes(flow.refreshStatus));
    if(canChooseForCandidate)return flow.refreshBindingSelections[refreshBindingSelectionKey(versionId)]||attempt?.ontologyBindingId||canvas?.ontologyBindingId||"";
    if(attempt?.requestId)return attempt.ontologyBindingId||canvas?.ontologyBindingId||"";
    return flow.refreshBindingSelections[refreshBindingSelectionKey(versionId)]||canvas?.ontologyBindingId||"";
  }
  function ontologyBindingForCanvas(canvas=ui.canvas) { const id=selectedOntologyBindingId(canvas);return ontologyDiscoveryCandidates().find(x=>x.refreshTargetId===id)||null; }
  function completeC003DeliveryForVersion(version) {
    const gate=dataAssetDeliveryGate(version);return gate.okay?gate.record:null;
  }
  function trustedFormalAdoptionProjection(version,run,binding=ontologyBindingForCanvas()) {
    const authority=authorityVersion(version?.targetAssetId),attempt=refreshAttemptsForVersion(version?.id).slice().reverse().find(item=>item?.evidenceMode==="adoption-projection"&&item?.t019Status==="已采用")||null,published=binding?.publishedContext||null,issues=[];
    if(!version||version.trustedScenarioRegistration!==true)issues.push("数据资产不是可信正式注册版本");
    if(!run||run.trustedScenarioRegistration!==true||run.assetVersion!==version?.id)issues.push("正式运行与数据资产版本未形成可信精确绑定");
    if(!authority||authority.id!==version?.id)issues.push("当前权威数据资产版本与画布版本不一致");
    if(version?.t019Status!=="已采用"||!version?.t019EvidenceId||version?.t019Owner!=="本体管理")issues.push("数据资产缺少本体管理 T019 正式采用证据");
    if(!attempt||attempt.assetVersionId!==version?.id||attempt.runId!==run?.id||attempt.adoptedVersionId!==version?.id||attempt.t019EvidenceId!==version?.t019EvidenceId)issues.push("正式采用投影与运行、数据版本或 T019 证据不一致");
    if(!sameScenarioContext(version?.scenarioContext,run?.scenarioContext)||!sameScenarioContext(version?.scenarioContext,attempt?.scenarioContext)||!sameScenarioContext(version?.scenarioContext,flow.scenarioContext))issues.push("正式运行、采用投影与当前场景轮次不一致");
    if(flow.ontologyDiscovery?.trustedScenarioRegistration!==true||!binding||binding.allowRefreshSubmission!==true||binding.currentStatus!=="可用")issues.push("可信 Published 刷新目标投影不可定位");
    if(binding&&(binding.dataAssetId!==version?.targetAssetId||binding.semanticVersionId!==attempt?.targetT017||binding.sourceMappingVersionId!==attempt?.sourceMappingVersion||binding.evidenceLocator!==version?.t019EvidenceId||!sameScenarioContext(binding.scenarioContext,version?.scenarioContext)))issues.push("刷新目标、Published 版本、来源映射或 T019 证据不一致");
    if(!published?.discovery||published.discovery.versionId!==attempt?.targetT017||published.discovery.publicationState!=="Published"||published?.consumption?.currentFormal!==true||published.consumption.dataVersion!==version?.id||published.consumption.asOf!==version?.asOf)issues.push("Published 指针未证明同一版本已正式采用");
    if(flow.t019EvidenceId!==version?.t019EvidenceId||flow.t019Status!=="已采用"||flow.consumptionStatus!=="ready")issues.push("当前数据工程正式消费指针与 T019 证据不一致");
    return {okay:issues.length===0,issues,attempt,binding,authority,evidenceId:version?.t019EvidenceId||null,mode:"trusted-formal-adoption-projection"};
  }
  function ontologyBindingGate(canvas=ui.canvas) {
    const selectedId=selectedOntologyBindingId(canvas),binding=ontologyBindingForCanvas(canvas),targetAsset=targetAssetForCanvas(canvas),run=runForCanvas(),version=assetVersionForRun(run)||candidateVersion(),delivery=completeC003DeliveryForVersion(version),adoptionProjection=trustedFormalAdoptionProjection(version,run,binding),problems=[];
    if(version&&!delivery&&!adoptionProjection.okay)problems.push("精确数据资产交付尚未取得本体管理完整接收回执");
    if(flow.ontologyDiscoveryStatus==="reading")problems.push("正在从本体管理读取目标绑定");
    if(flow.ontologyDiscoveryStatus==="failed")problems.push(flow.ontologyDiscoveryError||"目标绑定读取失败");
    if(!flow.ontologyDiscovery)problems.push("尚未从本体管理读取目标绑定");
    if(!selectedId)problems.push("尚未选择本体管理中已建立的目标绑定");
    else if(!binding)problems.push("所选目标绑定已不可定位，请从本体管理重新同步");
    if(binding&&(!binding.allowRefreshSubmission||binding.currentStatus!=="可用"))problems.push(`目标绑定当前状态为“${binding.currentStatus||"不可用"}”`);
    const normalizedOwner = binding?.owner === "M01 本体管理" || binding?.owner === "本体管理" ? "本体管理" : binding?.owner;
    if(binding&&normalizedOwner!=="本体管理")problems.push("目标绑定的责任方不是本体管理");
    if(binding&&targetAsset&&binding.dataAssetId!==targetAsset.t006Id)problems.push("目标绑定与当前目标数据资产不匹配");
    if(binding&&(!binding.semanticVersionId||!binding.semanticVersion||!binding.sourceMappingVersionId||!binding.targetFingerprint))problems.push("目标绑定缺少已发布本体版本、映射版本或目标证据");
    if(binding&&targetAsset&&(!binding.memberCoverage?.complete||!binding.relationCoverage?.complete||Number(binding.memberCoverage?.covered)!==targetAsset.members?.length||Number(binding.relationCoverage?.covered)!==(targetAsset.relationships||[]).length))problems.push("目标绑定的成员或关系覆盖与目标数据资产不一致");
    if(binding&&!sameScenarioContext(binding.scenarioContext,version?.scenarioContext||flow.scenarioContext))problems.push("目标绑定与当前数据资产版本的场景上下文不一致");
    return {binding:normalizeOntologyCandidate(binding,binding?.publishedContext),rawBinding:binding,delivery,adoptionProjection:adoptionProjection.okay?adoptionProjection:null,okay:problems.length===0,problems};
  }
  function versionForNode(node) { const asset=assetForNode(node);return node?.assetVersionPolicy==="follow"?dataQualifiedVersionForAsset(asset):flow.assetVersions.find(v=>v.id===node?.assetVersionId)||null; }
  function sourceInputLabel(node) { const asset=assetForNode(node),source=sourceForNode(node);return node?.inputKind==="asset"?(asset?.name||"已发布数据资产"):(source?.name||"未选择数据源"); }
  function structureFingerprint(t006Id,members,memberScope="全部成员") {
    return `${t006Id}::${memberScope}::${(members||[]).map(m=>`${m.id}:${m.key}:${(m.fields||[]).map(f=>`${f.name}/${f.type}/${f.nullable?1:0}`).join(",")}`).join("|")}`;
  }
  function assetContractSnapshot(asset,policy,memberScope="全部成员") {
    if(!asset)return null;
    const members=(asset.members||[]).map(m=>({id:m.id,name:m.name,grain:m.grain,key:m.key,fields:(m.fields||[]).map(f=>({name:f.name,type:f.type,nullable:f.nullable,role:f.role}))}));
    const memberContractVersion=structureFingerprint(asset.t006Id||asset.id,members,memberScope);
    return {t006Id:asset.t006Id||asset.id,t006Name:asset.name,memberScope,members,fieldGrainContract:members.map(m=>`${m.name}｜${m.grain}｜${m.key}`).join("；"),qualityCondition:"正式质量允许消费且数据侧资格合格",resolutionPolicy:policy==="follow"?"每次正式运行选择最新数据侧合格版本并锁定":"固定指定版本",contractFingerprint:memberContractVersion};
  }
  function versionStructureFingerprint(asset,version,memberScope="全部成员") { return memberScope==="全部成员"&&version?.memberContractFingerprint?version.memberContractFingerprint:structureFingerprint(asset?.t006Id||asset?.id,version?.members?.length?version.members:asset?.members,memberScope); }
  function dependencyClosureForVersion(version,seen=new Set()) {
    if(!version||seen.has(version.id))return new Set();seen.add(version.id);
    const closure=new Set(version.dependencyClosure||[]),refs=version.dependencyVersions||[];
    (version.dependencies||[]).forEach(id=>closure.add(id));
    refs.forEach(ref=>{if(ref.t006Id)closure.add(ref.t006Id);const upstream=flow.assetVersions.find(v=>v.id===ref.t007Id);dependencyClosureForVersion(upstream,seen).forEach(id=>closure.add(id));});
    return closure;
  }
  function assetReuseGate(asset,version,canvas=ui.canvas,expectedContract=null) {
    if(!asset||!version)return {allowed:false,reason:"当前选择规则没有解析出可用资产版本"};
    if(version.targetAssetId&&version.targetAssetId!==asset.t006Id)return {allowed:false,reason:"该版本不属于所选目标数据资产"};
    if(!asset.reusePolicy?.allowed||version.allowReuse===false)return {allowed:false,reason:"资产责任方未开放复用"};
    if(!qualityAllowsConsumption(version.quality)||version.dataQualification!=="数据侧合格")return {allowed:false,reason:"该版本未通过数据侧质量门或警告尚未说明"};
    if(version.contentAccess==="不可访问"||version.retentionStatus==="已到期")return {allowed:false,reason:"该版本内容已不可访问或超出保留期"};
    if(canvas?.targetAssetId&&canvas.targetAssetId===asset.t006Id)return {allowed:false,reason:"当前管道不能把自身发布目标再作为输入"};
    if(dependencyClosureForVersion(version).has(canvas?.targetAssetId))return {allowed:false,reason:"该依赖链会形成直接或传递循环"};
    if(expectedContract){
      if(expectedContract.t006Id!==asset.t006Id)return {allowed:false,reason:"解析出的数据资产与管道定义保存的目标不一致"};
      const actual=versionStructureFingerprint(asset,version,expectedContract.memberScope||"全部成员");
      if(actual!==expectedContract.contractFingerprint)return {allowed:false,reason:"最新数据侧合格版本的成员、字段或粒度与当前管道定义不兼容"};
      if(!["正式质量允许消费且数据侧资格合格","正式质量通过且数据侧资格合格"].includes(expectedContract.qualityCondition))return {allowed:false,reason:"管道定义保存的复用质量条件已无法按当前规则执行"};
    }
    return {allowed:true,reason:expectedContract?"精确版本、结构合同、质量、保留与循环门禁均通过":"精确版本、质量、保留与循环门禁均通过"};
  }
  function sourceInputContext(node,canvas=ui.canvas) {
    if(node?.inputKind==="asset"){
      const asset=assetForNode(node),version=versionForNode(node),policy=node.assetVersionPolicy==="follow"?"自动选择最新合格版本并在运行时锁定":"固定指定版本",contract=node.assetContract||assetContractSnapshot(asset,node.assetVersionPolicy,node.memberScope),gate=assetReuseGate(asset,version,canvas,contract);return {kind:"已发布数据资产",resourceId:asset?.t006Id||asset?.id||"",name:asset?.name||"未选择资产",version:version?.id||"未解析版本",versionPolicy:policy,asOf:version?.asOf||"未知",status:gate.allowed?`${policy} · 可复用`:"不可复用",fingerprint:version?.sourceHash||"—",snapshot:version?.sourceSnapshot||"—",memberScope:node.memberScope||"全部成员",fieldGrainContract:contract?.fieldGrainContract||"未保存",qualityCondition:contract?.qualityCondition||"未保存",assetContractFingerprint:contract?.contractFingerprint||"未保存",allowed:gate.allowed,reason:gate.allowed?`${policy}已解析为 ${version.id}；${gate.reason}`:gate.reason};
    }
    const source=sourceForNode(node),snapshot=source?currentSnapshotForSource(source.id):null,confirmation=source?.id==="finance-workbook"?currentT008ForSnapshot(snapshot):null;
    if(node?.inputKind==="config-reference"){
      const published=Boolean(source?.sourceType==="manual-config"&&snapshot&&/已发布|Published/i.test(`${snapshot.status||""} ${source.registration||""}`));
      const version=snapshot?.configVersion||source?.configVersions?.at?.(-1)?.configVersion||snapshot?.snapshotId||"尚无 Published 版本";
      return {kind:"配置版本引用",resourceId:source?.id||"",name:source?.name||"未选择配置来源",version,asOf:snapshot?.asOf||source?.asOf||"未知",status:published?"Published 版本引用可锁定":"配置版本不可用",fingerprint:snapshot?.hash||"尚无",snapshot:snapshot?.snapshotId||snapshot?.fileName||"尚无",memberScope:node.memberScope||"配置版本引用",contentMode:"version-reference-only",passContentToPython:false,allowed:published,reason:published?"仅锁定 Published 配置版本身份；系数、阈值和配置正文不传入 Python，也不进入数据质量规则。":"当前配置来源尚无可锁定的 Published 版本。"};
    }
    const asOf=source?.id==="finance-workbook"?(confirmation?.asOf||"待确认"):snapshot?.asOf||"未知";
    const structureReady=source?.id!=="finance-workbook"||snapshot?.structureStatus==="结构已核验";
    const baseAllowed=Boolean(source&&!source.planned&&source.enabled&&source.selectable!==false&&snapshot&&structureReady);
    const timeReady=!/待确认|未知|不适用/.test(asOf);
    const allowed=baseAllowed&&timeReady;
    const reason=!source?"未选择数据源":source.planned?"后期规划来源尚未接入":source.selectable===false?"当前阶段禁止作为管道输入":!source.enabled?"数据源未启用":!snapshot?"当前场景轮次尚未选择真实读取形成的快照":!structureReady?"工作簿结构尚未核验，正式运行已阻断":!timeReady?"数据截至时间尚未在当前场景轮次确认":"精确快照、结构核验与数据截至时间均已就绪";
    return {kind:source?.category||"原始数据源",resourceId:source?.id||"",name:source?.name||"未选择来源",version:snapshot?.snapshotId||snapshot?.fileName||"尚无快照",asOf,status:allowed?"已确认·可正式运行":source?.id==="finance-workbook"&&snapshot?"已上传·仅可草稿调试":source?.registration||"不可使用",fingerprint:snapshot?.hash||"尚无",snapshot:snapshot?.fileName||"尚无",memberScope:"不适用",allowed,reason};
  }
  function selectedInputContexts(canvas=ui.canvas) { return (canvas?.nodes||[]).filter(n=>n.key==="source").map(n=>({node:n,...sourceInputContext(n)})); }
  function connectedInputContexts(targetId,canvas=ui.canvas) {
    if(!canvas)return [];
    return canvas.edges.filter(e=>e.to===targetId).map(e=>canvas.nodes.find(n=>n.id===e.from)).filter(n=>n?.key==="source").map(n=>({node:n,slot:canvas.edges.find(e=>e.from===n.id&&e.to===targetId)?.slot||"输入",...sourceInputContext(n,canvas)}));
  }
  function deleteNodeAction(readonly) { return readonly?"":`<div class="rail-danger">${button("删除当前节点","delete-node","soft","close")}</div>`; }
  function lockedInputContext(node) {
    const locked=runForCanvas()?.inputs?.find(x=>x.nodeId===node?.id);
    return !isDraft()&&locked?{...locked,allowed:true,status:"本次正式运行已锁定",reason:locked.gate||"本次正式运行使用这份输入，不随当前来源变化"}:null;
  }
  function activePythonModule(canvas=ui.canvas) { return canvas?.pythonModule||defaultPythonModule(); }
  function activeQualityProfile() { return SCENARIO_ID==="S003"?"债务风险数据发布前检查 v1.0.0":"融资数据发布前检查 v1.0.0"; }
  function nodeConfiguration(node,readonly) {
    const lock=readonlyAttr(readonly);
    const viewRun=runForCanvas(),viewStatus=runStatusForCanvas(),viewVersion=assetVersionForRun(viewRun),viewAttempt=refreshAttemptsForVersion(viewRun?.assetVersion).at(-1)||null,targetAsset=targetAssetForCanvas(),bindingGate=ontologyBindingGate(),ontologyBinding=bindingGate.binding;
    if(node.key==="source") { const context=lockedInputContext(node)||sourceInputContext(node),source=sourceForNode(node),slot=slotForSource(node),asset=assetForNode(node),snapshot=source?currentSnapshotForSource(source.id):null,confirmation=source?.id==="finance-workbook"?currentT008ForSnapshot(snapshot):null,configReference=node.inputKind==="config-reference";return `<div class="rail-section"><label>命名输入槽</label><input value="${esc(slot?.name||"连接 Python 后分配")}" readonly /><label>选择的管道输入</label><button class="source-select" data-action="source-picker" ${lock}>${icon(node.inputKind==="asset"?"package":configReference?"history":source?.category==="共享文件夹"?"folder":"file")}<span><strong>${esc(context.name)}</strong><small>${esc(context.kind)} · ${esc(context.version)}</small></span>${icon("chevron")}</button><label>${node.inputKind==="asset"?"资产版本策略":configReference?"配置绑定策略":"快照选择策略"}</label><input value="${esc(node.inputKind==="asset"?(context.versionPolicy||"固定指定版本"):configReference?"仅锁定 Published 版本引用，不传配置正文":"正式运行时锁定一个确定快照")}" readonly />${node.inputKind==="asset"?`<label>成员范围</label><select data-action="asset-member-scope" ${lock}><option ${node.memberScope==="全部成员"?"selected":""}>全部成员</option><option ${node.memberScope==="融资明细及其必需参考成员"?"selected":""}>融资明细及其必需参考成员</option></select><small class="field-help">${asset?.members?.length||0} 个可用成员；正式运行锁定此范围，不随上游变化。</small><label>字段与粒度要求</label><textarea readonly>${esc(context.fieldGrainContract||"随本次正式运行锁定")}</textarea><label>复用质量条件</label><input value="${esc(context.qualityCondition||"正式质量允许消费且数据侧资格合格")}" readonly />`:""}<label>本次使用版本</label><input value="${esc(context.version)}" readonly /><div class="rail-facts">${fact("数据截至",context.asOf)}${fact("输入状态",context.status)}${fact("来源节点",ui.canvas.nodes.filter(n=>n.key==="source").length+" 个")}${fact(node.inputKind==="asset"?"结构核验":configReference?"绑定内容":"内容指纹",node.inputKind==="asset"?(context.assetContractFingerprint||"本次运行已锁定"):configReference?"仅版本标识与场景身份":context.fingerprint)}</div>${source?.id==="finance-workbook"&&node.inputKind!=="asset"&&!confirmation&&isDraft()?button("确认数据截至时间","confirm-snapshot","primary","check"):""}<button class="rail-link" data-action="bottom-tab" data-value="fields">在底部查看字段结构</button></div>${notice(context.reason,context.allowed?"success":"warning")}${deleteNodeAction(readonly)}`; }
    if(node.key==="python") {const module=activePythonModule();const s003=SCENARIO_ID==="S003";return `<div class="rail-section"><label>预置受控脚本</label><select ${lock}><option>${esc(module.name)}</option></select><label>脚本版本</label><select ${lock}><option>${esc(module.version)}</option></select><label>脚本功能说明</label><p>${esc(module.description|| (s003?"只标准化工作簿财务字段、企业身份和评估上下文；不处理企业因子输入，不计算风险评分。":"将工作簿标准化为四成员三关系候选结构，不计算 Metric、Rule 或业务阈值。"))}</p><label>本节点用途说明</label><textarea ${lock}>${esc(s003?"标准化债务风险工作簿财务数据，并保留字段、粒度和来源追溯。独立 T053 输入快照和模型配置正文均不传入 Python。":"标准化融资工作簿，并保留字段、粒度和来源追溯。")}</textarea><label>数据截至参数</label><input value="由已锁定来源快照提供" readonly /><div class="rail-facts">${fact("上游推断",`${ui.canvas.edges.filter(e=>e.to===node.id).length} 个输入槽`)}${fact("配置正文输入",s003?"0 个":"不适用")}${fact("输出结构","由受控脚本合同产生")}</div>${button(ui.canvas.demo.kind==="node-debug"&&ui.canvas.demo.status==="running"?"调试中":"调试此节点","debug-node","primary","bug",readonly||ui.canvas.demo.status==="running")}<button class="rail-link" data-action="bottom-tab" data-value="code">查看只读代码</button><button class="rail-link" data-action="bottom-tab" data-value="debug">查看即时调试</button></div>${s003?notice("调节因子配置和风险分档配置只作为 Published 版本引用参与运行证据，不作为 Python 参数或质量规则。","info","配置边界"):""}${deleteNodeAction(readonly)}`;}
    if(node.key==="quality") {const rules=ui.canvas.qualityRules||[];return `<div class="rail-section"><label>检查集</label><input value="${esc(activeQualityProfile())}" readonly /><div class="rail-facts">${fact("已配置规则",`${rules.length} 项`)}${fact("启用规则",`${rules.filter(x=>x.enabled!==false).length} 项`)}${fact("失败处理","硬阻断停止发布")}${fact("当前结果",viewRun?.qualityId?viewRun.quality:"尚未执行")}</div><button class="rail-link" data-action="bottom-tab" data-value="rules">查看已设置规则</button><button class="rail-link" data-action="bottom-tab" data-value="results">查看本次检查结果</button>${button("增加通用规则","add-quality-rule","soft","plus",readonly)}</div>${notice(SCENARIO_ID==="S003"?"本节点只检查结构、企业身份、财务字段、人工取值三态、评估上下文和来源完整性；不检查风险评分、系数、权重或阈值。":"规则配置与运行结果按同一个稳定规则编号对应；没有结果时明确显示未执行。","info")}${deleteNodeAction(readonly)}`;}
    if(node.key==="publish") return `<div class="rail-section"><label>发布目标</label><input value="${esc(targetAsset?.name||"未绑定目标资产")}" readonly /><label>输出结构</label><input value="${targetAsset?.members?.length||0} 个成员 · ${(targetAsset?.relationships||[]).length} 条关系" readonly /><label>版本内容摘要</label><textarea readonly>${esc(targetAsset?.name||"数据资产")} · 数据截至 ${esc(viewRun?.asOf||flow.asOfDate)}</textarea><label>发布条件</label><p>正式运行完成，发布前检查允许发布，成员和关系合同完整。</p><div class="rail-facts">${fact("当前状态",viewRun?.assetVersion?"资产版本已发布":viewStatus==="awaiting-publish"?"发布条件已满足":"等待正式运行与检查")}${fact("数据资产版本",viewRun?.assetVersion||"尚未产生")}${fact("消费状态",viewVersion?.consumptionStatus||"尚不可消费")}${fact("目录状态",viewRun?.assetVersion?"已进入数据资产目录":"尚未进入目录")}</div><button class="rail-link" data-action="bottom-tab" data-value="release">查看发布条件与当前状态</button><details class="contract-identifiers"><summary>查看技术证据编号</summary><small>发布目标：${esc(targetAsset?.t006Id||"未绑定")}；数据资产版本：${esc(viewRun?.assetVersion||"尚未产生")}；质量结果：${esc(viewRun?.qualityId||"尚未形成")}</small></details></div>${deleteNodeAction(readonly)}`;
    const currentBindingId=selectedOntologyBindingId(),canChooseBinding=Boolean(viewRun?.assetVersion&&viewRun.id===flow.currentRunId&&flow.runStatus==="published"&&["idle","failed"].includes(flow.refreshStatus)),bindingOptions=`<option value="">未选择目标绑定</option>${ontologyDiscoveryCandidates().map(raw=>normalizeOntologyCandidate(raw,raw.publishedContext)).map(x=>`<option value="${esc(x.id)}" ${currentBindingId===x.id?"selected":""} ${x.targetAssetId!==ui.canvas.targetAssetId||!x.allowRefreshSubmission?"disabled":""}>${esc(x.name)} · ${esc(x.status)}</option>`).join("")}`;
    const bindingSelector=canChooseBinding?`<select data-action="ontology-binding-select">${bindingOptions}</select>`:`<input value="${esc(ontologyBinding?.name||"未选择目标绑定")}" readonly />`;
    const discoveryAction=button(flow.ontologyDiscoveryStatus==="reading"?"正在读取":"读取 / 重新读取目标绑定","discover-ontology-bindings","soft","refresh",flow.ontologyDiscoveryStatus==="reading"||!viewVersion);
    const discoverySummary=flow.ontologyDiscovery?`<small class="field-help">最近读取：${esc(flow.ontologyDiscovery.readAt||"未记录")} · 用途：${esc(flow.ontologyDiscovery.readPurpose||"发现")} · ${esc(flow.ontologyDiscovery.responseId||"未取得响应标识")}</small>`:`<small class="field-help">资产发布且 M01 完整接收后，从本体管理读取可用绑定。</small>`;
    const bindingSummary=ontologyBinding?`<div class="readonly-binding-card"><div><strong>${esc(ontologyBinding.name)}</strong>${badge(ontologyBinding.status,ontologyBinding.status==="可用"?"success":"warning")}</div><dl><dt>目标本体</dt><dd>${esc(ontologyBinding.publishedSemanticName)}</dd><dt>提交的数据资产</dt><dd>${esc(targetAsset?.name||ontologyBinding.targetAssetId)}</dd><dt>映射覆盖</dt><dd>${ontologyBinding.memberMappingCount} 个成员 · ${ontologyBinding.relationshipMappingCount} 条关系</dd><dt>映射配置</dt><dd>${esc(ontologyBinding.sourceMappingName||"已建立的数据到本体映射")}</dd><dt>维护方</dt><dd>${esc(ontologyBinding.owner)}</dd><dt>最近核验</dt><dd>${esc(ontologyBinding.lastVerifiedAt)}</dd></dl><p>${esc(ontologyBinding.mappingSummary)}</p></div>`:`${notice(flow.ontologyDiscoveryError||"本体管理尚未返回与当前数据资产匹配的可用目标绑定。数据资产仍可发布，但不能提交刷新请求。",flow.ontologyDiscoveryStatus==="failed"?"danger":"warning","刷新未就绪")}<a class="btn soft" href="${esc(ontologyManagementHref())}" target="_blank" rel="noopener">前往本体管理处理</a>`;
    const refreshIssue=viewAttempt&&(viewAttempt.resultStatus==="失败"||viewAttempt.requestStatus==="结果未知")?`${notice(viewAttempt.failureReason||"本体处理结果暂时无法确认。",viewAttempt.resultStatus==="失败"?"danger":"warning",viewAttempt.resultStatus==="失败"?"本体处理失败":"结果暂时无法确认")}<div class="rail-facts">${fact("影响","本次版本不可进入正式消费")}${fact("恢复方式",viewAttempt.recovery||"查询原请求，确认结果后再继续")}</div>`:"";
    return `<div class="rail-section"><label>读取本体管理目标</label>${discoveryAction}${discoverySummary}<label>选择已有目标绑定</label>${bindingSelector}<small class="field-help">目标绑定由本体管理建立。资产发布后、请求提交前可为本次资产版本选择；提交后随请求锁定为只读。</small>${bindingSummary}<label>本次提交版本</label><input value="${esc(viewVersion?.id||viewRun?.assetVersion||"发布数据资产后自动带入")}" readonly /><div class="rail-facts">${fact("数据截至",viewVersion?.asOf||viewRun?.asOf||"等待发布")}${fact("质量状态",viewVersion?.quality||viewRun?.quality||"等待正式质量")}${fact("刷新请求",viewAttempt?.requestId?viewAttempt.requestStatus:"尚未提交")}${fact("本体处理",viewAttempt?.resultId?viewAttempt.resultStatus||"已返回":"尚未返回")}${fact("本体侧正式采用",viewAttempt?.t019Status||"尚未采用")}${fact("消费状态",viewVersion?.consumptionStatus||"不可消费")}</div>${refreshIssue}<button class="rail-link" data-action="bottom-tab" data-value="flow">查看从发布到消费就绪</button><button class="rail-link" data-action="bottom-tab" data-value="lineage">查看端到端沿袭证据</button><details class="contract-identifiers"><summary>查看技术证据编号</summary><small>C032 发现：${esc(flow.ontologyDiscovery?.responseId||"尚未读取")}；目标绑定：${esc(ontologyBinding?.id||"未选择")}；目标已发布本体版本：${esc(ontologyBinding?.publishedSemanticVersionId||"未绑定")}；映射版本：${esc(ontologyBinding?.sourceMappingVersionId||"未绑定")}；刷新请求：${esc(viewAttempt?.requestId||"尚未创建")}；处理结果：${esc(viewAttempt?.resultId||"尚未返回")}；正式采用证据：${esc(viewAttempt?.t019EvidenceId||"尚未取得")}</small></details></div>${notice(`本节点只选择本体管理中已建立的目标绑定、提交本次数据资产版本并读取回执。不能创建或修改业务对象、属性、关系、字段映射，也不能决定或切换下游正式使用哪个版本。`,bindingGate.okay?"info":"warning")}${deleteNodeAction(readonly)}`;
  }

  function tabsForNode(node) {
    if(!node) return [["validation","管道校验"],["logs","运行日志"]];
    if(node.key==="source") return [["snapshot","快照内容"],["fields","字段结构"],["samples","样例数据"],["registration","快照信息"],["logs","运行日志"]];
    if(node.key==="python") return [["description","脚本说明"],["code","代码查看"],["input","输入预览"],["output","输出预览"],["debug","即时调试"],["logs","运行日志"]];
    if(node.key==="quality") return [["rules","检查规则"],["results","检查结果"],["failures","失败记录"],["evidence","证据"],["logs","运行日志"]];
    if(node.key==="publish") return [["release","发布与结果"],["members","成员与关系"],["schema","字段与粒度"],["diff","版本差异"],["logs","运行日志"]];
    return [["flow","从发布到消费"],["refreshResult","本体处理结果"],["refreshFailure","失败与恢复"],["requestHistory","刷新记录"],["lineage","沿袭证据"]];
  }
  function normalizeBottomTab(node) { const tabs=tabsForNode(node); if(!tabs.some(x=>x[0]===ui.canvas.bottomTab)) ui.canvas.bottomTab=tabs[0][0]; return tabs; }
  function bottomPanel(c) {
    const node=selectedNode(),d=defForNode(node),tabs=normalizeBottomTab(node),l=c.layout,inputs=canvasInputContexts(),viewRun=runForCanvas();
    const contextKind=isDraft()&&c.demo.status!=="idle"?(c.demo.kind==="node-debug"?"节点调试":"完整输入试运行"):viewRun?`正式运行 ${viewRun.id}`:"尚未运行";
    const inputCopy=inputs.length?inputs.map(x=>`${x.name} · ${x.version}`).join("；"):"未选择输入版本";
    const asOf=[...new Set(inputs.map(x=>x.asOf))].join(" / ")||"未知";
    return `<section class="node-bottom"><div class="bottom-head"><div class="bottom-context"><span style="color:${d.color}">${icon(d.icon)}</span><div><strong>${node?esc(d.name):"整条管道"}</strong><small>${esc(c.definitionLabel)} · ${esc(contextKind)}</small></div></div><div class="bottom-meta" title="${esc(inputCopy)}"><span>输入</span><strong>${esc(inputCopy)}</strong><span>数据截至</span><strong>${esc(asOf)}</strong></div><div class="bottom-tabs">${tabs.map(x=>`<button class="${c.bottomTab===x[0]?"active":""}" data-action="bottom-tab" data-value="${x[0]}">${esc(x[1])}</button>`).join("")}</div><div class="bottom-actions"><button class="icon-button" data-action="toggle-bottom-max" title="${l.bottomMax?"恢复默认高度":"最大化底部面板"}">${icon("expand")}</button><button class="icon-button" data-action="toggle-bottom" title="${l.bottomCollapsed?"展开底部面板":"收起底部面板"}">${icon(l.bottomCollapsed?"chevron":"down")}</button></div></div>${l.bottomCollapsed?"":`<div class="bottom-content">${bottomContent(node,c.bottomTab)}</div>`}</section>`;
  }
  function runEmpty(title,copy) { return emptyState(title,copy); }
  function eventTone(status) { return /失败|阻断|无法判断/.test(status)?"danger":/完成|通过|成功|已锁定/.test(status)?"success":/运行|开始|读取|处理中|查询/.test(status)?"info":"neutral"; }
  function executionEventsForContext(nodeKey="") {
    if(isDraft())return (ui.canvas.demo.events||[]).filter(e=>!nodeKey||e.nodeKey===nodeKey||e.nodeKey==="pipeline");
    const run=runForCanvas();if(!run)return [];
    return (run.nodeExecutions||[]).filter(x=>!nodeKey||x.key===nodeKey).flatMap(x=>{
      const rows=[];if(x.startedAt)rows.push({at:x.startedAt,execution:"正式运行",node:x.name,nodeKey:x.key,status:"开始",message:x.inputSummary||"开始执行",duration:"—"});
      if(x.endedAt||x.status!=="等待")rows.push({at:x.endedAt||x.startedAt||run.startedAt,execution:"正式运行",node:x.name,nodeKey:x.key,status:x.status,message:x.outputSummary||"尚未形成输出",duration:elapsedText(x.startedAt,x.endedAt)});
      return rows;
    });
  }
  function executionLogView(events,emptyTitle="尚无执行日志") {
    if(!events.length)return runEmpty(emptyTitle,"执行 Python 节点调试、完整输入试运行或正式运行后，会按时间显示节点、状态、说明和耗时。");
    return `<div class="bottom-table-scroll"><div class="execution-log-list"><div class="execution-log-row head"><span>时间</span><span>执行类型</span><span>节点</span><span>状态</span><span>说明</span><span>耗时</span></div>${events.map(e=>`<div class="execution-log-row"><time>${esc(e.at||"—")}</time><span>${esc(e.execution||"—")}</span><strong>${esc(e.node||"整条管道")}</strong>${badge(e.status||"记录",eventTone(e.status||""))}<span>${esc(e.message||"—")}</span><small>${esc(e.duration||"—")}</small></div>`).join("")}</div></div>`;
  }
  function bottomContent(node,tab) {
    if(!node) return pipelineBottom(tab);
    if(node.key==="source") return sourceBottom(node,tab);
    if(node.key==="python") return pythonBottom(tab);
    if(node.key==="quality") return qualityBottom(tab);
    if(node.key==="publish") return publishBottom(tab);
    return refreshBottom(tab);
  }
  function pipelineBottom(tab) {
    const v=validationResult();
    if(tab==="logs") return executionLogView(executionEventsForContext());
    const stale=ui.canvas.validationSeen&&ui.canvas.validationFingerprint!==v.fingerprint,seen=ui.canvas.validationSeen&&!stale;
    const title=!ui.canvas.validationSeen?(isDraft()?"尚未校验":"未保留发布前校验证据"):stale?"配置或输入已变化 · 请重新校验":v.okay?(v.warnings?`${v.passed} 项通过 · ${v.warnings} 项刷新未就绪`:`${v.passed} 项通过 · 0 项未通过`):`${v.passed} 项通过 · ${v.failed} 项未通过`;
    const tone=!ui.canvas.validationSeen||stale?"neutral":v.okay&&!v.warnings?"success":"warning";
    const validationAction=isDraft()?button(seen?"重新校验":"校验当前草稿","validate-canvas",v.okay?"soft":"primary","check"):badge(seen?"发布前校验证据":"只读定义","neutral");
    return `<div class="validation-toolbar"><div>${badge(title,tone)}<strong>管道定义安全检查</strong><p>检查节点、连线、命名输入槽、输入准备状态和发布配置。校验不读取完整数据，也不代表数据质量已经通过。</p></div>${validationAction}</div><div class="bottom-table-scroll"><div class="validation-list"><div class="validation-row head"><span>检查项</span><span>检查内容</span><span>结果</span><span>问题与影响</span><span>恢复建议</span></div>${v.checks.map(x=>`<div class="validation-row"><strong>${esc(x.name)}</strong><span>${esc(x.content)}</span>${seen?badge(x.okay?"通过":x.blocking?"未通过":"刷新未就绪",x.okay?"success":x.blocking?"danger":"warning"):badge(isDraft()?"待校验":"无历史证据","neutral")}<span>${seen?(x.okay?"未发现定义问题":esc(`${x.issues.join("；")}。${x.impact}`)):isDraft()?"执行校验后显示结果":"该历史定义未保留逐项校验结果"}</span><span>${seen?(x.okay?"无需处理":esc(x.recovery)):"—"}</span></div>`).join("")}</div></div><div class="validation-footer"><span>最近校验：${esc(seen?ui.canvas.validationAt:isDraft()?"尚未校验当前配置":"未保留")}</span><span>目标绑定缺失只阻断刷新提交，不阻断发布定义或数据资产。</span></div>`;
  }
  function sourceBottom(node,tab) {
    const locked=runForCanvas()?.inputs?.find(x=>x.nodeId===node.id),context=!isDraft()&&locked?{...locked,allowed:true,status:"正式运行已锁定",reason:locked.gate||"正式运行已锁定"}:sourceInputContext(node);
    if(tab==="logs")return executionLogView(executionEventsForContext("source"),"尚无数据源执行日志");
    if(node.inputKind==="asset"){
      const asset=assetForNode(node),version=locked?flow.assetVersions.find(v=>v.id===locked.version):versionForNode(node);
      if(tab==="fields")return `<div class="schema-matrix">${(asset?.members||[]).map(m=>`<div><strong>${esc(m.name)}</strong><span>${esc(m.grain)}</span><span>主键：${esc(m.key)}</span><span>版本：${esc(version?.id||"未锁定")}</span></div>`).join("")}</div>`;
      if(tab==="samples")return runEmpty("不在输入节点暴露资产整表","已发布资产复用只展示成员合同和有限受控预览；本管道正式运行时会锁定精确版本与成员范围。");
      if(tab==="registration")return `<div class="bottom-metrics">${fact("输入类型","已发布数据资产")}${fact("精确版本",context.version)}${fact("数据截至",context.asOf)}${fact("复用门禁",context.status)}</div>${notice("该输入按版本和成员范围锁定；后续新版本不会改写本次运行。","success")}`;
      return `<div class="bottom-metrics">${fact("资产包",context.name)}${fact("精确资产版本",context.version)}${fact("成员",`${asset?.members?.length||0} 个`)}${fact("关系",`${asset?.relationships?.length||0} 条`)}</div><div class="sheet-summary-row">${(asset?.members||[]).map(m=>`<span><strong>${esc(m.name)}</strong><small>${esc(m.grain)} · ${esc(m.key)}</small></span>`).join("")}</div>`;
    }
    if(node.inputKind==="config-reference"){
      const source=sourceForNode(node),kind=source?.configKind==="factor"?"调节因子配置":"风险分档配置",snapshot=currentSnapshotForSource(source?.id);
      if(tab==="fields")return `<div class="schema-matrix"><div><strong>配置资源身份</strong><span>sourceId / configId</span><span>由 M02 保留人工输入版本</span></div><div><strong>Published 版本指针</strong><span>configVersion / snapshotId</span><span>本次运行只锁定此引用</span></div><div><strong>场景身份</strong><span>scenarioId / scenarioVersion / scenarioRunId</span><span>禁止跨运行复用</span></div><div><strong>边界声明</strong><span>contentMode = version-reference-only</span><span>passContentToPython = false</span></div></div>`;
      if(tab==="samples")return notice(`${kind}正文请从数据源详情的“内容与字段”或“配置编辑”页签查看。管道节点只展示版本引用，不在 Python 输入预览中暴露系数或阈值。`,"info","配置正文不进入 Python");
      if(tab==="registration")return `<div class="bottom-metrics">${fact("输入类型","配置版本引用")}${fact("Published 版本",context.version)}${fact("配置快照",snapshot?.snapshotId||context.snapshot)}${fact("数据截至",context.asOf)}</div>${notice("版本引用随正式运行锁定；切换配置必须创建新的 scenarioRunId 后重跑，不覆盖历史运行。","success")}`;
      return `<div class="bottom-metrics">${fact("配置来源",context.name)}${fact("Published 版本",context.version)}${fact("绑定方式","仅版本引用")}${fact("Python 内容输入","否")}</div>${notice("调节因子系数、评分权重和风险阈值归 M01 Published 模型；数据工程管道不得读取其正文进行计算或质量判定。","info","Owner 边界")}`;
    }
    const source=sourceForNode(node),wb=D.workbooks[source?.workbookKey],snapshot=locked?source?.snapshots?.find(s=>s.snapshotId===locked.version||s.fileName===locked.snapshot):currentSnapshotForSource(source?.id),confirmation=source?.id==="finance-workbook"?(locked?(/\d{4}-\d{2}-\d{2}/.test(context.asOf)?{asOf:context.asOf}:null):currentT008ForSnapshot(snapshot)):null;
    if(!wb||!snapshot)return `<div class="bottom-metrics">${fact("来源",context.name)}${fact("快照",context.version)}${fact("数据截至",context.asOf)}${fact("状态",context.status)}</div>${notice(snapshot?"该来源尚无可展示的工作簿结构；正式运行前仍须确认字段合同。":"当前场景轮次尚未选择真实读取形成的快照，不能显示历史快照的字段、样例或取得时间。","warning")}`;
    const inputSheets=wb.sheets.filter(s=>s.input!==false),excluded=wb.sheets.filter(s=>s.input===false),sheet=inputSheets[0];
    if(tab==="fields") return `<div class="bottom-table-layout"><div>${badge("来源快照结构","info")}<h3>${esc(sheet.name)}</h3><p>${sheet.rows} 条 · ${sheet.cols} 字段 · 表头第 ${sheet.headerRow} 行</p></div><div class="field-pill-grid">${sheet.fields.map((f,i)=>`<span><em>${i+1}</em>${esc(f)}<small>${fieldType(f)}</small></span>`).join("")}</div></div>`;
    if(tab==="samples") return `<div class="bottom-table-layout"><p class="section-note">脱敏样例 · 最多 5 行 · 不代表完整数据</p>${sampleTable(sheet)}</div>`;
    if(tab==="registration") { const pendingFinanceTime=source?.id==="finance-workbook"&&!confirmation;return `<div class="bottom-metrics">${fact("状态",context.status)}${fact("取得时间",snapshot.acquiredAt||"尚未取得")}${fact("内容指纹",context.fingerprint)}${fact("数据截至",context.asOf)}</div>${pendingFinanceTime&&isDraft()?button("确认数据截至时间","confirm-snapshot","primary","check"):notice(pendingFinanceTime?"当前输入尚未确认数据截至时间，不能用于正式运行。":"当前时点与精确来源快照会在正式运行开始时共同锁定。",pendingFinanceTime?"warning":"success")}`; }
    return `<div class="bottom-metrics">${fact("当前快照",context.snapshot)}${fact("业务输入 Sheet",`${inputSheets.length} 个`)}${fact("未纳入处理",excluded.map(s=>s.name).join("、")||"无")}${fact("主成员",`${sheet.rows} 条 · ${sheet.cols} 列`)}</div><div class="sheet-summary-row">${inputSheets.map(s=>`<span><strong>${esc(s.name)}</strong><small>${s.rows} 条 · ${s.cols} 列 · ${esc(s.classification)}</small></span>`).join("")}</div>`;
  }
  function activePythonCode() {
    if(SCENARIO_ID!=="S003")return D.pythonCode;
    return [
      "from controlled_modules import debt_risk_input_standardize",
      "",
      "def run(financial_workbook_snapshot, *, assessment_at, currency=\"CNY\", amount_unit=\"元\"):",
      "    # 企业因子由独立 T053 输入快照提供，模型参数由 M01 Published 模型提供；均不传入本函数",
      "    financial = debt_risk_input_standardize.read_member(financial_workbook_snapshot, \"财务数据\")",
      "    financial = debt_risk_input_standardize.normalize_financial_fields(financial, current=\"I\", prior=\"AA\")",
      "    return debt_risk_input_standardize.package_candidate(financial, assessment_at, currency, amount_unit)",
      "",
      "# 不计算风险评分、因子系数、评分权重、风险阈值或 Action Type"
    ];
  }
  function activePythonLogic() {
    if(SCENARIO_ID!=="S003")return D.pythonLogic;
    return [
      {step:"01",title:"读取财务输入",lines:"5",copy:"读取并锁定本轮财务工作簿快照。"},
      {step:"02",title:"统一财务字段口径",lines:"6",copy:"按 I / AA 字段、评估时点、CNY 和人民币元形成候选事实。"},
      {step:"03",title:"封装候选数据资产",lines:"7",copy:"形成财务数据成员及沿袭；企业因子输入快照与 Published 风险模型在后续运行中独立绑定。"}
    ];
  }
  function highlightedCode() {
    const q=ui.codeSearch.trim().toLowerCase();
    return activePythonCode().map((line,i)=>{ let html=esc(line).replace(/\b(from|import|def|return)\b/g,'<span class="tok-key">$1</span>').replace(/(&quot;.*?&quot;)/g,'<span class="tok-string">$1</span>').replace(/(#.*)$/g,'<span class="tok-comment">$1</span>'); if(q&&line.toLowerCase().includes(q)) html=`<mark>${html}</mark>`; return `<div class="code-line"><span>${i+1}</span><code>${html||" "}</code></div>`; }).join("");
  }
  function pythonLogicGuide() {
    return `<aside class="code-logic-guide"><div class="logic-guide-head"><span class="eyebrow">处理逻辑说明</span><strong>这个节点做什么</strong><p>${SCENARIO_ID==="S003"?"把财务工作簿快照转换为后续质量检查和资产发布可识别的财务候选结构。":"把原始融资工作簿转换为后续质量检查和资产发布都能识别的标准候选结构。"}</p></div><div class="logic-step-list">${activePythonLogic().map(x=>`<article><span>${esc(x.step)}</span><div><strong>${esc(x.title)}</strong><small>对应代码 ${esc(x.lines)} 行</small><p>${esc(x.copy)}</p></div></article>`).join("")}</div><div class="logic-boundary"><strong>输出边界</strong><p>${SCENARIO_ID==="S003"?"只形成财务候选事实与沿袭；独立 T053 企业因子输入、调节系数、评分权重、固定计算语义和风险阈值不进入 Python 或数据质量规则。":"只形成候选成员、关系与沿袭，不计算 Metric、Rule 或业务阈值；调试成功也不会发布资产。"}</p></div></aside>`;
  }
  function pythonOutputSampleTable(inputs) {
    if(inputs?.some(x=>x.resourceId==="s003-workbook")){
      const detail=D.workbooks.s003.sheets.find(s=>s.id==="s003-financial"),asOfDisplay=[...new Set(inputs.map(x=>x.asOf))].join(" / ")||"未知";
      const rows=detail.samples.slice(0,5).map(row=>`<tr><td>${esc(row[0])}</td><td>${esc(formatValue(row[1]))}</td><td>${esc(formatValue(row[2]))}</td><td>${esc(formatValue(row[3]))}</td><td>${esc(formatValue(row[4]))}</td><td>${esc(asOfDisplay)}</td><td>${badge("字段与身份已标准化","success")}</td></tr>`).join("");
      return `<div class="data-table-wrap sample-table python-output-table"><table class="data-table"><thead><tr><th>企业</th><th>流动负债期末</th><th>营业收入</th><th>利润总额</th><th>资产总计</th><th>评估时点</th><th>处理状态</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }
    if(!inputs?.some(x=>x.resourceId==="finance-workbook"&&x.kind!=="已发布数据资产"))return notice("当前输入不是融资工作簿快照；输出预览只展示成员合同，不套用融资工作簿样例。","info");
    const detail=D.workbooks.finance.sheets.find(s=>s.id==="finance-detail");
    const asOfDisplay=[...new Set(inputs.map(x=>x.asOf))].join(" / ")||"未知";
    const rows=detail.samples.slice(0,5).map(row=>`<tr><td>${esc(row[5])}</td><td>${esc(row[1])}</td><td>${esc(row[4])}</td><td>${esc(formatValue(row[8]))}</td><td>${esc(row[7]==="人民币"?"CNY":row[7])}</td><td>${esc(asOfDisplay)}</td><td>${badge("主体/机构已匹配","success")}</td></tr>`).join("");
    return `<div class="data-table-wrap sample-table python-output-table"><table class="data-table"><thead><tr><th>借据编号</th><th>借款人规范值</th><th>融资机构规范值</th><th>余额（人民币元）</th><th>币种</th><th>数据截至</th><th>关系校验</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  function pythonBottom(tab) {
    const demo=ui.canvas.demo;
    const pythonNode=ui.canvas.nodes.find(n=>n.key==="python");
    const module=activePythonModule();
    const s003=SCENARIO_ID==="S003";
    const debugRunning=demo.kind==="node-debug"&&demo.status==="running";
    const debugComplete=demo.kind==="node-debug"&&demo.status==="complete";
    const trialRunning=demo.kind==="trial"&&demo.status==="running"&&demo.nodeStates[pythonNode?.id]==="running";
    const trialComplete=demo.kind==="trial"&&demo.nodeStates[pythonNode?.id]==="success";
    const previewComplete=debugComplete||trialComplete;
    const debugStamp=demo.completedAt||demo.startedAt||"当前调试";
    const viewRun=runForCanvas(),inputs=!isDraft()&&viewRun?.inputs?.length?canvasInputContexts():demo.status!=="idle"&&demo.lockedInputs?.length?demo.lockedInputs:connectedInputContexts(pythonNode?.id),targetAsset=targetAssetForCanvas()||D.targetAssets[0];
    const financeConfirmation=currentT008ForSnapshot(currentFinanceSnapshot()),inputsTimeReady=inputs.every(x=>/\d{4}-\d{2}-\d{2}/.test(x.asOf));
    const asOfDisplay=[...new Set(inputs.map(x=>x.asOf))].join(" / ")||(financeConfirmation?.asOf||"待确认");
    if(tab==="description") return `<div class="bottom-split"><div><h3>${esc(module.name)}</h3><p>${esc(module.description||"已登记、版本化、按白名单选择的预置处理模块。输入由上游连线决定；输出结构由脚本合同和实际运行结果产生。")}</p></div><div class="bottom-metrics">${fact("脚本版本",module.version)}${fact("开放度","只读选择")}${fact("在线编辑","不建设")}${fact("任意脚本上传","不建设")}</div></div>${s003?notice("两个配置来源只提供 Published 版本引用；Python 读取内容只有工作簿数据，不接收因子系数、评分权重或风险阈值。","info","运行输入边界"):""}`;
    if(tab==="code") return `<div class="code-review-layout"><div class="code-view"><div class="code-toolbar"><div><strong>${esc(module.id)}</strong>${badge("只读","neutral")}${badge(module.version,"plain")}</div><label>${icon("search")}<input id="code-search" value="${esc(ui.codeSearch)}" placeholder="搜索代码" /></label></div><div class="code-lines">${highlightedCode()}</div></div>${pythonLogicGuide()}</div>`;
    if(tab==="input") {
      if(!inputs.length) return runEmpty("输入尚未连接","请先连接至少一个数据源节点并为每个输入选择精确快照或资产版本。");
      const pendingTime=inputs.some(x=>!/\d{4}-\d{2}-\d{2}/.test(x.asOf))?notice("本次仅使用草稿中的数据截至参数进行结构调试；确认全部时点前仍不能发布管道定义或正式运行。","warning","数据时点尚未确认"):"";
      const refreshed=previewComplete?`${notice(`Python 输入预览已按本次${debugComplete?"节点调试":"完整输入试运行"}重新读取；刷新时间 ${debugStamp}。`,"success","输入预览已刷新")}`:(debugRunning||trialRunning)?`${notice("正在读取本次执行锁定的输入；完成后会刷新样例和摘要。","info","输入读取中")}`:"";
      const state=previewComplete?(debugComplete&&!inputsTimeReady?"节点调试已读取 · 时点待确认":debugComplete?"节点调试已读取":"试运行已读取"):debugRunning||trialRunning?"读取中":nodeStateCode(pythonNode)==="running"?"正式处理中":viewRun?"正式输入已锁定":"已连接·待执行";
      const workbookInput=inputs.find(x=>x.resourceId===(s003?"s003-workbook":"finance-workbook")&&x.kind!=="已发布数据资产");
      const sampleSheet=s003?D.workbooks.s003.sheets.find(s=>s.id==="s003-financial"):D.workbooks.finance.sheets.find(s=>s.id==="finance-detail");
      const sample=previewComplete?(workbookInput?`<div class="preview-section-head"><div><strong>本次${debugComplete?"调试":"试运行"}样例</strong><span>来自已连接的${s003?"财务数据":"融资明细"}输入 · 脱敏展示 5 行</span></div>${badge("已刷新","success")}</div>${sampleTable(sampleSheet)}`:notice("输入预览已刷新；当前输入按资产成员合同展示，不在此暴露整表或套用其他来源样例。","success")):"";
      const configRefs=inputs.filter(x=>x.kind==="配置版本引用");
      return `${refreshed}${pendingTime}<div class="bottom-split"><div><span class="eyebrow">本次处理输入</span><h3>${esc(inputs.map(x=>x.name).join(" + "))}</h3><p>${s003?"工作簿数据进入标准化；配置来源只锁定版本身份。所有输入与当前 scenarioRunId 共同固定，不使用上传时间替代业务时点。":"每个输入身份由精确快照或资产版本、数据截至时间和上游节点共同确定，不使用上传时间替代业务时点。"}</p></div><div class="bottom-metrics">${fact("输入版本",inputs.map(x=>x.version).join("；"))}${fact("数据截至",asOfDisplay)}${fact("来源节点",`${inputs.length} 个`)}${fact("配置正文进入 Python",s003?"0 个":"不适用")}${fact("运行绑定",viewRun?.id||demo.startedAt||"尚未执行")}</div></div>${s003&&configRefs.length?notice(`${configRefs.map(x=>`${x.name} ${x.version}`).join("；")} 仅作为 Published 版本引用锁定。`,"info","配置引用"):""}<div class="sheet-summary-row">${inputs.map(x=>`<span><strong>${esc(x.name)}</strong><small>${esc(x.kind)} · ${esc(x.version)}</small></span>`).join("")}<span><strong>币种与金额</strong><small>CNY · 人民币元</small></span><span><strong>输入状态</strong><small>${state}</small></span></div>${sample}`;
    }
    if(tab==="output") {
      const formalReady=!isDraft()&&nodeStateCode(pythonNode)==="success";
      if((debugRunning||trialRunning)&&!formalReady) return `<div class="bottom-summary">${badge("正在刷新","info")}<strong>正在生成 Python ${debugRunning?"调试":"试运行"}输出</strong><span>完成后展示 ${targetAsset.members.length} 个成员、${(targetAsset.relationships||[]).length} 条关系和转换样例；不会形成正式资产版本。</span></div>`;
      if(!previewComplete&&!formalReady) return runEmpty("尚无输出预览","完成 Python 节点调试、试运行到 Python，或正式运行到达该节点后再查看。");
      const debugNotice=previewComplete&&!formalReady?notice(`输出预览已根据本次${debugComplete?"节点调试":"完整输入试运行"}刷新；完成时间 ${debugStamp}。结果不进入正式质量与发布。`,"success",debugComplete?"调试输出已刷新":"试运行输出已刷新"):notice("候选结构已形成，仍须通过正式数据检查并由发布节点生成新的发布版本。","success");
      const candidateState=previewComplete&&!formalReady?(debugComplete?"调试候选 · 未发布":"试运行候选 · 未发布"):nodeStateCode(pythonNode)==="running"?"正在生成":viewRun?"本次正式输出已形成":"等待质量门或发布";
      return `${debugNotice}${debugComplete&&inputs.some(x=>!/\d{4}-\d{2}-\d{2}/.test(x.asOf))&&!formalReady?notice("输出使用草稿时点参数完成结构调试；正式运行前仍须确认数据截至时间。","warning","时点待确认"):""}<div class="bottom-split"><div><span class="eyebrow">Python 输出结构</span><h3>${targetAsset.members.length} 个成员 · ${(targetAsset.relationships||[]).length} 条关系候选结构</h3><p>这些成员属于本次运行、试运行或调试的候选；只有发布节点成功后才会生成正式数据资产版本和稳定成员编号。</p></div><div class="bottom-metrics">${fact("处理模块",module.name)}${fact("脚本版本",module.version)}${fact("数据截至",asOfDisplay)}${fact("候选状态",candidateState)}</div></div><div class="schema-matrix">${targetAsset.members.map((m,i)=>`<div><strong>${esc(m.name)}</strong><span>${esc(m.grain)}</span><span>主键：${esc(m.key)}</span><span>候选成员 ${String(i+1).padStart(2,"0")} · ${viewRun?.id||demo.startedAt||"尚未执行"}</span></div>`).join("")}</div><div class="relationship-list">${(targetAsset.relationships||[]).map(x=>`<span>${icon("link")}${esc(relationLabel(x))}</span>`).join("")}</div><div class="preview-section-head"><div><strong>转换结果样例</strong><span>仅对已连接的${s003?"债务风险工作簿":"融资工作簿"}输入展示规范值和结构校验</span></div>${badge(inputs.some(x=>x.resourceId===(s003?"s003-workbook":"finance-workbook"))?"5 行":"结构视图","plain")}</div>${pythonOutputSampleTable(inputs)}`;
    }
    if(tab==="debug") return ui.canvas.demo.kind!=="node-debug" ? runEmpty("尚无 Python 节点调试","在右栏点击“调试此节点”，系统只使用限定样例验证当前脚本和参数。") : `<div class="bottom-summary">${badge(ui.canvas.demo.status==="running"?"节点调试中":"节点调试通过",ui.canvas.demo.status==="running"?"info":"success")}<strong>${esc(ui.canvas.demo.message)}</strong><span>未执行数据检查、发布数据资产或提交本体刷新请求，也未形成正式运行编号。</span></div>`;
    return executionLogView(executionEventsForContext("python"),"尚无 Python 执行日志");
  }
  function qualityBottom(tab) {
    const viewRun=runForCanvas(),viewStatus=runStatusForCanvas(),formalPassed=Boolean(/通过|有警告 · 已说明/.test(viewRun?.quality||"")&&viewRun?.qualityId),formalWarning=Boolean(viewRun?.quality==="有警告"&&viewRun?.qualityId);
    const qualityNode=ui.canvas.nodes.find(n=>n.key==="quality");
    const formalRunning=nodeStateCode(qualityNode)==="running";
    const trialReached=ui.canvas.demo.kind==="trial"&&ui.canvas.demo.nodeStates[qualityNode?.id]==="success";
    const trialRunning=ui.canvas.demo.kind==="trial"&&ui.canvas.demo.nodeStates[qualityNode?.id]==="running";
    const nodeDebugOnly=ui.canvas.demo.kind==="node-debug";
    const running=formalRunning||trialRunning;
    const configured=(ui.canvas.qualityRules||[]).filter(x=>x.enabled!==false);
    const formalFixture=viewRun?.qualityId?D.qualityResults.find(x=>x.id===viewRun.qualityId):null;
    const fixtureById=new Map((viewRun?.qualityChecks||formalFixture?.checks||[]).flatMap(x=>[[x.id||x.checkId,x],[x.checkId||x.id,x]]));
    const stateForRule=(rule)=>{
      const isWarning=rule.severity==="警告",isInstitutionFailure=rule.id==="FIN-Q-006",isCoverageUnknown=rule.id==="FIN-Q-003";
      if(formalPassed){if(viewRun.quality.includes("警告")&&isWarning)return ["警告已说明","warning"];return ["通过","success"];}
      if(formalWarning)return isWarning?["有警告 · 待说明","warning"]:["通过","success"];
      if(viewRun?.quality==="失败")return isInstitutionFailure?["失败","danger"]:["通过","success"];
      if(viewRun?.quality==="无法判断")return isCoverageUnknown?["无法判断","danger"]:["通过","success"];
      if(formalRunning)return ["检查中","info"];
      if(trialReached)return ["临时通过","success"];
      if(trialRunning)return ["试运行中","info"];
      return ["未执行","neutral"];
    };
    if(tab==="rules")return `<div class="quality-head"><strong>${esc(activeQualityProfile())}</strong><span>${configured.length} 项启用规则 · 规则会随管道定义锁定</span></div>${SCENARIO_ID==="S003"?notice("检查集不包含风险评分、因子系数、评分权重、风险阈值或风险分档命中。","info","明确排除"):""}<div class="bottom-table-scroll"><div class="rule-table"><div class="rule-row head"><span>规则</span><span>类型与范围</span><span>判断条件</span><span>级别</span><span>生效方式</span><span>失败处理</span><span>状态</span></div>${configured.map(rule=>`<div class="rule-row"><div><strong>${esc(rule.id)} · ${esc(rule.name)}</strong><small>${esc(rule.version||"当前版本")}</small></div><span>${esc(rule.type)}<small>${esc(rule.scope)}</small></span><span>${esc(rule.condition)}</span>${badge(rule.severity,rule.severity==="硬阻断"?"danger":"warning")}<span>到达本节点时自动执行<small>试运行生成临时结果；正式运行决定发布门</small></span><span>${esc(rule.failureEffect)}<small>${esc(rule.recovery)}</small></span>${badge("已启用","success")}</div>`).join("")}</div></div>`;
    if(tab==="results") return `${nodeDebugOnly&&!trialReached&&!formalPassed?notice("Python 限定样例调试不执行数据质量门；如需临时检查完整输入，请选择数据检查节点后执行“试运行到此节点”。","info"):""}<div class="quality-table"><div class="quality-head"><strong>本次检查结果</strong><span>${formalPassed?`正式质量结果 ${viewRun.qualityId} · 发布门已打开`:formalWarning?`正式质量结果 ${viewRun.qualityId} · 警告尚未处置`:viewRun?.quality==="失败"||viewRun?.quality==="无法判断"?`正式质量结果 ${viewRun.qualityId} · 发布门已阻断`:trialReached?"完整输入临时检查 · 不可用于发布":"尚未执行检查"}</span></div>${configured.map((rule,i)=>{const state=stateForRule(rule),result=fixtureById.get(rule.id)||fixtureById.get(rule.sourceCheckId);const checked=result?.checkedCount??result?.actual??result?.expected??"已执行",failed=result?.failedCount??result?.invalidCount??0,impact=result?.impact||result?.evidence||result?.note||result?.status||"通过";return `<div class="quality-row"><span>${i+1}</span><div><strong>${esc(rule.id)} · ${esc(rule.name)}</strong><small>${esc(rule.scope)}</small></div><em>${esc(rule.severity)}</em>${badge(state[0],state[1])}<small>${result?`检查 ${checked} · 问题 ${failed} · ${esc(impact)}`:`判断：${esc(rule.condition)}`} · 恢复：${esc(rule.recovery)}</small></div>`;}).join("")}</div>${formalWarning&&viewRun?.id===flow.currentRunId?`${notice("硬阻断为 0，但警告不能自动打开发布门。填写理由后继续，或明确结束本次不发布。","warning")}<div class="button-row">${button("填写理由并继续","quality-warning-decision","primary","check")}${button("本次不发布","finish-without-publish","soft","close")}</div>`:""}`;
    if(tab==="failures") { const failed=viewStatus==="failed"&&viewRun?.failureNode,undetermined=viewRun?.quality==="无法判断"; return `<div class="bottom-split"><div>${badge(failed?(undetermined?"正式质量无法判断":"正式运行失败"):formalPassed?"本次运行无失败":"尚无正式失败",failed?"danger":formalPassed?"success":"neutral")}<h3>${failed?esc(viewRun.failureReason):formalPassed?`${configured.length} 项检查均已完成`:"失败将在此定位"}</h3><p>按失败规则、成员、字段类别和有限记录范围分组，不展示整表；无法判断不会被解释为通过。</p></div><div class="bottom-metrics">${fact("失败规则",failed&&!undetermined?"1 项":formalPassed?"0 项":"待运行")}${fact("硬阻断",failed&&viewRun.quality==="失败"?"1 项":formalPassed?"0 项":"待运行")}${fact("无法判断",undetermined?"1 项":formalPassed?"0 项":"待运行")}${fact("警告",formalWarning?"1 项":formalPassed&&viewRun?.quality.includes("警告")?"1 项":"0 项")}${fact("恢复",failed?viewRun.recovery||"修复后重试":"从失败运行发起重试")}</div></div>`; }
    if(tab==="evidence") return `<div class="schema-matrix"><div><strong>检查配置证据</strong><span>${SCENARIO_ID==="S003"?"规则、范围、结构条件和严重级别":"规则、范围、阈值和严重级别"}</span><span>责任方：数据工程</span></div><div><strong>字段类别证据</strong><span>标识、金额、日期、引用键</span><span>不暴露整表</span></div><div><strong>失败证据</strong><span>有限样例、影响数量和位置</span><span>${formalPassed?"正式质量证据已生成":trialReached?"临时检查，不可发布":"待正式运行"}</span></div><div><strong>恢复证据</strong><span>修复建议、重试关系和结果</span><span>正式失败后生成</span></div></div>${notice(trialReached?"本次仅形成完整输入的临时检查结果，不能作为发布依据。":SCENARIO_ID==="S003"?"正式质量编号、失败数量和发布门结论必须由正式运行生成；风险模型配置不属于数据质量证据。":"正式质量编号、失败数量和发布门结论必须由正式运行生成。","info")}`;
    if(nodeDebugOnly)return runEmpty("样例调试不生成质量日志","Python 节点调试只验证脚本和参数，数据检查节点未执行。");
    return executionLogView(executionEventsForContext("quality"),"尚无数据检查日志");
  }
  function publishBottom(tab) {
    const a=targetAssetForCanvas()||D.targetAssets[0],viewRun=runForCanvas(),viewStatus=runStatusForCanvas(),viewVersion=assetVersionForRun(viewRun),actionRun=actionRunForCanvas();
    const publishedMembers=viewVersion?.members?.length?viewVersion.members:a.members,publishedRelationships=viewVersion?.relationships?.length?viewVersion.relationships:(a.relationshipContracts||a.relationships||[]);
    if(tab==="logs")return executionLogView(executionEventsForContext("publish"),"尚无发布节点执行日志");
    if(tab==="members") return `<div class="member-grid bottom-members">${publishedMembers.map(m=>`<article><span class="eyebrow">${viewRun?.assetVersion?"已发布成员":"成员合同"}</span><h3>${esc(m.name)}</h3>${fact("粒度",m.grain)}${fact("主键",m.key)}${fact("记录数",m.rowCount??"待正式运行")}${fact("质量",m.qualityStatus||"待正式运行")}<p>${viewRun?.assetVersion?`稳定标识：${esc(m.stableId||"可在版本详情定位")}`:"发布时生成稳定成员标识。"}</p></article>`).join("")}</div><div class="relationship-list">${publishedRelationships.map(x=>`<span>${icon("link")}<strong>${esc(relationLabel(x))}</strong><small>${x.checkedCount==null?"待正式运行核验":`检查 ${x.checkedCount} 条 · 未匹配 ${x.unmatchedCount} 条 · ${x.status}`}</small></span>`).join("")}</div>`;
    if(tab==="schema") return `<div class="schema-matrix">${publishedMembers.map(m=>`<div><strong>${esc(m.name)}</strong><span>${esc(m.grain)}</span><span>主键：${esc(m.key)}</span><span>${viewRun?.assetVersion?`字段 ${m.fields?.length||0} 个 · 记录 ${m.rowCount??"未记录"} 条`:`字段 ${m.fields?.length||0} 个 · 行数由正式运行生成`}</span></div>`).join("")}</div>`;
    if(tab==="diff") {const latest=latestVersionForAsset(a),authority=authorityVersionForAsset(a),previous=previousAuthorityVersionForAsset(a),versions=versionsForAsset(a);return latest&&authority&&latest.id!==authority.id?`<div class="bottom-metrics">${fact("当前正式消费版本",authority.id)}${fact("待采用候选",latest.id)}${fact("结构变化",latest.memberContractFingerprint===authority.memberContractFingerprint?"未发现不兼容变化":"成员或字段结构有变化")}${fact("数据变化",latest.businessOutputFingerprint===authority.businessOutputFingerprint?"没有数据变化":"业务数据有变化")}</div>`:versions.length>1?`<div class="bottom-metrics">${fact("上一可信版本",previous?.id||"无")}${fact("当前正式消费版本",authority?.id||"无")}${fact("结构变化","未发现不兼容变化")}${fact("数据变化","新版本已完成采用")}</div>`:runEmpty("尚无可比较版本","发布第二个版本后，将显示与当前正式消费版本的成员、结构和数据摘要差异。");}
    if(tab==="release") return viewRun?.assetVersion?`<div class="bottom-split"><div>${badge("资产已发布","success")}<h3>${esc(viewRun.assetVersion)}</h3><p>数据资产版本已经进入目录；本体侧正式采用前不会替换当前消费版本。</p></div><div class="bottom-metrics">${fact("数据截至",viewRun.asOf)}${fact("质量状态",viewRun.quality)}${fact("数据侧资格",viewVersion?.dataQualification||"合格")}${fact("当前正式消费版本",authorityVersionForAsset(a)?.id||"无")}</div></div><div class="button-row"><a class="btn" href="#/resources/asset/${esc(a.id)}?tab=overview&version=${encodeURIComponent(viewRun.assetVersion)}">查看版本详情</a>${actionRun&&viewStatus==="published"?button("前往提交本体刷新请求","select-node","primary","refresh",false,`data-node-id="${esc(ui.canvas.nodes.find(n=>n.key==="refresh")?.id||"")}"`):""}</div><details class="contract-identifiers"><summary>查看技术证据编号</summary><small>数据资产版本 ${esc(viewRun.assetVersion)} · 正式质量结果 ${esc(viewRun.qualityId||"无")} · 正式运行 ${esc(viewRun.id)}</small></details>`:actionRun&&viewStatus==="awaiting-publish"?`${notice(`正式运行与质量门已经完成，当前质量结论为“${viewRun.quality}”。确认后发布一个不会被后续数据覆盖的独立版本。`,"success","发布条件已满足")}<div class="bottom-metrics">${fact("发布目标",a.name)}${fact("输出结构",`${a.members.length} 个成员 · ${(a.relationships||[]).length} 条关系`)}${fact("数据截至",viewRun.asOf)}${fact("发布后状态","进入资产目录 · 尚不可正式消费")}</div>${button("确认发布数据资产","publish-asset","primary","package")}`:isDraft()&&ui.canvas.demo.status!=="idle"?runEmpty("试运行未执行发布数据资产","发布数据资产仅在正式运行通过质量门后启用。") : runEmpty("等待正式运行与质量检查","正式运行通过质量门后，本页显示最终发布预览和唯一确认操作。");
    return runEmpty("尚无该页签内容","先完成正式运行和质量门，再核对发布结果。")
  }
  function refreshStep(label,copy,state,tone="neutral",owner="",time="") { const stateLabel=state==="done"?"已完成":state==="active"?"进行中":state==="error"?"失败":state==="blocked"?"已阻断":"等待";return `<article class="refresh-step ${state}"><span class="refresh-step-marker">${state==="done"?icon("check"):state==="active"?icon("refresh"):state==="error"||state==="blocked"?icon("alert"):icon("clock")}</span><div><strong>${esc(label)}</strong><p>${esc(copy)}</p>${owner||time?`<small>${owner?`负责：${esc(owner)}`:""}${owner&&time?" · ":""}${time?esc(time):""}</small>`:""}</div>${badge(stateLabel,tone)}</article>`; }
  function refreshBottom(tab) {
    const viewRun=runForCanvas(),actionRun=actionRunForCanvas(),version=assetVersionForRun(viewRun),authority=authorityVersion(),attempts=refreshAttemptsForVersion(version?.id),attempt=attempts.at(-1)||null;
    const active=Boolean(actionRun&&version?.id===flow.candidateVersionId),status=active?flow.refreshStatus:attempt?.t019Status==="已采用"?"adopted":attempt?.resultStatus==="失败"?"failed":attempt?.requestStatus==="结果未知"?"unknown":attempt?.t018Status==="可消费候选"?"eligible":attempt?.requestStatus==="已受理"?"request-accepted":attempt?.requestId?"request-created":"idle";
    const requestDone=Boolean(attempt?.requestId),processingDone=attempt?.resultStatus==="成功"&&attempt?.t018Status==="可消费候选",adopted=status==="adopted",requestActive=["request-created","request-accepted","querying"].includes(status),historicallyReplaced=Boolean(adopted&&version?.id!==authority?.id);
    if(tab==="flow") {
      let action="";
      const bindingGate=ontologyBindingGate(),binding=bindingGate.binding;
      if(isDraft()&&ui.canvas.demo.status!=="idle")action=notice("当前尚无可提交的数据资产版本。资产发布后可提交刷新请求。","info");
      else if(active&&["awaiting-c003-receipt","c003-blocked"].includes(status)){const deliveryGate=dataAssetDeliveryGate(version);action=`${notice(deliveryGate.reason||"正在等待 M01 返回精确资产合同与完整回执",status==="c003-blocked"?"danger":"info",status==="c003-blocked"?"资产交付阻断":"正在核对交付证据")}<div class="button-row">${button("重新读取 M01 接收证据","recheck-c003-delivery","soft","refresh",c003RetryInFlight,`data-asset-version-id="${esc(version?.id||"")}"`)}${button("按证据恢复 C003 交付","retry-c003-delivery","primary","refresh",c003RetryInFlight,`data-asset-version-id="${esc(version?.id||"")}"`)}</div>`;}
      else if(active&&status==="idle"&&!bindingGate.okay)action=`${notice(bindingGate.problems.join("；"),"danger","提交已阻断")}<div class="button-row">${button(flow.ontologyDiscoveryStatus==="reading"?"正在读取目标":"读取 / 重新读取目标绑定","discover-ontology-bindings","primary","refresh",flow.ontologyDiscoveryStatus==="reading")}<a class="btn soft" href="${esc(ontologyManagementHref())}" target="_blank" rel="noopener">前往本体管理处理</a></div>`;
      else if(active&&status==="idle")action=button("提交本体刷新请求","open-refresh-submit","primary","refresh");
      else if(active&&status==="unknown")action=button("查询原刷新请求","query-refresh","primary","search");
      else if(active&&status==="failed")action=`<div class="button-row">${button("重新提交刷新请求","open-refresh-submit","primary","refresh")}${button("结束本次候选并保留历史","finish-failed-candidate","soft","close")}</div>`;
      else if(active&&status==="eligible")action=notice("刷新处理已完成，正在等待本体管理返回正式采用证据。当前正式消费版本保持不变。","warning");
      else if(requestActive)action=`${notice(status==="querying"?"正在查询原刷新请求；查询完成前不会重复提交。":"刷新请求已由本体管理受理，候选版本尚不可消费。","info")}${status!=="querying"?button("查询本体处理与采用状态","query-refresh","soft","search"):""}`;
      else if(adopted)action=notice(historicallyReplaced?`本次版本 ${version?.id||""} 曾被正式采用，当前已由 ${authority?.id||"后续版本"} 替代。`:`本次版本 ${version?.id||""} 已正式采用并消费就绪。`,historicallyReplaced?"info":"success");
      else if(!version)action=notice("请先完成正式运行、数据检查和数据资产发布。","info");
      const publishState=version?"done":"active",requestState=requestDone?(attempt?.requestStatus==="已创建"?"active":"done"):version&&!bindingGate.okay?"blocked":version&&bindingGate.okay?"active":"waiting",processState=processingDone?"done":status==="failed"?"error":status==="unknown"?"blocked":requestActive?"active":"waiting",adoptionState=adopted?"done":["failed","unknown"].includes(status)?"blocked":processingDone?"active":"waiting",readyState=adopted?"done":["failed","unknown"].includes(status)?"blocked":"waiting";
      return `<div class="refresh-flow-head"><div><span class="eyebrow">从数据资产发布到消费就绪</span><h3>${esc(binding?.name||"尚未选择已有目标绑定")}</h3><p>本节点只提交请求；本体处理、兼容性校验、正式采用和下游使用版本均由本体管理负责。</p></div><div class="bottom-metrics">${fact("本次数据资产版本",version?.id||"等待发布")}${fact("正在给下游使用",authority?.id||"无")}${fact("本次版本使用状态",historicallyReplaced?"历史上曾消费就绪":version?.consumptionStatus||"不可消费")}</div></div>${version?c003DeliveryEvidencePanel(version,{compact:true}):""}<div class="refresh-stepper five">${refreshStep("1. 发布数据资产",version?`${version.id} · 质量 ${version.quality} · 数据截至 ${version.asOf}`:"等待正式运行、质量门和发布",publishState,version?"success":"info","数据工程",version?.publishedAt||"")}${refreshStep("2. 提交刷新请求",requestDone?`${attempt.requestStatus} · ${attempt.requestId}`:bindingGate.okay?"携带本次数据资产版本与只读目标绑定":"缺少可用目标绑定，提交被阻断",requestState,requestDone&&attempt?.requestStatus!=="已创建"?"success":bindingGate.okay?"info":"danger","数据工程",attempt?.acceptedAt||attempt?.createdAt||"")}${refreshStep("3. 本体处理与兼容性校验",processingDone?"本体处理成功，当前版本具备候选资格":status==="failed"?attempt?.failureReason||"处理失败":status==="unknown"?"结果尚未确认，已暂停后续步骤":requestActive?"本体管理正在处理":"等待刷新请求",processState,processingDone?"success":status==="failed"?"danger":status==="unknown"?"warning":"info","本体管理",attempt?.resultAt||attempt?.acceptedAt||"")}${refreshStep("4. 本体侧正式采用",adopted?"本体管理已采用本次版本":processingDone?"等待本体管理正式采用":status==="failed"?"处理失败，不能正式采用":status==="unknown"?"处理结果待核对，不能正式采用":"等待本体处理成功",adoptionState,adopted?"success":["failed","unknown"].includes(status)?"danger":"warning","本体管理",attempt?.adoptedAt||"")}${refreshStep("5. 消费就绪",adopted?(historicallyReplaced?`曾消费就绪；当前由 ${authority?.id||"后续版本"} 服务`:`${version?.id} 已成为正在给下游使用的版本`):`当前仍使用 ${authority?.id||"无正式版本"}`,readyState,adopted?"success":["failed","unknown"].includes(status)?"danger":"neutral","平台消费入口",attempt?.adoptedAt||"")}</div><div class="refresh-primary-action">${action}</div><details class="contract-identifiers"><summary>查看技术证据编号</summary><small>目标绑定：${esc(binding?.id||"未选择")}；目标已发布本体版本：${esc(attempt?.targetT017||binding?.publishedSemanticVersionId||"未绑定")}；刷新请求：${esc(attempt?.requestId||"尚未创建")}；处理结果：${esc(attempt?.resultId||"尚未返回")}；候选资格：${esc(attempt?.t018Status||"尚未形成")}；正式采用证据：${esc(attempt?.t019EvidenceId||"尚未取得")}</small></details>`;
    }
    if(tab==="refreshResult") {
      if(adopted)return `<div class="bottom-split"><div>${badge(historicallyReplaced?"历史上曾消费就绪":"消费就绪",historicallyReplaced?"info":"success")}<h3>${esc(version?.id||"")} 已取得正式采用证据</h3><p>${historicallyReplaced?`该版本当前已由 ${esc(authority?.id||"后续版本")} 替代。`:"本体处理、可消费候选资格和正式采用均已取得独立证据。"}</p></div><div class="bottom-metrics">${fact("刷新请求",attempt?.requestId)}${fact("处理结果",attempt?.resultId)}${fact("正式采用证据",attempt?.t019EvidenceId)}${fact("当前给下游使用",authority?.id||"无")}</div></div>`;
      if(processingDone)return `<div class="bottom-split"><div>${badge("处理成功 · 待正式采用","warning")}<h3>本次版本已具备可消费候选资格</h3><p>它仍未成为当前正式消费版本；取得正式采用证据前，${authority?`上一可信版本 ${esc(authority.id)} 继续服务`:"尚无正式消费版本"}。</p></div><div class="bottom-metrics">${fact("目标本体版本",attempt?.targetT017||"未返回")}${fact("主键检查",attempt?.primaryKeyCheck||"未返回")}${fact("关系端点检查",attempt?.endpointCheck||"未返回")}${fact("消费读取准备",attempt?.indexStatus||"未返回")}</div></div>`;
      if(status==="failed")return notice(attempt?.failureReason||"本体处理失败；本次版本不可消费。","danger","本体处理失败");
      if(status==="unknown")return notice(attempt?.failureReason||"处理结果暂时无法确认；请查询原刷新请求。","warning","处理结果未知");
      if(requestDone)return `<div class="bottom-summary">${badge(requestActive?"处理中":"已提交","info")}<strong>${esc(attempt.requestId)}</strong><span>正在等待本体处理与兼容性校验；当前正式消费版本未切换。</span></div>`;
      return runEmpty("尚无本体处理结果","提交刷新请求后显示受理、兼容性校验、对象与关系处理摘要。")
    }
    if(tab==="refreshFailure") {
      if(status==="failed")return `<div class="bottom-split"><div>${badge("本体处理失败","danger")}<h3>${esc(attempt?.failureReason||"处理失败")}</h3><p>失败候选与原刷新请求均保留；当前正式消费版本没有切换。</p></div><div class="bottom-metrics">${fact("失败阶段","本体处理与兼容性校验")}${fact("影响","本次版本不可消费")}${fact("当前正式消费版本",authority?.id||"无")}${fact("恢复方式",attempt?.recovery||"修复映射后重新提交刷新请求")}</div></div>${active?`<div class="button-row">${button("重新提交刷新请求","open-refresh-submit","primary","refresh")}${button("结束本次候选并保留历史","finish-failed-candidate","soft","close")}</div>`:""}`;
      if(status==="unknown")return `${notice(attempt?.failureReason||"在等待窗口内没有取得明确结果。","warning","结果暂时无法确认")}${active?button("查询原刷新请求","query-refresh","primary","search"):""}`;
      return runEmpty("当前没有失败","失败时显示发生阶段、原因、影响、上一可信版本和唯一恢复动作。")
    }
    if(tab==="requestHistory")return attempts.length?`<div class="run-list">${[...attempts].reverse().map(a=>`<article class="run-row"><div><span class="eyebrow">刷新请求</span><strong>${esc(a.requestId)}</strong><small>${esc(a.createdAt)}${a.retryOf?` · 重试自 ${esc(a.retryOf)}`:""}</small></div>${badge(a.t019Status==="已采用"?"已正式采用":a.resultStatus==="失败"?"处理失败":a.t018Status==="可消费候选"?"待正式采用":a.requestStatus||"处理中",a.t019Status==="已采用"?"success":a.resultStatus==="失败"?"danger":"info")}<div>${fact("本次资产版本",a.assetVersionId)}${fact("质量结果",a.qualityResultId)}${fact("处理结果",a.resultId||"尚未返回")}${fact("正式采用证据",a.t019EvidenceId||"尚未取得")}</div><details class="contract-identifiers"><summary>查看证据标识</summary><small>目标本体 ${esc(a.targetT017||"未记录")} · 来源映射 ${esc(a.sourceMappingVersion||"未记录")}</small></details></article>`).join("")}</div>`:runEmpty("尚无刷新请求历史","提交首个刷新请求后在此保留每次请求、重试来源、处理结果和正式采用证据。")
    const binding=attempt?.ontologyBindingId?normalizeOntologyCandidate((attempt.c032Candidate||ontologyDiscoveryCandidates().find(x=>x.refreshTargetId===attempt.ontologyBindingId)),attempt.publishedContext):ontologyBindingGate().binding;
    return `<div class="lineage-chain"><span>来源输入<small>${esc(viewRun?.snapshot||"待运行")}</small></span>${icon("chevron")}<span>定义与正式运行<small>${esc(viewRun?.definitionVersion||ui.canvas.definitionLabel)} · ${esc(viewRun?.id||"待运行")}</small></span>${icon("chevron")}<span>质量与资产版本<small>${esc(viewRun?.qualityId||"待运行")} · ${esc(viewRun?.assetVersion||"待发布")}</small></span>${icon("chevron")}<span>只读目标绑定与映射<small>${esc(binding?.name||"待选择")} · ${esc(binding?.sourceMappingName||"待绑定")}</small></span>${icon("chevron")}<span>处理、采用与消费<small>${esc(attempt?.requestId||"待请求")} · ${esc(attempt?.resultId||"待结果")} · ${esc(attempt?.t019EvidenceId||"待采用证据")}</small></span></div>${notice(`该证据链只串联本次运行；候选期间${authority?`当前正式消费版本 ${authority.id} 继续服务`:"尚无正式消费版本"}。目标绑定及映射来自本体管理，只读显示。`,"info")}<details class="contract-identifiers"><summary>查看目标与映射证据编号</summary><small>目标本体版本：${esc(binding?.publishedSemanticVersionId||"未绑定")}；映射版本：${esc(binding?.sourceMappingVersionId||"未绑定")}</small></details>`;
  }
  function emptyNodeStates(value="out-of-scope") { return Object.fromEntries((ui.canvas?.nodes||[]).map(n=>[n.id,value])); }
  function demoEvent(execution,node,nodeKey,status,message,duration="—") { return {at:nowText(),execution,node,nodeKey,status,message,duration}; }
  function startNodeDebug() {
    const node=selectedNode();if(!isDraft()||node?.key!=="python")return toast("请选择编辑草稿中的 Python 节点");
    const inputs=connectedInputContexts(node.id);if(!inputs.length)return toast("请先连接至少一个数据源输入槽");
    if(inputs.some(x=>x.version==="尚无快照"||x.version==="未锁定版本"))return toast("当前输入没有可读取的精确快照或资产版本");
    if(inputs.some(x=>x.kind==="已发布数据资产"&&!x.allowed))return toast("当前资产输入未通过复用门禁");
    clearInterval(demoTimer);const states=emptyNodeStates();states[node.id]="running";
    const startedAt=nowText();
    const module=activePythonModule();ui.canvas.demo={kind:"node-debug",status:"running",step:0,targetNodeId:node.id,plan:[node.id],nodeStates:states,lockedInputs:copy(inputs),message:"正在用限定样例调试 Python 脚本和公开参数。",startedAt,completedAt:"",events:[demoEvent("Python 节点调试","输入锁定","pipeline","已锁定",`${inputs.length} 个输入版本与数据截至时间已锁定`),demoEvent("Python 节点调试","Python 处理","python","开始",`读取限定样例并执行 ${module.name} ${module.version}`)]};ui.canvas.bottomTab="debug";render();
    demoTimer=setTimeout(()=>{if(!ui.canvas||ui.canvas.demo.kind!=="node-debug")return;ui.canvas.demo.nodeStates[node.id]="success";ui.canvas.demo.status="complete";ui.canvas.demo.completedAt=nowText();ui.canvas.demo.message="Python 节点调试通过；输入预览和输出预览已按本次限定样例刷新。数据检查、发布资产和提交本体刷新请求均未执行。";ui.canvas.demo.events.push(demoEvent("Python 节点调试","Python 处理","python","成功","形成 4 个成员、3 条关系的限定样例候选；输入和输出预览已刷新","0.8 秒"),demoEvent("Python 节点调试","后续步骤","pipeline","未执行","数据检查、发布数据资产和提交本体刷新请求均未执行"));render();},760);
  }
  function trialInputsReady(target) { const python=ui.canvas.nodes.find(n=>n.key==="python"),inputs=target?.key==="source"?[{...sourceInputContext(target)}]:connectedInputContexts(python?.id);return inputs.length>0&&inputs.every(x=>x.allowed&&x.asOf&&!/待确认|未知/.test(x.asOf)); }
  function startTrial() {
    const target=selectedNode();if(!isDraft()||!target||nodeRank(target)>2)return toast("试运行终点只能选择数据源、Python 或数据检查节点");
    const validation=trialValidationResult(target);if(!validation.okay)return toast(`当前链路不能试运行：${validation.problems.join("；")}`);
    if(!trialInputsReady(target))return toast("完整输入试运行前请先确认全部精确输入、复用门禁和数据截至时间；未确认时点仍可调试 Python 限定样例");
    let plan=target.key==="source"?[target]:executionPlanTo(target.id);if(!plan.length)return toast("未找到可试运行的有效链路");
    clearInterval(demoTimer);const states=emptyNodeStates();plan.forEach(n=>states[n.id]="waiting");states[plan[0].id]="running";
    const python=ui.canvas.nodes.find(n=>n.key==="python"),trialInputs=target.key==="source"?[{...sourceInputContext(target)}]:connectedInputContexts(python?.id);
    const first=plan[0],startedAt=nowText();
    ui.canvas.demo={kind:"trial",status:"running",step:0,targetNodeId:target.id,plan:plan.map(n=>n.id),nodeStates:states,lockedInputs:copy(trialInputs),message:`正在试运行“${defForNode(first).name}”。`,startedAt,completedAt:"",events:[demoEvent("完整输入试运行","输入锁定","pipeline","已锁定",`${trialInputs.length} 个输入版本、数据截至时间与检查集已锁定`),demoEvent("完整输入试运行",defForNode(first).name,first.key,"开始","开始执行当前节点")]};ui.canvas.bottomTab=target.key==="quality"?"results":target.key==="python"?"output":"registration";render();
    demoTimer=setInterval(()=>{if(!ui.canvas||ui.canvas.demo.kind!=="trial")return clearInterval(demoTimer);const demo=ui.canvas.demo,currentId=demo.plan[demo.step],current=nodeById(currentId);if(currentId){demo.nodeStates[currentId]="success";const output=current?.key==="source"?"精确快照和数据截至时间读取完成":current?.key==="python"?"形成 4 个成员、3 条关系候选结构":`${(ui.canvas.qualityRules||[]).length} 项规则临时检查完成 · 未发现问题`;demo.events.push(demoEvent("完整输入试运行",defForNode(current).name,current?.key||"pipeline","成功",output,"0.6 秒"));if(current?.key==="quality")(ui.canvas.qualityRules||[]).forEach(rule=>demo.events.push(demoEvent("完整输入试运行","数据检查","quality","通过",`${rule.id} · ${rule.name} · 0 个问题`)));}demo.step+=1;if(demo.step>=demo.plan.length){clearInterval(demoTimer);demo.status="complete";demo.completedAt=nowText();demo.message=`完整输入已试运行到“${defForNode(target).name}”；发布数据资产和提交本体刷新请求未执行。`;demo.events.push(demoEvent("完整输入试运行","试运行范围","pipeline","完成",`已运行到${defForNode(target).name}；发布数据资产和提交本体刷新请求未执行`));render();return;}const nextId=demo.plan[demo.step],next=nodeById(nextId);demo.nodeStates[nextId]="running";demo.message=`正在试运行“${defForNode(next).name}”。`;demo.events.push(demoEvent("完整输入试运行",defForNode(next).name,next.key,"开始","上游已完成，开始执行当前节点"));render();},620);
  }
  function verifyRetryInputs(original,definition) {
    if(!original?.inputs?.length)return {okay:false,reason:"原运行没有完整的锁定输入证据，不能回退到当前输入"};
    const sourceNodes=definition.nodes.filter(n=>n.key==="source");if(original.inputs.length!==sourceNodes.length)return {okay:false,reason:"原运行锁定输入数量与原定义不一致"};
    const targetAsset=D.targetAssets.find(a=>a.t006Id===definition.targetAssetId||a.id===definition.targetAssetId),targetFingerprint=assetContractSnapshot(targetAsset,"fixed","全部成员")?.contractFingerprint||"";
    if(original.targetAssetId&&original.targetAssetId!==definition.targetAssetId)return {okay:false,reason:"原运行的目标数据资产与管道定义不一致"};
    if(original.targetAssetContractFingerprint&&original.targetAssetContractFingerprint!==targetFingerprint)return {okay:false,reason:"目标资产成员、字段或粒度合同已无法复现"};
    if(original.qualityConditionsFingerprint&&original.qualityConditionsFingerprint!==qualityConditionsFingerprint(definition))return {okay:false,reason:"原运行的质量条件与已发布定义证据不一致"};
    for(const input of original.inputs){
      const sourceNode=sourceNodes.find(n=>n.id===input.nodeId);if(!sourceNode)return {okay:false,reason:`原输入节点 ${input.nodeId||"未知"} 已无法在定义中定位`};
      const expectedSlot=sourceNode.inputSlotId||definition.edges.find(e=>e.from===sourceNode.id&&definition.nodes.find(n=>n.id===e.to)?.key==="python")?.slotId||"";
      if((input.slotId||"")!==expectedSlot)return {okay:false,reason:`${input.slot||"输入"} 的原输入槽身份与定义不一致`};
      if(!input.version||!input.fingerprint||!input.asOf)return {okay:false,reason:`${input.slot||"输入"} 缺少精确版本、指纹或数据截至时间`};
      if(input.kind==="已发布数据资产"){
        const asset=D.targetAssets.find(a=>a.t006Id===input.resourceId||a.id===input.resourceId),version=flow.assetVersions.find(v=>v.id===input.version);
        if(!asset||!version)return {okay:false,reason:`${input.slot||"输入"} 的原资产版本 ${input.version} 已不可定位`};
        if(sourceNode.inputKind!=="asset"||sourceNode.assetId!==asset.id)return {okay:false,reason:`${input.slot||"输入"} 的原资产身份与定义不一致`};
        if(version.contentAccess==="不可访问"||version.retentionStatus==="已到期")return {okay:false,reason:`${input.version} 已不可访问或超出保留期`};
        if(version.sourceHash!==input.fingerprint)return {okay:false,reason:`${input.version} 的内容指纹与原运行证据不一致`};
        if(!input.memberScope)return {okay:false,reason:`${input.version} 缺少原运行成员范围`};
        const expectedContract=sourceNode.assetContract||assetContractSnapshot(asset,sourceNode.assetVersionPolicy,sourceNode.memberScope);
        if(input.memberScope!==sourceNode.memberScope)return {okay:false,reason:`${input.version} 的原成员范围与定义不一致`};
        if(input.assetContractFingerprint!==expectedContract?.contractFingerprint)return {okay:false,reason:`${input.version} 的资产合同指纹与原运行证据不一致`};
        if(input.fieldGrainContract!==expectedContract?.fieldGrainContract)return {okay:false,reason:`${input.version} 的字段与粒度合同无法复现`};
        if(input.qualityCondition!==expectedContract?.qualityCondition)return {okay:false,reason:`${input.version} 的复用质量条件无法复现`};
        const gate=assetReuseGate(asset,version,{...definition,id:definition.pipelineId},expectedContract);if(!gate.allowed)return {okay:false,reason:`${input.version} 重试门禁未通过：${gate.reason}`};
      }else{
        const source=D.sources.find(s=>s.id===input.resourceId),snapshot=source?.snapshots?.find(s=>s.snapshotId===input.version||s.fileName===input.snapshot);
        if(sourceNode.inputKind==="asset"||sourceNode.sourceId!==input.resourceId)return {okay:false,reason:`${input.slot||"输入"} 的原数据源身份与定义不一致`};
        if(!snapshot)return {okay:false,reason:`${input.slot||"输入"} 的原快照 ${input.version} 已不可定位`};
        if(snapshot.hash!==input.fingerprint)return {okay:false,reason:`${input.version} 的内容指纹与原运行证据不一致`};
      }
    }
    const identity=original.inputs.map(x=>`${x.nodeId}/${x.slotId}/${x.resourceId}/${x.version}`).sort().join("|");if(original.snapshotIdentityFingerprint&&identity!==original.snapshotIdentityFingerprint)return {okay:false,reason:"原运行的输入槽、来源和版本身份闭包不一致"};
    return {okay:true,inputs:copy(original.inputs)};
  }
  function startFormalRun(retryOf) {
    if(isDraft())return toast("正式运行只能绑定已发布的只读管道定义");
    if(["running","quality-warning","awaiting-publish","published"].includes(flow.runStatus))return toast("请先完成或处理当前候选，再创建新的正式运行");
    clearInterval(runTimer);clearTimeout(runTimer);
    const original=retryOf?flow.runs.find(r=>r.id===retryOf):null;
    const definition=publishedDefinition(original?.definitionVersion||ui.canvas.definitionLabel);if(!definition)return toast("未找到当前运行所绑定的已发布管道定义");
    const scenarioGate=scenarioContextGate();if(!scenarioGate.okay)return toast(`不能正式运行：${scenarioGate.problems.join("；")}。请从平台总控进入当前场景工作轮次`);
    if(original&&(!sameScenarioContext(original.scenarioContext,scenarioGate.context)||!sameScenarioContext(original.t008Confirmation?.scenarioContext,scenarioGate.context)))return toast("原运行及其数据截至确认属于其他场景轮次，不能作为当前轮次的关联重试；请在当前轮次重新选择快照并确认数据截至时间");
    if(ui.canvas.definitionLabel!==definition.id)ui.canvas=hydrateCanvas(definition,"published",definition.id);
    const validation=validationResult();if(!validation.okay&&!original)return toast("当前已发布定义结构或输入门禁无效，不能正式运行");
    const python=definition.nodes.find(n=>n.key==="python");
    const liveInputs=connectedInputContexts(python?.id,{nodes:definition.nodes,edges:definition.edges,pythonModule:definition.pythonModule,targetAssetId:definition.targetAssetId});
    const retryCheck=original?verifyRetryInputs(original,definition):null;if(original&&!retryCheck.okay)return toast(`原运行不可复现：${retryCheck.reason}`);
    const inputs=original?retryCheck.inputs:liveInputs.map(x=>({nodeId:x.node.id,slotId:x.node.inputSlotId||"",slot:x.slot,kind:x.kind,resourceId:x.resourceId,name:x.name,version:x.version,versionPolicy:x.versionPolicy||"固定精确快照",snapshot:x.snapshot,fingerprint:x.fingerprint,asOf:x.asOf,memberScope:x.memberScope,contentMode:x.contentMode||"full-data",passContentToPython:x.passContentToPython!==false,fieldGrainContract:x.fieldGrainContract||"不适用",qualityCondition:x.qualityCondition||"不适用",assetContractFingerprint:x.assetContractFingerprint||"不适用",gate:x.reason}));
    if(!inputs.length||(!original&&liveInputs.some(x=>!x.allowed)))return toast("正式运行前必须通过全部输入版本、质量、许可与循环门禁");
    const dates=[...new Set(inputs.map(x=>x.asOf))];if(dates.length!==1||dates.some(x=>!/\d{4}-\d{2}-\d{2}/.test(x)))return toast("一期正式运行的全部输入必须具有同一个明确的数据截至时间");
    const financeInput=inputs.find(input=>input.kind!=="已发布数据资产"&&input.resourceId==="finance-workbook"),t008Confirmation=original?copy(original.t008Confirmation):financeInput?copy(currentT008ForSnapshot(currentFinanceSnapshot())):null;
    if(financeInput&&(!t008Confirmation||t008Confirmation.snapshotId!==financeInput.version||t008Confirmation.asOf!==dates[0]||!sameScenarioContext(t008Confirmation.scenarioContext,scenarioGate.context)))return toast("正式运行缺少与本轮融资快照、数据截至时间和完整场景上下文一致的 T008 确认证据");
    const ordered=topologicalNodes({nodes:definition.nodes,edges:definition.edges}),plan=ordered.filter(n=>nodeRank(n)<=2);
    const definitionNodes=Object.fromEntries(definition.nodes.map(n=>[n.id,n]));
    const targetAsset=D.targetAssets.find(a=>a.t006Id===definition.targetAssetId||a.id===definition.targetAssetId);if(!targetAsset?.members?.length)return toast("目标数据资产缺少成员、字段与粒度合同，不能正式运行");
    const memberContractFingerprint=assetContractSnapshot(targetAsset,"fixed","全部成员")?.contractFingerprint||"",relationshipContractFingerprint=relationshipFingerprint(targetAsset.relationshipContracts||targetAsset.relationships||[]),inputFingerprint=inputContentFingerprint(inputs),outputFingerprint=`${dates[0]}::${inputFingerprint}::${definition.pythonModule?.id||"finance_standardize.py"}@${definition.pythonModule?.version||"v1.0.0"}::${definition.targetAssetId}`;
    const existingCounters=flow.runs.map(x=>Number(String(x.id).split("-").at(-1))).filter(Number.isFinite);flow.runCounter=Math.max(flow.runCounter,...existingCounters,0)+1;
    const stamp=dates[0].replaceAll("-","");const id=`RUN-${stamp}-${String(flow.runCounter).padStart(3,"0")}`;
    const nodeExecutions=ordered.map(n=>({id:n.id,key:n.key,name:n.key==="source"?`数据源 · ${slotForSource(n,{pythonModule:definition.pythonModule})?.name||"输入"}`:defForNode(n).name,status:nodeRank(n)<=2?"等待":"未执行",startedAt:"",endedAt:"",inputSummary:n.key==="source"?(inputs.find(x=>x.nodeId===n.id)?.version||"待锁定"):"等待上游",outputSummary:"尚未形成"}));
    if(plan[0]){const first=nodeExecutions.find(x=>x.id===plan[0].id);first.status="运行中";first.startedAt=nowText();}
    const run={ id,status:"运行中",trigger:retryOf?"关联重试":"手工运行",startedAt:nowText(),endedAt:"",executionStatus:"运行中",executionEndedAt:"",closureStatus:"执行中",closedLoopEndedAt:"",pipelineId:definition.pipelineId,pipelineName:definition.name||D.pipelines.find(p=>p.id===definition.pipelineId)?.name||ui.canvas?.name||"数据管道",definitionVersion:definition.id,scenarioContext:copy(scenarioGate.context),scenarioRunId:scenarioGate.context.scenarioRunId,t008Confirmation,inputs,plan:plan.map(n=>({id:n.id,key:n.key,name:defForNode(n).name})),nodeExecutions,snapshot:inputs.map(x=>x.snapshot).join("；"),snapshotHash:inputs.map(x=>x.fingerprint).join("；"),inputContentFingerprint:inputFingerprint,targetAssetId:definition.targetAssetId,targetAssetContractFingerprint:memberContractFingerprint,relationshipContractFingerprint,businessOutputFingerprint:outputFingerprint,qualityConditionsFingerprint:qualityConditionsFingerprint(definition),qualityRuleSnapshot:copy(definition.qualityRules||[]),qualityChecks:[],qualityDisposition:"",qualityWarningReason:"",snapshotIdentityFingerprint:inputs.map(x=>`${x.nodeId}/${x.slotId}/${x.resourceId}/${x.version}`).sort().join("|"),asOf:dates[0],step:0,quality:"检查中",qualityId:"",assetVersion:"",refresh:"尚未请求",consumption:authorityVersion()?`当前正式消费版本 ${authorityVersion().id} 继续服务`:"不可消费",retryOf:retryOf||"",failureNode:"",failureReason:"",recovery:"" };
    flow.runs.unshift(run);
    flow.currentRunId=id;
    flow.runStatus="running";
    flow.runStep=0;
    flow.runPlan=plan.map(n=>n.id);
    flow.runNodeStates=Object.fromEntries(definition.nodes.map(n=>[n.id,nodeRank(n)<=2?"waiting":"waiting"]));
    if(plan[0])flow.runNodeStates[plan[0].id]="running";
    flow.qualityStatus="running";
    flow.refreshStatus="idle";
    flow.refreshRequestId="";flow.refreshResultId="";flow.refreshFailureReason="";flow.t018Status="尚未形成";flow.t019Status="未采用";flow.t019EvidenceId="";flow.t019AdoptedAt="";flow.t019Owner="";flow.candidateVersionId="";
    ui.canvas.demo=emptyDemoState();
    saveFlow();
    if(ui.canvas&&plan[0]){ui.canvas.selectedNode=plan[0].id;ui.canvas.bottomTab=plan[0].key==="source"?"registration":"output";}
    render();
    runTimer=setInterval(()=>{
      const active=currentRun();
      if(!active||flow.runStatus!=="running") return clearInterval(runTimer);
      const currentId=flow.runPlan[flow.runStep];if(currentId){flow.runNodeStates[currentId]="success";const execution=active.nodeExecutions.find(x=>x.id===currentId),node=definitionNodes[currentId];if(execution){execution.status="成功";execution.endedAt=nowText();execution.outputSummary=node?.key==="source"?"精确输入已锁定":node?.key==="python"?"4 个成员 · 3 条关系":"全部硬阻断检查通过";}}flow.runStep+=1;active.step=flow.runStep;
      if(flow.runStep<flow.runPlan.length){const nextId=flow.runPlan[flow.runStep];flow.runNodeStates[nextId]="running";const next=definitionNodes[nextId],execution=active.nodeExecutions.find(x=>x.id===nextId);if(execution){execution.status="运行中";execution.startedAt=nowText();execution.inputSummary=next?.key==="python"?`${inputs.length} 个命名输入槽`:"4 个成员 · 3 条关系";}if(ui.canvas?.definitionLabel===definition.id&&next){ui.canvas.selectedNode=next.id;ui.canvas.bottomTab=next.key==="source"?"registration":next.key==="python"?"output":"results";}saveFlow();render();return;}
      clearInterval(runTimer);const completedAt=nowText(),qualityNode=definition.nodes.find(n=>n.key==="quality"),qualityExecution=active.nodeExecutions.find(x=>x.id===qualityNode?.id),publishNode=definition.nodes.find(n=>n.key==="publish"),refreshNode=definition.nodes.find(n=>n.key==="refresh");active.executionEndedAt=completedAt;active.qualityId=`QUALITY-${active.asOf.replaceAll("-","")}-${active.id.slice(-3)}`;
      active.qualityChecks=(active.qualityRuleSnapshot||[]).filter(x=>x.enabled!==false).map(rule=>({id:rule.id,checkId:rule.sourceCheckId||rule.id,ruleVersion:rule.version,name:rule.name,type:rule.type,scope:rule.scope,condition:rule.condition,severity:rule.severity,failureEffect:rule.failureEffect,recovery:rule.recovery,owner:rule.owner,status:"通过",checkedCount:SCENARIO_ID==="S003"?(rule.sourceCheckId==="enterprise-count"?21:rule.sourceCheckId==="factor-applicability"?126:1):rule.id==="FIN-Q-007"?574:5218,failedCount:0,impact:rule.failureEffect}));
      flow.runStatus="awaiting-publish";flow.qualityStatus="passed";active.status="待发布";active.executionStatus="成功";active.closureStatus="等待发布";active.quality="通过";
      if(publishNode){flow.runNodeStates[publishNode.id]="waiting-confirmation";const execution=active.nodeExecutions.find(x=>x.id===publishNode.id);if(execution){execution.status="待确认";execution.inputSummary=`${active.qualityId} · 允许发布`;}}if(refreshNode)flow.runNodeStates[refreshNode.id]="waiting";
      if(ui.canvas?.definitionLabel===definition.id&&publishNode){ui.canvas.selectedNode=publishNode.id;ui.canvas.bottomTab="release";}saveFlow();render();toast("正式运行与质量门已通过，请在底栏确认发布数据资产");
    },850);
  }
  function stopFormalRun() {
    clearInterval(runTimer);
    const run=currentRun(); if(!run||flow.runStatus!=="running") return;
    const currentId=flow.runPlan[Math.max(0,flow.runStep)],currentNode=nodeById(currentId),node=currentNode?defForNode(currentNode).name:"当前节点";
    flow.runStatus="failed";
    flow.qualityStatus=flow.runStep<2?"not-run":"failed";
    run.status="失败";
    run.endedAt=nowText();
    run.executionStatus="失败";run.executionEndedAt=run.endedAt;run.closureStatus="运行中止 · 未发布";run.closedLoopEndedAt=run.endedAt;
    run.quality=flow.runStep<2?"未执行":"失败";
    run.failureNode=node;
    run.failureReason="运行由用户停止";
    run.recovery="确认输入和节点状态后重试该次运行";
    if(currentId)flow.runNodeStates[currentId]="failed";
    const execution=run.nodeExecutions?.find(x=>x.id===currentId);if(execution){execution.status="失败";execution.endedAt=nowText();execution.outputSummary="未形成";}
    saveFlow(); render(); toast("运行已停止，可在运行历史中重试");
  }
  function approveQualityWarning() {
    const run=currentRun(),reason=document.getElementById("quality-warning-reason")?.value.trim();if(flow.runStatus!=="quality-warning"||!run)return toast("当前没有待处置的质量警告");if(!reason)return toast("请填写继续发布理由");
    const definition=publishedDefinition(run.definitionVersion),qualityNode=definition?.nodes.find(n=>n.key==="quality"),publishNode=definition?.nodes.find(n=>n.key==="publish"),refreshNode=definition?.nodes.find(n=>n.key==="refresh"),qualityExecution=run.nodeExecutions?.find(x=>x.id===qualityNode?.id);
    run.quality="有警告 · 已说明";run.qualityDisposition="允许继续";run.qualityWarningReason=reason;run.status="待发布";run.closureStatus="质量警告已说明 · 等待发布";flow.runStatus="awaiting-publish";flow.qualityStatus="warning-approved";if(qualityNode)flow.runNodeStates[qualityNode.id]="success";if(qualityExecution){qualityExecution.status="成功";qualityExecution.outputSummary=`硬阻断 0 项 · 警告 1 项 · 已说明：${reason}`;}if(publishNode){flow.runNodeStates[publishNode.id]="waiting-confirmation";const execution=run.nodeExecutions?.find(x=>x.id===publishNode.id);if(execution){execution.status="待确认";execution.inputSummary=`${run.qualityId} · 有警告但已说明允许发布`;}}if(refreshNode)flow.runNodeStates[refreshNode.id]="waiting";ui.modal=null;if(ui.canvas?.definitionLabel===definition?.id&&publishNode){ui.canvas.selectedNode=publishNode.id;ui.canvas.bottomTab="release";}saveFlow();render();toast("质量警告理由已进入正式证据；请在发布节点确认");
  }
  function finishRunWithoutPublish() {
    const run=currentRun();if(flow.runStatus!=="quality-warning"||!run)return toast("当前没有可结束的质量警告运行");const ended=nowText(),definition=publishedDefinition(run.definitionVersion),publishNode=definition?.nodes.find(n=>n.key==="publish"),refreshNode=definition?.nodes.find(n=>n.key==="refresh");run.status="完成 · 本次不发布";run.qualityDisposition="本次不发布";run.closureStatus="质量警告后结束 · 未发布";run.closedLoopEndedAt=ended;run.endedAt=ended;run.consumption=authorityVersion()?`未形成候选；当前权威 ${authorityVersion().id} 继续服务`:"未形成可消费版本";flow.runStatus="finished";if(publishNode){flow.runNodeStates[publishNode.id]="idle";const execution=run.nodeExecutions?.find(x=>x.id===publishNode.id);if(execution){execution.status="未执行";execution.outputSummary="用户选择本次不发布";}}if(refreshNode)flow.runNodeStates[refreshNode.id]="idle";saveFlow();render();toast("本次运行已结束且未发布；正式质量证据保留");
  }
  function publishAsset() {
    if(flow.runStatus!=="awaiting-publish") return toast("当前没有可发布的质量合格候选");
    const run=actionRunForCanvas(); if(!run||run.definitionVersion!==ui.canvas?.definitionLabel)return toast("请回到该候选绑定的已发布定义执行发布");
    const scenarioGate=scenarioContextGate();if(!scenarioGate.okay||!sameScenarioContext(run.scenarioContext,scenarioGate.context))return toast("不能发布：本次运行与当前平台完整场景上下文不一致或场景身份不完整");
    const definition=publishedDefinition(run.definitionVersion);if(!definition)return toast("候选绑定的管道定义已不可定位，不能发布");
    const assetContract=D.targetAssets.find(a=>a.t006Id===definition.targetAssetId||a.id===definition.targetAssetId);if(!assetContract?.members?.length)return toast("目标数据资产缺少成员、字段与粒度合同，发布已阻断");
    const memberContractFingerprint=run.targetAssetContractFingerprint||assetContractSnapshot(assetContract,"fixed","全部成员")?.contractFingerprint||"",relationshipContractFingerprint=run.relationshipContractFingerprint||relationshipFingerprint(assetContract.relationshipContracts||assetContract.relationships||[]),businessOutputFingerprint=run.businessOutputFingerprint||`${run.asOf}::${inputContentFingerprint(run.inputs)}::${definition.pythonModule?.id}@${definition.pythonModule?.version}::${definition.targetAssetId}`;
    const duplicate=flow.assetVersions.find(v=>sameScenarioContext(v.scenarioContext,run.scenarioContext)&&v.targetAssetId===definition.targetAssetId&&v.asOf===run.asOf&&v.inputContentFingerprint===run.inputContentFingerprint&&v.memberContractFingerprint===memberContractFingerprint&&v.relationshipContractFingerprint===relationshipContractFingerprint&&v.businessOutputFingerprint===businessOutputFingerprint);
    if(duplicate){const authority=authorityVersion(definition.targetAssetId),ended=nowText();run.status="成功 · 无数据变化";run.endedAt=ended;run.closedLoopEndedAt=ended;run.closureStatus="无数据变化 · 未形成重复版本";run.assetVersion=duplicate.id;run.refresh=`复用 ${duplicate.refreshResultId||"既有刷新证据"}`;run.consumption=duplicate.id===authority?.id?`消费就绪 · ${duplicate.id}`:`未形成新版本 · 当前正式消费版本 ${authority?.id||"无"}`;flow.runStatus=duplicate.id===authority?.id?"ready":"finished";flow.candidateVersionId="";const publishExecution=run.nodeExecutions?.find(x=>x.key==="publish"),refreshExecution=run.nodeExecutions?.find(x=>x.key==="refresh");if(publishExecution){publishExecution.status="成功";publishExecution.startedAt=publishExecution.startedAt||ended;publishExecution.endedAt=ended;publishExecution.outputSummary=`无数据变化 · 复用 ${duplicate.id}`;flow.runNodeStates[publishExecution.id]="success";}if(refreshExecution){refreshExecution.status="未执行";refreshExecution.outputSummary="没有形成新资产版本，不重复提交刷新请求";flow.runNodeStates[refreshExecution.id]="idle";}saveFlow();render();return toast(`内容、时点、成员关系合同与业务输出均未变化，未重复发布；继续使用 ${duplicate.id}`);}
    const sequence=versionsForAsset(assetContract).length+1;
    const assetInputs=(run.inputs||[]).filter(x=>x.kind==="已发布数据资产"),dependencyVersions=assetInputs.map(x=>({t006Id:x.resourceId,t007Id:x.version,memberScope:x.memberScope})).filter(x=>x.t006Id&&x.t007Id),dependencies=[...new Set(dependencyVersions.map(x=>x.t006Id))],dependencyClosure=new Set(dependencies);
    dependencyVersions.forEach(ref=>{const upstream=flow.assetVersions.find(v=>v.id===ref.t007Id);dependencyClosureForVersion(upstream).forEach(id=>dependencyClosure.add(id));});
    const versionStem=String(assetContract.t006Id||definition.targetAssetId).replace(/[^A-Za-z0-9_-]/g,"-").toUpperCase(),versionId=`${versionStem}-${run.asOf.replaceAll("-","")}-v${String(sequence).padStart(2,"0")}`,members=materializePublishedMembers(assetContract,versionId),relationships=materializePublishedRelationships(assetContract,members,versionId);
    const version={ id:versionId,asOf:run.asOf,quality:run.quality,qualityId:run.qualityId,publishedAt:nowText(),scenarioContext:copy(run.scenarioContext),sourceSnapshot:run.snapshot,sourceSnapshotId:run.inputs?.[0]?.version||"",sourceHash:run.snapshotHash,inputContentFingerprint:run.inputContentFingerprint,memberContractFingerprint,relationshipContractFingerprint,businessOutputFingerprint,runId:run.id,definitionVersion:run.definitionVersion,targetAssetId:definition.targetAssetId,refreshStatus:"尚未请求",consumptionStatus:"候选不可消费",dataQualification:"数据侧合格",allowReuse:true,refreshRequestId:"",refreshResultId:"",t018Status:"尚未形成",t018EvidenceId:"",t019Status:"未采用",t019EvidenceId:"",t019BindingId:"",t019Owner:"",adoptedAt:"",refreshCompletedAt:"",contentAccess:"可访问",retentionStatus:"一期历史保留 · 生产策略待取得",retentionPolicyId:"尚未取得",retentionPolicyVersion:"尚未取得",evidenceIntegrity:"完整",members,relationships,dependencies,dependencyVersions,dependencyClosure:[...dependencyClosure],bindingTrustSummary:null,currentTrustSummaries:[] };
    version.bindingTrustSummary=buildBindingTrustSummary(version,run);
    appendCurrentTrustSummary(version,"数据资产版本发布");
    flow.assetVersions.push(version);
    flow.candidateVersionId=version.id;
    flow.runStatus="published";
    flow.refreshStatus="idle";
    flow.consumptionStatus=authorityVersion()?"ready":"not-ready";
    run.status="已发布 · 待刷新";
    run.closureStatus="已发布 · 等待刷新";
    run.assetVersion=version.id;
    run.refresh="尚未请求";
    run.consumption=authorityVersion()?`候选不可消费；当前正式消费版本 ${authorityVersion().id} 继续服务`:"候选不可消费";
    const publishNode=ui.canvas?.nodes.find(n=>n.key==="publish"),refreshNode=ui.canvas?.nodes.find(n=>n.key==="refresh");if(publishNode){flow.runNodeStates[publishNode.id]="success";const execution=run.nodeExecutions?.find(x=>x.id===publishNode.id);if(execution){execution.status="成功";execution.startedAt=execution.startedAt||nowText();execution.endedAt=nowText();execution.outputSummary=version.id;}}if(refreshNode){flow.runNodeStates[refreshNode.id]="waiting-confirmation";const execution=run.nodeExecutions?.find(x=>x.id===refreshNode.id);if(execution){execution.status="待请求";execution.inputSummary=version.id;}}
    if(ui.canvas&&publishNode){ui.canvas.selectedNode=publishNode.id;ui.canvas.bottomTab="release";}
    saveFlow(); render(); toast(`${version.id} 已发布并进入数据资产目录；正在向本体管理交付只读资产合同`);
    c003RetryInFlight=true;deliverDataAssetToOntology(assetContract,version,run).then(record=>{const gate=dataAssetDeliveryGate(version);toast(gate.okay?`M01 已持久化接收 ${record.deliveryId}；四成员合同、完整回执、C033 与目标 Draft 已核对`:`${record.status}：${record.failureReason||"尚未取得 M01 持久化联合证据"}`);}).catch(error=>toast(`C003 交付结果未知：${error?.message||"未能完成 M01 联合核对"}`)).finally(()=>{c003RetryInFlight=false;render();});
  }
  function currentT019Snapshot(targetAssetId=contextualTargetAssetId()) { const current=authorityVersion(targetAssetId);return {bindingId:current?.t019BindingId||"尚无当前正式消费版本",assetVersionId:current?.id||"尚未采用",observedAt:nowText()}; }
  async function recheckC003Delivery(options={}) {
    if(c003RetryInFlight)return toast("C003 接收核对或恢复正在处理，请等待当前结果");
    c003RetryInFlight=true;render();
    try{
    const version=options.assetVersionId?flow.assetVersions.find(item=>item.id===options.assetVersionId):candidateVersion(),run=flow.runs.find(item=>item.assetVersion===version?.id)||actionRunForCanvas(),record=latestC003DeliveryRecord(version);
    if(!run||!version||!record||run.assetVersion!==version.id||!sameScenarioContext(run.scenarioContext,version.scenarioContext))return toast("不能重新读取：精确运行、数据资产版本、交付尝试或生产轮次证据不可定位");
    toast(`正在从 M01 重新读取 ${record.deliveryId} 的接收或拒绝证据`);const checked=await verifyC003DeliveryRecord(version,record);render();const gate=dataAssetDeliveryGate(version);if(!options.silent)toast(gate.okay?`已确认 ${record.deliveryId} 在 M01 持久化存在；请在 M01 页面继续核验四成员选择器`:gate.scenarioContract?.contractConflict?`合同冲突，需要总控裁决；${record.deliveryId} 已保留，未创建后续尝试`:`${checked.status}：${checked.failureReason||"仍未取得完整联合证据"}`);return checked;
    }finally{c003RetryInFlight=false;render();}
  }
  async function reconcilePersistedC003Delivery() {
    if(c003RetryInFlight)return null;c003RetryInFlight=true;
    try{
    const version=candidateVersion(),record=latestC003DeliveryRecord(version),run=flow.runs.find(item=>item.assetVersion===version?.id);
    if(!version||!record||!run||!sameScenarioContext(version.scenarioContext,flow.scenarioContext)||!sameScenarioContext(run.scenarioContext,flow.scenarioContext))return null;
    const checked=await verifyC003DeliveryRecord(version,record);render();return checked;
    }finally{c003RetryInFlight=false;render();}
  }
  async function retryC003Delivery(options={}) {
    const lockVersionId=options.assetVersionId||candidateVersion()?.id||"UNKNOWN";
    if(!options.lockAcquired&&navigator?.locks?.request)return navigator.locks.request(`ontology3-c003-delivery-${lockVersionId}`,{ifAvailable:true},lock=>lock?retryC003Delivery({...options,lockAcquired:true}):toast("另一个数据工程页签正在恢复同一资产版本的 C003 交付，请等待后重新读取"));
    if(c003RetryInFlight)return toast("新的 C003 交付尝试正在处理，请等待当前结果");
    c003RetryInFlight=true;render();
    try{
      const version=options.assetVersionId?flow.assetVersions.find(item=>item.id===options.assetVersionId):candidateVersion(),run=flow.runs.find(item=>item.assetVersion===version?.id)||actionRunForCanvas(),definition=publishedDefinition(run?.definitionVersion),asset=D.targetAssets.find(item=>item.t006Id===definition?.targetAssetId||item.id===definition?.targetAssetId),scenarioGate=scenarioContextGate(),previous=latestC003DeliveryRecord(version);
      if(!run||!version||!asset||!previous||run.assetVersion!==version.id||!sameScenarioContext(run.scenarioContext,version.scenarioContext))return toast("不能恢复交付：精确运行、数据资产版本、既有交付尝试或生产轮次证据不可定位");
      const scenarioContract=c003ScenarioContractState(version,run,previous);
      if(scenarioContract.contractConflict){await verifyC003DeliveryRecord(version,previous);render();return toast(`合同冲突，需要总控裁决：已保留 ${previous.deliveryId}，未生成新的交付尝试`);}
      if(!scenarioGate.okay)return toast(`不能恢复交付：${scenarioGate.problems.join("；")}`);
      const historicalAcceptedClaim=Boolean(previous.historicalAcceptedClaim||previous.status==="已接收"||previous.events?.some(event=>event.status==="已接收"));
      if(previous){
        const c033Delivery=await ensureOntologyScenarioContext(previous.payload?.scenarioContext);
        if(!c033Delivery.okay){await verifyC003DeliveryRecord(version,previous);render();return toast(`不能恢复交付：M01 尚未接收同轮平台 C033；${c033Delivery.issues.join("；")}`);}
        const checked=await verifyC003DeliveryRecord(version,previous);if(dataAssetDeliveryGate(version).okay){render();return toast(`${previous.deliveryId} 已在 M01 持久化，无需重复交付`);}if(checked.status==="结果未知"){render();return toast(`${previous.deliveryId} 的 M01 状态仍无法读取；为避免重复交付，暂不发送`);}
        const attemptNumber=Number(previous.attemptNumber||1),payloadInvalid=Boolean(c003PayloadIssues(previous.payload).length||c003PayloadBindingIssues(previous.payload,version,run).length||previous.payloadFingerprint!==previous.payload?.payloadFingerprint),explicitRejected=previous.receipt?.status==="rejected",hasM01DeliveryEvidence=Boolean(previous.acceptedContract||previous.receipt);
        const firstAttemptMustBePreserved=attemptNumber===1&&!hasM01DeliveryEvidence&&(historicalAcceptedClaim||payloadInvalid);
        if(firstAttemptMustBePreserved){
          toast(`已保留历史尝试 ${previous.deliveryId}；正在创建只回指该尝试的新交付标识`);const record=await deliverDataAssetToOntology(asset,version,run,{newAttempt:true,retryOf:previous.deliveryId});render();const gate=dataAssetDeliveryGate(version);return toast(gate.okay?`新尝试 ${record.deliveryId} 已取得 M01 完整持久化联合证据`:`${record.status}：${record.failureReason||"新尝试仍未取得完整联合证据"}`);
        }
        if(attemptNumber>=2&&!explicitRejected){render();return toast(`${previous.deliveryId} 已是关联恢复尝试，且尚无完整正式拒绝回执；当前只允许继续重读，不会生成 A${String(attemptNumber+1).padStart(2,"0")}`);}
        if(!historicalAcceptedClaim&&!payloadInvalid&&!explicitRejected){
          if(previous.acceptedContract||previous.receipt){render();return toast(`${previous.deliveryId} 存在部分已接收证据但联合证据冲突；已阻断新尝试，请先在 M01 核对原合同、回执和目标 Draft`);}
          toast(`正在按 M01 幂等合同重放原交付标识 ${previous.deliveryId}`);const replayed=await sendC003DeliveryRecord(version,previous);render();const replayGate=dataAssetDeliveryGate(version);return toast(replayGate.okay?`${previous.deliveryId} 幂等重放后取得完整持久化联合证据`:`${replayed.status}：${replayed.failureReason||"幂等重放后仍无完整联合证据"}`);
        }
        if(!explicitRejected){render();return toast(`${previous.deliveryId} 尚未取得完整正式拒绝回执；已阻止创建新的交付尝试`);}
        const rejectionIssues=c003ReceiptIssues(previous.receipt,previous.payload);if(rejectionIssues.length){render();return toast(`${previous.deliveryId} 的拒绝回执不完整；已阻止创建新的交付尝试`);}
      }
      toast(`已取得 ${previous.deliveryId} 的完整正式拒绝回执；正在保留原尝试并创建关联的新尝试`);const record=await deliverDataAssetToOntology(asset,version,run,{newAttempt:true,retryOf:previous.deliveryId});render();const gate=dataAssetDeliveryGate(version);return toast(gate.okay?`新尝试 ${record.deliveryId} 已取得 M01 完整持久化联合证据`:`${record.status}：${record.failureReason||"新尝试仍未取得完整联合证据"}`);
    }finally{c003RetryInFlight=false;render();}
  }
  function exactScenarioContext(context) {
    return {scenarioId:context.scenarioId,scenarioVersion:context.scenarioVersion,scenarioRunId:context.scenarioRunId,formedAt:context.formedAt,status:context.status};
  }
  function candidateCoverageFingerprint(candidate) {
    const members=[...(candidate?.memberCoverage?.memberIds||candidate?.memberIds||[])].sort(),relationships=[...(candidate?.relationCoverage?.relationIds||candidate?.relationIds||[])].sort();
    return stableString({members,relationships,memberCoverage:candidate?.memberCoverage?.complete===true,relationshipCoverage:candidate?.relationCoverage?.complete===true});
  }
  function refreshTargetDrift(previous,current) {
    const problems=[];
    if(!current)problems.push("原目标绑定在提交前重读中已不可定位");
    if(previous&&current&&String(previous.bindingVersion)!==String(current.bindingVersion))problems.push("绑定版本已变化");
    if(previous&&current&&previous.targetFingerprint!==current.targetFingerprint)problems.push("目标指纹已变化");
    if(previous&&current&&(previous.semanticVersionId!==current.semanticVersionId||previous.semanticVersion!==current.semanticVersion))problems.push("已发布本体版本已变化");
    if(previous&&current&&previous.sourceMappingVersionId!==current.sourceMappingVersionId)problems.push("映射版本已变化");
    if(previous&&current&&candidateCoverageFingerprint(previous)!==candidateCoverageFingerprint(current))problems.push("成员或关系覆盖已变化");
    return problems;
  }
  function currentFormalSnapshotFromPublished(publishedContext) {
    const discovery=publishedContext?.discovery,consumption=publishedContext?.consumption,binding=consumption?.binding;
    if(!discovery||!consumption?.currentFormal||!binding)return null;
    return {versionId:discovery.versionId,ontologyStableId:discovery.ontologyStableId,...copy(binding),semanticVersion:discovery.semanticVersion};
  }
  function exactC028Received(received,payload) {
    if(!received||!payload)return false;
    const sameIds=(left,right)=>stableString([...(left||[])].sort())===stableString([...(right||[])].sort());
    return received.sourceModule==="数据工程"&&received.contractCode==="C028"&&received.requestId===payload.requestId&&received.requestedAt===payload.requestedAt&&sameScenarioContext(received.scenarioContext,payload.scenarioContext)&&received.semanticVersionId===payload.semanticVersionId&&received.semanticVersion===payload.semanticVersion&&received.dataAssetId===payload.dataAssetId&&received.dataVersion===payload.dataVersion&&received.asOf===payload.asOf&&sameIds(received.memberIds,payload.memberIds)&&sameIds(received.relationIds,payload.relationIds)&&received.qualityStatus===payload.qualityStatus&&received.refreshDiscoveryResponseId===payload.refreshDiscoveryResponseId&&received.refreshDiscoveryResponseVersion===payload.refreshDiscoveryResponseVersion&&received.refreshDiscoveryFingerprint===payload.refreshDiscoveryFingerprint&&received.refreshDiscoveryReadAt===payload.refreshDiscoveryReadAt&&received.refreshTargetId===payload.refreshTargetId&&String(received.refreshTargetBindingVersion)===String(payload.refreshTargetBindingVersion)&&received.refreshTargetEvidenceLocator===payload.refreshTargetEvidenceLocator&&received.refreshTargetFingerprint===payload.refreshTargetFingerprint&&received.sourceMappingVersionId===payload.sourceMappingVersionId&&received.targetSemanticVersionId===payload.targetSemanticVersionId&&received.evidenceLocator===payload.evidenceLocator&&received.hasCurrentFormalSnapshot===true&&stableString(received.currentFormalSnapshot??null)===stableString(payload.currentFormalSnapshot??null)&&received.trigger===payload.trigger&&(received.retryOf||null)===(payload.retryOf||null);
  }
  function c029MatchesAttempt(c029,attempt,version,scenarioContext) {
    return Boolean(c029&&c029.sourceModule==="本体管理"&&c029.contractCode==="C029"&&c029.originalRequest?.contractCode==="C028"&&c029.originalRequest?.requestId===attempt.requestId&&c029.originalRequest?.evidenceLocator===attempt.requestPayload?.evidenceLocator&&c029.dataAssetId===version.targetAssetId&&c029.dataVersion===version.id&&c029.asOf===version.asOf&&c029.semanticVersionId===attempt.targetT017&&c029.t017VersionId===attempt.targetT017&&c029.sourceMappingVersionId===attempt.sourceMappingVersion&&c029.refreshTarget?.stableId===attempt.ontologyBindingId&&String(c029.refreshTarget?.bindingVersion)===String(attempt.c032Candidate?.bindingVersion)&&sameScenarioContext(c029.scenarioContext,scenarioContext));
  }
  function t018MatchesAttempt(t018,c029,attempt,version,scenarioContext) {
    return Boolean(t018&&c029&&t018.status==="eligible"&&t018.dataVersion===version.id&&t018.semanticVersionId===attempt.targetT017&&t018.basedOnMatchResult===c029.resultId&&t018.candidateKey===c029.candidateKey&&sameScenarioContext(t018.scenarioContext,scenarioContext)&&stableString(t018.currentFormalSnapshot??null)===stableString(c029.currentFormalSnapshot??null));
  }
  function t019MatchesAttempt(adoption,binding,t018,c029,attempt,version,scenarioContext) {
    return Boolean(adoption&&binding&&t018&&c029&&adoption.status==="成功"&&adoption.dataVersion===version.id&&adoption.candidateKey===t018.candidateKey&&sameScenarioContext(adoption.scenarioContext||adoption,scenarioContext)&&binding.dataVersion===version.id&&binding.asOf===version.asOf&&binding.candidateKey===t018.candidateKey&&sameScenarioContext(binding.scenarioContext,scenarioContext)&&binding.adoptionRecordId===adoption.id&&binding.adoptionEvidenceLocator===adoption.evidenceCode&&attempt.targetT017===c029.semanticVersionId);
  }
  async function discoverOntologyBindings(readPurpose="发现",options={}) {
    const run=actionRunForCanvas(),version=candidateVersion(),targetAsset=targetAssetForCanvas(),scenarioGate=scenarioContextGate(),delivery=completeC003DeliveryForVersion(version);
    if(!scenarioGate.okay){const reason=`场景运行上下文不完整：${scenarioGate.problems.join("；")}`;flow.ontologyDiscoveryStatus="failed";flow.ontologyDiscoveryError=reason;saveFlow();if(!options.silent){render();toast(reason);}return {okay:false,reason};}
    if(!run||!version||run.assetVersion!==version.id){const reason="当前没有可用于发现目标绑定的已发布数据资产版本";if(!options.silent)toast(reason);return {okay:false,reason};}
    if(!sameScenarioContext(run.scenarioContext,scenarioGate.context)||!sameScenarioContext(version.scenarioContext,scenarioGate.context)){const reason="正式运行、数据资产版本与当前完整场景上下文不一致";if(!options.silent)toast(reason);return {okay:false,reason};}
    if(!delivery){const reason="精确数据资产交付尚未取得本体管理同标识完整接收回执";flow.ontologyDiscoveryStatus="failed";flow.ontologyDiscoveryError=reason;saveFlow();if(!options.silent){render();toast(reason);}return {okay:false,reason};}
    flow.ontologyDiscoveryStatus="reading";flow.ontologyDiscoveryError="";saveFlow();if(!options.silent)render();
    const response=await ontologyBridgeRequest("discoverRefreshTargets",{dataAssetId:version.targetAssetId,assetVersionId:version.id,readPurpose,scenarioContext:exactScenarioContext(scenarioGate.context),returnTo:location.href});
    if(!response.ok||!response.result){const reason=response.timeout?"读取本体刷新目标超时，结果未知":response.error||"本体管理未返回 C032 目标发现结果";flow.ontologyDiscoveryStatus="failed";flow.ontologyDiscoveryError=reason;saveFlow();if(!options.silent){render();toast(reason);}return {okay:false,reason,timeout:Boolean(response.timeout)};}
    const raw=response.result,problems=[];
    if(raw.sourceModule!=="本体管理"||raw.contractCode!=="C032"||!raw.responseId||!raw.responseVersion||!raw.responseFingerprint||!raw.formedAt||!raw.readAt)problems.push("C032 响应身份、版本、指纹、形成时间或读取时间不完整");
    if(raw.queryDataAssetId!==version.targetAssetId)problems.push("C032 查询的数据资产与当前发布版本不一致");
    if(raw.readPurpose!==readPurpose)problems.push("C032 读取用途与本次操作不一致");
    if(!sameScenarioContext(raw.scenarioContext,scenarioGate.context))problems.push("C032 与当前完整场景上下文不一致");
    const handoff=await ontologyHandoffSnapshot(),recorded=handoff?.c032Discoveries?.find(item=>item.responseId===raw.responseId);
    if(!recorded||recorded.responseVersion!==raw.responseVersion||recorded.responseFingerprint!==raw.responseFingerprint||recorded.formedAt!==raw.formedAt||recorded.readAt!==raw.readAt||!sameScenarioContext(recorded.scenarioContext,raw.scenarioContext))problems.push("本体管理交接快照中无法定位同一 C032 响应及其时间、场景证据");
    const candidates=[];
    for(const candidate of raw.candidates||[]){
      const candidateProblems=[];
      if(candidate.dataAssetId!==version.targetAssetId)candidateProblems.push("数据资产不匹配");
      if(!sameScenarioContext(candidate.scenarioContext,scenarioGate.context))candidateProblems.push("场景上下文不匹配");
      if(candidate.currentStatus!=="可用"||candidate.allowRefreshSubmission!==true)candidateProblems.push(candidate.notAllowedReason||"目标当前不可提交");
      if(!candidate.memberCoverage?.complete||Number(candidate.memberCoverage?.covered)!==version.members.length)candidateProblems.push("成员覆盖不完整");
      if(!candidate.relationCoverage?.complete||Number(candidate.relationCoverage?.covered)!==version.relationships.length)candidateProblems.push("关系覆盖不完整");
      const published=await ontologyBridgeRequest("publishedContext",{versionId:candidate.semanticVersionId});
      const publishedContext=published.ok?published.result:null;
      if(!publishedContext?.discovery||publishedContext.discovery.versionId!==candidate.semanticVersionId||publishedContext.discovery.semanticVersion!==candidate.semanticVersion||publishedContext.discovery.publicationState!=="Published")candidateProblems.push("目标 Published 本体版本不可证明");
      candidates.push({...copy(candidate),publishedContext,validationProblems:candidateProblems,allowRefreshSubmission:candidate.allowRefreshSubmission===true&&candidateProblems.length===0});
    }
    if(problems.length){const reason=problems.join("；");flow.ontologyDiscoveryStatus="failed";flow.ontologyDiscoveryError=reason;flow.ontologyDiscoveryHistory.push({...copy(raw),accepted:false,localProblems:problems});saveFlow();if(!options.silent){render();toast(reason);}return {okay:false,reason,response:raw};}
    const discovery={...copy(raw),candidates,verifiedAt:nowText()};flow.ontologyDiscovery=discovery;flow.ontologyDiscoveryHistory.push(copy(discovery));flow.ontologyDiscoveryStatus="ready";flow.ontologyDiscoveryError=raw.reason||"";
    const selectionKey=refreshBindingSelectionKey(version.id),selected=flow.refreshBindingSelections[selectionKey];if(selected&&!candidates.some(item=>item.refreshTargetId===selected&&item.allowRefreshSubmission))delete flow.refreshBindingSelections[selectionKey];
    saveFlow();if(!options.silent){render();toast(candidates.some(item=>item.allowRefreshSubmission)?`已从本体管理读取 ${candidates.filter(item=>item.allowRefreshSubmission).length} 个可用目标绑定`:(raw.reason||"本体管理当前没有可用目标绑定；数据资产版本仍保留"));}
    return {okay:true,response:discovery,candidates};
  }
  function markRefreshSubmissionOutcome({attempt,run,version,refreshNode,status,reason="",acceptedAt=""}) {
    const execution=run.nodeExecutions?.find(item=>item.id===refreshNode?.id),executionAttempt=execution?.attempts?.find(item=>item.requestId===attempt.requestId);
    if(status==="accepted"){
      flow.refreshStatus="request-accepted";attempt.requestStatus="已受理";attempt.acceptedAt=acceptedAt||nowText();attempt.failureReason="";attempt.recovery="等待本体管理处理；可查询原请求，不得重复提交";version.refreshStatus="请求已受理 · 等待本体处理";run.status="已发布 · 刷新请求已受理";run.refresh=`${attempt.requestId} · 本体管理已受理`;if(refreshNode)flow.runNodeStates[refreshNode.id]="success";if(execution){execution.status="已受理";execution.endedAt=attempt.acceptedAt;execution.outputSummary="本体管理已受理 C028；尚未形成处理成功、候选资格或正式采用";}if(executionAttempt){executionAttempt.status="已受理";executionAttempt.endedAt=attempt.acceptedAt;executionAttempt.outputSummary="本体管理已受理，等待处理";}
    }else if(status==="unknown"){
      flow.refreshStatus="unknown";flow.refreshFailureReason=reason;attempt.requestStatus="结果未知";attempt.failureReason=reason;attempt.recovery="查询同一刷新请求；不得用新请求覆盖未知结果";version.refreshStatus="提交结果未知 · 不可消费";run.status="已发布 · 刷新提交结果未知";run.refresh=`${attempt.requestId} · 结果未知`;if(refreshNode)flow.runNodeStates[refreshNode.id]="waiting-confirmation";if(execution){execution.status="结果未知";execution.outputSummary=reason;}if(executionAttempt){executionAttempt.status="结果未知";executionAttempt.endedAt=nowText();executionAttempt.outputSummary=reason;}
    }else{
      flow.refreshStatus="failed";flow.refreshFailureReason=reason;attempt.requestStatus="已拒绝";attempt.resultStatus="失败";attempt.failureReason=reason;attempt.recovery="按本体管理拒绝原因处理后，重新读取目标并形成关联重试";version.refreshStatus="刷新请求被拒绝 · 不可消费";run.status="已发布 · 刷新请求被拒绝";run.refresh=`${attempt.requestId} · 已拒绝`;if(refreshNode)flow.runNodeStates[refreshNode.id]="failed";if(execution){execution.status="失败";execution.outputSummary=reason;}if(executionAttempt){executionAttempt.status="失败";executionAttempt.endedAt=nowText();executionAttempt.outputSummary=reason;}
    }
  }
  async function submitOntologyRefresh() {
    const run=actionRunForCanvas(),version=candidateVersion(),scenarioGate=scenarioContextGate();
    if(!scenarioGate.okay)return toast(`不能提交本体刷新请求：${scenarioGate.problems.join("；")}`);
    if(flow.runStatus!=="published"||!["idle","failed"].includes(flow.refreshStatus)||!run||!version||run.assetVersion!==version.id)return toast("当前画布没有可发起刷新的候选版本");
    if(!sameScenarioContext(run.scenarioContext,scenarioGate.context)||!sameScenarioContext(version.scenarioContext,scenarioGate.context))return toast("不能提交：正式运行、数据资产版本与当前完整场景上下文不一致");
    const definition=publishedDefinition(run.definitionVersion),refreshNode=definition?.nodes?.find(node=>node.key==="refresh");
    if(!definition||ui.canvas?.definitionLabel!==definition.id||!refreshNode)return toast("刷新只能在候选运行绑定的已发布定义中发起");
    const delivery=completeC003DeliveryForVersion(version);if(!delivery)return toast("不能提交：本体管理尚未返回精确数据资产交付的完整接收回执");
    const assetContract=D.targetAssets.find(asset=>asset.t006Id===version.targetAssetId||asset.id===version.targetAssetId);if(!assetContract)return toast("不能提交：当前数据资产成员与关系合同不可定位");
    const selectedId=selectedOntologyBindingId(ui.canvas),initialCandidate=ontologyDiscoveryCandidates().find(candidate=>candidate.refreshTargetId===selectedId);
    if(!initialCandidate)return toast("请先读取并选择本体管理中已建立的可用目标绑定");
    const reread=await discoverOntologyBindings("提交前重读",{silent:true});
    if(!reread.okay){render();return toast(`提交前重读失败：${reread.reason}。数据资产版本 ${version.id} 仍保留`);}
    const currentCandidate=reread.candidates.find(candidate=>candidate.refreshTargetId===initialCandidate.refreshTargetId),driftProblems=refreshTargetDrift(initialCandidate,currentCandidate);
    if(driftProblems.length){delete flow.refreshBindingSelections[refreshBindingSelectionKey(version.id)];flow.ontologyDiscoveryError=`提交前发现目标漂移：${driftProblems.join("；")}`;saveFlow();render();return toast(`提交已阻断：${driftProblems.join("；")}。请重新选择目标绑定`);}
    const bindingGate=ontologyBindingGate(),binding=bindingGate.rawBinding;if(!bindingGate.okay||!binding)return toast(`不能提交本体刷新请求：${bindingGate.problems.join("；")}`);
    const publishedContext=binding.publishedContext||null,currentFormalSnapshot=currentFormalSnapshotFromPublished(publishedContext),sameVersion=refreshAttemptsForVersion(version.id),lastFailed=[...sameVersion].reverse().find(attempt=>attempt.resultStatus==="失败"),retryOf=lastFailed?.requestId||"";
    const requestId=`C028-${version.id}-${String(sameVersion.length+1).padStart(2,"0")}`,requestedAt=nowText(),scenarioContext={scenarioId:scenarioGate.context.scenarioId,scenarioVersion:scenarioGate.context.scenarioVersion,scenarioRunId:scenarioGate.context.scenarioRunId,formedAt:scenarioGate.context.formedAt,status:scenarioGate.context.status};
    const payload={sourceModule:"数据工程",contractCode:"C028",requestId,requestedAt,scenarioContext,semanticVersionId:binding.semanticVersionId,semanticVersion:binding.semanticVersion,targetSemanticVersionId:binding.semanticVersionId,dataAssetId:version.targetAssetId,dataVersion:version.id,assetVersionId:version.id,dataAssetDeliveryId:delivery.deliveryId,asOf:version.asOf,t008Confirmation:t008ConfirmationForDelivery(version,run),memberIds:version.members.map(member=>member.id),members:version.members.map(member=>({id:member.id,stableId:member.stableId})),memberContracts:c003Members(assetContract,version),relationIds:version.relationships.map(relationship=>relationship.id),relationships:version.relationships.map(relationship=>({id:relationship.id,stableId:relationship.stableId})),relationshipContracts:c003Relations(assetContract,version),coverage:{members:copy(binding.memberCoverage),relationships:copy(binding.relationCoverage)},qualityStatus:version.quality,quality:{status:version.quality,resultId:version.qualityId,evidenceLocator:`数据工程 / 质量结果 / ${version.qualityId}`},refreshDiscoveryResponseId:reread.response.responseId,refreshDiscoveryResponseVersion:reread.response.responseVersion,refreshDiscoveryFingerprint:reread.response.responseFingerprint,refreshDiscoveryFormedAt:reread.response.formedAt,refreshDiscoveryReadAt:reread.response.readAt,refreshTargetId:binding.refreshTargetId,refreshTargetBindingVersion:binding.bindingVersion,refreshTargetEvidenceLocator:binding.evidenceLocator,refreshTargetFingerprint:binding.targetFingerprint,sourceMappingVersionId:binding.sourceMappingVersionId,mappingVersion:binding.sourceMappingVersionId,currentFormalSnapshot,evidenceLocator:`数据工程 / 刷新请求 / ${requestId}`,trigger:run.trigger||"手工正式运行",retryOf:retryOf||null,changeHints:[]};
    const attempt={requestId,resultId:"",runId:run.id,assetVersionId:version.id,dataAssetDeliveryId:delivery.deliveryId,qualityResultId:run.qualityId,ontologyBindingId:binding.refreshTargetId,target:binding.bindingName,targetT017:binding.semanticVersionId,sourceMappingVersion:binding.sourceMappingVersionId,c032ResponseId:reread.response.responseId,c032ResponseVersion:reread.response.responseVersion,c032Fingerprint:reread.response.responseFingerprint,c032FormedAt:reread.response.formedAt,c032ReadAt:reread.response.readAt,c032Candidate:copy(binding),publishedContext:copy(publishedContext),scenarioContext:copy(scenarioContext),memberContractSummary:`${version.members.length} 个成员`,relationshipContractSummary:`${version.relationships.length} 条关系`,existingT019Snapshot:currentFormalSnapshot,queueState:"正在提交本体管理",queuePosition:"等待真实回执",trigger:payload.trigger,requestPayload:copy(payload),requestPayloadFingerprint:`${version.id} · ${binding.targetFingerprint} · ${reread.response.responseFingerprint}`,retryOf,requestStatus:"正在提交",createdAt:requestedAt,acceptedAt:"",resultStatus:"",resultAt:"",t018Status:"尚未形成",t018EvidenceId:"",t018At:"",objectCounts:{},relationshipCounts:{},primaryKeyCheck:"尚未返回",endpointCheck:"尚未返回",indexStatus:"尚未返回",resultT019Snapshot:{},t019Status:"未采用",t019EvidenceId:"",t019BindingId:"",adoptedVersionId:"",adoptedAt:"",adoptionOwner:"",failureReason:"",recovery:"等待本体管理真实回执",queryCount:0,events:[]};
    appendRefreshEvent(attempt,"刷新请求","正在提交本体管理",requestId);flow.refreshAttempts.push(attempt);flow.refreshRequestId=requestId;flow.refreshResultId="";flow.refreshFailureReason="";flow.refreshStatus="request-created";flow.t018Status="尚未形成";flow.t019Status="未采用";version.refreshRequestId=requestId;version.refreshStatus="正在提交刷新请求";run.status="已发布 · 正在提交刷新请求";run.refresh=`${requestId} · 正在提交`;run.closureStatus="等待本体处理与正式采用";
    const execution=run.nodeExecutions?.find(item=>item.id===refreshNode.id);if(execution){execution.attempts=Array.isArray(execution.attempts)?execution.attempts:[];execution.attempts.push({requestId,status:"正在提交",startedAt:requestedAt,endedAt:"",inputSummary:`${version.id} · ${run.qualityId}`,outputSummary:"等待本体管理受理回执"});execution.status="正在提交";execution.startedAt=execution.startedAt||requestedAt;execution.inputSummary=version.id;}
    ui.canvas.selectedNode=refreshNode.id;ui.canvas.bottomTab="flow";saveFlow();render();
    const mutation=await ontologyBridgeRequest("deliverRefreshRequest",payload),handoff=await ontologyHandoffSnapshot(),received=handoff?.inputs?.c028?.find(item=>item.requestId===requestId),exactReceived=exactC028Received(received,payload),acceptedAt=mutation.respondedAt||"";
    if(mutation.ok===true&&mutation.result?.accepted===true&&exactReceived&&acceptedAt){attempt.receipt={accepted:true,respondedAt:acceptedAt,observedAt:nowText()};markRefreshSubmissionOutcome({attempt,run,version,refreshNode,status:"accepted",acceptedAt});appendRefreshEvent(attempt,"本体管理受理","已受理；尚未形成 C029、候选资格或正式采用",requestId);appendCurrentTrustSummary(version,"本体管理已受理刷新请求，等待处理");saveFlow();render();return toast(`${requestId} 已由本体管理受理；当前版本仍不可消费`);}
    if(mutation.timeout||mutation.ok===true&&(!exactReceived||!acceptedAt)){const reason=mutation.timeout?"提交等待窗口内未取得本体管理明确回执，结果未知":!acceptedAt?"本体管理返回受理信号，但缺少响应时间，结果未知":"本体管理返回受理信号，但交接快照未出现同一精确请求，结果未知";markRefreshSubmissionOutcome({attempt,run,version,refreshNode,status:"unknown",reason});appendRefreshEvent(attempt,"受理核对","结果未知",requestId);appendCurrentTrustSummary(version,reason);saveFlow();render();return toast(reason);}
    const issue=[...(handoff?.deliveryIssues||[])].reverse().find(item=>item.kind==="C028"),reason=issue?.reason||mutation.error||"本体管理拒绝刷新请求";attempt.deliveryIssue=copy(issue||null);markRefreshSubmissionOutcome({attempt,run,version,refreshNode,status:"rejected",reason});appendRefreshEvent(attempt,"本体管理受理","已拒绝",requestId);appendCurrentTrustSummary(version,`刷新请求被拒绝：${reason}`);saveFlow();render();return toast(`刷新请求被拒绝：${reason}`);
  }
  function requestRefresh() { return submitOntologyRefresh(); }
  async function queryRefreshRequest() {
    if(!["request-created","request-accepted","unknown","eligible"].includes(flow.refreshStatus)||!flow.refreshRequestId)return toast("当前没有可查询的刷新请求");
    const attempt=activeRefreshAttempt(),run=flow.runs.find(item=>item.id===attempt?.runId),version=flow.assetVersions.find(item=>item.id===attempt?.assetVersionId),scenarioGate=scenarioContextGate();
    if(!scenarioGate.okay||!attempt||!run||!version||attempt.assetVersionId!==flow.candidateVersionId||run.assetVersion!==version.id||!sameScenarioContext(attempt.scenarioContext,scenarioGate.context))return toast("原刷新请求、精确版本或完整场景上下文不可定位；当前正式消费版本保持不变");
    flow.refreshStatus="querying";attempt.queryCount=(attempt.queryCount||0)+1;appendRefreshEvent(attempt,"查询",`第 ${attempt.queryCount} 次从本体管理读取状态`,attempt.requestId);version.refreshStatus="正在读取本体处理状态";run.refresh=`${attempt.requestId} · 正在查询`;saveFlow();render();
    const [publishedResponse,handoff]=await Promise.all([ontologyBridgeRequest("publishedContext",{versionId:attempt.targetT017}),ontologyHandoffSnapshot()]);
    const received=handoff?.inputs?.c028?.find(item=>item.requestId===attempt.requestId),publishedContext=publishedResponse.ok?publishedResponse.result:null,consumption=publishedContext?.consumption||null,requestMatches=exactC028Received(received,attempt.requestPayload),publishedIdentityMatches=Boolean(publishedContext?.discovery?.versionId===attempt.targetT017&&publishedContext.discovery.semanticVersion===attempt.c032Candidate?.semanticVersion);
    if(!requestMatches||!publishedIdentityMatches||!consumption){const reason=publishedResponse.timeout?"查询超时，本体处理结果未知":"同一精确请求、目标 Published 版本与完整场景上下文的本体处理证据尚不可定位";flow.refreshStatus="unknown";attempt.requestStatus="结果未知";attempt.failureReason=reason;attempt.recovery="继续查询同一请求，不得补录或重复提交";version.refreshStatus="结果未知 · 不可消费";run.refresh=`${attempt.requestId} · 结果未知`;appendRefreshEvent(attempt,"结果查询","结果未知",attempt.requestId);appendCurrentTrustSummary(version,reason);saveFlow();render();return toast(reason);}
    const c029=consumption.c029,t018=consumption.t018,adoption=consumption.adoptionRecord,binding=consumption.binding;
    const c029Matches=c029MatchesAttempt(c029,attempt,version,scenarioGate.context);
    const t018Matches=t018MatchesAttempt(t018,c029Matches?c029:null,attempt,version,scenarioGate.context);
    const adoptionMatches=t019MatchesAttempt(adoption,binding,t018Matches?t018:null,c029Matches?c029:null,attempt,version,scenarioGate.context);
    attempt.resultId=c029Matches?c029.resultId:"";attempt.resultStatus=c029Matches?c029.resultStatus:"";attempt.resultAt=c029Matches?(c029.checkedAt||c029.formedAt):"";attempt.t018Status=t018Matches?"可消费候选":"尚未形成";attempt.t018EvidenceId=t018Matches?(t018.evidenceLocator||t018.eligibilityId):"";attempt.t019Status=adoptionMatches&&consumption.currentFormal&&consumption.consumable?"已采用":"未采用";attempt.t019EvidenceId=attempt.t019Status==="已采用"?(adoption.evidenceCode||binding?.adoptionEvidenceLocator||""):"";attempt.adoptedAt=attempt.t019Status==="已采用"?(adoption.createdAt||binding?.switchedAt||nowText()):"";attempt.adoptionOwner=attempt.t019Status==="已采用"?"本体管理":"";
    flow.refreshResultId=attempt.resultId;flow.t018Status=attempt.t018Status;flow.t019Status=attempt.t019Status;flow.t019EvidenceId=attempt.t019EvidenceId;
    if(attempt.t019Status==="已采用"){
      const targetAssetId=version.targetAssetId,previous=authorityVersion(targetAssetId);if(previous&&previous.id!==version.id)flow.previousAuthorityVersionIds[targetAssetId]=previous.id;flow.authorityVersionIds[targetAssetId]=version.id;flow.authorityVersionId=version.id;flow.refreshStatus="adopted";flow.consumptionStatus="ready";version.refreshStatus="本体侧已正式采用";version.consumptionStatus="消费就绪";version.t019Status="已采用";version.t019EvidenceId=attempt.t019EvidenceId;version.t019BindingId=binding?.bindingId||binding?.candidateKey||"";version.t019Owner="本体管理";version.t019ObservedAt=nowText();version.adoptedAt=attempt.adoptedAt;run.status="成功 · 消费就绪";run.closureStatus="本体侧已正式采用";run.closedLoopEndedAt=attempt.adoptedAt;run.endedAt=attempt.adoptedAt;run.refresh=`${attempt.requestId} · 已取得正式采用证据`;run.consumption=`消费就绪 · ${version.id}`;appendRefreshEvent(attempt,"正式采用","已取得本体管理正式采用证据",attempt.t019EvidenceId);appendCurrentTrustSummary(version,"已读取本体管理正式采用与消费就绪证据");
    }else if(c029Matches&&["failed","incompatible","unknown"].includes(c029.status)){
      const reason=c029.objectChecks?.issues?.[0]?.detail||c029.relationChecks?.issues?.[0]?.detail||c029.recoverySuggestion||`本体处理结果为${c029.resultStatus}`;flow.refreshStatus=c029.status==="unknown"?"unknown":"failed";flow.refreshFailureReason=reason;attempt.failureReason=reason;attempt.recovery=c029.recoverySuggestion||"在本体管理修复后重新提交关联请求";version.refreshStatus=`本体处理${c029.resultStatus} · 不可消费`;run.status=`已发布 · 本体处理${c029.resultStatus}`;run.refresh=`${attempt.requestId} · ${c029.resultStatus}`;appendRefreshEvent(attempt,"本体处理",c029.resultStatus,c029.resultId);appendCurrentTrustSummary(version,reason);
    }else if(c029Matches&&c029.status==="passed"&&t018Matches){flow.refreshStatus="eligible";attempt.requestStatus="已受理";version.refreshStatus="本体处理通过 · 待正式采用";version.t018Status="可消费候选";version.t018EvidenceId=attempt.t018EvidenceId;run.status="已发布 · 本体处理通过 · 待正式采用";run.refresh=`${attempt.requestId} · C029 成功 · 待正式采用`;appendRefreshEvent(attempt,"本体处理","成功；尚未正式采用",c029.resultId);appendCurrentTrustSummary(version,"本体处理通过并形成候选资格，等待正式采用");
    }else{flow.refreshStatus="request-accepted";attempt.requestStatus="已受理";version.refreshStatus="本体管理处理中";run.refresh=`${attempt.requestId} · 本体处理中`;appendRefreshEvent(attempt,"状态查询","本体管理处理中",attempt.requestId);}
    const definition=publishedDefinition(run.definitionVersion),refreshNode=definition?.nodes?.find(node=>node.key==="refresh"),execution=run.nodeExecutions?.find(item=>item.id===refreshNode?.id);if(refreshNode)flow.runNodeStates[refreshNode.id]=flow.refreshStatus==="failed"?"failed":flow.refreshStatus==="unknown"?"waiting-confirmation":"success";if(execution){execution.status=flow.refreshStatus==="adopted"?"消费就绪":flow.refreshStatus==="eligible"?"待正式采用":flow.refreshStatus==="failed"?"失败":flow.refreshStatus==="unknown"?"结果未知":"处理中";execution.outputSummary=run.refresh;}
    saveFlow();render();return toast(flow.refreshStatus==="adopted"?"已取得本体管理正式采用证据，当前版本消费就绪":flow.refreshStatus==="eligible"?"本体处理通过，但尚未正式采用":"已读取本体管理最新处理状态");
  }
  function finishFailedCandidate() {
    const attempt=activeRefreshAttempt(),version=candidateVersion(),run=flow.runs.find(x=>x.id===attempt?.runId);if(flow.refreshStatus!=="failed"||!attempt||!version||!run)return toast("当前没有可结束的已确认失败候选");
    const ended=nowText();version.consumptionStatus="失败候选 · 历史保留";version.refreshStatus="刷新失败 · 已结束候选";run.status="已发布 · 刷新失败 · 候选已结束";run.closureStatus="刷新失败 · 历史保留";run.closedLoopEndedAt=ended;run.endedAt=ended;run.consumption=authorityVersion()?`当前正式消费版本 ${authorityVersion().id} 继续服务`:"不可消费";attempt.recovery=`失败候选已于 ${ended} 结束并保留历史；修复后发起新的正式运行`;appendRefreshEvent(attempt,"候选处置","结束失败候选并保留历史",version.id);appendCurrentTrustSummary(version,"失败候选已结束并保留历史");flow.candidateVersionId="";flow.currentRunId="";flow.runStatus="finished";flow.refreshStatus="idle";flow.refreshRequestId="";flow.refreshResultId="";flow.refreshFailureReason="";flow.t018Status="尚未形成新候选";flow.t019Status=authorityVersion()?"当前正式消费版本保持不变":"尚未采用";flow.consumptionStatus=authorityVersion()?"ready":"not-ready";saveFlow();render();toast("失败候选及全部证据已保留；下一次正式运行已释放");
  }
  function finishPendingCandidate() {
    const version=candidateVersion(),run=currentRun(),reason=document.getElementById("finish-pending-candidate-reason")?.value.trim(),attempt=activeRefreshAttempt();
    if(!version||!run||flow.runStatus!=="published"||attempt)return toast("当前候选已进入刷新处理或状态已变化，不能按未提交候选结束");
    if(!reason)return toast("请填写结束当前候选的业务原因");
    const ended=nowText();version.consumptionStatus="已结束候选 · 历史保留";version.refreshStatus="未提交刷新 · 候选已结束";version.candidateClosedAt=ended;version.candidateCloseReason=reason;run.status="已发布 · 候选已结束";run.closureStatus="未提交刷新 · 历史保留";run.closedLoopEndedAt=ended;run.endedAt=ended;run.consumption=authorityVersion()?`当前正式消费版本 ${authorityVersion().id} 继续服务`:"不可消费";appendCurrentTrustSummary(version,`候选已结束：${reason}`);flow.candidateVersionId="";flow.currentRunId="";flow.runStatus="finished";flow.refreshStatus="idle";flow.refreshRequestId="";flow.refreshResultId="";flow.refreshFailureReason="";flow.t018Status="尚未形成新候选";flow.t019Status=authorityVersion()?"当前正式消费版本保持不变":"尚未采用";flow.consumptionStatus=authorityVersion()?"ready":"not-ready";ui.modal=null;saveFlow();render();toast(`${version.id} 已结束候选；资产版本、C003 交付和运行证据继续保留`);
  }
  function fitCanvas() {
    const viewport=document.querySelector(".canvas-viewport"); if(!viewport||!ui.canvas)return;
    if(!ui.canvas.nodes.length){ui.canvas.zoom=88;ui.canvas.viewport=defaultViewport();return render();}
    const minX=Math.min(...ui.canvas.nodes.map(n=>n.x)),maxX=Math.max(...ui.canvas.nodes.map(n=>n.x+150));
    const minY=Math.min(...ui.canvas.nodes.map(n=>n.y)),maxY=Math.max(...ui.canvas.nodes.map(n=>n.y+150));
    const width=Math.max(260,viewport.clientWidth-48),height=Math.max(180,viewport.clientHeight-64);
    const scale=Math.max(.4,Math.min(1.1,Math.min(width/(maxX-minX),height/(maxY-minY))));
    const paddingX=Math.max(24,(viewport.clientWidth-(maxX-minX)*scale)/2);
    const paddingY=Math.max(32,(viewport.clientHeight-(maxY-minY)*scale)/2);
    ui.canvas.zoom=Math.round(scale*100);
    ui.canvas.viewport={x:Math.max(0,minX*scale-paddingX),y:Math.max(0,minY*scale-paddingY)};
    render();
  }
  function restoreCanvasViewport() {
    if(!ui.canvas||route().parts[2]!=="canvas")return;
    if(ui.canvas.initialFitPending){
      ui.canvas.initialFitPending=false;
      return requestAnimationFrame(()=>fitCanvas());
    }
    requestAnimationFrame(()=>{const viewport=document.querySelector(".canvas-viewport");if(!viewport)return;viewport.scrollLeft=ui.canvas.viewport?.x||0;viewport.scrollTop=ui.canvas.viewport?.y||0;});
  }
  function syncTableScrollbars() {
    document.querySelectorAll("[data-table-scrollbar]").forEach(track=>{
      const key=track.dataset.tableScrollbar;
      const area=document.querySelector(`[data-table-scroll="${key}"]`);
      const thumb=track.querySelector(".table-scroll-thumb");
      if(!area||!thumb)return;
      const trackWidth=track.clientWidth;
      const maxScroll=Math.max(0,area.scrollWidth-area.clientWidth);
      const thumbWidth=maxScroll?Math.min(trackWidth,Math.max(48,trackWidth*(area.clientWidth/area.scrollWidth))):trackWidth;
      const travel=Math.max(0,trackWidth-thumbWidth);
      const thumbLeft=maxScroll&&travel?(area.scrollLeft/maxScroll)*travel:0;
      thumb.style.width=`${thumbWidth}px`;
      thumb.style.transform=`translateX(${thumbLeft}px)`;
      track.classList.toggle("disabled",maxScroll===0);
      track.setAttribute("aria-valuemin","0");
      track.setAttribute("aria-valuemax",String(Math.round(maxScroll)));
      track.setAttribute("aria-valuenow",String(Math.round(area.scrollLeft)));
    });
  }
  function updateEdgesDom() {
    if(!ui.canvas)return; document.querySelectorAll(".canvas-edge").forEach(path=>{const a=nodeById(path.dataset.from),b=nodeById(path.dataset.to);if(a&&b)path.setAttribute("d",`M ${a.x+150} ${a.y+75} C ${a.x+172} ${a.y+75}, ${b.x-22} ${b.y+75}, ${b.x} ${b.y+75}`);});
  }

  function modalShell(title,subtitle,body,foot,size) { return `<div class="modal-backdrop"><section class="modal ${size||""}" role="dialog" aria-modal="true"><header><div><h2>${esc(title)}</h2>${subtitle?`<p>${esc(subtitle)}</p>`:""}</div><button class="icon-button" data-action="close-modal" aria-label="关闭">${icon("close")}</button></header><div class="modal-body">${body}</div>${foot?`<footer>${foot}</footer>`:""}</section></div>`; }
  function wizardSteps(items,current) { return `<ol class="wizard-steps">${items.map((x,i)=>`<li class="${current===i+1?"active":current>i+1?"done":""}"><span>${current>i+1?icon("check"):i+1}</span><strong>${esc(x)}</strong></li>`).join("")}</ol>`; }
  function sourceWizardModal() {
    const d=ui.sourceDraft, steps=["选择来源","基础设置","登记规则","完成创建"];
    let body="";
    if(d.step===1) body=`${wizardSteps(steps,1)}<div class="choice-grid two"><button class="choice-card" data-action="source-type" data-value="workbook">${icon("file")}<strong>手工工作簿</strong><span>选择或拖入一个 .xlsx 文件，完成结构识别并形成首个快照。</span>${badge("可用","success")}</button><button class="choice-card" data-action="source-type" data-value="folder">${icon("folder")}<strong>指定共享文件夹</strong><span>配置平台可持续访问目录、匹配规则、去重和同步计划。</span>${badge("可用","success")}</button></div>`;
    if(d.step===2) body=`${wizardSteps(steps,2)}<div class="form-grid"><label class="field"><span>数据源名称</span><input data-bind="source.name" value="${esc(d.name)}" placeholder="例如：月度经营工作簿" /></label><label class="field"><span>来源类型</span><input value="${d.type==="folder"?"指定共享文件夹":"手工工作簿"}" readonly /></label><label class="field span-2"><span>说明</span><textarea data-bind="source.description" placeholder="说明这项来源持续提供什么原始数据">${esc(d.description)}</textarea></label><label class="field"><span>重复内容处理</span><select><option>复用已有快照并保留重复指向</option></select></label><label class="field"><span>数据截至时间获取方式</span><select data-bind="source.asOfMode"><option ${d.asOfMode==="人工确认"?"selected":""}>人工确认</option><option ${d.asOfMode==="从文件名识别后确认"?"selected":""}>从文件名识别后确认</option><option ${d.asOfMode==="从指定单元格读取后确认"?"selected":""}>从指定单元格读取后确认</option></select></label></div>`;
    if(d.step===3 && d.type!=="folder") body=`${wizardSteps(steps,3)}<div class="confirmation-card"><h3>真实文件读取规则</h3><div class="summary-grid">${fact("允许格式","完整 .xlsx 工作簿")}${fact("内容身份","读取全部字节并计算 SHA-256")}${fact("重复内容","复用已有内容证据，不新造快照")}${fact("数据截至","上传后另行人工确认")}</div>${notice("完成数据源创建时不会生成快照。进入详情页实际选择文件、读取成功并计算内容指纹后，才形成首个原始快照。","info")}</div>`;
    if(d.step===3 && d.type==="folder") body=`${wizardSteps(steps,3)}<div class="form-grid"><label class="field span-2"><span>平台可持续访问的文件夹路径</span><input data-bind="source.folderPath" value="/Users/domi/Public/Vibecoding/ontology3.0/demo_shared/融资数据待处理/" /></label><label class="field"><span>文件匹配规则</span><input value="*.xlsx" /></label><label class="field"><span>扫描子目录</span><select><option>否</option><option>是</option></select></label><label class="field"><span>同步模式</span><select data-bind="source.schedule"><option value="manual">仅手工同步</option><option value="daily">每日指定时间</option></select></label><label class="field"><span>时区</span><select><option>Asia/Shanghai</option></select></label><label class="field"><span>执行时间</span><input type="time" value="09:00" /></label><label class="field"><span>数据截至时间</span><select><option>从文件名识别后人工确认</option></select></label></div>${notice("来源同步计划只负责取得文件、内容去重和形成快照；不会自动宣称管道、发布或本体刷新成功。","info")}`;
    if(d.step===4) body=`${wizardSteps(steps,4)}<div class="confirmation-card"><h3>确认数据源配置</h3><div class="summary-grid">${fact("名称",d.name||"尚未填写")}${fact("类型",d.type==="folder"?"指定共享文件夹":"手工工作簿")}${fact("内容去重","复用已有内容证据")}${fact("数据截至",d.asOfMode)}${fact("初始快照","尚未形成")}${fact("同步计划",d.type==="folder"?(d.schedule==="daily"?"每日指定时间":"仅手工同步"):"按需上传")}</div>${notice(d.type==="folder"?"创建后通过手工同步真实发现文件；只有读取成功才形成快照。":"创建后进入详情页上传真实工作簿；只有读取成功才形成快照。","info")}</div>`;
    const back=d.step>1?button("上一步","source-wizard-back"):button("取消","close-modal"); const next=d.step<4?button("下一步","source-wizard-next","primary","chevron"):button("完成新建","source-wizard-complete","primary","check");
    return modalShell("新建数据源","通用来源配置，不绑定具体业务场景",body,`${back}${next}`,"wide");
  }
  function uploadSnapshotModal(sourceId) {
    const s=D.sources.find(x=>x.id===sourceId)||D.sources[0];
    const processing=ui.modal.data.processing;
    return modalShell("上传新快照",`${s.name} · 新文件进入同一个稳定数据源`,processing?`<div class="bottom-summary">${badge("处理中","info")}<strong>正在读取文件并计算内容指纹</strong><span>文件大小、读取时间和 SHA-256 将进入快照证据。</span></div>`:`<div class="drop-zone">${icon("upload")}<strong>选择一个完整全量工作簿</strong><span>不追加、不增量合并；相同内容不会形成重复快照。</span><input id="snapshot-file" type="file" accept=".xlsx" /></div>${notice("上传只负责登记文件快照。形成快照后，必须另行确认数据截至时间；上传时间不能代替业务时点。只有已核验指纹的融资工作簿可以进入正式运行。","info")}`,processing?"":`${button("取消","close-modal")}${button("读取并登记快照","register-snapshot","primary","upload")}`,"medium");
  }
  function revisionEvidenceModal() {
    const s=D.sources.find(x=>x.id==="s003-workbook");
    return modalShell("工作簿修订证据","只改表头，不改业务数据",`<div class="evidence-diff"><div><span>修改位置</span><strong>财务数据!AA1</strong></div><div><span>修改前</span><code>利润总额_本年累计数</code></div><div><span>修改后</span><code>利润总额_本年累计数(上年)</code></div><div><span>修改原因</span><strong>用户确认 I 为 2025 本年，AA 为 2024 上一年</strong></div></div><div class="hash-pair"><code>${esc(s.previousSha256)}</code><span>修订前 SHA-256</span><code>${esc(s.sha256)}</code><span>当前 SHA-256</span></div><ul class="check-list"><li>${icon("check")}未改变业务数据</li><li>${icon("check")}Sheet 范围保持</li><li>${icon("check")}财务数据十进制数值校验保持</li><li>${icon("check")}原调节因子 Sheet 的下拉校验作为附件历史保留，不作为当前输入或模型配置真源</li></ul>`,button("关闭","close-modal","primary"),"medium");
  }
  function qualityEvidenceModal() {
    const passed=[
      {key:"sheets",name:"当前输入与附件范围",summary:"当前输入：财务数据 A1:AA22；附件历史：调节因子 A1:I22",evidence:"工作簿中的财务数据 Sheet 是当前数据源输入；调节因子 Sheet 仅证明原始附件结构和初始取值来源，不进入当前管道，也不作为 M01 模型配置真源。",scope:"当前输入：财务数据!A1:AA22；附件历史：调节因子!A1:I22",result:"21 条当前财务输入；21 条附件历史记录"},
      {key:"units",name:"附件初始取值对照",summary:"财务企业与附件历史各 21 个，集合与顺序一致",evidence:"该对照只证明原附件形成时的企业集合一致；当前企业因子取值由独立 T053 输入快照提供，不进入本数据源或管道。",scope:"财务数据!A2:A22；附件历史 调节因子!A2:A22",result:"21 对历史对照；差异 0"},
      {key:"headers",name:"重复表头修正",summary:"27 个财务表头唯一；I/AA 业务值未改",evidence:"仅将财务数据!AA1 从“利润总额_本年累计数”改为“利润总额_本年累计数(上年)”。I 列仍表示 2025 本年累计，AA 列仍表示 2024 上年本年累计。",scope:"财务数据!I1、AA1；修订前后 SHA-256",result:"表头唯一；业务数据未改变"},
      {key:"numeric",name:"财务数据类型",summary:"546 个财务数据单元均为数值",evidence:"对单位名称之外的 26 个财务字段逐单元检查值类型；未发现文本混入、公式错误或无法解析值。",scope:"财务数据!B2:AA22",result:"546 / 546 为数值"},
      {key:"time-unit",name:"时点与单位",summary:"2025-12-31；CNY；元",evidence:"业务评估时点、币种和金额单位已由业务方确认；取得时间或文件修改时间不替代数据截至时间。",scope:"本次核验文件整体",result:"数据截至 2025-12-31；人民币元"},
      {key:"environment",name:"附件不适用语义对照",summary:"附件历史 G18:G21 为空；T053 输入快照显式记为 NOT_APPLICABLE",evidence:"四家环保企业不适用“电价波动率”。原附件空值只作历史证据；当前 T053 企业因子输入快照显式保存 NOT_APPLICABLE，不自动改为缺失 0 档。",scope:"附件历史 调节因子!G18:G21；T053 企业因子输入快照",result:"不适用语义已显式分离；异常 0"}
    ];
    const expanded=ui.modal?.data?.evidenceKey||"";
    const checks=passed.map(x=>`<div class="stack"><div class="check-row"><div><strong>${esc(x.name)}</strong><p>${esc(x.summary)}</p></div>${badge("通过","success")}<button data-action="quality-evidence-detail" data-evidence-key="${esc(x.key)}" aria-expanded="${expanded===x.key}">${expanded===x.key?"收起详情":"查看详情"}</button></div>${expanded===x.key?`<div class="confirmation-card"><p>${esc(x.evidence)}</p><div class="summary-grid">${fact("核验范围",x.scope)}${fact("核验结果",x.result)}${fact("证据来源","当前校正工作簿")}${fact("核验性质","来源内容与结构检查")}</div></div>`:""}</div>`).join("");
    return modalShell("来源内容核验","当前结果只覆盖工作簿内容和结构",`<div class="quality-section"><div class="quality-section-head"><strong>内容核验已完成</strong>${badge(`${passed.length} 项`,"success")}</div>${checks}</div><div class="quality-section"><div class="quality-section-head"><strong>处理与发布状态</strong>${badge("不可消费","neutral")}</div>${[["财务输入身份","尚未生成稳定标识"],["Python 处理","尚未执行"],["正式质量结论","尚未形成"],["财务资产版本","尚未发布"]].map(x=>`<div class="check-row"><div><strong>${x[0]}</strong><p>${x[1]}</p></div>${badge("未开始","neutral")}</div>`).join("")}</div>${notice("完成处理定义、正式运行、质量门和资产发布后，财务数据才会进入资产目录；企业因子不经过本管道。","warning")}`,button("关闭","close-modal","primary"),"wide");
  }
  function newPipelineModal() {
    const d=ui.pipelineDraft,steps=["基础信息","创建草稿","运行与自动化"];
    let body="";
    if(d.step===1) body=`${wizardSteps(steps,1)}<div class="form-grid"><label class="field"><span>管道名称</span><input data-bind="pipeline.name" value="${esc(d.name)}" /></label><label class="field"><span>目标数据资产名称</span><input data-bind="pipeline.assetName" value="${esc(d.assetName)}" /></label><label class="field span-2"><span>用途说明</span><textarea data-bind="pipeline.purpose" placeholder="说明管道生产什么可信数据资产，不填写 Metric/Rule 业务逻辑">${esc(d.purpose)}</textarea></label></div>`;
    if(d.step===2) body=`${wizardSteps(steps,2)}<div class="choice-grid two"><button class="choice-card ${d.template==="five"?"selected":""}" data-action="pipeline-template" data-value="five">${icon("workflow")}<strong>融资标准化发布模板</strong><span>带入五类节点、融资四成员三关系要求和命名输入槽；仍需逐节点核对与配置。</span></button><button class="choice-card ${d.template==="blank"?"selected":""}" data-action="pipeline-template" data-value="blank">${icon("plus")}<strong>空白编辑草稿</strong><span>保留同一目标数据资产要求，从节点库拖入节点并使用连接点建立连线。</span></button></div>${notice("创建的是可持续管理的独立管道和目标数据资产。保存草稿、发布管道定义和发布数据资产是三个不同动作。","info")}`;
    if(d.step===3) body=`${wizardSteps(steps,3)}<div class="automation-columns"><article><span class="eyebrow">来源同步计划</span><h3>由数据源独立配置</h3><p>共享文件夹取得新文件、内容去重并形成快照。</p></article><article><span class="eyebrow">管道运行计划</span><h3>当前仅手工正式运行</h3><p>可改为发现新内容后触发，必须绑定已发布定义版本。</p></article><article><span class="eyebrow">本体刷新策略</span><h3>在第 5 节点配置</h3><p>资产发布后自动或人工提交请求；权威消费采用仍由本体管理负责。</p></article></div><div class="automation-chain"><span>新快照</span>${icon("chevron")}<span>内容去重</span>${icon("chevron")}<span>正式运行</span>${icon("chevron")}<span>质量门</span>${icon("chevron")}<span>发布资产</span>${icon("chevron")}<span>提交刷新请求</span>${icon("chevron")}<span>正式采用或上一可信版本</span></div>${notice("任一步失败都不切换消费；同一场景工作轮次内内容重复可记录“正式运行成功·无数据变化”，但不重复发布相同资产版本。新工作轮次形成独立版本并保留前序证据。","warning")}`;
    return modalShell("新建管道","从编辑草稿到可正式运行的定义生命周期",body,`${d.step>1?button("上一步","pipeline-wizard-back"):button("取消","close-modal")}${d.step<3?button("下一步","pipeline-wizard-next","primary","chevron"):button("创建编辑草稿","pipeline-wizard-complete","primary","check")}`,"wide");
  }
  function publishDefinitionModal() {
    const inputs=selectedInputContexts(),sourceCount=ui.canvas.nodes.filter(n=>n.key==="source").length;
    return modalShell("发布管道定义版本","发布的是可复现配置，不是数据资产",`${notice("发布后，节点、连线、参数、命名输入槽和受控脚本版本形成只读记录；继续编辑必须创建新草稿。","warning")}<div class="confirmation-card"><div class="summary-grid">${fact("管道",ui.canvas.name)}${fact("待发布版本",nextDefinitionVersion())}${fact("本次输入",inputs.map(x=>x.version).join("；"))}${fact("数据截至",[...new Set(inputs.map(x=>x.asOf))].join(" / "))}${fact("节点",`${ui.canvas.nodes.length} 个（来源 ${sourceCount} 个）`)}${fact("连线",`${ui.canvas.edges.length} 条`)}${fact("输入槽",pythonInputSlots().map(x=>`${x.name}${x.required?"（必需）":"（可选）"}`).join("；"))}${fact("受控脚本",`${ui.canvas.pythonModule.name} ${ui.canvas.pythonModule.version}`)}</div><label class="check-field"><input id="definition-confirm" type="checkbox" /> 我已核对节点、连线、参数、本次输入、数据时点和脚本版本。</label></div>`,`${button("取消","close-modal")}${button("确认发布定义","confirm-publish-definition","primary","package")}`,"medium");
  }
  function formalRunModal() {
    const definition=publishedDefinition(ui.canvas?.definitionLabel),python=definition?.nodes?.find(n=>n.key==="python"),inputs=definition?connectedInputContexts(python?.id,{nodes:definition.nodes,edges:definition.edges,pythonModule:definition.pythonModule,targetAssetId:definition.targetAssetId}):[],authority=authorityVersion();
    const inputRows=inputs.map(x=>`<div class="check-row"><div><strong>${esc(x.slot)}</strong><p>${esc(x.name)} · ${esc(x.kind)} · ${esc(x.memberScope)}</p></div>${badge(x.allowed?"可锁定":"阻断",x.allowed?"success":"danger")}<small>${esc(x.versionPolicy||"固定精确快照")} → ${esc(x.version)} · 数据截至 ${esc(x.asOf)} · ${esc(x.fingerprint)}</small></div>`).join("");
    return modalShell(flow.currentRunId?"重新运行":"开始正式运行","本次运行绑定所选已发布定义和其中全部命名输入",`${notice("运行依次执行精确输入锁定、Python 处理和正式质量门；检查结论由规则执行结果形成，用户不能在运行前指定。质量允许发布后仍需在发布节点确认。","info")}<div class="summary-grid">${fact("管道定义",definition?.id||"未找到")}${fact("输入槽",`${inputs.length} 个`)}${fact("统一数据截至",[...new Set(inputs.map(x=>x.asOf))].join(" / ")||"未知")}${fact("触发方式","手工运行")}${fact("质量检查",`${(definition?.qualityRules||[]).filter(x=>x.enabled!==false).length} 项已启用规则`) }${fact("当前正式消费版本",authority?.id||"无")}${fact("失败保护",authority?`${authority.id} 继续服务`:"不产生可消费版本")}</div><div class="quality-section"><div class="quality-section-head"><strong>本次锁定输入</strong>${badge(`${inputs.length} 个`,"info")}</div>${inputRows}</div>${authority?notice(`本次候选运行不会覆盖当前正式消费版本 ${authority.id}；发布和刷新完成前，消费上下文保持不变。`,"success"):""}`,`${button("取消","close-modal")}${button("开始运行","start-formal-run","primary","play",!definition||!inputs.length||inputs.some(x=>!x.allowed))}`,"wide");
  }
  function refreshSubmitModal() {
    const run=actionRunForCanvas(),version=candidateVersion(),gate=ontologyBindingGate(),binding=gate.binding,authority=authorityVersion(version?.targetAssetId||"FIN-ASSET"),lastAttempt=refreshAttemptsForVersion(version?.id).at(-1),retry=flow.refreshStatus==="failed"&&lastAttempt;
    if(!run||!version)return modalShell("提交本体刷新请求","当前没有可提交的数据资产版本",notice("请先完成正式运行、数据检查和数据资产发布。","warning"),button("关闭","close-modal","primary"),"small");
    if(!gate.okay)return modalShell("提交本体刷新请求","提交前检查未通过",`${notice(gate.problems.join("；"),"danger","缺少可用目标绑定")}<p>请前往本体管理建立或修复消费绑定。返回本页面后，为本次资产版本选择可用绑定再提交。</p>`,`${button("取消","close-modal")}<a class="btn primary" href="${esc(ontologyManagementHref())}" target="_blank" rel="noopener">前往本体管理处理</a>`,"medium");
    const body=`${notice("数据工程只提交本次资产版本并记录刷新请求；本体处理、兼容性校验、正式采用和下游使用版本由本体管理负责。提交后，本页只读显示外部返回的状态与证据。","info")}<div class="summary-grid">${fact("本次数据资产版本",version.id)}${fact("数据截至",version.asOf)}${fact("质量状态",version.quality)}${fact("目标绑定",binding.name)}${fact("目标本体",binding.publishedSemanticName)}${fact("正在给下游使用",authority?.id||"无")}</div><section class="readonly-binding-card"><div><strong>只读目标与映射</strong>${badge(binding.status,binding.status==="可用"?"success":"warning")}</div><dl><dt>数据成员覆盖</dt><dd>${binding.memberMappingCount} 个</dd><dt>数据关系覆盖</dt><dd>${binding.relationshipMappingCount} 条</dd><dt>映射配置</dt><dd>${esc(binding.sourceMappingName||"已建立的数据到本体映射")}</dd><dt>维护责任方</dt><dd>${esc(binding.owner)}</dd></dl><p>${esc(binding.mappingSummary)}。数据工程不能在此新增或修改业务对象、属性、关系或字段映射。</p><details class="contract-identifiers"><summary>查看映射证据编号</summary><small>${esc(binding.sourceMappingVersionId)}</small></details></section>${retry?notice(`这是对同一资产版本的新请求；原失败请求 ${lastAttempt.requestId} 和失败证据继续保留。`,"warning","关联重试"):""}`;
    return modalShell(retry?"重新提交本体刷新请求":"提交本体刷新请求",`${version.id} · 提交后目标绑定与资产版本锁定`,body,`${button("取消","close-modal")}${button(retry?"确认重新提交":"确认提交请求","confirm-refresh-submit","primary","refresh")}`,"wide");
  }
  function qualityWarningModal() {
    const run=currentRun();return modalShell("处理质量警告","警告不自动打开发布门",`${notice("请说明为何本次警告不影响资产可信度。理由将进入正式质量和运行证据。","warning")}<div class="summary-grid">${fact("正式运行",run?.id||"无")}${fact("质量结果",run?.quality||"有警告")}${fact("当前权威",authorityVersion()?.id||"无")}</div><label class="field"><span>继续发布理由</span><textarea id="quality-warning-reason" placeholder="例如：负责人覆盖率警告不影响融资余额、机构和主体关系完整性"></textarea></label>`,`${button("取消","close-modal")}${button("填写理由并允许继续","approve-quality-warning","primary","check")}`,"small");
  }
  function confirmSnapshotModal() {
    const snapshot=currentFinanceSnapshot(),confirmation=currentT008ForSnapshot(snapshot);return modalShell("确认数据截至时间","数据截至时间将与当前快照共同进入运行证据",`<div class="summary-grid">${fact("当前快照",currentFinanceFileName())}${fact("内容指纹",snapshot?.hash||"尚无")}${fact("结构核验",snapshot?.structureStatus||"尚未核验")}${fact("取得时间",snapshot?.acquiredAt||"本轮尚未取得")}</div><label class="field"><span>数据截至时间</span><input id="as-of-confirm" type="date" value="${esc(confirmation?.asOf||"")}" /></label><label class="field"><span>确认依据</span><textarea id="as-of-basis" placeholder="例如：工作簿业务说明及用户确认">${esc(confirmation?.basis||"")}</textarea></label>${notice("取得时间记录文件何时进入平台，不能替代数据截至时间。确认人、确认时间和依据会与该快照一起保留。","warning")}`,`${button("取消","close-modal")}${button("确认数据截至时间","save-snapshot-confirmation","primary","check",!snapshot)}`,"small");
  }
  function resetFlowModal() {
    return modalShell("重置当前场景工作轮次","清理当前工作投影并等待平台提供新轮次",`${notice("重置会清除本轮所选快照、T008 确认、候选运行和刷新工作状态，但保留历史快照、正式运行、已发布资产版本、交付、刷新尝试和全部证据。平台提供新的场景运行上下文前，不能登记快照或发起正式动作。","warning")}<label class="check-field"><input id="reset-confirm" type="checkbox" /> 我确认重置当前场景工作轮次并等待平台提供新轮次。</label>`,`${button("取消","close-modal")}${button("确认重置","confirm-reset-flow","danger","refresh")}`,"small");
  }
  function unsavedDraftModal() {
    return modalShell("草稿尚未保存","请选择如何处理当前画布修改",`${notice("切换定义或离开画布前必须明确处理未保存修改；取消后继续留在当前画布。","warning")}<div class="summary-grid">${fact("当前管道",ui.canvas?.name||"未命名管道")}${fact("草稿状态","有未保存修改")}${fact("已保存基线",flow.canvasDrafts[ui.canvas?.id]?.savedAt||ui.canvas?.baseVersion||"尚无")}</div>`,`${button("取消","cancel-canvas-transition")}${button("放弃并继续","discard-and-continue","soft","close")}${button("保存并继续","save-and-continue","primary","save")}`,"small");
  }
  function pipelineScheduleModal() {
    const pipelineId=ui.modal?.data?.pipelineId||ui.canvas?.id||"finance-pipeline",schedule=currentPipelineSchedule(pipelineId),definition=latestDefinitionForPipeline(pipelineId);
    return modalShell("管道运行计划","与来源同步计划、本体刷新策略分别配置",`<div class="form-grid"><label class="field"><span>当前模式</span><select id="pipeline-schedule-mode"><option ${schedule==="仅手工正式运行"?"selected":""}>仅手工正式运行</option><option ${schedule==="新快照形成且内容变化后触发"?"selected":""}>新快照形成且内容变化后触发</option><option ${schedule==="每日 09:00"?"selected":""}>每日 09:00</option></select></label><label class="field"><span>绑定定义版本</span><input value="${esc(definition?.id||"发布定义后可绑定")}" readonly /></label><label class="field"><span>无数据变化</span><select><option>同一场景工作轮次内不发布重复版本</option></select></label><label class="field"><span>失败处理</span><select><option>停止后续步骤，上一可信版本继续服务</option></select></label></div><div class="automation-chain compact"><span>来源同步</span>${icon("chevron")}<span>形成快照</span>${icon("chevron")}<span>仅新内容触发正式运行</span>${icon("chevron")}<span>质量与发布</span></div>`,`${button("取消","close-modal")}${button("保存计划","save-pipeline-schedule","primary","save",false,`data-pipeline-id="${esc(pipelineId)}"`)}`,"medium");
  }
  function finishPendingCandidateModal() {
    const version=candidateVersion(),run=currentRun();
    return modalShell("结束未提交刷新的候选","释放下一次正式运行，不删除已发布数据资产或交付证据",`<div class="summary-grid">${fact("候选数据资产",version?.id||"状态已变化")}${fact("正式运行",run?.id||"无法定位")}${fact("刷新请求","尚未提交")}${fact("消费状态",version?.consumptionStatus||"不可消费")}</div><label class="field"><span>结束原因</span><textarea id="finish-pending-candidate-reason" placeholder="例如：补充三条 Rule 必需字段后形成新的数据资产版本"></textarea></label>${notice("确认后，该版本继续作为不可消费历史版本保留；既有 C003 接收、运行、质量和发布证据不会被改写。","warning")}`,`${button("取消","close-modal")}${button("确认结束候选","confirm-finish-pending-candidate","danger","close",!version||!run)}`,"medium");
  }
  function shortcutModal() {
    const rows=[["撤销","⌘ / Ctrl + Z"],["保存草稿","⌘ / Ctrl + S"],["适应窗口","F"],["放大 / 缩小","+ / −"],["关闭最上层弹层、菜单或连线状态","Esc"]];
    return modalShell("画布快捷键","节点删除只通过右侧配置栏的明确按钮执行；Esc 不退出页面、不丢弃草稿。",`<div class="shortcut-list">${rows.map(x=>`<div><span>${esc(x[0])}</span><kbd>${esc(x[1])}</kbd></div>`).join("")}</div>`,button("关闭","close-modal","primary"),"small");
  }
  function runFieldsModal() {
    return modalShell("正式运行记录字段规范","运行历史不保留调试记录",`<div class="field-pill-grid">${["运行编号","管道名称","管道定义版本","精确开始时间","执行状态与执行结束时间","执行耗时","闭环状态与闭环结束时间","闭环总耗时","触发方式与操作者","命名输入槽与精确来源版本","数据截至时间","正式质量状态与处置理由","是否有数据变化","是否形成资产候选","发布资产及精确版本","刷新请求与本体处理结果","本体侧正式采用与消费状态","失败节点与原因","恢复操作","与原运行的重试关系"].map((x,i)=>`<span><em>${i+1}</em>${esc(x)}</span>`).join("")}</div>${notice("选择一条记录后，按“运行摘要／节点与质量／发布与刷新”核对输入、两段耗时、质量证据、刷新尝试链和恢复方式。","info")}`,button("关闭","close-modal","primary"),"wide");
  }
  function runDetailModal(runId) {
    const run=flow.runs.find(x=>x.id===runId); if(!run)return modalShell("运行详情","记录不存在",emptyState("未找到运行记录","请返回运行历史重新选择。"),button("关闭","close-modal","primary"),"small");
    const failed=/失败|无法判断/.test(run.status),refreshIssue=/刷新失败|结果未知/.test(run.status),tab=ui.modal?.data?.tab||"summary",tabs=[["summary","运行摘要"],["nodes","节点与质量"],["publish-refresh","发布与刷新"]];
    const inputs=run.inputs||[{slot:"主输入",kind:"手工工作簿",name:"融资一览表",version:run.snapshot,snapshot:run.snapshot,fingerprint:run.snapshotHash,asOf:run.asOf,memberScope:"不适用",gate:"已锁定"}];
    const executions=run.nodeExecutions||[],attempts=flow.refreshAttempts.filter(x=>x.runId===run.id||x.assetVersionId===run.assetVersion);
    let body="";
    if(tab==="nodes")body=executions.length?`${failed?notice(`${run.failureReason}。${run.recovery}。`,"danger","执行或质量门已阻断"):notice("节点执行和正式质量均绑定本次所选输入与定义版本。","info")}<div class="summary-grid">${fact("正式质量结果",run.qualityId||"未形成")}${fact("质量结论",run.quality)}${fact("警告处置",run.qualityDisposition||"无")}${fact("警告理由",run.qualityWarningReason||"无")}${fact("失败节点",run.failureNode||"无")}${fact("失败原因",run.failureReason||"无")}${fact("恢复方式",run.recovery||"无需恢复")}</div><div class="quality-section">${executions.map((x,index)=>`<div class="check-row run-timeline-row"><div><span class="eyebrow">${String(index+1).padStart(2,"0")} · ${esc(x.key)}</span><strong>${esc(x.name)}</strong><p>${esc(x.inputSummary||"等待上游")} → ${esc(x.outputSummary||"尚未形成")}</p></div>${badge(x.status,x.status==="成功"?"success":/失败|无法判断/.test(x.status)?"danger":/运行|待|未知/.test(x.status)?"warning":"neutral")}<small>${esc(x.startedAt||"未开始")} — ${esc(x.endedAt||"未结束")} · ${esc(elapsedText(x.startedAt,x.endedAt))}</small></div>`).join("")}</div>`:notice("该历史记录没有节点级证据；可查看运行摘要，但不能补造节点结果。","warning","节点证据不可定位");
    else if(tab==="publish-refresh")body=`${refreshIssue?notice("资产版本已保留，但刷新失败或结果未知；请回到提交本体刷新请求节点查询原请求或按恢复建议处理，不能覆盖原证据。","warning","刷新尚未收敛"):notice("数据资产发布、刷新请求、本体处理和本体侧正式采用按阶段归属于同一运行。","info")}<div class="summary-grid">${fact("资产版本",run.assetVersion||"未形成")}${fact("闭环状态",run.closureStatus||"未记录")}${fact("执行耗时",elapsedText(run.startedAt,run.executionEndedAt))}${fact("发布后耗时",elapsedText(run.executionEndedAt,run.closedLoopEndedAt))}${fact("刷新结果",run.refresh||"未请求")}${fact("消费状态",run.consumption||"不可消费")}${fact("重试来源",run.retryOf||"无")}</div><div class="lineage-chain"><span>所选输入<small>${esc(inputs.map(x=>x.version).join("；"))}</small></span>${icon("chevron")}<span>定义与运行<small>${esc(run.definitionVersion)} · ${esc(run.id)}</small></span>${icon("chevron")}<span>质量与发布<small>${esc(run.qualityId||"未形成")} · ${esc(run.assetVersion||"未形成")}</small></span>${icon("chevron")}<span>刷新与消费<small>${esc(run.refresh)} · ${esc(run.consumption)}</small></span></div>${attempts.length?`<div class="quality-section"><div class="quality-section-head"><strong>刷新尝试记录</strong>${badge(`${attempts.length} 次`,"info")}</div>${attempts.map(a=>`<div class="check-row"><div><strong>${esc(a.requestId)}</strong><p>${a.retryOf?`重试 ${esc(a.retryOf)}`:"首次请求"} · 目标本体版本 ${esc(a.targetT017||"未记录")} · 本次资产 ${esc(a.assetVersionId)}</p></div>${badge(a.t019Status==="已采用"?"已正式采用":a.resultStatus==="失败"?"处理失败":a.requestStatus==="结果未知"?"结果未知":a.t018Status==="可消费候选"?"待正式采用":"处理中",a.t019Status==="已采用"?"success":a.resultStatus==="失败"?"danger":"warning")}<small>处理结果 ${esc(a.resultId||"尚未返回")} · 候选资格 ${esc(a.t018Status||"尚未形成")} · 正式采用证据 ${esc(a.t019EvidenceId||"尚未取得")}</small></div>`).join("")}</div>`:""}`;
    else body=`${failed?notice(`${run.failureReason}。${run.recovery}。`,"danger","运行已阻断"):refreshIssue?notice("运行已经形成资产，但刷新尚未收敛；当前正式消费版本继续服务。","warning"):notice("该运行记录按同一组所选输入、定义版本和数据时点追溯。","info")}<div class="summary-grid">${fact("管道",run.pipelineName||"数据管道")}${fact("开始时间",run.startedAt)}${fact("执行状态",run.executionStatus||"未记录")}${fact("执行结束",run.executionEndedAt||"尚未结束")}${fact("执行耗时",elapsedText(run.startedAt,run.executionEndedAt))}${fact("闭环状态",run.closureStatus||"未记录")}${fact("闭环结束",run.closedLoopEndedAt||"尚未收敛")}${fact("闭环总耗时",elapsedText(run.startedAt,run.closedLoopEndedAt))}${fact("数据截至",run.asOf)}${fact("质量",run.quality)}${fact("资产版本",run.assetVersion||"未形成")}${fact("消费状态",run.consumption)}</div><div class="quality-section"><div class="quality-section-head"><strong>本次锁定输入</strong>${badge(`${inputs.length} 个命名槽`,"info")}</div>${inputs.map(x=>`<div class="check-row"><div><strong>${esc(x.slot||"输入")}</strong><p>${esc(x.name)} · ${esc(x.kind)} · ${esc(x.memberScope||"不适用")}</p></div>${badge("已锁定","success")}<small>${esc(x.version)} · 数据截至 ${esc(x.asOf)} · 内容指纹 ${esc(x.fingerprint)}</small></div>`).join("")}</div>`;
    const executionRetryable=/失败|无法判断/.test(run.executionStatus||"")&&!run.assetVersion;
    return modalShell("正式运行详情",`${run.id} · ${run.definitionVersion}`,`${topTabs(tabs,tab,"run-detail-tab")}${body}`,`${button("关闭","close-modal")}${executionRetryable?button("按原输入与定义重试","retry-run","primary","refresh",false,`data-run-id="${run.id}"`):""}`,"wide");
  }
  function sourcePickerModal() {
    const assets=D.targetAssets.filter(a=>a.published);
    const sourceRows=D.sources.map(s=>{const snapshot=currentSnapshotForSource(s.id),allowed=Boolean(!s.planned&&s.enabled&&s.selectable!==false&&snapshot),reason=allowed?"本轮可选择":s.planned?"后期规划":s.selectable===false?"当前阶段不可选":!s.enabled?"未启用":s.snapshotCount?"本轮未选择快照":"暂无快照";return `<button class="picker-row" data-action="choose-source-input" data-source-id="${esc(s.id)}" ${allowed?"":"disabled"}><div><strong>${esc(s.name)}</strong><span>${esc(s.category)} · 历史 ${s.snapshotCount} 个快照 · 本轮 ${snapshot?esc(snapshot.snapshotId):"未选择"} · 数据截至 ${esc(s.asOf)}</span></div>${badge(reason,allowed?"success":"neutral")}</button>`;}).join("");
    const versionRows=assets.map(a=>{
      const resolved=dataQualifiedVersionForAsset(a),followGate=assetReuseGate(a,resolved);
      const follow=`<button class="picker-row" data-action="choose-asset-input" data-policy="follow" data-asset-id="${esc(a.id)}" data-version-id="${esc(resolved?.id||"")}" data-member-scope="全部成员" ${followGate.allowed?"":"disabled"}><div><strong>${esc(a.name)} · 受控跟随最新数据侧合格版本</strong><span>当前解析 ${esc(resolved?.id||"无可用版本")} · 每次正式运行重新解析并锁定 · ${esc(followGate.reason)}</span></div>${badge(followGate.allowed?"可复用":"不可选择",followGate.allowed?"success":"neutral")}</button>`;
      const fixed=flow.assetVersions.filter(v=>!v.targetAssetId||v.targetAssetId===a.t006Id).map(v=>{const gate=assetReuseGate(a,v);return `<button class="picker-row" data-action="choose-asset-input" data-policy="fixed" data-asset-id="${esc(a.id)}" data-version-id="${esc(v.id)}" data-member-scope="全部成员" ${gate.allowed?"":"disabled"}><div><strong>${esc(a.name)} · ${esc(v.id)}</strong><span>${esc(v.asOf)} · ${a.members.length} 个成员 · 固定选择此版本 · ${esc(gate.reason)}</span></div>${badge(gate.allowed?(v.id===flow.authorityVersionId?"当前正式消费 · 可复用":"历史发布版本 · 可复用"):"不可选择",gate.allowed?"success":"neutral")}</button>`;}).join("");
      return `${follow}${fixed}`;
    }).join("");
    return modalShell("选择管道输入","每个数据源节点占用一个 Python 命名输入槽，并在正式运行时锁定所选快照或资产版本",`<div class="picker-section"><div class="picker-head"><strong>原始数据源</strong><span>正式运行时锁定一份确定快照</span></div>${sourceRows}</div><div class="picker-section"><div class="picker-head"><strong>已发布数据资产</strong><span>按资产版本、成员范围与复用门禁选择</span></div>${versionRows||emptyState("暂无可复用资产", "资产发布并通过复用门禁后，会在这里与原始来源统一选择。")}</div>`,button("关闭","close-modal","primary"),"medium");
  }
  function addRuleModal() {
    return modalShell("增加通用数据检查","规则会随当前管道定义保存，运行结果通过稳定规则编号与配置一一对应",`<div class="form-grid"><label class="field"><span>规则类型</span><select id="rule-type">${D.qualityRuleTypes.map(x=>`<option>${esc(x)}</option>`).join("")}</select></label><label class="field"><span>作用字段或范围</span><input id="rule-scope" value="融资明细 · 当前利率" /></label><label class="field"><span>判断条件 / 阈值</span><input id="rule-condition" value="数值范围 0% 至 30%" /></label><label class="field"><span>严重级别</span><select id="rule-severity"><option>硬阻断</option><option>警告</option></select></label><label class="field"><span>失败处理</span><select id="rule-failure-effect"><option>阻断发布数据资产</option><option>要求说明后才可继续发布</option></select></label><label class="field"><span>恢复建议</span><input id="rule-recovery" value="修正来源数据或检查配置后重试" /></label></div>`,`${button("取消","close-modal")}${button("添加到草稿","add-rule","primary","plus")}`,"medium");
  }
  function folderCheckModal() {
    const processing=ui.modal.data.processing;
    const completed=ui.modal.data.completed;
    const body=processing?`<div class="bottom-summary">${badge("处理中","info")}<strong>正在检查共享文件夹</strong><span>正在匹配文件并核对内容指纹。</span></div>`:completed?`${notice("同步已完成，未发现新的匹配文件。现有快照和下游状态保持不变。","success")}<div class="summary-grid">${fact("访问结果","成功")}${fact("发现新文件","0 个")}${fact("重复内容","0 个")}${fact("完成时间",flow.folderSyncAt)}</div>`:`<div class="summary-grid">${fact("同步模式","手工立即同步")}${fact("访问结果","尚未执行")}${fact("发现新文件","未知")}${fact("后续管道","只有新内容且运行计划启用时才触发")}</div>`;
    return modalShell("立即同步来源","只同步目录并形成新快照，不代表管道运行",body,processing?"":completed?button("关闭","close-modal","primary"):`${button("取消","close-modal")}${button("开始同步","sync-folder","primary","refresh")}`,"small");
  }
  function renderModal() {
    if(ui.modal.type==="product-info") { const snapshot=currentFinanceSnapshot(),confirmation=currentT008ForSnapshot(snapshot),snapshotState=!snapshot?"本轮未选择":confirmation?`已确认 · ${confirmation.asOf}`:"待确认时点";return modalShell("工作区状态","来源、处理、质量、发布和刷新",`<div class="summary-grid">${fact("融资快照",snapshotState)}${fact("管道定义",flow.definitionVersion||"编辑草稿")}${fact("最近运行",flow.runs[0]?.status||"尚无正式运行")}${fact("最新发布",latestPublishedVersion()?.id||"无")}${fact("当前正式消费版本",authorityVersion()?.id||"尚未采用")}${fact("候选版本",candidateVersion()?.id||"无")}</div>`,button("关闭","close-modal","primary"),"medium"); }
    if(ui.modal.type==="new-source") return sourceWizardModal();
    if(ui.modal.type==="upload-snapshot") return uploadSnapshotModal(ui.modal.data.sourceId);
    if(ui.modal.type==="revision-evidence") return revisionEvidenceModal();
    if(ui.modal.type==="quality-evidence") return qualityEvidenceModal();
    if(ui.modal.type==="new-pipeline") return newPipelineModal();
    if(ui.modal.type==="publish-definition") return publishDefinitionModal();
    if(ui.modal.type==="formal-run") return formalRunModal();
    if(ui.modal.type==="refresh-submit") return refreshSubmitModal();
    if(ui.modal.type==="quality-warning") return qualityWarningModal();
    if(ui.modal.type==="confirm-snapshot") return confirmSnapshotModal();
    if(ui.modal.type==="reset-flow") return resetFlowModal();
    if(ui.modal.type==="unsaved-draft") return unsavedDraftModal();
    if(ui.modal.type==="pipeline-schedule") return pipelineScheduleModal();
    if(ui.modal.type==="finish-pending-candidate") return finishPendingCandidateModal();
    if(ui.modal.type==="shortcut-help") return shortcutModal();
    if(ui.modal.type==="run-fields") return runFieldsModal();
    if(ui.modal.type==="run-detail") return runDetailModal(ui.modal.data.runId);
    if(ui.modal.type==="source-picker") return sourcePickerModal();
    if(ui.modal.type==="add-rule") return addRuleModal();
    if(ui.modal.type==="folder-check") return folderCheckModal();
    return modalShell("数据工程","当前操作暂不可用",notice("请返回数据资源或管道目录继续。","info"),button("关闭","close-modal","primary"),"small");
  }

  function render() {
    syncRouteModal();
    const r=route(); let html;
    if(r.parts[0]==="resources"&&r.parts[1]==="source") html=sourceDetail(r.parts[2]);
    else if(r.parts[0]==="resources"&&r.parts[1]==="asset") html=assetDetail(r.parts[2]);
    else if(r.parts[0]==="resources") html=resourceDirectory();
    else if(r.parts[0]==="pipelines"&&r.parts[2]==="canvas") html=canvasPage(r.parts[1]);
    else if(r.parts[0]==="pipelines") html=pipelinesPage();
    else html=notFound();
    root.innerHTML=html;
    localizeMainInterface(root);
    restoreCanvasViewport();
    requestAnimationFrame(syncTableScrollbars);
  }

  document.addEventListener("click",e=>{
    if(e.target.classList.contains("modal-backdrop")) return closeModal();
    const hashLink=e.target.closest?.('a[href^="#"]');
    if(hashLink&&!e.target.closest("[data-action]")&&queueCanvasTransition({type:"hash",value:hashLink.getAttribute("href")})){e.preventDefault();return;}
    const el=e.target.closest("[data-action]"); if(!el)return; const action=el.dataset.action; e.preventDefault();
    if(action==="close-modal") return closeModal();
    if(action==="cancel-canvas-transition"){ui.pendingCanvasTransition=null;return closeModal();}
    if(action==="save-and-continue")return continueCanvasTransition(true);
    if(action==="discard-and-continue")return continueCanvasTransition(false);
    if(action==="toast-only") return toast(el.dataset.message||"操作已完成");
    if(action==="quality-evidence-detail"){ui.modal.data.evidenceKey=ui.modal.data.evidenceKey===el.dataset.evidenceKey?"":el.dataset.evidenceKey;return render();}
    if(action==="product-info") return openModal("product-info");
    if(action==="reset-flow") return openModal("reset-flow");
    if(action==="confirm-reset-flow"){const box=document.getElementById("reset-confirm");if(!box?.checked)return toast("请先确认重置当前工作轮次");clearInterval(runTimer);clearTimeout(runTimer);clearTimeout(demoTimer);resetScenarioRun();ui.modal=null;ui.canvas=null;location.hash="#/resources";render();return toast("当前工作投影已清理；历史证据均已保留，正在等待平台提供新的完整场景运行上下文（C033）");}
    if(action==="resource-shelf") return go(`#/resources?shelf=${el.dataset.value}`);
    if(action==="source-view"){ui.sourceView=el.dataset.value;return render();}
    if(action==="asset-view"){ui.assetView=el.dataset.value;return render();}
    if(action==="select-source-card"){ui.selectedSourceId=el.dataset.id;return render();}
    if(action==="toggle-source-group"){const g=el.dataset.group;ui.collapsedGroups.has(g)?ui.collapsedGroups.delete(g):ui.collapsedGroups.add(g);return render();}
    if(action==="open-source-card") return go(`#/resources/source/${el.dataset.id}?tab=overview`);
    if(action==="open-source-detail") return go(`#/resources/source/${el.dataset.id}?tab=overview`);
    if(action==="source-detail-tab") return go(withParams({tab:el.dataset.value}));
    if(action==="asset-detail-tab") return go(withParams({tab:el.dataset.value}));
    if(action==="select-sheet"){ui.selectedSheet[el.dataset.source]=el.dataset.sheet;return render();}
    if(action==="new-source"){ui.sourceDraft={step:1,type:"",name:"",description:"",asOfMode:"人工确认",schedule:"manual",fileChosen:false,folderPath:"/data/inbound/finance/"};return openModal("new-source");}
    if(action==="source-type"){ui.sourceDraft.type=el.dataset.value;ui.sourceDraft.step=2;return render();}
    if(action==="source-wizard-back"){ui.sourceDraft.step=Math.max(1,ui.sourceDraft.step-1);return render();}
    if(action==="source-wizard-next"){if(ui.sourceDraft.step===2&&!ui.sourceDraft.name.trim())return toast("请先填写数据源名称");ui.sourceDraft.step=Math.min(4,ui.sourceDraft.step+1);return render();}
    if(action==="source-wizard-complete"){const d=ui.sourceDraft,id=`source-${Date.now()}`;const source={id,name:d.name.trim(),category:d.type==="folder"?"共享文件夹":"手工工作簿",access:d.type==="folder"?"固定目录发现":"按需上传工作簿",description:d.description.trim()||"待补充来源说明。",registration:"已配置 · 尚无快照",latestAcquired:"尚未检查",asOf:"本轮未选择",snapshotCount:0,syncPlan:d.type==="folder"?(d.schedule==="daily"?"每日指定时间":"仅手工同步"):"按需上传新快照",nextSync:d.type==="folder"?"等待首次同步":"由用户上传触发",lastSync:"尚未执行",enabled:true,selectable:true,fileName:"",snapshots:[],pipelineRefs:[],downstreamAssets:[],folderPath:d.folderPath||"",filePattern:"*.xlsx"};flow.customSources.push(source);saveFlow();ui.modal=null;ui.selectedSourceId=id;go(`#/resources/source/${id}?tab=overview`);return toast(d.type==="folder"?"数据源已创建；同步真实文件后才会形成快照":"数据源已创建；上传真实工作簿后才会形成快照");}
    if(action==="upload-snapshot") return openModal("upload-snapshot",{sourceId:el.dataset.id||route().parts[2]});
    if(action==="register-snapshot"){const file=document.getElementById("snapshot-file")?.files?.[0];if(!file)return toast("请选择 .xlsx 工作簿");if(!file.name.toLowerCase().endsWith(".xlsx"))return toast("仅支持 .xlsx 工作簿");const sourceId=ui.modal.data.sourceId;ui.uploadDraft={fileName:file.name,size:file.size};ui.modal.data.processing=true;render();registerSnapshotFile(file,sourceId).then(result=>{ui.modal=null;render();if(result.duplicate)return toast(`内容与已有快照 ${result.existing.snapshot.snapshotId} 相同；本轮已引用该内容证据，未重复生成快照`);return toast(result.snapshot.structureStatus==="结构已核验"?"快照已登记且结构核验通过；请单独确认数据截至时间":"快照已登记，但结构尚未核验，正式运行保持阻断");}).catch(error=>{if(ui.modal?.data)ui.modal.data.processing=false;render();toast(error?.message||"工作簿读取失败，请重新选择完整文件");});return;}
    if(action==="confirm-snapshot") return openModal("confirm-snapshot");
    if(action==="save-snapshot-confirmation"){const scenarioGate=scenarioContextGate(),snapshot=currentFinanceSnapshot(),value=document.getElementById("as-of-confirm")?.value,basis=document.getElementById("as-of-basis")?.value.trim();if(!scenarioGate.okay)return toast(`当前不能确认数据截至时间：${scenarioGate.problems.join("；")}`);if(!snapshot)return toast("请先在当前场景轮次上传并登记融资工作簿");if(!value)return toast("请选择数据截至时间");if(!basis)return toast("请填写数据截至时间的确认依据");const confirmation={snapshotId:snapshot.snapshotId,asOf:value,confirmedBy:"数据工程账号",confirmedAt:nowText(),basis,scenarioContext:copy(scenarioGate.context)};flow.asOfDate=value;flow.snapshotConfirmed=true;flow.t008Confirmation=confirmation;const persisted=[...flow.uploadedSnapshots].reverse().find(entry=>entry.sourceId==="finance-workbook"&&entry.snapshot?.snapshotId===snapshot.snapshotId);if(persisted){persisted.snapshot.asOf=value;persisted.snapshot.t008Confirmation=copy(confirmation);persisted.snapshot.t008Confirmations=Array.isArray(persisted.snapshot.t008Confirmations)?persisted.snapshot.t008Confirmations:[];persisted.snapshot.t008Confirmations.push(copy(confirmation));}saveFlow();ui.modal=null;render();return toast(`数据截至时间已独立确认：${value}`);}
    if(action==="source-settings") return go(withParams({tab:"settings"}));
    if(action==="save-source-settings"){const id=el.dataset.sourceId||route().parts[2];const settings={name:document.getElementById("source-setting-name")?.value.trim(),description:document.getElementById("source-setting-description")?.value.trim()};const folder=document.getElementById("source-setting-folder"),pattern=document.getElementById("source-setting-pattern");if(folder)settings.folderPath=folder.value.trim();if(pattern)settings.filePattern=pattern.value.trim();if(!settings.name)return toast("数据源名称不能为空");flow.sourceSettings[id]=settings;saveFlow();render();return toast("数据源设置已保存");}
    if(action==="folder-check") return openModal("folder-check");
    if(action==="revision-evidence") return openModal("revision-evidence");
    if(action==="quality-evidence") return openModal("quality-evidence");
    if(action==="pipeline-tab") return go(`#/pipelines?tab=${el.dataset.value}`);
    if(action==="new-pipeline"){ui.pipelineDraft={step:1,name:"新数据管道",assetName:"新数据资产",purpose:"",template:"five",schedule:"manual"};return openModal("new-pipeline");}
    if(action==="pipeline-wizard-back"){ui.pipelineDraft.step=Math.max(1,ui.pipelineDraft.step-1);return render();}
    if(action==="pipeline-wizard-next"){if(ui.pipelineDraft.step===1&&(!ui.pipelineDraft.name.trim()||!ui.pipelineDraft.assetName.trim()))return toast("请填写管道名称和目标数据资产名称");ui.pipelineDraft.step=Math.min(3,ui.pipelineDraft.step+1);return render();}
    if(action==="pipeline-template"){ui.pipelineDraft.template=el.dataset.value;return render();}
    if(action==="pipeline-wizard-complete"){
      const d=ui.pipelineDraft;flow.pipelineCounter+=1;const suffix=`${dateStamp()}-${String(flow.pipelineCounter).padStart(2,"0")}`,pipelineId=`pipeline-${suffix.toLowerCase()}`,assetId=`asset-${suffix.toLowerCase()}`,t006Id=`DATA-ASSET-${suffix}`;
      const baseAsset=D.targetAssets.find(a=>a.id==="finance-asset-target")||D.targetAssets[0];
      const memberIdMap=new Map(),assetMembers=copy(baseAsset.members||[]).map((m,i)=>{const id=`${t006Id}-MEMBER-${String(i+1).padStart(2,"0")}`;memberIdMap.set(m.id,id);return {...m,id};});
      const relationshipContracts=copy(baseAsset.relationshipContracts||baseAsset.relationships||[]).map(contract=>typeof contract==="object"&&contract?{...contract,sourceMemberId:memberIdMap.get(contract.sourceMemberId)||contract.sourceMemberId,targetMemberId:memberIdMap.get(contract.targetMemberId)||contract.targetMemberId}:contract);
      const asset={id:assetId,t006Id,name:d.assetName.trim(),scene:"自定义管道",purpose:d.purpose.trim()||`${d.name.trim()} 的可信发布目标`,owner:"当前账号",published:false,status:"尚未发布",versionCount:0,currentVersion:"尚未发布",currentAuthoritativeVersion:"尚未采用",asOf:"无",quality:"尚无质量结论",publishedAt:"",sourceSnapshot:"",runId:"",refreshStatus:"尚未请求",consumptionStatus:"不可消费",reusePolicy:copy(baseAsset.reusePolicy||{allowed:true}),members:assetMembers,relationships:copy(baseAsset.relationships||[]),relationshipContracts};
      const pipeline={id:pipelineId,name:d.name.trim(),purpose:d.purpose.trim()||`形成 ${d.assetName.trim()} 的可信版本`,definitionState:"草稿",definitionVersion:"编辑草稿",nodeCount:d.template==="blank"?0:5,source:d.template==="blank"?"待选择":"融资一览表",targetAsset:asset.name,targetAssetId:t006Id,ontologyBindingId:"",refreshTarget:"",refreshTargetId:"",latestRun:"尚未运行",schedule:"仅手工正式运行",canOpen:true};
      flow.customAssets.push(asset);flow.customPipelines.push(pipeline);flow.pipelineSchedules[pipelineId]="仅手工正式运行";saveFlow();
      ui.canvas=makeCanvas(pipelineId,d.template);ui.canvas.name=pipeline.name;ui.canvas.purpose=pipeline.purpose;ui.canvas.targetAssetId=t006Id;ui.canvas.ontologyBindingId="";ui.canvas.refreshTarget="";ui.canvas.refreshTargetId="";ui.canvas.sourceMappingVersion="";ui.canvas.mode="draft";ui.canvas.definitionLabel="编辑草稿";flow.canvasDrafts[pipelineId]=canvasRecord(ui.canvas);saveFlow();ui.canvasId=pipelineId;ui.modal=null;return go(`#/pipelines/${pipelineId}/canvas`,true);
    }
    if(action==="pipeline-schedule"){ui.moreMenu=false;return openModal("pipeline-schedule",{pipelineId:el.dataset.pipelineId||ui.canvas?.id||"finance-pipeline"});}
    if(action==="save-pipeline-schedule"){const pipelineId=el.dataset.pipelineId||ui.modal?.data?.pipelineId||ui.canvas?.id||"finance-pipeline",value=document.getElementById("pipeline-schedule-mode")?.value||"仅手工正式运行";flow.pipelineSchedules[pipelineId]=value;if(pipelineId==="finance-pipeline")flow.pipelineSchedule=value;if(ui.canvas?.id===pipelineId)ui.canvas.pipelineSchedule=value;saveFlow();ui.modal=null;render();return toast("管道运行计划已保存")}
    if(action==="run-field-contract") return openModal("run-fields");
    if(action==="toggle-version-menu"){ui.versionMenu=!ui.versionMenu;ui.moreMenu=false;return render();}
    if(action==="toggle-more"){ui.moreMenu=!ui.moreMenu;ui.versionMenu=false;return render();}
    if(action==="select-definition"){if(flow.runStatus==="running")return toast("正式运行期间不能切换定义上下文");if(queueCanvasTransition({type:"definition",value:el.dataset.value}))return;if(el.dataset.value==="draft")return openEditableDraft();return openPublishedDefinition(el.dataset.value);}
    if(action==="undo") return undoCanvas();
    if(action==="save-canvas"){if(!canEditCanvas())return toast("当前画布不可保存");persistDraftCanvas();render();return toast("编辑草稿已保存")}
    if(action==="validate-canvas"){const result=validationResult();ui.canvas.validationSeen=true;ui.canvas.validationFingerprint=result.fingerprint;ui.canvas.validationAt=nowText();ui.canvas.selectedNode="";ui.canvas.bottomTab="validation";render();return toast(result.okay?"管道定义校验通过，可发布管道定义":"管道定义校验未通过，请在列表中查看问题和恢复建议")}
    if(action==="debug-node") return startNodeDebug();
    if(action==="trial-to-node") return startTrial();
    if(action==="delete-node") return removeSelectedNode();
    if(action==="publish-definition") return openModal("publish-definition");
    if(action==="confirm-publish-definition"){const box=document.getElementById("definition-confirm");if(!box?.checked)return toast("请先确认已核对定义内容");return publishCanvasDefinition();}
    if(action==="edit-definition")return openEditableDraft();
    if(action==="formal-run") return openModal("formal-run");
    if(action==="start-formal-run"){ui.modal=null;startFormalRun(el.dataset.retryOf||"");return;}
    if(action==="quality-warning-decision")return openModal("quality-warning");
    if(action==="approve-quality-warning")return approveQualityWarning();
    if(action==="finish-without-publish")return finishRunWithoutPublish();
    if(action==="stop-run") return stopFormalRun();
    if(action==="run-detail") return go(`#/pipelines?tab=runs&run=${encodeURIComponent(el.dataset.runId)}&view=summary`);
    if(action==="run-detail-tab"){
      ui.modal.data.tab=el.dataset.value;
      if(ui.modal.data.routeDriven){history.replaceState(null,"",withParams({tab:"runs",run:ui.modal.data.runId,view:el.dataset.value}));}
      return render();
    }
    if(action==="retry-run"){const runId=el.dataset.runId,failedRun=flow.runs.find(r=>r.id===runId),definition=publishedDefinition(failedRun?.definitionVersion);if(!definition)return toast("原运行的已发布定义已不可定位，无法复现重试");const retryCheck=verifyRetryInputs(failedRun,definition);if(!retryCheck.okay)return toast(`原运行不可复现：${retryCheck.reason}`);const pipelineId=definition.pipelineId||failedRun.pipelineId||"finance-pipeline";ui.modal=null;go(`#/pipelines/${pipelineId}/canvas`,true);setTimeout(()=>{ui.canvasId=pipelineId;ui.canvas=hydrateCanvas(definition,"published",definition.id);startFormalRun(runId);},0);return;}
    if(action==="publish-asset") return publishAsset();
    if(action==="recheck-c003-delivery") return recheckC003Delivery({assetVersionId:el.dataset.assetVersionId||""});
    if(action==="retry-c003-delivery") return retryC003Delivery({assetVersionId:el.dataset.assetVersionId||""});
    if(action==="open-refresh-submit") return openModal("refresh-submit");
    if(action==="confirm-refresh-submit"){ui.modal=null;return submitOntologyRefresh();}
    if(action==="request-refresh") return submitOntologyRefresh();
    if(action==="discover-ontology-bindings") return discoverOntologyBindings("发现");
    if(action==="query-refresh") return queryRefreshRequest();
    if(action==="finish-failed-candidate")return finishFailedCandidate();
    if(action==="open-finish-pending-candidate"){const version=candidateVersion(),run=currentRun();if(!version||!run||flow.runStatus!=="published"||activeRefreshAttempt())return toast("当前没有可结束的未提交刷新候选");return openModal("finish-pending-candidate");}
    if(action==="confirm-finish-pending-candidate")return finishPendingCandidate();
    if(action==="shortcut-help"){ui.moreMenu=false;return openModal("shortcut-help");}
    if(action==="reset-layout"){ui.moreMenu=false;ui.canvas.layout=defaultCanvasLayout();ui.canvas.zoom=88;ui.canvas.viewport=defaultViewport();return render();}
    if(action==="toggle-library"){ui.canvas.layout.leftCollapsed=!ui.canvas.layout.leftCollapsed;ui.canvas.layout.left=ui.canvas.layout.leftCollapsed?44:184;return render();}
    if(action==="toggle-rail"){ui.canvas.layout.rightCollapsed=!ui.canvas.layout.rightCollapsed;ui.canvas.layout.right=ui.canvas.layout.rightCollapsed?48:304;return render();}
    if(action==="toggle-bottom"){ui.canvas.layout.bottomCollapsed=!ui.canvas.layout.bottomCollapsed;ui.canvas.layout.bottom=ui.canvas.layout.bottomCollapsed?44:264;ui.canvas.layout.bottomMax=false;return render();}
    if(action==="toggle-bottom-max"){ui.canvas.layout.bottomMax=!ui.canvas.layout.bottomMax;ui.canvas.layout.bottomCollapsed=false;return render();}
    if(action==="zoom"){ui.canvas.zoom=Math.max(40,Math.min(140,ui.canvas.zoom+Number(el.dataset.value)));return render();}
    if(action==="fit-canvas") return fitCanvas();
    if(action==="add-node") return addNode(el.dataset.key);
    if(action==="clear-node-selection"){if(suppressCanvasClick)return;if(ui.canvas?.selectedNode||ui.canvas?.linkFrom){ui.canvas.selectedNode="";ui.canvas.linkFrom="";ui.canvas.bottomTab="validation";return render();}return;}
    if(action==="select-node"){if(ui.canvas.linkFrom&&ui.canvas.linkFrom!==el.dataset.nodeId){const check=connectionCheck(ui.canvas.linkFrom,el.dataset.nodeId);if(check.ok)return connectNodes(ui.canvas.linkFrom,el.dataset.nodeId);return toast(check.reason);}const n=nodeById(el.dataset.nodeId);ui.canvas.selectedNode=el.dataset.nodeId;ui.canvas.bottomTab=tabsForNode(n)[0][0];return render();}
    if(action==="start-link"){if(!canEditCanvas())return toast("当前画布不能修改连线");ui.canvas.linkFrom=el.dataset.nodeId;render();return toast("请选择高亮的下游目标节点");}
    if(action==="finish-link") return connectNodes(ui.canvas.linkFrom,el.dataset.nodeId);
    if(action==="bottom-tab"){ui.canvas.bottomTab=el.dataset.value;return render();}
    if(action==="source-picker") return openModal("source-picker");
    if(action==="choose-source-input"){const node=selectedNode(),source=D.sources.find(s=>s.id===el.dataset.sourceId),snapshot=source?currentSnapshotForSource(source.id):null;if(node?.key!=="source"||!source)return;if(source.planned||!source.enabled||source.selectable===false||!snapshot)return toast("该来源在当前场景轮次没有可选快照");pushUndo();node.inputKind="source";node.sourceId=source.id;delete node.assetId;delete node.assetVersionId;delete node.assetVersionPolicy;delete node.assetContract;node.memberScope="不适用";flow.selectedInputSource=source.id;ui.canvas.dirty=true;ui.modal=null;render();return toast(`当前数据源节点已选择本轮快照 ${snapshot.snapshotId}`);}
    if(action==="choose-asset-input"){const node=selectedNode(),asset=D.targetAssets.find(a=>a.id===el.dataset.assetId),version=flow.assetVersions.find(v=>v.id===el.dataset.versionId),gate=assetReuseGate(asset,version);if(node?.key!=="source"||!gate.allowed)return toast(gate.reason||"该资产版本当前不可复用");pushUndo();node.inputKind="asset";node.assetId=asset.id;node.assetVersionPolicy=el.dataset.policy||"fixed";node.assetVersionId=version.id;node.memberScope=el.dataset.memberScope||"全部成员";node.assetContract=assetContractSnapshot(asset,node.assetVersionPolicy,node.memberScope);delete node.sourceId;ui.canvas.dirty=true;ui.modal=null;render();return toast(node.assetVersionPolicy==="follow"?`已保存受控跟随合同；当前解析为 ${version.id}`:`${version.id} 及其成员、字段与粒度合同已锁定`);}
    if(action==="add-quality-rule") return openModal("add-rule");
    if(action==="add-rule"){const type=document.getElementById("rule-type")?.value,scope=document.getElementById("rule-scope")?.value.trim(),condition=document.getElementById("rule-condition")?.value.trim(),severity=document.getElementById("rule-severity")?.value,failureEffect=document.getElementById("rule-failure-effect")?.value||"阻断发布数据资产",recovery=document.getElementById("rule-recovery")?.value.trim()||"修正来源数据或检查配置后重试";if(!scope||!condition)return toast("请填写作用范围和判断条件");pushUndo();ui.canvas.qualityRules=ui.canvas.qualityRules||[];const customCount=ui.canvas.qualityRules.filter(x=>String(x.id).startsWith("CUSTOM-Q-")).length+1;ui.canvas.qualityRules.push({id:`CUSTOM-Q-${String(customCount).padStart(3,"0")}`,version:"v1.0.0",name:`${type}检查`,type,scope,condition,severity,failureEffect,recovery,owner:"数据工程",enabled:true});ui.canvas.dirty=true;ui.modal=null;render();return toast("通用数据检查已加入当前定义草稿");}
    if(action==="sync-folder"){ui.modal.data.processing=true;render();setTimeout(()=>{flow.folderSyncAt=nowText();saveFlow();ui.modal.data.processing=false;ui.modal.data.completed=true;render();},900);return;}
  });

  document.addEventListener("input",e=>{
    if(e.target.id==="resource-search"){ui.resourceQuery=e.target.value;render();const input=document.getElementById("resource-search");if(input){input.focus();input.setSelectionRange(input.value.length,input.value.length);}return;}
    if(e.target.id==="code-search"){ui.codeSearch=e.target.value;render();const input=document.getElementById("code-search");if(input){input.focus();input.setSelectionRange(input.value.length,input.value.length);}return;}
    const bind=e.target.dataset.bind;if(!bind)return;const [scope,key]=bind.split(".");if(scope==="source")ui.sourceDraft[key]=e.target.value;if(scope==="pipeline")ui.pipelineDraft[key]=e.target.value;if(scope==="canvas"&&canEditCanvas()){ui.canvas[key]=e.target.value;ui.canvas.dirty=true;ui.canvas.validationSeen=false;ui.canvas.validationFingerprint="";const title=document.querySelector(".canvas-title strong"),status=document.querySelector(".canvas-title span");if(key==="name"&&title)title.textContent=e.target.value;if(status)status.textContent="有未保存修改";}
  });
  document.addEventListener("change",e=>{
    if(e.target.dataset.action==="ontology-binding-select"){
      const run=runForCanvas(),version=assetVersionForRun(run),attempt=refreshAttemptsForVersion(version?.id).at(-1);
      if(!run||!version||run.id!==flow.currentRunId||flow.runStatus!=="published"||!["idle","failed"].includes(flow.refreshStatus))return toast("当前目标绑定已随刷新请求锁定，只能查看");
      const key=refreshBindingSelectionKey(version.id);if(e.target.value)flow.refreshBindingSelections[key]=e.target.value;else delete flow.refreshBindingSelections[key];saveFlow();render();const binding=ontologyBindingForCanvas();return toast(binding?`本次资产版本将提交到“${binding.name}”；目标与映射保持只读`:"已清除本次目标绑定；提交刷新请求将被阻断");
    }
    if(e.target.dataset.action==="asset-member-scope"){const node=selectedNode();if(node?.inputKind!=="asset"||!canEditCanvas())return;pushUndo();node.memberScope=e.target.value;node.assetContract=assetContractSnapshot(assetForNode(node),node.assetVersionPolicy,node.memberScope);ui.canvas.dirty=true;render();return toast("资产成员范围及对应字段、粒度和质量合同已更新；正式运行锁定精确版本");}
    const bind=e.target.dataset.bind;if(!bind)return;const [scope,key]=bind.split(".");if(scope==="source")ui.sourceDraft[key]=e.target.value;if(scope==="pipeline")ui.pipelineDraft[key]=e.target.value;
  });
  document.addEventListener("scroll",e=>{if(e.target?.matches?.("[data-table-scroll]"))syncTableScrollbars();if(e.target?.classList?.contains("canvas-viewport")&&ui.canvas&&!panState)ui.canvas.viewport={x:e.target.scrollLeft,y:e.target.scrollTop};},true);
  document.addEventListener("dragstart",e=>{const card=e.target.closest("[draggable][data-node-key]");if(!card||!canEditCanvas())return;e.dataTransfer.setData("text/plain",card.dataset.nodeKey);e.dataTransfer.effectAllowed="copy";});
  document.addEventListener("dragover",e=>{if(e.target.closest("[data-drop-zone]")){e.preventDefault();e.dataTransfer.dropEffect="copy";}});
  document.addEventListener("drop",e=>{const zone=e.target.closest("[data-drop-zone]");if(!zone||!canEditCanvas())return;e.preventDefault();const key=e.dataTransfer.getData("text/plain");const world=document.getElementById("canvas-world");if(!world)return;const rect=world.getBoundingClientRect(),scale=ui.canvas.zoom/100;addNode(key,{x:(e.clientX-rect.left)/scale-75,y:(e.clientY-rect.top)/scale-75});});
  document.addEventListener("pointerdown",e=>{
    const tableTrack=e.target.closest?.("[data-table-scrollbar]");
    if(tableTrack&&!tableTrack.classList.contains("disabled")){
      const key=tableTrack.dataset.tableScrollbar;
      const area=document.querySelector(`[data-table-scroll="${key}"]`);
      const thumb=tableTrack.querySelector(".table-scroll-thumb");
      if(!area||!thumb)return;
      const maxScroll=Math.max(0,area.scrollWidth-area.clientWidth);
      const travel=Math.max(1,tableTrack.clientWidth-thumb.offsetWidth);
      if(e.target.closest(".table-scroll-thumb")){
        tableScrollDrag={area,track:tableTrack,startX:e.clientX,startScrollLeft:area.scrollLeft,maxScroll,travel};
        tableTrack.classList.add("dragging");
        tableTrack.setPointerCapture?.(e.pointerId);
      }else{
        const rect=tableTrack.getBoundingClientRect();
        const desiredLeft=Math.max(0,Math.min(travel,e.clientX-rect.left-thumb.offsetWidth/2));
        area.scrollLeft=(desiredLeft/travel)*maxScroll;
        syncTableScrollbars();
      }
      e.preventDefault();
      return;
    }
    const resize=e.target.closest("[data-resize]");if(resize&&ui.canvas){const wb=document.getElementById("canvas-workbench");resizeState={kind:resize.dataset.resize,x:e.clientX,y:e.clientY,left:ui.canvas.layout.left,right:ui.canvas.layout.right,bottom:ui.canvas.layout.bottom,wb};e.preventDefault();return;}
    const card=e.target.closest("[data-node-card]");
    if(card&&canEditCanvas()&&!e.target.closest("button")){const n=nodeById(card.dataset.nodeId);if(!n)return;dragState={node:n,startX:e.clientX,startY:e.clientY,x:n.x,y:n.y,el:card,moved:false,before:cloneCanvasState()};card.setPointerCapture?.(e.pointerId);e.preventDefault();return;}
    const viewport=e.target.closest(".canvas-viewport");if(viewport&&!e.target.closest("[data-node-card],button,input,select,textarea")){panState={viewport,startX:e.clientX,startY:e.clientY,scrollLeft:viewport.scrollLeft,scrollTop:viewport.scrollTop,moved:false};viewport.setPointerCapture?.(e.pointerId);viewport.classList.add("is-panning");e.preventDefault();}
  });
  document.addEventListener("pointermove",e=>{
    if(tableScrollDrag){const dx=e.clientX-tableScrollDrag.startX;tableScrollDrag.area.scrollLeft=tableScrollDrag.startScrollLeft+(dx/tableScrollDrag.travel)*tableScrollDrag.maxScroll;syncTableScrollbars();e.preventDefault();return;}
    if(resizeState){const dx=e.clientX-resizeState.x,dy=e.clientY-resizeState.y,l=ui.canvas.layout;if(resizeState.kind==="left"){l.left=Math.max(44,Math.min(270,resizeState.left+dx));l.leftCollapsed=l.left<70;}if(resizeState.kind==="right"){l.right=Math.max(48,Math.min(390,resizeState.right-dx));l.rightCollapsed=l.right<72;}if(resizeState.kind==="bottom"){l.bottom=Math.max(44,Math.min(540,resizeState.bottom-dy));l.bottomCollapsed=l.bottom<70;l.bottomMax=false;}if(!framePending){framePending=true;requestAnimationFrame(()=>{framePending=false;if(!resizeState)return;resizeState.wb.style.setProperty("--library-w",`${l.left}px`);resizeState.wb.style.setProperty("--rail-w",`${l.right}px`);resizeState.wb.style.setProperty("--bottom-h",`${l.bottom}px`);});}return;}
    if(panState){const dx=e.clientX-panState.startX,dy=e.clientY-panState.startY;panState.viewport.scrollLeft=panState.scrollLeft-dx;panState.viewport.scrollTop=panState.scrollTop-dy;panState.moved=panState.moved||Math.abs(dx)>3||Math.abs(dy)>3;return;}
    if(!dragState)return;const scale=ui.canvas.zoom/100;dragState.node.x=Math.max(18,Math.min(CANVAS_WORLD.width-180,dragState.x+(e.clientX-dragState.startX)/scale));dragState.node.y=Math.max(64,Math.min(CANVAS_WORLD.height-150,dragState.y+(e.clientY-dragState.startY)/scale));dragState.moved=true;if(!framePending){framePending=true;requestAnimationFrame(()=>{framePending=false;if(!dragState)return;dragState.el.style.left=`${dragState.node.x}px`;dragState.el.style.top=`${dragState.node.y}px`;updateEdgesDom();});}
  });
  function finishPointerInteraction(){let rerender=false;if(tableScrollDrag){tableScrollDrag.track.classList.remove("dragging");tableScrollDrag=null;}if(dragState){if(dragState.moved){pushUndoState(dragState.before);ui.canvas.dirty=true;rerender=true;}dragState=null;}if(panState){ui.canvas.viewport={x:panState.viewport.scrollLeft,y:panState.viewport.scrollTop};panState.viewport.classList.remove("is-panning");suppressCanvasClick=panState.moved;panState=null;if(suppressCanvasClick)setTimeout(()=>{suppressCanvasClick=false;},0);}resizeState=null;if(rerender)render();}
  document.addEventListener("pointerup",finishPointerInteraction);
  document.addEventListener("pointercancel",finishPointerInteraction);
  document.addEventListener("wheel",e=>{
    const viewport=e.target.closest?.(".canvas-viewport");if(!viewport||!ui.canvas)return;
    e.preventDefault();const rect=viewport.getBoundingClientRect(),oldScale=ui.canvas.zoom/100,nextZoom=Math.max(40,Math.min(140,ui.canvas.zoom+(e.deltaY<0?8:-8)));if(nextZoom===ui.canvas.zoom)return;
    const pointerX=e.clientX-rect.left,pointerY=e.clientY-rect.top,worldX=(viewport.scrollLeft+pointerX)/oldScale,worldY=(viewport.scrollTop+pointerY)/oldScale,newScale=nextZoom/100;
    ui.canvas.zoom=nextZoom;ui.canvas.viewport={x:Math.max(0,worldX*newScale-pointerX),y:Math.max(0,worldY*newScale-pointerY)};render();
  },{passive:false});
  document.addEventListener("keydown",e=>{
    const editable=e.target.matches("input,textarea,select,[contenteditable=true]");
    if(!editable&&(e.key==="Enter"||e.key===" ")&&e.target.matches("[data-action='select-source-card']")){e.preventDefault();e.target.click();return;}
    if(!editable&&(e.key==="Enter"||e.key===" ")&&e.target.matches("[data-node-card]")){e.preventDefault();e.target.click();return;}
    const tableTrack=e.target.closest?.("[data-table-scrollbar]");
    if(tableTrack&&!editable&&(e.key==="ArrowLeft"||e.key==="ArrowRight")){
      const area=document.querySelector(`[data-table-scroll="${tableTrack.dataset.tableScrollbar}"]`);
      if(area){e.preventDefault();area.scrollLeft+=e.key==="ArrowLeft"?-80:80;syncTableScrollbars();}
      return;
    }
    if(e.key==="Escape"){if(ui.modal)return closeModal();if(ui.versionMenu||ui.moreMenu){ui.versionMenu=false;ui.moreMenu=false;return render();}if(ui.canvas?.linkFrom){ui.canvas.linkFrom="";return render();}return;}
    if(route().parts[0]!=="pipelines"||route().parts[2]!=="canvas"||editable)return;
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="s"){e.preventDefault();if(canEditCanvas()){persistDraftCanvas();render();toast("编辑草稿已保存");}else toast("当前画布不能保存");return;}
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="z"){e.preventDefault();return undoCanvas();}
    if(e.key.toLowerCase()==="f"){e.preventDefault();return fitCanvas();}
    if(e.key==="+"||e.key==="="){e.preventDefault();ui.canvas.zoom=Math.min(140,ui.canvas.zoom+10);return render();}
    if(e.key==="-"||e.key==="_"){e.preventDefault();ui.canvas.zoom=Math.max(40,ui.canvas.zoom-10);return render();}
  });
  window.addEventListener("message",event=>{
    if(event.origin!==location.origin)return;
    if(event.data?.channel===HANDOFF_CHANNEL&&event.data?.targetModule==="数据工程"&&event.data?.operation==="deliverScenarioContext"){
      const gate=receiveScenarioContext(event.data.payload,"平台消息");
      event.source?.postMessage?.({channel:HANDOFF_CHANNEL,targetModule:"数据工程",requestId:event.data.requestId,operation:event.data.operation,ok:gate.okay,result:gate.okay?{accepted:true}:null,error:gate.okay?null:gate.problems.join("；"),respondedAt:nowText()},location.origin);render();return;
    }
    handleOntologyHandoffResponse(event.data);
  });
  window.addEventListener("storage",event=>{
    if(event.key?.startsWith(`${HANDOFF_CHANNEL}:response:`)&&event.newValue){try{handleOntologyHandoffResponse(JSON.parse(event.newValue));}catch(_){/* Invalid external response is ignored. */}}
    if(event.key===SCENARIO_CONTEXT_KEY&&event.newValue){try{receiveScenarioContext(JSON.parse(event.newValue),"平台公共层共享状态");render();}catch(_){/* Invalid context cannot change the active scenario. */}}
  });
  window.addEventListener("hashchange",render);
  window.addEventListener("popstate",render);
  window.addEventListener("beforeunload",e=>{if(hasUnsavedCanvasDraft()){e.preventDefault();e.returnValue="";}});
  window.addEventListener("resize",syncTableScrollbars);
  window.DE_SCENARIO_HOST=Object.freeze({
    scenarioId:SCENARIO_ID,
    flowKey:FLOW_KEY,
    registerResourceBundle:registerScenarioResourceBundle,
    ensureS003FormalDelivery,
    refresh:()=>{syncFlowData();render();},
    currentContext:()=>copy(flow.scenarioContext),
    currentRoute:()=>copy(route())
  });
  receiveScenarioContextFromUrl();
  readPlatformScenarioContextFromSharedState();
  render();
  syncC017ProjectionStores();
  setTimeout(()=>{reconcilePersistedC003Delivery().catch(()=>{/* 页面保持未验证接收；不以本地异常替代 M01 证据。 */});},0);
})();
