import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createBuildPathAlias} from '../server/ue-build-path.mjs';

const root=path.resolve('.local/checks/android-native-path-'+Date.now()),work=path.join(root,'中文工程');await fs.mkdir(work,{recursive:true});
await fs.writeFile(path.join(work,'Probe.h'),'#define PROBE_VALUE 7\n');
await fs.writeFile(path.join(work,'Probe.cpp'),'#include "Probe.h"\nextern "C" int probe(){return PROBE_VALUE;}\n');
const commands=[];
async function run(file,args,env){return new Promise((resolve,reject)=>{let output='';const child=spawn(file,args,{env,cwd:work,windowsHide:true,shell:false});child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);child.once('error',reject);child.once('close',code=>{commands.push({file,args,code,output});code===0?resolve():reject(Error(output));});});}
const alias=await createBuildPathAlias(work);let reserved;
try{
  assert.match(alias.root,/^[G-Z]:\\$/);assert.doesNotMatch(alias.root,/[^\x00-\x7f]/);
  assert.equal(await fs.readFile(path.join(alias.root,'Probe.cpp'),'utf8'),await fs.readFile(path.join(work,'Probe.cpp'),'utf8'));
  reserved=await createBuildPathAlias(work);assert.notEqual(reserved.root,alias.root);await reserved.release();
  await fs.mkdir(path.join(alias.root,'Temp'));const env={...process.env,TEMP:path.join(alias.root,'Temp'),TMP:path.join(alias.root,'Temp')};
  const cl='C:/Program Files (x86)/Microsoft Visual Studio/2022/BuildTools/VC/Tools/MSVC/14.44.35207/bin/Hostx64/x64/cl.exe';
  await run(cl,['/nologo','/c','/YcProbe.h','/Fp'+path.join(alias.root,'Probe.pch'),'/Fo'+path.join(alias.root,'Probe.obj'),path.join(alias.root,'Probe.cpp')],env);
  const ndk=path.join(process.env.LOCALAPPDATA,'Android/Sdk/ndk/25.1.8937393'),clang=path.join(ndk,'toolchains/llvm/prebuilt/windows-x86_64/bin/clang++.exe');
  await run(clang,['--target=aarch64-linux-android29','--sysroot='+path.join(ndk,'toolchains/llvm/prebuilt/windows-x86_64/sysroot'),'-fPIC','-c',path.join(alias.root,'Probe.cpp'),'-o',path.join(alias.root,'Probe.o')],env);
  await run(clang,['--target=aarch64-linux-android29','-shared','-nostdlib','-fuse-ld=lld',path.join(alias.root,'Probe.o'),'-o',path.join(alias.root,'Probe.so')],env);
  for(const file of ['Probe.pch','Probe.obj','Probe.o','Probe.so'])assert.ok((await fs.stat(path.join(work,file))).size>0);
  assert.equal((await fs.readFile(path.join(work,'Probe.so'))).subarray(0,4).toString(),'\x7fELF');
}finally{await reserved?.release();await alias.release();}
await assert.rejects(fs.access(alias.root));
const report={root,work,alias:alias.root,commands,realWindowsPch:true,realAndroidArm64CompileAndLink:true,aliasReleased:true,userProjectUsed:false,actualApkPackaging:false};
await fs.writeFile(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
