import { NodeSelection } from '@tiptap/pm/state';
import { Fragment, Slice } from '@tiptap/pm/model';
import { dropPoint } from '@tiptap/pm/transform';
import { closeHistory } from '@tiptap/pm/history';
import { richId } from '../server/document-rich-text.mjs';

export function dropExistingImage(view, event, id) {
  if (!id) return false;
  event.preventDefault();
  let source, sourcePosition;
  view.state.doc.descendants((node, position) => {
    if (node.type.name === 'documentImage' && node.attrs.item?.id === id && !node.attrs.item.isFloating && !node.attrs.anchorId) {
      source = node; sourcePosition = position;
    }
  });
  if (!source) return true;
  let destination;
  const target = event.target?.closest?.('[data-image-id]');
  if (target) {
    view.state.doc.descendants((node, position) => {
      if (node.type.name !== 'documentImage' || node.attrs.item?.id !== target.dataset.imageId || node.attrs.item.isFloating) return;
      const rect = (event.target.closest('[data-image-language]') || target).getBoundingClientRect();
      destination = position + (event.clientY >= rect.top + rect.height / 2 ? node.nodeSize : 0);
    });
  }
  if (destination == null) {
    const position = view.posAtCoords({ left: event.clientX, top: event.clientY });
    if (!position) return true;
    destination = dropPoint(view.state.doc, position.pos, new Slice(Fragment.from(source), 0, 0));
  }
  if (destination == null || (destination >= sourcePosition && destination <= sourcePosition + source.nodeSize)) return true;
  const copy = event.ctrlKey || event.metaKey;
  const tr = closeHistory(view.state.tr);
  if (!copy) tr.delete(sourcePosition, sourcePosition + source.nodeSize);
  const inserted = copy ? source.type.create({ ...source.attrs, item: { ...structuredClone(source.attrs.item), id: richId() } }) : source;
  destination = tr.mapping.map(destination);
  tr.insert(destination, inserted).setSelection(NodeSelection.create(tr.doc, destination)).setMeta('uiEvent', 'drop');
  view.dispatch(tr.scrollIntoView()); view.focus();
  return true;
}
