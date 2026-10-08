"use client";

import { useTradingStore } from "@/store/useTradingStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Clock, AlertTriangle } from "lucide-react";

export default function PortfolioPage() {
  const positions = useTradingStore((s) => s.positions);
  const holdings = useTradingStore((s) => s.holdings);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Briefcase className="w-5 h-5 text-slate-700" />
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Portfolio &amp; Risk Inventory
          </h1>
        </div>
        {/* MIS 15:20 Auto Square-Off Banner */}
        <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          <span>MIS Auto Square-Off scheduled for <strong>15:20:00 IST</strong></span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white border-slate-200">
          <CardHeader className="py-3 px-5 border-b border-slate-100">
            <CardTitle className="text-xs font-semibold uppercase text-slate-500">
              Open Positions (MIS / CNC)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="text-2xl font-bold font-mono text-slate-900">
              {positions.length}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Active leveraged risk exposures
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardHeader className="py-3 px-5 border-b border-slate-100">
            <CardTitle className="text-xs font-semibold uppercase text-slate-500">
              Delivery Holdings (CNC)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="text-2xl font-bold font-mono text-slate-900">
              {holdings.length}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Long-term equity inventory
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200">
          <CardHeader className="py-3 px-5 border-b border-slate-100">
            <CardTitle className="text-xs font-semibold uppercase text-slate-500">
              Live Unrealized MTM
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="text-2xl font-bold font-mono text-emerald-600">
              +₹0.00
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Mark-to-market against live LTP
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white border-slate-200 shadow-xs">
        <CardHeader className="py-3 px-5 border-b border-slate-100">
          <CardTitle className="text-sm font-semibold">
            Open Positions Table
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center text-slate-500 text-sm">
          <div className="py-8">
            {positions.length === 0 ? (
              <p>No open positions. Place an order on the Trading Terminal to open a position.</p>
            ) : (
              <p>{positions.length} positions active.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
