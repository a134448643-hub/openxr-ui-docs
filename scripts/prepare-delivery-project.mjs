import path from 'node:path';
import {createProjectDelivery} from '../server/ue-project-delivery.mjs';
const root=path.resolve(import.meta.dirname,'..'),delivery=createProjectDelivery({root}),input=process.argv[2];
if(!input)throw Error('Provide the source .uproject or project directory');
const report=await delivery.configure(input);console.log(JSON.stringify({phase:'source-inspected',source:report.source,summary:report.summary}));
const plan=await delivery.previewCopy({name:process.argv[3]||'OpenXR_UI_TranslationWork_5_3'});console.log(JSON.stringify({phase:'copy-plan',target:plan.target,summary:plan.summary,sourceDigest:plan.sourceDigest}));
const result=await delivery.createCopy(plan.planId);let last='';
for(;;){const job=await delivery.job(result.jobId);if(job.phase!==last){last=job.phase;console.log(JSON.stringify({phase:job.phase,status:job.status,filesCopied:job.filesCopied}));}if(job.status!=='running'){if(job.status!=='completed')throw Error(job.error);console.log(JSON.stringify({copyJobId:job.id,descriptorPath:job.descriptorPath,sourceUnchanged:job.sourceUnchanged,sourceDigest:job.sourceDigest,copyVerified:job.copyVerified}));break;}await new Promise(resolve=>setTimeout(resolve,500));}
console.log(JSON.stringify({engines:await delivery.engines(),fab:await delivery.fabChecks(result.jobId)}));
