import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {StringDecoder} from 'node:string_decoder';
import {decodeIni,encodeIni,mergeIni,iniValue,androidSection,sdkSection,redactConfig} from './ue-ini.mjs';
import {createBuildWorkspacePath} from './ue-build-path.mjs';
import {packagingProgress,progressFromBuildLog} from './android-packaging-progress.mjs';
import {needsQuestHandTracking,questHandRequirements} from './android-hand-tracking.mjs';

const exists=async file=>{try{await fs.access(file);return true;}catch{return false;}};
const inside=(base,file)=>{const rel=path.relative(base,file);return rel===''||!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel);};
const readJson=async file=>JSON.parse((await fs.readFile(file,'utf8')).replace(/^\uFEFF/,''));
const clean=value=>String(value||'').replace(/^\(Path="(.*)"\)$/,'$1').replace(/^"(.*)"$/,'$1');
const excluded=new Set(['.ue-translation-cache','.local','.git','.vs','.idea','node_modules','intermediate','saved','deriveddatacache']);
const pluginNames=['PICOOpenXR','PICOXR','OpenXR','PICOController','OculusXR','OculusVR'];
export async function isRegisteredDerivedProject(root,source){
  let records;try{records=await readJson(path.join(root,'.local/project-delivery-state/generated-projects.json'));}catch(error){if(error.code==='ENOENT')return false;throw error;}
  return Array.isArray(records)&&records.some(row=>(row.projectRole==='derived'||['version-copy','export'].includes(row.kind))&&row.sourceDescriptor&&path.resolve(row.sourceDescriptor).toLowerCase()!==source.descriptorPath.toLowerCase()&&path.resolve(row.descriptorPath||'').toLowerCase()===source.descriptorPath.toLowerCase()&&['completed','unverified'].includes(row.status));
}
export async function checkedConfigFile(projectRoot,relative){
  const file=path.resolve(projectRoot,relative);if(!inside(projectRoot,file))throw Error('打包配置超出当前工程');
  let ancestor=file;while(!await exists(ancestor))ancestor=path.dirname(ancestor);
  if(!inside(projectRoot,await fs.realpath(ancestor)))throw Error('打包配置通过链接指向了其他工程，已停止');
  return file;
}
export async function applyDirectConfiguration(projectRoot,changes,backupRoot,id){
  const records=[];
  for(const change of changes){const file=await checkedConfigFile(projectRoot,change.relative),before=await fs.readFile(file).catch(error=>{if(error.code==='ENOENT')return null;throw error;});if((before===null)!==(change.before===null)||before&&!before.equals(change.before))throw Error('配置在准备期间发生变化，请保存后重新打包');records.push({...change,file,before});}
  await fs.mkdir(backupRoot,{recursive:true});
  for(const [index,record] of records.entries())if(record.before)await fs.writeFile(path.join(backupRoot,index+'.bin'),record.before);
  await fs.writeFile(path.join(backupRoot,'manifest.json'),JSON.stringify(records.map((record,index)=>({relative:record.relative,existed:record.before!==null,backup:record.before!==null?index+'.bin':null})),null,2));
  const applied=[];
  async function write(file,data){const temporary=file+'.ue-packaging-'+id+'.tmp';await fs.mkdir(path.dirname(file),{recursive:true});try{await fs.writeFile(temporary,data,{flag:'wx'});await fs.rename(temporary,file);}finally{await fs.rm(temporary,{force:true});}}
  try{for(const record of records){if(record.before?.equals(record.after))continue;await write(record.file,record.after);applied.push(record);}}
  catch(error){for(const record of applied.reverse())try{if(record.before===null)await fs.unlink(record.file);else await write(record.file,record.before);}catch{}throw Error('打包配置保存失败：'+error.message+'；修改前配置保存在本次任务记录中');}
}

export function androidToolchainProfile(version){
  const match=String(version).match(/^5\.(\d+)(?:\.|$)/),minor=match?Number(match[1]):0;
  if(minor<1||minor>8)throw Error('尚未适配此引擎版本的 Android 打包：'+version);
  return {minor,ndk:minor>=6?'27.2.12479018':'25.1.8937393',ndkName:minor>=6?'r27c':'r25b',sdk:minor>=7?35:minor>=5?34:minor>=3?33:32,java:minor>=7?21:minor>=3?17:8};
}

export function androidPackagingInfo(version,ini=''){
  try{
    const profile=androidToolchainProfile(version);
    return {supported:true,engineVersion:String(version),ndkRevision:profile.ndk,ndkName:profile.ndkName,compileSdk:profile.sdk,ndkApi:'android-29',javaMajor:profile.java,
      api:{auto:{minSdk:iniValue(ini,androidSection,'MinSDKVersion')||'29',targetSdk:iniValue(ini,androidSection,'TargetSDKVersion')||'29'},api29:{minSdk:'29',targetSdk:'29'}}};
  }catch(error){return {supported:false,engineVersion:String(version||''),message:error.message};}
}

export async function discoverAndroidPlugins(projectRoot,engineRoot){
  const found=new Map();
  async function walk(folder){
    if(!await exists(folder))return;
    const entries=await fs.readdir(folder,{withFileTypes:true});
    for(const entry of entries){
      if(entry.isSymbolicLink())continue;
      if(entry.isFile()&&entry.name.endsWith('.uplugin')){
        const name=path.basename(entry.name,'.uplugin');if(!pluginNames.some(n=>n.toLowerCase()===name.toLowerCase()))continue;
        const file=path.join(folder,entry.name),descriptor=await readJson(file);found.set(name.toLowerCase(),{name,file,descriptor});
      }
    }
    // A plugin's Content/Source tree cannot contain another discoverable plugin.
    if(entries.some(e=>e.isFile()&&e.name.endsWith('.uplugin')))return;
    for(const entry of entries)if(entry.isDirectory()&&!excluded.has(entry.name.toLowerCase()))await walk(path.join(folder,entry.name));
  }
  await walk(path.join(engineRoot,'Engine/Plugins'));await walk(path.join(projectRoot,'Plugins'));
  return found;
}

export function resolveAndroidXr(descriptor,plugins,target,minor){
  const explicit=name=>(descriptor.Plugins||[]).find(p=>p.Name?.toLowerCase()===name.toLowerCase());
  const installed=name=>plugins.get(name.toLowerCase());
  const enabled=name=>explicit(name)?.Enabled??installed(name)?.descriptor.EnabledByDefault===true;
  const need=name=>{const plugin=installed(name);if(!plugin)throw Error('缺少 '+name+' 插件，请安装与当前 UE 版本匹配的插件后重试');
    const declared=String(plugin.descriptor.EngineVersion||'').match(/^(\d+)\.(\d+)/);
    if(declared&&(Number(declared[1])!==5||Number(declared[2])!==minor))throw Error(name+' 插件与当前 UE 5.'+minor+' 不匹配');
    const platforms=plugin.descriptor.SupportedTargetPlatforms;
    if(Array.isArray(platforms)&&!platforms.includes('Android'))throw Error(name+' 插件未声明支持 Android');
    return plugin.name;};
  if(enabled('PICOOpenXR')&&enabled('PICOXR'))throw Error('PICO OpenXR 与 PICOXR 不能同时启用，请保留项目使用的一条路线');
  const changes=[];let route='OpenXR';
  if(enabled('PICOXR')){
    if(target!=='pico')throw Error('当前项目使用 PICOXR；通用包和 Quest 包需要 OpenXR 路线，不能自动移除已有 PICOXR 功能依赖');
    if(explicit('OpenXR')?.Enabled===true||explicit('OpenXRHandTracking')?.Enabled===true)throw Error('当前 PICOXR 与 OpenXR 依赖同时启用，请先确认项目使用 PICOXR 还是 PICO OpenXR');
    changes.push({Name:need('PICOXR'),Enabled:true},{Name:'OpenXR',Enabled:false});route='PICOXR';
  }else{
    changes.push({Name:need('OpenXR'),Enabled:true});
    if(target!=='quest'){
      if(installed('PICOOpenXR')){changes.push({Name:need('PICOOpenXR'),Enabled:true},{Name:'PICOXR',Enabled:false});route='PICO OpenXR';}
      else if(minor>=8&&installed('PICOController')){changes.push({Name:need('PICOController'),Enabled:true});route='UE OpenXR + PICO Controller';}
      else if(target==='pico'&&installed('PICOXR')&&!explicit('OpenXR')?.Enabled&&!explicit('OpenXRHandTracking')?.Enabled){
        changes.splice(0,changes.length,{Name:'OpenXR',Enabled:false},{Name:need('PICOXR'),Enabled:true});route='PICOXR';
      }else throw Error('PICO 打包需要匹配当前 UE 的 PICO OpenXR 或 PICOXR 插件；当前 OpenXR 项目优先安装 PICO OpenXR');
    }
    if(target==='universal'&&(enabled('OculusXR')||enabled('OculusVR')))throw Error('通用包需要确认 Meta XR 已使用 UE Native OpenXR 后端；当前无法自动确认，请先单独打包或核对该插件配置');
  }
  return {route,changes};
}

async function automationCommand(engineRoot){
  const automation=path.join(engineRoot,'Engine/Binaries/DotNET/AutomationTool/AutomationTool.dll');
  if(!await exists(automation))throw Error('当前引擎缺少 AutomationTool，请安装完整 Android 打包组件');
  const base=path.join(engineRoot,'Engine/Binaries/ThirdParty/DotNet'),candidates=[];
  if(await exists(base)){
    candidates.push(path.join(base,'Windows/dotnet.exe'),path.join(base,'windows/dotnet.exe'));
    for(const version of (await fs.readdir(base)).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true})))for(const arch of ['windows','win-x64','Windows'])candidates.push(path.join(base,version,arch,'dotnet.exe'));
  }
  const runtime=(await Promise.all(candidates.map(async file=>await exists(file)?file:null))).find(Boolean);
  if(!runtime)throw Error('当前引擎缺少自带的 .NET 运行时');
  return {file:runtime,automation};
}

export async function runAndroidAutomation(file,args,{cwd,env,onOutput}){
  return new Promise((resolve,reject)=>{
    const child=spawn(file,args,{cwd,env,shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
    for(const stream of [child.stdout,child.stderr]){const decoder=new StringDecoder('utf8');let pending='';stream.on('data',buffer=>{pending+=decoder.write(buffer);const lines=pending.split(/\r?\n/);pending=lines.pop();for(const line of lines)onOutput(line+'\n');});stream.on('end',()=>{pending+=decoder.end();if(pending)onOutput(pending+'\n');});}
    child.once('error',reject);child.once('close',code=>resolve({code}));
  });
}

async function selectToolchain(settings,profile){
  const configured=settings.sdk||{},roots=[configured.SDKPath,process.env.ANDROID_HOME,process.env.ANDROID_SDK_ROOT,path.join(process.env.LOCALAPPDATA||'','Android/Sdk')].filter(Boolean).map(clean);
  const sdk=(await Promise.all(roots.map(async dir=>await exists(path.join(dir,'platforms','android-'+profile.sdk,'android.jar'))?dir:null))).find(Boolean);
  if(!sdk)throw Error('缺少编译 SDK android-'+profile.sdk+'，请在 SDK 设置中配置对应 Android SDK');
  const ndks=[configured.NDKPath,path.join(sdk,'ndk',profile.ndk),process.env.NDKROOT,process.env.ANDROID_NDK_HOME].filter(Boolean).map(clean);
  let ndk='';for(const dir of ndks){try{const revision=(await fs.readFile(path.join(dir,'source.properties'),'utf8')).match(/^Pkg\.Revision\s*=\s*(.+)$/m)?.[1].trim();if(revision===profile.ndk&&await exists(path.join(dir,'toolchains/llvm/prebuilt/windows-x86_64/bin/clang++.exe'))){ndk=dir;break;}}catch{}}
  if(!ndk)throw Error('缺少匹配的 NDK '+profile.ndk+'，请在 SDK 设置中选择该版本');
  const javas=[configured.JavaPath,process.env.JAVA_HOME,'C:/Program Files/Android/Android Studio/jbr'];
  for(const base of ['C:/Program Files/Eclipse Adoptium','C:/Program Files/Java'])if(await exists(base))for(const name of await fs.readdir(base))javas.push(path.join(base,name));
  let java='';for(const dir of javas.filter(Boolean).map(clean)){try{const version=(await fs.readFile(path.join(dir,'release'),'utf8')).match(/^JAVA_VERSION="(\d+)/m)?.[1];if(Number(version)===profile.java&&await exists(path.join(dir,'bin/java.exe'))){java=dir;break;}}catch{}}
  if(!java)throw Error('缺少 JDK '+profile.java+'，请在 SDK 设置中选择匹配的 JDK');
  if(!await exists(path.join(sdk,'build-tools')))throw Error('Android SDK 缺少 Build-tools');
  return {sdk,ndk,java};
}

export const liveCodingPackagingMessage='UE 编译器报告 Live Coding 模块冲突：本次构建需要更新正在使用的模块。请先保存工程，结束 Live Coding 会话或正常关闭对应编辑器后重试；普通 Android 打包允许编辑器保持打开。';
export function androidPackagingFailure(log,code){
  if(/AndroidManifest\.xml is invalid|XmlException/i.test(log)&&/PersonalDevPlatform:PICO/.test(log))return 'Android 启动入口配置格式错误，导致 Manifest 无法解析；请使用修复版本重新打包，平台会替换之前生成的 PICO 入口配置';
  if(/Unable to build while Live Coding is active/i.test(log))return liveCodingPackagingMessage;
  if(/__has_feature/.test(log)&&/error C(?:4668|4067)/.test(log))return 'Windows 编辑器模块编译失败：当前 MSVC 与旧版 UE 不兼容。请在 Visual Studio Installer 安装该 UE 支持的 MSVC 工具链（UE 5.3 可使用 v143 14.38），再重试';
  if(/(?:fatal error C1083|ld\.lld: error: cannot open)/i.test(log)&&/(?:No such file or directory|unspecified system_category error)/i.test(log))return '原生编译器无法读取构建中间文件，请检查临时构建路径兼容性（中文路径或路径过长）；展开日志可查看具体文件';
  return 'UE 打包失败（退出码 '+code+'），请展开日志查看原因';
}
export async function canUseInstalledEditor(source,eng){
  if(source.descriptor.Modules?.length||!await exists(path.join(eng.root,'Engine/Build/InstalledBuild.txt'))||!await exists(path.join(eng.root,'Engine/Binaries/Win64/UnrealEditor-Cmd.exe')))return false;
  async function hasNativeCode(folder,plugins=false){
    if(!await exists(folder))return false;
    for(const entry of await fs.readdir(folder,{withFileTypes:true})){
      if(entry.isSymbolicLink())return true;
      if(excluded.has(entry.name.toLowerCase()))continue;
      const file=path.join(folder,entry.name);
      if(entry.isFile()&&(plugins?entry.name.endsWith('.uplugin')&&(await readJson(file)).Modules?.length:/\.(?:cpp|c|h|hpp|build\.cs|target\.cs)$/i.test(entry.name)))return true;
      if(entry.isDirectory()&&(!plugins||!['source','content','binaries'].includes(entry.name.toLowerCase()))&&await hasNativeCode(file,plugins))return true;
    }
    return false;
  }
  return !await hasNativeCode(path.join(source.projectRoot,'Source'))&&!await hasNativeCode(path.join(source.projectRoot,'Plugins'),true);
}
export function picoLauncherSettings(text,mode='library'){
  let raw=iniValue(text,androidSection,'ExtraActivitySettings');try{raw=JSON.parse(raw);}catch{}let extra=String(raw||'').replace(/<!-- PersonalDevPlatform:PICO -->[\s\S]*?<!-- \/PersonalDevPlatform:PICO -->/g,'').trim();
  if(mode==='library')extra+='<!-- PersonalDevPlatform:PICO -->'+(/<meta-data\b[^>]*android:name\s*=\s*["']pvr\.app\.type["']/.test(extra)?'':'<meta-data android:name="pvr.app.type" android:value="vr" />')+'<!-- /PersonalDevPlatform:PICO -->';
  // UBT strips only enclosing quotes; it does not JSON-unescape embedded XML quotes.
  return {section:androidSection,key:'ExtraActivitySettings',value:extra};
}
export function activityPackagingSettings(target,activity='auto'){
  if(!['auto','game','splash'].includes(activity))throw Error('启动入口选项无效');
  if(activity==='splash'&&target==='quest')throw Error('Quest 不支持本项 SplashActivity 测试，请选择自动或 GameActivity');
  const values={bPackageForMetaQuest:target==='pico'||activity==='splash'?'False':'True'};
  values.bShowLaunchImage=activity==='splash'?'True':'False';
  return Object.entries(values).map(([key,value])=>({section:androidSection,key,value}));
}
export function createAndroidPackaging({root,project,engine,settings,isBusy=()=>false,preparePackage=async()=>({distribution:false,signingMode:'debug',secrets:[]}),verifyPackage=async()=>null,installPackage=async()=>({status:'skipped',message:'USB 自动安装未配置'}),identityBusy=()=>false,mapBuildWorkspace=createBuildWorkspacePath,launcher,runner=runAndroidAutomation}){
  const base=path.join(root,'.local/ue-manager/android-packaging'),jobs=new Map(),finishing=new Set();let starting=false;
  const fileFor=id=>{if(!/^[\da-f-]{36}$/i.test(String(id)))throw Error('打包任务无效');return path.join(base,id,'status.json');};
  let persistQueue=Promise.resolve();
  function persist(job){const {log,...record}=structuredClone(job);const pending=persistQueue.catch(()=>{}).then(async()=>{await fs.mkdir(path.dirname(fileFor(job.id)),{recursive:true});const temporary=fileFor(job.id)+'.tmp';await fs.writeFile(temporary,JSON.stringify(record,null,2));await fs.rename(temporary,fileFor(job.id));});persistQueue=pending;return pending;}
  async function job(id){if(jobs.has(id))return structuredClone(jobs.get(id));let saved;try{saved=await readJson(fileFor(id));}catch(e){if(e.code==='ENOENT')return {id,status:'failed',message:'打包任务不存在，请重新开始'};throw e;}
    if(saved.status==='running')return {...saved,status:'failed',message:saved.mode==='direct'?'上次打包已中断，请重新开始；已应用的工程打包配置保留':'上次打包已中断，请重新开始；原工程保持不变'};
    let log='';try{const handle=await fs.open(path.join(base,id,'build.log'),'r');try{const stat=await handle.stat(),buffer=Buffer.alloc(Math.min(stat.size,24000));await handle.read(buffer,0,buffer.length,Math.max(0,stat.size-buffer.length));log=buffer.toString('utf8');}finally{await handle.close();}}catch{}
    if(saved.status==='failed'){const diagnosis=androidPackagingFailure(log,'未知');if(!diagnosis.startsWith('UE 打包失败'))saved.message=diagnosis;}
    return {...saved,log};
  }
  async function latest(projectId){try{const record=await readJson(path.join(base,'latest-'+crypto.createHash('sha256').update(projectId).digest('hex').slice(0,20)+'.json'));return await job(record.id);}catch{return null;}}
  async function start(request){
    if(starting||finishing.size||identityBusy()||isBusy()||[...jobs.values()].some(j=>j.status==='running'))throw Error('已有工程任务正在执行，请完成后再打包');
    if(!['pico','quest','universal'].includes(request.target))throw Error('请选择 Quest、PICO 或通用平台');
    if(!['Development','Shipping'].includes(request.configuration||'Development'))throw Error('构建配置无效');
    if(!['auto','api29'].includes(request.apiPolicy||'auto'))throw Error('API 策略无效');
    const activityEntries=activityPackagingSettings(request.target,request.activity||'auto');
    starting=true;
    try{
      const source=await project(request.id);
      const eng=await engine(source);if(!eng)throw Error('未找到当前项目关联的 UE 引擎，请检查引擎安装路径');
      const profile=androidToolchainProfile(eng.version),plugins=await discoverAndroidPlugins(source.projectRoot,eng.root),xr=resolveAndroidXr(source.descriptor,plugins,request.target,profile.minor);
      const useInstalledEditor=await canUseInstalledEditor(source,eng);
      if(source.descriptor.AdditionalPluginDirectories?.length)throw Error('当前工程使用外部插件目录，请先将打包所需插件放入工程 Plugins 后重试');
      const current=await settings(request.id),toolchain=await selectToolchain(current,profile),command=await automationCommand(eng.root),signing=await preparePackage(source,{coverImage:request.coverImage,incrementVersion:true});
      const defaultOutput=path.join(root,'.local/android-packages');
      const outputRoot=request.outputRoot||defaultOutput;if(!path.isAbsolute(outputRoot))throw Error('打包输出目录必须为完整路径');
      let ancestor=path.resolve(outputRoot);while(!await exists(ancestor))ancestor=path.dirname(ancestor);
      const checkedOutput=path.resolve(await fs.realpath(ancestor),path.relative(ancestor,path.resolve(outputRoot)));
      if(inside(source.projectRoot,checkedOutput))throw Error('请选择当前工程以外的打包输出目录');
      await fs.mkdir(checkedOutput,{recursive:true});const realOutput=await fs.realpath(checkedOutput);
      if(inside(source.projectRoot,realOutput))throw Error('请选择当前工程以外的打包输出目录');
      const sourceDescriptor=await fs.readFile(source.descriptorPath);
      if(JSON.stringify(JSON.parse(decodeIni(sourceDescriptor).text))!==JSON.stringify(source.descriptor))throw Error('工程描述已更新，请重试');
      let sourceIni=Buffer.alloc(0);try{sourceIni=await fs.readFile(path.join(source.projectRoot,'Config/DefaultEngine.ini'));}catch(e){if(e.code!=='ENOENT')throw e;}
      const id=crypto.randomUUID(),work=source.projectRoot,output=path.join(realOutput,path.parse(source.descriptorPath).name+'_'+request.target);
      const outputRecordFile=path.join(base,'outputs',crypto.createHash('sha256').update(output.toLowerCase()).digest('hex')+'.json');
      let outputRecord;try{outputRecord=await readJson(outputRecordFile);}catch(error){if(error.code!=='ENOENT')throw error;}
      if(await exists(output)){
        if((await fs.lstat(output)).isSymbolicLink()||!inside(realOutput,await fs.realpath(output)))throw Error('固定打包目录不能使用链接路径');
        if(outputRecord?.descriptorPath?.toLowerCase()!==source.descriptorPath.toLowerCase()&&(await fs.readdir(output)).length)throw Error('固定打包目录已存在且未关联当前工程，请更换打包路径：'+output);
      }else await fs.mkdir(output,{recursive:false});
      if(outputRecord&&outputRecord.descriptorPath.toLowerCase()!==source.descriptorPath.toLowerCase())throw Error('此打包目录属于其他工程，请更换打包路径');
      // Replace only APKs recorded from our earlier build of this exact project/output.
      for(const file of outputRecord?.artifacts||[]){if(!inside(output,file)||path.extname(file).toLowerCase()!=='.apk')throw Error('打包目录记录异常');if(await exists(file)){if((await fs.lstat(file)).isSymbolicLink()||!inside(output,await fs.realpath(file)))throw Error('旧安装包存在链接跳转');await fs.unlink(file);}}
      const recordOutput=async artifacts=>{await fs.mkdir(path.dirname(outputRecordFile),{recursive:true});const temporary=outputRecordFile+'.tmp';await fs.writeFile(temporary,JSON.stringify({descriptorPath:source.descriptorPath,outputRoot:output,artifacts}));await fs.rename(temporary,outputRecordFile);};
      await recordOutput([]);
      const task={id,projectId:request.id,target:request.target,activity:request.activity||'auto',configuration:request.configuration||'Development',status:'running',progress:packagingProgress('prepare'),mode:'direct',descriptorPath:source.descriptorPath,message:'正在配置当前工程…',outputRoot:output,route:xr.route,signingMode:signing.signingMode,certificateFingerprint:signing.fingerprint,versionCode:signing.identity?.versionCode,picoLauncher:current.packageIdentity?.picoLauncher||'library',autoInstall:request.autoInstall===true,log:'',startedAt:new Date().toISOString()};jobs.set(id,task);
      task.storeVersion=signing.identity?.storeVersion;await persist(task);await fs.writeFile(path.join(base,'latest-'+crypto.createHash('sha256').update(request.id).digest('hex').slice(0,20)+'.json'),JSON.stringify({id}));
      const secrets=[...(signing.secrets||[])];
      // Passwords are read only for log redaction and never returned to the renderer.
      const format=decodeIni(sourceIni);for(const key of ['KeyStorePassword','KeyPassword']){const value=clean(iniValue(format.text,androidSection,key));if(value)secrets.push(value);}
      let logQueue=Promise.resolve(),logError=null,lastProgressSaved=0;const writeLog=text=>{let line=redactConfig(String(text));for(const secret of secrets)line=line.split(secret).join('••••••');task.log=(task.log+line).slice(-24000);const next=progressFromBuildLog(line,task.progress);if(JSON.stringify(next)!==JSON.stringify(task.progress)){task.progress=next;task.message=next.label+(next.detail?'：'+next.detail:'…');if(Date.now()-lastProgressSaved>1000){lastProgressSaved=Date.now();void persist(task).catch(error=>{logError=error;});}}logQueue=logQueue.then(()=>fs.appendFile(path.join(base,id,'build.log'),line)).catch(error=>{logError=error;});};
      let buildAlias;
      void (async()=>{
        try{
          writeLog('目标：'+request.target+'；XR：'+xr.route+'；UE：'+eng.version+'\n');
          writeLog('直接使用所选工程：'+source.descriptorPath+'；源工程与衍生工程均可打包，不复制工程资源\n');
          const descriptorName=path.basename(source.descriptorPath),descriptorBytes=sourceDescriptor;
          if(!(await fs.readFile(source.descriptorPath)).equals(descriptorBytes))throw Error('准备期间工程描述发生变化，请保存后重新打包');
          const stagedDescriptor=structuredClone(source.descriptor);stagedDescriptor.Plugins=stagedDescriptor.Plugins||[];
          for(const change of xr.changes){const existing=stagedDescriptor.Plugins.find(p=>p.Name.toLowerCase()===change.Name.toLowerCase());if(existing)existing.Enabled=change.Enabled;else stagedDescriptor.Plugins.push(change);}
          task.questHandTracking=needsQuestHandTracking(stagedDescriptor,request.target);
          const handFiles=[];
          for(const relative of ['Build/Android/ManifestRequirementsOverride.txt','Build/Android/ManifestRequirementsAdditions.txt']){const file=await checkedConfigFile(work,relative),before=await fs.readFile(file).catch(e=>{if(e.code==='ENOENT')return null;throw e;});handFiles.push({relative,before,format:decodeIni(before||Buffer.alloc(0))});}
          const handTarget=handFiles[0].before!==null?handFiles[0]:handFiles[1];
          const handChanges=handFiles.flatMap(f=>{const text=questHandRequirements(f.format.text,task.questHandTracking&&f===handTarget);return text===f.format.text?[]:[{relative:f.relative,before:f.before,after:encodeIni(text,f.format)}];});
          const entries=[...Object.entries({bBuildForArm64:'True',bBuildForArmV7:'False',bBuildForX8664:'False',bEnableBundle:'False',bPackageDataInsideApk:'True',SDKAPILevelOverride:'android-'+profile.sdk,NDKAPILevelOverride:'android-29'}).map(([key,value])=>({section:androidSection,key,value})),...activityEntries];
          if(request.target==='pico'||task.activity==='splash')entries.push({section:androidSection,key:'!PackageForOculusMobile',value:'ClearArray'});
          const launcherMode=request.target==='quest'?'preserve':task.picoLauncher;
          // Preserve project render/MR settings and the project's target API unless the user selects API 29.
          entries.push({section:'/Script/EngineSettings.GeneralProjectSettings',key:'bStartInVR',value:'True'});
          if(xr.route==='PICO OpenXR'&&stagedDescriptor.Plugins.some(plugin=>plugin.Name==='OpenXRHandTracking'&&plugin.Enabled===true))entries.push({section:'/Script/PICOOpenXRRuntimeSettings.PICOOpenXRRuntimeSettings',key:'bIsHandTrackingUsed',value:'True'});
          const api=androidPackagingInfo(eng.version,format.text).api[request.apiPolicy||'auto'];
          entries.push({section:androidSection,key:'MinSDKVersion',value:api.minSdk},{section:androidSection,key:'TargetSDKVersion',value:api.targetSdk});
          for(const [key,value] of Object.entries({SDKPath:'(Path="'+toolchain.sdk.replaceAll('\\','/')+'")',NDKPath:'(Path="'+toolchain.ndk.replaceAll('\\','/')+'")',JavaPath:'(Path="'+toolchain.java.replaceAll('\\','/')+'")',SDKAPILevel:'android-'+profile.sdk,NDKAPILevel:'android-29'}))entries.push({section:sdkSection,key,value});
          // UE reads per-project overrides after the user's global Android SDK preferences.
          // Also pin the Android platform layer, which may have been copied from the source.
          const androidIni=await checkedConfigFile(work,'Config/Android/AndroidEngine.ini');
          const platformBefore=await fs.readFile(androidIni).catch(error=>{if(error.code==='ENOENT')return null;throw error;}),platformFormat=decodeIni(platformBefore||Buffer.alloc(0));
          entries.push(picoLauncherSettings(iniValue(platformFormat.text,androidSection,'ExtraActivitySettings')?platformFormat.text:format.text,launcherMode));
          const defaultFile=await checkedConfigFile(work,'Config/DefaultEngine.ini'),defaultExists=await exists(defaultFile);
          await applyDirectConfiguration(work,[
            {relative:descriptorName,before:descriptorBytes,after:Buffer.from(JSON.stringify(stagedDescriptor,null,2))},
            {relative:'Config/DefaultEngine.ini',before:defaultExists?sourceIni:null,after:encodeIni(mergeIni(format.text,entries),format)},
            {relative:'Config/Android/AndroidEngine.ini',before:platformBefore,after:encodeIni(mergeIni(platformFormat.text,entries),platformFormat)},...handChanges
          ],path.join(base,id,'config-before'),id);
          writeLog('计划生效参数：编译 SDK android-'+profile.sdk+'；NDK API android-29；Min SDK '+api.minSdk+'；Target SDK '+api.targetSdk+'\n');
          writeLog('构建类型：'+task.configuration+'；启动入口：'+task.activity+'。请勿在 Cook 期间保存蓝图或资源，否则可能混入不同时间的修改。\n');
          if(task.questHandTracking)writeLog('Quest 手势：检测到已启用 OpenXRHandTracking，补充 HAND_TRACKING 权限与手势功能声明；控制器与手势均可用。运行时交互仍取决于工程的手势实现。\n');
          if(task.activity==='splash'&&request.target==='universal')writeLog('提示：SplashActivity 为 PICO 启动入口测试，已关闭 Quest 专用打包标记；本次包的 Quest 兼容性待实机验证。\n');
          buildAlias=await mapBuildWorkspace(work);
          const buildDescriptor=path.join(buildAlias.root,descriptorName),buildTemp=path.join(buildAlias.root,'Intermediate/PlatformPackagingTemp');await fs.mkdir(buildTemp,{recursive:true});
          writeLog('原生构建路径：'+buildAlias.root+'（仅路径映射，直接访问所选工程；构建结束后释放）\n');
          if(useInstalledEditor)writeLog('纯蓝图工程使用已安装的 UE 编辑器进行 Cook，仅编译 Android 目标，无需重编译 Windows 编辑器\n');
          task.progress=packagingProgress('build',task.progress);task.message='正在后台打包 '+request.target+' APK…';await persist(task);
          const automationLogs=path.join(base,id,'uat-logs');
          const env={...process.env,ANDROID_HOME:toolchain.sdk,ANDROID_SDK_ROOT:toolchain.sdk,NDKROOT:toolchain.ndk,NDK_ROOT:toolchain.ndk,ANDROID_NDK_HOME:toolchain.ndk,JAVA_HOME:toolchain.java,DOTNET_ROOT:path.dirname(command.file),TEMP:buildTemp,TMP:buildTemp,uebp_LogFolder:automationLogs,uebp_FinalLogFolder:automationLogs,PATH:path.join(toolchain.java,'bin')+path.delimiter+process.env.PATH};
          writeLog('签名：'+(signing.distribution?'自定义发行签名，证书 '+signing.fingerprint:'Android 调试签名')+'\n');
          const result=await runner(command.file,[command.automation,'BuildCookRun','-project='+buildDescriptor,'-nop4','-unattended','-utf8output','-platform=Android','-cookflavor=ASTC','-clientconfig='+(request.configuration||'Development'),...(signing.distribution?['-distribution']:[]),...(useInstalledEditor?['-nocompileeditor','-unrealexe=UnrealEditor-Cmd.exe']:[]),'-build','-cook','-stage','-pak','-package','-archive','-archivedirectory='+output],{cwd:eng.root,env,onOutput:writeLog});
          await buildAlias.release();buildAlias=null;
          await logQueue;if(logError)throw Error('打包日志写入失败：'+logError.message);if(result.code!==0)throw Error(androidPackagingFailure(task.log,result.code));
          const artifacts=[];async function find(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){if(entry.isSymbolicLink())continue;const file=path.join(dir,entry.name);if(entry.isDirectory())await find(file);else if(entry.name.toLowerCase().endsWith('.apk')){const handle=await fs.open(file,'r');try{const signature=Buffer.alloc(2);await handle.read(signature,0,2,0);if(signature.toString()!=='PK')throw Error('生成的 APK 文件格式异常');}finally{await handle.close();}artifacts.push(file);}}}await find(output);
          if(!artifacts.length)throw Error('UE 未生成 APK，请检查是否启用了其他输出格式');
          await recordOutput(artifacts);
          task.progress=packagingProgress('verify',task.progress);task.message='正在核验 APK 名称、图标、版本与签名…';await persist(task);
          const verification=await verifyPackage(artifacts,source,toolchain,signing,{target:request.target,launcher:task.picoLauncher,activity:task.activity,questHandTracking:task.questHandTracking});if(verification){task.verification=verification;for(const warning of verification.warnings||[])writeLog('检查提示：'+warning+'\n');}
          task.artifacts=artifacts;
          if(task.autoInstall){task.progress=packagingProgress('install',task.progress);task.message='APK 已通过核验，正在检查 USB 设备并安装…';await persist(task);try{task.installation=await installPackage(source.id,artifacts,verification,{target:request.target});}catch(error){task.installation={status:'failed',message:error.message};}writeLog('USB 自动安装：'+task.installation.message+'\n');}
          task.status='complete';task.progress=packagingProgress('complete',task.progress);task.message=task.installation?.status==='complete'?'APK 打包完成，'+task.installation.message:task.installation?.status==='failed'?'APK 打包完成，USB 安装失败：'+task.installation.message:task.installation?'APK 打包完成；'+task.installation.message:'APK 打包完成；设备兼容性待实机验证';
        }catch(error){task.status='failed';task.message=error.message;writeLog('\n'+error.message+'\n');}
        finally{finishing.add(id);try{if(buildAlias)await buildAlias.release().catch(error=>writeLog('临时构建盘符释放失败：'+error.message+'\n'));await logQueue.catch(()=>{});task.finishedAt=new Date().toISOString();await persist(task);}finally{finishing.delete(id);}}
      })().catch(async error=>{task.status='failed';task.message=error.message;await persist(task).catch(()=>{});});
      return structuredClone(task);
    }finally{starting=false;}
  }
  async function open(id){const task=await job(id);if(task.status!=='complete')throw Error('该任务尚未生成可用安装包');return launcher(task.outputRoot);}
  return {start,job,latest,open,runningJobs:()=>[...jobs.values()].filter(job=>job.status==='running'||finishing.has(job.id))};
}
