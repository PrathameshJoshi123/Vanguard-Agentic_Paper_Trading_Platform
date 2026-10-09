"use client";

import React, { useState } from "react";
import { Order } from "@/lib/types";
import { useTradingStore } from "@/store/useTradingStore";
import { api } from "@/lib/api";
import { OrderModifyModal } from "./OrderModifyModal";
import { CONTROL_SHADOW_STYLE } from "@/lib/design-system";
import {
  DataTableToolbar,
  DataTableContainer,
  DataTableHead,
  DataTableRow,
  FilterPill,
} from "@/components/ui/northstar/DataTable";
import { Edit2, Trash2, Clock, CheckCircle2 } from "lucide-react";

interface OpenOrdersTableProps {
  orders: Order[];
  onRefresh: () => void;
}

export function OpenOrdersTable({ orders, onRefresh }: OpenOrdersTableProps) {
  const accountId = useTradingStore((s) => s.accountId);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modifyModalOpen, setModifyModalOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"ALL" | "BUY" | "SELL" | "MIS">("ALL");

  const openOrders = orders.filter(
    (o) =>
      o.status === "OPEN" ||
      o.status === "PENDING" ||
      o.status === "TRIGGER_PENDING" ||
      o.status === "PARTIALLY_FILLED"
  );

  const filteredOrders = openOrders.filter((order) => {
    if (
      searchQuery &&
      !order.symbol.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !order.order_id.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    if (activeFilter === "BUY" && order.side !== "BUY") return false;
    if (activeFilter === "SELL" && order.side !== "SELL") return false;
    if (activeFilter === "MIS" && order.product_type !== "MIS") return false;

    return true;
  });

  const handleCancel = async (orderId: string) => {
    setCancellingId(orderId);
    try {
      await api.cancelOrder(orderId, accountId);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to cancel order";
      alert(`Cancel failed: ${msg}`);
    } finally {
      setCancellingId(null);
    }
  };

  const handleOpenModify = (order: Order) => {
    setSelectedOrder(order);
    setModifyModalOpen(true);
  };

  const filterPills: FilterPill[] = [
    { id: "ALL", label: "All Active", active: activeFilter === "ALL", count: openOrders.length },
    {
      id: "BUY",
      label: "Buy only",
      active: activeFilter === "BUY",
      count: openOrders.filter((o) => o.side === "BUY").length,
    },
    {
      id: "SELL",
      label: "Sell only",
      active: activeFilter === "SELL",
      count: openOrders.filter((o) => o.side === "SELL").length,
    },
    {
      id: "MIS",
      label: "MIS (5x)",
      active: activeFilter === "MIS",
      count: openOrders.filter((o) => o.product_type === "MIS").length,
    },
  ];

  if (openOrders.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 dark:text-zinc-500 text-sm">
        <Clock className="w-8 h-8 mx-auto text-slate-300 dark:text-zinc-600 mb-2" />
        <p className="font-medium text-slate-700 dark:text-zinc-300">No active resting orders</p>
        <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
          Place a LIMIT or STOP-LOSS order on the Trading Terminal to view resting orders here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* Toolbar */}
        <DataTableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search order ID or symbol..."
          filterPills={filterPills}
          onToggleFilter={(id) => setActiveFilter(id as any)}
        />

        {/* Northstar Table */}
        <DataTableContainer>
          <table className="w-full text-left border-collapse">
            <DataTableHead>
              <tr>
                <th className="py-2.5 px-4 font-semibold">Time</th>
                <th className="py-2.5 px-4 font-semibold">Order ID</th>
                <th className="py-2.5 px-4 font-semibold">Symbol</th>
                <th className="py-2.5 px-4 font-semibold">Side</th>
                <th className="py-2.5 px-4 font-semibold">Type</th>
                <th className="py-2.5 px-4 font-semibold">Product</th>
                <th className="py-2.5 px-4 font-semibold text-right">Filled / Qty</th>
                <th className="py-2.5 px-4 font-semibold text-right">Price</th>
                <th className="py-2.5 px-4 font-semibold text-right">Trigger</th>
                <th className="py-2.5 px-4 font-semibold">Status</th>
                <th className="py-2.5 px-4 font-semibold text-center">Actions</th>
              </tr>
            </DataTableHead>
            <tbody>
              {filteredOrders.map((order) => {
                const formattedTime = new Date(order.created_at).toLocaleTimeString();
                const isBuy = order.side === "BUY";

                return (
                  <DataTableRow key={order.order_id}>
                    <td className="py-2.5 px-4 font-mono text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                      {formattedTime}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-medium text-slate-700 dark:text-zinc-300">
                      {order.order_id.slice(0, 8)}...
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      {order.symbol}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        style={CONTROL_SHADOW_STYLE}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                          isBuy
                            ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                            : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                        }`}
                      >
                        {order.side}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-zinc-400">
                      {order.order_type}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-zinc-400">
                      {order.product_type}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900 dark:text-white">
                      {order.filled_qty || 0} / {order.quantity}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-700 dark:text-zinc-300">
                      ₹{(order.price || 0).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-500 dark:text-zinc-400">
                      {order.trigger_price ? `₹${order.trigger_price.toFixed(2)}` : "—"}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        style={CONTROL_SHADOW_STYLE}
                        className="rounded-full px-2 py-0.5 text-[10px] font-mono bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenModify(order)}
                          style={CONTROL_SHADOW_STYLE}
                          className="h-7 px-2.5 rounded-full text-[11px] bg-white dark:bg-[#1c1c1f] text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-transparent hover:bg-slate-50 dark:hover:bg-[#232327] cursor-pointer inline-flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Modify</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancel(order.order_id)}
                          disabled={cancellingId === order.order_id}
                          style={CONTROL_SHADOW_STYLE}
                          className="h-7 px-2.5 rounded-full text-[11px] bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/40 cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Cancel</span>
                        </button>
                      </div>
                    </td>
                  </DataTableRow>
                );
              })}
            </tbody>
          </table>
        </DataTableContainer>
      </div>

      <OrderModifyModal
        order={selectedOrder}
        open={modifyModalOpen}
        onOpenChange={setModifyModalOpen}
        onSuccess={onRefresh}
      />
    </>
  );
}
