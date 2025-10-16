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

function formatSlateSummary(summaries) {
  if (!summaries || typeof summaries !== "object") {
    return "SLATE SUMMARY indisponible";
  }

  const lines = [];
  for (const [sport, data] of Object.entries(summaries)) {
    if (!data) continue;
    lines.push(
      `${sport}: total=${data.totalListed ?? 0}, confirmés=${data.confirmed ?? 0}, analysés=${data.analysed ?? 0}, candidats=${
        data.candidates ?? 0
      }, picks=${data.selected ?? 0}${data.coverageNote ? ` | ${data.coverageNote}` : ""}`
    );
    if (Array.isArray(data.highProfileExcluded) && data.highProfileExcluded.length > 0) {
      const excluded = data.highProfileExcluded
        .map((item) => `${item.match} (${item.league}) – ${item.reason}`)
        .join(" ; ");
      lines.push(`  High-profile écartés: ${excluded}`);
    }
  }

  if (lines.length === 0) {
    return "SLATE SUMMARY vide";
  }

  return `SLATE SUMMARY\n${lines.join("\n")}`;
}

function buildPrompt(picks, options = {}) {
  const context = options.context ?? {};
  const summaries = options.summaries ?? null;
  const dateLabel = context.dateLabel ?? "date du jour";
  const windowLabel = context.windowLabel ?? "00:00 → 23:59 Europe/Brussels";
  const fallbackInfo = options.fallback ? "Mode fallback (données internes)" : "Mode live";

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

      if (pick.marketRange?.min && pick.marketRange?.max) {
        lines.push(`   cote_marche_plage: ${pick.marketRange.min}-${pick.marketRange.max}`);
      }

      if (Array.isArray(pick.marketProviders) && pick.marketProviders.length > 0) {
        lines.push(`   books: ${pick.marketProviders.join(", ")}`);
      }

      if (Number.isFinite(pick.edge)) {
        lines.push(`   edge_pct: ${pick.edge}`);
      }

      if (Array.isArray(pick.signals) && pick.signals.length > 0) {
        lines.push(`   signaux: ${pick.signals.join(", ")}`);
      }

      if (Array.isArray(pick.flags) && pick.flags.length > 0) {
        lines.push(`   drapeaux: ${pick.flags.join(", ")}`);
      }

      if (pick.context) {
        lines.push(`   contexte: ${pick.context}`);
      }

      return lines.join("\n");
    })
    .join("\n\n");

  return [
    "🎯 Prompt maître — Safe+ V2 (High-Win) — Anti-Miss & Couverture",
    "Date & fuseau",
    `Travailler uniquement sur le ${dateLabel} (Europe/Brussels).`,
    `Fenêtre de capture : ${windowLabel} + balayage ±6h (pour attraper les décalages d’agrégateurs).`,
    "Afficher toutes les heures en Europe/Brussels.",
    "0) Slate Builder (obligatoire, avant tout pick)",
    formatSlateSummary(summaries),
    "1) Périmètre & marchés autorisés",
    "3 Football / 3 Tennis / 3 Basket max. Ne jamais combler si critères non remplis.",
    "Cotes autorisées : 1.40 → 2.20 (préférence 1.50 → 1.95).",
    "Un seul pick par match. Foot : DC/DNB/Over1.5/Under3.5/BTTS. Tennis : Vainqueur/+1.5 sets/Over jeux. Basket : ML/Handicap+/Totaux pace stable.",
    "2) Line shopping & calculs (anti-erreurs)",
    "≥3 books/agrégateurs, cote médiane, dispersion >8% => ⚠️ re-check. Edge minimum : Foot ≥8% | Tennis ≥10% | Basket ≥8%.",
    "3) Double validation (évite faux négatifs)",
    "Exiger 2 signaux indépendants selon le sport. Si un signal manque -> match analysé mais écarté (mentionne-le).",
    "4) Garde-fous No-Play", 
    "Respecter les garde-fous décrits (BTTS xG, blessés clés, B2B, etc.).",
    `Mode : ${fallbackInfo}.`,
    "Consignes rédactionnelles",
    "- Analyse courte (2-3 phrases) en français, factuelle, sans promesse de gain.",
    "- Mentionne les signaux déclenchés (forme, xG proxy, Elo, pace...) et compare notre edge à la probabilité implicite.",
    "- Si re-check, rappelle la raison (dispersion).",
    "- Avertis si le pick se situe limite de plage de cote autorisée.",
    "- Pas de langage agressif ni sensationnaliste.",
    "Sortie JSON stricte : {\"picks\": [{\"id\": \"<id>\", \"analysis\": \"<texte>\"}]}",
    "Matches :",
    fixtures,
  ].join("\n\n");
}

async function callGeminiAPI(picks, options) {
  const apiKey = typeof process.env.GEMINI_API_KEY === "string" ? process.env.GEMINI_API_KEY.trim() : "";
  if (!apiKey) {
    return null;
  }

  const prompt = buildPrompt(picks, options);

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

export async function generateAnalysesWithGemini(picks, options = {}) {
  try {
    const result = await callGeminiAPI(picks, options);
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
