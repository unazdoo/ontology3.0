import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {idleProjection} from '../runtime/idle-projection.mjs';
const base=new URL('../composite/',import.meta.url),scope={};scope.window=scope;
for(const path of ['shared/ontology-consumption.js','shared/business-catalog.js','resources/business-release.js','modules/m07/portrait-model.js'])vm.runInNewContext(readFileSync(new URL(path,base),'utf8'),scope);
const resource=scope.OFW_BUSINESS_CATALOG.create(JSON.parse(readFileSync(new URL('modules/m07/resources/portfolio.json',base))),JSON.parse(readFileSync(new URL('resources/business-source.json',base))),scope.OFW_M01_BUSINESS_RELEASE);
const model=scope.OFW_M07_PORTRAIT.create(resource);
const item=id=>resource.objects.find(o=>o.id===id);
const products=['PRD-40A100000000B2C7','PRD-843300000000D4E2'].map(item);
test('selection actions start with a concrete business task and do not invent an empty selection',()=>{
  const actions=scope.OFW_M07_PORTRAIT.selectionActions;
  assert.equal(actions([]).length,0);
  assert.equal(actions([products[0]])[0].label,'打开画像');
  assert.equal(actions(products,{comparable:true,trends:true})[0].label,'对比产品');
  assert.ok(actions(products,{comparable:true,trends:true}).some(a=>a.label==='查看持仓走势'));
  const mixed=actions([products[0],item('ENT-020')],{comparable:true,trends:true});
  assert.equal(mixed.length,1);assert.equal(mixed[0].label,'并排查看');
  assert.equal(mixed[0].view,'cards');
});
test('larger selections prefer a table while enterprise pairs compare enterprises',()=>{
  const actions=scope.OFW_M07_PORTRAIT.selectionActions;
  const enterprises=resource.objects.filter(o=>o.objectTypeId==='OBJ-ENTERPRISE').slice(0,6);
  assert.equal(actions(enterprises,{comparable:true})[0].label,'查看对照表');
  assert.equal(actions(enterprises,{comparable:true})[0].view,'compare');
  assert.equal(actions(enterprises.slice(0,2),{comparable:true})[0].label,'对比企业');
  assert.equal(actions(enterprises)[0].view,'list');
});
test('product histories reference their actual linked holdings and share exact metric dimensions',()=>{
  assert.equal(model.seriesFor(products[0]).length,4);
  assert.ok(model.seriesFor(products[0]).every(s=>s.ownerObjectId==='HOLD-S005-PRD-40A100000000B2C7'&&s.displayObjectId===products[0].id));
  const dims=model.dimensions(products);assert.equal(dims.length,4);
  const values=products.map(p=>model.observation(p,dims[0],{start:'2025-02-21',end:'2026-07-17'}).points);
  assert.equal(values[0].length,79);assert.equal(values[1].length,79);
  assert.equal(values[0].at(-1).v,0);assert.equal(values[1].at(-1).v,200156588.1036);
});
test('mixed types, unrelated metrics, and product with no holdings do not share time dimensions',()=>{
  assert.equal(model.dimensions([products[0],item('ENT-020')]).length,0);
  assert.equal(model.dimensions([products[0],item('PRD-A60400000000E8D1')]).length,0);
  const changed=structuredClone(resource);changed.series.find(s=>s.ownerObjectId==='HOLD-S005-PRD-843300000000D4E2').propertyId='OTHER-METRIC';
  assert.equal(scope.OFW_M07_PORTRAIT.create(changed).dimensions(products).length,3);
});
test('empty time intervals do not silently use latest values outside the window',()=>{
  const dim=model.dimensions(products)[0];
  assert.equal(model.observation(products[0],dim,{start:'2026-08-01',end:'2026-08-15'}).points.length,0);
});
test('inherited projection adaptations are limited to the exact known idle loops',()=>{
  const root=new URL('../../../prototype-releases/v1.1.0/',import.meta.url);
  const ontology=readFileSync(new URL('ontology-management-review/canvas-first/portfolio-integration.js',root),'utf8');
  const data=readFileSync(new URL('data-engineering-prototype-review/review-v3/portfolio-integration.js',root),'utf8');
  assert.ok(idleProjection(ontology,'ontology').includes('textContent !== published'));
  assert.ok(!idleProjection(data,'data').includes('setInterval(schedule, 360)'));
  assert.throws(()=>idleProjection('changed-source','ontology'));
});
