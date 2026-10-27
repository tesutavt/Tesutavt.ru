import type { WidgetPreset } from "@/lib/widget-types";

export const musicPlayerPreset: WidgetPreset = {
  id: "music-player",
  name: "Музыка (сейчас играет)",
  description: "Карточка текущего трека из очереди (Яндекс.Музыка / YouTube) с прогресс-баром и очередью",
  width: 420,
  height: 120,
  fieldsSchema: [
    { key: "accentColor", label: "Акцентный цвет (прогресс-бар)", type: "color", default: "#a970ff" },
    { key: "textColor", label: "Цвет текста", type: "color", default: "#ffffff" },
    { key: "backgroundColor", label: "Цвет фона карточки", type: "color", default: "#16121f" },
    { key: "backgroundOpacity", label: "Непрозрачность фона (%)", type: "number", default: 70 },
    { key: "cornerRadius", label: "Скругление углов (px)", type: "number", default: 16 },
    { key: "showQueueList", label: "Показывать очередь снизу", type: "boolean", default: true },
  ],
  html: `<div class="mp-card" id="mpCard">
  <img class="mp-cover" id="mpCover" alt="" />
  <div class="mp-info">
    <div class="mp-title" id="mpTitle">Сейчас ничего не играет</div>
    <div class="mp-artist" id="mpArtist"></div>
    <div class="mp-progress"><div class="mp-bar" id="mpBar"></div></div>
  </div>
</div>
<div class="mp-queue" id="mpQueue"></div>
<div id="mpYoutube" style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;"></div>
<audio id="mpAudio" style="display:none"></audio>`,
  css: `* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; color: var(--mp-text, #fff); }
.mp-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  background: var(--mp-bg, rgba(22,18,31,0.7));
  border-radius: var(--mp-radius, 16px);
  backdrop-filter: blur(6px);
}
.mp-cover {
  width: 56px;
  height: 56px;
  border-radius: calc(var(--mp-radius, 16px) * 0.6);
  object-fit: cover;
  background: rgba(255,255,255,0.08);
  flex: none;
}
.mp-info { min-width: 0; flex: 1; }
.mp-title, .mp-artist {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mp-title { font-size: 16px; font-weight: 600; }
.mp-artist { font-size: 13px; opacity: 0.75; margin-top: 2px; }
.mp-progress {
  margin-top: 8px;
  height: 4px;
  border-radius: 2px;
  background: rgba(255,255,255,0.15);
  overflow: hidden;
}
.mp-bar {
  height: 100%;
  width: 0%;
  background: var(--mp-accent, #a970ff);
  transition: width 0.4s linear;
}
.mp-queue {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.mp-queue-item {
  font-size: 12px;
  opacity: 0.65;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 4px 12px;
  background: var(--mp-bg, rgba(22,18,31,0.5));
  border-radius: 8px;
}`,
  js: `(function () {
  var TOKEN = window.widget.overlayToken;
  var fields = window.widget.fields;

  function hexToRgba(hex, alpha) {
    var h = String(hex || '#16121f').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var r = parseInt(h.substring(0, 2), 16) || 0;
    var g = parseInt(h.substring(2, 4), 16) || 0;
    var b = parseInt(h.substring(4, 6), 16) || 0;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function applyFields() {
    var alpha = Math.max(0, Math.min(100, fields.backgroundOpacity ?? 70)) / 100;
    var root = document.documentElement.style;
    root.setProperty('--mp-accent', fields.accentColor || '#a970ff');
    root.setProperty('--mp-text', fields.textColor || '#ffffff');
    root.setProperty('--mp-radius', (fields.cornerRadius ?? 16) + 'px');
    root.setProperty('--mp-bg', hexToRgba(fields.backgroundColor, alpha));
  }
  applyFields();

  var els = {
    cover: document.getElementById('mpCover'),
    title: document.getElementById('mpTitle'),
    artist: document.getElementById('mpArtist'),
    bar: document.getElementById('mpBar'),
    queue: document.getElementById('mpQueue'),
    audio: document.getElementById('mpAudio'),
  };

  // --- состояние проигрывания ---
  var currentTrackKey = null; // "source:sourceId:trackRowId" — меняется даже при повторном заказе того же трека
  var youtubePlayer = null;
  var youtubeReady = false;
  var youtubeUnmuteVolume = null; // не null, пока ждём первого PLAYING после mute()
  var pendingYoutubeTrack = null;
  var progressTicks = 0;

  function ensureYoutubeApi() {
    if (window.YT && window.YT.Player) { return; }
    if (document.getElementById('mpYtScript')) return;
    var tag = document.createElement('script');
    tag.id = 'mpYtScript';
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = function () {
      youtubePlayer = new YT.Player('mpYoutube', {
        width: '1',
        height: '1',
        playerVars: { controls: 0, disablekb: 1, playsinline: 1, rel: 0 },
        events: {
          onReady: function () {
            youtubeReady = true;
            if (pendingYoutubeTrack) playYoutube(pendingYoutubeTrack);
          },
          onStateChange: function (e) {
            // Приглушённый автоплей браузеры разрешают почти всегда — стартуем
            // замьюченными и снимаем mute, как только видео реально заиграло.
            if (e.data === YT.PlayerState.PLAYING && youtubeUnmuteVolume !== null) {
              youtubePlayer.unMute();
              youtubePlayer.setVolume(youtubeUnmuteVolume);
              youtubeUnmuteVolume = null;
            }
            if (e.data === YT.PlayerState.ENDED) reportEnded();
          },
        },
      });
    };
  }

  function playYoutube(track) {
    pendingYoutubeTrack = track;
    if (!youtubeReady || !youtubePlayer) return;
    youtubeUnmuteVolume = Math.round((track.volume ?? 0.8) * 100);
    youtubePlayer.mute();
    youtubePlayer.loadVideoById({ videoId: track.sourceId, startSeconds: Math.max(0, track.currentTimeSec || 0) });
  }

  function stopYoutube() {
    pendingYoutubeTrack = null;
    youtubeUnmuteVolume = null;
    if (youtubeReady && youtubePlayer) youtubePlayer.stopVideo();
  }

  function attemptPlayAudio() {
    els.audio.play().catch(function (err) {
      if (err && err.name === 'NotAllowedError' && !els.audio.muted) {
        els.audio.muted = true;
        els.audio.play().then(function () { els.audio.muted = false; }).catch(function () {});
      }
    });
  }

  function playAudio(track) {
    els.audio.src = track.streamUrl;
    els.audio.currentTime = Math.max(0, track.currentTimeSec || 0);
    els.audio.volume = track.volume ?? 0.8;
    attemptPlayAudio();
  }

  function stopAudio() {
    els.audio.pause();
    els.audio.removeAttribute('src');
    els.audio.load();
  }

  function reportEnded() {
    var trackId = currentTrackKey ? currentTrackKey.split(':')[2] : null;
    fetch('/api/public/music/' + TOKEN + '/ended', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackId: trackId }),
    }).catch(function () {});
  }

  function reportProgress(trackId, currentTimeSec) {
    fetch('/api/public/music/' + TOKEN + '/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackId: trackId, currentTimeSec: currentTimeSec }),
    }).catch(function () {});
  }

  function renderQueue(items) {
    if (!fields.showQueueList) { els.queue.style.display = 'none'; return; }
    els.queue.style.display = '';
    els.queue.innerHTML = '';
    (items || []).slice(0, 5).forEach(function (item) {
      var row = document.createElement('div');
      row.className = 'mp-queue-item';
      row.textContent = item.artist + ' — ' + item.title;
      els.queue.appendChild(row);
    });
  }

  function renderCurrent(track) {
    if (!track) {
      els.title.textContent = 'Сейчас ничего не играет';
      els.artist.textContent = '';
      els.cover.style.visibility = 'hidden';
      els.bar.style.width = '0%';
      return;
    }
    els.title.textContent = track.title;
    els.artist.textContent = track.artist;
    if (track.cover) {
      els.cover.src = track.cover;
      els.cover.style.visibility = 'visible';
    } else {
      els.cover.style.visibility = 'hidden';
    }
  }

  function tick() {
    if (!currentTrackKey) return;
    var source = currentTrackKey.split(':')[0];
    var t = 0, d = 0;
    if (source === 'youtube' && youtubeReady && youtubePlayer && youtubePlayer.getDuration) {
      d = youtubePlayer.getDuration() || 0;
      t = youtubePlayer.getCurrentTime() || 0;
    } else if (source === 'yandex') {
      d = els.audio.duration || 0;
      t = els.audio.currentTime || 0;
    }
    if (d > 0) els.bar.style.width = Math.min(100, (t / d) * 100) + '%';

    progressTicks += 1;
    if (progressTicks >= 3) {
      progressTicks = 0;
      reportProgress(currentTrackKey.split(':')[2], t);
    }
  }
  setInterval(tick, 1000);

  function applyState(state) {
    renderQueue(state.items);
    var current = state.current;
    var volume = typeof state.volume === 'number' ? state.volume : 0.8;
    renderCurrent(current);

    if (!current) {
      if (currentTrackKey) { stopAudio(); stopYoutube(); }
      currentTrackKey = null;
      return;
    }

    var trackKey = current.source + ':' + current.sourceId + ':' + current.id;
    if (trackKey === currentTrackKey) {
      if (current.source === 'yandex') els.audio.volume = volume;
      else if (current.source === 'youtube' && youtubeReady && youtubePlayer && youtubeUnmuteVolume === null) {
        youtubePlayer.setVolume(Math.round(volume * 100));
      }
      return;
    }

    var previousSource = currentTrackKey ? currentTrackKey.split(':')[0] : null;
    if (previousSource === 'yandex') stopAudio();
    if (previousSource === 'youtube') stopYoutube();

    currentTrackKey = trackKey;
    progressTicks = 0;

    if (current.source === 'yandex') {
      playAudio({ streamUrl: current.streamUrl, currentTimeSec: current.currentTimeSec, volume: volume });
    } else if (current.source === 'youtube') {
      ensureYoutubeApi();
      playYoutube({ sourceId: current.sourceId, currentTimeSec: current.currentTimeSec, volume: volume });
    }
  }

  function poll() {
    fetch('/api/public/music/' + TOKEN + '/state', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(applyState)
      .catch(function () {})
      .then(function () { setTimeout(poll, 3000); });
  }

  els.audio.addEventListener('ended', reportEnded);

  if (!TOKEN) {
    els.title.textContent = 'Сохраните виджет, чтобы получить ссылку оверлея';
  } else {
    poll();
  }
})();`,
};
