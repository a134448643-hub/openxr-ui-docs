import fs from 'node:fs/promises';
import path from 'node:path';

// UE editor plugins may write defaults while loading. Extraction is read-only:
// restore those writes in the exclusively owned working copy before byte reuse.
export async function captureScanConfig(projectRoot){
 const root=path.join(projectRoot,'Config'),files=new Map(),directories=new Set(['']);
 async function walk(dir,relative=''){for(const e of await fs.readdir(dir,{withFileTypes:true})){if(e.isSymbolicLink())throw Error('提取配置目录包含链接');const name=relative+e.name,file=path.join(dir,e.name);if(e.isDirectory()){directories.add(name);await walk(file,name+'/');}else if(e.isFile())files.set(name,await fs.readFile(file));else throw Error('提取配置包含异常文件');}}
 await walk(root);return {root,files,directories};
}
export async function restoreScanConfig(snapshot){
 let restored=0;const {root,files,directories}=snapshot;
 async function walk(dir,relative=''){for(const e of await fs.readdir(dir,{withFileTypes:true})){if(e.isSymbolicLink())throw Error('提取配置目录变为链接，已停止恢复');const name=relative+e.name,file=path.join(dir,e.name);if(e.isDirectory()){await walk(file,name+'/');if(!directories.has(name)&&!(await fs.readdir(file)).length)await fs.rmdir(file);}else if(e.isFile()){if(!files.has(name)){await fs.unlink(file);restored++;}}else throw Error('提取配置包含异常文件');}}
 await walk(root);
 for(const [relative,bytes] of files){const file=path.join(root,relative),current=await fs.readFile(file).catch(e=>{if(e.code==='ENOENT')return null;throw e;});if(!current?.equals(bytes)){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,bytes);restored++;}}
 return restored;
}
