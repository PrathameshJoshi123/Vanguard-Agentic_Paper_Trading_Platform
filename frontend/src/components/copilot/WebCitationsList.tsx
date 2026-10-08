"use client";

import React from "react";
import { WebCitation } from "@/lib/types";
import { ExternalLink, Globe, Calendar, Newspaper } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface WebCitationsListProps {
  citations: WebCitation[];
}

export function WebCitationsList({ citations }: WebCitationsListProps) {
  if (!citations || citations.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-slate-200/80">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2">
        <Newspaper className="w-3.5 h-3.5 text-sky-600" />
        <span>Market Intelligence &amp; Verified Citations ({citations.length})</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {citations.map((cite, idx) => {
          const hasValidLink = cite.link && cite.link.startsWith("http");

          return (
            <div
              key={idx}
              className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-100/80 transition-colors flex flex-col justify-between text-xs"
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <Badge
                    variant="outline"
                    className="text-[10px] py-0 px-1.5 bg-white text-slate-600 border-slate-300 font-medium truncate max-w-[140px]"
                  >
                    <Globe className="w-2.5 h-2.5 mr-1 text-slate-400 inline" />
                    {cite.source || "News Feed"}
                  </Badge>

                  {cite.published && (
                    <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                      <Calendar className="w-2.5 h-2.5" />
                      {cite.published}
                    </span>
                  )}
                </div>

                <div className="font-medium text-slate-900 line-clamp-2 leading-snug">
                  {cite.title}
                </div>

                {cite.summary && (
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {cite.summary}
                  </p>
                )}
              </div>

              {hasValidLink && (
                <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex justify-end">
                  <a
                    href={cite.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 hover:text-sky-800 hover:underline"
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
