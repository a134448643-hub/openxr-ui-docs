import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {buildSemanticPrompt,semanticBatchSchema,validateSemanticResponse,validSemanticSubset} from './semantic-translation.mjs';
import {translationProfileEnv} from './translation-settings.mjs';

export async function findCodex(){
  const candidates=[process.env.CODEX_CLI_PATH,...String(process.env.PATH||'').split(path.delimiter).map(dir=>path.join(dir,'codex.exe'))];
  const base=path.join(process.env.LOCALAPPDATA||'C:/Users/10728/AppData/Local','OpenAI','Codex','bin');
  for(const e of await fs.readdir(base,{withFileTypes:true}).catch(()=>[]))if(e.isDirectory())candidates.push(path.join(base,e.name,'codex.exe'));
  for(const file of candidates.filter(Boolean)){try{if((await fs.stat(file)).isFile())return file;}catch{}}
  throw Error('未找到本机 Codex，请先安装并登录 Codex。');
}
export function runTextProcess(file,args,{cwd,input='',timeout=180000,env=process.env}={}){
  return new Promise((resolve,reject)=>{const child=spawn(file,args,{cwd,env,windowsHide:true,shell:false,stdio:['pipe','pipe','pipe']});let stdout='',stderr='';
    const timer=setTimeout(()=>{child.kill();reject(Error('翻译请求超时，已保留已完成批次，可重试。'));},timeout);
    child.stdout.on('data',b=>{stdout=(stdout+b.toString()).slice(-50000);});child.stderr.on('data',b=>{stderr=(stderr+b.toString()).slice(-10000);});child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('close',code=>{clearTimeout(timer);resolve({code,stdout,stderr});});child.stdin.on('error',()=>{});child.stdin.end(input);
  });
}
export async function codexStatus(profile={id:'local-codex',model:'gpt-6-luna',label:'本机 Codex 账号'}){try{const exe=await findCodex(),auth=await runTextProcess(exe,['login','status'],{timeout:15000,env:translationProfileEnv(profile)}),text=auth.stdout+'\n'+auth.stderr;return {available:auth.code===0,provider:'Codex',profileId:profile.id,profileLabel:profile.label,model:profile.model,login:text.includes('ChatGPT')?'ChatGPT':auth.code===0?'已登录':'未登录',message:auth.code===0?'使用本机 Codex 登录，无需在平台填写 API Key':'请先在 Codex 完成登录'};}catch(e){return {available:false,provider:'Codex',profileId:profile.id,model:profile.model,message:e.message};}}

// Retry only unresolved entries; never match responses by order or fuzzy IDs.
export async function exchangeSemanticBatch(entries,execute){
 const accepted=new Map();let remaining=entries;
 for(let attempt=0;attempt<2&&remaining.length;attempt++){
  const wire=remaining.map((entry,index)=>({...entry,id:'t'+String(index+1).padStart(3,'0')})),mapping=new Map(wire.map((entry,index)=>[entry.id,remaining[index].id]));
  let parsed;try{parsed=await execute({entries:wire,schema:semanticBatchSchema(wire),attempt,mapping});}catch(error){error.validTranslations=[...accepted.values()];throw error;}
  const valid=validSemanticSubset(parsed,wire);for(const value of valid){const id=mapping.get(value.id);accepted.set(id,{...value,id});}remaining=entries.filter(entry=>!accepted.has(entry.id));
 }
 if(remaining.length){const error=Error('模型返回 '+remaining.length+' 条记录的标识或字段无效；已保留其余有效结果，可继续翻译。');error.validTranslations=[...accepted.values()];throw error;}
 return validateSemanticResponse({translations:entries.map(entry=>accepted.get(entry.id))},entries);
}
export async function translateWithCodex({entries,direction,terms=[],directory,naming={},profile={id:'local-codex',model:'gpt-6-luna',reasoning:'medium'},onPhase}){
 if(!['zh-en','en-zh'].includes(direction)||!Array.isArray(entries)||entries.length>600)throw Error('翻译请求参数无效');
 directory=path.resolve(directory);await fs.mkdir(directory,{recursive:true});const exe=await findCodex();
 await fs.writeFile(path.join(directory,'request-metadata.json'),JSON.stringify({provider:'Codex',model:profile.model,profileId:profile.id,reasoning:profile.reasoning,semanticVersion:3,requestFormatVersion:4,terms:entries.length},null,2));
 return exchangeSemanticBatch(entries,async({entries:wire,schema,attempt,mapping})=>{
  const attemptDir=path.join(directory,'attempt-'+attempt);await fs.mkdir(attemptDir,{recursive:true});const schemaFile=path.join(attemptDir,'schema.json'),output=path.join(attemptDir,'response.json'),work=path.join(attemptDir,'empty-workspace');await fs.mkdir(work,{recursive:true});
  await fs.writeFile(schemaFile,JSON.stringify(schema));await fs.writeFile(path.join(attemptDir,'request.json'),JSON.stringify({entries:wire,idMapping:Object.fromEntries(mapping)},null,2));const prompt=buildSemanticPrompt({entries:wire,direction,terms,naming});
  await onPhase?.({attempt,entries:wire.length});
  const result=await runTextProcess(exe,['exec','--model',profile.model,'-c','model_reasoning_effort='+JSON.stringify(profile.reasoning||'medium'),'--ignore-user-config','--ephemeral','--sandbox','read-only','--skip-git-repo-check','--color','never','-c','web_search="disabled"','-C',work,'--output-schema',schemaFile,'--output-last-message',output,'-'],{cwd:work,input:prompt,timeout:Math.min(600000,Math.max(240000,entries.length*1000)),env:translationProfileEnv(profile)});
  if(result.code!==0){const detail=result.stderr.replace(/(Bearer\s+)[^\s]+/gi,'$1[redacted]').replace(/sk-[A-Za-z0-9_-]+/g,'[redacted]').slice(-3000);await fs.writeFile(path.join(attemptDir,'request-error.txt'),detail);throw Error('Codex 翻译失败：'+(detail.split('\n').filter(l=>l.trim()).slice(-3).join(' ').slice(0,600)||'检查登录、模型权限、网络或额度')+'（退出码 '+result.code+'）');}
  try{return JSON.parse(await fs.readFile(output,'utf8'));}catch{return null;}
 });
}
