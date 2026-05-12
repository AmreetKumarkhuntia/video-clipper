import type { Snippet } from 'svelte';
import type { ChannelSummary, VideoDetails, VideoSummary } from '@lib/types/youtube.js';
import type { ConfigFieldDescriptor, ConfigGroupDescriptor } from '@lib/types/config.js';
import type { TranscriptLine } from '@lib/types/transcript.js';
import type { ActivityPhase, AnalysisActivityItem, HighlightRange } from './activity.js';
import type { ClipArtifact, ClipCandidate, ClipPlan } from './analysis.js';
import type { ClipEdits, TextStyle, Position } from '@lib/types/clipEdit.js';
import type { PublishDraftItem, PublishDraftItemEvent, UploadArtifact } from './publish.js';
import type { UploadQueueItem } from './upload.js';
import type { SectionConfig, SelectOption, Toast } from './web.js';
import type { VideoWorkflowStep } from './workflow.js';

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
  onclick?: (e: MouseEvent) => void;
  children: Snippet;
  'aria-label'?: string;
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
  oninput?: (value: string) => void;
  onchange?: (value: string) => void;
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
  onupdate: (edits: ClipEdits) => void;
}
