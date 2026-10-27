import type { WidgetPreset } from "@/lib/widget-types";

// Портировано из StreamElements-виджета. Два реальных отличия контракта,
// из-за которых это не 1:1 копипаста:
//
// 1. У SE был отдельный `onWidgetLoad` с fieldData/channel в event.detail;
//    здесь `window.widget.fields`/`window.widget.channel` уже готовы к
//    моменту запуска скрипта — читаем напрямую, без ожидания события.
// 2. У SE `tags.emotes` — IRC-строка с id и позициями символов, что даёт
//    возможность подставить картинку нативного твич-эмоута по id. Здесь
//    (см. lib/twitch-fields.ts, событие chatMessage) в Phase 1 приходит
//    только `message.emotes` — массив ИМЁН без id и позиций. Без id нет
//    прямого способа построить ссылку на CDN-картинку, поэтому нативные
//    твич-эмоуты подсвечиваются как текст, а не рендерятся картинкой (эмоуты
//    7TV — по-прежнему полноценные картинки, они матчатся по имени). Когда
//    в Phase 2 подключится реальный EventSub, это можно будет доработать,
//    если в событие добавят id эмоутов.
export const chatOverlayPreset: WidgetPreset = {
  id: "chat-overlay",
  name: "Чат (пузыри)",
  description: "Оверлей чата с ролями, аватарками и эмоутами 7TV — пузырьки, всплывающие снизу",
  width: 420,
  height: 600,
  fieldsSchema: [
    {
      key: "fontFamily",
      label: "Шрифт",
      type: "select",
      default: "Fredoka",
      options: ["Fredoka", "Baloo 2", "Poppins", "Quicksand"],
    },
    { key: "fontSize", label: "Размер текста (px)", type: "number", default: 16 },
    { key: "textColor", label: "Цвет текста", type: "color", default: "#ffffff" },
    { key: "bubbleColor", label: "Цвет пузыря", type: "color", default: "#3a5c4a" },
    { key: "bubbleOpacity", label: "Непрозрачность пузыря (%)", type: "number", default: 55 },
    { key: "subBubbleColor", label: "Цвет пузыря сабов", type: "color", default: "#8fe0d6" },
    { key: "modBubbleColor", label: "Цвет пузыря модераторов", type: "color", default: "#b98450" },
    { key: "accentColor", label: "Акцентный цвет", type: "color", default: "#7fb241" },
    { key: "chatWidth", label: "Ширина (px)", type: "number", default: 420 },
    { key: "showAvatars", label: "Показывать аватарки", type: "boolean", default: true },
    { key: "maxMessages", label: "Макс. сообщений на экране", type: "number", default: 8 },
    { key: "messageLifetime", label: "Время жизни сообщения (сек, 0 = вечно)", type: "number", default: 15 },
    { key: "sevenTVEnabled", label: "Эмоуты 7TV", type: "boolean", default: true },
    { key: "debugMode", label: "Debug-индикатор в углу", type: "boolean", default: false },
  ],
  html: `<div id="chat-root">
  <ul id="chat-list"></ul>
</div>`,
  css: `@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&family=Baloo+2:wght@700&family=Poppins:wght@600;700&family=Quicksand:wght@700&display=swap');

:root{
  --font-family: 'Fredoka', sans-serif;
  --font-size: 16px;
  --text-color: #ffffff;
  --sub-text-color: #eaf6da;
  --bubble-bg: rgba(58, 92, 74, 0.55);
  --sub-bubble-bg: #8fe0d6;
  --sub-bubble-text: #17423c;
  --mod-bubble-bg: #b98450;
  --mod-bubble-text: #fff8ec;
  --vip-color: #f4d35e;
  --mod-color: #cf9a5f;
  --sub-color: #8fe0d6;
  --follower-color: #d7e896;
  --streamer-color: #ffffff;
  --accent-color: #7fb241;
  --chat-width: 420px;
  --avatar-size: 40px;
  --radius: 18px;
}

*{ box-sizing:border-box; }

html,body{
  margin:0; padding:0; background:transparent;
  font-family: var(--font-family);
  overflow:hidden;
  height:100%;
}

#chat-root{
  width: var(--chat-width);
  height: 100%;
  min-height: 0;
  padding: 12px;
  display:flex;
  flex-direction:column;
  justify-content:flex-end;
  overflow:hidden;
}

#chat-list{
  list-style:none;
  margin:0; padding:0;
  display:flex;
  flex-direction:column;
  gap:14px;
  max-height:100%;
  min-height: 0;
  overflow:hidden;
}

.chat-row{
  display:flex;
  flex-direction:column;
  gap:4px;
  animation: chat-pop 0.2s ease-out;
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.chat-row.leaving{
  opacity: 0;
  transform: translateY(-8px);
}

@keyframes chat-pop{
  from{ opacity:0; transform: translateY(8px) scale(0.98); }
  to{ opacity:1; transform: translateY(0) scale(1); }
}

.chat-name-row{
  display:flex;
  align-items:center;
  gap:6px;
  padding-left: calc(var(--avatar-size) + 10px);
}

.chat-name-row .badge-icon{
  font-size: 12px;
  line-height:1;
}

.username{
  font-size: 13px;
  font-weight: 700;
  letter-spacing:.2px;
  text-transform:uppercase;
}

.role-streamer .username{ color: var(--streamer-color); }
.role-mod .username{ color: var(--mod-color); }
.role-vip .username{ color: var(--vip-color); }
.role-subscriber .username{ color: var(--sub-color); }
.role-viewer .username{ color: #eaf6da; }

.chat-body{
  display:flex;
  align-items:flex-start;
  gap:10px;
}

.avatar{
  position: relative;
  flex: 0 0 auto;
  width: var(--avatar-size);
  height: var(--avatar-size);
  border-radius: 12px;
  overflow: hidden;
  font-weight:700;
  font-size: 15px;
  color:#fff;
}

.avatar .avatar-fallback{
  position:absolute; top:0; right:0; bottom:0; left:0;
  display:flex;
  align-items:center;
  justify-content:center;
}

.avatar .avatar-img{
  position:absolute; top:0; right:0; bottom:0; left:0;
  width:100%; height:100%;
  object-fit:cover;
}

.bubble{
  background: var(--bubble-bg);
  color: var(--text-color);
  padding: 10px 14px;
  border-radius: var(--radius);
  font-size: var(--font-size);
  line-height:1.35;
  word-break: break-word;
  max-width: calc(100% - 60px);
  border: 1.5px solid rgba(255,255,255,0.45);
  box-shadow: 0 2px 10px rgba(20,50,40,0.25);
}

.role-subscriber .bubble{ background: var(--sub-bubble-bg); color: var(--sub-bubble-text); }
.role-mod .bubble{ background: var(--mod-bubble-bg); color: var(--mod-bubble-text); }
.role-vip .bubble{ background: transparent; border: 2px solid var(--vip-color); color: var(--text-color); }

.bubble-emote-only{
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 2px 0 !important;
}
.bubble-emote-only .chat-emote{
  height: 2.6em;
}

.chat-emote{
  height: 1.6em;
  vertical-align: middle;
  margin: 0 1px;
}

.chat-emote-native{
  font-weight: 700;
  color: var(--accent-color);
}

.badge-pill{
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 999px;
  background: var(--accent-color);
  color: #fff;
  margin-left: 4px;
}

.alert-row{
  display:flex;
  align-items:center;
  gap:8px;
  padding: 8px 4px;
}

.alert-row .toggle-dot{
  width: 30px; height:16px; border-radius:999px;
  background: var(--accent-color);
  position:relative;
  flex: 0 0 auto;
}
.alert-row .toggle-dot::after{
  content:'';
  position:absolute; top:2px; left:2px;
  width:12px; height:12px; border-radius:50%;
  background:#fff;
}

.alert-text{
  font-size: 12px;
  font-weight:700;
  text-transform:uppercase;
  color: var(--sub-text-color);
  letter-spacing:.3px;
}

.alert-highlight{ color:#fff; }

.event-card{
  background: var(--bubble-bg);
  border-radius: var(--radius);
  padding: 12px 16px;
  text-align:center;
}

.event-card .event-title{
  font-weight:700;
  font-size:14px;
  color:#fff;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:8px;
}

.event-card .event-amount{
  background: var(--accent-color);
  color:#fff;
  font-size:11px;
  font-weight:700;
  padding: 2px 8px;
  border-radius: 999px;
}

.event-card .event-msg{
  margin-top:6px;
  font-size: var(--font-size);
  color: var(--text-color);
}

#chat-debug-box{
  position: fixed;
  bottom: 4px;
  left: 4px;
  right: 4px;
  background: rgba(0,0,0,0.75);
  color: #6f6;
  font-family: monospace;
  font-size: 11px;
  padding: 3px 6px;
  border-radius: 4px;
  z-index: 9999;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}`,
  js: `(function () {
  'use strict';

  var state = {
    fieldData: window.widget.fields || {},
    sevenTVEmotes: {},
    intervals: []
  };

  function every(ms, fn) {
    var id = setInterval(fn, ms);
    state.intervals.push(id);
    return id;
  }

  function hexToRgba(hex, alpha) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var r = parseInt(h.substring(0, 2), 16) || 0;
    var g = parseInt(h.substring(2, 4), 16) || 0;
    var b = parseInt(h.substring(4, 6), 16) || 0;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + (Number.isFinite(alpha) ? alpha : 1) + ')';
  }

  function applyFields() {
    var fd = state.fieldData;
    var root = document.documentElement.style;
    if (fd.fontFamily) root.setProperty('--font-family', "'" + fd.fontFamily + "', sans-serif");
    if (fd.fontSize) root.setProperty('--font-size', fd.fontSize + 'px');
    if (fd.textColor) root.setProperty('--text-color', fd.textColor);
    if (fd.bubbleColor) root.setProperty('--bubble-bg', hexToRgba(fd.bubbleColor, (fd.bubbleOpacity == null ? 55 : fd.bubbleOpacity) / 100));
    if (fd.subBubbleColor) root.setProperty('--sub-bubble-bg', fd.subBubbleColor);
    if (fd.modBubbleColor) root.setProperty('--mod-bubble-bg', fd.modBubbleColor);
    if (fd.accentColor) root.setProperty('--accent-color', fd.accentColor);
    if (fd.chatWidth) root.setProperty('--chat-width', fd.chatWidth + 'px');
  }

  function ensureRootExists() {
    if (document.getElementById('chat-list')) return;
    if (!document.body) return;
    var root = document.createElement('div');
    root.id = 'chat-root';
    var list = document.createElement('ul');
    list.id = 'chat-list';
    root.appendChild(list);
    document.body.appendChild(root);
    debugLog('watchdog: пересоздал пропавший #chat-root');
  }

  function chatList() {
    ensureRootExists();
    return document.getElementById('chat-list');
  }

  every(2000, ensureRootExists);

  function debugLog(msg) {
    if (!state.fieldData.debugMode) return;
    var box = document.getElementById('chat-debug-box');
    if (!box) {
      box = document.createElement('div');
      box.id = 'chat-debug-box';
      document.body.appendChild(box);
    }
    box.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function hashColor(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    var hue = Math.abs(hash) % 360;
    return 'hsl(' + hue + ', 60%, 45%)';
  }

  function initials(name) {
    return (name || '?').trim().slice(0, 2).toUpperCase();
  }

  function numberField(value, fallback) {
    return Number((value === undefined || value === null || value === '') ? fallback : value);
  }

  function load7TVEmotes(channelId) {
    function addEmoteSet(list) {
      (list || []).forEach(function (e) {
        var host = e.data && e.data.host;
        if (host && e.name) state.sevenTVEmotes[e.name] = 'https:' + host.url + '/2x.webp';
      });
    }

    fetch('https://7tv.io/v3/emote-sets/global')
      .then(function (r) { return r.json(); })
      .then(function (g) { addEmoteSet(g.emotes); })
      .catch(function (e) { console.warn('[chat-overlay] не удалось загрузить глобальные эмоуты 7TV', e); });

    if (!channelId) return;
    fetch('https://7tv.io/v3/users/twitch/' + channelId)
      .then(function (r) { if (!r.ok) throw new Error('7TV channel lookup: ' + r.status); return r.json(); })
      .then(function (c) { addEmoteSet(c.emote_set && c.emote_set.emotes); })
      .catch(function (e) { console.warn('[chat-overlay] не удалось загрузить эмоуты канала 7TV', e); });
  }

  function buildMessageSegments(text, nativeEmoteNames) {
    var segments = [];
    var use7tv = state.fieldData.sevenTVEnabled !== false;
    var nativeSet = {};
    (nativeEmoteNames || []).forEach(function (n) { nativeSet[n] = true; });

    text.split(/(\\s+)/).forEach(function (token) {
      if (token === '') return;
      if (/^\\s+$/.test(token)) { segments.push({ type: 'text', value: token }); return; }
      if (nativeSet[token]) {
        segments.push({ type: 'native-emote', value: token });
      } else if (use7tv && state.sevenTVEmotes[token]) {
        segments.push({ type: 'emote', url: state.sevenTVEmotes[token] });
      } else {
        segments.push({ type: 'text', value: token });
      }
    });

    return segments;
  }

  function renderMessageBody(text, nativeEmoteNames) {
    if (!text) return { html: '', emoteOnly: false };
    var segments = buildMessageSegments(text, nativeEmoteNames);
    var html = segments.map(function (s) {
      if (s.type === 'emote') return '<img class="chat-emote" src="' + s.url + '" alt="emote">';
      if (s.type === 'native-emote') return '<span class="chat-emote-native">' + escapeHtml(s.value) + '</span>';
      return escapeHtml(s.value);
    }).join('');
    var hasEmote = segments.some(function (s) { return s.type === 'emote' || s.type === 'native-emote'; });
    var hasVisibleText = segments.some(function (s) { return s.type === 'text' && s.value.trim() !== ''; });
    return { html: html, emoteOnly: hasEmote && !hasVisibleText };
  }

  function getRole(badges) {
    if (!badges) return 'viewer';
    if (badges.isBroadcaster) return 'streamer';
    if (badges.isMod) return 'mod';
    if (badges.isVip) return 'vip';
    if (badges.isSub) return 'subscriber';
    return 'viewer';
  }

  function roleIcon(role) {
    switch (role) {
      case 'streamer': return '\\uD83C\\uDFA5';
      case 'mod': return '\\uD83D\\uDEE1\\uFE0F';
      case 'vip': return '\\uD83D\\uDC8E';
      case 'subscriber': return '\\u2B50';
      default: return '';
    }
  }

  function makeAvatar(username, avatarUrl, color) {
    if (state.fieldData.showAvatars === false) return '';
    var bg = color || hashColor(username || 'viewer');
    var initialsHtml = escapeHtml(initials(username));
    if (avatarUrl) {
      return '<div class="avatar" style="background:' + bg + '">' +
        '<span class="avatar-fallback">' + initialsHtml + '</span>' +
        '<img class="avatar-img" src="' + avatarUrl + '" alt="" loading="lazy" onerror="this.remove()">' +
        '</div>';
    }
    return '<div class="avatar" style="background:' + bg + '"><span class="avatar-fallback">' + initialsHtml + '</span></div>';
  }

  var pendingQueue = [];

  function appendRow(html) {
    pendingQueue.push(html);
  }

  function flushQueue() {
    if (!pendingQueue.length) return;

    var max = numberField(state.fieldData.maxMessages, 8);
    if (pendingQueue.length > max) {
      pendingQueue = pendingQueue.slice(-max);
    }

    var frag = document.createDocumentFragment();
    var now = String(Date.now());
    pendingQueue.forEach(function (html) {
      var li = document.createElement('li');
      li.className = 'chat-row';
      li.dataset.createdAt = now;
      li.innerHTML = html;
      frag.appendChild(li);
    });
    pendingQueue = [];

    chatList().appendChild(frag);
    trimNow();
  }

  every(200, flushQueue);

  function fadeAndRemove(li, instant) {
    if (!li || li.dataset.removing) return;
    li.dataset.removing = '1';
    if (instant) { li.remove(); return; }
    li.classList.add('leaving');
    setTimeout(function () { li.remove(); }, 200);
  }

  function trimNow() {
    var max = numberField(state.fieldData.maxMessages, 8);
    var lifetime = numberField(state.fieldData.messageLifetime, 15);
    var now = Date.now();

    var rows = Array.prototype.filter.call(chatList().children, function (r) {
      return !r.classList.contains('leaving');
    });

    var toRemoveByAge = [];
    if (lifetime > 0) {
      toRemoveByAge = rows.filter(function (r) {
        return now - Number(r.dataset.createdAt || now) >= lifetime * 1000;
      });
    }
    var remaining = rows.filter(function (r) { return toRemoveByAge.indexOf(r) === -1; });
    var overflowCount = Math.max(0, remaining.length - max);
    var toRemoveByCount = remaining.slice(0, overflowCount);

    var toRemove = toRemoveByAge.concat(toRemoveByCount);
    var instant = toRemove.length > 4;
    toRemove.forEach(function (r) { fadeAndRemove(r, instant); });
  }

  every(3000, trimNow);

  function renderChatMessage(data) {
    var user = data.user || {};
    var username = user.name || 'viewer';
    var role = getRole(user.badges);
    var color = user.color || '';
    debugLog('сообщение от ' + username);

    var msg = data.message || {};
    var rendered = renderMessageBody(msg.text || '', msg.emotes);
    var icon = roleIcon(role);

    appendRow(
      '<div class="role-' + role + '">' +
        '<div class="chat-name-row">' +
          (icon ? '<span class="badge-icon">' + icon + '</span>' : '') +
          '<span class="username">' + escapeHtml(username) + '</span>' +
        '</div>' +
        '<div class="chat-body">' +
          makeAvatar(username, user.avatar, color) +
          '<div class="bubble' + (rendered.emoteOnly ? ' bubble-emote-only' : '') + '">' + rendered.html + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderEventCard(title, amountLabel, message) {
    appendRow(
      '<div class="event-card">' +
        '<div class="event-title">' + escapeHtml(title) +
          (amountLabel ? ' <span class="event-amount">' + escapeHtml(amountLabel) + '</span>' : '') +
        '</div>' +
        (message ? '<div class="event-msg">' + escapeHtml(message) + '</div>' : '') +
      '</div>'
    );
  }

  function renderFollow(username) {
    appendRow(
      '<div class="alert-row">' +
        '<span class="toggle-dot"></span>' +
        '<span class="alert-text"><span class="alert-highlight">' + escapeHtml(username) + '</span> ПОДПИСАЛСЯ</span>' +
      '</div>'
    );
  }

  applyFields();
  debugLog('виджет чата запущен');
  if (state.fieldData.sevenTVEnabled !== false) {
    var channel = window.widget.channel || {};
    load7TVEmotes(channel.id);
  }

  window.onWidgetEvent = function (type, data) {
    if (!data) return;
    try {
      if (type === 'chatMessage') {
        renderChatMessage(data);
      } else if (type === 'follow') {
        renderFollow((data.user && data.user.name) || 'кто-то');
      } else if (type === 'subscribe') {
        var months = data.months || 1;
        renderEventCard(((data.user && data.user.name) || 'Кто-то').toUpperCase(), months > 1 ? 'RESUB x' + months : 'NEW SUB', data.message || '');
      } else if (type === 'giftSub') {
        renderEventCard(((data.gifter && data.gifter.name) || 'Кто-то').toUpperCase(), 'GIFTED x' + (data.count || 1), '');
      } else if (type === 'cheer') {
        renderEventCard(((data.user && data.user.name) || 'Кто-то').toUpperCase(), 'CHEERED ' + (data.bits || 0), data.message || '');
      } else if (type === 'raid') {
        renderEventCard(((data.from && data.from.name) || 'Кто-то').toUpperCase(), 'RAID x' + (data.viewers || 0), '');
      }
    } catch (e) {
      debugLog('ОШИБКА: ' + (e && e.message));
      console.error('[chat-overlay] не удалось обработать событие, пропускаю:', e, type, data);
    }
  };
})();`,
};
