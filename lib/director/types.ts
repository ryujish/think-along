export type DirectorCli = 'codex' | 'claude' | 'agy' | 'muse';
export type DirectorRole = 'head' | 'builder' | 'reviewer';
export type DirectorRoles = Record<DirectorRole, DirectorCli>;
export type DirectorStepId = DirectorRole | 'verify' | 'decision';
export type DirectorStep = {
  id: DirectorStepId;
  cli?: DirectorCli;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  output: string;
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number;
};
export type DirectorRun = {
  id: string;
  thinkalong_session_id: string;
  goal: string;
  roles: DirectorRoles;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
  stage: DirectorStepId;
  steps: DirectorStep[];
  createdAt: string;
  finishedAt?: string;
  error?: string;
  files: string[];
  diff?: string;
  verdict?: 'pass' | 'changes_required';
  worktree?: string;
};
export type DirectorSnapshot = {
  roles: DirectorRoles;
  clis: { id: DirectorCli; name: string; available: boolean; version: string }[];
  activeRun?: DirectorRun;
  history: DirectorRun[];
};
export type DirectorProject = {
  id: string;
  display_name: string;
  kind?: 'director' | 'talo';
  device: { id: string; name: string; online: boolean; revoked: boolean; lastSeen: number };
};
export type DirectorCloudSnapshot = {
  director: DirectorSnapshot;
  cloud: { device: DirectorProject['device']; revision: number; synced: boolean; allowRun: boolean; allowCode: boolean; syncError?: string };
};
