import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {S003_REGISTRATION} from '../../v1.3.0/composite/runtime/s003-registration.mjs';

const base=new URL('../composite/',import.meta.url),scope={};scope.window=scope;
for(const path of ['shared/ontology-consumption.js','shared/business-catalog.js','resources/business-release.js','modules/m07/portrait-model.js','modules/m07/object-experience.js'])vm.runInNewContext(readFileSync(new URL(path,base),'utf8'),scope);
const resource=scope.OFW_BUSINESS_CATALOG.create(JSON.parse(readFileSync(new URL('modules/m07/resources/portfolio.json',base))),JSON.parse(readFileSync(new URL('resources/business-source.json',base))),scope.OFW_M01_BUSINESS_RELEASE);
const experience=scope.OFW_OBJECT_EXPERIENCE.create(resource),portrait=scope.OFW_M07_PORTRAIT.create(resource);
const item=id=>resource.objects.find(o=>o.id===id);
const modelPackage=JSON.parse(readFileSync(new URL('../../../prototype-releases/v1.1.0/scenarios/s003/resources/m01/model-package.v2.json',import.meta.url)));
const monitor={context:{state:{formalBaseline:S003_REGISTRATION.formalBaseline,results:{formalEnvelope:S003_REGISTRATION.formalBaseline.resultEnvelope}}},modelPackage};

test('company relationships include institutions reached through actual financing records',()=>{
  const relations=experience.relations(item('ENT-020'));
  assert.equal(relations.filter(entry=>entry.item.objectTypeId==='OBJ-ENTERPRISE-DEPARTMENT').length,3);
  const institutions=relations.filter(entry=>entry.item.objectTypeId==='OBJ-FINANCIAL-INSTITUTION');
  assert.ok(institutions.length>3);
  for(const entry of institutions){
    assert.equal(entry.path.length,2);
    assert.ok(entry.path.every(id=>resource.links.some(link=>link.id===id)));
    assert.ok(entry.via.every(id=>item(id).objectTypeId==='OBJ-FINANCING-DETAIL'));
  }
  assert.equal(experience.relationSummary(item('ENT-020')).find(row=>row.collectionId)?.count,75);
});

test('institution relation maps can locate related enterprises without assigning the bank a made-up address',()=>{
  const institution=experience.relations(item('ENT-020')).find(entry=>entry.item.objectTypeId==='OBJ-FINANCIAL-INSTITUTION').item;
  const before=JSON.stringify(institution);
  const enterprises=experience.relations(institution).filter(entry=>entry.item.objectTypeId==='OBJ-ENTERPRISE');
  assert.ok(enterprises.some(entry=>entry.item.id==='ENT-020'));
  const loans=resource.collections.find(collection=>collection.id===`financing:${institution.id}`);
  assert.ok(loans.memberIds.length>0);
  assert.ok(loans.memberIds.every(id=>resource.links.some(link=>link.from===id&&link.to===institution.id)));
  assert.equal(JSON.stringify(institution),before);
});

test('risk events have precise rule or model lineage; green scores and work logs are not events',()=>{
  const events=experience.events(item('ENT-020'),monitor);
  assert.equal(events.length,2);
  const rule=events.find(event=>event.source==='rule'),model=events.find(event=>event.source==='model');
  assert.equal(rule.definitionId,'RULE-HIGH-FINANCING-COST');
  assert.equal(rule.sourceVersion,'semantic-MSVJM48O-VJC6');
  assert.equal(model.definitionId,'MODEL-S003-FORMAL-SCORE');
  assert.equal(model.sourceVersion,'MV-S003-DEBT-RISK-1.0.2-FORMAL');
  assert.equal(model.date,'2025-12-31');assert.equal(model.formedAt,'2026-08-17T16:30:00.000Z');
  assert.equal(model.actionTypeId,'S003_SPECIAL_DISPOSAL');
  assert.equal(experience.events(item('ENT-001'),monitor).length,0);
  assert.ok(events.every(event=>event.evidenceRefs.length&&event.condition));
});

test('candidate, synthetic and mismatched model outputs cannot create formal monitoring alerts',()=>{
  for(const change of [envelope=>envelope.resultKind='PREDICTION',envelope=>envelope.actionSourceAllowed=false,envelope=>envelope.modelVersionId='UNBOUND']){
    const altered=structuredClone(monitor);change(altered.context.state.results.formalEnvelope);
    assert.equal(experience.events(item('ENT-020'),altered).filter(event=>event.source==='model').length,0);
  }
});

test('external business events require an explicit original event identity and evidence',()=>{
  const altered=structuredClone(resource);
  altered.businessEvents=[{id:'bad',objectId:'ENT-020',source:'business'},{id:'accepted',objectId:'ENT-020',source:'business',originEventId:'ORIGIN-001',evidenceRefs:['SOURCE-001'],date:'2026-01-01',title:'已发生的业务事实'}];
  const events=scope.OFW_OBJECT_EXPERIENCE.create(altered).events(item('ENT-020'),monitor);
  assert.equal(events.filter(event=>event.source==='business').length,1);
  assert.ok(events.some(event=>event.id==='accepted'));
});

test('object questions use the assigned enterprise budget and honor an explicit single year',()=>{
  const answer=experience.answer(item('ENT-020'),'预算执行情况如何？');
  assert.equal(answer.objectId,'ENT-020');
  assert.ok(answer.facts.some(fact=>fact.value==='1,097.7 万元'));
  assert.ok(answer.facts.some(fact=>fact.value==='861.7265 万元'));
  assert.equal(answer.relatedIds.length,3);
  const previous=experience.answer(item('ENT-020'),'2024年预算执行情况如何？');
  assert.ok(previous.paragraphs[0].startsWith('2024年'));
  assert.ok(previous.relatedIds.every(id=>item(id).properties.year.value===2024));
  assert.equal(experience.answer(item('ENT-001'),'预算执行情况如何？').facts.length,0);
});

test('holding answers preserve actual first and last observations and do not claim product returns',()=>{
  const product=item('PRD-843300000000D4E2');
  const answer=experience.answer(product,'持仓发生了什么变化？',{series:portrait.seriesFor(product)});
  assert.equal(answer.intent,'history');
  assert.ok(answer.facts.some(fact=>fact.asOf==='2026-07-17'&&fact.value.includes('200,156,588.1036')));
  assert.ok(answer.paragraphs.some(text=>text.includes('不等于产品收益率')));
  assert.ok(answer.evidenceRefs.some(ref=>ref.includes('HOLD-S005-PRD-843300000000D4E2')));
});

test('questions cannot silently change the active enterprise or fabricate forecasts',()=>{
  const scopeAnswer=experience.answer(item('ENT-001'),'环保测试公司4的预算如何？');
  assert.equal(scopeAnswer.intent,'scope');assert.equal(scopeAnswer.objectId,'ENT-001');assert.equal(scopeAnswer.facts.length,0);
  const future=experience.answer(item('ENT-020'),'预测下月融资成本是多少？');
  assert.equal(future.intent,'unsupported');assert.equal(future.facts.length,0);
});

test('follow-up risk explanations retain source conditions and model contributions',()=>{
  const answer=experience.answer(item('ENT-020'),'为什么？',{monitor,previousIntent:'events'});
  assert.equal(answer.facts.length,2);
  assert.ok(answer.paragraphs.some(text=>text.includes('盈利稳定性')));
  assert.ok(answer.facts.some(fact=>fact.value.includes('10 ≤ 评分 < 25')));
});
