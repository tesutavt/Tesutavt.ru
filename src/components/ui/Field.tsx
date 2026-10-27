import { forwardRef } from "react";

const CONTROL =
  "rounded-control border border-border bg-surface px-3 py-2 text-sm text-surface-foreground placeholder:text-muted outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...rest }, ref) {
    return <input ref={ref} className={`${CONTROL} ${className}`} {...rest} />;
  }
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = "", ...rest }, ref) {
    return <textarea ref={ref} className={`${CONTROL} resize-y ${className}`} {...rest} />;
  }
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = "", children, ...rest }, ref) {
    return (
      <select ref={ref} className={`${CONTROL} cursor-pointer ${className}`} {...rest}>
        {children}
      </select>
    );
  }
);

/** Подпись + поле + подсказка/ошибка. */
export function Field({
  label,
  hint,
  error,
  children,
  className = "",
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-medium text-surface-foreground">{label}</span>
      {children}
      {error ? (
        <span className="text-xs text-danger">{error}</span>
      ) : (
        hint && <span className="text-xs text-muted">{hint}</span>
      )}
    </label>
  );
}

/** Моноширинный блок с кодом/ссылкой. */
export function CodeBlock({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <code
      className={`block min-w-0 overflow-x-auto whitespace-pre rounded-control bg-code px-3 py-2 font-mono text-xs text-code-foreground ${className}`}
    >
      {children}
    </code>
  );
}
