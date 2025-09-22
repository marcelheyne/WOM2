(function(){
  const $ = s => document.querySelector(s);
  const MATOMO_BASE = (window.WOM_MATOMO && window.WOM_MATOMO.base) || "https://metrics.wom.center/";
  // If you created visit-scope custom dimensions in Matomo, map their IDs here; otherwise set to null
  const MATOMO_DIM = { flyerId: 1, flyerType: 2, trackTitle: 3 }; // adjust/remove as needed

  function t(sec){ sec=sec|0; return ((sec/60)|0)+':'+('0'+(sec%60)).slice(-2); }

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

    $('#next')?.addEventListener('click', () => mtmTrack('Audio','Next'));
    $('#prev')?.addEventListener('click', () => mtmTrack('Audio','Prev'));
    $('#share')?.addEventListener('click',() => mtmTrack('Share','Click'));
  }
  
  /* ---------- AUMA helpers ---------- */
  const $id = (x) => document.getElementById(x);
  
  function parseTime(t){
    if (typeof t === 'number') return t;
    if (!t) return 0;
    const parts = t.split(':').map(Number);
    return parts.length === 2 ? parts[0]*60 + parts[1] : Number(t)||0;
  }
  
  function normalizeSlides(slides = []){
    return slides
      .map(s => ({...s, _t: parseTime(s.t)}))
      .filter(s => s.src)
      .sort((a,b)=>a._t-b._t);
  }
  
  function preload(src){ const i = new Image(); i.src = src; }
  
  /* state */
  let currentSlides = null;
  let currentSlideIdx = -1;
  let aumaVisible = false;
  
  function showAuma(show){
    const sec = $id('auma');
    if (!sec) return;
    aumaVisible = !!show;
    sec.classList.toggle('hidden', !show);
  }
  
  function setAumaImage(src, alt){
    const img = $id('auma-img');
    if (!img) return;
    img.classList.remove('ready');
    img.onload = () => img.classList.add('ready');
    img.src = src;
    img.alt = alt || '';
  }
  
  function setAumaCaption(text){
    const cap = $id('auma-caption');
    if (!cap) return;
    if (text){ cap.textContent = text; cap.hidden = false; }
    else     { cap.hidden = true; }
  }
  
  /* called when a new track becomes active */
  function setupAumaForTrack(track){
    currentSlides = null;
    currentSlideIdx = -1;
  
    if (!track) { showAuma(false); return; }
  
    if (track.slides && track.slides.length){
      currentSlides = normalizeSlides(track.slides);
      // preload first & next
      preload(currentSlides[0].src);
      if (currentSlides[1]) preload(currentSlides[1].src);
      // show first immediately
      setAumaImage(currentSlides[0].src, currentSlides[0].alt);
      setAumaCaption(currentSlides[0].cap || currentSlides[0].alt || '');
      showAuma(true);
      return;
    }
  
    if (track.image && track.image.src){
      setAumaImage(track.image.src, track.image.alt);
      setAumaCaption(track.image.cap || track.image.alt || '');
      showAuma(true);
      return;
    }
  
    // no auma for this track
    showAuma(false);
  }
  
  /* called on timeupdate/seek to adjust slide */
  function tickAuma(currentTime){
    if (!aumaVisible || !currentSlides) return;
    // find last slide with _t <= time (linear scan is fine for short lists)
    let idx = currentSlides.length - 1;
    for (let i=0;i<currentSlides.length;i++){
      if (currentSlides[i]._t <= currentTime) idx = i; else break;
    }
    if (idx !== currentSlideIdx){
      currentSlideIdx = idx;
      const s = currentSlides[idx];
      setAumaImage(s.src, s.alt);
      setAumaCaption(s.cap || s.alt || '');
      // preload the next one
      const next = currentSlides[idx+1]; if (next) preload(next.src);
      try { window._paq?.push(['trackEvent','Auma','Slide', String(idx)]); } catch(e){}
    }
  }

  // ---- App init ----
  async function main(){
    const flyerId   = location.pathname.replace(/^\/|\/$/g,'');   // e.g., "123"
    let startIndex  = +(new URLSearchParams(location.search).get('t')||0) || 0;

    // fetch config
    const cfgRes = await fetch(`/flyers/${flyerId}/config.json`, {cache:'no-store'});
    if(!cfgRes.ok){ document.title='Audio Flyer not found'; document.body.innerHTML='<p style="padding:24px">This Audio Flyer could not be found.</p>'; return; }
    const cfg = await cfgRes.json();

    document.title = cfg.title || `WOM.fm / ${flyerId}`;
    $('#track-title').textContent = cfg.title || 'WOM.fm Audio Flyer';

    if (cfg.cta?.url) { const cta=$('#cta'); cta.hidden=false; cta.href=cfg.cta.url; cta.textContent=cfg.cta.label||'Learn more'; }
    
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
      // stop the class after the animation runs
      const onEnd = () => waBtn.classList.remove('nudge');
      waBtn.addEventListener('animationend', onEnd, { once: true });
      waBtn.addEventListener('click', markDone, { once: true });
      waBtn.addEventListener('focus', markDone, { once: true });
      try { window._paq?.push(['trackEvent', 'Share Nudge', 'Shown', flyerId]); } catch(e){}
    };
  
    const onProgress = () => {
      const t = audio.currentTime || 0;
      const d = audio.duration || 0;
      const pct = d ? (t / d) : 0;
      if (t >= minSeconds || pct >= minPercent) {
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
    // ---- Matomo: per-flyer siteId from config ----
    const flyerType = (cfg.type || 'single').toLowerCase();
    const siteId    = cfg.analytics && cfg.analytics.siteId; // e.g., { "analytics": { "siteId": 7 } }
    wireMatomo({ siteId, flyerId, flyerType, title: document.title });

    const base = `/flyers/${flyerId}/`;
    if (cfg.branding) {
      const root = document.documentElement.style;
      if (cfg.branding.primary) root.setProperty('--brand',  cfg.branding.primary);
      if (cfg.branding.accent)  root.setProperty('--accent', cfg.branding.accent);
      if (cfg.branding.logo)    document.getElementById('brand-logo').src = base + cfg.branding.logo;
      if (cfg.branding.logoHeight) root.setProperty('--logo-height', cfg.branding.logoHeight + 'px');
    }
    const type = flyerType;
    let songs = [];

    if (type==='single' || type==='playlist'){
      songs = (cfg.tracks||[]).map(t => ({ name:t.title||'', url: base+t.src, cover_art_url: cfg.cover? base+cfg.cover:undefined }));
    } else if (type==='auma'){
      const s = (cfg.tracks?.[0]) || (cfg.slides?.[0]) || {};
      songs = [{ name:s.title||'', url: base+(s.src||''), cover_art_url: s.image? base+s.image : (cfg.cover? base+cfg.cover:undefined)}];
    } else if (type==='auma-seq'){
      songs = (cfg.slides||[]).map(s => ({ name:s.title||'', url: base+s.src, cover_art_url: s.image? base+s.image: undefined }));
    }

    if (!songs.length){ document.body.innerHTML='<p style="padding:24px">No audio configured.</p>'; return; }

    const multi = songs.length > 1;
    
    document.getElementById('previous')?.classList.toggle('hidden', !multi);
    document.getElementById('next')?.classList.toggle('hidden', !multi);

    Amplitude.init({ songs });
    if (startIndex>0 && startIndex<songs.length) Amplitude.playSongAtIndex(startIndex);

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


    // Hook events after Amplitude is ready
    wireAudioEvents();
    
    // Auma 1) when a track changes
    Amplitude.bind('song_change', function(){
      const idx = Amplitude.getActiveIndex();
      const t = (cfg.tracks || [])[idx];
      setupAumaForTrack(t);
    });
    
    // 2) on first load (init current track)
    {
      const idx = Amplitude.getActiveIndex?.() ?? 0;
      const t = (cfg.tracks || [])[idx];
      setupAumaForTrack(t);
    }
    
    // 3) on time updates
    const audio = Amplitude.getAudio();
    audio.addEventListener('timeupdate', () => tickAuma(audio.currentTime), { passive:true });
    audio.addEventListener('seeked', () => tickAuma(audio.currentTime), { passive:true });

// Build share URL with UTM attribution
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
    
      // If native share exists, use it
      if (navigator.share){
        try {
          await navigator.share({ title: text, text, url });
          window._paq?.push(['trackEvent', 'Share', 'Native', flyerId]);
          return;
        } catch(e){ /* user canceled or OS error */ }
      }
    
      // fallback: copy to clipboard then open generic chooser tab
      try {
        await navigator.clipboard?.writeText(url);
        alert('Link copied to clipboard 👍');
      } catch(e) {
        // ultimate fallback: open in a new tab so user can copy
        window.open(url, '_blank', 'noopener');
      }
    }
    
    // enable per flyer (default on). Disable by setting "nudge": false in config
    scheduleNudgeAfterEngagement(flyerId, {
      enabled: cfg.nudge !== false,
      minSeconds: 10,      // tweak to 5–12s if you want
      minPercent: 0.25,    // or 0.20/0.33 etc.
      delayMs: 500,
      alsoOnEnded: true
    });
    
    document.getElementById('share-wa')?.addEventListener('click', () => shareWhatsApp(cfg, flyerId));
    document.getElementById('share-native')?.addEventListener('click', () => shareNative(cfg, flyerId));
  }

  window.addEventListener('DOMContentLoaded', main);
})();