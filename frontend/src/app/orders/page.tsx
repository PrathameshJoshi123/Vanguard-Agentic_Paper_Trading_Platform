"use client";

import { useTradingStore } from "@/store/useTradingStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListOrdered } from "lucide-react";

export default function OrdersPage() {
  const orders = useTradingStore((s) => s.orders);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <ListOrdered className="w-5 h-5 text-slate-700" />
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Orders &amp; Execution Fills
          </h1>
        </div>
        <div className="text-xs text-slate-500">
          State Machine Lifecycle &amp; Atomic Match Legs
        </div>
      </div>

      <Card className="bg-white border-slate-200 shadow-xs">
        <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold">
            Order Book Resting &amp; Executed Orders
          </CardTitle>
          <div className="text-xs font-mono text-slate-500">
            Total Orders: {orders.length}
          </div>
        </CardHeader>
        <CardContent className="p-6 text-center text-slate-500 text-sm">
          <div className="py-8">
            {orders.length === 0 ? (
              <p>No orders recorded. Open orders and historical fills will appear here.</p>
            ) : (
              <p>{orders.length} orders tracked in deterministic state machine.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
