import { handleRemoteRequest } from '@/lib/server/remote-http.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) { return handleRemoteRequest(request); }
