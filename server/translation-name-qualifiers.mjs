// Opaque suffixes belong to the user's identifier. Preserve them without
// assigning a meaning such as "small" or "specular".
export function originalNameSuffix(original){
 if(!/[\u3400-\u9fff]/u.test(String(original||'')))return '';
 return String(original).match(/_[A-Za-z0-9]+(?:_[A-Za-z0-9]+)*$/)?.[0]||'';
}
export function preserveNameSuffix(name,original){
 const suffix=originalNameSuffix(original),value=String(name||'');
 return suffix&&value.toLowerCase().endsWith(suffix.toLowerCase())?value.slice(0,-suffix.length)+suffix:value;
}
export function resolveSuffixOnlyReview(row,direction){
 if(direction!=='zh-en'||row.field!=='Name'||row.native||!row.needsSemanticReview)return row;
 const suffix=originalNameSuffix(row.original);
 const stem=row.group==='assets'&&row.requiredPrefix&&row.translated?.startsWith(row.requiredPrefix)?row.translated.slice(row.requiredPrefix.length):row.translated;
 if(!suffix||!stem?.endsWith(suffix)||!/[A-Za-z]/.test(stem.slice(0,-suffix.length)))return row;
 const token=`["'\x60]?${suffix}["'\x60]?`,reason=String(row.namingReason||'').trim();
 // An anchored single-cause allowlist avoids dismissing uncertain core meanings,
 // omitted/expanded suffixes, mixed reasons, or arbitrary model explanations.
 const english=new RegExp(`^(?:(?:the )?(?:meaning|purpose|usage) of (?:the )?${token} suffix is (?:unclear|unknown|ambiguous)|(?:the )?${token} suffix (?:meaning is|is) (?:unclear|unknown|ambiguous)|(?:unclear|unknown|ambiguous) (?:meaning|purpose|usage) (?:of|for) (?:the )?${token} suffix)[.!]?$`,'i');
 const chinese=new RegExp(`^(?:${token}(?:后缀|尾缀)(?:的)?(?:含义|用途)(?:不明|不明确|未知)|(?:后缀|尾缀)${token}(?:的)?(?:含义|用途)(?:不明|不明确|未知))[。！]?$`,'i');
 if(!english.test(reason)&&!chinese.test(reason))return row;
 return {...row,needsSemanticReview:false,preservedOriginalSuffix:suffix,semanticReviewResolved:'preserved-original-suffix',namingReason:'保留原名后缀 '+suffix+'，不推测其含义'};
}
