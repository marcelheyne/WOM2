// /functions/[[path]].js
export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  const p = url.pathname.replace(/\/+$/, ""); // "", "/123", "/alias", "/assets/.."

  // --- staging detection + helper to inject robots header ---
  const isStage = /^stage\.wom\.fm$/i.test(url.hostname);
  function withStageRobots(r) {
    if (!isStage) return r;
    const headers = new Headers(r.headers);
    headers.set("X-Robots-Tag", "noindex, nofollow");
    return new Response(r.body, { status: r.status, headers });
  }

  // 1) Root -> HubSpot (leave redirects untouched)
  if (p === "") {
    return Response.redirect("https://www.wom.fm", 301);
  }

  // 2) Static / reserved passthrough
  const RESERVED = [
    "/slot", "/slot.html",
    "/assets", "/resources", "/flyers", "/.well-known",
    "/robots.txt", "/favicon.ico", "/sitemap.xml", "/manifest.json",
    "/aliases.json"
  ];
  if (RESERVED.some(r => p === r || p.startsWith(r + "/"))) {
    const pass = await next();
    return withStageRobots(pass);
  }

  // ---------- Helpers ----------
  const isId   = (s) => /^\d{3,6}$/.test(String(s));
  const isSlug = (s) => /^[a-z0-9-]{3,64}$/i.test(String(s));

  async function flyerExistsById(id) {
    try {
      const cfgUrl = new URL(`/flyers/${id}/config.json`, url).toString();
      const r = await fetch(cfgUrl, { headers: { accept: "application/json" }, cf: { cacheTtl: 0 } });
      return r.ok;
    } catch { return false; }
  }

  async function fetchAsset(pathname) {
    // Re-enter function; RESERVED will send it to next()
    return fetch(new URL(pathname, url).toString(), { headers: request.headers });
  }

  async function serveSlotInject({ id = null, slug = null }) {
    // Try /slot first, then /slot.html
    let slotResp = await fetchAsset("/slot");
    if (!slotResp.ok || !(slotResp.headers.get("content-type") || "").includes("text/html")) {
      slotResp = await fetchAsset("/slot.html");
    }

    const ct = slotResp.headers.get("content-type") || "";
    if (!ct.includes("text/html")) {
      return withStageRobots(slotResp);
    }

    let html = await slotResp.text();
    const boot = `<script>window.__flyerId=${id ? `"${id}"` : "null"};window.__aliasSlug=${slug ? `"${slug}"` : "null"};</script>`;
    if (html.includes("</head>")) html = html.replace("</head>", boot + "</head>");
    else if (html.includes("</body>")) html = html.replace("</body>", boot + "</body>");
    else html += boot;

    const headers = new Headers(slotResp.headers);
    headers.set("Cache-Control", "no-store, must-revalidate");
    headers.set("X-Fn", "flyer-slot");
    if (isStage) headers.set("X-Robots-Tag", "noindex, nofollow");
    return new Response(html, { status: slotResp.status, headers });
  }

  // Load aliases map (supports several schemas)
  let aliases = {};
  try {
    const mapRes = await fetch(new URL("/aliases.json", url).toString(), {
      headers: { accept: "application/json" }, cf: { cacheTtl: 0 }
    });
    if (mapRes.ok) aliases = await mapRes.json();
  } catch {}

  // Resolve a key in aliases.json to a normalized shape
  function resolveAliasEntry(key) {
    const raw = aliases?.[key];
    if (!raw) return null;

    if (typeof raw === "string") {
      const val = String(raw);
      return {
        id: isId(val) ? val : null,
        slug: isSlug(val) ? val : null,
        canonical: false,
        redirect: false
      };
    }

    if (typeof raw === "object") {
      const to   = raw.to != null ? String(raw.to) : null;
      const id   = raw.id != null ? String(raw.id) : (isId(to) ? to : null);
      const slug = isSlug(to) ? to : null;
      return {
        id: isId(id) ? id : null,
        slug,
        canonical: !!raw.canonical,
        redirect: !!raw.redirect
      };
    }
    return null;
  }

  // Find canonical alias for a given id
  function canonicalForId(id) {
    id = String(id);
    for (const [slug, obj] of Object.entries(aliases)) {
      if (obj && typeof obj === "object" && String(obj.id || "") === id && obj.canonical) {
        return slug;
      }
    }
    return null;
  }

  // 3) Single-segment flyer code: /123, /1001, /whh, /welthungerhilfe
  const m = p.match(/^\/(\d{3,6}|[a-z0-9-]{3,64})$/i);
  if (m) {
    const code = m[1];
    const lower = code.toLowerCase();

    // Numeric path
    if (isId(lower)) {
      const canon = canonicalForId(lower);
      if (canon) {
        // Publicly prefer pretty URL
        return Response.redirect(new URL(`/${canon}`, url).toString(), 301);
      }
      // No canonical alias → serve numeric if it exists
      if (await flyerExistsById(lower)) {
        return serveSlotInject({ id: lower, slug: null });
      }
      return Response.redirect("https://www.wom.fm", 301);
    }

    // Alias path
    if (isSlug(lower)) {
      const entry = resolveAliasEntry(lower);
      if (entry) {
        // If alias points to an id, normalize to canonical and serve
        if (entry.id) {
          const canon = canonicalForId(entry.id);
          if (canon && lower !== canon) {
            return Response.redirect(new URL(`/${canon}`, url).toString(), 301);
          }
          if (await flyerExistsById(entry.id)) {
            return serveSlotInject({ id: entry.id, slug: (canon || lower) });
          }
          return Response.redirect("https://www.wom.fm", 301);
        }

        // Legacy alias that points to another slug
        if (entry.slug) {
          if (entry.redirect) {
            return Response.redirect(new URL(`/${entry.slug}`, url).toString(), 301);
          }
          // Follow once, then serve if target has an id
          const e2 = resolveAliasEntry(entry.slug.toLowerCase());
          if (e2?.id && await flyerExistsById(e2.id)) {
            const canon = canonicalForId(e2.id);
            const finalSlug = canon || entry.slug.toLowerCase();
            return serveSlotInject({ id: e2.id, slug: finalSlug });
          }
        }
      }
      return Response.redirect("https://www.wom.fm", 301);
    }
  }

  // 4) Anything else: let static try; if 404, go to HubSpot
  const res = await next();
  if (res.status === 404) {
    return Response.redirect("https://www.wom.fm", 301);
  }
  return withStageRobots(res);
}