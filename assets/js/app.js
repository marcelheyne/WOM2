(function(){
  const $ = s => document.querySelector(s);
  const flyerId = location.pathname.replace(/^\/|\/$/g,'');
  let startIndex = +(new URLSearchParams(location.search).get('t')||0) || 0;

  function t(sec){ sec=sec|0; return ((sec/60)|0)+':'+('0'+(sec%60)).slice(-2); }

  async function main(){
    const cfgRes = await fetch(`/flyers/${flyerId}/config.json`, {cache:'no-store'});
    if(!cfgRes.ok){ document.title='Audio Flyer not found'; document.body.innerHTML='<p style="padding:24px">This Audio Flyer could not be found.</p>'; return; }
    const cfg = await cfgRes.json();

    document.title = cfg.title || `WOM.fm / ${flyerId}`;
    $('#flyer-title').textContent = cfg.title || 'WOM.fm Audio Flyer';

    if (cfg.cta?.url) { const cta=$('#cta'); cta.hidden=false; cta.href=cfg.cta.url; cta.textContent=cfg.cta.label||'Learn more'; }

    const base = `/flyers/${flyerId}/`;
    const type = (cfg.type||'single').toLowerCase();
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

    const multi = songs.length>1;
    $('#prev').hidden = !multi; $('#next').hidden=!multi;

    Amplitude.init({ songs });
    if (startIndex>0 && startIndex<songs.length) Amplitude.playSongAtIndex(startIndex);

    const audio = Amplitude.getAudio();
    const prog = $('#progress'); const cur=$('#current'), dur=$('#duration');
    function upd(){ const c=audio.currentTime||0, d=audio.duration||0; cur.textContent=t(c); dur.textContent=d? t(d):'0:00'; prog.style.width = d? (c/d*100)+'%':'0'; }
    audio.addEventListener('timeupdate', upd); audio.addEventListener('loadedmetadata', upd);

    $('#playpause').onclick=()=>Amplitude.playPause();
    $('#prev').onclick=()=>Amplitude.prev();
    $('#next').onclick=()=>Amplitude.next();

    if (type==='auma' || type==='auma-seq'){
      const img = $('#auma-image'); $('#auma').hidden=false;
      function setImg(){ const s = songs[Amplitude.getActiveIndex()]; if(s?.cover_art_url) img.src=s.cover_art_url; }
      setImg(); document.addEventListener('amplitude-song-change', setImg);
    }

    $('#share').onclick = async () => {
      const idx=Amplitude.getActiveIndex(); const url=`${location.origin}${location.pathname}?t=${idx}`;
      const text=(cfg.title||'WOM.fm Audio Flyer')+' '+url;
      if (navigator.share) { try{ await navigator.share({title:cfg.title||'WOM.fm', url}); }catch(e){} }
      else { window.open('https://wa.me/?text='+encodeURIComponent(text), '_blank', 'noopener'); }
    };
  }

  window.addEventListener('DOMContentLoaded', main);
})();