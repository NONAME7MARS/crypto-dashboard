"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts";
import { BsGraphUp, BsEye, BsEyeSlash } from "react-icons/bs";
import { motion } from "framer-motion";

/* ───────── helpers ───────── */
interface Point { t:number; p:number }
interface Coin  { symbol:string; name:string; points:Point[]; predict?:Point[] }
const fetchJSON = (u:string)=>fetch(u).then(r=>r.json());

const palette=["#3b82f6","#10b981","#f59e0b","#ef4444",
               "#6366f1","#ec4899","#14b8a6","#8b5cf6","#f97316","#22d3ee"];

/* mini-stats (for sidebar) */
const SMA  =(a:number[])=>a.reduce((s,v)=>s+v,0)/a.length;
const EMA  =(a:number[])=>a.reduce((p,c)=>c*2/(a.length+1)+p*(1-2/(a.length+1)));
const STDEV=(a:number[])=>{const m=SMA(a);return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/a.length)};
const analytics=(pts:Point[],win=24)=>{
  if(pts.length<win) return null;
  const slice=pts.slice(-win).map(p=>p.p);
  return {sma:SMA(slice),ema:EMA(slice),vol:STDEV(slice),
          change:(slice.at(-1)!-slice[0])/slice[0]*100};
};

/* tooltip */
interface TooltipItem { value: number; dataKey: string; name: string; color?: string }
interface TipProps {
  active?: boolean;
  label?: number | string;
  payload?: TooltipItem[];
  showPred?: boolean;
}
const ChartTooltip=({active,label,payload,showPred}:TipProps)=>{
  if(!active||!payload?.length) return null;
  const rows=payload.filter(pl=> showPred || pl.dataKey!=="forecast");
  return(
    <div className="rounded bg-white dark:bg-slate-700 p-2 shadow text-xs max-w-[14rem]">
      <p className="font-medium mb-1 truncate">{label}</p>
      {rows.map(pl=>(
        <div key={pl.name} className="flex justify-between" style={{color:pl.color}}>
          <span>{pl.name}</span>
          <span className="font-semibold">${(+pl.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

/* ───────── page ───────── */
export default function Home(){
  const {data:prices}=useSWR<Coin[]>("/api/prices",fetchJSON,{refreshInterval:60_000});
  const {data:pred  }=useSWR<Record<string,Point[]>>("/api/predict",fetchJSON);
  const [showPred,setShowPred]=useState(true);
  if(!prices||!pred) return <p className="p-6">Loading…</p>;

  const coins = prices.map(c=>({...c,predict:pred[c.symbol]||[]}));

  return(
    <main className="min-h-screen bg-gray-50 dark:bg-slate-900 p-8 space-y-10">
      {/* header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <BsGraphUp className="text-blue-600" size={30}/> Crypto Dashboard
        </h1>

        <div className="flex items-center gap-3">
          {/* quiz nav */}
          <a
            href="/quiz"
            className="inline-flex items-center gap-1 rounded-lg bg-blue-600
                      px-3 py-2 text-white text-sm hover:bg-blue-700 transition">
            🧩 Quiz
          </a>

          {/* hide / show forecast */}
          <button
            onClick={()=>setShowPred(v=>!v)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600
                      px-3 py-2 text-white text-sm shadow hover:bg-blue-700 transition">
            {showPred ? <BsEyeSlash/> : <BsEye/>}
            {showPred ? "Hide" : "Show"} forecast
          </button>
        </div>
      </header>

      {/* cards */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {coins.map((c,i)=>{
          const base  = palette[i%palette.length];
          const faded = base+"80";
          const split = c.predict?.[0]?.t;

          /* -------- merge actual + forecast ---------- */
          const actual   = c.points .map(p=>({
                              t:new Date(p.t*1000).toLocaleString("en-GB"),
                              price:p.p, forecast: null }));
          const forecast = showPred
                           ? c.predict!.map(p=>({
                               t:new Date(p.t*1000).toLocaleString("en-GB"),
                               price:null, forecast:p.p }))
                           : [];

          const data=[...actual,...forecast];

          const stat=analytics(c.points);

          return(
            <section key={c.symbol}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow p-5">
              <h2 className="text-lg font-semibold mb-3 uppercase">
                {c.symbol}</h2>

              {/* chart */}
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data}>
                  <XAxis dataKey="t" tick={false}/>
                  <YAxis domain={["auto","auto"]}
                         tickFormatter={v=>`$${v.toLocaleString()}`}/>
                  <Tooltip content={<ChartTooltip showPred={showPred}/>}/>

                  <Line dataKey="price"    name="Price"
                        stroke={base}  strokeWidth={2} dot={false}/>

                  {/* forecast + splitter */}
                  {c.predict?.length>0 && (
                    <motion.g initial={{opacity:0}}
                              animate={{opacity:showPred?1:0}}
                              transition={{duration:0.4}}>
                      <Line dataKey="forecast" name="AI-Forecast"
                            stroke={faded} strokeWidth={2}
                            strokeDasharray="5 5" dot={false}/>
                      {showPred && (
                        <ReferenceLine x={new Date(split!*1000).toLocaleString("en-GB")}
                                       stroke={faded} strokeDasharray="2 2"/> )}
                    </motion.g>
                  )}
                </LineChart>
              </ResponsiveContainer>

              {/* analytics */}
              {stat && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-700 dark:text-gray-300">
                  <div className="flex justify-between"><span>SMA 24h</span><span>{stat.sma.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>EMA 24h</span><span>{stat.ema.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>σ 24h</span><span>{stat.vol.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Δ 24h</span>
                    <span className={stat.change>0?"text-green-700":"text-red-600"}>
                      {stat.change.toFixed(2)}%</span></div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
