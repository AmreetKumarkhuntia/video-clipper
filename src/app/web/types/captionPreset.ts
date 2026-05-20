import type { TextStyle, Position } from '@lib/types/clipEdit.js';

/** A user-defined caption preset persisted in the database. */
export interface UserCaptionPreset {
  id: string;
  name: string;
  style: TextStyle;
  position: Position;
  createdAt: number;
  updatedAt: number;
}

/** Shape returned by GET /api/caption-presets. The style/position fields are raw JSON strings. */
export interface CaptionPresetApiRecord {
  id: string;
  name: string;
  style: string; // JSON: TextStyle
  position: string; // JSON: Position
  createdAt: number;
  updatedAt: number;
}
