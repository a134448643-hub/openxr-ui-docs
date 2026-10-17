import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';
import {adbBinary,createMetadataArchive} from './vr-device-media.mjs';
import {readApkEntry} from './apk-resources.mjs';
import {inspectAndroidManifest} from './android-manifest-info.mjs';
export async function verifyInstalledPackage({root,adb,device,expected,file,runner,binary=adbBinary}){
 if(!/^[A-Za-z][\w]*(?:\.[A-Za-z][\w]*)+$/.test(expected.packageName||''))throw Error('安装后核验缺少有效应用包名');
 const location=await runner(adb,['-s',device,'shell','pm path '+expected.packageName],{timeout:15000});
 const apk=location.stdout.split(/\r?\n/).find(s=>s.endsWith('/base.apk'))?.slice(8);
 if(location.code||!apk||!/^\/data\/[^'\r\n\0]+\.apk$/.test(apk))throw Error('ADB 已返回成功，但无法读取设备中的已安装包');
 const entries=[];for(const entry of ['AndroidManifest.xml','resources.arsc']){
  const limit=entry==='AndroidManifest.xml'?2*1024*1024:24*1024*1024;
  const installed=await binary(adb,['-s',device,'exec-out',`unzip -p '${apk}' ${entry}`],limit),local=await readApkEntry(file,entry,limit);
  if(!installed.equals(local))throw Error('设备中的应用资料与本次 APK 不一致，未确认更新成功');entries.push([entry,installed]);
 }
 const folder=path.join(root,'.local/vr-install-checks',crypto.randomUUID());await fs.mkdir(folder,{recursive:true});
 try{
  await fs.writeFile(path.join(folder,'metadata.apk'),createMetadataArchive(entries));
  const sdk=path.dirname(path.dirname(adb)),builds=(await fs.readdir(path.join(sdk,'build-tools'))).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}));let aapt;
  for(const build of builds){const candidate=path.join(sdk,'build-tools',build,'aapt.exe');try{await fs.access(candidate);aapt=candidate;break;}catch{}}
  if(!aapt)throw Error('SDK 缺少 aapt，安装后资料核验未完成');
  const badging=await runner(aapt,['dump','badging','metadata.apk'],{cwd:folder,timeout:15000,maxOutput:128000}),xml=await runner(aapt,['dump','xmltree','metadata.apk','AndroidManifest.xml'],{cwd:folder,timeout:15000,maxOutput:512000});
  if(badging.code||xml.code)throw Error('无法解析设备中的实际安装资料');
  const name=badging.stdout.match(/^application-label:'(.*)'\r?$/m)?.[1],versionCode=Number(badging.stdout.match(/package:.*?versionCode='(\d+)'/)?.[1]);
  if(name!==expected.name||versionCode!==expected.versionCode)throw Error('设备上的应用名称或版本号与本次 APK 不一致');
  const manifest=inspectAndroidManifest(xml.stdout);
  if(expected.picoActivityVr&&!manifest.picoActivityVr)throw Error('已安装包缺少 PICO 活动层 VR 标记');
  return {verified:true,name,versionCode,picoActivityVr:manifest.picoActivityVr,launcherVisualStateVerified:false};
 }finally{await fs.rm(folder,{recursive:true,force:true});}
}
