const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent`;

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
    "Sois factuel, sans garantie de résultat, et évite les propos trop agressifs ou sensationnalistes.",
    "Renvoies uniquement un objet JSON du format suivant :",
    '{"picks": [{"id": "<id>", "analysis": "<texte>"}, ...]}',
    "Matches :",
    fixtures,
  ].join("\n\n");
}

async function callGeminiAPI(picks) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const prompt = buildPrompt(picks);

  const response = await fetch(GEMINI_ENDPOINT, {
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
  });

  if (!response.ok) {
    throw new Error(`Gemini API error ${response.status}`);
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

  return parsed.picks;
}

export async function generateAnalysesWithGemini(picks) {
  try {
    const geminiPicks = await callGeminiAPI(picks);
    if (!geminiPicks) {
      return picks;
    }

    const lookup = new Map(
      geminiPicks
        .filter((entry) => entry && typeof entry.id === "string")
        .map((entry) => [entry.id, entry.analysis])
    );

    return picks.map((pick) => {
      const enhanced = lookup.get(pick.id);
      if (typeof enhanced === "string" && enhanced.trim().length > 0) {
        return { ...pick, analysis: enhanced.trim() };
      }
      return pick;
    });
  } catch (error) {
    console.error("Gemini generation failed", error);
    return picks;
  }
}
