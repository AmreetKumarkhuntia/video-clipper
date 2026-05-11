import { z } from 'zod';

export const ViewportPresetSchema = z.enum(['16:9', '9:16', '1:1']);
export type ViewportPreset = z.infer<typeof ViewportPresetSchema>;

export const CropFocusSchema = z.object({
  xCenter: z.number().min(0).max(1).default(0.5),
  yCenter: z.number().min(0).max(1).default(0.5),
});
export type CropFocus = z.infer<typeof CropFocusSchema>;

export const ViewportSchema = z.object({
  preset: ViewportPresetSchema.default('9:16'),
  focus: CropFocusSchema,
  fillMode: z.enum(['crop', 'pad-blur', 'pad-black']).default('crop'),
});
export type Viewport = z.infer<typeof ViewportSchema>;

export const TrimSchema = z.object({
  startSec: z.number().nonnegative().default(0),
  endSec: z.number().positive(),
});
export type Trim = z.infer<typeof TrimSchema>;

export const TextStyleSchema = z.object({
  fontFamily: z.string().default('Inter'),
  fontSize: z.number().int().positive().default(48),
  weight: z.number().int().min(100).max(900).default(700),
  color: z.string().default('#FFFFFF'),
  highlightColor: z.string().default('#FFD60A'),
  bgColor: z.string().nullable().default(null),
  outlineColor: z.string().nullable().default('#000000'),
  outlineWidth: z.number().nonnegative().default(2),
  align: z.enum(['left', 'center', 'right']).default('center'),
});
export type TextStyle = z.infer<typeof TextStyleSchema>;

export const PositionSchema = z.object({
  xCenter: z.number().min(0).max(1).default(0.5),
  yCenter: z.number().min(0).max(1).default(0.85),
});
export type Position = z.infer<typeof PositionSchema>;

export const WordTokenSchema = z.object({
  text: z.string(),
  startSec: z.number().nonnegative(),
  endSec: z.number().positive(),
  highlight: z.boolean().default(false),
});
export type WordToken = z.infer<typeof WordTokenSchema>;

export const SubtitleLineSchema = z.object({
  id: z.string(),
  startSec: z.number().nonnegative(),
  endSec: z.number().positive(),
  text: z.string(),
  words: z.array(WordTokenSchema).default([]),
  position: PositionSchema,
  style: TextStyleSchema,
  templateId: z.string().optional(),
});
export type SubtitleLine = z.infer<typeof SubtitleLineSchema>;

export const TextOverlaySchema = z.object({
  id: z.string(),
  kind: z.enum(['banner', 'sticker']),
  startSec: z.number().nonnegative(),
  endSec: z.number().positive(),
  text: z.string(),
  position: PositionSchema,
  style: TextStyleSchema,
});
export type TextOverlay = z.infer<typeof TextOverlaySchema>;

export interface FilterGraphResult {
  filterComplex: string;
  mapLabel: string;
}

export const ClipEditsSchema = z.object({
  clipId: z.string(),
  schemaVersion: z.literal(1),
  trim: TrimSchema,
  viewport: ViewportSchema,
  subtitles: z.array(SubtitleLineSchema).default([]),
  overlays: z.array(TextOverlaySchema).default([]),
  updatedAt: z.string(),
});
export type ClipEdits = z.infer<typeof ClipEditsSchema>;
