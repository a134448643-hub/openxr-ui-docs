import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { richId } from '../server/document-rich-text.mjs';

// An image is an atomic block, so hardBreak cannot be inserted into it.
// Keep the new caret in a real paragraph, including at the end of a page.
export function paragraphAfterImage(position, { language = 'zh', reuseFollowing = false } = {}) {
  return ({ state, dispatch }) => {
    const image = state.doc.nodeAt(position);
    if (image?.type.name !== 'documentImage' || image.attrs.item?.isFloating) return false;
    const after = position + image.nodeSize;
    const next = state.doc.nodeAt(after);
    const reuse = next?.type.name === 'paragraph' && (reuseFollowing || next.content.size === 0);
    const tr = state.tr;
    if (!reuse) {
      const paragraph = state.schema.nodes.paragraph.create({ recordId: richId(), field: language === 'en' ? 'en' : 'zh', legacyStyle: {} });
      if (!tr.doc.resolve(after).parent.canReplaceWith(tr.doc.resolve(after).index(), tr.doc.resolve(after).index(), paragraph.type)) return false;
      tr.insert(after, paragraph);
    }
    tr.setSelection(TextSelection.create(tr.doc, after + 1)).setStoredMarks([]);
    if (dispatch) dispatch(tr.scrollIntoView());
    return true;
  };
}

export function paragraphAfterSelectedImage(options) {
  return context => {
    const { selection } = context.state;
    if (selection instanceof NodeSelection && selection.node.type.name === 'documentImage') return paragraphAfterImage(selection.from, options)(context);
    // Gap cursors sit between blocks rather than inside a text paragraph.
    if (selection.empty && !selection.$from.parent.isTextblock && selection.$from.nodeBefore?.type.name === 'documentImage') {
      return paragraphAfterImage(selection.from - selection.$from.nodeBefore.nodeSize, options)(context);
    }
    return false;
  };
}

export function paragraphBeforeImage(position, { language = 'zh', reusePrevious = false } = {}) {
  return ({ state, dispatch }) => {
    const image = state.doc.nodeAt(position);
    if (image?.type.name !== 'documentImage' || image.attrs.item?.isFloating) return false;
    const previous = state.doc.resolve(position).nodeBefore;
    const reuse = previous?.type.name === 'paragraph' && (reusePrevious || previous.content.size === 0);
    const tr = state.tr;
    let caret = position - 1;
    if (!reuse) {
      const paragraph = state.schema.nodes.paragraph.create({ recordId: richId(), field: language === 'en' ? 'en' : 'zh', legacyStyle: {} });
      const boundary = tr.doc.resolve(position);
      if (!boundary.parent.canReplaceWith(boundary.index(), boundary.index(), paragraph.type)) return false;
      tr.insert(position, paragraph); caret = position + 1;
    }
    tr.setSelection(TextSelection.create(tr.doc, caret)).setStoredMarks([]);
    if (dispatch) dispatch(tr.scrollIntoView());
    return true;
  };
}

export function paragraphBeforeSelectedImage(options) {
  return context => context.state.selection instanceof NodeSelection && context.state.selection.node.type.name === 'documentImage'
    ? paragraphBeforeImage(context.state.selection.from, options)(context) : false;
}
