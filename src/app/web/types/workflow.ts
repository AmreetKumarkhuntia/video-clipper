export type VideoWorkflowStepId = 'analyze' | 'clip' | 'connect' | 'prepare' | 'publish';

export interface VideoWorkflowStep {
  id: VideoWorkflowStepId;
  label: string;
  number: number;
  href?: string;
  status: 'current' | 'complete' | 'upcoming' | 'locked';
}
