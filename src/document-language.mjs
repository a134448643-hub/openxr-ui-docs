const keyFor = published => published ? 'doc-studio-share-language' : 'doc-studio-language';
export function initialDocumentLanguage(published, storage) {
  try {
    const saved = (storage || globalThis.sessionStorage)?.getItem(keyFor(published));
    if (saved === 'zh' || saved === 'en') return saved;
  } catch {}
  return published ? 'en' : 'zh';
}
export function rememberDocumentLanguage(value, published, storage) {
  if (value !== 'zh' && value !== 'en') return false;
  try { (storage || globalThis.sessionStorage)?.setItem(keyFor(published), value); } catch {}
  return true;
}

export function documentTitle(document, field, language) {
  return language === 'en' ? document.englishTitles?.[field] || document[field] || '' : document[field] || '';
}
export function updateDocumentTitle(document, field, language, value) {
  return language === 'en' ? { ...document, englishTitles: { ...document.englishTitles, [field]: value } } : { ...document, [field]: value };
}
