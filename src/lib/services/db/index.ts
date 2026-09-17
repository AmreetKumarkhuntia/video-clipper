/**
 * Public entry point for the db service.
 *
 * Exposes lifecycle, migration, transaction-context, and repository operations.
 * `getDb()` resolves to the current transaction handle when one is active.
 */
export { runMigrations, assertMigrationsCurrent } from './migrate.js';
export { initDb, getDb, pingDb, closeDb, withDbTransaction } from './client.js';

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
  reencryptIdentityTokens,
  hasEncryptedIdentityTokens,
  validateEncryptedIdentityTokens,
} from './repos/authIdentitiesRepo.js';
export {
  findCustomerById,
  findCustomerByChannelId,
  createCustomer,
  updateCustomerProfile,
  setCustomerRole,
  hasCustomerWithRole,
} from './repos/customersRepo.js';
export { findRolePermissions, lockInitialAdminBootstrap } from './repos/rolesRepo.js';
export {
  findChunks,
  upsertChunks,
  deleteChunks,
  setChunkAnalysisByRange,
  setChunkAnalysesByRange,
  clearChunkAnalysis,
} from './repos/chunksRepo.js';
export {
  getClipRow,
  getClip,
  listClips,
  listClipsByAnalysisId,
  listClipsByVideoId,
  upsertClip,
  persistGeneratedClips,
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
  upsertUploadArtifacts,
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
