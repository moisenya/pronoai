// app/api/picks/[id]/route.js
import { NextResponse } from "next/server";

export async function PATCH(req, { params }) {
  try {
    const { getSql } = await import("../../../../lib/db.js");
    const sql = getSql();
    const { status } = await req.json();

    const rows = await sql`
      update picks
      set status = ${status}
      where id = ${params.id}::uuid
      returning *;
    `;
    if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
