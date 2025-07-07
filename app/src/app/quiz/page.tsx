"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, ReferenceDot
} from "recharts";
import { AnimatePresence, motion } from "framer-motion";

/* ── types & util ───────────────────────────── */
type Slice = {
  id: string;
  symbol: string;
  candles: { t: number; p: number }[];
  target_ts: number;
};
const nfmt = (v:number)=>Intl.NumberFormat("en",{notation:"compact",maximumFractionDigits:1}).format(v);
const fetcher = (u:string)=>fetch(u).then(r=>r.json());
const PAIRS = ["BTC","ETH","BNB","SOL","XRP","DOGE","TRX","USDC","USDT"];

/* ── tooltip ────────────────────────────────── */
function Tip({active,payload,label}:{active?:boolean;payload?:any[];label?:any}){
  return active&&payload?.length?(
    <div className="rounded bg-white dark:bg-slate-700 px-2 py-1 shadow text-xs">
      <p className="font-medium mb-1 truncate">{new Date(label*1000).toLocaleString()}</p>
      <p>Price: <span className="font-semibold">${(+payload[0].value).toLocaleString()}</span></p>
    </div>):null;
}

/* ── page ───────────────────────────────────── */
export default function Quiz(){
  const [pair,setPair]=useState("BTC");
  const {data,mutate,isLoading}=useSWR<Slice>(()=>`/api/quiz?symbol=${pair}`,fetcher,{
    revalidateOnFocus:false
  });
  const [guess,setGuess]=useState("");
  const [result,setResult]=useState<{actual:number;errorPct:number;explanation:string}|null>(null);
  const lockDisabled=+guess<=0;

  if(isLoading||!data) return <p className="p-6">Loading…</p>;

  const submit=async()=>{
    const r=await fetch("/api/quiz",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({id:data.id,guess:+guess})
    }).then(r=>r.json());
    setResult(r);
  };
  const reset=()=>{setResult(null);setGuess("");mutate();};

  return(
    <main className="flex justify-center py-10">
      <div className="w-full max-w-xl space-y-6">

        {/* header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <a href="/"
             className="inline-flex items-center gap-1 rounded-lg bg-blue-600
                        px-3 py-1.5 text-white text-sm hover:bg-blue-700">↩ Back</a>

          <div className="flex flex-wrap gap-1">
            {PAIRS.map(p=>(
              <button key={p} onClick={()=>{setPair(p);reset();}}
                className={`rounded-full px-3 py-1 text-sm border transition
                  ${p===pair
                    ?"bg-blue-600 text-white border-blue-600"
                    :"bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 border-gray-300 hover:bg-blue-50 dark:hover:bg-slate-600"}`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* card */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-5 space-y-5">
          <AnimatePresence mode="wait">
            <motion.div key={data.id}
              initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              transition={{duration:0.25}}>

              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.candles}>
                  <XAxis dataKey="t" tick={false}/>
                  <YAxis width={70} domain={["auto","auto"]} tickFormatter={v=>`$${nfmt(v)}`}/>
                  <Tooltip content={<Tip/>}/>
                  <Line dataKey="p" stroke="#3b82f6" strokeWidth={2} dot={false}/>
                  {result && (
                    <>
                      <ReferenceDot x={data.target_ts*1000} y={result.actual} r={4} fill="#f59e0b"/>
                      <Line dataKey="p" stroke="#f59e0b" strokeDasharray="4 4" dot={false}
                            data={[...data.candles,{t:data.target_ts,p:result.actual}]}/>
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>

              {result ? (
                <motion.div initial={{opacity:0,y:10}}
                            animate={{opacity:1,y:0}}
                            className="space-y-2 text-sm">
                  <p>Your guess: <b>${(+guess).toLocaleString()}</b></p>
                  <p>Actual close: <b>${result.actual}</b></p>
                  <p>Error: <span className={result.errorPct<2?"text-green-600":"text-red-600"}>
                    {result.errorPct}%</span></p>
                  <p className="italic text-gray-600 dark:text-gray-400">{result.explanation}</p>

                  <button onClick={reset}
                    className="w-full rounded-lg bg-blue-600 px-3 py-2 text-white hover:bg-blue-700 transition">
                    Try another
                  </button>
                </motion.div>
              ):(
                <div className="space-y-3">
                  <input type="number" step="0.01"
                         placeholder={`Your guess for next ${pair} close ($)`}
                         className="w-full rounded border px-3 py-1.5
                                    dark:bg-slate-700 dark:border-slate-600"
                         value={guess} onChange={e=>setGuess(e.target.value)}
                         onWheel={e=>(e.target as HTMLInputElement).blur()}/>
                  <button disabled={lockDisabled} onClick={submit}
                    className={`w-full rounded-lg px-3 py-2 text-white transition ${
                      lockDisabled?"bg-gray-400":"bg-blue-600 hover:bg-blue-700"}`}>
                    Lock&nbsp;in
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
