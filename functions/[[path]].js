// /functions/[[path]].js
export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  const p = url.pathname.replace(/\/+$/, ""); // "", "/123", "/alias", "/assets/.."

  // ---------- Brand / host detection ----------
  function getBrand(hostname) {
    const h = String(hostname || "").toLowerCase();
    if (h === "cit.fm" || h === "www.cit.fm" || h === "stage.cit.fm") return "cit";
    return "wom";
  }
  const brand = getBrand(url.hostname);

  // ---------- Staging detection ----------
  const isStage = /^stage\.(wom|cit)\.fm$/i.test(url.hostname);
  function withStageRobots(r) {
    if (!isStage) return r;
    const headers = new Headers(r.headers);
    headers.set("X-Robots-Tag", "noindex, nofollow");
    return new Response(r.body, { status: r.status, headers });
  }

  // 1) Root -> domain-appropriate homepage
  if (p === "") {
    if (brand === "cit") {
      return Response.redirect("https://cit.fm", 301);
    }
    return Response.redirect("https://www.wom.fm", 301);
  }

  // 2) Static / reserved passthrough
  const RESERVED = [
    "/slot", "/slot.html",
    "/assets", "/resources", "/flyers", "/.well-known",
    "/robots.txt", "/favicon.ico", "/sitemap.xml", "/manifest.json",
    "/aliases", "/aliases.json"
  ];
  if (RESERVED.some(r => p === r || p.startsWith(r + "/"))) {
    const pass = await next();
    return withStageRobots(pass);
  }

  // ---------- Helpers ----------
  const isId   = (s) => /^\d{3,6}$/.test(String(s));
  const isSlug = (s) => /^[a-z0-9-]{3,64}$/i.test(String(s));

  async function fetchJson(pathname) {
    try {
      const r = await fetch(new URL(pathname, url).toString(), {
        headers: { accept: "application/json" },
        cf: { cacheTtl: 0 }
      });
      return r.ok ? r : null;
    } catch {
      return null;
    }
  }

  async function getFlyerConfigPath(id, brand) {
    const candidates = [
      `/flyers/${brand}/${id}/config.json`
    ];

    // Temporary WOM fallback during migration
    if (brand === "wom") {
      candidates.push(`/flyers/${id}/config.json`);
    }

    for (const candidate of candidates) {
      const r = await fetchJson(candidate);
      if (r) return candidate;
    }
    return null;
  }

  async function flyerExistsById(id, brand) {
    return !!(await getFlyerConfigPath(id, brand));
  }

  async function fetchAsset(pathname) {
    // Re-enter function; RESERVED will send it to next()
    return fetch(new URL(pathname, url).toString(), { headers: request.headers });
  }

  async function serveSlotInject({ id = null, slug = null, brand = "wom" }) {
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
    const boot = `<script>
window.__flyerId=${id ? `"${id}"` : "null"};
window.__aliasSlug=${slug ? `"${slug}"` : "null"};
window.__brand="${brand}";
</script>`;

    if (html.includes("</head>")) html = html.replace("</head>", boot + "</head>");
    else if (html.includes("</body>")) html = html.replace("</body>", boot + "</body>");
    else html += boot;

    const headers = new Headers(slotResp.headers);
    headers.set("Cache-Control", "no-store, must-revalidate");
    headers.set("X-Fn", "flyer-slot");
    headers.set("X-Brand", brand);
    if (isStage) headers.set("X-Robots-Tag", "noindex, nofollow");
    return new Response(html, { status: slotResp.status, headers });
  }

  // ---------- Load aliases ----------
  async function loadAliases(brand) {
    const candidates = [
      `/aliases/${brand}.json`
    ];

    // Temporary WOM fallback during migration
    if (brand === "wom") {
      candidates.push("/aliases.json");
    }

    for (const candidate of candidates) {
      const r = await fetchJson(candidate);
      if (r) {
        try {
          return await r.json();
        } catch {}
      }
    }
    return {};
  }

  const aliases = await loadAliases(brand);

  // Resolve a key in aliases map to a normalized shape
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
        return Response.redirect(new URL(`/${canon}`, url).toString(), 301);
      }

      if (await flyerExistsById(lower, brand)) {
        return serveSlotInject({ id: lower, slug: null, brand });
      }

      return Response.redirect(brand === "cit" ? "https://cit.fm" : "https://www.wom.fm", 301);
    }

    // Alias path
    if (isSlug(lower)) {
      const entry = resolveAliasEntry(lower);
      if (entry) {
        // Alias points directly to an id
        if (entry.id) {
          const canon = canonicalForId(entry.id);
          if (canon && lower !== canon) {
            return Response.redirect(new URL(`/${canon}`, url).toString(), 301);
          }

          if (await flyerExistsById(entry.id, brand)) {
            return serveSlotInject({ id: entry.id, slug: (canon || lower), brand });
          }

          return Response.redirect(brand === "cit" ? "https://cit.fm" : "https://www.wom.fm", 301);
        }

        // Legacy alias points to another slug
        if (entry.slug) {
          if (entry.redirect) {
            return Response.redirect(new URL(`/${entry.slug}`, url).toString(), 301);
          }

          const e2 = resolveAliasEntry(entry.slug.toLowerCase());
          if (e2?.id && await flyerExistsById(e2.id, brand)) {
            const canon = canonicalForId(e2.id);
            const finalSlug = canon || entry.slug.toLowerCase();
            return serveSlotInject({ id: e2.id, slug: finalSlug, brand });
          }
        }
      }

      return Response.redirect(brand === "cit" ? "https://cit.fm" : "https://www.wom.fm", 301);
    }
  }

  // 4) Anything else: let static try; if 404, go to domain homepage
  const res = await next();
  if (res.status === 404) {
    return Response.redirect(brand === "cit" ? "https://cit.fm" : "https://www.wom.fm", 301);
  }
  return withStageRobots(res);
}