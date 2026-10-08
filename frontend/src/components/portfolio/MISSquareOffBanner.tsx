"use client";

import { useState, useEffect } from "react";
import { Clock, AlertTriangle, Play, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useTradingStore } from "@/store/useTradingStore";

export function MISSquareOffBanner() {
  const [timeLeft, setTimeLeft] = useState<string>("Calculating...");
  const [isSquaringOff, setIsSquaringOff] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const accountId = useTradingStore((s) => s.accountId);
  const setPositions = useTradingStore((s) => s.setPositions);
  const setOrders = useTradingStore((s) => s.setOrders);

  // Compute countdown to 15:20:00 IST
  useEffect(() => {
    const updateCountdown = () => {
      // IST is UTC + 5:30
      const now = new Date();
      const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
      const istNow = new Date(utcTime + 5.5 * 3600000);

      const target = new Date(istNow);
      target.setHours(15, 20, 0, 0);

      // If already past 15:20 today, show target for next day
      if (istNow.getTime() > target.getTime()) {
        target.setDate(target.getDate() + 1);
      }

      const diffMs = target.getTime() - istNow.getTime();
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diffMs % (1000 * 60)) / 1000);

      setTimeLeft(
        `${hours.toString().padStart(2, "0")}h ${mins
          .toString()
          .padStart(2, "0")}m ${secs.toString().padStart(2, "0")}s`
      );
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleForceSquareOff = async () => {
    setIsSquaringOff(true);
    setResultMessage(null);
    try {
      const results = await api.triggerMISSquareOff(accountId);
      const count = results.length;
      setResultMessage(
        count > 0
          ? `Successfully squared off ${count} MIS position(s) at market.`
          : "No open MIS positions required square-off."
      );

      // Refresh positions and orders
      const updatedPositions = await api.getPositions(accountId);
      setPositions(updatedPositions);
      const updatedOrders = await api.getOrders(accountId);
      setOrders(updatedOrders);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to execute square-off";
      setResultMessage(`Error: ${msg}`);
    } finally {
      setIsSquaringOff(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
          <Clock className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-amber-900 tracking-wide uppercase">
              Mandatory MIS Auto Square-Off
            </span>
            <Badge
              variant="outline"
              className="text-[10px] bg-amber-100/60 text-amber-800 border-amber-300 font-mono py-0"
            >
              15:20:00 IST
            </Badge>
          </div>
          <p className="text-xs text-amber-700 mt-0.5">
            Auto-executes closing market orders for all intraday leverage positions. Next window:{" "}
            <span className="font-mono font-semibold text-amber-900">{timeLeft}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center">
        {resultMessage && (
          <span className="text-xs font-medium text-amber-900 bg-amber-100 px-2.5 py-1 rounded-md flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-amber-700" />
            {resultMessage}
          </span>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs bg-white text-amber-900 border-amber-300 hover:bg-amber-100/50 hover:text-amber-950 shadow-xs"
          onClick={() => setDialogOpen(true)}
        >
          <Play className="w-3 h-3 mr-1.5 fill-amber-700 text-amber-700" />
          Force Square-Off
        </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md bg-white border-slate-200">
            <DialogHeader>
              <div className="flex items-center gap-2 text-amber-800">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <DialogTitle className="text-slate-900">
                  Simulate 15:20 MIS Square-Off
                </DialogTitle>
              </div>
              <DialogDescription className="text-slate-600 text-xs mt-2">
                This triggers the deterministic scheduler job immediately. All open MIS positions
                for account <strong className="font-mono text-slate-800">{accountId}</strong> will
                be liquidated at prevailing market price and settled into the financial ledger.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="text-xs bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => {
                  handleForceSquareOff();
                  setDialogOpen(false);
                }}
                disabled={isSquaringOff}
              >
                {isSquaringOff ? "Executing..." : "Confirm Square-Off"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
