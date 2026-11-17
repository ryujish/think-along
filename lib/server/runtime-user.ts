import { currentUser } from './auth';
import { getRemoteStore, remoteSessionCookie } from './remote-http.mjs';
import { runtimeMode } from './cli-profile.mjs';

export async function requireRuntimeUser(request: Request, mutation = false) {
  const user = await currentUser(request);
  if (!user) throw Object.assign(new Error('로그인이 필요합니다.'), { status: 401 });
  const url = new URL(request.url);
  if (runtimeMode() === 'local') {
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw Object.assign(new Error('로컬 CLI는 로컬 웹에서만 연결할 수 있습니다.'), { status: 403 });
  } else {
    const token = request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(remoteSessionCookie + '='))?.slice(remoteSessionCookie.length + 1);
    const result = getRemoteStore()?.dispatch('me', {}, { sessionToken: token }) as { account?: { email: string } } | undefined;
    const account = result?.account;
    if (!account || account.email !== user.email) throw Object.assign(new Error('같은 계정으로 다시 로그인하세요.'), { status: 403 });
  }
  if (mutation && request.headers.get('origin') !== (process.env.TALO_CLOUD_ORIGIN || url.origin)) {
    throw Object.assign(new Error('다른 출처의 연결 요청입니다.'), { status: 403 });
  }
  return user;
}
