"use client";

import { CHANNEL_FIELDS, TWITCH_EVENTS } from "@/lib/twitch-fields";

interface TwitchDataPanelProps {
  disabled: boolean;
  onInsert: (snippet: string) => void;
}

export function TwitchDataPanel({ disabled, onInsert }: TwitchDataPanelProps) {
  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-3 text-sm">
      {disabled && (
        <p className="rounded bg-neutral-800 p-2 text-xs text-neutral-400">
          Переключитесь на вкладку JS, чтобы вставлять сниппеты по клику
        </p>
      )}

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Канал
        </h3>
        <div className="flex flex-col gap-0.5">
          {CHANNEL_FIELDS.map((field) => (
            <button
              key={field.path}
              disabled={disabled}
              title={`Пример: ${String(field.sample)}`}
              onClick={() => onInsert(`window.widget.${field.path}`)}
              className="rounded px-2 py-1 text-left text-neutral-300 transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {field.label}
            </button>
          ))}
        </div>
      </section>

      {TWITCH_EVENTS.map((event) => (
        <section key={event.id}>
          <div className="mb-1 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {event.label}
            </h3>
            <button
              disabled={disabled}
              onClick={() =>
                onInsert(
                  `window.onWidgetEvent = function (type, data) {\n  if (type === '${event.id}') {\n    // ${event.fields
                    .map((f) => `data.${f.path}`)
                    .join(", ")}\n  }\n};\n`
                )
              }
              className="shrink-0 text-xs text-[#9146FF] hover:underline disabled:cursor-not-allowed disabled:opacity-40"
            >
              + обработчик
            </button>
          </div>
          <p className="mb-1 text-xs text-neutral-500">{event.description}</p>
          <div className="flex flex-col gap-0.5">
            {event.fields.map((field) => (
              <button
                key={field.path}
                disabled={disabled}
                title={`Пример: ${String(field.sample)}`}
                onClick={() => onInsert(`data.${field.path}`)}
                className="rounded px-2 py-1 text-left text-neutral-300 transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {field.label}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
