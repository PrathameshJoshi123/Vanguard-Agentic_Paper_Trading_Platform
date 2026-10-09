"use client";

import React, { forwardRef } from "react";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";
import { cn } from "@/lib/utils";

// Primary CTA Button
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const NorthstarPrimaryButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, style, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        style={style}
        className={cn(
          "rounded-full h-8 px-5 text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 shadow-sm cursor-pointer transition-colors duration-150 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none select-none",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
NorthstarPrimaryButton.displayName = "NorthstarPrimaryButton";

// Secondary CTA Button
export const NorthstarSecondaryButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, style, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        style={{ ...CONTROL_SHADOW_STYLE, ...style }}
        className={cn(
          "rounded-full h-8 px-4 text-xs font-medium bg-white dark:bg-[#1c1c1f] text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-transparent cursor-pointer transition-colors duration-150 flex items-center justify-center gap-1.5 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 disabled:pointer-events-none select-none",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
NorthstarSecondaryButton.displayName = "NorthstarSecondaryButton";

// Input
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const NorthstarInput = forwardRef<HTMLInputElement, InputProps>(
  ({ className, style, ...props }, ref) => {
    return (
      <input
        ref={ref}
        style={{ ...CONTROL_SHADOW_STYLE, ...style }}
        className={cn(
          "w-full rounded-xl bg-slate-50 dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-white/10 px-3.5 py-2 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-slate-400 dark:focus:ring-white/20 transition-all",
          className
        )}
        {...props}
      />
    );
  }
);
NorthstarInput.displayName = "NorthstarInput";

// Textarea
export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const NorthstarTextarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, style, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        style={{ ...CONTROL_SHADOW_STYLE, ...style }}
        className={cn(
          "w-full rounded-xl bg-slate-50 dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-white/10 px-3.5 py-2 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-slate-400 dark:focus:ring-white/20 transition-all resize-none",
          className
        )}
        {...props}
      />
    );
  }
);
NorthstarTextarea.displayName = "NorthstarTextarea";
