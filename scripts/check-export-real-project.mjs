import path from 'node:path';
import {createProjectDelivery} from '../server/ue-project-delivery.mjs';
const root=path.resolve(import.meta.dirname,'..'),delivery=createProjectDelivery({root}),state=await delivery.status();
const plan=await delivery.previewExport({jobId:state.latestCopy.id,outputRoot:delivery.defaultOutput,name:process.argv[2]||'OpenXR_UI_EN_ExportTest_'+Date.now()});
console.log(JSON.stringify({phase:'export-plan',target:plan.target,assetMoves:plan.assetMoves,changedFields:plan.changedFields,prefixChanges:plan.prefixChanges}));
const result=await delivery.createExport(plan.planId);let last='';for(;;){const j=await delivery.job(result.jobId);if(j.phase!==last){last=j.phase;console.log(JSON.stringify({jobId:j.id,status:j.status,phase:j.phase}));}if(j.status!=='running'){console.log(JSON.stringify({status:j.status,descriptorPath:j.descriptorPath,error:j.error,result:j.result,sourceUnchanged:j.sourceUnchanged}));if(j.status!=='completed')process.exitCode=1;break;}await new Promise(r=>setTimeout(r,1000));}
