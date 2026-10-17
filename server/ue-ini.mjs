// Preserve UE INI comments, unrelated keys, array directives, BOM and line endings.
export function decodeIni(buffer=Buffer.alloc(0)) {
  let encoding='utf8',bom=Buffer.alloc(0),data=buffer;
  if(buffer.subarray(0,2).equals(Buffer.from([255,254]))){encoding='utf16le';bom=buffer.subarray(0,2);data=buffer.subarray(2);}
  else if(buffer.subarray(0,2).equals(Buffer.from([254,255]))){encoding='utf16be';bom=buffer.subarray(0,2);data=Buffer.from(buffer.subarray(2));if(data.length%2)throw Error('UTF-16 配置长度异常');data.swap16();}
  else if(buffer.subarray(0,3).equals(Buffer.from([239,187,191]))){bom=buffer.subarray(0,3);data=buffer.subarray(3);}
  if(encoding==='utf8'){try{new TextDecoder('utf-8',{fatal:true}).decode(data);}catch{throw Error('配置文件不是 UTF-8 或带 BOM 的 UTF-16，已停止，避免改变编码。');}}
  const text=data.toString(encoding==='utf16be'?'utf16le':encoding);
  return {text,encoding,bom,newline:text.includes('\r\n')?'\r\n':'\n'};
}
export function encodeIni(text,format){let data=Buffer.from(text,format.encoding==='utf16be'?'utf16le':format.encoding);if(format.encoding==='utf16be')data.swap16();return Buffer.concat([format.bom,data]);}
export function parseIni(text){let section='';const entries=[];for(const line of text.split(/\r?\n/)){const h=line.trim().match(/^\[([^\]]+)\]$/);if(h){section=h[1];continue;}if(!section||/^\s*(?:;|#|\/\/|$)/.test(line))continue;const m=line.match(/^\s*([^=]+?)\s*=(.*)$/);if(m)entries.push({section,key:m[1].trim(),value:m[2].trim()});}return entries;}
export function iniValue(text,section,key){const entries=parseIni(text).filter(e=>e.section.toLowerCase()===section.toLowerCase()&&e.key.toLowerCase()===key.toLowerCase());return entries.at(-1)?.value??'';}
export function mergeIni(text,entries){const newline=text.includes('\r\n')?'\r\n':'\n';const lines=text?text.replace(/\r?\n$/,'').split(/\r?\n/):[];for(const entry of entries){const {section,key,value}=entry;if(/[\r\n\[\]]/.test(section)||/[\r\n=]/.test(key)||/[\r\n]/.test(value))throw Error('INI 节、键和值不能包含换行或非法分隔符');const ranges=[];for(let i=0;i<lines.length;i++){const h=lines[i].trim().match(/^\[([^\]]+)\]$/);if(h&&h[1].toLowerCase()===section.toLowerCase()){let end=i+1;while(end<lines.length&&!/^\s*\[.*\]\s*$/.test(lines[end]))end++;ranges.push([i,end]);}}
    if(!ranges.length){if(lines.length&&lines.at(-1)!=='')lines.push('');lines.push(`[${section}]`,`${key}=${value}`);continue;}
    const array=/^[+\-.!]/.test(key);let found=false;
    for(const [start,end] of ranges){for(let i=start+1;i<end;i++){if(/^\s*(?:;|#|\/\/)/.test(lines[i]))continue;const m=lines[i].match(/^(\s*)([^=]+?)\s*=(.*)$/);if(!m||m[2].trim().toLowerCase()!==key.toLowerCase())continue;if(array&&m[3].trim()!==value)continue;if(!array)lines[i]=m[1]+m[2].trim()+'='+value;found=true;}}
    if(!found){const [,end]=ranges.at(-1);lines.splice(end,0,`${key}=${value}`);}
  }return lines.length?lines.join(newline)+newline:'';
}
export const rendererSection='/Script/Engine.RendererSettings';
export const androidSection='/Script/AndroidRuntimeSettings.AndroidRuntimeSettings';
export const sdkSection='/Script/AndroidPlatformEditor.AndroidSDKSettings';
const android={ 'r.ForwardShading':'True','r.MobileHDR':'False','vr.MobileMultiView':'True','vr.InstancedStereo':'True','r.Shadow.Virtual.Enable':'0','r.Mobile.AllowMovableDirectionalLights':'True','r.Mobile.EnableMovableDirectionalLights':'True','r.Mobile.MaxVisibleMovableDirectionalLights':'1','r.Mobile.NumDynamicPointLights':'0','r.Mobile.AntiAliasing':'3','r.MSAACount':'4','r.Shadow.MaxCSMResolution':'1024','r.Mobile.EnableMovableLightCSMShaderCulling':'True'};
const desktop={'r.Shadow.Virtual.Enable':'1','r.ForwardShading':'False','r.Nanite':'1','r.DynamicGlobalIlluminationMethod':'1','r.Shadow.MaxCSMResolution':'2048'};
const pcvr={'r.ForwardShading':'True','vr.InstancedStereo':'True','r.Shadow.Virtual.Enable':'0','r.AntiAliasingMethod':'3','r.MSAACount':'4','r.Shadow.MaxCSMResolution':'1024'};
export function platformEntries(platform){const map={android,desktop,pcvr}[platform];if(!map)throw Error('未知目标平台');const entries=Object.entries(map).map(([key,value])=>({section:rendererSection,key,value}));if(platform==='android')entries.push(...Object.entries({bIsOpenXR1_0Enabled:'True',bIsOpenXR1_1Enabled:'True','+BlockedExtensions':'XR_KHR_vulkan_swapchain_format_list'}).map(([key,value])=>({section:'/Script/OpenXRHMD.OpenXRHMDSettings',key,value})));return entries;}
export const redactConfig=text=>text.replace(/^(\s*[^=\r\n]*(?:password|storepass|keypass|api[_-]?key|secret|token)[^=\r\n]*=).*$/gim,'$1••••••（保持私密）').replace(/("[^"\r\n]*(?:password|api[_-]?key|secret|token)[^"\r\n]*"\s*:\s*)"(?:\\.|[^"\\])*"/gi,'$1"••••••"');
