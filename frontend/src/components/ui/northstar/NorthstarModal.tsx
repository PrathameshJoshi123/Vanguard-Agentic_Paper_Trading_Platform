"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { MODAL_SHADOW_STYLE, CONTROL_SHADOW_STYLE } from "@/lib/design-system";

interface NorthstarModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClass?: string;
}

export function NorthstarModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidthClass = "max-w-lg",
}: NorthstarModalProps) {
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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-0 duration-150">
      <div
        style={MODAL_SHADOW_STYLE}
        className={`rounded-2xl ${maxWidthClass} w-full overflow-hidden border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#171717] text-slate-900 dark:text-white flex flex-col max-h-[90vh]`}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {title}
            </h3>
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
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-white border border-slate-200/80 dark:border-transparent bg-white dark:bg-[#1e1e22]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto slim-scrollbar flex-1">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-4 border-t border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-[#141416] flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// Reusable Northstar Form Controls
export function NorthstarInput({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      style={CONTROL_SHADOW_STYLE}
      className={`rounded-xl bg-slate-50 dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-white/10 px-3.5 py-2 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 outline-none transition-all focus:border-slate-400 dark:focus:border-white/30 w-full ${className}`}
      {...props}
    />
  );
}

export function NorthstarPrimaryButton({
  children,
  className = "",
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`rounded-full h-8 px-5 text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function NorthstarSecondaryButton({
  children,
  className = "",
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      disabled={disabled}
      style={CONTROL_SHADOW_STYLE}
      className={`rounded-full h-8 px-4 text-xs font-medium bg-white dark:bg-[#1c1c1f] text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-transparent hover:bg-slate-50 dark:hover:bg-[#232327] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

