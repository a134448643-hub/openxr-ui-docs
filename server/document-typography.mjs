export const DEFAULT_TYPOGRAPHY = Object.freeze({ bodySize: 16, headingSize: 24, headingWeight: 700, lineHeight: 1.75, paragraphGap: 6, headingDivider: true });

export function normalizeTypography(value) {
  if (!value || typeof value !== 'object') return null;
  const number = (key, min, max) => Math.min(max, Math.max(min, Number(value[key]) || DEFAULT_TYPOGRAPHY[key]));
  return { bodySize: number('bodySize', 10, 36), headingSize: number('headingSize', 14, 64), headingWeight: Number(value.headingWeight) === 400 ? 400 : 700, lineHeight: number('lineHeight', 1, 3), paragraphGap: Math.min(36, Math.max(0, value.paragraphGap == null || !Number.isFinite(Number(value.paragraphGap)) ? DEFAULT_TYPOGRAPHY.paragraphGap : Number(value.paragraphGap))), headingDivider: value.headingDivider !== false };
}
