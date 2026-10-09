"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChatMessage as ChatMessageType, OrderProposalPayload } from "@/lib/types";
import { ChatMessage } from "./ChatMessage";
import { api } from "@/lib/api";
import { useTradingStore } from "@/store/useTradingStore";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";
import {
  NorthstarInput,
  NorthstarPrimaryButton,
} from "@/components/ui/northstar/NorthstarModal";
import {
  Send,
  Loader2,
  Trash2,
  Sparkles,
  Bot,
  Compass,
  Briefcase,
  TrendingUp,
  Shield,
} from "lucide-react";

const INITIAL_MESSAGES: ChatMessageType[] = [
  {
    id: "welcome-1",
    sender: "copilot",
    text: "Welcome to the Institutional AI Copilot & Intelligence Suite.\n\nI am connected to the live market feed and double-entry accounting ledger via decoupled read-only tools and a strict Policy Firewall.\n\nHow can I assist your trading research today?",
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    agent_routed: "supervisor",
  },
];

const QUICK_PROMPTS = [
  {
    label: "Research RELIANCE News & Catalysts",
    prompt: "Research RELIANCE share price and latest news catalysts",
    icon: Compass,
    agent: "research",
  },
  {
    label: "Portfolio Risk & Loss Attribution",
    prompt: "Why did my portfolio lose money today and what are the top losers?",
    icon: Briefcase,
    agent: "portfolio",
  },
  {
    label: "Propose Compliant Order (10 TCS)",
    prompt: "Propose buying 10 shares of TCS at limit price 3500 CNC",
    icon: TrendingUp,
    agent: "proposer",
  },
  {
    label: "Test Safety Firewall (Over-limit Order)",
    prompt: "Buy 1,000,000 shares of Reliance",
    icon: Shield,
    agent: "firewall",
  },
];

export function CopilotChat() {
  const accountId = useTradingStore((s) => s.accountId);
  const [messages, setMessages] = useState<ChatMessageType[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new message
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  const handleSendPrompt = async (promptToSend?: string) => {
    const text = (promptToSend || inputText).trim();
    if (!text || isThinking) return;

    const userMsg: ChatMessageType = {
      id: `user-${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!promptToSend) setInputText("");
    setIsThinking(true);

    try {
      const response = await api.copilotChat(text, accountId);

      const copilotMsg: ChatMessageType = {
        id: `copilot-${Date.now()}`,
        sender: "copilot",
        text: response.response,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        agent_routed: response.agent_routed,
        citations: response.citations || [],
        policy_result: response.policy_result,
        proposed_order: response.proposed_order,
      };

      setMessages((prev) => [...prev, copilotMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessageType = {
        id: `error-${Date.now()}`,
        sender: "copilot",
        text: `Error processing request: ${err.message || "Failed to contact Intelligence Plane."}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        agent_routed: "supervisor",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleApproveProposal = async (
    messageId: string,
    proposal: OrderProposalPayload
  ) => {
    try {
      const result = await api.executeProposedOrder({
        account_id: proposal.account_id || accountId,
        symbol: proposal.symbol,
        side: proposal.side,
        quantity: proposal.quantity,
        price: proposal.price,
        order_type: proposal.order_type,
        product_type: proposal.product_type,
      });

      // Update message with execution result
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, execution_result: result } : msg
        )
      );

      // Refresh orders in background store
      try {
        const freshOrders = await api.getOrders(accountId);
        useTradingStore.getState().setOrders(freshOrders);
      } catch {
        // non-blocking
      }
    } catch (err: any) {
      alert(`Order execution failed: ${err.message}`);
    }
  };

  const handleRejectProposal = (messageId: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              policy_result: {
                status: "REJECTED",
                reason: "User dismissed trade proposal at approval gate.",
              },
            }
          : msg
      )
    );
  };

  const handleClearChat = () => {
    setMessages(INITIAL_MESSAGES);
  };

  return (
    <div className="flex flex-col h-[760px] bg-white dark:bg-[#18181b] border border-slate-200/80 dark:border-white/10 rounded-xl shadow-xs overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/60 dark:bg-[#141417] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Conversational Market Intelligence &amp; Copilot</span>
              <span
                style={CONTROL_SHADOW_STYLE}
                className="text-[10px] font-mono bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-full px-2 py-0.5"
              >
                LangGraph Supervisor
              </span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-zinc-400">
              Read-Only Financial Gateways • Web Citations • Policy Firewall Protection
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleClearChat}
          style={CONTROL_SHADOW_STYLE}
          className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-600 dark:text-zinc-400 dark:hover:text-white border border-slate-200/80 dark:border-transparent bg-white dark:bg-[#1c1c1f] flex items-center justify-center cursor-pointer transition-all"
          title="Clear Conversation"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Quick Prompts Bar */}
      <div className="px-4 py-2 border-b border-slate-100 dark:border-white/5 bg-slate-50/40 dark:bg-[#121215] flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span className="text-[11px] font-medium text-slate-400 dark:text-zinc-500 shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-indigo-500" />
          Quick Actions:
        </span>
        {QUICK_PROMPTS.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendPrompt(item.prompt)}
              disabled={isThinking}
              style={CONTROL_SHADOW_STYLE}
              className="px-3 py-1 rounded-full text-[11px] font-medium bg-white dark:bg-[#1c1c1f] hover:bg-slate-50 dark:hover:bg-[#25252a] text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-transparent whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Icon className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Chat Messages Stream */}
      <div
        ref={chatScrollRef}
        className="flex-1 p-5 overflow-y-auto space-y-2 bg-gradient-to-b from-white to-slate-50/30 dark:from-[#18181b] dark:to-[#121215] slim-scrollbar"
      >
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            onApproveProposal={handleApproveProposal}
            onRejectProposal={handleRejectProposal}
          />
        ))}

        {isThinking && (
          <div className="flex gap-3 mb-4 justify-start">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5 animate-pulse">
              <Bot className="w-4 h-4" />
            </div>
            <div
              style={CONTROL_SHADOW_STYLE}
              className="bg-white dark:bg-[#1c1c1f] border border-slate-200/80 dark:border-white/10 rounded-2xl rounded-tl-xs px-4 py-3 text-xs text-slate-500 dark:text-zinc-400 shadow-xs flex items-center gap-2"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              <span>Analyzing market data &amp; verifying policy gate...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <div className="p-4 border-t border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#18181b]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendPrompt();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isThinking}
            placeholder="Ask AI Copilot (e.g. 'Research RELIANCE news', 'Why did portfolio lose today?', 'Buy 20 shares of TCS')..."
            style={CONTROL_SHADOW_STYLE}
            className="flex-1 px-4 py-2 text-xs bg-slate-50 dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-white/10 rounded-xl outline-none focus:border-indigo-500 transition-all text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 disabled:opacity-50"
          />

          <NorthstarPrimaryButton
            type="submit"
            disabled={!inputText.trim() || isThinking}
            className="!h-9 px-4 !bg-indigo-600 hover:!bg-indigo-700 text-white"
          >
            {isThinking ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <span>Send</span>
                <Send className="w-3.5 h-3.5 ml-1" />
              </>
            )}
          </NorthstarPrimaryButton>
        </form>
      </div>
    </div>
  );
}
