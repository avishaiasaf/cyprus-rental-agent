export { auth as middleware } from '@/lib/auth';

export const config = {
  matcher: [
    // Protect all routes except: login, auth API, image-proxy, static files, _next
    '/((?!login|api/auth|api/image-proxy|_next/static|_next/image|favicon.ico).*)',
  ],
};
