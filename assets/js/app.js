(function(){
  const $ = s => document.querySelector(s);

  // ---- Matomo base + custom dimensions ----
  const MATOMO_BASE = (window.WOM_MATOMO && window.WOM_MATOMO.base) || "https://metrics.wom.center/";
  const MATOMO_DIM  = { flyerId: 1, flyerType: 2, trackTitle: 3 }; // adjust/remove as needed

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
  function wireMatomo({ siteId, flyerId, flyerType, title }) {
    if (!siteId) return; // per-flyer only; no siteId => no tracking
    try {
      window._paq = window._paq || [];
      const _paq = window._paq;

      // Optional privacy toggles:
      // _paq.push(['disableCookies']);       // cookieless
      // _paq.push(['setDoNotTrack', true]);  // honor DNT

      _paq.push(['setTrackerUrl', MATOMO_BASE + 'matomo.php']);
      _paq.push(['setSiteId', String(siteId)]);
      _paq.push(['enableLinkTracking']);
      _paq.push(['enableHeartBeatTimer', 10]); // better time-on-page
      _paq.push(['setCustomUrl', location.href]);
      if (title) _paq.push(['setDocumentTitle', title]);

      // Custom dimensions (only if you created them)
      if (MATOMO_DIM.flyerId)   _paq.push(['setCustomDimension', MATOMO_DIM.flyerId, String(flyerId)]);
      if (MATOMO_DIM.flyerType) _paq.push(['setCustomDimension', MATOMO_DIM.flyerType, String(flyerType||'')]);

      // Pageview
      _paq.push(['trackPageView']);

      // Load tracker JS
      const g = document.createElement('script');
      g.async = true; g.src = MATOMO_BASE + 'matomo.js';
      document.head.appendChild(g);
    } catch (e) {}
  }

  function mtmTrack(cat, act, name, val){
    if (!window._paq) return;
    window._paq.push(['trackEvent', cat, act, name, val]);
  }

  function wireAudioEvents(){
    const audio = Amplitude.getAudio();
    audio.addEventListener('play',  () => mtmTrack('Audio','Play',  (Amplitude.getActiveSongMetadata()?.name)||''));
    audio.addEventListener('pause', () => mtmTrack('Audio','Pause', (Amplitude.getActiveSongMetadata()?.name)||''));

    document.addEventListener('amplitude-song-change', () => {
      const m = Amplitude.getActiveSongMetadata() || {};
      mtmTrack('Audio','Song Change', m.name||'');
      if (MATOMO_DIM.trackTitle) window._paq?.push(['setCustomDimension', MATOMO_DIM.trackTitle, m.name||'']);
    });

    // support both ids: #previous (your HTML) and #prev
    (document.getElementById('next') || $('#next'))?.addEventListener('click', () => mtmTrack('Audio','Next'));
    (document.getElementById('previous') || document.getElementById('prev'))?.addEventListener('click', () => mtmTrack('Audio','Prev'));

    // legacy generic share button (kept harmless)
    $('#share')?.addEventListener('click',() => mtmTrack('Share','Click'));
  }

  // ---- AUMA wiring (image-per-track only) ----
  function wireAuma(cfg, base){
    if (!cfg?.tracks?.length) return;
    if (!window.Amplitude?.getAudio) return;
    if (!document.getElementById('auma')) return;
  
    // prefix relative paths with /flyers/<id>/
    const toAbs = p => !p ? p : (/^https?:\/\//.test(p) || p.startsWith('/')) ? p : (base + p);
  
    // normalize tracks’ image to absolute src (supports string or object)
    const tracks = (cfg.tracks || []).map(t => {
      let img = null;
      if (t.image) {
        img = (typeof t.image === 'string') ? { src: toAbs(t.image) }
                                            : (t.image.src ? { ...t.image, src: toAbs(t.image.src) } : null);
      } else if (t.cover_art_url) {
        img = { src: toAbs(t.cover_art_url) };
      }
      return { ...t, image: img };
    });
  
    // initial
    const initIdx = Amplitude.getActiveIndex?.() ?? 0;
    setupAumaForTrack(tracks[initIdx]);
  
    // on song change (Amplitude API or DOM event)
    const refresh = () => {
      const i = Amplitude.getActiveIndex?.() ?? 0;
      setupAumaForTrack(tracks[i]);
    };
    if (typeof Amplitude.bind === 'function') {
      Amplitude.bind('song_change', refresh);
    } else {
      document.addEventListener('amplitude-song-change', refresh);
    }
  
    // extra safety: also refresh on explicit button clicks & on ended
    (document.getElementById('next') || document.querySelector('.amplitude-next'))?.addEventListener('click', refresh);
    (document.getElementById('previous') || document.querySelector('.amplitude-prev'))?.addEventListener('click', refresh);
    Amplitude.getAudio()?.addEventListener('ended', refresh, { passive:true });
  }

  // ---- Nudge (unchanged) ----
  function scheduleNudgeAfterEngagement(flyerId, opts = {}) {
    const {
      enabled = true,
      minSeconds = 10,        // nudge after 10s of listening…
      minPercent = 0.25,      // …or after 25% progress, whichever comes first
      delayMs = 500,          // small delay before animating
      alsoOnEnded = true      // if they finish, nudge at the end too
    } = opts;

    if (!enabled) return;
    const key = `wom_nudge_done_${flyerId}`;
    if (localStorage.getItem(key)) return;

    const waBtn = document.getElementById('share-wa');
    if (!waBtn) return;

    const audio = Amplitude.getAudio?.();
    if (!audio) return;

    const markDone = () => {
      localStorage.setItem(key, '1');
      waBtn.classList.remove('nudge');
      waBtn.removeEventListener('click', markDone);
      waBtn.removeEventListener('focus', markDone);
    };

    const showNudge = () => {
      if (localStorage.getItem(key)) return;
      waBtn.classList.add('nudge');
      const onEnd = () => waBtn.classList.remove('nudge');
      waBtn.addEventListener('animationend', onEnd, { once: true });
      waBtn.addEventListener('click', markDone, { once: true });
      waBtn.addEventListener('focus', markDone, { once: true });
      try { window._paq?.push(['trackEvent', 'Share Nudge', 'Shown', flyerId]); } catch(e){}
    };

    const onProgress = () => {
      const tcur = audio.currentTime || 0;
      const d = audio.duration || 0;
      const pct = d ? (tcur / d) : 0;
      if (tcur >= minSeconds || pct >= minPercent) {
        audio.removeEventListener('timeupdate', onProgress);
        setTimeout(showNudge, delayMs);
      }
    };

    audio.addEventListener('timeupdate', onProgress, { passive: true });

    if (alsoOnEnded) {
      audio.addEventListener('ended', () => {
        if (!localStorage.getItem(key)) setTimeout(showNudge, 300);
      }, { once: true });
    }
  }

  // ---- App init ----
  async function main(){
    const flyerId   = location.pathname.replace(/^\/|\/$/g,'');   // e.g., "123"
    let startIndex  = +(new URLSearchParams(location.search).get('t')||0) || 0;

    // fetch config
    const cfgRes = await fetch(`/flyers/${flyerId}/config.json`, {cache:'no-store'});
    if(!cfgRes.ok){
      document.title='Audio Flyer not found';
      document.body.innerHTML='<p style="padding:24px">This Audio Flyer could not be found.</p>';
      return;
    }
    const cfg = await cfgRes.json();
    window.cfg = cfg; // expose for auma wiring

    document.title = cfg.title || `WOM.fm / ${flyerId}`;
    $('#track-title').textContent = cfg.title || 'WOM.fm Audio Flyer';

    if (cfg.cta?.url) { const cta=$('#cta'); cta.hidden=false; cta.href=cfg.cta.url; cta.textContent=cfg.cta.label||'Learn more'; }

    // Matomo per-flyer siteId from config
    const flyerType = (cfg.type || 'single').toLowerCase();
    const siteId    = cfg.analytics && cfg.analytics.siteId; // e.g., { "analytics": { "siteId": 7 } }
    wireMatomo({ siteId, flyerId, flyerType, title: document.title });

    // Branding
    const base = `/flyers/${flyerId}/`;
    if (cfg.branding) {
      const root = document.documentElement.style;
      if (cfg.branding.primary) root.setProperty('--brand',  cfg.branding.primary);
      if (cfg.branding.accent)  root.setProperty('--accent', cfg.branding.accent);
      if (cfg.branding.logo)    $id('brand-logo') && ($id('brand-logo').src = base + cfg.branding.logo);
      if (cfg.branding.logoHeight) root.setProperty('--logo-height', cfg.branding.logoHeight + 'px');
    }

    // Build songs from tracks for ALL types; AUMA layer handles images
    let songs = (cfg.tracks || []).map(t => ({
      name: t.title || '',
      url:  base + t.src,
      // optional cover for Amplitude's internal UI (not required for AUMA)
      cover_art_url: t.image?.src ? (base + t.image.src) : (cfg.cover ? base + cfg.cover : undefined)
    }));

    if (!songs.length){
      document.body.innerHTML='<p style="padding:24px">No audio configured.</p>';
      return;
    }

    const multi = songs.length > 1;
    document.getElementById('previous')?.classList.toggle('hidden', !multi);
    document.getElementById('next')?.classList.toggle('hidden', !multi);

    Amplitude.init({ songs });
    if (startIndex>0 && startIndex<songs.length) Amplitude.playSongAtIndex(startIndex);

    // Mark single-track (for CSS that hides prev/next)
    document.documentElement.classList.toggle('single-track', !multi);

    // Wire AUMA (v1)
    wireAuma(cfg, base);

    // Progress <progress> binding
    const audio  = Amplitude.getAudio();
    const progEl = document.querySelector('progress.amplitude-song-played-progress');
    function upd(){
      if (!progEl || !audio) return;
      const d = audio.duration || 0;
      const c = audio.currentTime || 0;
      progEl.max   = d || 1;
      progEl.value = c;
    }
    audio.addEventListener('timeupdate', upd);
    audio.addEventListener('loadedmetadata', upd);

    // Audio analytics
    wireAudioEvents();

    // Share helpers + nudge
    function buildShareUrl(channel, flyerId){
      const url = new URL(location.origin + location.pathname); // short canonical
      url.searchParams.set('utm_source', channel);
      url.searchParams.set('utm_medium', 'share');
      url.searchParams.set('utm_campaign', flyerId);
      return url.toString();
    }
    function shareWhatsApp(cfg, flyerId){
      const msg = `${cfg.title || 'Listen on WOM.fm'} • ${buildShareUrl('whatsapp', flyerId)}`;
      const wa = `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(wa, '_blank', 'noopener');
      try { window._paq?.push(['trackEvent', 'Share', 'WhatsApp', flyerId]); } catch(e){}
    }
    async function shareNative(cfg, flyerId){
      const text = cfg.title || 'Listen on WOM.fm';
      const url  = buildShareUrl('native', flyerId);
      if (navigator.share){
        try {
          await navigator.share({ title: text, text, url });
          window._paq?.push(['trackEvent', 'Share', 'Native', flyerId]);
          return;
        } catch(e){ /* user canceled or OS error */ }
      }
      try {
        await navigator.clipboard?.writeText(url);
        alert('Link copied to clipboard 👍');
      } catch(e) {
        window.open(url, '_blank', 'noopener');
      }
    }

    // enable per flyer (default on). Disable by setting "nudge": false in config
    scheduleNudgeAfterEngagement(flyerId, {
      enabled: cfg.nudge !== false,
      minSeconds: 10,
      minPercent: 0.25,
      delayMs: 500,
      alsoOnEnded: true
    });

    document.getElementById('share-wa')?.addEventListener('click', () => shareWhatsApp(cfg, flyerId));
    document.getElementById('share-native')?.addEventListener('click', () => shareNative(cfg, flyerId));
  }

  window.addEventListener('DOMContentLoaded', main);
})();