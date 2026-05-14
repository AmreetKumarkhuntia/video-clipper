/**
 * Converts a design-time font size (used in the canvas as `{designSize * 0.045}cqw`)
 * into an absolute pixel size for the FFmpeg output at the given output dimensions.
 *
 * Canvas formula: `font-size: {designSize * 0.045}cqw`
 *   where `1cqw = 1% of container width`
 *   so rendered px = designSize * 0.045 * containerWidth / 100
 *
 * At render time, containerWidth === outputDims.width.
 */
export function resolveRenderedFontSize(designSize: number, outputDims: { width: number }): number {
  return Math.round((designSize * 0.045 * outputDims.width) / 100);
}
