export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  const p = url.pathname.replace(/\/+$/, '');

  const RESERVED = [
    '', '/slot.html',
    '/assets', '/flyers', '/.well-known',
    '/robots.txt', '/favicon.ico', '/sitemap.xml'
  ];
  if (RESERVED.some(r => p === r || p.startsWith(r + '/'))) {
    return next();
  }

  if (/^\/(\d{3}|[a-z0-9-]{3,32})$/i.test(p)) {
    const rewritten = new URL(url);
    rewritten.pathname = '/slot.html';
    return fetch(new Request(rewritten.toString(), request));
  }

  const res = await next();
  if (res.status === 404) return Response.redirect('https://www.wom.fm', 301);
  return res;
}