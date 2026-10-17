import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {createApplicationStage} from '../server/project-application-staging.mjs';
const root=path.resolve('.local/checks/stage-reuse-'+Date.now()),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const mode of ['valid','wrong-owner','changed']){
 const base=path.join(root,mode),source={projectRoot:path.join(base,'O'),descriptorPath:path.join(base,'O/P.uproject')},cacheRoot=path.join(base,'S/.ue-translation-cache/p/check'),work=path.join(cacheRoot,'workspaces/w123'),workingCopy={cacheRoot,projectRoot:work,descriptorPath:path.join(work,'P.uproject')};
 const files=[['P.uproject','{"FileVersion":3,"EngineAssociation":"5.3"}'],['Config/DefaultGame.ini','[Test]'],['Content/BP_Test.uasset','original bytes']];for(const folder of [source.projectRoot,work])for(const [relative,bytes] of files){const file=path.join(folder,relative);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,bytes);}
 await fs.writeFile(path.join(cacheRoot,'owner.json'),JSON.stringify({kind:'ue-project-translation-cache',sourceDescriptor:mode==='wrong-owner'?path.join(base,'Other.uproject'):source.descriptorPath}));if(mode==='changed')await fs.writeFile(path.join(work,'Content/BP_Test.uasset'),'changed');
 const snapshot={files:files.map(([relative,b])=>({relative,sha256:hash(b)}))},taskId=crypto.randomUUID();
 if(mode==='valid'){const result=await createApplicationStage({source,snapshot,taskId,workingCopy});assert.equal(result.workingCopyReused,true);await assert.rejects(fs.access(work));assert.equal(await fs.readFile(path.join(result.projectRoot,'Content/BP_Test.uasset'),'utf8'),'original bytes');}
 else{await assert.rejects(createApplicationStage({source,snapshot,taskId,workingCopy}),mode==='changed'?/副本内容变化/:/缓存归属不符/);await fs.access(work);}
 assert.equal(await fs.readFile(path.join(source.projectRoot,'Content/BP_Test.uasset'),'utf8'),'original bytes');
}
console.log(JSON.stringify({root,checks:['owned verified working copy moves to isolated application candidate without another copy','wrong owner rejected without consuming working copy','changed bytes rejected before move','selected output remains unchanged in all scenarios']}));
