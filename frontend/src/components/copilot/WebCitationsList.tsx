"use client";

import React from "react";
import { WebCitation } from "@/lib/types";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";
import { ExternalLink, Globe, Calendar, Newspaper } from "lucide-react";

interface WebCitationsListProps {
  citations: WebCitation[];
}

export function WebCitationsList({ citations }: WebCitationsListProps) {
  if (!citations || citations.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-white/10">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-2">
        <Newspaper className="w-3.5 h-3.5 text-sky-500" />
        <span>Market Intelligence &amp; Verified Citations ({citations.length})</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {citations.map((cite, idx) => {
          const hasValidLink = cite.link && cite.link.startsWith("http");

          return (
            <div
              key={idx}
              style={CONTROL_SHADOW_STYLE}
              className="p-2.5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-[#141417] hover:bg-slate-100/80 dark:hover:bg-[#1a1a1e] transition-colors flex flex-col justify-between text-xs"
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span
                    style={CONTROL_SHADOW_STYLE}
                    className="text-[10px] py-0.5 px-2 bg-white dark:bg-[#1c1c1f] text-slate-600 dark:text-zinc-300 border border-slate-200/80 dark:border-transparent rounded-full font-medium truncate max-w-[140px]"
                  >
                    <Globe className="w-2.5 h-2.5 mr-1 text-slate-400 inline" />
                    {cite.source || "News Feed"}
                  </span>

                  {cite.published && (
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 flex items-center gap-0.5 font-mono">
                      <Calendar className="w-2.5 h-2.5" />
                      {cite.published}
                    </span>
                  )}
                </div>

                <div className="font-medium text-slate-900 dark:text-white line-clamp-2 leading-snug">
                  {cite.title}
                </div>

                {cite.summary && (
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                    {cite.summary}
                  </p>
                )}
              </div>

              {hasValidLink && (
                <div className="mt-2 pt-1.5 border-t border-slate-200/60 dark:border-white/10 flex justify-end">
                  <a
                    href={cite.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    <span>Read source</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
