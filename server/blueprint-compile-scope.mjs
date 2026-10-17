// UE 5.3 reads AllowListFile as ANSI. Native inventories instead enumerate other
// mount roots so CompileAllBlueprints can include every /Game asset, in Unicode.
export function blueprintCompileScope(report,allowName){if(Array.isArray(report.compileIgnoreFolders)){if(report.compileIgnoreFolders.some(p=>!/^\/[\p{L}\p{N}_]+\/$/u.test(p)||p.toLowerCase()==='/game/'))throw Error('蓝图编译范围无效');return report.compileIgnoreFolders.length?['-IgnoreFolder='+report.compileIgnoreFolders.join(',')]:[];}return ['-AllowListFile='+allowName];}
