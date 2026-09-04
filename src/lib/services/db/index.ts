/**
 * Public entry point for the db service.
 *
 * Exposes migrations and every repo function. The drizzle client itself
 * (`client.js`) is internal — consumers never receive the raw handle.
 */
export { runMigrations } from './migrate.js';
export { initDb, getDb } from './client.js';

export { clearDatabase } from './repos/adminRepo.js';
export {
  saveAnalysisToDb,
  getAnalysisFromDb,
  getLatestAnalysisByVideoId,
  listAnalysesFromDb,
} from './repos/analysesRepo.js';
export {
  listCaptionPresets,
  getCaptionPreset,
  createCaptionPreset,
  updateCaptionPreset,
  deleteCaptionPreset,
} from './repos/captionPresetsRepo.js';
export { upsertChannel, findChannel } from './repos/channelsRepo.js';
export {
  findCustomerIdByIdentity,
  findIdentity,
  linkIdentity,
  unlinkIdentity,
} from './repos/authIdentitiesRepo.js';
export {
  findCustomerById,
  findCustomerByChannelId,
  createCustomer,
  updateCustomerProfile,
} from './repos/customersRepo.js';
export {
  findChunks,
  upsertChunks,
  deleteChunks,
  setChunkAnalysisByRange,
  clearChunkAnalysis,
} from './repos/chunksRepo.js';
export {
  getClipRow,
  getClip,
  listClips,
  listClipsByAnalysisId,
  listClipsByVideoId,
  upsertClip,
  setClipEdits,
  setClipRender,
  deleteClip,
  deleteClipsByAnalysisId,
} from './repos/clipsRepo.js';
export { upsertPublishDraft, getPublishDraftByAnalysisId } from './repos/publishDraftsRepo.js';
export { findQaMessages, insertQaMessage, clearQaMessages } from './repos/qaMessagesRepo.js';
export {
  findSegmentations,
  insertSegmentation,
  markSegmentationsComplete,
  upsertSegmentations,
  clearSegmentations,
} from './repos/segmentationsRepo.js';
export {
  upsertUploadArtifact,
  listUploadArtifactsByAnalysisId,
} from './repos/uploadArtifactsRepo.js';
export {
  insertSession,
  findValidSession,
  deleteSession,
  deleteExpiredSessions,
} from './repos/sessionsRepo.js';
export {
  upsertVideo,
  findVideo,
  findVideosByIds,
  saveTranscript,
  findTranscriptLines,
  clearTranscript,
} from './repos/videosRepo.js';

export {
  saveLibraryVideo,
  removeLibraryVideo,
  findSavedVideoIds,
  listLibraryVideos,
} from './repos/libraryVideosRepo.js';
