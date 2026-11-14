// Next 16 proxy (formerly middleware): refreshes the Supabase session cookie on page requests
// and redirects between public and app routes. API routes do their own auth (lib/server/auth.ts).
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const APP_PREFIXES = ['/home', '/roadmap', '/map', '/people', '/feed', '/profile', '/pricing', '/billing', '/onboarding'];
const AUTH_PAGES = ['/login', '/signup'];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isApp = APP_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));

  const redirectTo = (pathname: string, search = '') => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = search;
    const res = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => res.cookies.set(c)); // keep refreshed session cookies
    return res;
  };

  if (!data.user && isApp) return redirectTo('/login', `?next=${encodeURIComponent(path + request.nextUrl.search)}`);
  if (data.user && AUTH_PAGES.includes(path)) return redirectTo('/home');
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff2?)$).*)'],
};
