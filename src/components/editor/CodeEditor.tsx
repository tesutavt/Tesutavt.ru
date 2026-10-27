"use client";

import { forwardRef } from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";

const LANG_EXTENSIONS = {
  html: [html()],
  css: [css()],
  js: [javascript()],
};

interface CodeEditorProps {
  language: "html" | "css" | "js";
  value: string;
  onChange: (value: string) => void;
}

export const CodeEditor = forwardRef<ReactCodeMirrorRef, CodeEditorProps>(
  function CodeEditor({ language, value, onChange }, ref) {
    return (
      <CodeMirror
        ref={ref}
        value={value}
        height="100%"
        theme="dark"
        extensions={LANG_EXTENSIONS[language]}
        onChange={onChange}
        className="h-full text-sm [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-auto"
      />
    );
  }
);
