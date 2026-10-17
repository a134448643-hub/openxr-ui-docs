import fs from 'node:fs/promises';

export function completeApplicationReport(report,expectedAssets){
 const processed=report?.assetsProcessed??report?.assetsRenamed;
 const counts=report?.assetsProcessed===undefined||Number.isInteger(report.assetsRenamed)&&report.assetsRenamed>=0&&Number.isInteger(report.assetsUnchanged)&&report.assetsUnchanged>=0&&report.assetsRenamed+report.assetsUnchanged===processed;
 return report?.success===true&&report.translationApplied===true&&Number.isInteger(report.applied)&&report.applied>=0&&processed===expectedAssets&&counts&&Array.isArray(report.failures)&&report.failures.length===0&&Array.isArray(report.compileErrors)&&report.compileErrors.length===0;
}
export function onlyIntermediateBlueprintErrors(log){
 const lines=String(log||'').split(/\r?\n/),errors=lines.filter(line=>/\b(?:Error:|Fatal:)|Fatal error|Unhandled Exception|Traceback \(most recent call last\)/i.test(line));
 return errors.length>0&&errors.every(line=>line.includes('LogBlueprint: Error:'))&&lines.some(line=>line.includes('Project export result:')&&/"success"\s*:\s*true/.test(line));
}
export function assertNoLostComponentAttachments(log,logFile){
 const lostAttachments=String(log).split(/\r?\n/).filter(line=>/FixupRootNodeParentReferences\(\).*Couldn't find|(?:component hierarchy|组件层级).*(?:failed|失败)/i.test(line));
 if(lostAttachments.length)throw Error('组件挂接关系验证未通过，未替换当前副本：'+lostAttachments[0]+'；日志：'+logFile);
}
export function assertNoInterfaceEventSubstitution(log,logFile){
 const line=String(log||'').split(/\r?\n/).find(s=>/replaced by a custom event|接口.*(?:替换|转换).*自定义事件/i.test(s));
 if(line)throw Error('检测到接口事件被替换为自定义事件，未交付当前副本：'+line+'；日志：'+logFile);
}
export async function checkEditorTranslationResult({result,report,logFile,verifyOnly,expectedAssets,requireHierarchy=false,expectedBlueprints}){
 const log=await fs.readFile(logFile,'utf8').catch(()=>''),complete=completeApplicationReport(report,expectedAssets);
 assertNoLostComponentAttachments(log,logFile);
 assertNoInterfaceEventSubstitution(log,logFile);
 const hierarchy=report?.componentHierarchy;
 if(requireHierarchy&&report?.success===true&&!(hierarchy?.schemaVersion===1&&hierarchy.matched===true&&hierarchy.blueprints===expectedBlueprints&&Number.isInteger(hierarchy.components)&&hierarchy.components>=0))throw Error('缺少完整的组件层级一致性报告，未替换当前副本；日志：'+logFile);
 // A commandlet remembers errors emitted while dependent Blueprints are being
 // renamed. Only this precise case may proceed to mandatory fresh validation.
 if(result.code===0&&report?.success===true&&!report.failures?.length&&!report.compileErrors?.length&&(verifyOnly||complete))return {...report,editorExitCode:0};
 if(!verifyOnly&&result.code===1&&complete&&onlyIntermediateBlueprintErrors(log))return {...report,editorExitCode:1,intermediateCompilerErrors:true,requiresFreshVerification:true};
 const details=[report?.error,...(report?.failures||[]).slice(0,3).map(f=>[f.owner||f.asset,f.reason].filter(Boolean).join('：')),...(report?.compileErrors||[]).slice(0,3).map(e=>e.asset+'（'+e.errors+' 个编译错误）'+(e.messages?.length?'：'+e.messages.slice(0,2).join('；'):''))].filter(Boolean);
 if(!details.length){const errors=log.split(/\r?\n/).filter(line=>/Error:|Fatal:|Fatal error|Exception/.test(line)).map(line=>line.replace(/^.*?\]\s*/,'')).filter(line=>!/(?:Error:\s*$|=== Handled ensure: ===|Error: Stack:|\[Callstack\])/.test(line));const causes=errors.filter(line=>/Found circular redirect|Circular soft reference|Traceback|Fatal error|Unhandled Exception/.test(line));details.push(...[...new Set([...causes,...errors])].slice(0,3));}
 if(verifyOnly&&report?.error?.startsWith('中文残留检查未通过'))throw Error(report.error+'；日志：'+logFile);
 throw Error((verifyOnly?'重新加载与蓝图验证未通过':'编辑器译文应用未完成')+'（退出码 '+result.code+'）'+(details.length?'：'+details.join('；'):'：编辑器未返回完整成功结果')+'；日志：'+logFile);
}
