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
 // audio.addEventListener('play',  () => mtmTrack('Audio','Play',  (Amplitude.getActiveSongMetadata()?.name)||''));
 // audio.addEventListener('pause', () => mtmTrack('Audio','Pause', (Amplitude.getActiveSongMetadata()?.name)||''));

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
  
  // --- Listen summary (Matomo-native: Start + End bucket + Complete) ---
 function wireListenSummary(){
   const audio = Amplitude.getAudio?.();
   if (!audio) return;
 
   let maxPct = 0, sent = false, started = false;
   let curTitle = (Amplitude.getActiveSongMetadata()?.name) || '';
 
   const endLabel = p => p < 25 ? 'End 0–25' : p < 50 ? 'End 25–50' : p < 75 ? 'End 50–75' : 'End 75–100';
   const reset = () => { maxPct = 0; sent = false; started = false; };
 
   // keep a stable title per track
   const refreshTitle = () => { curTitle = (Amplitude.getActiveSongMetadata()?.name) || ''; };
   refreshTitle();
 
   audio.addEventListener('play', () => {
     if (!started) { window._paq?.push(['trackEvent','Audio', curTitle, 'Start']); started = true; }
   });
 
  audio.addEventListener('timeupdate', () => {
    const d = audio.duration || 0, t = audio.currentTime || 0;
    if (d > 0) {
      // normal progress
      maxPct = Math.max(maxPct, Math.round((t / d) * 100));
      // if we’re within the last second, count as 100%
      if (d - t <= 1.0) maxPct = 100;
    }
  }, { passive: true });
 
   function sendSummary({ forceComplete = false, nameOverride } = {}){
     if (sent || maxPct === 0) return;
     let p = forceComplete ? 100 : maxPct;
     // if we’re *very* close, count it as complete (covers song_change before ended)
     if (p >= 95) p = 100;
 
     const name = nameOverride || curTitle;
     sent = true;
     window._paq?.push(['trackEvent','Audio', name, endLabel(p), p]);
     if (p >= 100) window._paq?.push(['trackEvent','Audio', name, 'Complete']);
   }
 
   // natural end → force 100%
   audio.addEventListener('ended', () => { sendSummary({ forceComplete:true }); reset(); });
 
   // Amplitude’s song-change happens on auto-advance and button next/prev
   if (typeof Amplitude.bind === 'function') {
   Amplitude.bind('song_change', () => {
     sendSummary({ nameOverride: curTitle, forceComplete: maxPct >= 95 });
     reset(); refreshTitle();
   });
   } else {
   document.addEventListener('amplitude-song-change', () => {
     sendSummary({ nameOverride: curTitle, forceComplete: maxPct >= 95 });
     reset(); refreshTitle();
   });
   }
 
   // Fallback: src swap detected early → close previous using snapshot title
   let lastSrc = audio.currentSrc || '';
   audio.addEventListener('loadedmetadata', () => {
     const cur = audio.currentSrc || '';
     if (lastSrc && cur && cur !== lastSrc) { sendSummary({ nameOverride: curTitle }); reset(); refreshTitle(); }
     lastSrc = cur;
   }, { passive: true });
 
   // Safety nets
   window.addEventListener('pagehide', () =>
     sendSummary({ nameOverride: curTitle, forceComplete: maxPct >= 95 })
   );
   document.addEventListener('visibilitychange', () => {
     if (document.visibilityState !== 'hidden') return;
   
     // Only summarize if playback is no longer ongoing
     const stillPlaying = !audio.paused && !audio.ended;
     if (!stillPlaying) {
       sendSummary({ nameOverride: curTitle, forceComplete: maxPct >= 95 });
     }
   });
 }
  
// ---- AUMA wiring (one image per track) ----
  function wireAuma(cfg, base) {
    if (!cfg?.tracks?.length) return;
    if (!window.Amplitude?.getAudio) return;
    if (!document.getElementById('auma')) return;
  
    // 1) make image src absolute once
    const toAbs = p =>
      !p ? p : (/^https?:\/\//.test(p) || p.startsWith('/')) ? p : (base + p);
  
    const tracks = (cfg.tracks || []).map(t => {
      let img = null;
      if (t.image) {
        img = (typeof t.image === 'string')
          ? { src: toAbs(t.image) }
          : (t.image.src ? { ...t.image, src: toAbs(t.image.src) } : null);
      } else if (t.cover_art_url) {
        img = { src: toAbs(t.cover_art_url) };
      }
      return { ...t, image: img };
    });
  
    let lastIndex = -1;
  
    // 2) read active index and update image if it actually changed
    const refreshNow = () => {
      const idx = Number(Amplitude.getActiveIndex?.() ?? 0);
      if (idx === lastIndex) return;
      lastIndex = idx;
      setupAumaForTrack(tracks[idx]);
    };
  
    // always read the *new* index
    const refresh = () => requestAnimationFrame(refreshNow);
  
    // 3) initial render (after init / optional playSongAtIndex)
    requestAnimationFrame(refreshNow);
  
    // b) audio lifecycle (covers next/prev, programmatic jumps, etc.)
    const audio = Amplitude.getAudio();
    audio.addEventListener('loadedmetadata', refresh, { passive: true });
    audio.addEventListener('play',            refresh, { passive: true });
    audio.addEventListener('seeked',          refresh, { passive: true });
    audio.addEventListener('ended',           refresh, { passive: true });
  
    // c) UI buttons as a safety net (if present)
    document.getElementById('next')?.addEventListener('click', () => setTimeout(refresh, 0));
    document.getElementById('previous')?.addEventListener('click', () => setTimeout(refresh, 0));
  
    // d) very light polling fallback (handles rare edge builds)
    const poll = setInterval(refreshNow, 750);
    window.addEventListener('pagehide', () => clearInterval(poll), { once: true });
  }
  // ---- Nudge (unchanged) ----
  function scheduleNudgeAfterEngagement(flyerId, opts = {}) {
    const {
      enabled = true,
      minSeconds = 10,        // nudge after 10s of listening…
      minPercent = 0.25,      // …or after 25% progress, whichever comes first
      delayMs = 500,          // small delay before animating
      alsoOnEnded = false     // if they finish, nudge at the end too
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
  
  // --- Alias → id resolver (works for ids too) -------------------------------
  function lastSeg() {
    return location.pathname.replace(/\/+$/, '').split('/').pop().toLowerCase();
  }
  
  async function resolveFlyerId() {
    const seg = lastSeg();
  
    // If it's already a numeric id (3–6 digits), use it
    if (/^\d{3,6}$/.test(seg)) return seg;
  
    // Otherwise try to resolve an alias from /aliases.json
    try {
      const res = await fetch('/aliases.json', { cache: 'no-store' });
      if (!res.ok) return null;
  
      const map = await res.json();
      const entry = map?.[seg];
      if (!entry) return null;
  
      // Support both "whh":"101" and "whh":{ "to":"101", "redirect":false }
      return (typeof entry === 'string') ? entry : entry.to;
    } catch {
      return null;
    }
  }

  // ---- App init ----
  async function main(){
    const flyerId = await resolveFlyerId();
    if (!flyerId) {
      document.title = 'Audio Flyer not found';
      document.body.innerHTML = '<p style="padding:24px">This Audio Flyer could not be found.</p>';
      return;
    }
    let startIndex  = +(new URLSearchParams(location.search).get('t')||0) || 0;
    window.flyerId = flyerId;

    // fetch config
    const cfgRes = await fetch(`/flyers/${flyerId}/config.json`, {cache:'no-store'});
    if(!cfgRes.ok){
      document.title='Audio Flyer not found';
      document.body.innerHTML='<p style="padding:24px">This Audio Flyer could not be found.</p>';
      return;
    }
    const cfg = await cfgRes.json();
    window.cfg = cfg; // expose for auma wiring
    
    // Mark single-track flyers so CSS can center the play button
    const nTracks = (cfg.tracks && cfg.tracks.length) || 0;
    document.documentElement.classList.toggle('single-track', nTracks <= 1);
    
    // Also keep the AUMA flag accurate 
    const isAuma = cfg.type === 'auma' || cfg.type === 'auma-seq';
    document.documentElement.classList.toggle('has-auma', isAuma);

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
    wireListenSummary();

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