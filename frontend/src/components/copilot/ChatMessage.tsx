"use client";

import React from "react";
import { ChatMessage as ChatMessageType, OrderProposalPayload } from "@/lib/types";
import { WebCitationsList } from "./WebCitationsList";
import { PolicyApprovalCard } from "./PolicyApprovalCard";
import { PolicyRejectionCard } from "./PolicyRejectionCard";
import { Bot, User, Sparkles, TrendingUp, Briefcase, Compass } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
          <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700 border-sky-200 flex items-center gap-1">
            <Compass className="w-2.5 h-2.5" />
            <span>Research Specialist</span>
          </Badge>
        );
      case "portfolio":
        return (
          <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200 flex items-center gap-1">
            <Briefcase className="w-2.5 h-2.5" />
            <span>Portfolio Specialist</span>
          </Badge>
        );
      case "proposer":
        return (
          <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200 flex items-center gap-1">
            <TrendingUp className="w-2.5 h-2.5" />
            <span>Trade Proposer Agent</span>
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600 border-slate-200 flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5" />
            <span>AI Copilot</span>
          </Badge>
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
          <span className="text-[10px] text-slate-400 font-mono">
            {message.timestamp}
          </span>
        </div>

        {/* Bubble */}
        <div
          className={`rounded-2xl px-4 py-3 text-xs leading-relaxed ${
            isUser
              ? "bg-indigo-600 text-white rounded-tr-xs shadow-xs"
              : "bg-white border border-slate-200 text-slate-800 rounded-tl-xs shadow-xs"
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
        <div className="w-7 h-7 rounded-lg bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
          <User className="w-4 h-4" />
        </div>
      )}
    </div>
  );
}
