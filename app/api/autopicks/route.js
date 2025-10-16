import { NextResponse } from "next/server";
import { generateAutoPicks } from "../../../lib/predictionEngine.js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const picks = await generateAutoPicks();
    return NextResponse.json({ picks });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message ?? "Erreur inconnue" },
      { status: 500 }
    );
  }
}
