import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {createModelStudio,MODEL_STORE_KEY,serializeModelStore,readModelStore,fingerprint} from '../composite/shared/model-studio.js';
const data=JSON.parse(readFileSync(new URL('../public/data/portfolio.json',import.meta.url))),assets=JSON.parse(readFileSync(new URL('../public/data/finance-contract-assets.json',import.meta.url))).assets;
test('large immutable assets use lossless column storage and retain original fingerprint after reload',async()=>{
 const state={schemaVersion:1,bindingAssets:Object.fromEntries(assets.map(a=>[a.id,a])),runs:[],datasets:{},goals:[],versions:[]},encoded=serializeModelStore(state);assert.ok(encoded.length<JSON.stringify(state).length*.65);
 const restored=readModelStore({getItem:()=>encoded});for(const asset of assets){assert.deepEqual(restored.bindingAssets[asset.id],asset);const {digest,...payload}=restored.bindingAssets[asset.id];assert.equal(await fingerprint(payload),digest);}
});
test('asset migration preserves old stored records and algorithms can run after reload with bounded quota',async()=>{
 const map=new Map(),storage={getItem:key=>map.get(key)||null,setItem:(key,value)=>{if(value.length>1600000)throw new Error('quota');map.set(key,value);}},execute=async(c,i,p)=>new Function('input','parameters',c)(i,p),studio=createModelStudio({storage,executor:execute}),key=await studio.initialize(data);
 for(const asset of assets)await studio.registerBindingAsset(asset);
 await studio.initializeFinancingMethods(key);const reloaded=createModelStudio({storage,executor:execute});const run=await reloaded.run('builtin-cost',{purpose:'USE',versionId:'reference-financing-refinance-ai-1',objectIds:['ENT-007']});assert.equal(run.status,'SUCCEEDED');assert.ok(run.output.rows[0].proposals.length);assert.equal(reloaded.read().bindingAssets[assets[0].id].rows.length,301);assert.ok(map.get(MODEL_STORE_KEY).includes('columns-v1'));
 const legacy=JSON.stringify({schemaVersion:1,runs:[],bindingAssets:{[assets[0].id]:assets[0]}});assert.deepEqual(readModelStore({getItem:()=>legacy}).bindingAssets[assets[0].id],assets[0]);
});
