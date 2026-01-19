(function(){
  const $ = s => document.querySelector(s);
  
  // Compact UI when the viewport is short or very narrow
  function updateCompact() {
    const compact = (window.innerHeight < 700) || (window.innerWidth < 360);
    document.documentElement.classList.toggle('compact', compact);
  }
  window.addEventListener('resize', updateCompact, { passive: true });
  updateCompact();

  // ---- Matomo base + custom dimensions ----
  const MATOMO_BASE = (window.WOM_MATOMO && window.WOM_MATOMO.base) || "https://metrics.wom.center/";
  const MATOMO_DIM  = { flyerId: 1, flyerType: 2, trackTitle: 3 }; // adjust/remove as needed
// ---- Canonical helpers ----
function canonicalSlug({ flyerId, aliasSlug } = {}) {
  const pathSlug = location.pathname.replace(/^\/+|\/+$/g, "");
  return (aliasSlug && aliasSlug.trim()) || pathSlug || String(flyerId || "").trim() || "unknown";
}
function ensureCanonicalLink(href) {
  try {
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); }
    link.href = href;
  } catch {}
}


  // Small helper
  function t(sec){ sec=sec|0; return ((sec/60)|0)+':'+('0'+(sec%60)).slice(-2); }

  // ---------- AUMA v1 helpers (one image per track, no timing) ----------
  const $id = (x) => document.getElementById(x);

  function showAuma(show){
    const sec = $id('auma');
    if (!sec) return;
    const on = !!show;
    sec.hidden = !on;                             // collapse from layout
    sec.classList?.toggle('hidden', !on);         // safe-guard if CSS uses .hidden
    document.documentElement.classList.toggle('has-auma', on); // lets CSS compact the UI
  }

  function setAumaImage(src, alt){
    const img = $id('auma-image') || document.querySelector('#auma img');
    if (!img) return;
    img.classList.remove('ready');
    img.onload = () => img.classList.add('ready');
    img.src = src;
    img.alt = alt || '';
  }

  // For the active track, show its image if present; otherwise hide AUMA section
  function setupAumaForTrack(track){
    if (!track){ showAuma(false); return; }
  
    // normalize image: allow string or object
    let art = null;
    if (track.image) {
      if (typeof track.image === 'string') {
        art = { src: track.image, alt: '' };
      } else if (track.image.src) {
        art = track.image;
      }
    } else if (track.cover_art_url) {
      art = { src: track.cover_art_url, alt: '' };
    }
  
    if (art?.src){
      setAumaImage(art.src, art.alt);
      showAuma(true);
      try { window._paq?.push(['trackEvent','Auma','Image', String(Amplitude.getActiveIndex?.() ?? 0)]); } catch(e){}
    } else {
      showAuma(false);
    }
  }
  
  // ---- Matomo wiring (per flyer) ----
  function wireMatomo({ siteId, flyerId, flyerType, title, aliasSlug }) {
  if (!siteId) return; // per-flyer only
  try {
    window._paq = window._paq || [];
    const _paq = window._paq;

    const slug = canonicalSlug({ flyerId, aliasSlug });
    const canonicalUrl = `${location.origin}/${slug}`;

    // Optional privacy toggles:
    // _paq.push(['disableCookies']);       // cookieless
    // _paq.push(['setDoNotTrack', true]);  // honor DNT

    _paq.push(['setTrackerUrl', MATOMO_BASE + 'matomo.php']);
    _paq.push(['setSiteId', String(siteId)]);
    _paq.push(['enableLinkTracking']);
    _paq.push(['enableHeartBeatTimer', 10]); // better time-on-page

    // Canonical hygiene
    _paq.push(['setCustomUrl', canonicalUrl]);
    _paq.push(['setReferrerUrl', document.referrer || '']);
    _paq.push(['setDocumentTitle', title || `WOM.fm / ${slug}`]);

    // Custom dimensions (only if you created them)
    if (MATOMO_DIM.flyerId)   _paq.push(['setCustomDimension', MATOMO_DIM.flyerId, String(flyerId)]);
    if (MATOMO_DIM.flyerType) _paq.push(['setCustomDimension', MATOMO_DIM.flyerType, String(flyerType||'')]);

    // Load tracker once + Pageview
    if (!document.getElementById('matomo-js')) {
      const g = document.createElement('script');
      g.id = 'matomo-js';
      g.async = true;
      g.src = MATOMO_BASE + 'matomo.js';
      g.onload = () => { try { _paq.push(['trackPageView']); } catch(e){} };
      document.head.appendChild(g);
    } else {
      _paq.push(['trackPageView']);
    }

    // Also inject a canonical link for SEO/consistency
    ensureCanonicalLink(canonicalUrl);

    // Soft “open” marker
    _paq.push(['trackEvent','Flyer','Open', slug]);

  } catch (e) {}
})();