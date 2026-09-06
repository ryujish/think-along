import path from 'node:path';
import { RemoteStore } from './remote-store.mjs';
let store;
const cookie = 'talo_cloud_session';
const response = (body, status = 200, headers = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
export async function handleRemoteRequest(request) {
 if (process.env.TALO_CLOUD_ENABLED !== '1') return response({ error: '서버 연결 기능이 활성화되지 않았습니다.' }, 503);
 const configured = process.env.TALO_CLOUD_ORIGIN || 'https://think-along.ai.kr';
 const origin = new URL(configured);
 if (origin.protocol !== 'https:' && !['127.0.0.1','localhost'].includes(origin.hostname)) return response({ error: 'HTTPS 서버 주소가 필요합니다.' }, 503);
 if (request.headers.get('host') !== origin.host) return response({ error: '잘못된 서버 주소입니다.' }, 403);
 const bearer = request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
 const browserOrigin = request.headers.get('origin');
 if (browserOrigin && browserOrigin !== origin.origin) return response({ error: '다른 출처의 요청입니다.' }, 403);
 if (!bearer && !browserOrigin && request.headers.get('x-talo-device') !== '1') return response({ error: '요청 출처가 필요합니다.' }, 403);
 try {
  const reader = request.body?.getReader(); let size = 0; const chunks = [];
  if (reader) { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 2 * 1024 * 1024) { await reader.cancel(); return response({ error: '요청 크기 상한 초과' }, 413); } chunks.push(Buffer.from(value)); } }
  const b = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!b || typeof b.action !== 'string') return response({ error: '요청 형식 오류' }, 400);
  if (!browserOrigin && !bearer && !['pair.start','pair.claim'].includes(b.action)) return response({ error: '인증이 필요합니다.' }, 401);
  if (['signup','login'].includes(b.action) && !browserOrigin) return response({ error: '웹에서 로그인하세요.' }, 403);
  store ||= new RemoteStore(process.env.TALO_CLOUD_DB || path.join(process.cwd(), 'data', 'talo-cloud.sqlite'));
  const token = request.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(cookie+'='))?.slice(cookie.length+1);
  const result = store.dispatch(b.action, b, { sessionToken: token, deviceToken: bearer });
  if (result?.error) return response({ error: result.error }, result.status || 409);
  const headers = {};
  if (result?.token && ['login','signup'].includes(b.action)) {
   headers['Set-Cookie'] = `${cookie}=${result.token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=604800${origin.protocol === 'https:' ? '; Secure' : ''}`;
   delete result.token;
  }
  if (b.action === 'logout') headers['Set-Cookie'] = `${cookie}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0${origin.protocol === 'https:' ? '; Secure' : ''}`;
  return response({ result }, 200, headers);
 } catch(error) { return response({ error: error.message || '서버 요청 실패' }, error.status || 400); }
}
