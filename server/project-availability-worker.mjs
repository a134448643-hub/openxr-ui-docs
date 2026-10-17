// A short-lived helper isolates stalled drives from the desktop IO thread pool.
// Only registered descriptor paths are checked. No project is scanned or written.
import fs from 'node:fs/promises';import path from 'node:path';
process.stdin.setEncoding('utf8');let input='';for await(const chunk of process.stdin){input+=chunk;if(input.length>12*1024*1024)throw Error('Project list too large');}
const {paths,concurrency=8,includeNetwork=false,validateProject=false}=JSON.parse(input),roots=new Map();let cursor=0,statCalls=0;
const emit=row=>process.stdout.write(JSON.stringify(row)+'\n');
async function rootAvailable(root){if(!roots.has(root))roots.set(root,(async()=>{try{statCalls++;return (await fs.stat(root)).isDirectory();}catch{return false;}})());return roots.get(root);}
async function inspect(descriptorPath){
 if(!includeNetwork&&/^[/\\]{2}/.test(descriptorPath))return {descriptorPath,status:'unavailable',reason:'网络位置请连接后手动刷新'};
 if(!await rootAvailable(path.parse(descriptorPath).root))return {descriptorPath,status:'unavailable',reason:'所在磁盘暂时不可访问'};
 try{statCalls++;const info=await fs.stat(descriptorPath);if(info.isFile()&&validateProject){for(const name of ['Content','Config']){statCalls++;if(!(await fs.stat(path.join(path.dirname(descriptorPath),name))).isDirectory())return {descriptorPath,status:'invalid'};}let data;try{data=JSON.parse((await fs.readFile(descriptorPath,'utf8')).replace(/^\uFEFF/,''));}catch{return {descriptorPath,status:'invalid'};}if(!data||typeof data!=='object'||Array.isArray(data))return {descriptorPath,status:'invalid'};}return {descriptorPath,status:info.isFile()?'available':'missing',reason:info.isFile()?'':'工程文件已不存在'};}
 catch(error){return {descriptorPath,status:['ENOENT','ENOTDIR'].includes(error.code)?'missing':'unavailable',reason:['ENOENT','ENOTDIR'].includes(error.code)?'工程文件已不存在':'工程位置暂时不可访问',code:error.code};}
}
await Promise.all(Array.from({length:Math.min(concurrency,paths.length)},async()=>{while(cursor<paths.length){const index=cursor++;emit(await inspect(paths[index]));}}));
emit({type:'summary',statCalls});
