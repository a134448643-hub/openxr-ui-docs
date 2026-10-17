// Reference unit used by legacy layout records; it is not a page width.
export const DOCUMENT_CANVAS_WIDTH = 642;
// DOM rectangles are screen pixels; saved layouts use unscaled document pixels.
export function elementScale(element) {
  return element.offsetWidth ? element.getBoundingClientRect().width / element.offsetWidth || 1 : 1;
}
export function floatingBox(layout = {}, width = 642) {
  const value = (ratio, pixels, fallback) => Number.isFinite(ratio) ? ratio * width : (Number.isFinite(pixels) ? pixels : fallback) * width / 642;
  return { left: value(layout.rx, layout.x, 0), top: value(layout.ry, layout.y, 0), width: value(layout.rw, layout.width, 180), height: value(layout.rh, layout.height, 100) };
}
