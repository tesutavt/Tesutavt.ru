import type { WidgetPreset } from "@/lib/widget-types";

export const clockPreset: WidgetPreset = {
  id: "clock",
  name: "Часы",
  description: "Простой текстовый виджет с текущим временем",
  width: 300,
  height: 100,
  fieldsSchema: [
    { key: "textColor", label: "Цвет текста", type: "color", default: "#ffffff" },
    { key: "fontSize", label: "Размер шрифта (px)", type: "number", default: 48 },
    { key: "format24h", label: "24-часовой формат", type: "boolean", default: true },
  ],
  html: `<div id="clock"></div>`,
  css: `body { margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: monospace; }
#clock { color: var(--text-color, #fff); font-size: var(--font-size, 48px); }`,
  js: `function applyFields() {
  const fields = window.widget.fields;
  document.documentElement.style.setProperty('--text-color', fields.textColor);
  document.documentElement.style.setProperty('--font-size', fields.fontSize + 'px');
}
applyFields();

function tick() {
  const now = new Date();
  const fields = window.widget.fields;
  document.getElementById('clock').textContent = now.toLocaleTimeString(undefined, {
    hour12: !fields.format24h,
  });
}
tick();
setInterval(tick, 1000);`,
};
