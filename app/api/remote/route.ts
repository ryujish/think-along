import { handleRemoteRequest } from '@/lib/server/remote-http.mjs';
import { clearSessionCookie, currentUser, sessionCookie, signInWithEmail, signOut } from '@/lib/server/auth';
import { readDb, updateDb } from '@/lib/server/db';
import { createContextPacket } from '@/lib/server/context-engine';
import { directorSessionInput, recordDirectorRequest, recordDirectorResult } from '@/lib/server/director-session';
import { validateRoles } from '@/lib/director/protocol.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  return handleRemoteRequest(request, {
    async signedIn(account) {
      const { token } = await signInWithEmail({ email: account.email });
      return sessionCookie(token) + (new URL(request.url).protocol === 'https:' ? '; Secure' : '');
    },
    async signedOut() { await signOut(request); return clearSessionCookie(); },
    async prepare(body, req) {
      const user = await currentUser(req);
      if (!user) throw Object.assign(new Error('Think Along에 로그인한 뒤 실행하세요.'), { status: 401 });
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(body.id) || typeof body.params?.request !== 'string' || !body.params.request.trim() || body.params.request.length > 20000) {
        throw Object.assign(new Error('작업 요청 형식을 확인하세요.'), { status: 400 });
      }
      const roles = validateRoles(body.params.roles);
      const prepared = directorSessionInput(await readDb(), user.id, body.params.thinkalong_session_id, body.id, body.params.request.trim(), roles);
      const context = createContextPacket(prepared.input);
      if (JSON.stringify(context).length > 100000) throw Object.assign(new Error('전달 문맥이 너무 큽니다. 대화 전달 범위를 줄여주세요.'), { status: 400 });
      return { canonical: prepared.canonical, params: { request: body.params.request.trim(), roles, thinkalong_session_id: context.thinkalongSessionId, context } };
    },
    accepted: command => updateDb(db => recordDirectorRequest(db, command)),
    settled: command => updateDb(db => recordDirectorResult(db, command)),
  });
}
