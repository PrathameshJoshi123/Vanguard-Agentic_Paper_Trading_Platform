"use client";

import React, { useState } from "react";
import { CustomerCashEntry } from "@/lib/types";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";
import {
  DataTableToolbar,
  DataTableContainer,
  DataTableHead,
  DataTableRow,
  FilterPill,
} from "@/components/ui/northstar/DataTable";
import { BookOpen } from "lucide-react";

interface CashJournalTableProps {
  entries: CustomerCashEntry[];
}

export function CashJournalTable({ entries }: CashJournalTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"ALL" | "DEBIT" | "CREDIT">("ALL");

  const filteredEntries = entries.filter((entry) => {
    if (
      searchQuery &&
      !entry.category.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !entry.reference_id.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !entry.description.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    if (activeFilter === "DEBIT" && Number(entry.debit) <= 0) return false;
    if (activeFilter === "CREDIT" && Number(entry.credit) <= 0) return false;
    return true;
  });

  const filterPills: FilterPill[] = [
    { id: "ALL", label: "All Entries", active: activeFilter === "ALL", count: entries.length },
    {
      id: "CREDIT",
      label: "Credits (+)",
      active: activeFilter === "CREDIT",
      count: entries.filter((e) => Number(e.credit) > 0).length,
    },
    {
      id: "DEBIT",
      label: "Debits (-)",
      active: activeFilter === "DEBIT",
      count: entries.filter((e) => Number(e.debit) > 0).length,
    },
  ];

  if (entries.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 dark:text-zinc-500 text-sm">
        <BookOpen className="w-8 h-8 mx-auto text-slate-300 dark:text-zinc-600 mb-2" />
        <p className="font-medium text-slate-700 dark:text-zinc-300">No cash journal entries yet</p>
        <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
          Cash deposits, margin blocks, trade settlements, and statutory levies will be recorded here chronologically.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <DataTableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search journal description, category, or reference..."
        filterPills={filterPills}
        onToggleFilter={(id) => setActiveFilter(id as any)}
      />

      {/* Northstar Table */}
      <DataTableContainer>
        <table className="w-full text-left border-collapse">
          <DataTableHead>
            <tr>
              <th className="py-2.5 px-4 font-semibold">Timestamp</th>
              <th className="py-2.5 px-4 font-semibold">Entry ID</th>
              <th className="py-2.5 px-4 font-semibold">Category</th>
              <th className="py-2.5 px-4 font-semibold">Reference</th>
              <th className="py-2.5 px-4 font-semibold text-right">Debit (Dr.)</th>
              <th className="py-2.5 px-4 font-semibold text-right">Credit (Cr.)</th>
              <th className="py-2.5 px-4 font-semibold text-right">Running Balance</th>
              <th className="py-2.5 px-4 font-semibold">Description</th>
            </tr>
          </DataTableHead>
          <tbody>
            {filteredEntries.map((entry) => {
              const date = new Date(entry.timestamp);
              const formattedTime = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
              const debit = Number(entry.debit);
              const credit = Number(entry.credit);
              const bal = Number(entry.running_balance);

              const isCredit = credit > 0;
              const isDebit = debit > 0;

              return (
                <DataTableRow key={entry.entry_id}>
                  <td className="py-2.5 px-4 font-mono text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                    {formattedTime}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-700 dark:text-zinc-300 font-medium">
                    {entry.entry_id.slice(0, 10)}...
                  </td>
                  <td className="py-2.5 px-4">
                    <span
                      style={CONTROL_SHADOW_STYLE}
                      className="rounded-full px-2 py-0.5 text-[10px] font-mono bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-white/10"
                    >
                      {entry.category.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-500 dark:text-zinc-400">
                    {entry.reference_id.slice(0, 8)}...
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-700 dark:text-zinc-300">
                    {isDebit ? `₹${debit.toFixed(2)}` : "—"}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    {isCredit ? `+₹${credit.toFixed(2)}` : "—"}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                    ₹{bal.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-4 text-slate-600 dark:text-zinc-400 text-[11px] max-w-xs truncate">
                    {entry.description}
                  </td>
                </DataTableRow>
              );
            })}
          </tbody>
        </table>
      </DataTableContainer>
    </div>
  );
}
