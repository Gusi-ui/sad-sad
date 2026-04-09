import { defineMiddleware } from 'astro/middleware';
import { getSessionAccount } from './lib/auth';

const isAdminPath = (pathname: string) => pathname === '/admin' || pathname.startsWith('/admin/');
const isWorkerPath = (pathname: string) => pathname === '/w' || pathname.startsWith('/w/');
const isPublicPath = (pathname: string) =>
  pathname === '/login' ||
  pathname === '/api/auth/login' ||
  pathname === '/api/auth/logout' ||
  pathname === '/api/auth/me' ||
  pathname.startsWith('/_astro/') ||
  pathname.startsWith('/favicon') ||
  pathname.startsWith('/assets/');

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = new URL(context.request.url);

  if (isPublicPath(pathname)) return next();

  const account = await getSessionAccount(context as never);
  context.locals.account = account;

  if (!account) return context.redirect('/login');

  if (isAdminPath(pathname) && account.role !== 'ADMIN') return context.redirect('/unauthorized');
  if (isWorkerPath(pathname) && account.role !== 'WORKER') return context.redirect('/unauthorized');

  return next();
});

