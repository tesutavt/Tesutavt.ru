"use client";

import { X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

interface CodeModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  sidebar?: React.ReactNode;
}

export function CodeModal({ title, onClose, children, sidebar }: CodeModalProps) {
  return (
    <Modal open onClose={onClose} size="xl" bare className="h-[80vh] !bg-code !text-code-foreground">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button
          onClick={onClose}
          aria-label="Закрыть"
          className="rounded-lg p-1.5 text-neutral-400 transition hover:bg-white/10 hover:text-white"
        >
          <X size={18} />
        </button>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden">{children}</div>
        {sidebar && <div className="w-64 shrink-0 overflow-hidden border-l border-white/10">{sidebar}</div>}
      </div>
    </Modal>
  );
}
