// functions/[[path]].js
export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  const p = url.pathname.replace(/\/+$/, ""); // "", "/123", "/assets/.."

  // 1) Root -> HubSpot
  if (p === "") {
    return Response.redirect("https://www.wom.fm", 301);
  }

  // 2) Static / reserved passthrough
  const RESERVED = [
    "/slot", "/slot.html",
    "/assets", "/flyers", "/.well-known",
    "/robots.txt", "/favicon.ico", "/sitemap.xml",
    "/aliases.json"
  ];
  if (RESERVED.some(r => p === r || p.startsWith(r + "/"))) {
    return next();
  }

  // Small helpers
  const isId = (s) => /^\d{3,6}$/.test(String(s));
  const isSlug = (s) => /^[a-z0-9-]{3,32}$/i.test(String(s));
  const serveSlot = async () => {
    const slotResp = await fetch(new URL("/slot", url).toString(), { headers: request.headers });
    const headers = new Headers(slotResp.headers);
    headers.set("Cache-Control", "no-store, must-revalidate");
    headers.set("X-Fn", "flyer-slot");
    return new Response(slotResp.body, { status: slotResp.status, headers });
  };

  // 3) Load alias map (works with both schemas)
  let aliases = {};
  try {
    const mapRes = await fetch(new URL("/aliases.json", url).toString(), {
      headers: { accept: "application/json" },
      cf: { cacheTtl: 0 }
    });
    if (mapRes.ok) aliases = await mapRes.json();
  } catch (_) {}

  // resolve an alias entry to { id, slug, canonical, redirect }
  function resolveAliasEntry(key) {
    const raw = aliases?.[key];
    if (!raw) return null;

    // "whh": "welthungerhilfe"  (string)
    if (typeof raw === "string") {
      const val = String(raw);
      return {
        id: isId(val) ? val : null,
        slug: isSlug(val) ? val : null,
        canonical: false,
        redirect: false
      };
    }

    // object forms:
    // { to: "welthungerhilfe", redirect: true }
    // { id: "101", canonical: true }
    if (typeof raw === "object") {
      const to = raw.to != null ? String(raw.to) : null;
      const id = raw.id != null ? String(raw.id) : (isId(to) ? to : null);
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

  // find a canonical alias slug for a given id
  function canonicalForId(id) {
    id = String(id);
    for (const [slug, obj] of Object.entries(aliases)) {
      if (obj && typeof obj === "object" && String(obj.id || "") === id && obj.canonical) {
        return slug;
      }
    }
    return null;
  }

  // 4) Single-segment flyer code (/123, /1001, /whh, /welthungerhilfe)
  const m = p.match(/^\/(\d{3,6}|[a-z0-9-]{3,32})$/i);
  if (m) {
    const code = m[1];
    const lower = code.toLowerCase();

    // 4a) Numeric path: prefer canonical alias if present
    if (isId(lower)) {
      const canon = canonicalForId(lower);
      if (canon) {
        // Force the pretty URL publicly
        return Response.redirect(new URL(`/${canon}`, url).toString(), 301);
      }
      // No canonical alias → verify folder exists, then serve numeric slot
      const cfgUrl = new URL(`/flyers/${lower}/config.json`, url).toString();
      const ok = await fetch(cfgUrl, { headers: { accept: "application/json" }, cf: { cacheTtl: 0 } })
        .then(r => r.ok).catch(() => false);
      if (ok) return serveSlot();
      // numeric but missing → fall through to HubSpot
      return Response.redirect("https://www.wom.fm", 301);
    }

    // 4b) Alias path
    if (isSlug(lower)) {
      const entry = resolveAliasEntry(lower);
      if (entry) {
        // if a canonical alias exists for this id and this alias is not it, normalize
        if (entry.id) {
          const canon = canonicalForId(entry.id);
          if (canon && lower !== canon) {
            return Response.redirect(new URL(`/${canon}`, url).toString(), 301);
          }
          // verify flyer exists by id
          const cfgUrl = new URL(`/flyers/${entry.id}/config.json`, url).toString();
          const ok = await fetch(cfgUrl, { headers: { accept: "application/json" }, cf: { cacheTtl: 0 } })
            .then(r => r.ok).catch(() => false);
          if (ok) return serveSlot();
        }

        // legacy alias that points to another slug: "{ to: 'welthungerhilfe', redirect:true }"
        if (entry.slug && entry.redirect) {
          return Response.redirect(new URL(`/${entry.slug}`, url).toString(), 301);
        }
        if (entry.slug) {
          // keep alias URL; verify a folder with that slug exists (rare setup)
          const cfgUrl = new URL(`/flyers/${entry.slug}/config.json`, url).toString();
          const ok = await fetch(cfgUrl, { headers: { accept: "application/json" }, cf: { cacheTtl: 0 } })
            .then(r => r.ok).catch(() => false);
          if (ok) return serveSlot();
        }
      }

      // unknown alias → HubSpot
      return Response.redirect("https://www.wom.fm", 301);
    }
  }

  // 5) Anything else: if Pages returns 404, send to HubSpot
  const res = await next();
  if (res.status === 404) {
    return Response.redirect("https://www.wom.fm", 301);
  }
  return res;
}