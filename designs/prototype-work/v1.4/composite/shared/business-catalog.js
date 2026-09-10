(function installBusinessCatalog(global) {
  'use strict';
  const clone=value=>JSON.parse(JSON.stringify(value));
  const specs={
    'OBJ-ENTERPRISE': ['m01.object-type.enterprise','企业','building-2','#456da8',true],
    'OBJ-FINANCING-ENTITY':['m01.object-type.financing-entity','融资业务','landmark','#3574b9',false],
    'OBJ-FINANCING-DETAIL':['m01.object-type.financing-detail','融资业务','rows-3','#5c6f82',false],
    'OBJ-FINANCIAL-INSTITUTION':['m01.object-type.financial-institution','融资业务','landmark','#27806e',false],
    'OBJ-FINANCING-OWNER':['m01.object-type.financing-owner','融资业务','user-round','#7262a8',false],
    'OBJ-ENTERPRISE-DEPARTMENT':['budget-department','企业预算','building','#71632b',false],
    'OBJ-ENTERPRISE-BUDGET-ANNUAL':['budget-annual','企业预算','receipt-text','#9a6e26',false],
    'OBJ-ENTERPRISE-BUDGET-DETAIL':['budget-detail','企业预算','rows-3','#9a6e26',false],
    'OBJ-INVESTMENT-PRODUCT':['m01.object-type.financial-product','投资业务','badge-dollar-sign','#386eb3',false],
    'OBJ-INVESTMENT-HOLDING':['m01.object-type.investment-holding','投资业务','chart-candlestick','#28786c',false],
    'OBJ-HOLDING-OBSERVATION':['holding-observation','投资业务','calendar','#28786c',false],
  };
  const domains={ 'V14-ENTERPRISE':'S003','V14-DEPARTMENT':'S002','V14-BUDGET-ANNUAL':'S002','V14-BUDGET-DETAIL':'S002','V14-PRODUCT':'S005','V14-HOLDING':'S005','V14-HOLDING-OBSERVATION':'S005' };
  function create(raw, data, release) {
    const version=release?.version;
    if (!version || version.publicationState!=='Published' || version.validationSnapshot?.status!=='passed') throw Error('Business ontology has no validated published version');
    if (version.dataContract.assetVersion!==release.sourceContract.assetVersion) throw Error('Business source/version mismatch');
    const objects=[],bindings=[],rowsById=new Map(),typeMetadata={},byMember=new Map(),semanticLinks=[];
    const oldById=new Map(raw.objects.map(o=>[o.id,o]));
    const versionId=version.id,dataVersionId=version.dataContract.assetVersion;
    for (const type of version.objects) {
      const spec=specs[type.id];if(!spec)throw Error('Unknown business presentation '+type.id);
      typeMetadata[type.id]={id:type.id,label:type.name,group:spec[1],icon:spec[2],color:spec[3],primary:spec[4],presentationTypeId:spec[0]};
      const identity=type.properties.find(p=>p.id===type.identity);
      if(!identity?.key)throw Error('No explicit identity field '+type.id);
      const binding={id:`BIND-M07-${type.id}`,semanticVersionId:versionId,objectTypeId:type.id,dataVersionId,identityMap:{[identity.id]:identity.key}};
      bindings.push(binding);
      const memberObjects=[];
      for (const row of data.records[type.memberId]||[]) {
        let id=String(row[identity.key]);
        if(type.id==='OBJ-FINANCING-ENTITY')id=`FIN-SUBJECT-${id}`;
        const original=oldById.get(id)||oldById.get(row.legacyId)||raw.objects.find(o=>o.canonicalObjectRef?.id===id)|| (id.startsWith('ENT-APPLICANT-')?oldById.get(`preloan::LoanApplicant-${id.slice(-3)}`):null);
        const scenarioId=type.id==='OBJ-ENTERPRISE' && original?.scenarioId==='S004'?'S004':domains[type.memberId]||'S001';
        const title=row.name||row[identity.key];
        const asOf=row.asOf||'2025-12-31';
        const properties={};
        for(const p of type.properties){
          properties[p.key]={value:row[p.key]??null,unit:p.unit==='—'?'':p.unit,propertyId:p.id,propertyLabel:p.name,
            sourceScenarioId:original?.properties?.[p.key]?.sourceScenarioId||scenarioId,dataVersionId,ontologyVersionId:versionId,asOf,
            sourceRefs:[`business-source.json#records/${type.memberId}/${encodeURIComponent(row[identity.key])}`,...(row.sourceRefs||[])],
            role:p.role,definition:p.definition,originSourceRefs:original?.properties?.[p.key]?.sourceRefs||[]};
        }
        const item={...(original?clone(original):{}),id,kind:'object',bindingId:binding.id,objectTypeId:type.id,presentationTypeId:spec[0],title,
          scenarioId,properties,dataAsOf:asOf,sourceIdentity:{[identity.key]:row[identity.key]},sourceMemberId:type.memberId,
          sourceRefs:[`business-source.json#records/${type.memberId}/${encodeURIComponent(row[identity.key])}`],
          canonicalObjectRef:{id,title,objectTypeRef:type.id,scenarioId,dataVersionId,ontologyVersionId:versionId,bindingId:binding.id},
          legacyCanonicalObjectRef:original?.canonicalObjectRef?clone(original.canonicalObjectRef):null,
          aliases:[...(original?.aliases||[]),...(original?.canonicalObjectRef?.id && original.canonicalObjectRef.id!==id?[original.canonicalObjectRef.id]:[]),...(original&&original.id!==id?[original.id]:[])],
          subtitle:original?.subtitle||`${typeMetadata[type.id].group} · ${type.name}`};
        if(type.id==='OBJ-ENTERPRISE'){
          item.enterpriseId=id;
          item.roles=Array.isArray(original?.roles)?[...original.roles]:['LOAN_APPLICANT'];
          if(id===data.budgetOwnership.enterpriseId){item.roles.push('BUDGET_OWNER');item.budgetOwnership=clone(data.budgetOwnership);}
          item.sourceFacets=clone(original?.sourceFacets||{});
        }
        if(type.id==='OBJ-ENTERPRISE-DEPARTMENT'){item.parentEnterpriseId=row.enterpriseId;item.departmentId=row.departmentId;item.sourceDepartmentId=row.sourceDepartmentId;const queryId=({SB:'dept-equipment',JS:'dept-technology',AQ:'dept-safety'})[row.sourceDepartmentId];if(queryId)item.aliases.push(queryId);}
        if(type.id==='OBJ-ENTERPRISE-BUDGET-ANNUAL'||type.id==='OBJ-ENTERPRISE-BUDGET-DETAIL'){item.parentEnterpriseId=row.enterpriseId;item.departmentId=row.departmentId;item.annualId=row.annualId;item.budgetMarker=row.dataMarker||row.sourceRecord?.dataMarker;}
        if(type.id==='OBJ-INVESTMENT-HOLDING'){item.ledgerId=row.ledgerId;item.productId=row.productId;}
        if(type.id==='OBJ-HOLDING-OBSERVATION'){item.holdingId=row.holdingId;item.catalogHidden=true;}
        if(type.id==='OBJ-FINANCING-ENTITY')item.parentEnterpriseId=row.enterpriseId;
        if(type.id==='OBJ-FINANCING-DETAIL'){item.parentEnterpriseId=row.enterpriseId;item.subtitle=`${row.sourceBorrower} · ${row.institution}`;item.sourceRow=row.sourceRow;}
        objects.push(item);memberObjects.push(item);rowsById.set(id,row);
      }
      byMember.set(type.memberId,memberObjects);
    }
    const objectById=new Map(objects.map(o=>[o.id,o]));
    // Reviewed legacy identifiers from the same fixed financing snapshot.
    const oldInstitutionIds = {
      "financing::s001.institution.553.01":"INST-8C7053E111F5", "financing::s001.institution.553.02":"INST-E7F54CA463CE", "financing::s001.institution.553.03":"INST-5FE08EB69971",
      "financing::s001.institution.465.01":"INST-8728A8557B36", "financing::s001.institution.465.02":"INST-822120B24E9C", "financing::s001.institution.465.03":"INST-260A83D01ED6",
      "financing::s001.institution.561.01":"INST-996965708A20", "financing::s001.institution.561.02":"INST-365E26016E92", "financing::s001.institution.561.03":"INST-169A5179CB8B"
    };
    for (const [oldId, currentId] of Object.entries(oldInstitutionIds)) {
      const previous = oldById.get(oldId), current = objectById.get(currentId);
      if (!previous || !current) throw Error("Legacy institution binding changed");
      current.aliases.push(oldId, previous.canonicalObjectRef.id, previous.properties.sourceInstitutionCode?.value);
      current.aliases = [...new Set(current.aliases.filter(Boolean))];
    }
    const typeById=new Map(version.objects.map(o=>[o.id,o]));
    for(const definition of version.links){
      const sourceType=typeById.get(definition.source),targetType=typeById.get(definition.target);
      const sourceKey=sourceType.properties.find(p=>definition.sourceEndpoint.kind==='assetField'?p.sourceFieldId===definition.sourceEndpoint.id:p.id===definition.sourceEndpoint.id).key;
      const targetKey=targetType.properties.find(p=>definition.targetEndpoint.kind==='assetField'?p.sourceFieldId===definition.targetEndpoint.id:p.id===definition.targetEndpoint.id).key;
      const targets=new Map((byMember.get(targetType.memberId)||[]).map(o=>[rowsById.get(o.id)[targetKey],o]));
      for(const source of byMember.get(sourceType.memberId)||[]){
        const target=targets.get(rowsById.get(source.id)[sourceKey]);if(!target)throw Error('Unresolved business relationship '+definition.id);
        semanticLinks.push({id:`${definition.id}:${source.id}:${target.id}`,semanticVersionId:versionId,linkTypeId:definition.id,sourceId:source.id,targetId:target.id,
          from:source.id,to:target.id,label:definition.name,reverseLabel:definition.reverseName,sourceRefs:[dataVersionId,versionId]});
      }
    }
    const validation=global.OFW_ONTOLOGY_CONSUMPTION.validate({publishedVersions:[version],bindings,instances:objects,links:semanticLinks});
    if(!validation.valid)throw Error('Invalid ontology consumption: '+JSON.stringify(validation.issues.slice(0,5)));
    const series=[];
    for(const item of objects.filter(o=>o.objectTypeId==='OBJ-ENTERPRISE')){
      for(const old of raw.series.filter(s=>s.ownerObjectId===item.id)){
        const key=({'m01.property.riskScore':'riskScore','s001.property.averageFinancingCost':'averageFinancingCost','s001.property.financingBalance':'balance'})[old.propertyId];
        const p=item.properties[key];if(!p)continue;
        series.push({...clone(old),propertyId:p.propertyId,ownerObjectId:item.id,ontologyVersionId:versionId,dataVersionId,versionRef:dataVersionId});
      }
    }
    const observationType=typeById.get('OBJ-HOLDING-OBSERVATION');
    for(const holding of objects.filter(o=>o.objectTypeId==='OBJ-INVESTMENT-HOLDING')){
      const rows=(data.records['V14-HOLDING-OBSERVATION']||[]).filter(r=>r.holdingId===holding.id).sort((a,b)=>a.asOf.localeCompare(b.asOf));
      for(const key of ['value','cost','pnl','price']){
        const p=observationType.properties.find(p=>p.key===key);
        series.push({id:`series:${holding.id}:${key}`,label:p.name,propertyId:p.id,ownerObjectId:holding.id,unit:p.unit,scenarioId:'S005',ontologyVersionId:versionId,dataVersionId,versionRef:dataVersionId,
          points:rows.map(row=>({t:row.asOf,v:row[key],sourceRefs:[`${dataVersionId}#${row.snapshotId}`]}))});
      }
    }
    const annuals=objects.filter(o=>o.objectTypeId==='OBJ-ENTERPRISE-BUDGET-ANNUAL');
    for(const department of objects.filter(o=>o.objectTypeId==='OBJ-ENTERPRISE-DEPARTMENT')){
      const rows=annuals.filter(o=>o.departmentId===department.id).sort((a,b)=>a.dataAsOf.localeCompare(b.dataAsOf));
      for(const key of ['budgetAmount','actualAmount','executionRate']){
        const p=rows[0].properties[key];series.push({id:`series:${department.id}:${key}`,label:p.propertyLabel,propertyId:p.propertyId,ownerObjectId:department.id,unit:p.unit,scenarioId:'S002',ontologyVersionId:versionId,dataVersionId,versionRef:dataVersionId,
          points:rows.map(row=>({t:row.dataAsOf,v:row.properties[key].value,sourceRefs:row.sourceRefs}))});
      }
    }
    const collections=[{id:'group-finance',kind:'aggregate-view',title:'集团融资总览',memberIds:['ENT-020','ENT-007','ENT-017'],summary:clone(data.groupSummary),sourceRefs:[data.sources.finance.path],scopeNote:'集团汇总口径为5218笔融资；下方三家为当前可下探的重点企业。'},
      {id:'investment-analysis',kind:'object-set',title:'投资产品分析集',memberIds:objects.filter(o=>o.objectTypeId==='OBJ-INVESTMENT-PRODUCT').map(o=>o.id)}];
    for(const enterprise of objects.filter(o=>o.objectTypeId==='OBJ-ENTERPRISE')){
      const loans=objects.filter(o=>o.objectTypeId==='OBJ-FINANCING-DETAIL'&&o.parentEnterpriseId===enterprise.id);
      if(loans.length)collections.push({id:`financing:${enterprise.id}`,kind:'object-set',title:`${enterprise.title} · 融资借据`,memberIds:loans.map(o=>o.id),parentId:enterprise.id});
    }
    for(const annual of annuals)collections.push({id:`budget-details:${annual.id}`,kind:'object-set',title:`${annual.title} · 科目期间明细`,memberIds:objects.filter(o=>o.objectTypeId==='OBJ-ENTERPRISE-BUDGET-DETAIL'&&o.annualId===annual.id).map(o=>o.id),parentId:annual.id});
    collections.push({id:`budget-history:${data.budgetOwnership.enterpriseId}`,kind:'object-set',title:'企业部门年度预算',memberIds:annuals.map(o=>o.id),parentId:data.budgetOwnership.enterpriseId});
    const legacyViews={'financing::s001.group':{collectionId:'group-finance',activeId:'ENT-020'},'s001.group':{collectionId:'group-finance',activeId:'ENT-020'},'investment::portfolio-01':{collectionId:'investment-analysis'},'portfolio-01':{collectionId:'investment-analysis'}};
    for(const [suffix,eid] of [['553','ENT-020'],['465','ENT-007'],['561','ENT-017']])for(const id of [`financing::s001.loanbook.${suffix}`,`s001.loanbook.${suffix}`])legacyViews[id]={collectionId:`financing:${eid}`,activeId:eid};
    for(let n=1;n<=4;n++)for(const id of [`budget::BudgetUnit-00${n}`,`BudgetUnit-00${n}`])legacyViews[id]={activeId:data.budgetOwnership.enterpriseId,businessScenario:'S002'};
    const result={...clone(raw),resourceVersion:"enterprise-business-v2",namespace:"ofw.m07.enterprise-business.v2",source:{...clone(raw.source),root:"M01-published-enterprise-business",sourceAssetVersion:dataVersionId},objects,links:semanticLinks,series,events:[],bindings,typeMetadata,collections,legacyViews,
      ontologyVersionId:versionId,dataVersionId,publishedVersions:[version],budgetOwnership:clone(data.budgetOwnership),validation};
    result.ontologyContext={publishedSemanticVersionId:versionId,authoritativeBindingId:'M07-ENTERPRISE-BUSINESS-BINDING-v1',definitionMode:'explicit-published-bindings',publishedStatus:'published'};
    result.businessRules=raw.objects.filter(o=>o.objectTypeId==='m01.object-type.financing-rule-result').map(o=>({...clone(o),ownerId:raw.links.find(l=>l.to===o.id)?.from}));
    return result;
  }
  global.OFW_BUSINESS_CATALOG=Object.freeze({create});
})(typeof window==='undefined'?globalThis:window);
