(function(){
  const $ = s => document.querySelector(s);
  const $id = (x) => document.getElementById(x);

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

  // ---- Canonical helpers ----
  function canonicalSlug({ flyerId, aliasSlug } = {}) {
    const pathSlug = location.pathname.replace(/^\/+|\/+$/g, "");
    // After CF redirect, pathSlug is already the alias; fallback to flyerId
    return (aliasSlug && aliasSlug.trim()) || pathSlug || String(flyerId || "").trim() || "unknown";
  }
  function ensureCanonicalLink(href) {
    try {
      let link = document.querySelector('link[rel="canonical"]');
      if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); }
      link.href = href;
    } catch {}
  }

  // ---------- AUMA v1 helpers (one image per track, no timing) ----------
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
    } else {
      showAuma(false);
    }
  }
  

// AUMA: tapping the illustration toggles play/pause via Amplitude (keeps UI state)
  function bindAumaImageToAmplitudeToggle() {
    const img = document.getElementById('auma-image') || document.querySelector('#auma img');
    if (!img) return;
  
    img.style.touchAction = 'manipulation';
  
    let lastTap = 0;
  
    img.addEventListener('pointerup', (e) => {
      // prevent multi-fire + keep it a trusted gesture
      e.preventDefault();
      e.stopPropagation();
  
      const now = Date.now();
      if (now - lastTap < 400) return;
      lastTap = now;
  
      const A = window.Amplitude;
      if (!A) return;
  
      const state = (typeof A.getPlayerState === 'function') ? A.getPlayerState() : null;
      
      // states are usually: 'playing', 'paused', 'stopped'
      if (state === 'playing') {
        if (typeof A.pause === 'function') A.pause();
      } else {
        if (typeof A.play === 'function') A.play();
      }
      }, { passive: false });
  }
  
  function syncAmplitudeUiClasses() {
    const audio = window.Amplitude?.getAudio?.();
    if (!audio) return;
  
    const root = document.documentElement; // ancestor of everything
  
    const reflect = () => {
      const playing = !audio.paused && !audio.ended;
      root.classList.toggle('amplitude-playing', playing);
      root.classList.toggle('amplitude-paused', !playing);
    };
  
    // keep in sync
    audio.addEventListener('play',  reflect, { passive: true });
    audio.addEventListener('pause', reflect, { passive: true });
    audio.addEventListener('ended', reflect, { passive: true });
  
    // initial state
    reflect();
  }

  // ---- Matomo wiring (per flyer) ----
  function wireMatomo({ siteId, flyerId, flyerType, title, aliasSlug }) {
    if (!siteId) return;

    const slug = canonicalSlug({ flyerId, aliasSlug });
    const canonicalUrl = `${location.origin}/${slug}`;

    try {
      window._paq = window._paq || [];
      const _paq = window._paq;

      // Optional privacy toggles:
      // _paq.push(['disableCookies']);
      // _paq.push(['setDoNotTrack', true]);

      _paq.push(['setTrackerUrl', MATOMO_BASE + 'matomo.php']);
      _paq.push(['setSiteId', String(siteId)]);
      _paq.push(['enableLinkTracking']);
      _paq.push(['enableHeartBeatTimer', 10]);

      // Canonical hygiene
      _paq.push(['setCustomUrl', canonicalUrl]);
      _paq.push(['setReferrerUrl', document.referrer || '']);
      _paq.push(['setDocumentTitle', title || `WOM.fm / ${slug}`]);

      // Custom dimensions (keep your indexes)
      if (MATOMO_DIM.flyerId)   _paq.push(['setCustomDimension', MATOMO_DIM.flyerId,   String(flyerId)]);
      if (MATOMO_DIM.flyerType) _paq.push(['setCustomDimension', MATOMO_DIM.flyerType, String(flyerType || '')]);

      // Pageview
      _paq.push(['trackPageView']);

      // Load tracker once
      if (!document.getElementById('matomo-js')) {
        const g = document.createElement('script');
        g.id = 'matomo-js';
        g.async = true;
        g.src = MATOMO_BASE + 'matomo.js';
        document.head.appendChild(g);
      }

      // Also inject a canonical link for SEO/consistency
      ensureCanonicalLink(canonicalUrl);

      // Soft “open” marker
      _paq.push(['trackEvent','Flyer','Open', slug]);
    } catch (e) {}
  }

  function mtmTrack(cat, act, name, val){
    if (!window._paq) return;
    window._paq.push(['trackEvent', cat, act, name, val]);
  }

  function wireAudioEvents(){
    const audio = Amplitude.getAudio();

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
        maxPct = Math.max(maxPct, Math.round((t / d) * 100));
        if (d - t <= 1.0) maxPct = 100; // treat trailing <1s as complete
      }
    }, { passive: true });

    function sendSummary({ forceComplete = false, nameOverride } = {}){
      if (sent || maxPct === 0) return;
      let p = forceComplete ? 100 : maxPct;
      if (p >= 95) p = 100; // near-complete

      const name = nameOverride || curTitle;
      sent = true;
      window._paq?.push(['trackEvent','Audio', name, endLabel(p), p]);
      if (p >= 100) window._paq?.push(['trackEvent','Audio', name, 'Complete']);
    }

    // natural end → force 100%
    audio.addEventListener('ended', () => { sendSummary({ forceComplete:true }); reset(); });

    // Amplitude’s song-change
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

    const refresh = () => requestAnimationFrame(refreshNow);

    // 3) initial render
    requestAnimationFrame(refreshNow);

    // audio lifecycle (covers next/prev, programmatic jumps, etc.)
    const audio = Amplitude.getAudio();
    audio.addEventListener('loadedmetadata', refresh, { passive: true });
    audio.addEventListener('play',            refresh, { passive: true });
    audio.addEventListener('seeked',          refresh, { passive: true });
    audio.addEventListener('ended',           refresh, { passive: true });

    // UI buttons as a safety net (if present)
    document.getElementById('next')?.addEventListener('click', () => setTimeout(refresh, 0));
    document.getElementById('previous')?.addEventListener('click', () => setTimeout(refresh, 0));

    // very light polling fallback
    const poll = setInterval(refreshNow, 750);
    window.addEventListener('pagehide', () => clearInterval(poll), { once: true });
  }

  // ---- Share nudge ----
  function scheduleNudgeAfterEngagement(flyerId, opts = {}) {
    const {
      enabled = true,
      minSeconds = 10,
      minPercent = 0.25,
      delayMs = 500,
      alsoOnEnded = false
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

  // ---- Edge injection helpers ----
  function getInjectedFlyerRef() {
    const id    = (typeof window !== 'undefined' && window.__flyerId)   ? String(window.__flyerId)   : null;
    const alias = (typeof window !== 'undefined' && window.__aliasSlug) ? String(window.__aliasSlug) : null;
    return { id, alias };
  }
  
  function applySentimentUiRules(cfg){
    const fb = cfg?.feedback || cfg?.ui?.feedback || {};
    const kind = String(fb?.kind || 'thumbs').toLowerCase();
    const isSentiment = (kind === 'sentiment');
  
    // Hide track title in sentiment mode
    const titleEl = document.getElementById('track-title');
    if (titleEl) titleEl.hidden = isSentiment;
  
    // Question text (optional)
    const qEl = document.getElementById('ambient-question');
    if (!qEl) return;
  
    const showQuestionText = (fb?.showQuestionText === true);
    const q = String(fb?.question || '').trim();
  
    if (isSentiment && showQuestionText && q) {
      qEl.textContent = q;
      qEl.hidden = false;
    } else {
      qEl.hidden = true;
      qEl.textContent = '';
    }
  }

  // --- Alias → id resolver (fallback when edge did not inject) -------------
  function lastSeg() {
    return location.pathname.replace(/\/+$/, '').split('/').pop().toLowerCase();
  }
  async function resolveFlyerIdFallback() {
    const seg = lastSeg();
    if (/^\d{3,6}$/.test(seg)) return seg;
    try {
      const res = await fetch('/aliases.json', { cache: 'no-store' });
      if (!res.ok) return null;
      const map = await res.json();
      const entry = map?.[seg];
      if (!entry) return null;
      // Supports "whh":"101" or {id:"101"} or {to:"welthungerhilfe"}
      if (typeof entry === 'string' && /^\d{3,6}$/.test(entry)) return entry;
      if (entry && typeof entry === 'object') {
        if (entry.id && /^\d{3,6}$/.test(String(entry.id))) return String(entry.id);
        if (entry.to && typeof entry.to === 'string') {
          const e2 = map?.[entry.to.toLowerCase()];
          if (e2 && typeof e2 === 'object' && e2.id) return String(e2.id);
          if (e2 && typeof e2 === 'string' && /^\d{3,6}$/.test(e2)) return e2;
        }
      }
    } catch {}
    return null;
  }
  
  // ---- Micro-feedback (Thumbs + Ambient Feedback sentiment) ----
  function wireMicroFeedback(cfg, flyerId, base){
    const feedbackWrap = document.getElementById('feedback');            // thumbs UI
    const ambientWrap  = document.getElementById('ambient-feedback');    // new sentiment UI
  
    // Always start hidden (safety)
    if (feedbackWrap) feedbackWrap.hidden = true;
    if (ambientWrap)  ambientWrap.hidden  = true;
  
    const fbCfg = cfg?.feedback || cfg?.ui?.feedback || null;
    const ix = window.__ix || {};
    const enabled = (fbCfg?.enabled === true) || (ix.feedbackEnabled === true);
    if (!enabled) return;
  
    const kind = String(fbCfg?.kind || 'thumbs').toLowerCase(); // thumbs | sentiment
    const showAfter = String(fbCfg?.showAfter || 'play').toLowerCase(); // play | complete
  
    const thankYouUrlRaw =
      fbCfg?.thankYouAudioUrl || fbCfg?.thankYouAudio || fbCfg?.thanks || null;
  
    const phase = String(fbCfg?.phase || ix.feedbackPhase || 'inline').toLowerCase(); // inline | two-step
    const thankYouMessage = fbCfg?.thankYouMessage || null;
  
    const toAbs = (p) => !p
      ? ''
      : (/^https?:\/\//.test(p) || p.startsWith('/')) ? p : (base + p);
  
    const thankYouUrl = toAbs(thankYouUrlRaw);
  
    const audioEl = window.Amplitude?.getAudio?.();
    let shown = false;
    let answered = false;
  
    function isLastTrack(){
      try {
        const idx = Number(window.Amplitude?.getActiveIndex?.() ?? 0);
        const total = Number(window.Amplitude?.getSongs?.()?.length ?? 1);
        return idx >= (total - 1);
      } catch (e) {
        return true;
      }
    }
  
    function playThanks(){
      if (!thankYouUrl) return;
  
      try {
        if (audioEl && !audioEl.paused && !audioEl.ended) audioEl.pause();
      } catch(e){}
  
      try {
        const a = new Audio(thankYouUrl);
        a.preload = 'auto';
        a.play().catch(()=>{});
      } catch(e){}
    }
  
    function hideAll(){
      if (feedbackWrap) feedbackWrap.hidden = true;
      if (ambientWrap)  ambientWrap.hidden  = true;
    }
  
    function showWhich(){
      if (shown || answered) return;
  
      if (showAfter === 'complete' && !isLastTrack()) return;
  
      shown = true;
  
      // Show only one UI
      if (kind === 'sentiment' && ambientWrap) {
        if (feedbackWrap) feedbackWrap.hidden = true;
        ambientWrap.hidden = false;
        try { mtmTrack('AmbientFeedback', 'Shown', String(flyerId)); } catch(e){}
      } else {
        // fallback to thumbs
        if (ambientWrap) ambientWrap.hidden = true;
        if (feedbackWrap) feedbackWrap.hidden = false;
        try { mtmTrack('Feedback', 'Shown', String(flyerId)); } catch(e){}
      }
    }
  
    function answer(label){
      if (answered) return;
      answered = true;
  
      // Track
      try {
        if (kind === 'sentiment') mtmTrack('AmbientFeedback', label, String(flyerId));
        else mtmTrack('Feedback', label, String(flyerId));
      } catch(e){}
  
      // Thank you audio
      playThanks();
  
      // Optional message (uses your existing area if you add one later)
      // For now: message is handled by the thank-you audio and then actions reveal.
  
     
     // Visual confirmation: highlight selection for ~500ms
     try{
       const btns = ambientWrap?.querySelectorAll?.('.ambient-btn') || [];
       btns.forEach(b => b.classList.add('is-disabled'));
       const selected = ambientWrap?.querySelector?.(`.ambient-btn[data-value="${label}"]`);
       selected?.classList.remove('is-disabled');
       selected?.classList.add('is-selected');
     }catch(e){}
     
     setTimeout(() => {
       hideAll();
     
       if (phase === 'two-step' && (window.__ix?.afterTapReveal)) {
         revealActionsNow(window.__ix);
       }
     }, 500);
    }
  
    // --- Wire buttons based on kind ---
    if (kind === 'sentiment' && ambientWrap) {
      const goodBtn    = ambientWrap.querySelector('.ambient-btn.good');
      const neutralBtn = ambientWrap.querySelector('.ambient-btn.neutral');
      const poorBtn    = ambientWrap.querySelector('.ambient-btn.poor');
  
      if (!goodBtn || !neutralBtn || !poorBtn) return;
  
      goodBtn.addEventListener('click',    () => answer('Good'),    { passive: true });
      neutralBtn.addEventListener('click', () => answer('Neutral'), { passive: true });
      poorBtn.addEventListener('click',    () => answer('Poor'),    { passive: true });
  
    } else {
      // thumbs mode
      if (!feedbackWrap) return;
  
      const yesBtn = document.getElementById('fb-yes');
      const noBtn  = document.getElementById('fb-no');
      if (!yesBtn || !noBtn) return;
  
      yesBtn.addEventListener('click', () => answer('Yes'), { passive: true });
      noBtn .addEventListener('click', () => answer('No'),  { passive: true });
    }
  
    // Start hidden
    hideAll();
  
    // --- Reveal logic ---
    if (showAfter === 'complete'){
      if (!audioEl) return;
  
      let maxPct = 0;
      const onTime = () => {
        const d = audioEl.duration || 0;
        const t = audioEl.currentTime || 0;
        if (!d) return;
        const pct = (t / d);
        if (pct > maxPct) maxPct = pct;
        if (maxPct >= 0.95) {
          audioEl.removeEventListener('timeupdate', onTime);
          showWhich();
        }
      };
  
      audioEl.addEventListener('timeupdate', onTime, { passive: true });
      audioEl.addEventListener('ended', () => showWhich(), { once: true, passive: true });
  
    } else {
      const playBtn = document.getElementById('play-pause') || document.getElementById('playpause');
      playBtn?.addEventListener('click', () => showWhich(), { once: true, passive: true });
  
      // Covers AUMA image tap (Amplitude.play()) etc.
      audioEl?.addEventListener('play', () => showWhich(), { once: true, passive: true });
    }
  }
    
 
// ---- Interaction presets (Step 1) ----------------------------------------
  function applyInteractionPreset(cfg){
    const preset = String(cfg?.interaction?.preset || 'share').toLowerCase();
  
    // Default visibility toggles (optional)
    const actionsCfg = cfg?.actions || {};
    const waBtn  = document.getElementById('share-wa');
    const secBtn = document.getElementById('share-native');
    if (waBtn)  waBtn.hidden  = (actionsCfg.whatsapp === false);
    if (secBtn) secBtn.hidden = (actionsCfg.secondary === false);
  
    const actionsEl  = document.getElementById('actions');
    const feedbackEl = document.getElementById('feedback');
  
    // Always force-hide feedback on load (safety; showAfter will unhide later)
    if (feedbackEl) feedbackEl.hidden = true;
  
    // Interaction state returned to main/wireMicroFeedback
    const ix = {
      preset,
      feedbackEnabled: false,
      feedbackMode: 'replace',    // replace | append
      feedbackPhase: 'inline',    // inline | two-step
      afterTapReveal: null        // null | 'share' | 'cta'
    };
  
    // Helper to hide actions hard
    const hideActions = () => actionsEl?.classList.add('is-hidden');
    const showActions = () => actionsEl?.classList.remove('is-hidden');
  
    // Apply preset mapping
    switch (preset) {
      case 'cta':
        // same UI as share, just CTA config defines the secondary button behavior
        ix.feedbackEnabled = false;
        showActions();
        break;
  
      case 'feedback_basic':
        ix.feedbackEnabled = true;
        ix.feedbackMode = 'replace';
        ix.feedbackPhase = 'inline';
        ix.afterTapReveal = null;
        hideActions();
        break;
  
      case 'feedback_2step_share':
        ix.feedbackEnabled = true;
        ix.feedbackMode = 'replace';
        ix.feedbackPhase = 'two-step';
        ix.afterTapReveal = 'share';
        hideActions();
        break;
  
      case 'feedback_2step_cta':
        ix.feedbackEnabled = true;
        ix.feedbackMode = 'replace';
        ix.feedbackPhase = 'two-step';
        ix.afterTapReveal = 'cta';
        hideActions();
        break;
  
      case 'share':
      default:
        ix.feedbackEnabled = false;
        showActions();
        break;
    }
  
    // If feedback is explicitly enabled in config, it can override presets:
    // (keeps backward compatibility with your existing feedback configs)
    if (cfg?.feedback?.enabled === true) {
      ix.feedbackEnabled = true;
      ix.feedbackMode = String(cfg?.feedback?.mode || ix.feedbackMode).toLowerCase();
      ix.feedbackPhase = String(cfg?.feedback?.phase || ix.feedbackPhase).toLowerCase();
      // Only set afterTapReveal from preset; config can add later if you want.
      if (ix.feedbackMode === 'replace') hideActions();
      if (ix.feedbackMode === 'append') showActions();
    }
  
    // If feedback is not enabled, ensure feedback stays hidden
    if (!ix.feedbackEnabled && feedbackEl) feedbackEl.hidden = true;
  
    return ix;
  }
  
  // Utility: reveal actions immediately (used by 2-step feedback)
  function revealActionsNow(ix){
    const actionsEl = document.getElementById('actions');
    if (!actionsEl) return;
  
    // If we're in two-step mode, actions were hidden initially
    actionsEl.classList.remove('is-hidden');
    actionsEl.classList.add('is-visible'); // uses your existing CSS reveal mechanic
  }

  // ---- App init ----
  async function main(){
    // Prefer edge-injected id/alias
    let { id: flyerId, alias: aliasSlug } = getInjectedFlyerRef();

    // Fallback to client-side resolver if not injected
    if (!flyerId) flyerId = await resolveFlyerIdFallback();

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
    
    applySentimentUiRules(cfg);
    
    // ---- Map button -> cta (backward compatible) ----
    // Canonical going forward: cfg.button
    // Execution currently uses cfg.cta via normalizeCta(cfg)
    if (!cfg.cta && cfg.button) {
      const b = cfg.button;
    
      // Normalize common shapes
      const mode = String(b.mode || 'cta').toLowerCase();         // 'cta' expected
      const type = String(b.type || b.action || 'url').toLowerCase(); // 'url' | 'call' | 'native'
    
      cfg.cta = {
        mode: mode,                 // 'cta' or 'share'
        type: type,                 // 'url' | 'call' | 'native'
        url: b.url || b.href || b.link || undefined,
        phone: b.phone || b.tel || undefined,
        color: b.color || undefined
      };
    }
    
    // Apply interaction preset (Step 1)
    const ix = applyInteractionPreset(cfg);
    window.__ix = ix; // optional debug

    // Mark single-track flyers so CSS can center the play button
    const nTracks = (cfg.tracks && cfg.tracks.length) || 0;
    document.documentElement.classList.toggle('single-track', nTracks <= 1);

    // AUMA flag for CSS
    const isAuma = (cfg.type === 'auma');
    document.documentElement.classList.toggle('has-auma', isAuma);

    document.title = cfg.title || `WOM.fm / ${flyerId}`;
    const tt = $('#track-title');
    if (tt) tt.textContent = cfg.title || 'WOM.fm Audio Flyer';

    // Matomo per-flyer siteId from config + normalized type
    const typeRaw  = (cfg.type || 'audio').toLowerCase();
    const flyerType = (typeRaw === 'single') ? 'audio' : typeRaw;  // normalize
    const siteId    = cfg.analytics?.siteId ?? cfg.siteId ?? null;

    wireMatomo({ siteId, flyerId, flyerType, title: document.title, aliasSlug });

    // Branding
    const base = `/flyers/${flyerId}/`;
const header = document.querySelector('.brand');
    const logoEl = document.getElementById('brand-logo');
    
    const toAbs = p => !p
      ? ''
      : (/^https?:\/\//.test(p) || p.startsWith('/')) ? p : (base + p);
    
    const logoUrl = cfg.branding && cfg.branding.logo;
    
    if (logoUrl && logoEl) {
      logoEl.onload  = () => { document.documentElement.classList.remove('no-brand'); };
      logoEl.onerror = () => {
        document.documentElement.classList.add('no-brand');
        if (header) header.style.display = 'none';
      };
      logoEl.src = toAbs(logoUrl);
      logoEl.alt = (cfg.branding && cfg.branding.alt) || '';
    } else {
      // no logo provided in config → collapse header
      document.documentElement.classList.add('no-brand');
      if (header) header.style.display = 'none';
    }
    if (cfg.branding) {
      const root = document.documentElement.style;
      if (cfg.branding.primary) root.setProperty('--brand',  cfg.branding.primary);
      if (cfg.branding.accent)  root.setProperty('--accent', cfg.branding.accent);
      if (cfg.branding.logo && $id('brand-logo')) $id('brand-logo').src = base + cfg.branding.logo;
      if (cfg.branding.logoHeight) root.setProperty('--logo-height', cfg.branding.logoHeight + 'px');
    }

    // Build songs from tracks for ALL types; AUMA layer handles images
    let songs = (cfg.tracks || []).map(t => {
    // support t.image as string or {src:"..."}
    const imgSrc =
      typeof t.image === 'string' ? t.image :
      (t.image && typeof t.image === 'object' ? t.image.src : null);
  
    return {
      name: t.title || '',
      url:  base + t.src,
      cover_art_url: imgSrc ? (imgSrc.startsWith('/') ? imgSrc : (base + imgSrc)) 
                            : (cfg.cover ? base + cfg.cover : undefined)
    };
  });

    if (!songs.length){
      document.body.innerHTML='<p style="padding:24px">No audio configured.</p>';
      return;
    }

    const multi = songs.length > 1;
    document.getElementById('previous')?.classList.toggle('hidden', !multi);
    document.getElementById('next')?.classList.toggle('hidden', !multi);

    Amplitude.init({ songs });
    if (startIndex>0 && startIndex<songs.length) Amplitude.playSongAtIndex(startIndex);
    syncAmplitudeUiClasses();
    if (isAuma) bindAumaImageToAmplitudeToggle();
    
    wireMicroFeedback(cfg, flyerId, base);

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
        } catch(e){ /* canceled or OS error */ }
      }
      try {
        await navigator.clipboard?.writeText(url);
        alert('Link copied to clipboard 👍');
      } catch(e) {
        window.open(url, '_blank', 'noopener');
      }
    }

function normalizeCta(cfg){
      const c = (cfg && cfg.cta) ? cfg.cta : {};
      const mode = String(c.mode || 'share').toLowerCase();     // share | cta
      const type = String(c.type || 'native').toLowerCase();    // native | url | call
      return {
        mode,
        type,
        url: c.url || '',
        phone: c.phone || '',
        color: c.color || '' // optional override
      };
    }
    
    function applySecondaryButtonUi(cfg){
      const btn = document.getElementById('share-native');
      if (!btn) return;
    
      const cta = normalizeCta(cfg);
    
      const isCta = (cta.mode === 'cta' && (cta.type === 'url' || cta.type === 'call'));
      btn.classList.toggle('is-cta', isCta);
    
      // Decide icon
      if (isCta) {
        btn.dataset.type = cta.type; // url | call
        const aria = (cta.type === 'call') ? 'Call now' : 'Visit website';
        btn.setAttribute('aria-label', aria);
        btn.setAttribute('title', aria);
    
        // Set CTA color (override > branding accent > fallback)
        const accent = (cta.color && cta.color.trim())
          || (cfg?.branding?.accent)
          || '#ea2264';
        btn.style.setProperty('--cta-bg', accent);
      } else {
        btn.dataset.type = 'native';
        btn.setAttribute('aria-label', 'Share');
        btn.setAttribute('title', 'Share');
        btn.style.removeProperty('--cta-bg');
      }
    }
    
    async function handleSecondaryAction(cfg, flyerId){
      const cta = normalizeCta(cfg);
    
      // Default: native share
      if (cta.mode !== 'cta') {
        return shareNative(cfg, flyerId);
      }
    
      // CTA: visit website
      if (cta.type === 'url' && cta.url) {
        try { window._paq?.push(['trackEvent', 'CTA', 'Visit website', cta.url]); } catch(e){}
        window.open(cta.url, '_blank', 'noopener');
        return;
      }
    
      // CTA: call now
      if (cta.type === 'call' && cta.phone) {
        try { window._paq?.push(['trackEvent', 'CTA', 'Call now', cta.phone]); } catch(e){}
        location.href = `tel:${cta.phone}`;
        return;
      }
    
      // Fallback: share
      return shareNative(cfg, flyerId);
    }
    
    // Actions reveal behavior (default: reveal after first play)
    const actionsAfterPlay = (cfg?.ui?.actionsAfterPlay !== false);
    
    // Hide actions on load and reveal after first user play gesture
if (actionsAfterPlay) {
      const actions = document.getElementById('actions');
      const playBtn = document.getElementById('play-pause');
      const audioEl = window.Amplitude?.getAudio?.();
    
      if (actions && !actions.classList.contains('is-hidden')) {
        // Start hidden (CSS does the hiding). Reveal once playback starts.
        const reveal = () => actions.classList.add('is-visible');
    
        // Primary: explicit play button tap
        playBtn?.addEventListener('click', reveal, { once: true });
    
        // Fallback: covers AUMA image tap (Amplitude.play()) and any other start path
        audioEl?.addEventListener('play', reveal, { once: true, passive: true });
      }
    } else {
      document.getElementById('actions')?.classList.add('is-visible');
    }
    
    applySecondaryButtonUi(cfg);
    
    document.getElementById('share-native')
      ?.addEventListener('click', () => handleSecondaryAction(cfg, flyerId));

    scheduleNudgeAfterEngagement(flyerId, {
      enabled: cfg.nudge !== false,
      minSeconds: 10,
      minPercent: 0.25,
      delayMs: 500,
      alsoOnEnded: true
    });

    document.getElementById('share-wa')?.addEventListener('click', () => shareWhatsApp(cfg, flyerId));
  }

  window.addEventListener('DOMContentLoaded', main);
})();