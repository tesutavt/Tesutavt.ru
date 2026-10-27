import type { WidgetPreset } from "@/lib/widget-types";

export const followerGoalPreset: WidgetPreset = {
  id: "follower-goal",
  name: "Follower Goal",
  description: "Прогресс-бар цели по фолловерам канала",
  width: 500,
  height: 120,
  fieldsSchema: [
    { key: "goalText", label: "Текст цели", type: "text", default: "Follower Goal" },
    { key: "goalTarget", label: "Целевое число фолловеров", type: "number", default: 1000 },
    { key: "barColor", label: "Цвет прогресса", type: "color", default: "#9146FF" },
    { key: "bgColor", label: "Цвет фона бара", type: "color", default: "#2a2a2a" },
  ],
  html: `<div class="goal">
  <div class="goal-label">
    <span id="goal-text"></span>
    <span id="goal-progress"></span>
  </div>
  <div class="goal-bar-bg">
    <div id="goal-bar-fill" class="goal-bar-fill"></div>
  </div>
</div>`,
  css: `body { margin: 0; font-family: sans-serif; color: #fff; display: flex; align-items: center; height: 100vh; }
.goal { width: 100%; padding: 0 24px; }
.goal-label { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 18px; }
.goal-bar-bg { width: 100%; height: 24px; border-radius: 12px; background: var(--bg-color, #2a2a2a); overflow: hidden; }
.goal-bar-fill { height: 100%; width: 0%; background: var(--bar-color, #9146FF); transition: width 0.6s ease; }`,
  js: `function render() {
  const fields = window.widget.fields;
  const channel = window.widget.channel || {};
  document.documentElement.style.setProperty('--bar-color', fields.barColor);
  document.documentElement.style.setProperty('--bg-color', fields.bgColor);

  const current = channel.followerCount || 0;
  const target = fields.goalTarget || 1;
  const percent = Math.min(100, Math.round((current / target) * 100));

  document.getElementById('goal-text').textContent = fields.goalText;
  document.getElementById('goal-progress').textContent = current + ' / ' + target;
  document.getElementById('goal-bar-fill').style.width = percent + '%';
}
render();
window.onChannelUpdate = render;`,
};
