"use client";

import React from "react";
import { ChatMessage as ChatMessageType, OrderProposalPayload } from "@/lib/types";
import { WebCitationsList } from "./WebCitationsList";
import { PolicyApprovalCard } from "./PolicyApprovalCard";
import { PolicyRejectionCard } from "./PolicyRejectionCard";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";
import { Bot, User, Sparkles, TrendingUp, Briefcase, Compass } from "lucide-react";

interface ChatMessageProps {
  message: ChatMessageType;
  onApproveProposal?: (messageId: string, proposal: OrderProposalPayload) => Promise<void>;
  onRejectProposal?: (messageId: string) => void;
}

export function ChatMessage({
  message,
  onApproveProposal,
  onRejectProposal,
}: ChatMessageProps) {
  const isUser = message.sender === "user";

  const getRoutingBadge = (routed?: string) => {
    switch (routed) {
      case "research":
        return (
          <span
            style={CONTROL_SHADOW_STYLE}
            className="text-[10px] font-mono bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 rounded-full px-2 py-0.5 flex items-center gap-1"
          >
            <Compass className="w-2.5 h-2.5" />
            <span>Research Specialist</span>
          </span>
        );
      case "portfolio":
        return (
          <span
            style={CONTROL_SHADOW_STYLE}
            className="text-[10px] font-mono bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-full px-2 py-0.5 flex items-center gap-1"
          >
            <Briefcase className="w-2.5 h-2.5" />
            <span>Portfolio Specialist</span>
          </span>
        );
      case "proposer":
        return (
          <span
            style={CONTROL_SHADOW_STYLE}
            className="text-[10px] font-mono bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-full px-2 py-0.5 flex items-center gap-1"
          >
            <TrendingUp className="w-2.5 h-2.5" />
            <span>Trade Proposer Agent</span>
          </span>
        );
      default:
        return (
          <span
            style={CONTROL_SHADOW_STYLE}
            className="text-[10px] font-mono bg-slate-50 dark:bg-white/10 text-slate-600 dark:text-zinc-300 border border-slate-200/80 dark:border-white/10 rounded-full px-2 py-0.5 flex items-center gap-1"
          >
            <Sparkles className="w-2.5 h-2.5" />
            <span>AI Copilot</span>
          </span>
        );
    }
  };

  return (
    <div className={`flex gap-3 mb-4 ${isUser ? "justify-end" : "justify-start"}`}>
      {/* Bot Avatar */}
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
          <Bot className="w-4 h-4" />
        </div>
      )}

      {/* Message Box */}
      <div className={`max-w-[85%] md:max-w-[78%] flex flex-col ${isUser ? "items-end" : "items-start"}`}>
        {/* Meta Header */}
        <div className="flex items-center gap-2 mb-1 px-1">
          {!isUser && getRoutingBadge(message.agent_routed)}
          <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
            {message.timestamp}
          </span>
        </div>

        {/* Bubble */}
        <div
          style={isUser ? undefined : CONTROL_SHADOW_STYLE}
          className={`rounded-2xl px-4 py-3 text-xs leading-relaxed ${
            isUser
              ? "bg-slate-900 dark:bg-white text-white dark:text-black rounded-tr-xs shadow-xs"
              : "bg-white dark:bg-[#18181b] border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-zinc-200 rounded-tl-xs shadow-xs"
          }`}
        >
          {/* Main Text content */}
          <div className="whitespace-pre-wrap">{message.text}</div>

          {/* Web Citations */}
          {!isUser && message.citations && message.citations.length > 0 && (
            <WebCitationsList citations={message.citations} />
          )}

          {/* Policy Firewall Rejection Card */}
          {!isUser &&
            message.policy_result &&
            message.policy_result.status === "REJECTED" && (
              <PolicyRejectionCard policyResult={message.policy_result} />
            )}

          {/* Policy Gate Human Approval Card */}
          {!isUser &&
            ((message.policy_result &&
              message.policy_result.status === "NEEDS_APPROVAL" &&
              message.policy_result.order_payload) ||
              message.proposed_order) && (
              <PolicyApprovalCard
                proposal={
                  message.proposed_order ||
                  (message.policy_result?.order_payload as OrderProposalPayload)
                }
                executionResult={message.execution_result}
                onApprove={async (proposal) => {
                  if (onApproveProposal) {
                    await onApproveProposal(message.id, proposal);
                  }
                }}
                onReject={() => {
                  if (onRejectProposal) {
                    onRejectProposal(message.id);
                  }
                }}
              />
            )}
        </div>
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="w-7 h-7 rounded-lg bg-slate-800 dark:bg-zinc-700 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
          <User className="w-4 h-4" />
        </div>
      )}
    </div>
  );
}
