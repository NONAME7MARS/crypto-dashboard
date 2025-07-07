import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface OHLCPoint { t: number; p: number }
interface ApiRow { symbol: string; name: string; points: OHLCPoint[] }

// raw row straight from SQLite (points is JSON string)
interface RawRow {
  symbol: string;
  name: string;
  points: string; // JSON string, will be parsed
}

const DB_PATH = process.env.DB_PATH || path.resolve(process.cwd(), "../prices.db");

export async function GET() {
  const db = new Database(DB_PATH, { readonly: true });

  const now = Math.floor(Date.now() / 1000);
  const threeDaysAgo = now - 60 * 60 * 72;

  const raw = db
    .prepare(
      `SELECT symbol,
              name,
              json_group_array(json_object('t', dt, 'p', price)) AS points
       FROM prices
       WHERE dt >= ?
       GROUP BY symbol
       ORDER BY symbol`
    )
    .all(threeDaysAgo) as RawRow[];

  // map & parse JSON once, give TS explicit type
  const rows: ApiRow[] = raw.map(r => ({
    symbol: r.symbol,
    name: r.name,
    points: JSON.parse(r.points) as OHLCPoint[],
  }));

  return NextResponse.json(rows);
}
