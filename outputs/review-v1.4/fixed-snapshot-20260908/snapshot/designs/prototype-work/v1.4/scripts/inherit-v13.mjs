import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const source=new URL('../../v1.3.2/composite/',import.meta.url),target=new URL('../composite/',import.meta.url);
const entries=[];
async function inherit(relative=''){
 for(const item of await readdir(new URL(relative,source),{withFileTypes:true})){
  if(!relative&&item.name==='evidence')continue;
  const path=relative+item.name;
  if(item.isDirectory()){await mkdir(new URL(path+'/',target),{recursive:true});await inherit(path+'/');continue;}
  const original=await readFile(new URL(path,source));
  const body=/\.(?:js|mjs|html|css|json)$/.test(path)?Buffer.from(original.toString().replaceAll('v1.3.2','v1.4').replaceAll('ofw.v132.','ofw.v14.')):original;
  await mkdir(new URL('./',new URL(path,target)),{recursive:true});
  await writeFile(new URL(path,target),body,{flag:'wx'});
  entries.push({path,parentSha256:createHash('sha256').update(original).digest('hex'),inheritedSha256:createHash('sha256').update(body).digest('hex')});
 }
}
await inherit();
await writeFile(new URL('../INHERITANCE-MANIFEST.json',import.meta.url),JSON.stringify({parent:'v1.3.2',version:'v1.4',createdAt:new Date().toISOString(),normalization:['v1.3.2 paths and storage namespaces -> v1.4','ofw.v132 storage namespace -> ofw.v14'],excluded:['evidence: parent test output is not new verification'],files:entries},null,2)+'\n',{flag:'wx'});
console.log(`Inherited ${entries.length} files; parent files unchanged.`);
