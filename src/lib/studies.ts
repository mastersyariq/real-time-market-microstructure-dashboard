// ─── Types ────────────────────────────────────────────────────────────────────
export interface Level { price: number; size: number }
export interface BookState {
  bids: Level[]
  asks: Level[]
  mid: number
  spread: number
}
export interface Studies {
  vpin: number
  lob: number
  resilience: number
  ott: number
  spread: number
  mid: number
  bid: number
  ask: number
  ts: number
}
export interface Trade {
  price: number
  size: number
  isBuyerMaker: boolean
  ts: number
}

// ─── VPIN ─────────────────────────────────────────────────────────────────────
export class VPINCalc {
  private buckets: number[] = []
  private bv = 0; private sv = 0; private total = 0
  constructor(private bs: number, private window = 50) {}

  update(size: number, isBuyerMaker: boolean): number {
    if (isBuyerMaker) this.sv += size
    else              this.bv += size
    this.total += size

    while (this.total >= this.bs) {
      const r = this.bs / this.total
      this.buckets.push(Math.abs(this.bv - this.sv) / this.bs)
      if (this.buckets.length > this.window) this.buckets.shift()
      this.bv    *= (1 - r)
      this.sv    *= (1 - r)
      this.total -= this.bs
    }
    return this.buckets.length
      ? this.buckets.reduce((a, b) => a + b, 0) / this.buckets.length
      : 0
  }
}

// ─── LOB Imbalance ────────────────────────────────────────────────────────────
export function calcLOB(bids: Level[], asks: Level[], n = 10): number {
  const bv = bids.slice(0, n).reduce((s, l) => s + l.size, 0)
  const av = asks.slice(0, n).reduce((s, l) => s + l.size, 0)
  const t  = bv + av
  return t ? (bv - av) / t : 0
}

// ─── Market Resilience ────────────────────────────────────────────────────────
export class ResilienceCalc {
  private hist: number[] = []
  update(bids: Level[], asks: Level[]): number {
    const d = bids.slice(0, 10).reduce((s, l) => s + l.size, 0)
            + asks.slice(0, 10).reduce((s, l) => s + l.size, 0)
    this.hist.push(d)
    if (this.hist.length > 30) this.hist.shift()
    if (this.hist.length < 5) return 0.9
    const avg = this.hist.reduce((a, b) => a + b, 0) / this.hist.length
    return avg ? Math.min(d / avg, 1) : 0.9
  }
}

// ─── OTT Ratio ───────────────────────────────────────────────────────────────
export class OTTCalc {
  private ob = 0; private tr = 0; private t0 = Date.now()
  onOB() { this.ob++ }
  onTrade(): number {
    this.tr++
    const ratio = this.ob / Math.max(this.tr, 1)
    if (Date.now() - this.t0 >= 10_000) {
      this.ob = this.tr = 0; this.t0 = Date.now()
    }
    return ratio
  }
}

// ─── VPIN bucket sizes per symbol ─────────────────────────────────────────────
export const VPIN_BUCKETS: Record<string, number> = {
  BTCUSDT: 1, ETHUSDT: 10, BNBUSDT: 50, SOLUSDT: 200,
  XRPUSDT: 15000, DOGEUSDT: 500000, ADAUSDT: 30000,
  AVAXUSDT: 300, LINKUSDT: 500, DOTUSDT: 500,
}
