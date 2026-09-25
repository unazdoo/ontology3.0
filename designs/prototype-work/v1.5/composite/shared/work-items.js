import {caseFlow,CASE_STAGES} from './task-workflow.js';
export const WORKBENCH_KEY='ofw.v1.5.workbench.v1';
export const EFFECT_KEY='ofw.v15.native-effects.v1';
export function readWork(storage=localStorage) {
  const value=JSON.parse(storage.getItem(WORKBENCH_KEY)||'null');
  if(value&&value.version!==1)throw Error('跟踪事项版本不兼容，请保留原记录并检查来源');
  return value||{version:1,tasks:[],plans:[],explorations:[],reports:[]};
}
export function saveWorkTask(task,expectedUpdatedAt=null,storage=localStorage) {
  const state=readWork(storage),current=state.tasks.find(t=>t.id===task.id);
  if(current&&current.updatedAt!==expectedUpdatedAt)throw Error('事项已在其他页面更新，请重新读取后操作');
  state.tasks=current?state.tasks.map(t=>t.id===task.id?task:t):[task,...state.tasks];
  storage.setItem(WORKBENCH_KEY,JSON.stringify(state));
  globalThis.dispatchEvent?.(new Event('ofw-work-items-change'));
  return task;
}
export function relatedWorkItems(objectId,storage=localStorage) {
  return readWork(storage).tasks.filter(t=>t.objectIds.includes(objectId)).map(task=>({task,stage:CASE_STAGES[caseFlow(task).stage]}));
}
export const resultIdentityLabel=value=>({AI_RECOMMENDATION_SCENARIO:'AI 推荐方案情景',HISTORY_TREND_FORECAST:'历史趋势预测',DEVELOPMENT_SIMULATION:'开发模拟',DEMO_BASELINE:'示例基准事实',SIMULATION:'模拟方案',CURRENT_APPLICATION:'当前应用模型结果',PUBLISHED_REFERENCE:'已发布版本结果',CANDIDATE_TRIAL:'候选试用结果',SCENARIO_SIMULATION:'模型情景模拟',DRAFT_VALIDATION:'草稿核验',VERSION_COMPARISON:'版本比较',MODEL_ADVISORY:'模型建议'}[value]||'固定来源结果');
