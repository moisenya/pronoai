const DEFAULT_MODEL = "gemini-2.5-flash";

function resolveModel() {
  const raw = process.env.GEMINI_MODEL;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return DEFAULT_MODEL;
}

function buildEndpoint(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent`;
}

function buildPrompt(picks) {
  const fixtures = picks
    .map((pick, index) => {
      const lines = [
        `${index + 1}. id: ${pick.id}`,
        `   sport: ${pick.sport}`,
        `   league: ${pick.league}`,
        `   match: ${pick.match}`,
        `   marche: ${pick.market}`,
        `   pronostic: ${pick.pick}`,
        `   confiance: ${pick.confidence}%`,
        `   cote: ${pick.odds}`,
      ];

      if (pick.kickoffISO) {
        lines.push(`   coup_denvoi: ${pick.kickoffISO}`);
      }

      if (Number.isFinite(pick.marketOdds)) {
        lines.push(`   cote_marche: ${pick.marketOdds}`);
      }

      if (typeof pick.marketProvider === "string" && pick.marketProvider.trim().length > 0) {
        lines.push(`   bookmaker: ${pick.marketProvider}`);
      }

      if (Number.isFinite(pick.marketImpliedProbability)) {
        lines.push(`   proba_marche: ${pick.marketImpliedProbability}%`);
      }

      if (pick.context) {
        lines.push(`   contexte: ${pick.context}`);
      }

      return lines.join("\n");
    })
    .join("\n\n");

  return [
    "Tu es un expert en paris sportifs.",
    "Pour chacune des rencontres ci-dessous, rédige une analyse courte (2-3 phrases) en français qui justifie le pronostic proposé.",
    "Structure ton analyse avec des arguments concrets : dynamique récente, facteurs tactiques, contexte (repos, blessures, surface, etc.).",
    "Si une cote de marché est fournie, compare-la à notre estimation et explique l'écart sans promettre de gain.",
    "Sois factuel, sans garantie de résultat, et évite les propos trop agressifs ou sensationnalistes.",
    "Renvoies uniquement un objet JSON du format suivant :",
    '{"picks": [{"id": "<id>", "analysis": "<texte>"}, ...]}',
    "Matches :",
    fixtures,
  ].join("\n\n");
}

async function callGeminiAPI(picks) {
  const apiKey = typeof process.env.GEMINI_API_KEY === "string" ? process.env.GEMINI_API_KEY.trim() : "";
  if (!apiKey) {
    return null;
  }

  const prompt = buildPrompt(picks);

  const model = resolveModel();
  const endpoint = buildEndpoint(model);
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), 15000) : null;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 512,
        },
        safetySettings: [
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUAL_CONTENT", threshold: "BLOCK_NONE" },
        ],
        responseMimeType: "application/json",
      }),
      signal: controller?.signal,
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Gemini API error ${response.status}${detail ? `: ${detail}` : ""}`);
    }

    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Réponse Gemini vide");
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new Error("Réponse Gemini invalide (JSON)");
    }

    if (!Array.isArray(parsed?.picks)) {
      throw new Error("Réponse Gemini invalide (picks)");
    }

    return { entries: parsed.picks, model };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Délai dépassé lors de l'appel Gemini");
    }
    throw error;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function generateAnalysesWithGemini(picks) {
  try {
    const result = await callGeminiAPI(picks);
    if (!result) {
      return picks;
    }

    const { entries, model } = result;

    const lookup = new Map(
      entries
        .filter((entry) => entry && typeof entry.id === "string")
        .map((entry) => [entry.id, entry.analysis])
    );

    return picks.map((pick) => {
      const enhanced = lookup.get(pick.id);
      if (typeof enhanced === "string" && enhanced.trim().length > 0) {
        return {
          ...pick,
          analysis: enhanced.trim(),
          analysisSource: "gemini",
          analysisModel: model,
        };
      }
      return pick;
    });
  } catch (error) {
    console.error("Gemini generation failed", error);
    return picks;
  }
}
