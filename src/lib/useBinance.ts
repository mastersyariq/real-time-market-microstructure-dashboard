'use client'
import { useEffect, useReducer, useRef, useCallback } from 'react'
import {
  VPINCalc, ResilienceCalc, OTTCalc,
  calcLOB, VPIN_BUCKETS,
  Level, Studies, Trade, BookState,
} from './studies'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface SymbolData {
  book:        BookState | null
  studies:     Studies[]
  trades:      Trade[]
  lastStudy:   Studies | null
}

export interface MarketState {
  symbols:     string[]
  activeSymbol: string
  data:        Record<string, SymbolData>
  connected:   boolean
  statusMsg:   string
}

// Per-symbol runtime state (not in React state — mutable refs)
interface SymRuntime {
  bids:      Map<number, number>
  asks:      Map<number, number>
  vpin:      VPINCalc
  res:       ResilienceCalc
  ott:       OTTCalc
  lastBcMs:  number
}

const SYMBOLS = [
  'BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT',
  'XRPUSDT','DOGEUSDT','ADAUSDT','AVAXUSDT',
  'LINKUSDT','DOTUSDT',
]

const DEPTH_LEVELS   = 20
const OB_THROTTLE_MS = 200
const MAX_STUDIES    = 300
const MAX_TRADES     = 60

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sortedBids(m: Map<number,number>): Level[] {
  return [...m.entries()]
    .filter(([,s]) => s > 0)
    .sort((a, b) => b[0] - a[0])
    .slice(0, DEPTH_LEVELS)
    .map(([price, size]) => ({ price, size }))
}
function sortedAsks(m: Map<number,number>): Level[] {
  return [...m.entries()]
    .filter(([,s]) => s > 0)
    .sort((a, b) => a[0] - b[0])
    .slice(0, DEPTH_LEVELS)
    .map(([price, size]) => ({ price, size }))
}
function applyLevels(map: Map<number,number>, levels: [string,string][]) {
  for (const [p, s] of levels) {
    const price = parseFloat(p), size = parseFloat(s)
    if (size === 0) map.delete(price)
    else            map.set(price, size)
  }
}

// ─── Reducer ──────────────────────────────────────────────────────────────────
type Action =
  | { type: 'STATUS';  connected: boolean; msg: string }
  | { type: 'BOOK';    symbol: string; book: BookState }
  | { type: 'STUDY';   symbol: string; study: Studies }
  | { type: 'TRADE';   symbol: string; trade: Trade }

function makeSymData(): SymbolData {
  return { book: null, studies: [], trades: [], lastStudy: null }
}

function reducer(state: MarketState, action: Action): MarketState {
  switch (action.type) {
    case 'STATUS':
      return { ...state, connected: action.connected, statusMsg: action.msg }

    case 'BOOK': {
      const sym = action.symbol
      const existing = state.data[sym] ?? makeSymData()
      const symbols = state.symbols.includes(sym) ? state.symbols : [...state.symbols, sym]
      return {
        ...state, symbols,
        activeSymbol: state.activeSymbol || sym,
        data: { ...state.data, [sym]: { ...existing, book: action.book } },
      }
    }

    case 'STUDY': {
      const sym = action.symbol
      const existing = state.data[sym] ?? makeSymData()
      const prev = existing.studies
      const next = prev.length >= MAX_STUDIES ? [...prev.slice(1), action.study] : [...prev, action.study]
      return {
        ...state,
        data: { ...state.data, [sym]: { ...existing, studies: next, lastStudy: action.study } },
      }
    }

    case 'TRADE': {
      const sym = action.symbol
      const existing = state.data[sym] ?? makeSymData()
      const prev = existing.trades
      const next = prev.length >= MAX_TRADES ? [...prev.slice(1), action.trade] : [...prev, action.trade]
      return {
        ...state,
        data: { ...state.data, [sym]: { ...existing, trades: next } },
      }
    }

    default: return state
  }
}

const INITIAL: MarketState = {
  symbols: [], activeSymbol: '', data: {}, connected: false, statusMsg: 'Connecting...',
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useBinance() {
  const [state, dispatch] = useReducer(reducer, INITIAL)
  const wsRef      = useRef<WebSocket | null>(null)
  const runtimeRef = useRef<Record<string, SymRuntime>>({})
  const studyTimer = useRef<ReturnType<typeof setInterval>>()
  const urlIdx     = useRef(0)

  // Init per-symbol runtime
  for (const sym of SYMBOLS) {
    if (!runtimeRef.current[sym]) {
      runtimeRef.current[sym] = {
        bids: new Map(), asks: new Map(),
        vpin: new VPINCalc(VPIN_BUCKETS[sym] ?? 100),
        res:  new ResilienceCalc(),
        ott:  new OTTCalc(),
        lastBcMs: 0,
      }
    }
  }

  const connect = useCallback(() => {
    const BINANCE_URLS = [
      'wss://stream.binance.com:9443/stream',
      'wss://stream.binance.com:443/stream',
      'wss://data-stream.binance.vision/stream',
    ]

    const streams = SYMBOLS.flatMap(s => [
      `${s.toLowerCase()}@depth20@100ms`,
      `${s.toLowerCase()}@trade`,
    ])
    const url = BINANCE_URLS[urlIdx.current % BINANCE_URLS.length]
      + '?streams=' + streams.join('/')

    dispatch({ type: 'STATUS', connected: false, msg: `Connecting to Binance...` })

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      dispatch({ type: 'STATUS', connected: true, msg: 'Live' })
      urlIdx.current = 0
    }

    ws.onmessage = (e) => {
      try {
        const msg    = JSON.parse(e.data)
        const stream = msg.stream as string ?? ''
        const data   = msg.data  ?? {}
        const sym    = stream.split('@')[0].toUpperCase()
        if (!SYMBOLS.includes(sym)) return
        const rt = runtimeRef.current[sym]

        // ── Depth20 (full book snapshot every 100ms) ──────────────────────────
        if (stream.includes('depth20')) {
          // Rebuild book from scratch
          rt.bids.clear(); rt.asks.clear()
          for (const [p, s] of (data.bids as [string,string][])) rt.bids.set(+p, +s)
          for (const [p, s] of (data.asks as [string,string][])) rt.asks.set(+p, +s)

          const now = Date.now()
          if (now - rt.lastBcMs < OB_THROTTLE_MS) return
          rt.lastBcMs = now

          const bids = sortedBids(rt.bids)
          const asks = sortedAsks(rt.asks)
          if (!bids.length || !asks.length) return

          const bid    = bids[0].price
          const ask    = asks[0].price
          const mid    = (bid + ask) / 2
          const spread = ask - bid

          dispatch({
            type: 'BOOK', symbol: sym,
            book: { bids, asks, mid, spread },
          })

          // Compute LOB + Resilience here (OB-triggered)
          rt.ott.onOB()

        // ── Trade ─────────────────────────────────────────────────────────────
        } else if (data.e === 'trade') {
          const price        = parseFloat(data.p)
          const size         = parseFloat(data.q)
          const isBuyerMaker = data.m as boolean

          const vpin  = rt.vpin.update(size, isBuyerMaker)
          const ott   = rt.ott.onTrade()

          const bids = sortedBids(rt.bids)
          const asks = sortedAsks(rt.asks)
          const bid  = bids[0]?.price ?? 0
          const ask  = asks[0]?.price ?? 0

          const study: Studies = {
            ts:         data.T,
            vpin:       +vpin.toFixed(4),
            lob:        +calcLOB(bids, asks).toFixed(4),
            resilience: +rt.res.update(bids, asks).toFixed(4),
            ott:        +ott.toFixed(2),
            spread:     +(ask - bid).toFixed(8),
            mid:        +((bid + ask) / 2).toFixed(8),
            bid:        +bid.toFixed(8),
            ask:        +ask.toFixed(8),
          }
          dispatch({ type: 'STUDY', symbol: sym, study })
          dispatch({
            type: 'TRADE', symbol: sym,
            trade: { price, size, isBuyerMaker, ts: data.T },
          })
        }
      } catch { /* ignore parse errors */ }
    }

    ws.onclose = (e) => {
      dispatch({ type: 'STATUS', connected: false, msg: `Reconnecting... (${e.code})` })
      urlIdx.current++
      setTimeout(connect, 3000)
    }

    ws.onerror = () => ws.close()
  }, [])

  useEffect(() => {
    connect()
    return () => {
      clearInterval(studyTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  const setActive = useCallback((sym: string) => {
    // Dispatch a book update to trigger re-render with new symbol
    dispatch({ type: 'STATUS', connected: state.connected, msg: state.statusMsg })
  }, [state.connected, state.statusMsg])

  return { state, setActive }
}
