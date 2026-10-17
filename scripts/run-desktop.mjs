import {spawn} from 'node:child_process';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const executable=require('electron');const child=spawn(executable,[path.join(root,'desktop/main.mjs')],{cwd:root,env,stdio:'inherit',windowsHide:true});child.on('error',e=>{console.error(e.message);process.exitCode=1;});child.on('close',code=>{process.exitCode=code||0;});
