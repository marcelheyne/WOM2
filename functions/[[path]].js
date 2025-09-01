// functions/[[path]].js
export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  const p = url.pathname.replace(/\/+$/, ""); // "", "/123", "/assets/.."

  // 1) Let root and static paths pass through to Pages
  if (p === "") return next();

  const RESERVED = [
    "/slot", "/slot.html",
    "/assets", "/flyers", "/.well-known",
    "/robots.txt", "/favicon.ico", "/sitemap.xml",
  ];
  if (RESERVED.some(r => p === r || p.startsWith(r + "/"))) {
    return next();
  }

  // 2) Single-segment flyer code (/123 or /alias)
  const m = p.match(/^\/(\d{3}|[a-z0-9-]{3,32})$/i);
  if (m) {
    const id = m[1];

    // Probe flyer existence (use GET; HEAD can be odd on static hosts)
    const cfgUrl = new URL(`/flyers/${id}/config.json`, url).toString();
    const probe = await fetch(cfgUrl, {
      method: "GET",
      headers: { accept: "application/json" },
      cf: { cacheTtl: 0 },
    });

    if (probe.ok) {
      // Serve the *content* of /slot while keeping URL as /<id>
      const slotResp = await fetch(new URL("/slot", url).toString(), { headers: request.headers });
      const headers = new Headers(slotResp.headers);
      headers.set("Cache-Control", "no-store, must-revalidate");
      headers.set("X-Fn", "flyer-slot"); // small debug hint
      return new Response(slotResp.body, { status: slotResp.status, headers });
    }

    // Missing flyer -> HubSpot
    return Response.redirect("https://www.wom.fm", 301);
  }

  // 3) Anything else: if Pages returns 404, send to HubSpot
  const res = await next();
  if (res.status === 404) {
    return Response.redirect("https://www.wom.fm", 301);
  }
  return res;
}