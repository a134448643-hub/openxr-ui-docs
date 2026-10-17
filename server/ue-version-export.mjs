import {blueprintCompileScope} from './blueprint-compile-scope.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
const contained=(root,file)=>{const rel=path.relative(root,file);return rel!==''&&!rel.startsWith('..')&&!path.isAbsolute(rel);};
export async function convertVersion({baseline,target,version,editor,resourceRoot,taskDir,protectedRoots,expectedBlueprints,expectedAssets,runner,keepReports=false}){
  // The target is new and has already passed the delivery service's containment checks.
  await fs.mkdir(target);for(const entry of await fs.readdir(baseline))await fs.cp(path.join(baseline,entry),path.join(target,entry),{recursive:true,force:false,errorOnExist:true});
  const descriptors=(await fs.readdir(target)).filter(n=>n.endsWith('.uproject'));if(descriptors.length!==1)throw Error('版本工程描述不唯一');
  const descriptorPath=path.join(target,descriptors[0]),clean=JSON.parse(await fs.readFile(descriptorPath,'utf8'));clean.EngineAssociation=version;
  const temporary=structuredClone(clean);temporary.Plugins=(temporary.Plugins||[]).filter(p=>!['PythonScriptPlugin','EditorScriptingUtilities'].includes(p.Name));temporary.Plugins.push({Name:'PythonScriptPlugin',Enabled:true},{Name:'EditorScriptingUtilities',Enabled:true});
  try {
  await fs.writeFile(descriptorPath,JSON.stringify(temporary,null,2));await fs.mkdir(taskDir,{recursive:true});
  const script=path.join(taskDir,'verify-version.py');await fs.copyFile(path.join(resourceRoot,'verify-version.py'),script);await fs.copyFile(path.join(resourceRoot,'verify-startup-settings.py'),path.join(taskDir,'verify-startup-settings.py'));
  const common=[descriptorPath,'-unattended','-nop4','-NoSound','-NullRHI','-utf8output'];
  const fixed=await runner(editor,[...common,'-run=ResavePackages','-fixupredirects','-projectonly','-abslog='+path.join(taskDir,'resave.log')],{cwd:target,timeout:20*60000});
  if(fixed.code!==0){const log=await fs.readFile(path.join(taskDir,'resave.log'),'utf8').catch(()=>'');const lines=log.split(/\r?\n/).filter(l=>/Error:/.test(l)&&!l.includes('[Callstack]')&&!l.endsWith('Error: ')).slice(0,8);throw Error('UE '+version+' 升级保存失败：'+lines.map(l=>l.replace(/^.*?Error:\s*/, '')).join('；')+'。报告：'+taskDir);}
  let report;
  for(const pass of ['save','reopen']){const request=path.join(taskDir,pass+'-request.json'),output=path.join(taskDir,pass+'-result.json');await fs.writeFile(request,JSON.stringify({descriptorPath,protectedRoots,expectedBlueprints,expectedAssets,save:pass==='save',output}));const result=await runner(editor,[...common,'-run=pythonscript','-script='+script,'-abslog='+path.join(taskDir,pass+'.log')],{env:{...process.env,UE_DELIVERY_VERSION_REQUEST:request},cwd:target,timeout:20*60000});try{report=JSON.parse(await fs.readFile(output,'utf8'));}catch{throw Error('UE '+version+' 没有返回有效的蓝图验证结果');}if(result.code!==0||!report.success)throw Error('UE '+version+' 蓝图/资源检查失败：'+(report.error||'查看 '+pass+'.log'));}
  const allowName='DeliveryBlueprintAllowList.txt';await fs.writeFile(path.join(target,allowName),report.blueprints.map(bp=>bp.path).join('\n'));
  const compileLog=path.join(taskDir,'compile.log'),compiled=await runner(editor,[...common,'-run=CompileAllBlueprints',...blueprintCompileScope(report,allowName),'-SimpleAssetList','-abslog='+compileLog],{cwd:target,timeout:20*60000});
  const log=await fs.readFile(compileLog,'utf8'),summary=log.match(/Compiling Completed with (\d+) errors and (\d+) warnings and (\d+) blueprints that failed to load/);
  const compiledCount=(log.match(/Loading and Compiling:/g)||[]).length;
  if(compiled.code!==0||!summary||Number(summary[1])!==0||Number(summary[3])!==0||compiledCount!==expectedBlueprints)throw Error('UE '+version+' 蓝图编译未通过，查看 compile.log');
  report.compiler={errors:Number(summary[1]),warnings:Number(summary[2]),failedLoads:Number(summary[3]),compiledCount};await fs.unlink(path.join(target,allowName));
  await fs.writeFile(descriptorPath,JSON.stringify(clean,null,2));
  const realTarget=await fs.realpath(target);for(const name of ['Saved','Intermediate','DerivedDataCache','Binaries']){const folder=path.join(target,name);let actual;try{actual=await fs.realpath(folder);}catch(e){if(e.code==='ENOENT')continue;throw e;}if(!contained(realTarget,actual))throw Error('版本工程缓存路径校验失败');await fs.rm(actual,{recursive:true});}
  const result={version,target,descriptorPath,status:'completed',logDirectory:taskDir,checks:{engineLoad:true,assetLoad:true,blueprintCompile:true,upgradeSave:true,reopened:true,vrRuntime:false,packaging:false},report};await fs.writeFile(path.join(taskDir,'VersionReport.json'),JSON.stringify(result,null,2));if(keepReports)await fs.writeFile(path.join(target,'VersionReport.json'),JSON.stringify(result,null,2));return result;
  }finally{await fs.writeFile(descriptorPath,JSON.stringify(clean,null,2));await fs.unlink(path.join(target,'DeliveryBlueprintAllowList.txt')).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
