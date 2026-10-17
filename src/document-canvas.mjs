// Layout records already use this logical width for x/y/width/height. A fixed
// page keeps text wrapping and floating objects in the same coordinate system.
export const DOCUMENT_CANVAS_WIDTH = 642;
export const DOCUMENT_PAPER_WIDTH = DOCUMENT_CANVAS_WIDTH + 96 + 2;
export function canvasScale(viewportWidth) {
  return Math.min(1, Math.max(0.05, (viewportWidth - 28) / DOCUMENT_PAPER_WIDTH));
}
// DOM rectangles are screen pixels; saved layouts use unscaled document pixels.
export function elementScale(element) {
  return element.offsetWidth ? element.getBoundingClientRect().width / element.offsetWidth || 1 : 1;
}
export function hasFloatingContent(blocks = []) {
  return blocks.some(block => block.isFloating || block.attachments?.length);
}
export function floatingBox(layout = {}, width = 642) {
  const value = (ratio, pixels, fallback) => Number.isFinite(ratio) ? ratio * width : (Number.isFinite(pixels) ? pixels : fallback) * width / 642;
  return { left: value(layout.rx, layout.x, 0), top: value(layout.ry, layout.y, 0), width: value(layout.rw, layout.width, 180), height: value(layout.rh, layout.height, 100) };
}
