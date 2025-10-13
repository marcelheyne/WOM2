// functions/[[path]].js
export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  const p = url.pathname.replace(/\/+$/, ""); // "", "/123", "/assets/.."

  // 1) Let root and static paths pass through to Pages
  if (p === "") {
    return Response.redirect("https://www.wom.fm", 301);
  }

  const RESERVED = [
    "/slot", "/slot.html",
    "/assets", "/flyers", "/.well-known",
    "/robots.txt", "/favicon.ico", "/sitemap.xml",
    "/aliases.json"
  ];
  if (RESERVED.some(r => p === r || p.startsWith(r + "/"))) {
    return next();
  }

  // 2) Single-segment flyer code (/123, /1001, /whh, /welthungerhilfe)
  //    Accept 3–6 digits (e.g., 3-digit "Pro", 4-digit "Lite") OR 3–32 char slug
  const m = p.match(/^\/(\d{3,6}|[a-z0-9-]{3,32})$/i);
  if (m) {
    const code = m[1];
    const lower = code.toLowerCase();

    // Helper to serve slot content while keeping the current URL
    async function serveSlot() {
      const slotResp = await fetch(new URL("/slot", url).toString(), { headers: request.headers });
      const headers = new Headers(slotResp.headers);
      headers.set("Cache-Control", "no-store, must-revalidate");
      headers.set("X-Fn", "flyer-slot");
      return new Response(slotResp.body, { status: slotResp.status, headers });
    }

    // Try direct folder first (exact code)
    {
      const cfgUrl = new URL(`/flyers/${code}/config.json`, url).toString();
      const probe = await fetch(cfgUrl, { method: "GET", headers: { accept: "application/json" }, cf: { cacheTtl: 0 } });
      if (probe.ok) {
        return serveSlot();
      }
    }

    // If not found, try alias map
    try {
      const mapUrl = new URL("/aliases.json", url).toString();
      const mapRes = await fetch(mapUrl, { headers: { accept: "application/json" }, cf: { cacheTtl: 0 } });
      if (mapRes.ok) {
        const raw = await mapRes.json();
        const entry = raw?.[lower];
        if (entry) {
          const target = typeof entry === "string" ? entry : entry.to?.toString();
          const redirect = typeof entry === "object" && entry.redirect === true;

          if (target && /^[a-z0-9-]{3,32}$/i.test(target)) {
            // verify target flyer exists
            const tgtCfg = new URL(`/flyers/${target}/config.json`, url).toString();
            const ok = await fetch(tgtCfg, { headers: { accept: "application/json" }, cf: { cacheTtl: 0 } }).then(r => r.ok).catch(() => false);

            if (ok) {
              // Two modes: redirect to canonical (/101) or keep alias URL and just render slot
              if (redirect) {
                return Response.redirect(new URL(`/${target}`, url).toString(), 301);
              }
              // Keep alias URL visible but render the slot shell
              return serveSlot();
            }
          }
        }
      }
    } catch (_) { /* ignore alias errors, fall through */ }

    // Missing flyer/alias -> HubSpot
    return Response.redirect("https://www.wom.fm", 301);
  }

  // 3) Anything else: if Pages returns 404, send to HubSpot
  const res = await next();
  if (res.status === 404) {
    return Response.redirect("https://www.wom.fm", 301);
  }
  return res;
}