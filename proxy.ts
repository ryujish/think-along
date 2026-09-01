import { NextRequest, NextResponse } from 'next/server';

const ONBOARDING_COOKIE = 'think_along_onboarding_v1';
const SESSION_COOKIE = 'think_along_session';

export function proxy(request: NextRequest) {
  const onboardingDone = request.cookies.get(ONBOARDING_COOKIE)?.value === 'done';
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (onboardingDone || hasSession) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/start';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/'],
};
