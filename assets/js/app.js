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
  const MATOMO_DIM  = { flyerId: 1, flyerType: 2, trackTitle: 3 };

  function t(sec){ sec=sec|0; return ((sec/60)|0)+':'+('0'+(sec%60)).slice(-2); }

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

  function setElVisible(el, visible){
    if (!el) return;
    el.hidden = !visible;
    el.style.display = visible ? '' : 'none';
  }

  // ---------- Brand / path helpers ----------
  function getInjectedBrand() {
    return (typeof window !== 'undefined' && window.__brand)
      ? String(window.__brand).toLowerCase()
      : 'wom';
  }

 function flyerBaseCandidates(flyerId, brand) {
   return [`/flyers/${brand}/${flyerId}/`];
 }

  function aliasFileCandidates(brand) {
    return [`/aliases/${brand}.json`];
  }

  async function fetchFirstJson(candidates) {
    for (const path of candidates) {
      try {
        const res = await fetch(path, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          return { json, path };
        }
      } catch (_) {}
    }
    return null;
  }

  async function fetchFirstText(candidates) {
    for (const path of candidates) {
      try {
        const res = await fetch(path, { cache: 'no-store' });
        if (res.ok) {
          const text = await res.text();
          return { text, path };
        }
      } catch (_) {}
    }
    return null;
  }

  // ---------- AUMA v1 helpers ----------
  function showAuma(show){
    const sec = $id('auma');
    if (!sec) return;
    const on = !!show;
    sec.hidden = !on;
    sec.classList?.toggle('hidden', !on);
    document.documentElement.classList.toggle('has-auma', on);
  }

  function setAumaImage(src, alt){
    const img = $id('auma-image') || document.querySelector('#auma img');
    if (!img) return;
    img.classList.remove('ready');
    img.onload = () => img.classList.add('ready');
    img.src = src;
    img.alt = alt || '';
  }

  function setupAumaForTrack(track){
    if (!track){ showAuma(false); return; }

    let art = null;
    if (track.image) {
      if (typeof track.image === 'string') {
        art = { src: track.image, alt: '' };
      } else if (track.image.src) {
        art = track.image;
      }
    } else if (track.cover_art_url) {
      art = { src: track.cover_art_url };
    }

    if (art?.src){
      setAumaImage(art.src, art.alt);
      showAuma(true);
    } else {
      showAuma(false);
    }
  }

  function bindAumaImageToAmplitudeToggle() {
    const img = document.getElementById('auma-image') || document.querySelector('#auma img');
    if (!img) return;

    img.style.touchAction = 'manipulation';
    let lastTap = 0;

    img.addEventListener('pointerup', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const now = Date.now();
      if (now - lastTap < 400) return;
      lastTap = now;

      const A = window.Amplitude;
      if (!A) return;

      const state = (typeof A.getPlayerState === 'function') ? A.getPlayerState() : null;
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

    const root = document.documentElement;

    const reflect = () => {
      const playing = !audio.paused && !audio.ended;
      root.classList.toggle('amplitude-playing', playing);
      root.classList.toggle('amplitude-paused', !playing);
    };

    audio.addEventListener('play',  reflect, { passive: true });
    audio.addEventListener('pause', reflect, { passive: true });
    audio.addEventListener('ended', reflect, { passive: true });

    reflect();
  }

  // ---- Matomo wiring ----
  function wireMatomo({ siteId, flyerId, flyerType, title, aliasSlug }) {
    if (!siteId) return;

    const slug = canonicalSlug({ flyerId, aliasSlug });
    const canonicalUrl = `${location.origin}/${slug}`;

    try {
      window._paq = window._paq || [];
      const _paq = window._paq;

      _paq.push(['setTrackerUrl', MATOMO_BASE + 'matomo.php']);
      _paq.push(['setSiteId', String(siteId)]);
      _paq.push(['enableLinkTracking']);
      _paq.push(['enableHeartBeatTimer', 10]);

      _paq.push(['setCustomUrl', canonicalUrl]);
      _paq.push(['setReferrerUrl', document.referrer || '']);
      _paq.push(['setDocumentTitle', title || `WOM.fm / ${slug}`]);

      if (MATOMO_DIM.flyerId)   _paq.push(['setCustomDimension', MATOMO_DIM.flyerId,   String(flyerId)]);
      if (MATOMO_DIM.flyerType) _paq.push(['setCustomDimension', MATOMO_DIM.flyerType, String(flyerType || '')]);

      _paq.push(['trackPageView']);

      if (!document.getElementById('matomo-js')) {
        const g = document.createElement('script');
        g.id = 'matomo-js';
        g.async = true;
        g.src = MATOMO_BASE + 'matomo.js';
        document.head.appendChild(g);
      }

      ensureCanonicalLink(canonicalUrl);
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

    (document.getElementById('next') || $('#next'))?.addEventListener('click', () => mtmTrack('Audio','Next'));
    (document.getElementById('previous') || document.getElementById('prev'))?.addEventListener('click', () => mtmTrack('Audio','Prev'));
    $('#share')?.addEventListener('click',() => mtmTrack('Share','Click'));
  }

  function wireListenSummary(){
    const audio = Amplitude.getAudio?.();
    if (!audio) return;

    let maxPct = 0, sent = false, started = false;
    let curTitle = (Amplitude.getActiveSongMetadata()?.name) || '';

    const endLabel = p => p < 25 ? 'End 0–25' : p < 50 ? 'End 25–50' : p < 75 ? 'End 50–75' : 'End 75–100';
    const reset = () => { maxPct = 0; sent = false; started = false; };

    const refreshTitle = () => { curTitle = (Amplitude.getActiveSongMetadata()?.name) || ''; };
    refreshTitle();

    audio.addEventListener('play', () => {
      if (!started) { window._paq?.push(['trackEvent','Audio', curTitle, 'Start']); started = true; }
    });

    audio.addEventListener('timeupdate', () => {
      const d = audio.duration || 0, t = audio.currentTime || 0;
      if (d > 0) {
        maxPct = Math.max(maxPct, Math.round((t / d) * 100));
        if (d - t <= 1.0) maxPct = 100;
      }
    }, { passive: true });

    function sendSummary({ forceComplete = false, nameOverride } = {}){
      if (sent || maxPct === 0) return;
      let p = forceComplete ? 100 : maxPct;
      if (p >= 95) p = 100;

      const name = nameOverride || curTitle;
      sent = true;
      window._paq?.push(['trackEvent','Audio', name, endLabel(p), p]);
      if (p >= 100) window._paq?.push(['trackEvent','Audio', name, 'Complete']);
    }

    audio.addEventListener('ended', () => { sendSummary({ forceComplete:true }); reset(); });

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

    let lastSrc = audio.currentSrc || '';
    audio.addEventListener('loadedmetadata', () => {
      const cur = audio.currentSrc || '';
      if (lastSrc && cur && cur !== lastSrc) { sendSummary({ nameOverride: curTitle }); reset(); refreshTitle(); }
      lastSrc = cur;
    }, { passive: true });

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

  function wireAuma(cfg, base) {
    if (!cfg?.tracks?.length) return;
    if (!window.Amplitude?.getAudio) return;
    if (!document.getElementById('auma')) return;

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
    const refreshNow = () => {
      const idx = Number(Amplitude.getActiveIndex?.() ?? 0);
      if (idx === lastIndex) return;
      lastIndex = idx;
      setupAumaForTrack(tracks[idx]);
    };

    const refresh = () => requestAnimationFrame(refreshNow);

    requestAnimationFrame(refreshNow);

    const audio = Amplitude.getAudio();
    audio.addEventListener('loadedmetadata', refresh, { passive: true });
    audio.addEventListener('play',            refresh, { passive: true });
    audio.addEventListener('seeked',          refresh, { passive: true });
    audio.addEventListener('ended',           refresh, { passive: true });

    document.getElementById('next')?.addEventListener('click', () => setTimeout(refresh, 0));
    document.getElementById('previous')?.addEventListener('click', () => setTimeout(refresh, 0));

    const poll = setInterval(refreshNow, 750);
    window.addEventListener('pagehide', () => clearInterval(poll), { once: true });
  }

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

    const titleEl = document.getElementById('track-title');
    if (titleEl) titleEl.hidden = isSentiment;

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

  async function resolveFlyerIdFallback(brand) {
    const seg = lastSeg();
    if (/^\d{3,6}$/.test(seg)) return seg;

    try {
      for (const aliasPath of aliasFileCandidates(brand)) {
        const res = await fetch(aliasPath, { cache: 'no-store' });
        if (!res.ok) continue;

        const map = await res.json();
        const entry = map?.[seg];
        if (!entry) continue;

        if (typeof entry === 'string' && /^\d{3,6}$/.test(entry)) return entry;

        if (entry && typeof entry === 'object') {
          if (entry.id && /^\d{3,6}$/.test(String(entry.id))) return String(entry.id);
          if (entry.to && typeof entry.to === 'string') {
            const e2 = map?.[entry.to.toLowerCase()];
            if (e2 && typeof e2 === 'object' && e2.id) return String(e2.id);
            if (e2 && typeof e2 === 'string' && /^\d{3,6}$/.test(e2)) return e2;
          }
        }
      }
    } catch {}

    return null;
  }

  // ---- Micro-feedback ----
  function wireMicroFeedback(cfg, flyerId, base){
    const feedbackWrap = document.getElementById('feedback');
    const ambientWrap  = document.getElementById('ambient-feedback');

    if (feedbackWrap) feedbackWrap.hidden = true;
    if (ambientWrap)  ambientWrap.hidden  = true;

    const fbCfg = cfg?.feedback || cfg?.ui?.feedback || null;
    const ix = window.__ix || {};
    const enabled = (fbCfg?.enabled === true) || (ix.feedbackEnabled === true);
    if (!enabled) return;

    const kind = String(fbCfg?.kind || 'thumbs').toLowerCase();
    const showAfter = String(fbCfg?.showAfter || 'play').toLowerCase();

    const thankYouUrlRaw =
      fbCfg?.thankYouAudioUrl || fbCfg?.thankYouAudio || fbCfg?.thanks || null;

    const phase = String(fbCfg?.phase || ix.feedbackPhase || 'inline').toLowerCase();

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

      if (kind === 'sentiment' && ambientWrap) {
        if (feedbackWrap) feedbackWrap.hidden = true;
        ambientWrap.hidden = false;
        try { mtmTrack('AmbientFeedback', 'Shown', String(flyerId)); } catch(e){}
      } else {
        if (ambientWrap) ambientWrap.hidden = true;
        if (feedbackWrap) feedbackWrap.hidden = false;
        try { mtmTrack('Feedback', 'Shown', String(flyerId)); } catch(e){}
      }
    }

    function answer(label){
      if (answered) return;
      answered = true;

      try {
        if (kind === 'sentiment') mtmTrack('AmbientFeedback', label, String(flyerId));
        else mtmTrack('Feedback', label, String(flyerId));
      } catch(e){}

      playThanks();

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

    if (kind === 'sentiment' && ambientWrap) {
      const goodBtn    = ambientWrap.querySelector('.ambient-btn.good');
      const neutralBtn = ambientWrap.querySelector('.ambient-btn.neutral');
      const poorBtn    = ambientWrap.querySelector('.ambient-btn.poor');

      if (!goodBtn || !neutralBtn || !poorBtn) return;

      goodBtn.addEventListener('click',    () => answer('Good'),    { passive: true });
      neutralBtn.addEventListener('click', () => answer('Neutral'), { passive: true });
      poorBtn.addEventListener('click',    () => answer('Poor'),    { passive: true });

    } else {
      if (!feedbackWrap) return;

      const yesBtn = document.getElementById('fb-yes');
      const noBtn  = document.getElementById('fb-no');
      if (!yesBtn || !noBtn) return;

      yesBtn.addEventListener('click', () => answer('Yes'), { passive: true });
      noBtn .addEventListener('click', () => answer('No'),  { passive: true });
    }

    hideAll();

    if (showAfter === 'complete'){
      if (!audioEl) return;

      const maybeShowOnLastTrack = () => {
        if (shown || answered) return;
        if (!isLastTrack()) return;

        const d = audioEl.duration || 0;
        const t = audioEl.currentTime || 0;
        const nearEnd = d > 0 && (t / d) >= 0.95;
        const ended = audioEl.ended;

        if (nearEnd || ended) {
          showWhich();
          audioEl.removeEventListener('timeupdate', maybeShowOnLastTrack);
          audioEl.removeEventListener('ended', maybeShowOnLastTrack);
        }
      };

      audioEl.addEventListener('timeupdate', maybeShowOnLastTrack, { passive: true });
      audioEl.addEventListener('ended', maybeShowOnLastTrack, { passive: true });

    } else {
      const playBtn = document.getElementById('play-pause') || document.getElementById('playpause');
      playBtn?.addEventListener('click', () => showWhich(), { once: true, passive: true });
      audioEl?.addEventListener('play', () => showWhich(), { once: true, passive: true });
    }
  }

  // ---- Interaction presets ----
  function applyInteractionPreset(cfg){
    const preset = String(cfg?.interaction?.preset || 'share').toLowerCase();

    const actionsCfg = cfg?.actions || {};
    const waBtn  = document.getElementById('share-wa');
    const secBtn = document.getElementById('share-native');
    setElVisible(waBtn,  actionsCfg.whatsapp !== false);
    setElVisible(secBtn, actionsCfg.secondary !== false);

    const actionsEl  = document.getElementById('actions');
    const feedbackEl = document.getElementById('feedback');

    if (feedbackEl) feedbackEl.hidden = true;

    const ix = {
      preset,
      feedbackEnabled: false,
      feedbackMode: 'replace',
      feedbackPhase: 'inline',
      afterTapReveal: null
    };

    const hideActions = () => actionsEl?.classList.add('is-hidden');
    const showActions = () => actionsEl?.classList.remove('is-hidden');

    switch (preset) {
      case 'cta':
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

    if (cfg?.feedback?.enabled === true) {
      ix.feedbackEnabled = true;
      ix.feedbackMode = String(cfg?.feedback?.mode || ix.feedbackMode).toLowerCase();
      ix.feedbackPhase = String(cfg?.feedback?.phase || ix.feedbackPhase).toLowerCase();
      if (ix.feedbackMode === 'replace') hideActions();
      if (ix.feedbackMode === 'append') showActions();
    }

    if (!ix.feedbackEnabled && feedbackEl) feedbackEl.hidden = true;
    return ix;
  }

  function revealActionsNow(ix){
    const actionsEl = document.getElementById('actions');
    if (!actionsEl) return;

    const waBtn = document.getElementById('share-wa');
    const secondaryBtn = document.getElementById('share-native');

    const actionsCfg = window.cfg?.actions || {};

    if (ix?.afterTapReveal === 'cta') {
      setElVisible(waBtn, false);
      setElVisible(secondaryBtn, actionsCfg.secondary !== false);
    } else if (ix?.afterTapReveal === 'share') {
      setElVisible(waBtn, actionsCfg.whatsapp !== false);
      setElVisible(secondaryBtn, actionsCfg.secondary !== false);
    } else {
      setElVisible(waBtn, actionsCfg.whatsapp !== false);
      setElVisible(secondaryBtn, actionsCfg.secondary !== false);
    }

    actionsEl.classList.remove('is-hidden');
    actionsEl.classList.add('is-visible');
  }

  // ---- App init ----
  async function main(){
    const brand = getInjectedBrand();
    window.__brand = brand;

    let { id: flyerId, alias: aliasSlug } = getInjectedFlyerRef();

    if (!flyerId) flyerId = await resolveFlyerIdFallback(brand);

    if (!flyerId) {
      document.title = 'Audio Flyer not found';
      document.body.innerHTML = '<p style="padding:24px">This Audio Flyer could not be found.</p>';
      return;
    }

    let startIndex  = +(new URLSearchParams(location.search).get('t')||0) || 0;
    window.flyerId = flyerId;

    const cfgHit = await fetchFirstJson(
      flyerBaseCandidates(flyerId, brand).map(base => `${base}config.json`)
    );

    if (!cfgHit) {
      document.title='Audio Flyer not found';
      document.body.innerHTML='<p style="padding:24px">This Audio Flyer could not be found.</p>';
      return;
    }

    const cfg = cfgHit.json;
    window.cfg = cfg;

    applySentimentUiRules(cfg);

    if (!cfg.cta && cfg.button) {
      const b = cfg.button;
      const mode = String(b.mode || 'cta').toLowerCase();
      const type = String(b.type || b.action || 'url').toLowerCase();

      cfg.cta = {
        mode: mode,
        type: type,
        url: b.url || b.href || b.link || undefined,
        phone: b.phone || b.tel || undefined,
        color: b.color || undefined
      };
    }

    const ix = applyInteractionPreset(cfg);
    window.__ix = ix;

    const nTracks = (cfg.tracks && cfg.tracks.length) || 0;
    document.documentElement.classList.toggle('single-track', nTracks <= 1);

    const isAuma = (cfg.type === 'auma');
    document.documentElement.classList.toggle('has-auma', isAuma);

    document.title = cfg.title || `WOM.fm / ${flyerId}`;
    const tt = $('#track-title');
    if (tt) tt.textContent = cfg.title || 'WOM.fm Audio Flyer';

    const typeRaw  = (cfg.type || 'audio').toLowerCase();
    const flyerType = (typeRaw === 'single') ? 'audio' : typeRaw;
    const siteId    = cfg.analytics?.siteId ?? cfg.siteId ?? null;

    wireMatomo({ siteId, flyerId, flyerType, title: document.title, aliasSlug });

    const base = cfgHit.path.replace(/config\.json$/, '');
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
      document.documentElement.classList.add('no-brand');
      if (header) header.style.display = 'none';
    }

    if (cfg.branding) {
      const root = document.documentElement.style;
      if (cfg.branding.primary) root.setProperty('--brand',  cfg.branding.primary);
      if (cfg.branding.accent)  root.setProperty('--accent', cfg.branding.accent);
      if (cfg.branding.logo && $id('brand-logo')) $id('brand-logo').src = toAbs(cfg.branding.logo);
      if (cfg.branding.logoHeight) root.setProperty('--logo-height', cfg.branding.logoHeight + 'px');
    }

    let songs = (cfg.tracks || []).map(t => {
      const imgSrc =
        typeof t.image === 'string' ? t.image :
        (t.image && typeof t.image === 'object' ? t.image.src : null);

      return {
        name: t.title || '',
        url:  toAbs(t.src),
        cover_art_url: imgSrc ? toAbs(imgSrc)
                              : (cfg.cover ? toAbs(cfg.cover) : undefined)
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
    document.documentElement.classList.toggle('single-track', !multi);
    wireAuma(cfg, base);

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

    wireAudioEvents();
    wireListenSummary();

    function buildShareUrl(channel, flyerId){
      const url = new URL(location.origin + location.pathname);
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
        } catch(e){}
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
      const mode = String(c.mode || 'share').toLowerCase();
      const type = String(c.type || 'native').toLowerCase();
      return {
        mode,
        type,
        url: c.url || '',
        phone: c.phone || '',
        color: c.color || ''
      };
    }

    function applySecondaryButtonUi(cfg){
      const btn = document.getElementById('share-native');
      if (!btn) return;

      const cta = normalizeCta(cfg);
      const isCta = (cta.mode === 'cta' && (cta.type === 'url' || cta.type === 'call'));
      btn.classList.toggle('is-cta', isCta);

      if (isCta) {
        btn.dataset.type = cta.type;
        const aria = (cta.type === 'call') ? 'Call now' : 'Visit website';
        btn.setAttribute('aria-label', aria);
        btn.setAttribute('title', aria);

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

      if (cta.mode !== 'cta') {
        return shareNative(cfg, flyerId);
      }

      if (cta.type === 'url' && cta.url) {
        try { window._paq?.push(['trackEvent', 'CTA', 'Visit website', cta.url]); } catch(e){}
        window.open(cta.url, '_blank', 'noopener');
        return;
      }

      if (cta.type === 'call' && cta.phone) {
        try { window._paq?.push(['trackEvent', 'CTA', 'Call now', cta.phone]); } catch(e){}
        location.href = `tel:${cta.phone}`;
        return;
      }

      return shareNative(cfg, flyerId);
    }

    const actionsAfterPlay = (cfg?.ui?.actionsAfterPlay !== false);

    if (actionsAfterPlay) {
      const actions = document.getElementById('actions');
      const playBtn = document.getElementById('play-pause');
      const audioEl = window.Amplitude?.getAudio?.();

      if (actions && !actions.classList.contains('is-hidden')) {
        const reveal = () => actions.classList.add('is-visible');
        playBtn?.addEventListener('click', reveal, { once: true });
        audioEl?.addEventListener('play', reveal, { once: true, passive: true });
      }
    } else {
      document.getElementById('actions')?.classList.add('is-visible');
    }

    applySecondaryButtonUi(cfg);

    const waBtn = document.getElementById('share-wa');
    setElVisible(waBtn, cfg?.actions?.whatsapp !== false);

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