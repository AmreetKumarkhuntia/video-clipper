export type VideoWorkflowStepId = 'analyze' | 'clip' | 'connect' | 'prepare' | 'publish';

export interface VideoWorkflowStep {
  id: VideoWorkflowStepId;
  label: string;
  number: number;
  href?: string;
  status: 'current' | 'complete' | 'upcoming' | 'locked';
}

const STEP_ORDER: VideoWorkflowStepId[] = ['analyze', 'clip', 'connect', 'prepare', 'publish'];

export function buildVideoWorkflowSteps(
  videoId: string | undefined,
  analysisId: string | undefined,
  pathname: string,
): VideoWorkflowStep[] {
  const currentStep = getCurrentStep(pathname, analysisId);
  const currentIndex = STEP_ORDER.indexOf(currentStep);
  const analyzeHref = videoId ? `/videos/${videoId}` : undefined;
  const clipHref = videoId && analysisId ? `/videos/${videoId}/analysis/${analysisId}` : undefined;
  const connectHref =
    videoId && analysisId ? `/videos/${videoId}/analysis/${analysisId}/connect` : undefined;
  const prepareHref =
    videoId && analysisId ? `/videos/${videoId}/analysis/${analysisId}/prepare` : undefined;
  const publishHref =
    videoId && analysisId ? `/videos/${videoId}/analysis/${analysisId}/publish` : undefined;

  return [
    createStep('analyze', 'Analyze', 1, analyzeHref, currentIndex),
    createStep('clip', 'Clip', 2, clipHref, currentIndex),
    createStep('connect', 'Connect', 3, connectHref, currentIndex),
    createStep('prepare', 'Prepare', 4, prepareHref, currentIndex),
    createStep('publish', 'Publish', 5, publishHref, currentIndex),
  ];
}

function getCurrentStep(pathname: string, analysisId: string | undefined): VideoWorkflowStepId {
  if (analysisId && pathname.includes(`/analysis/${analysisId}/publish`)) return 'publish';
  if (analysisId && pathname.includes(`/analysis/${analysisId}/prepare`)) return 'prepare';
  if (analysisId && pathname.includes(`/analysis/${analysisId}/connect`)) return 'connect';
  if (analysisId && pathname.includes(`/analysis/${analysisId}`)) return 'clip';
  return 'analyze';
}

function createStep(
  id: VideoWorkflowStepId,
  label: string,
  number: number,
  href: string | undefined,
  currentIndex: number,
): VideoWorkflowStep {
  const index = STEP_ORDER.indexOf(id);

  if (index < currentIndex) {
    return { id, label, number, href, status: 'complete' };
  }

  if (index === currentIndex) {
    return { id, label, number, href, status: 'current' };
  }

  return { id, label, number, href, status: href ? 'upcoming' : 'locked' };
}
