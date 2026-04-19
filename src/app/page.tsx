'use client'
import React, { useState, useEffect, useRef, memo } from 'react'
import { useBinance } from '@/lib/useBinance'
import { Studies, BookState, Trade } from '@/lib/studies'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function displaySym(s: string) {
  return s.replace('USDT', '/USDT').replace('BTC', 'BTC').replace('ETH','ETH')
}
function fmt(n: number, isBig: boolean) {
  if (!n) return '—'
  return isBig ? n.toFixed(2) : n.toFixed(5)
}

// ─── Order Book ───────────────────────────────────────────────────────────────
const OrderBook = memo(function OrderBook({ book, sym }: { book: BookState | null; sym: string }) {
  const big = (book?.mid ?? 0) > 100
  const maxSz = Math.max(...(book?.bids.map(b=>b.size)??[0]), ...(book?.asks.map(a=>a.size)??[0]), 0.0001)
  return (
    <div className="panel" style={{ flex:1 }}>
      <div className="panel-title">Order Book <span>{sym}</span></div>
      <div style={{ padding:'4px 0', flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 70px', padding:'2px 10px', color:'var(--text3)', fontSize:9, marginBottom:2 }}>
          <span>PRICE</span><span style={{ textAlign:'right' }}>SIZE</span><span style={{ textAlign:'right' }}>TOTAL</span>
        </div>
        <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
          {[...(book?.asks??[])].reverse().map((a, i) => {
            const cum = (book?.asks??[]).slice(0, (book?.asks??[]).length - i).reduce((s,x)=>s+x.size,0)
            return (
              <div key={i} style={{ position:'relative', display:'grid', gridTemplateColumns:'1fr 80px 70px', padding:'1px 10px' }}>
                <div style={{ position:'absolute', right:0, top:0, bottom:0, width:`${(a.size/maxSz*60).toFixed(0)}%`, background:'rgba(239,68,68,0.1)', borderRadius:1 }}/>
                <span style={{ color:'var(--red)', fontSize:10, fontWeight:600, zIndex:1 }}>{fmt(a.price, big)}</span>
                <span style={{ textAlign:'right', color:'var(--text2)', zIndex:1 }}>{a.size < 0.01 ? a.size.toFixed(5) : a.size.toFixed(3)}</span>
                <span style={{ textAlign:'right', color:'var(--text3)', zIndex:1 }}>{cum.toFixed(3)}</span>
              </div>
            )
          })}
        </div>
        <div style={{ background:'var(--bg2)', margin:'4px 8px', padding:'4px 8px', borderRadius:3, textAlign:'center', border:'1px solid var(--border)' }}>
          <div style={{ color:'var(--amber)', fontSize:14, fontWeight:700 }}>{book ? fmt(book.mid, big) : '—'}</div>
          <div style={{ color:'var(--text3)', fontSize:9 }}>spread {book ? book.spread.toFixed(book.spread < 0.01 ? 6 : 2) : '—'}</div>
        </div>
        <div style={{ flex:1, overflow:'hidden' }}>
          {(book?.bids??[]).map((b, i) => {
            const cum = (book?.bids??[]).slice(0, i+1).reduce((s,x)=>s+x.size, 0)
            return (
              <div key={i} style={{ position:'relative', display:'grid', gridTemplateColumns:'1fr 80px 70px', padding:'1px 10px' }}>
                <div style={{ position:'absolute', right:0, top:0, bottom:0, width:`${(b.size/maxSz*60).toFixed(0)}%`, background:'rgba(34,197,94,0.1)', borderRadius:1 }}/>
                <span style={{ color:'var(--green)', fontSize:10, fontWeight:600, zIndex:1 }}>{fmt(b.price, big)}</span>
                <span style={{ textAlign:'right', color:'var(--text2)', zIndex:1 }}>{b.size < 0.01 ? b.size.toFixed(5) : b.size.toFixed(3)}</span>
                <span style={{ textAlign:'right', color:'var(--text3)', zIndex:1 }}>{cum.toFixed(3)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
})

// ─── Trade Tape ───────────────────────────────────────────────────────────────
const TradeTape = memo(function TradeTape({ trades }: { trades: Trade[] }) {
  const big = (trades[0]?.price ?? 0) > 100
  return (
    <div className="panel" style={{ height:180 }}>
      <div className="panel-title">Trade Tape <span>{trades.length} trades</span></div>
      <div style={{ overflow:'hidden', flex:1 }}>
        {[...trades].reverse().slice(0,20).map((t, i) => {
          const isBuy = !t.isBuyerMaker
          return (
            <div key={i} style={{ display:'grid', gridTemplateColumns:'40px 1fr 80px 60px', padding:'2px 10px', background: isBuy ? 'rgba(34,197,94,0.04)' : 'rgba(239,68,68,0.04)', borderLeft:`2px solid ${isBuy?'var(--green)':'var(--red)'}`, marginBottom:1 }}>
              <span style={{ color: isBuy ? 'var(--green)' : 'var(--red)', fontWeight:700, fontSize:9 }}>{isBuy?'BUY':'SELL'}</span>
              <span style={{ color: isBuy ? 'var(--green)' : 'var(--red)', fontSize:10, fontWeight:600 }}>{fmt(t.price, big)}</span>
              <span style={{ color:'var(--text2)', textAlign:'right' }}>{t.size < 0.001 ? t.size.toFixed(6) : t.size.toFixed(4)}</span>
              <span style={{ color:'var(--text3)', textAlign:'right', fontSize:9 }}>{new Date(t.ts).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
})

// ─── Metrics Panel ────────────────────────────────────────────────────────────
const MetricsPanel = memo(function MetricsPanel({ s }: { s: Studies | null }) {
  const vpin = s?.vpin ?? 0; const lob = s?.lob ?? 0
  const res  = s?.resilience ?? 0; const ott = s?.ott ?? 0
  const vc = vpin > 0.7 ? 'var(--red)' : vpin > 0.5 ? 'var(--amber)' : 'var(--green)'
  const lc = lob  > 0.3 ? 'var(--green)' : lob < -0.3 ? 'var(--red)' : 'var(--amber)'
  const rc = res  > 0.7 ? 'var(--green)' : res > 0.4  ? 'var(--amber)' : 'var(--red)'
  const oc = ott  < 5   ? 'var(--green)' : ott < 10   ? 'var(--amber)' : 'var(--red)'
  const card = (label: string, val: string, pct: number, color: string, hint: string) => (
    <div style={{ background:'var(--bg0)', border:'1px solid var(--border)', borderRadius:4, padding:'8px 10px', display:'flex', flexDirection:'column', gap:4 }}>
      <div style={{ color:'var(--text3)', fontSize:9, letterSpacing:'1.2px', textTransform:'uppercase' }}>{label}</div>
      <div style={{ color, fontSize:20, fontWeight:700, lineHeight:1 }}>{val}</div>
      <div style={{ color:'var(--text3)', fontSize:9 }}>{hint}</div>
      <div style={{ height:3, background:'var(--bg3)', borderRadius:2, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${Math.min(Math.max(pct,0),100)}%`, background:color, borderRadius:2, transition:'width .4s' }}/>
      </div>
    </div>
  )
  return (
    <div className="panel">
      <div className="panel-title">Live Metrics</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, padding:8, flex:1 }}>
        {card('VPIN', vpin.toFixed(3), vpin*100, vc, vpin > 0.7 ? '⚠ informed flow' : vpin > 0.5 ? 'elevated' : 'normal')}
        {card('LOB Imbalance', lob.toFixed(3), ((lob+1)/2)*100, lc, lob > 0.3 ? 'bid heavy' : lob < -0.3 ? 'ask heavy' : 'balanced')}
        {card('Resilience', res.toFixed(3), res*100, rc, res > 0.7 ? 'high' : res > 0.4 ? 'moderate' : 'low')}
        {card('OTT Ratio', ott.toFixed(1), Math.min(ott/15*100,100), oc, ott > 10 ? 'high noise' : ott > 5 ? 'moderate' : 'normal')}
      </div>
    </div>
  )
})

// ─── Market Depth Canvas ──────────────────────────────────────────────────────
const MarketDepth = memo(function MarketDepth({ book }: { book: BookState | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = canvasRef.current; if (!c || !book) return
    const p = c.parentElement!; c.width = p.clientWidth; c.height = p.clientHeight
    const W = c.width, H = c.height, ctx = c.getContext('2d')!
    ctx.clearRect(0,0,W,H)
    const bids = [...book.bids].reverse(); const asks = book.asks
    const bidCum: [number,number][] = []; const askCum: [number,number][] = []
    let bs=0, as_=0
    for (const l of bids) { bs+=l.size; bidCum.push([l.price, bs]) }
    for (const l of asks) { as_+=l.size; askCum.push([l.price, as_]) }
    if (!bidCum.length || !askCum.length) return
    const minP = bidCum[0][0], maxP = askCum[askCum.length-1][0]
    const maxCum = Math.max(bidCum[bidCum.length-1][1], askCum[askCum.length-1][1])
    const pad=10
    const px = (p:number) => ((p-minP)/(maxP-minP))*(W-2*pad)+pad
    const py = (c:number) => H-pad-(c/maxCum)*(H-2*pad)
    ctx.fillStyle='rgba(34,197,94,0.12)'; ctx.beginPath(); ctx.moveTo(pad,H-pad)
    bidCum.forEach(([p,c]) => ctx.lineTo(px(p),py(c)))
    ctx.lineTo(px(bidCum[bidCum.length-1][0]),H-pad); ctx.closePath(); ctx.fill()
    ctx.strokeStyle='#22c55e'; ctx.lineWidth=1.5; ctx.beginPath()
    bidCum.forEach(([p,c],i) => i===0 ? ctx.moveTo(px(p),py(c)) : ctx.lineTo(px(p),py(c))); ctx.stroke()
    ctx.fillStyle='rgba(239,68,68,0.12)'; ctx.beginPath(); ctx.moveTo(px(askCum[0][0]),H-pad)
    askCum.forEach(([p,c]) => ctx.lineTo(px(p),py(c)))
    ctx.lineTo(W-pad,H-pad); ctx.closePath(); ctx.fill()
    ctx.strokeStyle='#ef4444'; ctx.lineWidth=1.5; ctx.beginPath()
    askCum.forEach(([p,c],i) => i===0 ? ctx.moveTo(px(p),py(c)) : ctx.lineTo(px(p),py(c))); ctx.stroke()
    const mx=px(book.mid)
    ctx.strokeStyle='rgba(245,158,11,0.6)'; ctx.lineWidth=1; ctx.setLineDash([4,3])
    ctx.beginPath(); ctx.moveTo(mx,pad); ctx.lineTo(mx,H-pad); ctx.stroke(); ctx.setLineDash([])
  }, [book])
  return (
    <div className="panel">
      <div className="panel-title">Market Depth <span>cumulative</span></div>
      <div style={{ flex:1, position:'relative', minHeight:0 }}>
        <canvas ref={canvasRef} style={{ position:'absolute', inset:0 }}/>
      </div>
    </div>
  )
})

// ─── Line Chart (lightweight-charts) ─────────────────────────────────────────
const LineChart = memo(function LineChart({ title, sub, data, field, color, fill }: {
  title:string; sub:string; data:Studies[]; field:keyof Studies; color:string; fill?:string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const chart = useRef<any>(null); const series = useRef<any>(null)
  const ready = useRef(false); const pending = useRef<Studies[]>([])

  useEffect(() => {
    if (!ref.current) return
    import('lightweight-charts').then(({ createChart, ColorType }) => {
      if (!ref.current || chart.current) return
      const el = ref.current
      const c = createChart(el, {
        width: el.clientWidth, height: el.clientHeight,
        layout: { background:{type:ColorType.Solid,color:'transparent'}, textColor:'#444458', fontFamily:'Courier New', fontSize:9 },
        grid: { vertLines:{color:'rgba(255,255,255,0.03)'}, horzLines:{color:'rgba(255,255,255,0.03)'} },
        rightPriceScale: { borderColor:'#252530', scaleMargins:{top:0.1,bottom:0.1} },
        timeScale: { borderColor:'#252530', timeVisible:true, secondsVisible:false },
        crosshair:{mode:0}, handleScroll:false, handleScale:false,
      })
      const s = c.addAreaSeries({ lineColor:color, topColor:fill??color+'22', bottomColor:'transparent', lineWidth:1, lastValueVisible:true, priceLineVisible:false })
      chart.current = c; series.current = s; ready.current = true
      if (pending.current.length) { setData(s, c, pending.current, field); pending.current = [] }
      const ro = new ResizeObserver(() => c.applyOptions({width:el.clientWidth,height:el.clientHeight}))
      ro.observe(el); (el as any).__ro = ro
    })
    return () => {
      const el = ref.current; if (el && (el as any).__ro) (el as any).__ro.disconnect()
      if (chart.current) { try{chart.current.remove()}catch{} chart.current=null; series.current=null; ready.current=false }
    }
  }, [])

  useEffect(() => {
    if (!data?.length) return
    if (!ready.current) { pending.current = data; return }
    setData(series.current, chart.current, data, field)
  }, [data, field])

  return (
    <div className="panel">
      <div className="panel-title">{title} <span>{sub}</span></div>
      <div ref={ref} style={{ flex:1, minHeight:0 }}/>
    </div>
  )
})

function setData(s:any, c:any, data:Studies[], field:keyof Studies) {
  const seen = new Set<number>()
  const pts = data.map(p => ({ time:Math.floor(p.ts/1000) as any, value:p[field] as number }))
    .filter(p => { if(seen.has(p.time)||!isFinite(p.value))return false; seen.add(p.time); return true })
  if (!pts.length) return
  try {
    s?.setData(pts)
    // fitContent shows all history; then scroll to latest without over-zooming
    c?.timeScale().fitContent()
  } catch {}
}

// ─── Price Chart ──────────────────────────────────────────────────────────────
const PriceChart = memo(function PriceChart({ data }: { data: Studies[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const chart = useRef<any>(null)
  const bid = useRef<any>(null), mid = useRef<any>(null), ask = useRef<any>(null)
  const ready = useRef(false); const pending = useRef<Studies[]>([])

  useEffect(() => {
    if (!ref.current) return
    import('lightweight-charts').then(({ createChart, ColorType }) => {
      if (!ref.current || chart.current) return
      const el = ref.current
      const c = createChart(el, {
        width:el.clientWidth, height:el.clientHeight,
        layout:{background:{type:ColorType.Solid,color:'transparent'},textColor:'#444458',fontFamily:'Courier New',fontSize:9},
        grid:{vertLines:{color:'rgba(255,255,255,0.03)'},horzLines:{color:'rgba(255,255,255,0.03)'}},
        rightPriceScale:{borderColor:'#252530',scaleMargins:{top:0.05,bottom:0.05}},
        timeScale:{borderColor:'#252530',timeVisible:true,secondsVisible:false},
        crosshair:{mode:0},handleScroll:false,handleScale:false,
      })
      bid.current = c.addLineSeries({color:'#22c55e',lineWidth:1,lastValueVisible:false,priceLineVisible:false})
      mid.current = c.addLineSeries({color:'#f59e0b',lineWidth:1.5,lastValueVisible:true,priceLineVisible:false})
      ask.current = c.addLineSeries({color:'#ef4444',lineWidth:1,lastValueVisible:false,priceLineVisible:false})
      chart.current=c; ready.current=true
      if (pending.current.length) { setPriceData(bid.current,mid.current,ask.current,c,pending.current); pending.current=[] }
      const ro = new ResizeObserver(()=>c.applyOptions({width:el.clientWidth,height:el.clientHeight}))
      ro.observe(el); (el as any).__ro=ro
    })
    return () => {
      const el=ref.current; if(el&&(el as any).__ro)(el as any).__ro.disconnect()
      if(chart.current){try{chart.current.remove()}catch{} chart.current=null; ready.current=false}
    }
  }, [])

  useEffect(() => {
    if (!data?.length) return
    if (!ready.current){pending.current=data;return}
    setPriceData(bid.current,mid.current,ask.current,chart.current,data)
  }, [data])

  return (
    <div className="panel">
      <div className="panel-title">Price Chart <span>bid · mid · ask</span></div>
      <div ref={ref} style={{flex:1,minHeight:0}}/>
    </div>
  )
})

function setPriceData(b:any,m:any,a:any,c:any,data:Studies[]) {
  const seen=new Set<number>(); const bp:any[]=[],mp:any[]=[],ap:any[]=[]
  for (const p of data) {
    const t=Math.floor(p.ts/1000); if(seen.has(t))continue; seen.add(t)
    if(p.bid>0)bp.push({time:t,value:p.bid})
    if(p.mid>0)mp.push({time:t,value:p.mid})
    if(p.ask>0)ap.push({time:t,value:p.ask})
  }
  try {
    if(bp.length)b?.setData(bp)
    if(mp.length)m?.setData(mp)
    if(ap.length)a?.setData(ap)
    c?.timeScale().fitContent()
  } catch {}
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { state, setActive } = useBinance()
  const [active, setActiveLocal] = useState('')
  const [clock, setClock]   = useState('')

  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'})), 1000)
    return () => clearInterval(t)
  }, [])

  const sym     = active || state.symbols[0] || ''
  const symData = state.data[sym]

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', padding:6, gap:5, background:'var(--bg0)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--bg1)', border:'1px solid var(--border)', borderRadius:4, padding:'6px 12px', flexShrink:0 }}>
        <div style={{ color:'var(--amber)', fontSize:13, fontWeight:700, letterSpacing:3 }}>MICROSTRUCTURE</div>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {state.symbols.map(s => (
            <button key={s} onClick={() => { setActiveLocal(s); setActive(s) }} style={{ background:s===sym?'var(--amber)':'var(--bg2)', color:s===sym?'#000':'var(--text3)', border:`1px solid ${s===sym?'var(--amber)':'var(--border)'}`, borderRadius:3, padding:'3px 10px', cursor:'pointer', fontFamily:'Courier New', fontSize:10, fontWeight:s===sym?700:400 }}>
              {displaySym(s)}
            </button>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:7, height:7, borderRadius:'50%', background:state.connected?'var(--green)':'var(--red)', animation:state.connected?'pulse 1.5s infinite':'none' }}/>
          <span style={{ color:state.connected?'var(--green)':'var(--red)', fontSize:10 }}>{state.statusMsg}</span>
          <span style={{ color:'var(--text3)', fontSize:10, marginLeft:6 }}>{clock}</span>
        </div>
      </div>

      <div style={{ flex:1, display:'grid', gridTemplateColumns:'220px 1fr', gap:5, minHeight:0 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:5, minHeight:0 }}>
          <OrderBook book={symData?.book??null} sym={displaySym(sym)} />
          <TradeTape trades={symData?.trades??[]} />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gridTemplateRows:'repeat(3,1fr)', gap:5, minHeight:0 }}>
          <PriceChart data={symData?.studies??[]} />
          <LineChart title="VPIN" sub="informed trading" data={symData?.studies??[]} field="vpin" color="#f59e0b" fill="rgba(245,158,11,0.08)"/>
          <LineChart title="LOB Imbalance" sub="bid/ask ratio" data={symData?.studies??[]} field="lob" color="#22c55e" fill="rgba(34,197,94,0.08)"/>
          <LineChart title="Spread" sub="liquidity" data={symData?.studies??[]} field="spread" color="#60a5fa" fill="rgba(96,165,250,0.06)"/>
          <MarketDepth book={symData?.book??null} />
          <LineChart title="OTT Ratio" sub="order/trade" data={symData?.studies??[]} field="ott" color="#a78bfa" fill="rgba(167,139,250,0.06)"/>
          <div style={{ gridColumn:'1/-1' }}><MetricsPanel s={symData?.lastStudy??null}/></div>
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  )
}
