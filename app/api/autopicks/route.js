import { NextResponse } from "next/server";
import { generateAutoPicks } from "../../../lib/predictionEngine.js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await generateAutoPicks();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error?.message ?? "Erreur inconnue" },
      { status: 500 }
    );
  }
}
