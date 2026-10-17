// Discovery pattern references UE Box's epicProjects.ts and projectPath.ts.
// Keep discovery read-only; importing selected records uses the existing registry.
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {decodeIni} from './ue-ini.mjs';import {excludedUEDirectoryReason} from './ue-scan-policy.mjs';
import {readUEProjectClassification} from './ue-project-classification.mjs';
export function parseUERecentProjects(text){
  const records=[];let section='';
  for(const line of text.split(/\r?\n/)){const heading=line.trim().match(/^\[([^\]]+)\]$/);if(heading){section=heading[1];continue;}if(section.toLowerCase()!=='/script/unrealed.editorsettings'||!/^\s*\+?RecentlyOpenedProjectFiles\s*=/i.test(line))continue;
    const project=line.match(/ProjectName\s*=\s*"([^"]+\.uproject)"/i),time=line.match(/LastOpenTime\s*=\s*(\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{2})/i);if(!project)continue;
    records.push({descriptorPath:project[1],lastOpenTime:time?`${time[1]}-${time[2]}-${time[3]}T${time[4]}:${time[5]}:${time[6]}`:''});
  }return records;
}
export async function readUERecentProjects({localAppData=process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local')}={}){
  const engineRoot=path.join(localAppData,'UnrealEngine'),items=new Map(),warnings=[];let missingCount=0,excludedCount=0,duplicateCount=0,historyFiles=0;
  let versions;try{versions=(await fs.readdir(engineRoot,{withFileTypes:true})).filter(e=>e.isDirectory()&&/^\d+\.\d+(?:\.\d+)?$/.test(e.name));}catch(error){if(error.code==='ENOENT')return {items:[],historyFiles:0,missingCount:0,excludedCount:0,duplicateCount:0,warnings:[],engineRoot};throw error;}
  for(const version of versions)for(const config of ['WindowsEditor','Windows']){const ini=path.join(engineRoot,version.name,'Saved','Config',config,'EditorSettings.ini');let text;try{text=decodeIni(await fs.readFile(ini)).text;}catch(error){if(error.code!=='ENOENT')warnings.push({path:ini,message:'最近项目配置读取失败：'+error.message});continue;}historyFiles++;
    for(const record of parseUERecentProjects(text)){
      const reason=record.descriptorPath.split(/[\\/]/).filter(part=>part.toLowerCase()!=='.local').map(excludedUEDirectoryReason).find(Boolean);if(reason){excludedCount++;continue;}
      try{if(!path.isAbsolute(record.descriptorPath))throw Error('最近项目路径不是绝对路径');const real=await fs.realpath(record.descriptorPath);if(!(await fs.stat(real)).isFile())throw Error('不是工程文件');const descriptor=JSON.parse(decodeIni(await fs.readFile(real)).text);if(!descriptor||typeof descriptor!=='object'||Array.isArray(descriptor))throw Error('描述文件格式异常');const classification=await readUEProjectClassification(real);if(!classification.valid){excludedCount++;continue;}const key=real.toLowerCase();const existing=items.get(key);if(existing){duplicateCount++;if(existing.lastOpenTime>=record.lastOpenTime)continue;}
        items.set(key,{classification,name:path.basename(real,path.extname(real)),descriptorPath:real,projectRoot:path.dirname(real),engineVersion:String(descriptor.EngineAssociation||'未识别'),historyEngineVersion:version.name,lastOpenTime:record.lastOpenTime,plugins:Array.isArray(descriptor.Plugins)?descriptor.Plugins.filter(p=>p.Enabled!==false).map(p=>p.Name):[],sourceIni:ini});
      }catch(error){if(['ENOENT','ENOTDIR'].includes(error.code))missingCount++;else warnings.push({path:record.descriptorPath,message:error.message});}
    }
  }
  return {items:[...items.values()].sort((a,b)=>b.lastOpenTime.localeCompare(a.lastOpenTime)),historyFiles,missingCount,excludedCount,duplicateCount,warnings,engineRoot};
}
