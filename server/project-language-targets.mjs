import fs from 'node:fs/promises';
import path from 'node:path';
import {editorLaunchArguments} from './project-open-language.mjs';

const key=value=>path.resolve(value).toLowerCase();
const languageOf=value=>value==='en'?'en':value==='zh-Hans'?'zh':null;
export function createProjectLanguageTargets({file,readJson,writeJson,resolveSource,catalog,preferences,engines,launcher}){
 let queue=Promise.resolve();
 async function checked(descriptor){try{return await resolveSource(descriptor);}catch(error){if(['ENOENT','ENOTDIR'].includes(error.code))throw Error('项目文件已移动或删除，请重新关联中英文项目：'+descriptor);throw error;}}
 async function list(descriptor){
  const source=await checked(descriptor),groups=await readJson(file,[]),group=groups.find(g=>g.members.some(p=>key(p)===key(source.descriptorPath)));
  const targets={...(group?.targets||{})};
  // Only use recorded lineage and language, never infer a translated project
  // from a folder suffix or a previous job's output path.
  const rows=await catalog.list();let ancestor=source.descriptorPath;const seen=new Set();
  while(!seen.has(key(ancestor))){seen.add(key(ancestor));const row=await catalog.lookup(ancestor);if(!row?.sourceDescriptor)break;ancestor=row.sourceDescriptor;}
  const related=new Set([key(ancestor),key(source.descriptorPath),...(group?.members||[]).map(key)]);
  for(let pass=0;pass<rows.length;pass++){let changed=false;for(const row of rows)if(row.sourceDescriptor&&related.has(key(row.sourceDescriptor))&&!related.has(key(row.descriptorPath))){related.add(key(row.descriptorPath));changed=true;}if(!changed)break;}
  for(const descriptorPath of [source.descriptorPath,...rows.filter(row=>related.has(key(row.descriptorPath))).map(row=>row.descriptorPath)]){
   const pref=await preferences.get(descriptorPath),language=languageOf(pref?.editorLanguage);if(!language||targets[language])continue;
   try{const info=await checked(descriptorPath);if(info.engineVersion===source.engineVersion)targets[language]=info.descriptorPath;}catch{}
  }
  const installed=(await engines()).items.find(e=>e.version===source.engineVersion&&e.installed);
  const items=await Promise.all(['zh','en'].map(async language=>{const descriptorPath=targets[language];if(!descriptorPath)return {language,available:false,reason:'尚未关联'+(language==='zh'?'中文':'英文')+'项目'};try{const info=await checked(descriptorPath);if(info.engineVersion!==source.engineVersion)throw Error('关联项目的 UE 版本与当前项目不同');return {language,descriptorPath:info.descriptorPath,projectRoot:info.projectRoot,available:Boolean(installed),reason:installed?'':'对应版本引擎未安装'};}catch(error){return {language,descriptorPath,available:false,needsBinding:true,reason:error.message};}}));
  return {sourceDescriptor:source.descriptorPath,items,selectedLanguage:items.find(item=>item.descriptorPath&&key(item.descriptorPath)===key(source.descriptorPath))?.language||'en'};
 }
 async function bind({descriptorPath,language,targetPath}){
  if(!['zh','en'].includes(language))throw Error('请选择中文或英文');
  const source=await checked(descriptorPath),target=await checked(targetPath);if(source.engineVersion!==target.engineVersion)throw Error('请选择与当前项目相同 UE 版本的项目');
  const pending=queue.then(async()=>{const groups=await readJson(file,[]),matching=groups.filter(g=>g.members.some(p=>[key(source.descriptorPath),key(target.descriptorPath)].includes(key(p))));const merged={members:[...new Set([source.descriptorPath,target.descriptorPath,...matching.flatMap(g=>g.members)])],targets:Object.assign({},...matching.map(g=>g.targets),{[language]:target.descriptorPath})};await writeJson(file,[...groups.filter(g=>!matching.includes(g)),merged]);});queue=pending.catch(()=>{});await pending;return list(source.descriptorPath);
 }
 async function open({descriptorPath,language}){
  if(!['zh','en'].includes(language))throw Error('请选择中文或英文');const result=await list(descriptorPath),target=result.items.find(item=>item.language===language);if(!target?.available)throw Error(target?.reason||'项目尚未关联');
  // Recheck immediately before launch; listing and clicking may be separated by a move.
  const info=await checked(target.descriptorPath),installed=(await engines()).items.find(e=>e.version===info.engineVersion&&e.installed),editor=installed?.editor.replace(/UnrealEditor-Cmd\.exe$/i,'UnrealEditor.exe');
  if(!editor||!await fs.stat(editor).then(s=>s.isFile()).catch(()=>false))throw Error('对应编辑器程序不存在');const editorLanguage=language==='zh'?'zh-Hans':'en';
  return {...await launcher(editor,editorLaunchArguments(info.descriptorPath,editorLanguage),{cwd:info.projectRoot}),descriptorPath:info.descriptorPath,editorLanguage};
 }
 async function remember(source){
  const language=languageOf((await preferences.get(source.descriptorPath))?.editorLanguage);if(!language)return;
  const groups=await readJson(file,[]),seen=new Set();let ancestor=source.descriptorPath;
  while(!seen.has(key(ancestor))){seen.add(key(ancestor));const group=groups.find(g=>g.members.some(p=>key(p)===key(ancestor)));if(group){const info=await checked(ancestor);if(info.engineVersion===source.engineVersion){await bind({descriptorPath:ancestor,language,targetPath:source.descriptorPath});return;}}const row=await catalog.lookup(ancestor);if(!row?.sourceDescriptor)break;ancestor=row.sourceDescriptor;}
  await bind({descriptorPath:source.descriptorPath,language,targetPath:source.descriptorPath});
 }
 return {list,bind,open,remember};
}
