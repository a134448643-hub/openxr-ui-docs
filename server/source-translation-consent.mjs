import crypto from 'node:crypto';
import path from 'node:path';
const key=p=>path.resolve(p).toLowerCase();
// Deliberately memory-only. Neither cache restoration nor a saved job grants consent.
export function createSourceTranslationConsent(){
 const challenges=new Map(),grants=new Map();
 function clear(){challenges.clear();grants.clear();}
 function inspect(source){
  const now=Date.now();for(const [id,item] of challenges)if(item.expiresAt<now)challenges.delete(id);
  const challenge=crypto.randomUUID();challenges.set(challenge,{descriptor:key(source.descriptorPath),expiresAt:now+10*60000});
  return {confirmationRequired:true,source:{name:source.name,descriptorPath:source.descriptorPath},challenge};
 }
 function confirm(source,input){
  const item=challenges.get(input?.challenge);challenges.delete(input?.challenge);
  if(!item||item.expiresAt<Date.now()||item.descriptor!==key(source.descriptorPath)||typeof input?.descriptorPath!=='string'||key(input.descriptorPath)!==item.descriptor)throw Error('源项目确认已失效，请重新确认当前项目');
  const token=crypto.randomUUID();grants.set(token,{descriptor:item.descriptor});return token;
 }
 function assert(source,token){if(!token||grants.get(token)?.descriptor!==key(source.descriptorPath))throw Error('尚未确认翻译源项目，已停止；请在确认弹窗中明确选择');}
 function consume(token){grants.delete(token);}
 return {clear,inspect,confirm,assert,consume};
}
