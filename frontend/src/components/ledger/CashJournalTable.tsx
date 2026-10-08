"use client";

import { CustomerCashEntry } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BookOpen } from "lucide-react";

interface CashJournalTableProps {
  entries: CustomerCashEntry[];
}

export function CashJournalTable({ entries }: CashJournalTableProps) {
  if (entries.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 text-sm">
        <BookOpen className="w-8 h-8 mx-auto text-slate-300 mb-2" />
        <p className="font-medium text-slate-600">No cash journal entries yet</p>
        <p className="text-xs text-slate-400 mt-1">
          Cash deposits, margin blocks, trade settlements, and statutory levies will be recorded here chronologically.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table className="text-xs">
        <TableHeader className="bg-slate-50/80">
          <TableRow className="border-b border-slate-200">
            <TableHead className="font-semibold text-slate-600">Timestamp</TableHead>
            <TableHead className="font-semibold text-slate-600">Entry ID</TableHead>
            <TableHead className="font-semibold text-slate-600">Category</TableHead>
            <TableHead className="font-semibold text-slate-600">Reference</TableHead>
            <TableHead className="text-right font-semibold text-slate-600">Debit (Dr.)</TableHead>
            <TableHead className="text-right font-semibold text-slate-600">Credit (Cr.)</TableHead>
            <TableHead className="text-right font-semibold text-slate-600">Running Balance</TableHead>
            <TableHead className="font-semibold text-slate-600">Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const date = new Date(entry.timestamp);
            const formattedTime = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
            const debit = Number(entry.debit);
            const credit = Number(entry.credit);
            const bal = Number(entry.running_balance);

            const isCredit = credit > 0;
            const isDebit = debit > 0;

            return (
              <TableRow
                key={entry.entry_id}
                className="hover:bg-slate-50/60 transition-colors border-b border-slate-100"
              >
                <TableCell className="font-mono text-slate-500 whitespace-nowrap">
                  {formattedTime}
                </TableCell>
                <TableCell className="font-mono text-slate-700 font-medium">
                  {entry.entry_id}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-slate-50 text-slate-700 border-slate-200 py-0"
                  >
                    {entry.category.replace(/_/g, " ")}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-slate-500">
                  {entry.reference_id}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold text-slate-700">
                  {isDebit ? `₹${debit.toFixed(2)}` : "—"}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold text-emerald-700">
                  {isCredit ? `+₹${credit.toFixed(2)}` : "—"}
                </TableCell>
                <TableCell className="text-right font-mono font-bold text-slate-900">
                  ₹{bal.toFixed(2)}
                </TableCell>
                <TableCell className="text-slate-600 text-[11px] max-w-xs truncate">
                  {entry.description}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
