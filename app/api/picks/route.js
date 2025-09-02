// app/api/picks/route.js
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { getSql } = await import("../../../lib/db.js");
    const sql = getSql();
    const rows = await sql`select * from picks order by kickoff_iso asc`;
    return NextResponse.json(rows ?? []);
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { getSql } = await import("../../../lib/db.js");
    const sql = getSql();
    const body = await req.json();

    const toInsert = {
      date: body.date ?? null,
      sport: body.sport,
      league: body.league,
      match: body.match,
      kickoff_iso: body.kickoffISO ? new Date(body.kickoffISO) : null,
      pick: body.pick,
      odds: body.odds,
      analysis: body.analysis ?? null,
      confidence: body.confidence,
      status: body.status ?? "pending",
    };

    const rows = await sql`
      insert into picks (date, sport, league, match, kickoff_iso, pick, odds, analysis, confidence, status)
      values (${toInsert.date}, ${toInsert.sport}, ${toInsert.league}, ${toInsert.match},
              ${toInsert.kickoff_iso}, ${toInsert.pick}, ${toInsert.odds},
              ${toInsert.analysis}, ${toInsert.confidence}, ${toInsert.status})
      returning *;
    `;
    return NextResponse.json(rows?.[0] ?? null);
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
