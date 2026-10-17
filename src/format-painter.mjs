import { closeHistory } from '@tiptap/pm/history';
import { applySelectedHeading } from './heading-command.mjs';
import { TEXT_SIZE_PIXELS } from '../server/document-rich-text.mjs';

const CHARACTER_MARKS = ['bold', 'italic', 'underline', 'strike', 'code', 'textStyle'];
const TEXT_ATTRIBUTES = ['color', 'fontSize', 'fontFamily', 'backgroundColor', 'lineHeight'];

export function captureTextFormat(state, { useLegacySize = true } = {}) {
  const { from, to, empty } = state.selection;
  if (empty) return null;
  let shared = null, paragraph = undefined, legacySize;
  state.doc.nodesBetween(from, to, (node, position) => {
    if (node.isTextblock && position + 1 < to && position + node.nodeSize - 1 > from) {
      const role = { type: node.type.name, ...(node.type.name === 'heading' ? { level: node.attrs.level } : {}) };
      if (paragraph === undefined) paragraph = role;
      else if (JSON.stringify(paragraph) !== JSON.stringify(role)) paragraph = null;
      const size = node.type.name === 'paragraph' ? TEXT_SIZE_PIXELS[node.attrs.legacyStyle?.size] || null : null;
      legacySize = legacySize === undefined ? size : legacySize === size ? size : null;
    }
    if (!node.isText || position >= to || position + node.nodeSize <= from) return;
    const marks = node.marks.filter(mark => CHARACTER_MARKS.includes(mark.type.name)).map(mark => {
      if (mark.type.name !== 'textStyle') return { type: mark.type.name };
      const attrs = Object.fromEntries(TEXT_ATTRIBUTES.filter(key => mark.attrs[key] != null && mark.attrs[key] !== '').map(key => [key, mark.attrs[key]]));
      return Object.keys(attrs).length ? { type: 'textStyle', attrs } : null;
    }).filter(Boolean);
    if (shared === null) shared = marks;
    else shared = shared.flatMap(mark => {
      const other = marks.find(entry => entry.type === mark.type);
      if (!other) return [];
      if (mark.type !== 'textStyle') return [mark];
      const attrs = Object.fromEntries(Object.entries(mark.attrs).filter(([key, value]) => other.attrs[key] === value));
      return Object.keys(attrs).length ? [{ type: 'textStyle', attrs }] : [];
    });
  });
  if (shared === null) return null;
  // Legacy paragraph font sizes are visible formatting too.
  if (useLegacySize && legacySize && !shared.some(mark => mark.type === 'textStyle' && mark.attrs.fontSize)) {
    const style = shared.find(mark => mark.type === 'textStyle');
    if (style) style.attrs.fontSize = `${legacySize}px`;
    else shared.push({ type: 'textStyle', attrs: { fontSize: `${legacySize}px` } });
  }
  return { marks: shared, paragraph: paragraph || null };
}

export function paintTextFormat(format) {
  return ({ state, tr, dispatch }) => {
    if (!format || state.selection.empty) return false;
    let hasText = false, hasHeading = false;
    state.doc.nodesBetween(state.selection.from, state.selection.to, node => {
      if (node.isText) hasText = true;
      if (node.type.name === 'heading') hasHeading = true;
    });
    if (!hasText) return false;
    if (!dispatch) return true;
    if (format.paragraph?.type === 'heading' || (format.paragraph?.type === 'paragraph' && hasHeading)) {
      applySelectedHeading(format.paragraph.type === 'heading' ? format.paragraph.level : null)({ state, tr, dispatch });
    }
    const { from, to } = tr.selection;
    for (const name of CHARACTER_MARKS) if (state.schema.marks[name]) tr.removeMark(from, to, state.schema.marks[name]);
    for (const mark of format.marks) if (state.schema.marks[mark.type]) tr.addMark(from, to, state.schema.markFromJSON(mark));
    closeHistory(tr);
    return true;
  };
}
