export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  const p = url.pathname.replace(/\/+$/, ""); // "/123", "/assets/js/app.js", "" for root

  // Let the real root "/" pass straight through
  if (p === "") return next();

  // Let static files & known paths pass through
  const RESERVED = [
    "/slot", "/slot.html",
    "/assets", "/flyers", "/.well-known",
    "/robots.txt", "/favicon.ico", "/sitemap.xml",
  ];
  if (RESERVED.some((r) => p === r || p.startsWith(r + "/"))) {
    return next();
  }

  // /123 or simple alias → serve slot.html
  if (/^\/(\d{3}|[a-z0-9-]{3,32})$/i.test(p)) {
    const rewritten = new URL(url);
    rewritten.pathname = "/slot.html";
    return fetch(new Request(rewritten.toString(), request));
  }

  // Not a flyer: try static; true 404 → HubSpot
  const res = await next();
  if (res.status === 404) return Response.redirect("https://www.wom.fm", 301);
  return res;
}