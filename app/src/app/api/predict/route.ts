import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DB_PATH || path.resolve(process.cwd(), "../prices.db");

export async function GET() {
  const db = new Database(DB_PATH, { readonly: true });
  const rows = db
    .prepare(
      "SELECT symbol, json_group_array(json_object('t',t,'p',p)) AS pts FROM predict GROUP BY symbol"
    )
    .all() as { symbol: string; pts: string }[];
  const out: Record<string, {t:number; p:number}[]> = {};
  rows.forEach(r => (out[r.symbol] = JSON.parse(r.pts)));
  return NextResponse.json(out);
}
