import type { SessionCommand } from './director-session';
export function handleRemoteRequest(request: Request, hooks?: {
  prepare?: (body: { id: string; params: Record<string, unknown> }, request: Request) => Promise<Record<string, unknown>>;
  accepted?: (command: SessionCommand) => Promise<unknown>;
  settled?: (command: SessionCommand) => Promise<unknown>;
  signedIn?: (account: { email: string }) => Promise<string>;
  signedOut?: () => string | Promise<string>;
}): Promise<Response>;
