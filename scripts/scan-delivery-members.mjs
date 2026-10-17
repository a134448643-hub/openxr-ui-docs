import path from 'node:path';
import {createProjectDelivery} from '../server/ue-project-delivery.mjs';
const delivery=createProjectDelivery({root:path.resolve(import.meta.dirname,'..')}),status=await delivery.status(),id=process.argv[2]||status.latestCopy?.id;
if(!id)throw Error('Create and verify a working copy first');
const result=await delivery.scanMembers(id);let last='';
for(;;){const job=await delivery.job(result.jobId);if(job.phase!==last){last=job.phase;console.log(JSON.stringify({phase:job.phase,status:job.status,scanJobId:job.id}));}if(job.status!=='running'){if(job.status!=='completed')throw Error(job.error);console.log(JSON.stringify({scanJobId:job.id,blueprints:job.result.blueprints.length,entries:job.result.entries.length,warnings:job.result.warnings.slice(0,5),warningCount:job.result.warnings.length,coverage:job.result.coverage,sourceUnchanged:job.sourceUnchanged,temporaryPluginsRemoved:job.temporaryPluginsRemoved,resultFile:job.resultFile}));break;}await new Promise(resolve=>setTimeout(resolve,1000));}
