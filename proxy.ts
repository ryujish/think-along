import { NextRequest, NextResponse } from 'next/server';

const ONBOARDING_COOKIE = 'think_along_onboarding_v1';

export function proxy(request: NextRequest) {
  if (request.cookies.get(ONBOARDING_COOKIE)?.value === 'done') return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/start';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/'],
};
