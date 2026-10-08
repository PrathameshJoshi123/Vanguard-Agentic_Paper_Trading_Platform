"use client";

import { useState } from "react";
import { Order } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTradingStore } from "@/store/useTradingStore";
import { api } from "@/lib/api";
import { OrderModifyModal } from "./OrderModifyModal";
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

  const openOrders = orders.filter(
    (o) =>
      o.status === "OPEN" ||
      o.status === "PENDING" ||
      o.status === "TRIGGER_PENDING" ||
      o.status === "PARTIALLY_FILLED"
  );

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

  if (openOrders.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 text-sm">
        <Clock className="w-8 h-8 mx-auto text-slate-300 mb-2" />
        <p className="font-medium text-slate-600">No active resting orders</p>
        <p className="text-xs text-slate-400 mt-1">
          Place a LIMIT or STOP-LOSS order on the Trading Terminal to view resting orders here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table className="text-xs">
          <TableHeader className="bg-slate-50/80">
            <TableRow className="border-b border-slate-200">
              <TableHead className="font-semibold text-slate-600">Time</TableHead>
              <TableHead className="font-semibold text-slate-600">Order ID</TableHead>
              <TableHead className="font-semibold text-slate-600">Symbol</TableHead>
              <TableHead className="font-semibold text-slate-600">Side</TableHead>
              <TableHead className="font-semibold text-slate-600">Type</TableHead>
              <TableHead className="font-semibold text-slate-600">Product</TableHead>
              <TableHead className="text-right font-semibold text-slate-600">Filled / Qty</TableHead>
              <TableHead className="text-right font-semibold text-slate-600">Price</TableHead>
              <TableHead className="text-right font-semibold text-slate-600">Trigger</TableHead>
              <TableHead className="font-semibold text-slate-600">Status</TableHead>
              <TableHead className="text-center font-semibold text-slate-600">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {openOrders.map((order) => {
              const formattedTime = new Date(order.created_at).toLocaleTimeString();
              const isBuy = order.side === "BUY";

              return (
                <TableRow
                  key={order.order_id}
                  className="hover:bg-slate-50/60 transition-colors border-b border-slate-100"
                >
                  <TableCell className="font-mono text-slate-500 whitespace-nowrap">
                    {formattedTime}
                  </TableCell>
                  <TableCell className="font-mono text-slate-700 font-medium">
                    {order.order_id}
                  </TableCell>
                  <TableCell className="font-bold text-slate-900 font-mono">
                    {order.symbol}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold py-0 ${
                        isBuy
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-rose-50 text-rose-700 border-rose-200"
                      }`}
                    >
                      {order.side}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-slate-700">
                    {order.order_type}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-slate-50 text-slate-700 border-slate-200 py-0"
                    >
                      {order.product_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold text-slate-900">
                    <span className="text-emerald-700">{order.filled_qty}</span> /{" "}
                    {order.quantity}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold text-slate-900">
                    {order.price ? `₹${Number(order.price).toFixed(2)}` : "MKT"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-slate-500">
                    {order.trigger_price ? `₹${Number(order.trigger_price).toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 py-0"
                    >
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                        title="Modify price/quantity"
                        onClick={() => handleOpenModify(order)}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-slate-600 hover:text-rose-600 hover:bg-rose-50"
                        title="Cancel resting order"
                        disabled={cancellingId === order.order_id}
                        onClick={() => handleCancel(order.order_id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
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
