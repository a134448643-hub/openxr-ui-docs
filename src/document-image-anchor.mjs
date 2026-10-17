import { DOCUMENT_CANVAS_WIDTH, elementScale, floatingBox } from './document-canvas.mjs';

export function relativeBox(element, root) {
  const origin = root.getBoundingClientRect(), rect = element.getBoundingClientRect(), scale = elementScale(root);
  return { left: (rect.left - origin.left) / scale, top: (rect.top - origin.top) / scale, width: rect.width / scale, height: rect.height / scale };
}

// Only inline images can be references, so a pair of floating objects cannot
// form a cycle. The same image identity is shared by both document languages.
export function imageReferences(root, language, excludeId) {
  return [...root.querySelectorAll('.doc-rich-image[data-image-id]')].filter(node => node.dataset.imageId !== excludeId).flatMap(node => {
    const frame = node.querySelector(`[data-image-language="${language}"] .doc-image-frame`) || node.querySelector('.doc-image-frame');
    if (!frame) return [];
    const box = relativeBox(frame, root);
    return box.width > 0 && box.height > 0 ? [{ id: node.dataset.imageId, ...box }] : [];
  });
}

export function referenceLayout(box, reference) {
  return { id: reference.id, x: (box.left - reference.left) / reference.width, y: (box.top - reference.top) / reference.height, width: box.width / reference.width, height: box.height / reference.height };
}

export function placedBox(layout, columnWidth, originY = 0, reference) {
  const relative = layout?.referenceImage;
  if (reference && relative?.id === reference.id) return {
    left: reference.left + relative.x * reference.width,
    top: reference.top + relative.y * reference.height,
    width: relative.width * reference.width,
    height: relative.height * reference.height,
  };
  const box = floatingBox(layout, columnWidth);
  return { ...box, top: box.top + originY };
}

export function layoutFromBox(box, columnWidth, originY = 0, reference) {
  const width = columnWidth || DOCUMENT_CANVAS_WIDTH;
  const rx = box.left / width, ry = (box.top - originY) / width, rw = box.width / width, rh = box.height / width;
  return { x: rx * DOCUMENT_CANVAS_WIDTH, y: ry * DOCUMENT_CANVAS_WIDTH, width: rw * DOCUMENT_CANVAS_WIDTH, height: rh * DOCUMENT_CANVAS_WIDTH, rx, ry, rw, rh, ...(reference ? { referenceImage: referenceLayout(box, reference) } : {}) };
}

export function nearestReference(box, references) {
  const distance = image => Math.hypot(Math.max(image.left - box.left - box.width, box.left - image.left - image.width, 0), Math.max(image.top - box.top - box.height, box.top - image.top - image.height, 0));
  return [...references].sort((a, b) => distance(a) - distance(b))[0];
}
