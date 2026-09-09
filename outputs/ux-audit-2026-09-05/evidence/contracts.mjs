import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
const root='/Users/domi/Public/Vibecoding/ontology3.0-worktrees/prototype-composite-v1.3.0/designs/prototype-work/v1.3.1/composite';
const model=await readFile(`${root}/model-center/app.js`,'utf8');
const explorer=await readFile(`${root}/modules/m07/app.js`,'utf8');
function originalFunction(source,name,nextName) {
  return source.slice(source.indexOf(`  function ${name}(`),source.indexOf(`  function ${nextName}(`));
}
const output={};
const source={resultId:'RESULT-A',resultKind:'SIMULATION',subjects:[{subjectId:'A',subjectName:'Object A',score:73,confidence:'HIGH'}]};
output.returnWrongObject=vm.runInNewContext(originalFunction(model,'explorationReturnPayload','returnResultToExploration')+'\nexplorationReturnPayload()',{
  hostContext:{explorationHandoff:{objectRef:{id:'B',title:'Object B',objectTypeRef:'BusinessObject'},timeRange:{start:'2025-01-01',end:'2025-12-31'},dataVersionId:'DATA-B',ontologyVersionId:'SEM-B',lensRef:{lensId:'object'}}},
  state:{scenario:{scenarioId:'S003'},cycle:{cycleId:'CYCLE'},results:{simulationEnvelope:source,candidateEnvelope:{...source,resultKind:'PREDICTION',resultId:'CANDIDATE',subjects:[{subjectId:'B',score:12}]}},objectives:[{objectiveId:'OBJ'}],operationLog:[],modelDefinitions:[]},
  scenarioId:'S003',scenarioContext:{scenarioId:'S003'},selectedResultView:'candidate'
});
output.wrongVersionMetrics=vm.runInNewContext(originalFunction(model,'metricsForOption','numericMetricEntries')+'\nmetricsForOption({modelId:"MODEL",versionId:"v1"})',{
  state:{benchmarks:[{comparableModels:[{modelId:'MODEL',modelVersionId:'v1',metrics:{prAuc:.4}}]},{comparableModels:[{modelId:'MODEL',modelVersionId:'v2',metrics:{prAuc:.8}}]}],candidates:[]}
});
output.nullAsZero=vm.runInNewContext(originalFunction(explorer,'valueForMetric','comparisonItems')+'\nvalueForMetric({properties:{score:{value:null}}},{kind:"property",key:"score"})',{});
output.unitLoss=vm.runInNewContext(originalFunction(model,'metricValue','metricWidth')+'\nmetricValue("mae",0.4)',{finite:v=>Number.isFinite(Number(v)),percent:v=>`${Number(v)*100}%`});
await writeFile('/tmp/ofw-ux-audit-20260905/v131/contracts.json',JSON.stringify(output,null,2));
console.log(JSON.stringify({returnRequested:{object:'B',resultView:'candidate'},returned:{kind:output.returnWrongObject.resultEnvelope.resultKind,subject:output.returnWrongObject.resultEnvelope.subjects[0]},oldVersionExpected:.4,oldVersionActual:output.wrongVersionMetrics.prAuc,nullAsZero:output.nullAsZero,maePointFour:output.unitLoss},null,2));
