import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {FINANCING_MODELS,financingBusinessModel,validateFinancingForecast} from '../composite/shared/financing-models.js';
import {createModelStudio,validateParameters} from '../composite/shared/model-studio.js';
import {taskFromFinancingProposal,caseBasisIssue} from '../composite/shared/task-workflow.js';
const data=JSON.parse(readFileSync(new URL('../public/data/portfolio.json',import.meta.url))),history=JSON.parse(readFileSync(new URL('../public/data/finance-history-demo.json',import.meta.url))),assets=JSON.parse(readFileSync(new URL('../public/data/finance-contract-assets.json',import.meta.url))).assets;
const parameters=method=>Object.fromEntries(FINANCING_MODELS[method].parameters.map(s=>[s.key,s.value]));
const contract=(extra={})=>({id:'L1',enterpriseId:'E1',borrower:'Borrower1',bankName:'Bank1',bankType:'银行',sector:'Sector',currency:'人民币',rate:5,ratePeriod:'年',balanceYuan:100000000,rateType:'FLOATING',startDate:'2024-01-01',maturityDate:'2026-12-31',firstResetDate:'2025-01-15',resetCycle:'按季度',resetCycleMonths:3,nextResetDate:'2026-01-15',dayCount:360,spreadMode:'点数',capRate:0,rateIndex:'LPR1年-人民币',creditRating:'AA',ratingAgency:'Agency',ratingDate:'2025-06-30',sourceRow:2,...extra});
const fixture=()=>({asOf:'2025-12-31',companies:[{id:'E1',name:'Enterprise1'}],ledgerContracts:[contract()],peerRates:[],contractAssetRef:{version:'TEST',sourceSheet:'TEST'},peerAssetRef:{version:'TEST'}});
const peer=(extra={})=>({...contract({id:'P1',borrower:'Peer1',enterpriseId:undefined,startDate:'2025-02-01',maturityDate:'2026-02-01',rate:2}),...extra});
test('repricing fields come from the original ledger, while missing ratings remain missing',()=>{
  const [ledger,peers]=assets;assert.equal(ledger.rows.length,301);assert.equal(peers.rows.length,5218);assert.equal(ledger.rows.filter(r=>r.rateType==='FLOATING').length,176);
  assert.ok(ledger.rows.filter(r=>r.rateType==='FLOATING').every(r=>r.firstResetDate&&Number.isInteger(r.resetCycleMonths)));
  assert.ok(peers.rows.every(r=>r.creditRating===null&&r.ratingAgency===null));
  const raw=readFileSync(new URL('../../../../'+ledger.source,import.meta.url));assert.equal(createHash('sha256').update(raw).digest('hex'),ledger.sourceSha256);
  const loan=ledger.rows.find(r=>r.id==='DEMO-DEBT-003480');assert.equal(loan.firstResetDate,'2024-06-21');assert.equal(loan.resetCycleMonths,12);assert.equal(loan.nextResetDate,'2026-06-21');assert.equal(loan.dayCount,360);
});
test('rate changes wait for contractual repricing; fixed borrowing changes only at rollover',()=>{
  const input=fixture();input.ledgerContracts.push(contract({id:'L2',rateType:'FIXED',maturityDate:'2026-07-01',firstResetDate:null,resetCycleMonths:null}));const p={...parameters('stock-rate'),months:9,rateChangeDate:'2026-03-01',rateChangeBps:-100};const output=financingBusinessModel(input,p,'stock-rate');validateFinancingForecast(output,input,p);
  assert.deepEqual(output.rows[0].forecast.map(p=>p.v),[5,5,5,4.5,4.5,4.5,4,4,4]);assert.equal(output.rows[0].details[0].dayCount,360);
  const missing=structuredClone(input);missing.ledgerContracts[0].firstResetDate=null;assert.throws(()=>financingBusinessModel(missing,p,'stock-rate'),/台账缺少/);
  assert.throws(()=>validateParameters('cost',{...p,rateChangeDate:'2026-02-30'},'stock-rate'),/有效/);
});
test('a selected benchmark changes only matching contracts and honors the recorded rate cap',()=>{
  const input=fixture();input.ledgerContracts.push(contract({id:'L2',rateIndex:'OtherIndex',capRate:5.2}));const p={...parameters('stock-rate'),rateChangeDate:'2026-01-01',rateChangeBps:100,rateIndex:'OtherIndex'};const output=financingBusinessModel(input,p,'stock-rate');assert.equal(output.rows[0].forecast[0].v,5.1);
});
test('AI matches same rating, agency, currency and nearby tenor before selecting a bank',()=>{
  const input=fixture();input.peerRates=[peer(),peer({id:'P2',borrower:'Peer2',bankName:'Bank2',rate:2.5}),peer({id:'P3',borrower:'Peer3',creditRating:'AAA',rate:.5}),peer({id:'P4',borrower:'Peer4',currency:'英镑',rate:.1}),peer({id:'P5',borrower:'Peer5',ratingDate:'2026-01-01',rate:.1})];const p=parameters('refinance-ai'),r=financingBusinessModel(input,p,'refinance-ai'),proposal=r.rows[0].proposals[0];assert.equal(proposal.targetBank,'Bank1');assert.equal(proposal.proposedRate,2);assert.equal(proposal.basis.level,'RATING_BANK_TENOR');assert.deepEqual(proposal.basis.sampleIds,['P1']);assert.equal(proposal.netSavingYuan,null);assert.equal(proposal.feeYuan,null);assert.ok(Math.abs(proposal.annualSavingYuan-100000000*.03*365/360)<.01);assert.ok(r.referenceSets[proposal.basis.sampleSetId]);validateFinancingForecast(r,input,p);
});
test('fallback uses a same-currency sector weighted mean, excludes the borrower, and never invents a missing quote',()=>{
  const input=fixture();input.ledgerContracts[0].creditRating=null;input.peerRates=[peer({rate:2,balanceYuan:100}),peer({id:'P2',borrower:'Peer2',rate:4,balanceYuan:300}),peer({id:'P3',borrower:'Borrower1',rate:0}),peer({id:'P4',currency:'英镑',rate:0})];let r=financingBusinessModel(input,parameters('refinance-ai'),'refinance-ai'),proposal=r.rows[0].proposals[0];assert.equal(proposal.proposedRate,3.5);assert.equal(proposal.basis.level,'SECTOR_FALLBACK');assert.equal(proposal.targetBank,null);assert.equal(proposal.basis.sampleCount,2);
  input.peerRates=[];r=financingBusinessModel(input,parameters('refinance-ai'),'refinance-ai');assert.equal(r.rows[0].proposals.length,0);assert.equal(r.rows[0].unavailable[0].status,'UNAVAILABLE');assert.equal(r.rows[0].predictedRate,5);
});
test('an available rated match cannot be replaced by a cheaper but incomparable sector quote',()=>{
  const input=fixture();input.peerRates=[peer({rate:5.5}),peer({id:'P2',borrower:'Peer2',creditRating:'AAA',rate:.5})];const r=financingBusinessModel(input,parameters('refinance-ai'),'refinance-ai');assert.equal(r.rows[0].proposals.length,0);
});
test('invented peer sample rates and duplicate replacement amounts fail model verification',()=>{
  const input=fixture();input.peerRates=[peer()];const p=parameters('refinance-ai'),output=financingBusinessModel(input,p,'refinance-ai');
  const changed=structuredClone(output);changed.rows[0].proposals[0].proposedRate=.01;assert.throws(()=>validateFinancingForecast(changed,input,p),/样本证据/);
  const duplicated=structuredClone(output);duplicated.rows[0].proposals.push(structuredClone(duplicated.rows[0].proposals[0]));assert.throws(()=>validateFinancingForecast(duplicated,input,p),/重复置换/);
  const foreign=structuredClone(output);foreign.referenceSets[foreign.rows[0].proposals[0].basis.sampleSetId].sampleIds=['MISSING'];assert.throws(()=>validateFinancingForecast(foreign,input,p),/来源/);
});
test('stock continuation uses only historical levels and damped trends, without maturity, interest-rate or rollover inputs',()=>{
  const input={asOf:'2025-12-31',companies:[{id:'E1',name:'Enterprise1'}],costHistory:[['2025-10-31',1],['2025-11-30',2],['2025-12-31',3]].map(([asOf,rate])=>({enterpriseId:'E1',asOf,rate,balanceYuan:100,identity:asOf==='2025-12-31'?'SNAPSHOT':'SIMULATED_HISTORY'}))};const p={...parameters('history-continuation'),months:2,levelAlpha:1,trendBeta:1,trendDamping:.5};const r=financingBusinessModel(input,p,'history-continuation');assert.deepEqual(r.rows[0].forecast.map(p=>p.v),[3.5,3.75]);assert.equal(r.rows[0].predictedInterest,undefined);validateFinancingForecast(r,input,p);
  assert.deepEqual(financingBusinessModel({...input,ledgerContracts:[contract({rate:99,maturityDate:'2026-01-01'})]},{...p,rateChangeBps:500,rolloverPct:0},'history-continuation'),r);
});
test('published AI output indexes freeze proposals, create a specific action and prevent duplicate dispatch and tampering',async()=>{
  const map=new Map(),studio=createModelStudio({storage:{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)},executor:async(c,i,p)=>new Function('input','parameters',c)(i,p)}),key=await studio.initialize(data);await studio.registerBindingAsset(history);for(const a of assets)await studio.registerBindingAsset(a);await studio.initializeFinancingMethods(key);
  const run=await studio.run('builtin-cost',{purpose:'USE',versionId:'reference-financing-refinance-ai-1',objectIds:['ENT-007','ENT-017']}),proposal=run.output.rows[0].proposals[0];assert.ok(run.emittedOutput.rows[0].proposalIds.includes(proposal.id));const fields={title:'Bank rate inquiry',owner:'Financing team',dueDate:new Date(Date.now()+86400000*7).toISOString().slice(0,10)},task=taskFromFinancingProposal(run,data,proposal.id,fields,[]);assert.deepEqual(task.objectIds,[proposal.enterpriseId]);assert.equal(task.actionCode,'BANK_RATE_INQUIRY');assert.equal(task.decisionFlow.stage,'REVIEW');assert.equal(task.evidence.loanId,proposal.loanId);assert.equal(caseBasisIssue(task,data,studio.read()),'');assert.throws(()=>taskFromFinancingProposal(run,data,proposal.id,{...fields,title:'Renamed'},[{...task,status:'COMPLETED',decisionFlow:{stage:'EXECUTED'}}]),/未结束/);task.recommendation.proposedRate=0;assert.match(caseBasisIssue(task,data,studio.read()),/原建议/);
});
