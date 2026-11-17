import type { SessionCommand } from './director-session';
export const remoteSessionCookie: string;
export function getRemoteStore(): {
  dispatch: (action: string, body: Record<string, unknown>, auth?: { sessionToken?: string; deviceToken?: string }) => unknown;
  thinkRelayTarget: (token?: string) => { projectId: string; revision: number } | null;
} | null;
export function handleRemoteRequest(request: Request, hooks?: {
  prepare?: (body: { id: string; params: Record<string, unknown> }, request: Request, account: { email: string }) => Promise<Record<string, unknown>>;
  accepted?: (command: SessionCommand) => Promise<unknown>;
  settled?: (command: SessionCommand) => Promise<unknown>;
  signedIn?: (account: { email: string }) => Promise<string>;
  signedOut?: () => string | Promise<string>;
}): Promise<Response>;
