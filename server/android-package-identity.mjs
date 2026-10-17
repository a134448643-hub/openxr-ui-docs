import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';
import {decodeIni,encodeIni,mergeIni,iniValue,androidSection,sdkSection} from './ue-ini.mjs';
import {checkedConfigFile,applyDirectConfiguration} from './ue-android-packaging.mjs';
import {readApkEntry,sameAndroidIcon} from './apk-resources.mjs';
import {inspectAndroidManifest} from './android-manifest-info.mjs';
import {automaticAndroidPackageName} from './android-package-name.mjs';
const packagingSection='/Script/UnrealEd.ProjectPackagingSettings',platformSection='PersonalDevPlatform.AndroidPackaging';
const clean=value=>{const text=String(value||'');return text.startsWith('"')&&text.endsWith('"')?text.slice(1,-1):text;};
const quoted=value=>'"'+String(value)+'"';
const scalar=(v,label,max=256)=>{if(typeof v!=='string'||v.length>max||/[\x00-\x1f\x7f]/.test(v))throw Error(label+'格式无效');return v;};
const exists=async file=>{try{await fs.access(file);return true;}catch{return false;}};
export async function makeAndroidIcons(file,{cover=false}={}){
 let bytes;if(cover){if(typeof file!=='string'||file.length>6*1024*1024||!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(file))throw Error('项目封面图片格式无效');bytes=Buffer.from(file.slice(file.indexOf(',')+1),'base64');}
 else{if(typeof file!=='string'||!path.isAbsolute(file)||!(/\.(png|jpe?g|webp)$/i.test(file)))throw Error('请选择 PNG、JPG 或 WebP 图标');const stat=await fs.stat(file);if(!stat.isFile()||stat.size>16*1024*1024)throw Error('图标文件必须小于 16 MB');bytes=await fs.readFile(file);}
 const {nativeImage}=await import('electron');let img=nativeImage.createFromBuffer(bytes);if(img.isEmpty())throw Error('无法读取图标图片');const dimensions=img.getSize();if(dimensions.width>8192||dimensions.height>8192||!cover&&(dimensions.width!==dimensions.height||dimensions.width<192))throw Error('请选择 192–8192 像素的正方形应用图标');
 if(cover){const size=Math.min(dimensions.width,dimensions.height);img=img.crop({x:Math.floor((dimensions.width-size)/2),y:Math.floor((dimensions.height-size)/2),width:size,height:size});}
 return [['drawable',192],['drawable-ldpi',36],['drawable-mdpi',48],['drawable-hdpi',72],['drawable-xhdpi',96],['drawable-xxhdpi',144],['drawable-xxxhdpi',192]].map(([folder,size])=>({relative:'Build/Android/res/'+folder+'/icon.png',after:img.resize({width:size,height:size,quality:'best'}).toPNG()}));
}
export function createAndroidPackageIdentity({root,project,runner,isBusy=()=>false,imageProcessor=makeAndroidIcons,imageComparator=sameAndroidIcon}){
 let writing=false;
 async function context(id){const p=await project(id),files=[];for(const relative of ['Config/DefaultEngine.ini','Config/Android/AndroidEngine.ini','Config/DefaultGame.ini','Config/Android/AndroidGame.ini']){const file=await checkedConfigFile(p.projectRoot,relative),before=await fs.readFile(file).catch(e=>{if(e.code==='ENOENT')return null;throw e;});files.push({relative,before,format:decodeIni(before||Buffer.alloc(0))});}
  const value=(section,key)=>{let result='';for(const f of files){const v=iniValue(f.format.text,section,key);if(v!=='')result=clean(v);}return String(result);};return {p,files,value};
 }
 async function get(id){const c=await context(id),v=c.value;let icon=null;const iconFile=await checkedConfigFile(c.p.projectRoot,'Build/Android/res/drawable/icon.png');try{const bytes=await fs.readFile(iconFile);if(bytes.length<512000)icon='data:image/png;base64,'+bytes.toString('base64');}catch{}
  const projectName=path.basename(c.p.descriptorPath,'.uproject').replace(/[^A-Za-z0-9_]/g,'_'),autoPackageName=v(platformSection,'AutoPackageName')!=='False',suggestedPackageName=v(platformSection,'GeneratedPackageName')||automaticAndroidPackageName(c.p.descriptorPath);return {editable:true,name:v(androidSection,'ApplicationDisplayName')||path.basename(c.p.descriptorPath,'.uproject'),autoPackageName,suggestedPackageName,packageName:autoPackageName?suggestedPackageName:(v(androidSection,'PackageName')||'com.YourCompany.[PROJECT]').replaceAll('[PROJECT]',/^[A-Za-z]/.test(projectName)?projectName:'Project_'+projectName),version:v(androidSection,'StoreVersion')||'1',autoVersion:v(platformSection,'AutoVersion')!=='False',icon,iconSource:v(platformSection,'IconSource')==='custom'?'custom':'project',signingMode:/^(true|1)$/i.test(v(packagingSection,'ForDistribution'))?'custom':'debug',keyStore:v(androidSection,'KeyStore'),keyAlias:v(androidSection,'KeyAlias'),hasStorePassword:!!v(androidSection,'KeyStorePassword'),hasKeyPassword:!!v(androidSection,'KeyPassword'),picoLauncher:v(platformSection,'PicoLauncher')||'library'};
 }
 async function writable(id){if(writing||isBusy())throw Error('有工程任务正在运行，请完成后再修改打包资料');return context(id);}
 async function java(c){const value=c.value(sdkSection,'JavaPath'),jdk=value.match(/^\(Path="(.*)"\)$/)?.[1]||value||process.env.JAVA_HOME;if(!jdk||!await exists(path.join(jdk,'bin/keytool.exe'))||!await exists(path.join(jdk,'bin/jarsigner.exe')))throw Error('请先在 SDK 设置中配置包含 keytool 和 jarsigner 的 JDK');return jdk;}
 async function verifyKey(c,{file,alias,storePassword,keyPassword}){
  scalar(alias,'签名别名',128);if(!alias||alias.startsWith('-'))throw Error('请填写签名别名');if(!storePassword)throw Error('请输入 Keystore 密码');scalar(storePassword,'Keystore 密码');scalar(keyPassword||storePassword,'Key 密码');
  const jdk=await java(c),env={...process.env,UE_PACKAGE_STORE_PASSWORD:storePassword,UE_PACKAGE_KEY_PASSWORD:keyPassword||storePassword};
  const cert=await runner(path.join(jdk,'bin/keytool.exe'),['-exportcert','-rfc','-keystore',file,'-alias',alias,'-storepass:env','UE_PACKAGE_STORE_PASSWORD'],{env,timeout:20000});if(cert.code!==0)throw Error('Keystore 验证失败，请检查文件、别名和密码');let fingerprint;try{const x=new crypto.X509Certificate(cert.stdout);if(Date.parse(x.validTo)<Date.now())throw Error('expired');fingerprint=x.fingerprint256;}catch{throw Error('签名证书无效或已经过期');}
  const dir=path.join(root,'.local/android-signing-checks',crypto.randomUUID());await fs.mkdir(dir,{recursive:true});
  try{const jar=path.join(dir,'check.jar'),empty=Buffer.alloc(22);empty.writeUInt32LE(0x06054b50);await fs.writeFile(jar,empty);const result=await runner(path.join(jdk,'bin/jarsigner.exe'),['-keystore',file,'-storepass:env','UE_PACKAGE_STORE_PASSWORD','-keypass:env','UE_PACKAGE_KEY_PASSWORD',jar,alias],{env,timeout:20000});if(result.code!==0)throw Error('无法使用此私钥签名，请检查 Key 密码和别名是否指向私钥');}
  finally{await fs.rm(dir,{recursive:true,force:true});}return fingerprint;
 }
 async function prepare(source,{coverImage,incrementVersion=false}={}){
  const current=await get(source.id),updates={};
  if(current.autoPackageName){const raw=await context(source.id);if(raw.value(androidSection,'PackageName')!==current.packageName||!raw.value(platformSection,'GeneratedPackageName'))updates.autoPackageName=true;}
  if(current.iconSource==='project'&&coverImage!==undefined)updates.coverImage=coverImage;
  if(incrementVersion&&current.autoVersion){const version=Number(current.version)+1;if(!Number.isSafeInteger(version)||version>2147483647)throw Error('应用版本号已达上限，请调整打包签名设置');updates.version=version;}
  if(Object.keys(updates).length)await save(source.id,updates);
  const c=await context(source.id),identity={name:c.value(androidSection,'ApplicationDisplayName'),packageName:c.value(androidSection,'PackageName'),storeVersion:Number(c.value(androidSection,'StoreVersion')||1),versionCode:Number(c.value(androidSection,'StoreVersion')||1)+Number(c.value(androidSection,'StoreVersionOffsetArm64')||0),icons:[]};
  for(const density of ['','ldpi','mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi']){const file=await checkedConfigFile(c.p.projectRoot,'Build/Android/res/drawable'+(density?'-'+density:'')+'/icon.png');if(await exists(file))identity.icons.push({density,bytes:await fs.readFile(file)});}
  const custom=/^(true|1)$/i.test(c.value(packagingSection,'ForDistribution'));if(!custom)return {distribution:false,signingMode:'debug',secrets:[],identity};const name=c.value(androidSection,'KeyStore');if(path.basename(name)!==name||!name)throw Error('签名文件必须放在当前工程 Build/Android 下');const file=await checkedConfigFile(c.p.projectRoot,'Build/Android/'+name);if(!await exists(file))throw Error('签名文件不存在，请在打包签名入口重新关联');const storePassword=c.value(androidSection,'KeyStorePassword'),keyPassword=c.value(androidSection,'KeyPassword')||storePassword;const fingerprint=await verifyKey(c,{file,alias:c.value(androidSection,'KeyAlias'),storePassword,keyPassword});return {distribution:true,signingMode:'custom',fingerprint,secrets:[storePassword,keyPassword],identity};}
 async function save(id,body){const c=await writable(id);writing=true;try{
  const entries=[],gameEntries=[],icons=[];let fingerprint;
  if(body.name!==undefined){const name=scalar(body.name,'应用名称',80).trim();if(!name)throw Error('应用名称不能为空');entries.push({section:androidSection,key:'ApplicationDisplayName',value:quoted(name)});}
  if(body.autoPackageName!==undefined&&typeof body.autoPackageName!=='boolean')throw Error('自动包名选项无效');
  if(body.autoPackageName===true){const name=c.value(platformSection,'GeneratedPackageName')||automaticAndroidPackageName(c.p.descriptorPath);entries.push({section:androidSection,key:'PackageName',value:name},{section:platformSection,key:'AutoPackageName',value:'True'},{section:platformSection,key:'GeneratedPackageName',value:name});}
  else if(body.packageName!==undefined||body.autoPackageName===false){const name=scalar(body.packageName??(await get(id)).packageName,'应用包名',180);if(!/^[A-Za-z][\w]*(?:\.[A-Za-z][\w]*)+$/.test(name))throw Error('应用包名格式无效');entries.push({section:androidSection,key:'PackageName',value:name},{section:platformSection,key:'AutoPackageName',value:'False'});}
  if(body.version!==undefined){if(!/^\d+$/.test(String(body.version))||!Number.isSafeInteger(Number(body.version))||Number(body.version)>2147483647)throw Error('版本号应为 0–2147483647 的整数');entries.push({section:androidSection,key:'StoreVersion',value:String(Number(body.version))});}
  if(body.autoVersion!==undefined){if(typeof body.autoVersion!=='boolean')throw Error('自动版本号选项无效');entries.push({section:platformSection,key:'AutoVersion',value:body.autoVersion?'True':'False'});}
  if(body.iconSource!==undefined){if(!['custom','project'].includes(body.iconSource))throw Error('图标来源无效');entries.push({section:platformSection,key:'IconSource',value:body.iconSource});}
  if(body.picoLauncher!==undefined){if(!['library','preserve'].includes(body.picoLauncher))throw Error('PICO 入口选项无效');entries.push({section:platformSection,key:'PicoLauncher',value:body.picoLauncher});}
  if(body.iconFile||body.coverImage){if(body.iconFile&&body.coverImage)throw Error('一次只能选择一种图标来源');const processed=await imageProcessor(body.iconFile||body.coverImage,{cover:!!body.coverImage});entries.push({section:platformSection,key:'IconSource',value:body.iconFile?'custom':'project'});for(const icon of processed){if(!/^Build\/Android\/res\/drawable(?:-[a-z]+)?\/icon\.png$/.test(icon.relative))throw Error('图标输出路径无效');const file=await checkedConfigFile(c.p.projectRoot,icon.relative);if(await exists(file.replace(/\.png$/,'.xml')))throw Error('当前图标使用自适应 XML，请先在 UE 中确认图标方案');icons.push({...icon,before:await fs.readFile(file).catch(e=>{if(e.code==='ENOENT')return null;throw e;})});}}
  if(body.signingMode!==undefined){if(!['debug','custom'].includes(body.signingMode))throw Error('签名方式无效');gameEntries.push({section:packagingSection,key:'ForDistribution',value:body.signingMode==='custom'?'True':'False'});
   if(body.signingMode==='custom'){
    const alias=body.keyAlias||c.value(androidSection,'KeyAlias'),storePassword=body.storePassword||c.value(androidSection,'KeyStorePassword'),keyPassword=body.keyPassword||(body.keyFile?storePassword:c.value(androidSection,'KeyPassword'))||storePassword;let file;
    if(body.keyFile){if(typeof body.keyFile!=='string'||!path.isAbsolute(body.keyFile)||!(/\.(keystore|jks)$/i.test(body.keyFile)))throw Error('请选择 .keystore 或 .jks 签名文件');file=await fs.realpath(body.keyFile);}else{const name=c.value(androidSection,'KeyStore');if(!name||path.basename(name)!==name)throw Error('请选择签名文件');file=await checkedConfigFile(c.p.projectRoot,'Build/Android/'+name);}
    const stat=await fs.stat(file);if(!stat.isFile()||!stat.size||stat.size>2*1024*1024)throw Error('签名文件大小无效');const bytes=await fs.readFile(file);if(bytes.length>2*1024*1024)throw Error('签名文件大小发生变化');fingerprint=await verifyKey(c,{file,alias,storePassword,keyPassword});if(!(await fs.readFile(file)).equals(bytes))throw Error('签名文件在验证期间发生变化，请重新选择');const name='release-'+crypto.createHash('sha256').update(bytes).digest('hex').slice(0,16)+'.keystore',target=await checkedConfigFile(c.p.projectRoot,'Build/Android/'+name);const before=await fs.readFile(target).catch(e=>{if(e.code==='ENOENT')return null;throw e;});if(before&&!before.equals(bytes))throw Error('签名文件目标冲突，未覆盖');icons.push({relative:'Build/Android/'+name,before,after:bytes});
    for(const [key,value] of Object.entries({KeyStore:name,KeyAlias:alias,KeyStorePassword:storePassword,KeyPassword:keyPassword}))entries.push({section:androidSection,key,value:quoted(value)});
   }
  }
  const changes=[...icons];for(const f of c.files){const values=f.relative.endsWith('Engine.ini')?entries:gameEntries;if(values.length)changes.push({relative:f.relative,before:f.before,after:encodeIni(mergeIni(f.format.text,values),f.format)});}
  if(!changes.length)throw Error('没有需要保存的打包资料');const token=crypto.randomUUID();await applyDirectConfiguration(c.p.projectRoot,changes,path.join(root,'.local/ue-manager/package-identity-backups',token),token);return {saved:true,fingerprint,identity:await get(id)};
 }finally{writing=false;}}
 async function generate(id,body){const c=await writable(id);writing=true;let directory;try{const jdk=await java(c),alias=scalar(body.alias||'project','签名别名',128),password=scalar(body.password,'签名密码');if(password.length<6)throw Error('签名密码至少需要 6 个字符');if(!/^[A-Za-z][\w.-]{0,63}$/.test(alias))throw Error('签名别名应为英文、数字、点、下划线或连字符');const owner=scalar(body.owner||'Personal Developer','证书主体',80);if(/[,=+<>;"\\]/.test(owner))throw Error('证书主体不能包含逗号、等号或特殊分隔符');
  directory=path.join(root,'.local/android-signing-checks',crypto.randomUUID());await fs.mkdir(directory,{recursive:true});const file=path.join(directory,'new.keystore');const result=await runner(path.join(jdk,'bin/keytool.exe'),['-genkeypair','-noprompt','-storetype','JKS','-keystore',file,'-alias',alias,'-keyalg','RSA','-keysize','2048','-validity','9125','-storepass:env','UE_PACKAGE_STORE_PASSWORD','-keypass:env','UE_PACKAGE_STORE_PASSWORD','-dname','CN='+owner],{env:{...process.env,UE_PACKAGE_STORE_PASSWORD:password},timeout:30000});if(result.code!==0)throw Error('签名文件生成失败，请检查 JDK 与参数');writing=false;return await save(id,{...(body.packageName!==undefined?{packageName:body.packageName}:{}),...(body.version!==undefined?{version:body.version}:{}),...(body.autoVersion!==undefined?{autoVersion:body.autoVersion}:{}),...(body.autoPackageName!==undefined?{autoPackageName:body.autoPackageName}:{}),signingMode:'custom',keyFile:file,keyAlias:alias,storePassword:password,keyPassword:password});
 }finally{writing=false;if(directory)await fs.rm(directory,{recursive:true,force:true});}}
 async function verifyArtifacts(artifacts,source,toolchain,signing,expected){
  const builds=(await fs.readdir(path.join(toolchain.sdk,'build-tools'))).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));let tools;
  for(const name of builds){const folder=path.join(toolchain.sdk,'build-tools',name);if(await exists(path.join(folder,'aapt.exe'))&&await exists(path.join(folder,'lib/apksigner.jar'))){tools=folder;break;}}
  if(!tools)throw Error('APK 已生成，但 SDK 缺少 aapt 或 apksigner，无法核验签名与应用入口');const warnings=[],items=[];
  for(const file of artifacts){const directory=path.dirname(file),alias=path.join(directory,'.ue-package-inspect-'+crypto.randomUUID()+'.apk');let input=path.basename(file),linked=false;
   try{try{await fs.link(file,alias);input=path.basename(alias);linked=true;}catch{}
    const signature=await runner(path.join(toolchain.java,'bin/java.exe'),['-jar',path.join(tools,'lib/apksigner.jar'),'verify','--print-certs',input],{cwd:directory,timeout:60000,maxOutput:64000});if(signature.code!==0)throw Error('APK 已生成，但 Android 签名校验失败');const digest=signature.stdout.match(/certificate SHA-256 digest:\s*([\da-f:]+)/i)?.[1]?.replaceAll(':','').toLowerCase();if(signing.distribution&&digest!==signing.fingerprint.replaceAll(':','').toLowerCase())throw Error('APK 实际签名与所选证书不一致，请核对项目的签名覆盖配置');
    const badging=await runner(path.join(tools,'aapt.exe'),['dump','badging',input],{cwd:directory,timeout:30000,maxOutput:128000}),xml=await runner(path.join(tools,'aapt.exe'),['dump','xmltree',input,'AndroidManifest.xml'],{cwd:directory,timeout:30000,maxOutput:512000});
    const metaBlocks=xml.stdout.split(/(?=^\s*E:)/m).filter(block=>/^\s*E: meta-data\b/.test(block));
    const scope=inspectAndroidManifest(xml.stdout),launcher=!!badging.stdout.match(/launchable-activity:/),picoVr=metaBlocks.some(block=>/android:name[^\n]*"(?:pvr\.app\.type|com\.picovr\.type)"/.test(block)&&/android:value[^\n]*"vr"/.test(block)),oculusVr=/com\.oculus\.intent\.category\.VR/.test(xml.stdout),info=/android\.intent\.category\.INFO/.test(xml.stdout);
    if(expected.questHandTracking&&(!scope.questHandPermission||!scope.questHandFeature))throw Error('Quest 手势声明核验失败：最终 APK 缺少 HAND_TRACKING 权限或 oculus.software.handtracking 功能；请检查插件对 Manifest 的覆盖');
    if(signing.identity?.packageName&&badging.stdout.match(/package: name='([^']+)'/)?.[1]!==signing.identity.packageName)throw Error('APK 实际包名与打包设置不一致，请检查项目插件或平台覆盖配置');
    if(expected.activity&&expected.activity!=='auto'){const suffix=expected.activity==='splash'?'.SplashActivity':'.GameActivity';if(scope.launcherActivities.length!==1||!scope.launcherActivities[0].endsWith(suffix))throw Error('启动入口核验失败：期望 '+suffix.slice(1)+'，实际为 '+(scope.launcherActivities.join('、')||'无入口'));}
    if(expected.activity==='splash'&&expected.target==='universal')warnings.push('SplashActivity 测试已关闭 Quest 专用打包标记；Quest 兼容性待实机验证');
    if(badging.code||xml.code)warnings.push('无法完整读取 APK 应用资料，名称与入口需实机确认');else if(expected.target!=='quest'&&expected.launcher==='library'&&!launcher)warnings.push('最终 APK 没有 MAIN/LAUNCHER 入口，可能被 XR 插件改写；PICO 应用列表显示待确认');
    if(expected.target!=='quest'&&!picoVr&&!oculusVr)warnings.push('最终 APK 未检测到已观察到的 PICO 或 Oculus VR 声明，请核对 XR 插件是否生效');
    if(expected.target!=='quest'&&expected.launcher==='library'&&(!scope.picoActivityVr||!launcher))throw Error('PICO 应用识别核验失败：GameActivity 缺少 VR 类型或应用启动入口；仅有 application 层声明不能通过本项核验');
    const versionCode=Number(badging.stdout.match(/package:.*?versionCode='(\d+)'/)?.[1]);if(signing.identity?.versionCode!==undefined&&versionCode!==signing.identity.versionCode)throw Error('APK 实际版本号与打包设置不一致，请检查版本覆盖配置');
    const name=badging.stdout.match(/^application-label:'(.*)'\r?$/m)?.[1]||'',activityName=badging.stdout.match(/^launchable-activity:.*? label='(.*?)' icon=/m)?.[1];
    if(signing.identity?.name&&(name!==signing.identity.name||activityName&&activityName!==signing.identity.name))throw Error('APK 显示名称与当前设置不一致（实际：'+(activityName||name)+'）；请检查项目或 XR 插件的名称覆盖');
    let iconVerified=false;
    if(signing.identity?.icons?.length){
     if(badging.code||xml.code)throw Error('无法核验最终 APK 的图标，请检查 SDK 工具');
     const entries=new Set([...badging.stdout.matchAll(/^application-icon-\d+:'([^']+)'/gm)].map(m=>m[1]));const activityIcon=badging.stdout.match(/^launchable-activity:.*? icon='([^']+)'/m)?.[1];if(activityIcon)entries.add(activityIcon);
     if(!entries.size)throw Error('无法读取最终 APK 的启动图标，可能被插件改为自适应图标');
     for(const entry of entries){const density=entry.match(/\/(?:drawable|mipmap)-(ldpi|mdpi|hdpi|xhdpi|xxhdpi|xxxhdpi)(?:-|\/)/)?.[1]||'',expectedIcon=signing.identity.icons.find(icon=>icon.density===density);if(!expectedIcon)throw Error('APK 图标尺寸没有对应的已保存图标：'+entry);if(!await imageComparator(expectedIcon.bytes,await readApkEntry(file,entry)))throw Error('APK 启动图标与当前设置不一致，请检查 XR 插件或 Android 图标覆盖');}
     iconVerified=true;
    }
    items.push({file,certificateSha256:digest,signatureVerified:true,name,nameVerified:!!signing.identity?.name,iconVerified,versionCode,packageName:badging.stdout.match(/package: name='([^']+)'/)?.[1]||'',questHandsDeclared:scope.questHandPermission&&scope.questHandFeature,launcher,launcherActivities:scope.launcherActivities,picoVr,picoActivityVr:scope.picoActivityVr,oculusVr,info});
   }finally{if(linked)await fs.unlink(alias);}
  }return {items,warnings};
 }
 return {get,save,generate,prepare,verifyArtifacts,busy:()=>writing};
}
