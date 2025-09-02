// app/api/debug/route.js
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "debug route OK",
    now: new Date().toISOString(),
    hasDbUrl: !!process.env.DATABASE_URL
  });
}
