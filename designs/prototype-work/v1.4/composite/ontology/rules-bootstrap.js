(function installOwnedRules(global){
 'use strict';
 const clone=value=>JSON.parse(JSON.stringify(value));
 const owners={S001:{ontologyId:'ONT-GROUP-FINANCING-OPTIMIZATION',definitions:['balance','weightedCost','exposure','costPremium'],ruleId:'RULE-OPS-FINANCING-PREMIUM',metric:'costPremium',name:'融资成本偏离预警',condition:'融资成本偏离 > 25 bp'},S003:{ontologyId:'ONT-S003-DEBT-RISK',definitions:['maturity','gap','riskScore'],ruleId:'RULE-OPS-DEBT-LIQUIDITY-GAP',metric:'gap',name:'偿债资金缺口预警',condition:'偿债资金缺口 > 0 百万元'}};
 function prepare(input,business){
  const state=clone(input),created=[];
  for(const [scenarioId,owner]of Object.entries(owners)){
   const base=state.publishedVersions.find(version=>version.ontologyStableId===owner.ontologyId);if(!base)continue;
   if(state.drafts.some(draft=>draft.operationsOwner===scenarioId))continue;
   const object=base.objects[0],id=`DRAFT-V14-OPERATIONS-${scenarioId}`,now=new Date().toISOString();
   const draft={id,ontologyStableId:base.ontologyStableId,name:base.name,definition:base.definition,scenario:base.scenario,scenarioContext:clone(base.scenarioContext),draftName:'经营态势规则修订',status:'Draft',createdAt:now,updatedAt:now,basedOn:base.semanticVersion,basedOnVersionId:base.id,draftRevision:(base.draftRevision||1)+1,sourceDeliveryId:base.sourceDeliveryId,sourceAssetVersion:base.dataContract?.assetVersion,sourceDataContract:clone(base.dataContract),objects:clone(base.objects),links:clone(base.links),metrics:clone(base.metrics),rules:clone(base.rules),actions:clone(base.actions),positions:clone(base.positions||{}),canvasView:{zoom:.6,pan:{x:20,y:25}},validation:{status:'idle',issues:[],checkedAt:null},publishedVersionId:null,operationsOwner:scenarioId,operationsDataVersion:business.dataVersion,operationsHistory:[],release:{owner:'本体管理',effectiveFrom:'',effectiveTo:'',changeReason:'补充经营态势模拟分析规则，保留现行规则与正式数据',replacementMode:'待确认',replacementResourceIds:[],replacementMap:{},replacementDeclaration:'待确认',evidenceState:'尚未形成',confirmed:false}};
   const available=new Set([...draft.objects,...draft.objects.flatMap(item=>item.properties||[]),...draft.links,...draft.metrics,...draft.rules,...draft.actions].map(item=>item.id));
   const putPosition=id=>{for(let y=70;y<1100;y+=145)for(let x=80;x<2140;x+=320)if(!Object.values(draft.positions).some(([a,b])=>Math.abs(a-x)<290&&Math.abs(b-y)<130)){draft.positions[id]=[x,y];return;}draft.positions[id]=[2200+created.length*320,70];};
   for(const definition of business.definitions.filter(item=>owner.definitions.includes(item.id))){
    const metricId=`MET-OPS-${definition.id}`,refs=definition.inputs.map(key=>owner.definitions.includes(key)?`MET-OPS-${key}`:key==='riskSource'?'MET-S003-FINAL-SCORE':key==='weightedCost'?'MET-WAVG-FINANCING-COST':null).filter(id=>id&&(available.has(id)||id.startsWith('MET-OPS-')));
    draft.metrics.push({id:metricId,name:`${definition.name}（态势测算）`,type:'Metric',owner:'本体管理',unit:definition.unit,sourceObjectId:object.id,subjectObjectId:object.id,time:`模拟快照截至 ${business.asOf}；展望窗口由验证选择`,scope:'经营态势模拟对象集，不替换当前正式版本',calculation:definition.expression,definition:definition.scope,zeroHandling:'缺失保持缺失；零分母不返回0；不跨主体抵销',dependencyIds:refs,operationsDefinitionId:definition.id,operationsInputs:clone(definition.inputs),sourceSnapshotVersion:business.dataVersion,businessBasis:'unknown'});available.add(metricId);putPosition(metricId);
   }
   draft.rules.push({id:owner.ruleId,name:owner.name,code:`OPS-${scenarioId}`,type:'Rule',objectId:object.id,appliesTo:object.name,metricIds:[`MET-OPS-${owner.metric}`],dependency:business.definitions.find(item=>item.id===owner.metric).name,condition:owner.condition,definition:`${owner.name}；依赖本体内态势测算指标，模拟快照单独验证，不替代既有正式规则。`,validity:'修订草稿，尚未正式生效',testSample:'21家企业完整模拟快照',bankRanking:'按当前范围借款本金降序，担保与授信不重复计入',evidence:'规则精确内容、所属本体与草稿、数据指纹、观察窗口和企业对象集',businessBasis:'unknown',decisionRefs:[],owner:'本体管理',operationsRuleKey:owner.metric});putPosition(owner.ruleId);
   for(const resource of [...draft.objects,...draft.objects.flatMap(item=>item.properties||[]),...draft.links,...draft.metrics,...draft.rules,...draft.actions])Object.assign(resource,{publicationState:'Draft',lifecycleState:'Draft',status:'Draft',effectiveFrom:null,effectiveTo:null,lastChangedAt:now});
   state.drafts.push(draft);created.push(draft.id);
  }
  return {state,created};
 }
 global.OFW_V14_OWNED_RULES=Object.freeze({owners,prepare});
 if(!global.OFW_M01_PORTFOLIO_STATE||!global.OFW_V14_BUSINESS_DEFINITIONS)return;
 const result=prepare(global.OFW_M01_PORTFOLIO_STATE,global.OFW_V14_BUSINESS_DEFINITIONS),state=result.state;
 const requested=new URLSearchParams(location.search).get('operationsOwner')||location.hash.match(/DRAFT-V14-OPERATIONS-(S001|S003)/)?.[1];
 if(owners[requested]){state.activeScenarioId=requested;state.activeDraftId=state.drafts.find(draft=>draft.operationsOwner===requested&&!draft.publishedVersionId)?.id||null;}
 global.OFW_M01_PORTFOLIO_STATE=state;
 try{localStorage.setItem('ontology3-canvas-first-review-v17',JSON.stringify(state));}catch{}
})(typeof window==='undefined'?globalThis:window);
