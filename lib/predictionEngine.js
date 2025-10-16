import { generateAnalysesWithGemini } from "./geminiClient";

const ESPN_BASE_URL = "https://site.api.espn.com/apis/site/v2/sports";
const DATE_OFFSETS = [0, 1, 2, 3];

const SPORT_CONFIG = {
  Football: {
    endpoints: [
      "soccer/eng.1",
      "soccer/esp.1",
      "soccer/ita.1",
      "soccer/fra.1",
      "soccer/ger.1",
      "soccer/uefa.champions",
    ],
    market: "1X2",
    homeAdvantage: 0.1,
    diffMultiplier: 4,
  },
  Tennis: {
    endpoints: ["tennis/atp", "tennis/wta"],
    market: "Vainqueur du match",
    homeAdvantage: 0,
    diffMultiplier: 3,
  },
  Basket: {
    endpoints: ["basketball/nba", "basketball/euroleague"],
    market: "Moneyline",
    homeAdvantage: 0.06,
    diffMultiplier: 3.4,
  },
};

const FALLBACK_BLUEPRINTS = [
  {
    id: "fallback-foot-1",
    sport: "Football",
    league: "Premier League",
    kickoffOffsetHours: 26,
    home: { name: "Manchester City", attackRating: 92, defenseRating: 89, form: [3, 3, 3, 1, 3] },
    away: { name: "Arsenal", attackRating: 88, defenseRating: 87, form: [3, 3, 1, 3, 3] },
    market: "1X2",
    preferred: "home",
    angle: "City conserve un léger avantage à domicile avec une attaque toujours aussi productive.",
  },
  {
    id: "fallback-foot-2",
    sport: "Football",
    league: "Liga",
    kickoffOffsetHours: 32,
    home: { name: "Real Madrid", attackRating: 91, defenseRating: 90, form: [3, 3, 1, 3, 3] },
    away: { name: "Real Sociedad", attackRating: 83, defenseRating: 84, form: [1, 3, 0, 1, 3] },
    market: "1X2",
    preferred: "home",
    angle: "Madrid domine la Liga et arrive reposé après la rotation en coupe.",
  },
  {
    id: "fallback-foot-3",
    sport: "Football",
    league: "Serie A",
    kickoffOffsetHours: 44,
    home: { name: "Inter Milan", attackRating: 90, defenseRating: 91, form: [3, 3, 3, 3, 0] },
    away: { name: "Bologna", attackRating: 79, defenseRating: 82, form: [1, 3, 0, 3, 1] },
    market: "Handicap -1",
    preferred: "home",
    angle: "Inter déroule à domicile, Bologna souffre face aux blocs hauts.",
  },
  {
    id: "fallback-tennis-1",
    sport: "Tennis",
    league: "ATP 500",
    kickoffOffsetHours: 20,
    home: { name: "Carlos Alcaraz", holdPct: 86, breakPct: 31, elo: 2155 },
    away: { name: "Jannik Sinner", holdPct: 84, breakPct: 28, elo: 2095 },
    market: "Vainqueur du match",
    preferred: "home",
    angle: "Alcaraz possède un léger avantage dans les rallies longs sur dur rapide.",
  },
  {
    id: "fallback-tennis-2",
    sport: "Tennis",
    league: "WTA 1000",
    kickoffOffsetHours: 28,
    home: { name: "Iga Swiatek", holdPct: 78, breakPct: 49, elo: 2090 },
    away: { name: "Jessica Pegula", holdPct: 74, breakPct: 36, elo: 1960 },
    market: "Vainqueur du match",
    preferred: "home",
    angle: "Swiatek domine Pegula dans les échanges croisés et retourne mieux.",
  },
  {
    id: "fallback-tennis-3",
    sport: "Tennis",
    league: "ATP Challenger",
    kickoffOffsetHours: 18,
    home: { name: "Arthur Fils", holdPct: 83, breakPct: 24, elo: 1825 },
    away: { name: "Jack Draper", holdPct: 80, breakPct: 22, elo: 1885 },
    market: "Total jeux - Over/Under",
    preferred: "over",
    angle: "Deux gros serveurs indoor, peu de breaks attendus dans ce duel.",
  },
  {
    id: "fallback-basket-1",
    sport: "Basket",
    league: "NBA",
    kickoffOffsetHours: 34,
    home: { name: "Boston Celtics", offensiveRating: 119, defensiveRating: 110, pace: 98, recent: [1, 1, 1, 1, 0] },
    away: { name: "Miami Heat", offensiveRating: 112, defensiveRating: 111, pace: 96, recent: [0, 1, 0, 1, 1] },
    market: "Vainqueur",
    preferred: "home",
    angle: "Boston solide à domicile, Heat en back-to-back avec rotation courte.",
  },
  {
    id: "fallback-basket-2",
    sport: "Basket",
    league: "EuroLeague",
    kickoffOffsetHours: 48,
    home: { name: "Barcelone", offensiveRating: 113, defensiveRating: 106, pace: 95, recent: [1, 1, 1, 0, 1] },
    away: { name: "Fenerbahçe", offensiveRating: 111, defensiveRating: 108, pace: 94, recent: [1, 0, 1, 1, 0] },
    market: "Handicap -4.5",
    preferred: "home",
    angle: "Le Barça domine au rebond et profite du retour de Vesely.",
  },
  {
    id: "fallback-basket-3",
    sport: "Basket",
    league: "Betclic Élite",
    kickoffOffsetHours: 30,
    home: { name: "ASVEL", offensiveRating: 108, defensiveRating: 104, pace: 97, recent: [1, 1, 0, 1, 1] },
    away: { name: "Paris Basketball", offensiveRating: 110, defensiveRating: 107, pace: 99, recent: [1, 1, 1, 0, 0] },
    market: "Total points",
    preferred: "over",
    angle: "Deux équipes rapides, Paris accélère en transition contre les gros.",
  },
];

function addDaysUTC(base, days) {
  const copy = new Date(base);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function addHours(base, hours) {
  return new Date(base.getTime() + hours * 60 * 60 * 1000);
}

function formatDateForScoreboard(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

async function fetchScoreboard(path, dateString) {
  const url = `${ESPN_BASE_URL}/${path}/scoreboard?dates=${dateString}&limit=200`;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), 4000) : null;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "PronoAI/1.0" },
      signal: controller?.signal,
    });

    if (!response.ok) {
      throw new Error(`Scoreboard ${path} responded ${response.status}`);
    }

    return await response.json();
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function extractUpcomingEvents(scoreboard, now) {
  const events = Array.isArray(scoreboard?.events) ? scoreboard.events : [];
  return events
    .filter((event) => {
      const eventDate = new Date(event?.date ?? event?.startDate ?? 0);
      if (Number.isNaN(eventDate.getTime())) {
        return false;
      }
      if (eventDate.getTime() < now.getTime() - 5 * 60 * 1000) {
        return false;
      }
      const competition = event?.competitions?.[0];
      const state = competition?.status?.type?.state ?? event?.status?.type?.state;
      if (typeof state === "string" && state.toLowerCase() !== "pre") {
        return false;
      }
      return true;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function getCompetitorName(competitor) {
  return (
    competitor?.team?.displayName ??
    competitor?.athlete?.displayName ??
    competitor?.displayName ??
    competitor?.shortDisplayName ??
    "Équipe"
  );
}

function getRecordSummary(competitor) {
  if (!competitor?.records) return null;
  const candidates = competitor.records.filter((record) => typeof record?.summary === "string");
  const prioritized =
    candidates.find((record) => record.type === "total" || record.type === "overall") ??
    candidates.find((record) => /overall/i.test(record?.name ?? "")) ??
    candidates.find((record) => /season/i.test(record?.name ?? "")) ??
    candidates[0];
  return prioritized?.summary ?? null;
}

function computeWinPct(summary) {
  if (typeof summary !== "string") return 0.5;
  const clean = summary.replace(/[^0-9-]/g, "");
  const parts = clean.split("-").map((value) => Number.parseInt(value, 10));
  if (parts.every((value) => Number.isNaN(value))) {
    return 0.5;
  }
  const wins = parts[0] ?? 0;
  const losses = parts[1] ?? 0;
  const draws = parts[2] ?? 0;
  const total = wins + losses + draws;
  if (!total) {
    return 0.5;
  }
  return (wins + draws * 0.5) / total;
}

function getRankValue(competitor) {
  const sources = [competitor?.seed, competitor?.rank, competitor?.curatedRank?.current];
  for (const source of sources) {
    if (typeof source === "number" && Number.isFinite(source) && source > 0) {
      return source;
    }
    if (typeof source === "string") {
      const parsed = Number.parseInt(source, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }
  return null;
}

function computeRankBoost(rank, sport) {
  if (!Number.isFinite(rank) || rank <= 0) {
    return 0;
  }
  const cap = sport === "Tennis" ? 80 : 50;
  const normalized = (cap - Math.min(rank, cap)) / cap;
  return normalized * 0.15;
}

function getFormString(competitor) {
  if (typeof competitor?.form === "string" && competitor.form.trim().length > 0) {
    return competitor.form;
  }
  if (typeof competitor?.streak?.summary === "string") {
    return competitor.streak.summary;
  }
  if (typeof competitor?.streak?.displayValue === "string") {
    return competitor.streak.displayValue;
  }
  const last10 = competitor?.records?.find((record) =>
    typeof record?.name === "string" && /last ?10/i.test(record.name)
  );
  if (last10?.summary) {
    return last10.summary;
  }
  return null;
}

function computeFormBoost(form) {
  if (typeof form !== "string" || form.trim().length === 0) {
    return 0;
  }
  const cleaned = form.replace(/[^A-Za-z]/g, "").toUpperCase();
  if (cleaned.length === 0) {
    return 0;
  }
  const map = { W: 1, V: 1, L: 0, D: 0.5, N: 0.5, T: 0.5 };
  let total = 0;
  let count = 0;
  for (const char of cleaned.split("")) {
    if (map[char] !== undefined) {
      total += map[char];
      count += 1;
    }
  }
  if (count === 0) {
    return 0;
  }
  const average = total / count;
  return (average - 0.5) * 0.4;
}

function formatFormFrench(form) {
  if (typeof form !== "string" || form.trim().length === 0) {
    return null;
  }
  const cleaned = form.replace(/[^A-Za-z]/g, "").toUpperCase();
  if (cleaned.length === 0) {
    return null;
  }
  const map = { W: "V", V: "V", L: "D", D: "N", N: "N", T: "N" };
  const translated = cleaned
    .split("")
    .map((char) => map[char] ?? char)
    .join("-");
  return translated;
}

function computeStrength(competitor, sport) {
  const recordSummary = getRecordSummary(competitor);
  const winPct = computeWinPct(recordSummary);
  const formString = getFormString(competitor);
  const formBoost = computeFormBoost(formString);
  const rank = getRankValue(competitor);
  const rankBoost = computeRankBoost(rank, sport);
  const strength = winPct + formBoost + rankBoost;
  return clamp(strength, 0.2, 0.95);
}

function logistic(value) {
  return 1 / (1 + Math.exp(-value));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function describeRecord(summary) {
  if (typeof summary !== "string" || summary.trim().length === 0) {
    return null;
  }
  const clean = summary.replace(/[^0-9-]/g, "");
  if (clean.length === 0) {
    return null;
  }
  return `un bilan de ${clean}`;
}

function buildDynamicPick(event, sport, market) {
  const competition = event?.competitions?.[0];
  if (!competition) {
    return null;
  }
  const competitors = Array.isArray(competition.competitors) ? competition.competitors : [];
  if (competitors.length < 2) {
    return null;
  }

  const home =
    competitors.find((competitor) => competitor?.homeAway === "home") ??
    competitors[0];
  const away =
    competitors.find((competitor) => competitor?.homeAway === "away") ??
    competitors[1];
  if (!home || !away) {
    return null;
  }

  const homeName = getCompetitorName(home);
  const awayName = getCompetitorName(away);
  const config = SPORT_CONFIG[sport] ?? {};
  const leagueName =
    competition?.tournament?.displayName ??
    event?.leagues?.[0]?.name ??
    event?.leagues?.[0]?.shortName ??
    event?.name ??
    sport;

  const kickoffDate = new Date(competition?.date ?? event?.date ?? Date.now());
  const kickoffISO = Number.isNaN(kickoffDate.getTime()) ? new Date().toISOString() : kickoffDate.toISOString();

  const homeStrength = computeStrength(home, sport);
  const awayStrength = computeStrength(away, sport);
  const diffMultiplier = config.diffMultiplier ?? 3;
  const homeAdvantage = config.homeAdvantage ?? 0;

  const baseProbability = logistic((homeStrength - awayStrength + homeAdvantage) * diffMultiplier);
  let adjustedProbability = clamp(baseProbability, 0.38, 0.82);
  let side = "home";
  if (adjustedProbability < 0.5) {
    side = "away";
    adjustedProbability = clamp(1 - adjustedProbability, 0.52, 0.82);
  } else {
    adjustedProbability = clamp(adjustedProbability, 0.52, 0.82);
  }

  const pickCompetitor = side === "home" ? home : away;
  const opponentCompetitor = side === "home" ? away : home;
  const pickName = side === "home" ? homeName : awayName;
  const opponentName = side === "home" ? awayName : homeName;

  const confidence = Math.round(adjustedProbability * 100);
  const odds = Number((1 / adjustedProbability).toFixed(2));

  const pickRecord = getRecordSummary(pickCompetitor);
  const opponentRecord = getRecordSummary(opponentCompetitor);
  const pickForm = formatFormFrench(getFormString(pickCompetitor));
  const opponentForm = formatFormFrench(getFormString(opponentCompetitor));

  const analysisParts = [];
  if (pickRecord) {
    analysisParts.push(`${pickName} affiche ${describeRecord(pickRecord)}.`);
  }
  if (pickForm) {
    analysisParts.push(`Série récente : ${pickForm}.`);
  }
  if (opponentRecord || opponentForm) {
    const opponentBits = [];
    if (opponentRecord) {
      opponentBits.push(`${opponentName} est à ${describeRecord(opponentRecord)}`);
    }
    if (opponentForm) {
      opponentBits.push(`(${opponentForm})`);
    }
    if (opponentBits.length > 0) {
      analysisParts.push(`${opponentBits.join(" ")}.`);
    }
  }
  analysisParts.push(`Avantage estimé à ${confidence}%.`);
  const analysis = analysisParts.join(" ").replace(/\.\./g, ".");

  const venue = competition?.venue?.fullName ?? null;
  const contextPieces = [];
  if (venue) {
    contextPieces.push(`Lieu: ${venue}`);
  }
  const homeRecord = getRecordSummary(home);
  const awayRecord = getRecordSummary(away);
  if (homeRecord || awayRecord) {
    contextPieces.push(`${homeName} ${homeRecord ?? "?"} vs ${awayName} ${awayRecord ?? "?"}`);
  }
  const context = contextPieces.length > 0 ? contextPieces.join(" | ") : null;

  const idBase = event?.id ?? competition?.id ?? `${sport}-${homeName}-${awayName}`;

  return {
    id: String(idBase),
    sport,
    league: leagueName,
    kickoffISO,
    match: `${homeName} vs ${awayName}`,
    market: market ?? "Vainqueur",
    pick: `Victoire ${pickName}`,
    confidence,
    odds,
    analysis: analysis || `Notre modèle donne ${confidence}% de chances à ${pickName}.`,
    context,
    analysisSource: "internal-live",
    analysisModel: "live-rule-engine",
  };
}

async function collectPicksForSport(sport, limit, now) {
  const config = SPORT_CONFIG[sport];
  if (!config) {
    return [];
  }

  const picks = [];
  const seen = new Set();

  for (const offset of DATE_OFFSETS) {
    const dateString = formatDateForScoreboard(addDaysUTC(now, offset));
    const scoreboards = await Promise.all(
      config.endpoints.map(async (endpoint) => {
        try {
          return await fetchScoreboard(endpoint, dateString);
        } catch (error) {
          console.error(`Scoreboard fetch failed for ${endpoint} (${dateString})`, error);
          return null;
        }
      })
    );

    for (const scoreboard of scoreboards) {
      if (!scoreboard) {
        continue;
      }
      const events = extractUpcomingEvents(scoreboard, now);
      for (const event of events) {
        if (!event || seen.has(event.id ?? event.uid)) {
          continue;
        }
        const pick = buildDynamicPick(event, sport, config.market);
        if (pick) {
          picks.push(pick);
          seen.add(event.id ?? event.uid);
          if (picks.length >= limit) {
            return picks.slice(0, limit);
          }
        }
      }
    }
  }

  return picks.slice(0, limit);
}

function normalize(value, min, max) {
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}

function rollingScore(entries) {
  const max = 3 * entries.length;
  const total = entries.reduce((acc, v) => acc + v, 0);
  return total / max;
}

function probabilityFromDiff(diff) {
  const capped = Math.max(Math.min(diff, 40), -40);
  const logisticValue = 1 / (1 + Math.exp(-capped / 6));
  return logisticValue;
}

function toOdds(prob) {
  const decimal = 1 / Math.max(prob, 0.01);
  return Number(decimal.toFixed(2));
}

function describeFootball(match, probability) {
  const { home, away, angle } = match;
  const favorite = match.preferred === "home" ? home : away;
  const outsider = match.preferred === "home" ? away : home;
  const percent = Math.round(probability * 100);
  return `${favorite.name} profite de ${angle} Probabilité estimée à ${percent}%. ${outsider.name} montre des signes de fatigue récemment.`;
}

function describeTennis(match, probability) {
  const { home, away, angle } = match;
  const percent = Math.round(probability * 100);
  if (match.preferred === "over") {
    return `Le scénario over s'impose : ${angle} La probabilité que l'on dépasse la ligne est estimée à ${percent}%.`;
  }
  const favorite = match.preferred === "home" ? home : away;
  const outsider = match.preferred === "home" ? away : home;
  return `${favorite.name} part avec l'avantage. ${angle} Probabilité estimée à ${percent}%. ${outsider.name} devra hausser son pourcentage au service.`;
}

function describeBasket(match, probability) {
  const { home, away, angle } = match;
  const percent = Math.round(probability * 100);
  if (match.preferred === "over") {
    return `Pace élevé attendu : ${angle} Probabilité d'un total supérieur estimée à ${percent}%.`;
  }
  const favorite = match.preferred === "home" ? home : away;
  const outsider = match.preferred === "home" ? away : home;
  return `${favorite.name} possède un edge sur 48 minutes. ${angle} Probabilité estimée à ${percent}%. ${outsider.name} souffre défensivement sur les dernières sorties.`;
}

function buildFallbackAnalysis(match, probability) {
  if (match.sport === "Football") {
    return describeFootball(match, probability);
  }
  if (match.sport === "Tennis") {
    return describeTennis(match, probability);
  }
  return describeBasket(match, probability);
}

function computeFallbackProbability(match) {
  if (match.sport === "Football") {
    const homeScore =
      match.home.attackRating * 0.6 +
      match.home.defenseRating * 0.4 +
      rollingScore(match.home.form) * 100;
    const awayScore =
      match.away.attackRating * 0.6 +
      match.away.defenseRating * 0.4 +
      rollingScore(match.away.form) * 100;
    const diff = homeScore - awayScore;
    const rawProb = probabilityFromDiff(diff / 2);
    return match.preferred === "home" ? rawProb : 1 - rawProb;
  }

  if (match.sport === "Tennis") {
    if (match.preferred === "over") {
      const holdAvg = (match.home.holdPct + match.away.holdPct) / 2;
      const tieBreakFactor = normalize(holdAvg, 70, 90);
      const eloClose = 1 - Math.min(Math.abs(match.home.elo - match.away.elo) / 400, 1);
      return Math.min(0.85, 0.55 + tieBreakFactor * 0.3 + eloClose * 0.1);
    }
    const favorite = match.preferred === "home" ? match.home : match.away;
    const outsider = match.preferred === "home" ? match.away : match.home;
    const serviceEdge = normalize(favorite.holdPct - outsider.holdPct, -10, 10);
    const breakEdge = normalize(favorite.breakPct - outsider.breakPct, -15, 15);
    const eloEdge = normalize(favorite.elo - outsider.elo, -200, 200);
    return Math.min(0.9, 0.45 + serviceEdge * 0.25 + breakEdge * 0.2 + eloEdge * 0.25);
  }

  if (match.preferred === "over") {
    const pace = (match.home.pace + match.away.pace) / 2;
    const offense = (match.home.offensiveRating + match.away.offensiveRating) / 2;
    const defense = (match.home.defensiveRating + match.away.defensiveRating) / 2;
    const paceFactor = normalize(pace, 92, 102);
    const offenseFactor = normalize(offense - defense, -15, 15);
    return Math.min(0.85, 0.52 + paceFactor * 0.2 + offenseFactor * 0.25);
  }
  const favorite = match.preferred === "home" ? match.home : match.away;
  const outsider = match.preferred === "home" ? match.away : match.home;
  const offenseEdge = normalize(favorite.offensiveRating - outsider.offensiveRating, -15, 15);
  const defenseEdge = normalize(outsider.defensiveRating - favorite.defensiveRating, -15, 15);
  const recentEdge = normalize(rollingScore(favorite.recent) - rollingScore(outsider.recent), -0.5, 0.5);
  return Math.min(0.88, 0.48 + offenseEdge * 0.2 + defenseEdge * 0.2 + recentEdge * 0.2);
}

function buildFallbackPick(match, now) {
  const kickoffISO = addHours(now, match.kickoffOffsetHours).toISOString();
  const probability = computeFallbackProbability(match);
  const odds = toOdds(probability);
  const pickLabel = (() => {
    if (match.preferred === "home") return `${match.home.name} gagne`;
    if (match.preferred === "away") return `${match.away.name} gagne`;
    if (match.preferred === "over") return "Over recommandé";
    if (match.preferred === "under") return "Under recommandé";
    return match.preferred;
  })();

  return {
    id: match.id,
    sport: match.sport,
    league: match.league,
    kickoffISO,
    match: `${match.home.name} vs ${match.away.name}`,
    market: match.market,
    pick: pickLabel,
    confidence: Math.round(probability * 100),
    odds,
    analysis: buildFallbackAnalysis(match, probability),
    context: match.angle,
    analysisSource: "fallback",
    analysisModel: "rule-engine",
  };
}

function buildFallbackLibrary(now) {
  const store = new Map();
  for (const match of FALLBACK_BLUEPRINTS) {
    const pick = buildFallbackPick(match, now);
    if (!store.has(match.sport)) {
      store.set(match.sport, []);
    }
    store.get(match.sport).push(pick);
  }
  return store;
}

async function buildLivePicks(now) {
  const entries = await Promise.all([
    collectPicksForSport("Football", 3, now),
    collectPicksForSport("Tennis", 3, now),
    collectPicksForSport("Basket", 3, now),
  ]);

  return {
    Football: entries[0] ?? [],
    Tennis: entries[1] ?? [],
    Basket: entries[2] ?? [],
  };
}

function mergeDynamicWithFallback(dynamicBySport, fallbackBySport) {
  const combined = [];
  for (const sport of Object.keys(SPORT_CONFIG)) {
    const live = Array.isArray(dynamicBySport[sport]) ? [...dynamicBySport[sport]] : [];
    const fallback = fallbackBySport.get(sport) ?? [];
    const needed = Math.max(0, 3 - live.length);
    if (needed > 0) {
      live.push(...fallback.slice(0, needed));
    }
    combined.push(...live.slice(0, 3));
  }

  if (combined.length < 9) {
    for (const picks of fallbackBySport.values()) {
      for (const pick of picks) {
        if (combined.length >= 9) {
          break;
        }
        if (!combined.some((entry) => entry.id === pick.id)) {
          combined.push(pick);
        }
      }
      if (combined.length >= 9) {
        break;
      }
    }
  }

  return combined.slice(0, 9);
}

export async function generateAutoPicks() {
  const now = new Date();
  const fallbackBySport = buildFallbackLibrary(now);

  try {
    const liveBySport = await buildLivePicks(now);
    const merged = mergeDynamicWithFallback(liveBySport, fallbackBySport);
    if (merged.length === 0) {
      throw new Error("Aucun pronostic généré");
    }
    return generateAnalysesWithGemini(merged);
  } catch (error) {
    console.error("Dynamic pick generation failed", error);
    const fallback = Array.from(fallbackBySport.values()).flat().slice(0, 9);
    return generateAnalysesWithGemini(fallback);
  }
}
