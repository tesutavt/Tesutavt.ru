import type { WidgetPreset } from "@/lib/widget-types";

export const alertBoxPreset: WidgetPreset = {
  id: "alert-box",
  name: "Alert Box",
  description: "Всплывающее уведомление о фолловах, подписках, битах и рейдах",
  width: 500,
  height: 220,
  fieldsSchema: [
    { key: "accentColor", label: "Акцентный цвет", type: "color", default: "#9146FF" },
    { key: "textColor", label: "Цвет текста", type: "color", default: "#ffffff" },
    { key: "fontSize", label: "Размер шрифта (px)", type: "number", default: 28 },
    { key: "displayDuration", label: "Длительность показа (сек)", type: "number", default: 5 },
  ],
  html: `<div id="alert-box" class="alert-box">
  <img id="alert-avatar" class="alert-avatar" />
  <div class="alert-text">
    <div id="alert-title" class="alert-title"></div>
    <div id="alert-message" class="alert-message"></div>
  </div>
</div>`,
  css: `body { margin: 0; overflow: hidden; font-family: sans-serif; }
.alert-box {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
  border-radius: 12px;
  background: var(--accent-color, #9146FF);
  color: var(--text-color, #fff);
  font-size: var(--font-size, 28px);
  transform: translateY(120%);
  opacity: 0;
  transition: transform 0.4s ease, opacity 0.4s ease;
}
.alert-box.show { transform: translateY(0); opacity: 1; }
.alert-avatar { width: 64px; height: 64px; border-radius: 50%; display: none; }
.alert-title { font-weight: bold; }
.alert-message { font-size: 0.7em; opacity: 0.9; }`,
  js: `const box = document.getElementById('alert-box');
const avatar = document.getElementById('alert-avatar');
const title = document.getElementById('alert-title');
const message = document.getElementById('alert-message');

function applyFields() {
  const fields = window.widget.fields;
  document.documentElement.style.setProperty('--accent-color', fields.accentColor);
  document.documentElement.style.setProperty('--text-color', fields.textColor);
  document.documentElement.style.setProperty('--font-size', fields.fontSize + 'px');
}
applyFields();

let hideTimeout;
function showAlert(titleText, messageText, avatarUrl) {
  clearTimeout(hideTimeout);
  title.textContent = titleText;
  message.textContent = messageText || '';
  if (avatarUrl) {
    avatar.src = avatarUrl;
    avatar.style.display = 'block';
  } else {
    avatar.style.display = 'none';
  }
  box.classList.add('show');
  const duration = (window.widget.fields.displayDuration || 5) * 1000;
  hideTimeout = setTimeout(() => box.classList.remove('show'), duration);
}

window.onWidgetEvent = function (type, data) {
  if (type === 'follow') {
    showAlert('Новый фолловер!', data.user.name, data.user.avatar);
  } else if (type === 'subscribe') {
    showAlert('Новая подписка!', data.user.name);
  } else if (type === 'giftSub') {
    showAlert('Подарочные подписки!', data.gifter.name + ' x' + data.count);
  } else if (type === 'cheer') {
    showAlert(data.bits + ' бит!', data.user.name + (data.message ? ': ' + data.message : ''));
  } else if (type === 'raid') {
    showAlert('Рейд!', data.from.name + ' × ' + data.viewers);
  }
};`,
};
