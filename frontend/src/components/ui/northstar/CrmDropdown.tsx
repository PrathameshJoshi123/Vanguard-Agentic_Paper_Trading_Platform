"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";

export interface DropdownOption {
  value: string;
  label: string;
  dotColor?: string;
}

interface CrmDropdownProps {
  prefix?: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  statusDot?: string;
  className?: string;
}

export function CrmDropdown({
  prefix,
  value,
  options,
  onChange,
  statusDot,
  className = "",
}: CrmDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Pill Button Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={CONTROL_SHADOW_STYLE}
        className="h-8 px-3.5 rounded-full border border-slate-200/80 dark:border-transparent bg-white dark:bg-[#1c1c1f] text-slate-700 dark:text-zinc-300 text-xs font-medium cursor-pointer inline-flex items-center gap-1.5 transition-all select-none hover:bg-slate-50 dark:hover:bg-[#232327]"
      >
        {/* Optional colored status dot */}
        {(statusDot || selectedOption?.dotColor) && (
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              statusDot || selectedOption?.dotColor || "bg-emerald-500"
            }`}
          />
        )}

        {/* Muted Prefix Label */}
        {prefix && (
          <span className="text-slate-400 dark:text-zinc-500 font-normal">
            {prefix}
          </span>
        )}

        {/* Main Label */}
        <span className="text-slate-900 dark:text-white font-medium">
          {selectedOption ? selectedOption.label : value}
        </span>

        {/* Chevron with 180deg rotation */}
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 dark:text-zinc-400 transition-transform duration-200 shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Menu Panel */}
      {isOpen && (
        <div className="absolute left-0 mt-1 min-w-[150px] rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18181b] p-1.5 shadow-xl z-50 animate-in fade-in-0 zoom-in-95">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`rounded-lg px-2.5 py-1.5 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white font-medium"
                    : "text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  {opt.dotColor && (
                    <span className={`w-2 h-2 rounded-full shrink-0 ${opt.dotColor}`} />
                  )}
                  <span>{opt.label}</span>
                </div>
                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 ml-2" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

