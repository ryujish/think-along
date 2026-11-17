import { NextResponse } from 'next/server';
import { getAiProviderStatuses, getProviderCatalog, type RunnerCliStatus } from '@/lib/server/ai';
import { requireUser } from '@/lib/server/auth';
import { getRemoteStore, remoteSessionCookie } from '@/lib/server/remote-http.mjs';

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.user) return auth.response;

  const runners: RunnerCliStatus[] = [];
  const store = getRemoteStore();
  const token = request.headers.get('cookie')?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${remoteSessionCookie}=`))
    ?.slice(remoteSessionCookie.length + 1);
  if (store && token) {
    try {
      const authz = { sessionToken: token };
      const projects = store.dispatch('projects', {}, authz) as Array<{
        id: string; display_name: string; device: { id: string; name: string; online: boolean };
      }>;
      for (const project of projects) {
        const snapshot = store.dispatch('snapshot', { projectId: project.id }, authz) as {
          director?: { clis?: Array<{ id: string; available: boolean; version: string }> };
        } | null;
        runners.push({
          deviceId: project.device.id,
          deviceName: project.device.name || project.display_name,
          online: project.device.online,
          clis: (snapshot?.director?.clis ?? []).map((cli) => ({ id: cli.id, available: cli.available === true, version: cli.version || '' })),
        });
      }
    } catch {
      // Remote login required — local CLIs only.
    }
  }

  const providers = (await getAiProviderStatuses()).map((status) => ({
    ...status,
    runnerAvailable: runners.some((runner) => runner.online && runner.clis.some((cli) => cli.id === status.cli && cli.available)),
  }));

  return NextResponse.json({ providers, runners, catalog: getProviderCatalog() });
}
