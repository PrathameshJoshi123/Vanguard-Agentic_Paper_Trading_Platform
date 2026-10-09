"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";

interface SlideOverDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClass?: string;
}

export function SlideOverDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  widthClass = "max-w-lg",
}: SlideOverDrawerProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in"
      />

      {/* Docked Right Drawer */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full ${widthClass} bg-white dark:bg-[#1c1c1f] shadow-2xl border-l border-slate-200 dark:border-white/10 flex flex-col animate-in slide-in-from-right duration-200`}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={CONTROL_SHADOW_STYLE}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white border border-slate-200/80 dark:border-transparent bg-white dark:bg-[#18181b]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Canvas */}
        <div className="flex-1 overflow-y-auto p-5 slim-scrollbar">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#18181b]/50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

