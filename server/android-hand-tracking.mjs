const start='<!-- PersonalDevPlatform:QuestHands -->',end='<!-- /PersonalDevPlatform:QuestHands -->';
export function needsQuestHandTracking(descriptor,target){
 return target!=='pico'&&descriptor.Plugins?.some(p=>p.Name==='OpenXRHandTracking'&&p.Enabled===true)===true;
}
export function questHandRequirements(text,enabled){
 let result=String(text||'').replace(/<!-- PersonalDevPlatform:QuestHands -->[\s\S]*?<!-- \/PersonalDevPlatform:QuestHands -->\r?\n?/g,'');
 if(!enabled)return result;
 const declarations=[];
 if(!/<uses-permission\b[^>]*android:name\s*=\s*["']com\.oculus\.permission\.HAND_TRACKING["']/.test(result))declarations.push('<uses-permission android:name="com.oculus.permission.HAND_TRACKING" />');
 if(!/<uses-feature\b[^>]*android:name\s*=\s*["']oculus\.software\.handtracking["']/.test(result))declarations.push('<uses-feature android:name="oculus.software.handtracking" android:required="false" />');
 if(!declarations.length)return result;
 const newline=result.includes('\r\n')?'\r\n':'\n';
 return result+(result&&!result.endsWith('\n')?newline:'')+start+newline+declarations.join(newline)+newline+end+newline;
}
