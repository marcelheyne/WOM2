export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  const p = url.pathname.replace(/\/+$/, ""); // "/123", "/assets/..", "" for root

  // Let the real root pass through
  if (p === "") return next();

  // Let static paths pass through
  const RESERVED = [
    "/slot", "/slot.html",
    "/assets", "/flyers", "/.well-known",
    "/robots.txt", "/favicon.ico", "/sitemap.xml",
  ];
  if (RESERVED.some(r => p === r || p.startsWith(r + "/"))) {
    return next();
  }

  // One-segment code (/123 or /alias) → return the /slot page *content*
  if (/^\/(\d{3}|[a-z0-9-]{3,32})$/i.test(p)) {
    const assetUrl = new URL("/slot", url); // fetch clean URL directly to avoid any 301
    const resp = await fetch(assetUrl.toString(), { headers: request.headers });
    const headers = new Headers(resp.headers);
    headers.set("Cache-Control", "no-store, must-revalidate");
    return new Response(resp.body, { status: resp.status, headers });
  }

  // Anything else: try static; true 404 → HubSpot
  const res = await next();
  if (res.status === 404) return Response.redirect("https://www.wom.fm", 301);
  return res;
}