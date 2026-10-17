import { TextSelection } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';
import { richId } from '../server/document-rich-text.mjs';

// Isolate the selected text before changing its paragraph type. Replacements
// run backwards so positions, images and floating objects outside each range
// are untouched. All splits and formatting are one undoable transaction.
export function applySelectedHeading(level, { insert = false } = {}) {
  return ({ state, tr, dispatch }) => {
    const { selection, schema } = state;
    const target = level ? schema.nodes.heading : schema.nodes.paragraph;
    if (!target) return false;
    const ranges = [];
    if (selection.empty || insert) {
      const { $from } = selection;
      if (!$from.parent.isTextblock) {
        if (!level) return false;
        const position = selection.to;
        const heading = target.create({ level, recordId: richId(), field: target.defaultAttrs?.field || 'zh' });
        if (!$from.parent.canReplaceWith($from.indexAfter(), $from.indexAfter(), target)) return false;
        if (dispatch) { tr.insert(position, heading); tr.setSelection(TextSelection.create(tr.doc, position + 1)); closeHistory(tr); }
        return true;
      }
      const node = $from.parent, pos = $from.before(), offset = $from.parentOffset;
      if (!level) {
        if (dispatch) { tr.setNodeMarkup(pos, target, { ...node.attrs }); closeHistory(tr); }
        return true;
      }
      ranges.push({ node, pos, start: offset, end: offset, empty: true });
    } else {
      state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
        if (!node.isTextblock || !['paragraph', 'heading'].includes(node.type.name)) return;
        const start = Math.max(0, selection.from - pos - 1);
        const end = Math.min(node.content.size, selection.to - pos - 1);
        if (end > start) ranges.push({ node, pos, start, end, empty: false });
        return false;
      });
    }
    if (!ranges.length) return false;
    if (!dispatch) return true;
    let selectedFrom, selectedTo;
    for (const { node, pos, start, end, empty } of ranges.reverse()) {
      const pieces = [];
      const attrsFor = () => ({ ...node.attrs, recordId: pieces.length ? richId() : node.attrs.recordId || richId() });
      if (start) pieces.push(node.type.create(attrsFor(), node.content.cut(0, start)));
      const beforeSize = pieces.reduce((size, piece) => size + piece.nodeSize, 0);
      const attrs = { ...attrsFor(), ...(level ? { level } : {}) };
      pieces.push(target.create(attrs, node.content.cut(start, end)));
      if (end < node.content.size) pieces.push(node.type.create(attrsFor(), node.content.cut(end)));
      tr.replaceWith(pos, pos + node.nodeSize, pieces);
      if (selectedFrom != null) {
        const map = tr.mapping.maps.at(-1);
        selectedFrom = map.map(selectedFrom, 1); selectedTo = map.map(selectedTo, -1);
      }
      const from = pos + beforeSize + 1, to = from + end - start;
      selectedFrom = from;
      if (selectedTo == null) selectedTo = to;
      if (empty) tr.setStoredMarks([]);
    }
    tr.setSelection(TextSelection.create(tr.doc, selectedFrom, selectedTo));
    closeHistory(tr); tr.scrollIntoView();
    return true;
  };
}
