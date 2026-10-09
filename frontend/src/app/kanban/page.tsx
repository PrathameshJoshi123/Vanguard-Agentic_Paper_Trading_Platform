"use client";

import React, { useState } from "react";
import {
  KanbanBoard,
  KanbanStage,
  KanbanDealCard,
} from "@/components/ui/northstar/KanbanBoard";
import { CrmDropdown } from "@/components/ui/northstar/CrmDropdown";
import { SlideOverDrawer } from "@/components/ui/northstar/SlideOverDrawer";
import {
  NorthstarPrimaryButton,
  NorthstarSecondaryButton,
  NorthstarInput,
  NorthstarTextarea,
} from "@/components/ui/northstar/NorthstarControls";
import { MetricCard } from "@/components/ui/northstar/MetricCard";
import {
  Kanban as KanbanIcon,
  Plus,
  Filter,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";

const INITIAL_STAGES: KanbanStage[] = [
  {
    id: "lead_in",
    title: "Inbound Flow",
    color: "#00B2FF",
    tintColor: "#00B2FF33",
    cards: [
      {
        id: "d1",
        leadName: "Arjun Singhania",
        jobTitle: "VP Algo Trading, QuantEdge",
        relativeDate: "2h ago",
        dealSize: "₹1,25,00,000",
        temperature: "hot",
        avatars: ["AS", "RK", "VT"],
        slaFollowUp: {
          time: "15m",
          channel: "Meet",
        },
      },
      {
        id: "d2",
        leadName: "Meera Kulkarni",
        jobTitle: "Head of Derivatives, Apex Capital",
        relativeDate: "5h ago",
        dealSize: "₹45,00,000",
        temperature: "warm",
        avatars: ["MK", "PD"],
        slaFollowUp: {
          time: "45m",
          channel: "WhatsApp",
        },
      },
    ],
  },
  {
    id: "risk_check",
    title: "Risk Clearance",
    color: "#FF00DD",
    tintColor: "#FF00DD33",
    cards: [
      {
        id: "d3",
        leadName: "Vikramaditya Roy",
        jobTitle: "Managing Director, Indus Alpha",
        relativeDate: "1d ago",
        dealSize: "₹3,50,00,000",
        temperature: "hot",
        avatars: ["VR", "SS"],
        slaFollowUp: {
          time: "2h",
          channel: "Phone",
        },
      },
      {
        id: "d4",
        leadName: "Tanvi Deshmukh",
        jobTitle: "Portfolio Manager, Zenith PMS",
        relativeDate: "2d ago",
        dealSize: "₹80,00,000",
        temperature: "cold",
        avatars: ["TD", "AK", "NM"],
        slaFollowUp: {
          time: "Tomorrow",
          channel: "Mail",
        },
      },
    ],
  },
  {
    id: "order_routing",
    title: "Execution Routing",
    color: "#22C55E",
    tintColor: "#22C55E33",
    cards: [
      {
        id: "d5",
        leadName: "Rohan Varma",
        jobTitle: "Chief Investment Officer, Trident HFT",
        relativeDate: "3h ago",
        dealSize: "₹6,80,00,000",
        temperature: "hot",
        avatars: ["RV", "PK", "JD"],
        slaFollowUp: {
          time: "Immediate",
          channel: "Phone",
        },
      },
      {
        id: "d6",
        leadName: "Sunita Nambiar",
        jobTitle: "Treasury Lead, Bharat Global",
        relativeDate: "6h ago",
        dealSize: "₹95,00,000",
        temperature: "warm",
        avatars: ["SN", "MS"],
        slaFollowUp: {
          time: "3h",
          channel: "WhatsApp",
        },
      },
    ],
  },
  {
    id: "settled",
    title: "Clearing & Settled",
    color: "#555555",
    tintColor: "#55555533",
    cards: [
      {
        id: "d7",
        leadName: "Kavita Rao",
        jobTitle: "Head Trader, Bluechip Equities",
        relativeDate: "Yesterday",
        dealSize: "₹2,10,00,000",
        temperature: "warm",
        avatars: ["KR", "DR"],
        slaFollowUp: {
          time: "Completed",
          channel: "Mail",
        },
      },
    ],
  },
];

export default function KanbanPage() {
  const [stages, setStages] = useState<KanbanStage[]>(INITIAL_STAGES);
  const [selectedCard, setSelectedCard] = useState<KanbanDealCard | null>(null);
  const [selectedStage, setSelectedStage] = useState<KanbanStage | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [filterSetter, setFilterSetter] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const totalPipeline = "₹15,05,00,000";
  const totalDeals = stages.reduce((acc, s) => acc + s.cards.length, 0);

  const handleCardClick = (card: KanbanDealCard, stage: KanbanStage) => {
    setSelectedCard(card);
    setSelectedStage(stage);
    setIsDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black flex items-center justify-center shadow-xs">
            <KanbanIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Deal &amp; Institutional Order Pipeline
              </h1>
              <span className="rounded-full px-2 py-0.5 text-[11px] font-medium border bg-slate-100 dark:bg-[#1e1e22] dark:border-white/5 text-slate-700 dark:text-zinc-300 font-mono">
                Linear Style
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              High-density tactile Kanban rails with temperature indicators and SLA follow-up routing
            </p>
          </div>
        </div>

        {/* Toolbar Controls with CrmDropdown */}
        <div className="flex flex-wrap items-center gap-2.5">
          <CrmDropdown
            prefix="Setter:"
            value={filterSetter}
            options={[
              { value: "all", label: "All Setters" },
              { value: "arjun", label: "Arjun S." },
              { value: "priya", label: "Priya K." },
              { value: "rohit", label: "Rohit V." },
            ]}
            onChange={setFilterSetter}
          />

          <CrmDropdown
            prefix="Status:"
            value={filterStatus}
            options={[
              { value: "all", label: "All Deals", dotColor: "#38bdf8" },
              { value: "hot", label: "Hot Leads Only", dotColor: "#f43f5e" },
              { value: "sla", label: "SLA Due Today", dotColor: "#eab308" },
            ]}
            onChange={setFilterStatus}
          />

          <NorthstarPrimaryButton
            onClick={() => {
              setSelectedCard(stages[0].cards[0]);
              setSelectedStage(stages[0]);
              setIsDrawerOpen(true);
            }}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            <span>New Order Leg</span>
          </NorthstarPrimaryButton>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Deal Value"
          value={totalPipeline}
          badge="INR"
          hint="Aggregated pipeline volume across rails"
          trend={{ value: "+18.4% WoW", isPositive: true }}
        />
        <MetricCard
          title="Resting Deals"
          value={totalDeals}
          badge="DEALS"
          hint="4 stages actively moving"
        />
        <MetricCard
          title="Hot Conversion SLA"
          value="18.2m"
          badge="SLA"
          hint="Median time to order fill clearance"
        />
        <MetricCard
          title="Double-Entry Sync"
          value="100.0%"
          badge="AUDIT"
          hint="PAISE zero-variance compliance"
        />
      </div>

      {/* Kanban Rail Container */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 px-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-zinc-300">
              Interactive Stage Rails
            </span>
            <span>• Click any deal card to inspect SLA parameters</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span> Hot
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span> Warm
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-sky-400"></span> Cold
            </span>
          </div>
        </div>

        <KanbanBoard
          stages={stages}
          onCardClick={handleCardClick}
          className="bg-transparent"
        />
      </div>

      {/* Slide-over Detail Drawer (Blueprint G) */}
      <SlideOverDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={selectedCard?.leadName || "Institutional Deal"}
        subtitle={selectedCard?.jobTitle}
        footer={
          <>
            <NorthstarSecondaryButton onClick={() => setIsDrawerOpen(false)}>
              Dismiss
            </NorthstarSecondaryButton>
            <NorthstarPrimaryButton
              onClick={() => {
                setIsDrawerOpen(false);
              }}
            >
              Confirm Routing
            </NorthstarPrimaryButton>
          </>
        }
      >
        {selectedCard && (
          <div className="space-y-5 text-xs text-slate-700 dark:text-zinc-300">
            {/* Quick summary stats */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-white/10">
              <div>
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-semibold">
                  Deal Size
                </span>
                <div className="font-mono font-bold text-base text-slate-900 dark:text-white mt-0.5">
                  {selectedCard.dealSize}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-semibold">
                  SLA Channel
                </span>
                <div className="font-semibold text-slate-900 dark:text-white mt-0.5 flex items-center gap-1.5">
                  <span>{selectedCard.slaFollowUp.channel}</span>
                  <span className="text-slate-400">({selectedCard.slaFollowUp.time})</span>
                </div>
              </div>
            </div>

            {/* Stage Selector using CrmDropdown */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                Pipeline Stage
              </label>
              <CrmDropdown
                prefix="Stage:"
                value={selectedStage?.id || "lead_in"}
                options={stages.map((s) => ({
                  value: s.id,
                  label: s.title,
                  dotColor: s.color,
                }))}
                onChange={(val) => {
                  const target = stages.find((s) => s.id === val);
                  if (target) setSelectedStage(target);
                }}
              />
            </div>

            {/* Input fields with CONTROL_SHADOW_STYLE */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                Counterparty Entity
              </label>
              <NorthstarInput defaultValue={selectedCard.leadName} />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                Allocated Trading Desk
              </label>
              <NorthstarInput defaultValue={selectedCard.jobTitle} />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                Execution Notes &amp; Routing Mandate
              </label>
              <NorthstarTextarea
                rows={4}
                defaultValue={`Authorized institutional block order for ${selectedCard.dealSize}. Route across NSE tick streams with strict PA/SE settlement compliance.`}
              />
            </div>
          </div>
        )}
      </SlideOverDrawer>
    </div>
  );
}
