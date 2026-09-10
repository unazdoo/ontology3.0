let pending;
export function loadPublishedBusinessCatalogue() {
  if(pending)return pending;
  pending=(async()=>{
    await Promise.all([import('./ontology-consumption.js'),import('./business-catalog.js'),import('../resources/business-release.js'),import('../modules/m07/object-experience.js'),import('./model-studio-bridge.js')]);
    const base='/designs/prototype-work/v1.4/composite/';
    const responses=await Promise.all([fetch(base+'modules/m07/resources/portfolio.json'),fetch(base+'resources/business-source.json'),fetch('/model-api/v1/model-management/context?scenarioId=S003'),fetch('/designs/prototype-releases/v1.1.0/scenarios/s003/resources/m01/model-package.v2.json')]);
    if(responses.some(response=>!response.ok))throw Error('对象目录来源读取失败');
    const [raw,source,context,modelPackage]=await Promise.all([responses[0].json(),responses[1].text(),responses[2].json(),responses[3].json()]);
    const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source)))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
    if(digest!==window.OFW_M01_BUSINESS_RELEASE.sourceContract.sourceFingerprint.value)throw Error('对象目录数据版本校验不一致');
    const resource=window.OFW_BUSINESS_CATALOG.create(raw,JSON.parse(source),window.OFW_M01_BUSINESS_RELEASE);
    return {resource,experience:window.OFW_OBJECT_EXPERIENCE.create(resource),monitor:{context,modelPackage}};
  })().catch(error=>{pending=null;throw error;});
  return pending;
}
