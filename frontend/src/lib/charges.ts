import { Side, ProductType, ChargesBreakdown } from "./types";

export function roundToPaise(val: number): number {
  return Math.round(val * 100) / 100;
}

export interface CalculatedOrderPreview {
  turnover: number;
  baseMargin: number;
  requiredMargin: number;
  charges: ChargesBreakdown;
}

/**
 * Deterministic client-side calculator for Indian equity regulatory levies & pre-trade margin.
 * Exactly mirrors src/ledger/charges.py and src/risk/margin.py down to the exact paisa.
 */
export function calculateOrderChargesAndMargin(
  side: Side,
  productType: ProductType,
  price: number,
  quantity: number
): CalculatedOrderPreview {
  const cleanPrice = Math.max(0, price || 0);
  const cleanQty = Math.max(0, Math.floor(quantity || 0));
  const turnover = roundToPaise(cleanPrice * cleanQty);

  if (turnover <= 0) {
    return {
      turnover: 0,
      baseMargin: 0,
      requiredMargin: 0,
      charges: {
        turnover: 0,
        brokerage: 0,
        stt: 0,
        exchange_turnover: 0,
        sebi_fees: 0,
        stamp_duty: 0,
        gst: 0,
        total_charges: 0,
      },
    };
  }

  // 1. Brokerage: MIS min(₹20, 0.03%), CNC ₹0
  let brokerage = 0;
  if (productType === "MIS") {
    const rawBrokerage = turnover * 0.0003;
    brokerage = roundToPaise(Math.min(rawBrokerage, 20.0));
  } else {
    brokerage = 0.0;
  }

  // 2. STT: CNC 0.1% on Buy & Sell; MIS 0.025% on Sell only
  let stt = 0;
  if (productType === "CNC") {
    stt = roundToPaise(turnover * 0.001);
  } else {
    if (side === "SELL") {
      stt = roundToPaise(turnover * 0.00025);
    } else {
      stt = 0.0;
    }
  }

  // 3. Exchange Turnover Charge: NSE 0.00297%
  const exchange_turnover = roundToPaise(turnover * 0.0000297);

  // 4. SEBI Turnover Fee: ₹10 / crore = 0.0001%
  const sebi_fees = roundToPaise(turnover * 0.000001);

  // 5. Stamp Duty: Buy side only (CNC 0.015%, MIS 0.003%)
  let stamp_duty = 0;
  if (side === "BUY") {
    stamp_duty = roundToPaise(
      productType === "CNC" ? turnover * 0.00015 : turnover * 0.00003
    );
  } else {
    stamp_duty = 0.0;
  }

  // 6. GST: 18% on (Brokerage + Exchange Fee + SEBI Fee)
  const taxable_services = brokerage + exchange_turnover + sebi_fees;
  const gst = roundToPaise(taxable_services * 0.18);

  // 7. Total Statutory Charges
  const total_charges = roundToPaise(
    brokerage + stt + exchange_turnover + sebi_fees + stamp_duty + gst
  );

  // 8. Base Margin: CNC BUY 100%, CNC SELL 0, MIS 20% (5x leverage)
  let baseMargin = 0;
  if (productType === "CNC") {
    baseMargin = side === "BUY" ? turnover : 0;
  } else {
    baseMargin = roundToPaise(turnover * 0.2);
  }

  const requiredMargin = roundToPaise(baseMargin + total_charges);

  return {
    turnover,
    baseMargin,
    requiredMargin,
    charges: {
      turnover,
      brokerage,
      stt,
      exchange_turnover,
      sebi_fees,
      stamp_duty,
      gst,
      total_charges,
    },
  };
}
