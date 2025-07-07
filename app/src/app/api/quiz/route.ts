/* app/src/app/api/quiz/route.ts ----------------------------------
   generates a 24 h quiz slice  (GET)
   evaluates user guess + asks aimlapi for one-line explanation (POST)
------------------------------------------------------------------*/
import { NextResponse } from "next/server";

/* ── constants ────────────────────────────────────────────────── */
const SYMBOLS   = ["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT"];
const MS_HOUR   = 60 * 60 * 1000;

/* ── helpers ──────────────────────────────────────────────────── */
const rnd = <T,>(a:T[]) => a[Math.floor(Math.random()*a.length)];
const validSym = (raw:string|null|undefined)=>{
  const s=(raw??"").toUpperCase();
  return SYMBOLS.includes(s+"USDT") ? s+"USDT" : undefined;
};

/* ── GET /api/quiz?symbol=BTC ─────────────────────────────────── */
export async function GET(req: Request) {
  const param  = new URL(req.url).searchParams.get("symbol");
  const symbol = validSym(param) ?? rnd(SYMBOLS);

  /* random 24 h slice 7–37 days ago */
  const end   = Date.now() - 7*24*MS_HOUR - Math.floor(Math.random()*30*24*MS_HOUR);
  const start = end - 48*MS_HOUR;

  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}` +
              `&interval=1h&startTime=${start}&endTime=${end}&limit=26`;
  const raw = await fetch(url).then(r=>r.json()) as any[];

  if(!Array.isArray(raw)||raw.length<25)
    return NextResponse.json({error:"Binance returned too few candles"},{status:502});

  const candles = raw.slice(0,24).map(c=>({ t:c[0]/1000, p:+c[4] }));
  const id      = Buffer.from(`${symbol}|${start}`).toString("base64");

  return NextResponse.json({
    id, symbol, candles, target_ts: raw[24][0]/1000,
  });
}

/* ---------- POST /api/quiz  { id, guess } --------------------- */
console.log("ENV key =", process.env.AIML_API_KEY);
export async function POST(req: Request) {
  const { id, guess } = await req.json() as { id: string; guess: number };
  const [symbol, startStr] = Buffer.from(id, "base64").toString().split("|");
  const targetStart = +startStr + 24 * MS_HOUR;

  /* --- 1: фактическая свеча ----------------------------------- */
  const binUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}` +
                 `&interval=1h&startTime=${targetStart}&limit=1`;
  const raw = await fetch(binUrl).then(r => r.json()) as any[];
  const actual   = +raw[0][4];
  const errorPct = Math.abs((actual - guess) / guess) * 100;

  /* --- 2: AI-объяснение --------------------------------------- */
  let explanation = "Market momentum continued in the same direction.";
  try {
    const prompt =
      `Explain in ≤30 words why the next 1-hour candle for ${symbol.slice(0,-4)} ` +
      `closed at $${actual.toFixed(2)} (user predicted $${guess}). ` +
      `Mention short-term trend or volatility.`;

    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 15_000);

    const aiRes = await fetch("https://api.aimlapi.com/v1/chat/completions", {
      method : "POST",
      headers: {
        "Content-Type" : "application/json",
        "Authorization": `Bearer ${process.env.AIML_API_KEY}`,
      },
      body: JSON.stringify({
        model:"gpt-3.5-turbo",
        messages:[
          { role:"system", content:"You are a concise crypto-market analyst." },
          { role:"user",   content: prompt }
        ],
        max_tokens: 40
      }),
      signal: ctrl.signal
    });

    const dbg = await aiRes.text();               // <—— читаем как text
    console.log("AIML status", aiRes.status, dbg);

    if (aiRes.ok) {
      const j = JSON.parse(dbg) as {
        choices?: { message?: { content?: string } }[];
      };
      const txt = j.choices?.[0]?.message?.content?.trim();
      if (txt) explanation = txt;
      else explanation = "⚠︎ AIML: empty answer";
    } else {
      explanation = `⚠︎ AIML ${aiRes.status}: ${dbg.slice(0,60)}`;
    }

  } catch (e:any) {
    explanation = `⚠︎ AIML error: ${e.message}`;
  }

  return NextResponse.json({
    actual   : +actual.toFixed(2),
    errorPct : +errorPct.toFixed(2),
    explanation,
  });
}
