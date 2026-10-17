import fs from 'node:fs/promises';import path from 'node:path';
import {decodeIni,parseIni} from './ue-ini.mjs';import {excludedUEDirectoryReason} from './ue-scan-policy.mjs';
const isDirectory=async file=>{try{return (await fs.stat(file)).isDirectory();}catch(error){if(error.code==='ENOENT'||error.code==='ENOTDIR')return false;throw error;}};
export async function readUEProjectClassification(file){
  if(!file||!path.isAbsolute(file)||path.extname(file).toLowerCase()!=='.uproject')return {valid:false,reason:'不是 .uproject 工程描述文件',coarseTags:[]};
  const projectRoot=path.dirname(file),excluded=projectRoot.split(/[\\/]/).filter(name=>name.toLowerCase()!=='.local').map(excludedUEDirectoryReason).find(Boolean);
  if(excluded)return {valid:false,reason:excluded,coarseTags:[]};
  const [config,content]=await Promise.all(['Config','Content'].map(name=>isDirectory(path.join(projectRoot,name))));
  if(!config||!content)return {valid:false,reason:'缺少工程目录：'+[!config?'Config':'',!content?'Content':''].filter(Boolean).join('、'),structure:{config,content},coarseTags:[]};
  let descriptor;try{descriptor=JSON.parse(decodeIni(await fs.readFile(file)).text);if(!descriptor||typeof descriptor!=='object'||Array.isArray(descriptor))throw Error('描述文件应为对象');}catch(error){return {valid:false,reason:'工程描述文件无法读取：'+error.message,coarseTags:[]};}
  let cpp=Array.isArray(descriptor.Modules)&&descriptor.Modules.length>0;
  if(!cpp&&await isDirectory(path.join(projectRoot,'Source'))){let count=0;async function hasCode(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){if(++count>20000)return false;if(entry.isSymbolicLink())continue;if(entry.isFile()&&/\.(?:cpp|c|h|hpp|build\.cs|target\.cs)$/i.test(entry.name))return true;if(entry.isDirectory()&&await hasCode(path.join(dir,entry.name)))return true;}return false;}cpp=await hasCode(path.join(projectRoot,'Source'));}
  const evidence=[],warnings=[];let startsInVR=false,vrRendering=false;
  for(const name of ['DefaultEngine.ini','DefaultGame.ini','DefaultInput.ini']){let entries;try{entries=parseIni(decodeIni(await fs.readFile(path.join(projectRoot,'Config',name))).text);}catch(error){if(error.code!=='ENOENT')warnings.push(name+' 无法读取');continue;}for(const entry of entries){const key=entry.key.toLowerCase(),truth=/^(true|1)$/i.test(entry.value);if(key==='bstartinvr'&&truth){startsInVR=true;evidence.push(name+'：bStartInVR=True');}if(['vr.instancedstereo','vr.mobilemultiview'].includes(key)&&truth){vrRendering=true;evidence.push(name+'：'+entry.key+'='+entry.value);}}}
  const xrPlugins=(descriptor.Plugins||[]).filter(plugin=>plugin.Enabled===true&&/^(?:OpenXR(?:HMD)?|OculusVR|OculusXR|MetaXR|PICOXR|PicoOpenXR|SteamVR)$/i.test(plugin.Name||'')).map(plugin=>plugin.Name);
  if(xrPlugins.length)evidence.push('明确启用 XR 插件：'+xrPlugins.join('、'));
  const detected=startsInVR||(xrPlugins.length>0&&vrRendering),codeKind=cpp?'cpp':'blueprint';
  return {valid:true,codeKind,coarseTags:[cpp?'C++':'纯蓝图',...(detected?['VR项目']:[])],structure:{config:true,content:true},vr:{status:detected?'detected':evidence.length?'candidate':'unknown',evidence},warnings,engineAssociation:String(descriptor.EngineAssociation||'')};
}
