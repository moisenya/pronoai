import { NextResponse } from "next/server";
import { generateAutoPicks } from "../../../lib/predictionEngine";

export async function GET() {
  try {
    const picks = generateAutoPicks();
    return NextResponse.json({ picks });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message ?? "Erreur inconnue" },
      { status: 500 }
    );
  }
}
