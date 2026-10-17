import fs from 'node:fs/promises';
import path from 'node:path';
import {planBlueprintLayouts} from './blueprint-layout.mjs';
export async function runBlueprintLayout({descriptorPath,protectedRoots,editor,resourceRoot,taskDir,runner,editorLanguage='en'}){
 await fs.mkdir(taskDir,{recursive:true});
 const script=path.join(taskDir,'layout-project.py');await fs.copyFile(path.join(resourceRoot,'layout-project.py'),script);
 async function run(mode,graphs){const requestFile=path.join(taskDir,mode+'-request.json'),output=path.join(taskDir,mode+'-result.json');await fs.writeFile(requestFile,JSON.stringify({mode:mode.startsWith('snapshot')?'snapshot':'apply',descriptorPath,protectedRoots,output,graphs}));
 const result=await runner(editor,[descriptorPath,...(editorLanguage==='system'?[]:['-culture='+editorLanguage,'-language='+editorLanguage,'-locale='+editorLanguage]),'-run=pythonscript','-script='+script,'-unattended','-nop4','-NoSound','-NullRHI','-utf8output','-abslog='+path.join(taskDir,mode+'.log')],{env:{...process.env,UE_DELIVERY_LAYOUT_REQUEST:requestFile},cwd:path.dirname(descriptorPath),timeout:20*60000});
 const report=JSON.parse(await fs.readFile(output,'utf8'));if(result.code!==0||!report.success)throw Error('布局'+mode+'失败：'+(report.error||report.errors?.join('；')||'查看平台报告'));return report;}
 const snapshot=await run('snapshot-before'),plan=planBlueprintLayouts(snapshot);
 if(plan.graphs.length){const applied=await run('apply',plan.graphs),expected=plan.graphs.reduce((n,g)=>n+g.nodes.length,0);if(applied.nodesUpdated!==expected)throw Error('布局写入数量不完整');}
 const after=await run('snapshot-after'),byKey=new Map(after.graphs.map(g=>[g.asset+'|'+g.id,g]));
 const connections=g=>JSON.stringify(g.links.map(l=>[l.from,l.fromPin,l.to,l.toPin,l.exec].join('|')).sort());
 for(const before of snapshot.graphs){const current=byKey.get(before.asset+'|'+before.id);if(!current||connections(before)!==connections(current)||JSON.stringify(before.nodes.map(n=>n.id+'|'+n.type).sort())!==JSON.stringify(current.nodes.map(n=>n.id+'|'+n.type).sort()))throw Error('保存后节点或连接发生变化，停止交付');}
 if(after.graphs.length!==snapshot.graphs.length)throw Error('保存后图表数量发生变化');
 for(const graph of plan.graphs){const current=byKey.get(graph.asset+'|'+graph.id),nodes=new Map(current.nodes.map(n=>[n.id,n]));for(const n of graph.nodes){const actual=nodes.get(n.id);if(actual.x!==n.x||actual.y!==n.y||n.comment&&(Math.abs(actual.width-n.width)>1||Math.abs(actual.height-n.height)>1))throw Error('布局保存后位置或注释边界不一致');}}
 const result={...plan,summary:{...plan.summary,savedAndReopened:true,connectionsVerified:true},verifiedAt:new Date().toISOString()};
 await fs.writeFile(path.join(taskDir,'LayoutReport.json'),JSON.stringify(result,null,2));return result.summary;
}
