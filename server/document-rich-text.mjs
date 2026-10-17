// Document paragraphs are storage records only. The editor renders these as a
// single ProseMirror document, never as independently editable controls.
export const TEXT_SIZE_PIXELS = { 'text-xs': 12, 'text-sm': 14, 'text-base': 16, 'text-lg': 18, 'text-xl': 20, 'text-2xl': 24, 'text-3xl': 30 };
export const richId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
export const inlineText = (nodes = []) => nodes.map(node => node.type === 'hardBreak' ? '\n' : node.text || inlineText(node.content)).join('');

export function inlineFor(item, field) {
  const text = String(item.data?.[field] || '');
  const rich = item.style?.richText?.[field];
  if (Array.isArray(rich) && inlineText(rich) === text) return structuredClone(rich);
  const style = item.style || {}, marks = [];
  if (style.weight === 'font-bold' && !style.isSectionHeader) marks.push({ type: 'bold' });
  if (style.decoration === 'underline') marks.push({ type: 'underline' });
  const attributes = {};
  if (style.color && style.color !== '#374151') attributes.color = style.color;
  if (style.customTypography && TEXT_SIZE_PIXELS[style.size]) attributes.fontSize = `${TEXT_SIZE_PIXELS[style.size]}px`;
  if (Object.keys(attributes).length) marks.push({ type: 'textStyle', attrs: attributes });
  return text.split('\n').flatMap((line, index) => [...(index ? [{ type: 'hardBreak' }] : []), ...(line ? [{ type: 'text', text: line, ...(marks.length ? { marks: structuredClone(marks) } : {}) }] : [])]);
}

function textNodes(item, language) {
  const fields = language === 'bilingual' ? ['zh', 'en'].filter(field => item.data?.[field]) : [language];
  if (!fields.length) fields.push('zh');
  const legacyStyle = { ...(item.style || {}) }; delete legacyStyle.richText; delete legacyStyle.documentOrder;
  // Character formatting becomes marks, so a selected word can also have an
  // inherited legacy bold/color/underline removed independently.
  delete legacyStyle.weight; delete legacyStyle.color; delete legacyStyle.decoration; delete legacyStyle.customTypography;
  return fields.map(field => {
    const saved = item.style?.paragraphTypes?.[field];
    const heading = saved ? saved.type === 'heading' : item.style?.isSectionHeader;
    return {
    type: heading ? 'heading' : 'paragraph',
    attrs: { recordId: item.id, field, legacyStyle, ...(heading ? { level: saved?.level || item.style.headingLevel || 2 } : {}) },
    content: inlineFor(item, field),
  }; });
}

export function documentFromRecords(records, language = 'bilingual') {
  const content = [];
  for (const record of records || []) {
    const item = structuredClone(record);
    const attachments = item.attachments || []; item.attachments = [];
    if (item.isFloating && item.type === 'text') content.push({ type: 'floatingText', attrs: { item, anchorId: null }, content: textNodes(item, language) });
    else if (item.type === 'image') content.push({ type: 'documentImage', attrs: { item, anchorId: null } });
    else content.push(...textNodes(item, language));
    for (const attachment of attachments) {
      const floating = { ...attachment, isFloating: true };
      content.push(attachment.type === 'image'
        ? { type: 'documentImage', attrs: { item: floating, anchorId: item.id } }
        : { type: 'floatingText', attrs: { item: floating, anchorId: item.id }, content: textNodes(floating, language) });
    }
  }
  const orderOf = node => {
    const item = node.attrs.item || records.find(item => item.id === node.attrs.recordId);
    const order = item?.style?.documentOrder;
    return typeof order === 'number' ? order : order?.[node.attrs.field];
  };
  let nextOrder = -1;
  const ordered = content.map((node, index) => { const known = orderOf(node); nextOrder = Number.isFinite(known) ? known : nextOrder + .01; return { node, order: nextOrder, index }; });
  if (ordered.some(entry => Number.isFinite(orderOf(entry.node)))) ordered.sort((a, b) => a.order - b.order || a.index - b.index);
  return { type: 'doc', content: ordered.length ? ordered.map(entry => entry.node) : [{ type: 'paragraph', attrs: { recordId: richId(), field: language === 'en' ? 'en' : 'zh' } }] };
}

export function recordsFromDocument(document, previous = [], language = 'bilingual') {
  const originals = new Map(previous.map(item => [item.id, item]));
  const records = [], byId = new Map(), detached = [], sequence = [];
  const readParagraph = (node, target) => {
    const field = node.attrs?.field === 'en' ? 'en' : 'zh';
    target.data[field] = inlineText(node.content);
    target.style.richText = { ...(target.style.richText || {}), [field]: structuredClone(node.content || []) };
    target.style.paragraphTypes = { ...(target.style.paragraphTypes || {}), [field]: { type: node.type, ...(node.type === 'heading' ? { level: node.attrs?.level || 2 } : {}) } };
  };
  for (const node of document.content || []) {
    if (node.type === 'documentImage' || node.type === 'floatingText') {
      const item = structuredClone(node.attrs.item);
      if (!item) continue;
      sequence.push({ item });
      if (node.type === 'floatingText') {
        item.data = { ...(item.data || {}), ...(language === 'bilingual' ? { zh: '', en: '' } : { [language]: '' }) };
        item.style = { ...(item.style || {}) };
        const fields = new Set();
        for (const paragraph of node.content || []) {
          const field = paragraph.attrs?.field === 'en' ? 'en' : 'zh';
          const content = fields.has(field) ? [...(item.style.richText?.[field] || []), { type: 'hardBreak' }, ...(paragraph.content || [])] : paragraph.content;
          readParagraph({ ...paragraph, content }, item); fields.add(field);
        }
      }
      if (node.attrs.anchorId) detached.push({ anchorId: node.attrs.anchorId, item });
      else { records.push(item); byId.set(item.id, item); }
      continue;
    }
    if (node.type !== 'paragraph' && node.type !== 'heading') continue;
    let id = node.attrs?.recordId || richId();
    const field = node.attrs?.field === 'en' ? 'en' : 'zh';
    if (byId.get(id)?._fields?.has(field)) id = richId();
    let item = byId.get(id);
    if (!item) {
      const original = originals.get(id);
      item = { id, type: 'text', isFloating: false, data: language === 'bilingual' ? { zh: '', en: '' } : { zh: original?.data?.zh || '', en: original?.data?.en || '', [language]: '' }, style: { ...(node.attrs?.legacyStyle || {}), ...(language !== 'bilingual' && original?.style?.richText ? { richText: structuredClone(original.style.richText) } : {}), paragraphTypes: language !== 'bilingual' ? structuredClone(original?.style?.paragraphTypes || Object.fromEntries(['zh','en'].map(field => [field, { type: original?.style?.isSectionHeader ? 'heading' : 'paragraph', level: original?.style?.headingLevel || 2 }]))) : {}, isSectionHeader: node.type === 'heading' }, attachments: [], _fields: new Set() };
      records.push(item); byId.set(id, item);
    }
    item._fields.add(field); readParagraph(node, item);
    if (node.type === 'heading') item.style.headingLevel = node.attrs.level || 2;
    sequence.push({ item, field });
  }
  // Editing one language must never erase the other language's hidden text.
  if (language !== 'bilingual') {
    const hidden = language === 'zh' ? 'en' : 'zh';
    for (let index = 0; index < previous.length; index += 1) {
      const old = previous[index];
      if (old.type !== 'text' || old.isFloating || byId.has(old.id) || !old.data?.[hidden]) continue;
      const kept = { ...structuredClone(old), data: { ...old.data, [language]: '' }, attachments: [] };
      if (kept.style.richText) kept.style.richText[language] = [];
      const nextIndex = records.findIndex(item => previous.findIndex(entry => entry.id === item.id) > index);
      records.splice(nextIndex < 0 ? records.length : nextIndex, 0, kept); byId.set(kept.id, kept);
    }
  }
  for (const { anchorId, item } of detached) {
    const owner = byId.get(anchorId);
    if (owner) owner.attachments.push(item);
    else records.push({ ...item, isFloating: true });
  }
  let fullSequence = sequence;
  if (language !== 'bilingual') {
    const keyOf = entry => `${entry.item.id}:${entry.field || 'object'}`;
    const visible = new Set(sequence.map(keyOf)), buckets = new Map();
    let anchor = '';
    for (const oldNode of documentFromRecords(previous, 'bilingual').content) {
      const field = oldNode.attrs?.field;
      const id = oldNode.attrs?.recordId || oldNode.attrs?.item?.id;
      const key = `${id}:${field || 'object'}`;
      if (visible.has(key)) anchor = key;
      else if (field && field !== language && byId.has(id)) {
        const paired = `${id}:${language}`;
        const target = !originals.get(id)?.data?.[language] && visible.has(paired) ? paired : anchor;
        if (!buckets.has(target)) buckets.set(target, []);
        buckets.get(target).push({ item: byId.get(id), field });
      }
    }
    fullSequence = [...(buckets.get('') || [])];
    for (const entry of sequence) fullSequence.push(entry, ...(buckets.get(keyOf(entry)) || []));
  }
  for (let index = 0; index < fullSequence.length; index += 1) {
    const { item, field } = fullSequence[index];
    item.style = { ...(item.style || {}) };
    item.style.documentOrder = field ? { ...(typeof item.style.documentOrder === 'object' ? item.style.documentOrder : {}), [field]: index } : index;
  }
  for (const item of records) delete item._fields;
  return records;
}
