export interface CommandHandler {
  name: string;
  description: string;
  usage: string;
  run: (argv: string[], requestId: string) => Promise<void>;
}

export interface AnalyzeArgs {
  url?: string;
  threshold?: number;
  topN?: number;
  maxChunks?: number;
  maxParallel?: number;
  noCache: boolean;
  noRefine: boolean;
  maxDuration?: number;
  help: boolean;
}

export interface ClipArgs {
  analysisId?: string;
  downloadSections?: 'all' | number;
  localVideo?: string;
  videoPath?: string;
  candidates?: number[];
  help: boolean;
}

export interface CandidatesArgs {
  analysisId?: string;
  json: boolean;
  help: boolean;
}

export interface LibraryArgs {
  mode: 'analyses' | 'clips';
  videoId?: string;
  json: boolean;
  help: boolean;
}

export interface ChannelArgs {
  input?: string;
  pageToken?: string;
  json: boolean;
  help: boolean;
}

export interface ConfigArgs {
  key?: string;
  value?: string;
  reset: boolean;
  help: boolean;
}

export interface AskArgs {
  url?: string;
  question?: string;
  reset: boolean;
  help: boolean;
}
