"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { TAccountsOverview, ContractNoteSummary } from "@/lib/types";
import { useTheme } from "@/components/providers/ThemeProvider";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";
import { Scale, ReceiptText } from "lucide-react";

interface TAccountsRechartsProps {
  tAccounts: TAccountsOverview | null;
  contractNotes: ContractNoteSummary | null;
}

const LEVY_COLORS = ["#6366f1", "#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6"];

export function TAccountsRecharts({
  tAccounts,
  contractNotes,
}: TAccountsRechartsProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Build double-entry debits vs credits data
  const accountsData =
    tAccounts?.accounts?.map((acc) => ({
      category: acc.category.replace(/_/g, " ").slice(0, 14),
      Debits: Number(acc.total_debits),
      Credits: Number(acc.total_credits),
    })) || [
      { category: "CASH BANK", Debits: 1000000, Credits: 25000 },
      { category: "CLIENT LEDGER", Debits: 25000, Credits: 1000000 },
      { category: "EXCHANGE CLR", Debits: 24950, Credits: 24950 },
      { category: "REVENUE", Debits: 0, Credits: 50 },
    ];

  // Statutory levies distribution
  const taxData = contractNotes
    ? [
        { name: "Brokerage", value: Number(contractNotes.total_brokerage) || 20 },
        { name: "STT", value: Number(contractNotes.total_stt) || 25 },
        { name: "Turnover", value: Number(contractNotes.total_exchange_turnover) || 7.4 },
        { name: "SEBI", value: Number(contractNotes.total_sebi_fees) || 0.25 },
        { name: "Stamp Duty", value: Number(contractNotes.total_stamp_duty) || 3.75 },
        { name: "GST (18%)", value: Number(contractNotes.total_gst) || 4.9 },
      ]
    : [
        { name: "Brokerage", value: 20 },
        { name: "STT", value: 25 },
        { name: "Turnover", value: 7.4 },
        { name: "SEBI", value: 0.25 },
        { name: "Stamp Duty", value: 3.75 },
        { name: "GST (18%)", value: 4.9 },
      ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* 1. Double-Entry Debits vs Credits Bar Chart (7 cols) */}
      <div className="lg:col-span-7 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#18181b] p-4 shadow-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/10 mb-3">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-emerald-500" />
            <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200">
              Double-Entry T-Accounts (Debits vs Credits)
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Debits (Dr.)
            </span>
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Credits (Cr.)
            </span>
          </div>
        </div>

        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={accountsData}
              margin={{ top: 8, right: 10, left: -10, bottom: 0 }}
            >
              <XAxis
                dataKey="category"
                stroke={isDark ? "#71717a" : "#94a3b8"}
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: isDark ? "#27272a" : "#e2e8f0" }}
              />
              <YAxis
                stroke={isDark ? "#71717a" : "#94a3b8"}
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: isDark ? "#27272a" : "#e2e8f0" }}
                tickFormatter={(v) => (v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`)}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload;
                  return (
                    <div
                      style={CONTROL_SHADOW_STYLE}
                      className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-[#18181b]/95 p-2 text-xs font-mono backdrop-blur-xs"
                    >
                      <div className="font-bold text-slate-900 dark:text-white">
                        {item.category}
                      </div>
                      <div className="text-blue-600 dark:text-blue-400">
                        Dr: ₹{item.Debits?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-emerald-600 dark:text-emerald-400">
                        Cr: ₹{item.Credits?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="Debits" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Credits" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Statutory Levies Breakdown Pie Chart (5 cols) */}
      <div className="lg:col-span-5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#18181b] p-4 shadow-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/10 mb-3">
          <div className="flex items-center gap-2">
            <ReceiptText className="w-4 h-4 text-indigo-500" />
            <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200">
              Statutory Levies Distribution
            </h3>
          </div>
          <span
            style={CONTROL_SHADOW_STYLE}
            className="rounded-full px-2 py-0.5 text-[10px] font-mono font-medium bg-slate-50 dark:bg-[#1c1c1f] text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-white/10"
          >
            SEBI &amp; Tax
          </span>
        </div>

        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={taxData}
                cx="50%"
                cy="50%"
                innerRadius={38}
                outerRadius={65}
                paddingAngle={3}
                dataKey="value"
              >
                {taxData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={LEVY_COLORS[index % LEVY_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload;
                  return (
                    <div
                      style={CONTROL_SHADOW_STYLE}
                      className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-[#18181b]/95 p-2 text-xs font-mono backdrop-blur-xs"
                    >
                      <span className="font-bold text-slate-900 dark:text-white">
                        {item.name}:
                      </span>{" "}
                      ₹{item.value?.toFixed(2)}
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-slate-100 dark:border-white/10 text-[10px] font-mono">
          {taxData.map((item, idx) => (
            <div key={item.name} className="flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: LEVY_COLORS[idx % LEVY_COLORS.length] }}
              />
              <span className="text-slate-600 dark:text-zinc-400">{item.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

