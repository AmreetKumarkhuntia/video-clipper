import type { Snippet } from 'svelte';
import type { ChannelSummary, VideoDetails, VideoSummary } from '@lib/types/youtube.js';
import type { ConfigFieldDescriptor, ConfigGroupDescriptor } from '@lib/types/config.js';
import type { TranscriptLine } from '@lib/types/transcript.js';
import type { ActivityPhase, AnalysisActivityItem, HighlightRange } from './activity.js';
import type { ClipArtifact, ClipCandidate, ClipPlan } from './analysis.js';
import type {
  ClipEdits,
  TextStyle,
  Position,
  SubtitleLine,
  TextOverlay,
  CropRect,
  Placement,
} from '@lib/types/clipEdit.js';
import type { PublishDraftItem, PublishDraftItemEvent, UploadArtifact } from './publish.js';
import type { UploadQueueItem } from './upload.js';
import type { SectionConfig, SelectOption, Toast } from './web.js';
import type { VideoWorkflowStep } from './workflow.js';
import type { UserCaptionPreset } from './captionPreset.js';

// ---------- UI primitives ----------

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';
export type ButtonType = 'button' | 'submit' | 'reset';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: ButtonType;
  disabled?: boolean;
  href?: string;
  class?: string;
  role?: string;
  onclick?: (e: MouseEvent) => void;
  children: Snippet;
  'aria-label'?: string;
  title?: string;
}

export type BadgeVariant = 'neutral' | 'clay' | 'success' | 'warn' | 'error' | 'info' | 'mono';

export interface BadgeProps {
  variant?: BadgeVariant;
  class?: string;
  title?: string;
  'aria-label'?: string;
  children: Snippet;
}

export type CardElement = 'article' | 'aside' | 'section' | 'div';

export interface CardProps {
  as?: CardElement;
  interactive?: boolean;
  class?: string;
  children: Snippet;
}

export interface CheckboxProps {
  id?: string;
  checked?: boolean;
  disabled?: boolean;
  /** Inline label text rendered next to the checkbox */
  label?: string;
  class?: string;
  onchange?: (checked: boolean) => void;
}

export interface FieldProps {
  label?: string;
  for?: string;
  help?: string;
  error?: string;
  required?: boolean;
  class?: string;
  children: Snippet;
}

export interface IconProps {
  name: string;
  size?: number;
}

export type InputTextType = 'text' | 'password' | 'number' | 'email' | 'url' | 'search' | 'tel';
export type InputTextSize = 'sm' | 'md' | 'lg';
export type InputTextInputMode =
  | 'text'
  | 'numeric'
  | 'decimal'
  | 'email'
  | 'search'
  | 'tel'
  | 'url';

export interface InputTextProps {
  id?: string;
  type?: InputTextType;
  size?: InputTextSize;
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  secret?: boolean;
  error?: boolean;
  maxlength?: number;
  autocomplete?: HTMLInputElement['autocomplete'];
  inputmode?: InputTextInputMode;
  /** Snippet rendered as the leading icon inside the input */
  icon?: Snippet;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  class?: string;
  oninput?: (value: string) => void;
  onchange?: (value: string) => void;
}

export interface PaginationProps {
  hasPrev?: boolean;
  hasNext?: boolean;
  onprev?: () => void;
  onnext?: () => void;
}

export interface SelectProps {
  id?: string;
  value?: string;
  options?: SelectOption<string>[];
  disabled?: boolean;
  error?: boolean;
  class?: string;
  onchange?: (value: string) => void;
}

export interface SliderProps {
  id?: string;
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /** Show the numeric value label to the right (default true) */
  showValue?: boolean;
  onchange?: (value: number | undefined) => void;
}

export interface TextareaProps {
  id?: string;
  value?: string;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  /** Render in monospace font — use for config/token fields */
  monospace?: boolean;
  error?: boolean;
  class?: string;
  el?: HTMLTextAreaElement | undefined;
  oninput?: (value: string) => void;
  onchange?: (value: string) => void;
  onkeydown?: (e: KeyboardEvent) => void;
}

export interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  class?: string;
}

export interface ToastProps {
  toast: Toast;
  ondismiss?: (id: string) => void;
}

export interface ToggleProps {
  id?: string;
  checked?: boolean;
  disabled?: boolean;
  /** Accessible label for the toggle — shown to screen readers */
  ariaLabel?: string;
  onchange?: (checked: boolean) => void;
}

export interface PanelHeaderProps {
  /** Inline section label (mono, uppercase) */
  text: string;
  /** Optional muted hint shown on the right */
  hint?: string;
  class?: string;
}

export interface SegmentedControlOption<T extends string = string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedControlOption<T>[];
  value: T;
  orientation?: 'row' | 'col';
  disabled?: boolean;
  ariaLabel?: string;
  onchange: (value: T) => void;
}

export interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Suffix appended to the mono value readout, e.g. "px" */
  suffix?: string;
  disabled?: boolean;
  onchange: (value: number) => void;
}

export type ColorSwatchKind = 'white' | 'yellow' | 'black' | 'transparent' | 'custom';

export interface ColorSwatchProps {
  /** Visual preset for the chip. `custom` uses the `value` color directly. */
  kind: ColorSwatchKind;
  label: string;
  /** Hex color shown when kind is `custom`. Also the value emitted when the user picks a new color. */
  value?: string | null;
  disabled?: boolean;
  /** Called with the new hex when the user picks via the native color input. */
  onchange?: (value: string) => void;
  /** Called on click when no onchange is wired (e.g., for preset kinds that just select). */
  onclick?: () => void;
}

export interface TimecodeInputProps {
  id?: string;
  /** Time value in seconds. */
  valueSec: number;
  disabled?: boolean;
  /** Called with a new seconds value when the input parses to a valid timecode. */
  onchange: (valueSec: number) => void;
}

export interface ScrubberProps {
  value: number;
  max: number;
  step?: number;
  disabled?: boolean;
  ariaLabel?: string;
  onchange: (value: number) => void;
}

export interface ToggleRowProps {
  title?: string;
  titleContent?: Snippet;
  description?: string;
  checked: boolean;
  ariaLabel?: string;
  onchange: (checked: boolean) => void;
  class?: string;
}

export interface TabOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export interface TabsProps<T extends string> {
  options: TabOption<T>[];
  value: T;
  ariaLabel?: string;
  onchange: (value: T) => void;
}

export interface SkeletonProps {
  width?: string;
  height?: string;
  short?: boolean;
  style?: string;
  class?: string;
}

export interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onconfirm: () => void;
  oncancel: () => void;
}

// ---------- Cards ----------

export interface CandidateCardProps {
  candidate: ClipCandidate;
  ontoggle?: () => void;
}

export interface ChannelCardProps {
  channel: ChannelSummary;
}

export interface VideoCardProps {
  video: VideoSummary;
}

// ---------- Analysis ----------

export interface AnalysisProgressProps {
  analyzedChunks?: number;
  totalChunks?: number;
  phase?: ActivityPhase;
  items?: AnalysisActivityItem[];
}

// ---------- Publish feature ----------

export interface PublishDraftCardProps {
  item: PublishDraftItem;
  index: number;
  onupdate?: (detail: PublishDraftItemEvent) => void;
  onopen?: (detail: PublishDraftItemEvent) => void;
}

export interface PublishDraftEditorProps {
  item: PublishDraftItem;
  index: number;
  onupdate?: (detail: PublishDraftItemEvent) => void;
  ongenerate?: (detail: PublishDraftItemEvent) => void;
  onclose?: () => void;
}

export interface UploadStatusCardProps {
  upload?: UploadArtifact | null;
  queueItem?: UploadQueueItem | null;
}

// ---------- Settings feature ----------

export interface ConfigFieldProps {
  field: ConfigFieldDescriptor;
  value: unknown;
  onupdate?: (key: string, value: unknown) => void;
}

export interface ProviderDef {
  key: string;
  name: string;
  defaultModel: string;
  badge?: string;
}

export interface ConfigInputProviderGridProps {
  value: string;
  onchange?: (value: string) => void;
}

export interface ConfigSectionProps {
  group: ConfigGroupDescriptor;
  values: Record<string, unknown>;
  sections?: SectionConfig[];
  onupdate?: (key: string, value: unknown) => void;
}

// ---------- Video feature ----------

export interface ClipPlanSummaryProps {
  plan?: ClipPlan | null;
  videoId: string;
}

export interface ClipTimelineProps {
  durationSec: number;
  candidates: ClipCandidate[];
  activeCandidateId?: string;
  isStreaming?: boolean;
  onSelect?: (id: string) => void;
}

export interface TranscriptPanelProps {
  lines?: TranscriptLine[];
  chunkCount?: number;
  highlightRanges?: HighlightRange[];
  activeRange?: HighlightRange;
  onClear?: () => void;
}

export interface VideoDetailsRailProps {
  video: VideoDetails;
  isLoadingTranscript?: boolean;
  isAnalyzing?: boolean;
  errorMessage?: string;
  onLoadTranscript?: () => void;
  onPlanClips?: () => void;
  onStop?: () => void;
}

export interface VideoWorkflowStepperProps {
  steps?: VideoWorkflowStep[];
}

// ---------- Routes ----------

export interface VideoLayoutProps {
  children: Snippet;
}

// ---------- Clip editor ----------

export interface CaptionTemplate {
  id: string;
  name: string;
  style: TextStyle;
  position: Position;
}

export interface ClipEditorProps {
  clip: ClipArtifact;
  candidate: ClipCandidate | null;
  videoId: string;
  onclose: () => void;
}

export interface ClipEditorCanvasProps {
  clip: ClipArtifact;
  edits: ClipEdits;
  currentTime?: number;
  videoEl?: HTMLVideoElement | null;
  selectedItemId?: string | null;
  onSelectItem?: (id: string) => void;
  onupdate?: (edits: ClipEdits) => void;
}

export interface ClipEditorPropertiesPanelProps {
  edits: ClipEdits;
  selectedItemId: string | null;
  onupdate: (edits: ClipEdits) => void;
}

export interface ClipEditorTemplatesProps {
  edits: ClipEdits;
  onupdate: (edits: ClipEdits) => void;
}

export interface ClipEditorTimelineProps {
  edits: ClipEdits;
  durationSec: number;
  currentTime: number;
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  onSeek: (sec: number) => void;
  onupdate: (edits: ClipEdits) => void;
}

export interface CaptionPresetProps {
  /** Stable id used for the visual variant class, e.g. "bold-white" / "karaoke". */
  id: string;
  label: string;
  active: boolean;
  onclick: () => void;
}

export interface PlaybackBarProps {
  videoEl: HTMLVideoElement | null;
  currentTime: number;
  durationSec: number;
  isPlaying: boolean;
}

export interface FocusPickerProps {
  focus: { xCenter: number; yCenter: number };
  containerEl: HTMLElement | null;
  onchange: (focus: { xCenter: number; yCenter: number }) => void;
}

export interface ClipEditorCropPanelProps {
  crop: CropRect;
  onchange: (crop: CropRect) => void;
}

export interface ClipEditorPlacementPanelProps {
  placement: Placement;
  onchange: (placement: Placement) => void;
}

export type TimelineSegmentKind = 'sub' | 'overlay' | 'trim';

export interface TimelineSegmentProps {
  kind: TimelineSegmentKind;
  leftPct: number;
  widthPct: number;
  label?: string;
  selected?: boolean;
  onclick?: () => void;
  /** Optional inner content (e.g. resize handles + draggable body). When provided, `label` is ignored. */
  children?: Snippet;
}

export interface SelectionHeaderProps {
  kindLabel: string;
  valueLabel: string;
  badgeText?: string;
  badgeVariant?: BadgeVariant;
  ondelete?: () => void;
  deleteLabel?: string;
}

export interface CanvasSubtitleProps {
  line: SubtitleLine;
  currentTime: number;
}

export interface CanvasOverlayProps {
  overlay: TextOverlay;
  selected: boolean;
  containerEl: HTMLElement | null;
  onSelect: () => void;
  onUpdate: (overlay: TextOverlay) => void;
}

export interface ClipPreviewModalProps {
  clipId: string;
  onclose: () => void;
}

export interface SavePresetDialogProps {
  style: TextStyle;
  position: Position;
  /** If set, the dialog pre-fills the name and offers an "Update" path. */
  existingPresetId?: string;
  existingPresetName?: string;
  onSave: (name: string, id?: string) => void;
  onCancel: () => void;
}

export interface UserPresetChipProps {
  preset: UserCaptionPreset;
  active: boolean;
  onApply: () => void;
  onEdit: (preset: UserCaptionPreset) => void;
  onDelete: (id: string) => void;
}

export interface VideoQaPanelProps {
  videoId: string;
  transcriptReady: boolean;
  onSeek: (timeSec: number) => void;
}
