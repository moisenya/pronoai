import { generateAnalysesWithGemini } from "./geminiClient.js";

const ESPN_BASE_URL = "https://site.api.espn.com/apis/site/v2/sports";
const SOFASCORE_BASE_URL = "https://api.sofascore.com/api/v1";
const BRUSSELS_TIMEZONE = "Europe/Brussels";
const SLATE_BUFFER_HOURS = 6;
const DATE_OFFSETS = [-1, 0, 1];
const MAX_LOOKAHEAD_HOURS = 96;
const MIN_DECIMAL_ODDS = 1.4;
const MAX_DECIMAL_ODDS = 2.2;
const MIN_BOOKS_REQUIRED = 3;
const DISPERSION_THRESHOLD = 0.08;
const EDGE_THRESHOLDS = {
  Football: 0.08,
  Tennis: 0.1,
  Basket: 0.08,
};
const CONFIRMATION_TOLERANCE_MINUTES = 10;

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

const SOFASCORE_SPORT_PATH = {
  Football: "sport/football",
  Tennis: "sport/tennis",
  Basket: "sport/basketball",
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

function getTimezoneOffsetMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).formatToParts(date);

  const tzName = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  const match = tzName.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (match) {
    const sign = match[1] === "-" ? -1 : 1;
    const hours = Number.parseInt(match[2], 10) || 0;
    const minutes = Number.parseInt(match[3] ?? "0", 10) || 0;
    return sign * (hours * 60 + minutes);
  }

  // Fallback by comparing locale time to UTC
  const utc = Date.UTC(
    Number(parts.find((part) => part.type === "year")?.value ?? date.getUTCFullYear()),
    Number(parts.find((part) => part.type === "month")?.value ?? date.getUTCMonth() + 1) - 1,
    Number(parts.find((part) => part.type === "day")?.value ?? date.getUTCDate()),
    Number(parts.find((part) => part.type === "hour")?.value ?? date.getUTCHours()),
    Number(parts.find((part) => part.type === "minute")?.value ?? date.getUTCMinutes()),
    Number(parts.find((part) => part.type === "second")?.value ?? date.getUTCSeconds())
  );
  return Math.round((utc - date.getTime()) / (60 * 1000));
}

function getBrusselsContext(now = new Date()) {
  const offsetMinutes = getTimezoneOffsetMinutes(now, BRUSSELS_TIMEZONE);

  const brusselsFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRUSSELS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const [yearStr, monthStr, dayStr] = brusselsFormatter
    .format(now)
    .split("-");

  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);

  const midnightUTC = Date.UTC(year, month - 1, day, 0, 0, 0);
  const windowStart = new Date(midnightUTC - offsetMinutes * 60 * 1000 - SLATE_BUFFER_HOURS * 60 * 60 * 1000);
  const windowEnd = new Date(
    Date.UTC(year, month - 1, day, 23, 59, 59) - offsetMinutes * 60 * 1000 + SLATE_BUFFER_HOURS * 60 * 60 * 1000
  );

  const dateLabel = new Intl.DateTimeFormat("fr-FR", {
    timeZone: BRUSSELS_TIMEZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "2-digit",
  }).format(now);

  const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
    timeZone: BRUSSELS_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return {
    windowStart,
    windowEnd,
    offsetMinutes,
    dateLabel,
    dateISO: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    windowLabel: `${timeFormatter.format(windowStart)} → ${timeFormatter.format(windowEnd)}`,
  };
}

function formatDateForSofa(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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

async function fetchSofaScoreSchedule(path, dateString) {
  const url = `${SOFASCORE_BASE_URL}/${path}/scheduled-events/${dateString}`;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), 4000) : null;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "PronoAI/1.0" },
      signal: controller?.signal,
    });
    if (!response.ok) {
      throw new Error(`Sofascore ${path} responded ${response.status}`);
    }
    return await response.json();
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function normalizeLabel(label) {
  if (typeof label !== "string" || label.trim().length === 0) {
    return "";
  }
  return label
    .normalize("NFD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "")
    .toLowerCase();
}

function normalizedMatchKey(league, home, away) {
  return `${normalizeLabel(league)}::${normalizeLabel(home)}::${normalizeLabel(away)}`;
}

function buildSlateKey(home, away, date) {
  const base = `${normalizeLabel(home)}::${normalizeLabel(away)}`;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return base;
  }
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  return `${base}::${year}-${month}-${day}T${hour}`;
}

function normalizeSofaEvent(event, sport) {
  if (!event) return null;
  const home = event.homeTeam?.name ?? event.homeCompetitor?.name ?? null;
  const away = event.awayTeam?.name ?? event.awayCompetitor?.name ?? null;
  if (!home || !away) {
    return null;
  }
  const tournament = event.tournament?.name ?? event.tournament?.uniqueTournament?.name ?? sport;
  const timestampRaw = event.startTimestamp ?? event.startTime ?? event.startTimeUTC;
  const timestamp = Number.isFinite(timestampRaw)
    ? timestampRaw
    : Number.parseInt(timestampRaw, 10) || Number.parseInt(event.startTimestamp, 10) || Number.parseInt(event.startTime, 10);
  if (!timestamp) {
    return null;
  }
  const date = new Date(timestamp * (timestamp > 1e12 ? 1 : 1000));
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return {
    id: `sofa-${event.id ?? normalizedMatchKey(tournament, home, away)}`,
    sport,
    league: tournament,
    home,
    away,
    start: date,
  };
}

function leagueImportance(league) {
  if (typeof league !== "string") {
    return 0;
  }
  const lower = league.toLowerCase();
  if (/(champions league|europa league|euroleague|nba|roland garros|wimbledon)/i.test(lower)) {
    return 5;
  }
  if (/(premier league|liga|serie a|bundesliga|ligue 1|atp|wta|masters|grand slam)/i.test(lower)) {
    return 4;
  }
  if (/(europa|conference|laliga|ligab|betclic|lba|wnba|challenger)/i.test(lower)) {
    return 3;
  }
  return 1;
}

function pushHighProfileExclusion(list, match, reason) {
  if (!match) {
    return;
  }
  const entry = {
    match: `${match.home} vs ${match.away}`,
    league: match.league,
    reason,
    importance: match.importance ?? leagueImportance(match.league),
  };
  list.push(entry);
  list.sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0));
  if (list.length > 10) {
    list.length = 10;
  }
}

function extractUpcomingEvents(scoreboard, now) {
  const events = Array.isArray(scoreboard?.events) ? scoreboard.events : [];
  const maxDate = addHours(now, MAX_LOOKAHEAD_HOURS);
  return events
    .filter((event) => {
      const eventDate = new Date(event?.date ?? event?.startDate ?? 0);
      if (Number.isNaN(eventDate.getTime())) {
        return false;
      }
      if (eventDate.getTime() < now.getTime() - 5 * 60 * 1000) {
        return false;
      }
      if (eventDate.getTime() > maxDate.getTime()) {
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

function withinWindow(date, start, end) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return false;
  }
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

function minutesBetween(dateA, dateB) {
  if (!(dateA instanceof Date) || !(dateB instanceof Date)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.abs(dateA.getTime() - dateB.getTime()) / (60 * 1000);
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

function americanToDecimal(raw) {
  if (raw === null || raw === undefined) {
    return null;
  }
  const parsed = typeof raw === "string" ? Number.parseFloat(raw) : raw;
  if (!Number.isFinite(parsed) || parsed === 0) {
    return null;
  }
  if (parsed > 0) {
    return 1 + parsed / 100;
  }
  return 1 + 100 / Math.abs(parsed);
}

function parseDecimalOdds(teamOdds) {
  if (!teamOdds || typeof teamOdds !== "object") {
    return null;
  }

  const candidates = [
    teamOdds.decimalOdds,
    teamOdds.price?.decimal,
    teamOdds.price?.decimalOdds,
    teamOdds.price,
    teamOdds.odds?.decimal,
  ].filter((value) => Number.isFinite(value));

  if (candidates.length > 0) {
    return candidates[0];
  }

  const americanCandidates = [
    teamOdds.moneyLine,
    teamOdds.american,
    teamOdds.odds?.american,
    teamOdds.price?.american,
  ];

  for (const candidate of americanCandidates) {
    const decimal = americanToDecimal(candidate);
    if (Number.isFinite(decimal)) {
      return decimal;
    }
  }

  return null;
}

function computeDispersion(minValue, maxValue, median) {
  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue) || !Number.isFinite(median) || median === 0) {
    return 0;
  }
  return (maxValue - minValue) / median;
}

function collectMarketSnapshots(competition, side) {
  const oddsList = Array.isArray(competition?.odds) ? competition.odds : [];
  if (oddsList.length === 0) {
    return [];
  }

  const samples = new Map();

  for (const entry of oddsList) {
    if (!entry) continue;
    const provider =
      entry?.provider?.name ??
      entry?.provider?.displayName ??
      entry?.provider?.id ??
      entry?.details ??
      null;

    if (!provider) {
      continue;
    }

    const teamOdds = side === "home" ? entry?.homeTeamOdds : entry?.awayTeamOdds;
    const decimal = parseDecimalOdds(teamOdds);
    if (!Number.isFinite(decimal)) {
      continue;
    }

    const normalizedProvider = provider.trim();
    if (!samples.has(normalizedProvider) || decimal < samples.get(normalizedProvider).decimalOdds) {
      samples.set(normalizedProvider, {
        provider: normalizedProvider,
        decimalOdds: Number(decimal.toFixed(2)),
        detail: entry?.details ?? null,
      });
    }
  }

  return Array.from(samples.values());
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
  const modelOdds = Number((1 / adjustedProbability).toFixed(2));
  const marketSamples = collectMarketSnapshots(competition, side);
  const sortedSamples = [...marketSamples].sort((a, b) => a.decimalOdds - b.decimalOdds);
  const providerCount = sortedSamples.length;
  let marketMedian = null;
  let marketMin = null;
  let marketMax = null;

  if (providerCount > 0) {
    marketMin = sortedSamples[0].decimalOdds;
    marketMax = sortedSamples[providerCount - 1].decimalOdds;
    if (providerCount % 2 === 1) {
      marketMedian = sortedSamples[(providerCount - 1) / 2].decimalOdds;
    } else {
      const mid1 = sortedSamples[providerCount / 2 - 1].decimalOdds;
      const mid2 = sortedSamples[providerCount / 2].decimalOdds;
      marketMedian = Number(((mid1 + mid2) / 2).toFixed(2));
    }
  }

  const marketProbability =
    marketMedian && marketMedian > 1 ? Math.round((1 / marketMedian) * 100) : null;
  const dispersion =
    providerCount > 1 && Number.isFinite(marketMedian)
      ? Number(computeDispersion(marketMin, marketMax, marketMedian).toFixed(4))
      : 0;

  const pickRecord = getRecordSummary(pickCompetitor);
  const opponentRecord = getRecordSummary(opponentCompetitor);
  const pickForm = formatFormFrench(getFormString(pickCompetitor));
  const opponentForm = formatFormFrench(getFormString(opponentCompetitor));
  const pickRank = getRankValue(pickCompetitor);
  const opponentRank = getRankValue(opponentCompetitor);
  const pickStrength = side === "home" ? homeStrength : awayStrength;
  const opponentStrength = side === "home" ? awayStrength : homeStrength;
  const strengthDiff = Math.round((pickStrength - opponentStrength) * 100);

  const analysisParts = [];
  analysisParts.push(
    `${pickName} obtient ${confidence}% de chances selon notre modèle (cote théorique ${modelOdds.toFixed(2)}).`
  );
  if (providerCount > 0 && Number.isFinite(marketMedian)) {
    const minLabel = Number.isFinite(marketMin) ? marketMin.toFixed(2) : "-";
    const maxLabel = Number.isFinite(marketMax) ? marketMax.toFixed(2) : "-";
    analysisParts.push(
      `Panel ${providerCount} books : médiane ${marketMedian.toFixed(2)} (min ${minLabel} / max ${maxLabel})${
        marketProbability ? ` ~${marketProbability}%` : ""
      }.`
    );
  }
  if (pickRecord) {
    analysisParts.push(`${pickName} affiche ${describeRecord(pickRecord)}.`);
  }
  if (pickRank || opponentRank) {
    if (pickRank && opponentRank) {
      analysisParts.push(`Classement: ${pickRank} contre ${opponentRank} pour ${opponentName}.`);
    } else if (pickRank) {
      analysisParts.push(`${pickName} est classé(e) ${pickRank}.`);
    }
  }
  if (pickForm) {
    analysisParts.push(`Série récente : ${pickForm}.`);
  }
  if (Number.isFinite(strengthDiff) && Math.abs(strengthDiff) > 3) {
    analysisParts.push(
      `Indice interne: ${pickName} possède ${Math.abs(strengthDiff)} points de forme ${
        strengthDiff >= 0 ? "d'avance" : "de retard"
      } sur ${opponentName}.`
    );
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
    odds: modelOdds,
    marketOdds: marketMedian,
    marketRange: marketMedian ? { min: marketMin, max: marketMax } : null,
    marketProviders: marketSamples.map((sample) => sample.provider),
    marketProvider: marketSamples[0]?.provider ?? null,
    marketDetail: providerCount > 0 ? `${providerCount} books` : null,
    marketImpliedProbability: marketProbability,
    analysis: analysis || `Notre modèle donne ${confidence}% de chances à ${pickName}.`,
    context,
    analysisSource: "internal-live",
    analysisModel: "live-rule-engine",
    marketDispersion: dispersion,
    estimatedProbability: adjustedProbability,
  };
}

async function collectPicksForSport(sport, limit, now, context) {
  const config = SPORT_CONFIG[sport];
  const summary = {
    sport,
    totalListed: 0,
    confirmed: 0,
    analysed: 0,
    candidates: 0,
    selected: 0,
    coverageNote: null,
    highProfileExcluded: [],
  };

  if (!config) {
    return { picks: [], summary };
  }

  const matches = [];
  const seenMatches = new Set();
  const { windowStart, windowEnd } = context;

  for (const offset of DATE_OFFSETS) {
    const targetDate = addDaysUTC(now, offset);
    const dateString = formatDateForScoreboard(targetDate);
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
        const competition = event?.competitions?.[0];
        const kickoffDate = new Date(competition?.date ?? event?.date ?? 0);
        if (!withinWindow(kickoffDate, windowStart, windowEnd)) {
          continue;
        }

        const competitors = Array.isArray(competition?.competitors) ? competition.competitors : [];
        if (competitors.length < 2) {
          continue;
        }

        const home =
          competitors.find((competitor) => competitor?.homeAway === "home") ?? competitors[0];
        const away =
          competitors.find((competitor) => competitor?.homeAway === "away") ?? competitors[1];
        const homeName = getCompetitorName(home);
        const awayName = getCompetitorName(away);
        const leagueName =
          competition?.tournament?.displayName ??
          event?.leagues?.[0]?.name ??
          event?.leagues?.[0]?.shortName ??
          event?.name ??
          sport;

        const slateKey = buildSlateKey(homeName, awayName, kickoffDate);
        if (seenMatches.has(slateKey)) {
          continue;
        }

        seenMatches.add(slateKey);
        matches.push({
          event,
          home,
          away,
          homeName,
          awayName,
          league: leagueName,
          start: kickoffDate,
          slateKey,
          importance: leagueImportance(leagueName),
        });
      }
    }
  }

  summary.totalListed = matches.length;

  const sofaPath = SOFASCORE_SPORT_PATH[sport];
  const sofaFullMap = new Map();
  const sofaTeamsMap = new Map();

  if (sofaPath) {
    for (const offset of DATE_OFFSETS) {
      const dateString = formatDateForSofa(addDaysUTC(now, offset));
      try {
        const payload = await fetchSofaScoreSchedule(sofaPath, dateString);
        const entries = Array.isArray(payload?.events)
          ? payload.events
          : Array.isArray(payload?.sportEvents)
          ? payload.sportEvents
          : Array.isArray(payload?.matches)
          ? payload.matches
          : [];

        for (const entry of entries) {
          const normalized = normalizeSofaEvent(entry, sport);
          if (!normalized) {
            continue;
          }
          if (!withinWindow(normalized.start, windowStart, windowEnd)) {
            continue;
          }
          const fullKey = buildSlateKey(normalized.home, normalized.away, normalized.start);
          if (!sofaFullMap.has(fullKey)) {
            sofaFullMap.set(fullKey, []);
          }
          sofaFullMap.get(fullKey).push(normalized);

          const directKey = `${normalizeLabel(normalized.home)}::${normalizeLabel(normalized.away)}`;
          const reverseKey = `${normalizeLabel(normalized.away)}::${normalizeLabel(normalized.home)}`;
          if (!sofaTeamsMap.has(directKey)) {
            sofaTeamsMap.set(directKey, []);
          }
          sofaTeamsMap.get(directKey).push(normalized);
          if (!sofaTeamsMap.has(reverseKey)) {
            sofaTeamsMap.set(reverseKey, []);
          }
          sofaTeamsMap.get(reverseKey).push(normalized);
        }
      } catch (error) {
        console.error(`Sofascore fetch failed for ${sofaPath} (${dateString})`, error);
      }
    }
  }

  const picks = [];
  const candidatePool = [];

  function findSofaCandidates(match) {
    const exactMatches = sofaFullMap.get(match.slateKey) ?? [];
    if (exactMatches.length > 0) {
      return exactMatches;
    }
    const teamKey = `${normalizeLabel(match.homeName)}::${normalizeLabel(match.awayName)}`;
    const teamCandidates = sofaTeamsMap.get(teamKey) ?? [];
    return teamCandidates.filter((candidate) => minutesBetween(candidate.start, match.start) <= 60);
  }

  for (const match of matches) {
    const sofaCandidates = findSofaCandidates(match);
    if (sofaCandidates.length === 0) {
      pushHighProfileExclusion(summary.highProfileExcluded, match, "Non confirmé par source secondaire");
      continue;
    }

    const aligned = sofaCandidates.find(
      (candidate) => minutesBetween(candidate.start, match.start) <= CONFIRMATION_TOLERANCE_MINUTES
    );

    if (!aligned) {
      pushHighProfileExclusion(summary.highProfileExcluded, match, "Horaire divergent (Slate-gap)");
      continue;
    }

    summary.confirmed += 1;

    const pick = buildDynamicPick(match.event, sport, config.market);
    if (!pick) {
      pushHighProfileExclusion(summary.highProfileExcluded, match, "Analyse indisponible (données ESPN)");
      continue;
    }

    summary.analysed += 1;

    const providerCount = Array.isArray(pick.marketProviders) ? pick.marketProviders.length : 0;
    if (providerCount < MIN_BOOKS_REQUIRED) {
      pushHighProfileExclusion(summary.highProfileExcluded, match, `Cotes insuffisantes (${providerCount})`);
      continue;
    }

    if (!Number.isFinite(pick.marketOdds)) {
      pushHighProfileExclusion(summary.highProfileExcluded, match, "Pas de médiane de cote");
      continue;
    }

    if (pick.marketOdds < MIN_DECIMAL_ODDS || pick.marketOdds > MAX_DECIMAL_ODDS) {
      pushHighProfileExclusion(
        summary.highProfileExcluded,
        match,
        `Cote ${pick.marketOdds.toFixed(2)} hors plage 1.40-2.20`
      );
      continue;
    }

    const impliedProbability = pick.marketOdds > 1 ? 1 / pick.marketOdds : null;
    const estimatedProbability = pick.estimatedProbability ?? pick.confidence / 100;
    const edge =
      impliedProbability !== null && estimatedProbability !== null
        ? Number((estimatedProbability - impliedProbability).toFixed(4))
        : null;

    if (edge === null || edge < (EDGE_THRESHOLDS[sport] ?? 0.08)) {
      pushHighProfileExclusion(
        summary.highProfileExcluded,
        match,
        `Edge ${edge !== null ? Math.round(edge * 100) : "0"}% < seuil`
      );
      continue;
    }

    const signalCheck = validateSignals(match.event, sport, pick);
    if (!signalCheck.ok) {
      pushHighProfileExclusion(summary.highProfileExcluded, match, signalCheck.reason ?? "Signaux insuffisants");
      continue;
    }

    const enrichedPick = {
      ...pick,
      kickoffISO: match.start.toISOString(),
      edge: Number((edge * 100).toFixed(1)),
      flags: [],
      signals: signalCheck.signals,
    };

    if (pick.marketDispersion > DISPERSION_THRESHOLD) {
      enrichedPick.flags.push("⚠️ re-check");
    }

    summary.candidates += 1;
    candidatePool.push({ match, pick: enrichedPick, edge });
  }

  candidatePool.sort((a, b) => (b.edge ?? 0) - (a.edge ?? 0));

  for (const candidate of candidatePool.slice(0, limit)) {
    picks.push(candidate.pick);
  }

  summary.selected = picks.length;

  if (summary.confirmed > 0) {
    const coverage = summary.candidates / summary.confirmed;
    if (coverage < 0.95) {
      summary.coverageNote = `Couverture ${Math.round(coverage * 100)}% (<95%) : marchés incomplets ou signaux manquants.`;
    } else {
      summary.coverageNote = `Couverture ${Math.round(coverage * 100)}% des matchs confirmés.`;
    }
  }

  return { picks, summary };
}

function validateSignals(event, sport, pick) {
  const competition = event?.competitions?.[0];
  const competitors = Array.isArray(competition?.competitors) ? competition.competitors : [];
  const home = competitors.find((competitor) => competitor?.homeAway === "home") ?? competitors[0];
  const away = competitors.find((competitor) => competitor?.homeAway === "away") ?? competitors[1];
  const signals = [];

  if (sport === "Football") {
    if (home && away) {
      const homeForm = getFormString(home);
      const awayForm = getFormString(away);
      if (homeForm && awayForm) {
        signals.push("forme récente");
      }
      const homeStrength = computeStrength(home, sport);
      const awayStrength = computeStrength(away, sport);
      if (Math.abs(homeStrength - awayStrength) >= 0.05) {
        signals.push("différence de force");
      }
      const homeRank = getRankValue(home);
      const awayRank = getRankValue(away);
      if (Number.isFinite(homeRank) || Number.isFinite(awayRank)) {
        signals.push("classement");
      }
    }
    if (competition?.weather?.displayValue) {
      signals.push("météo vérifiée");
    }
  } else if (sport === "Tennis") {
    const homeRank = getRankValue(home);
    const awayRank = getRankValue(away);
    if (Number.isFinite(homeRank) && Number.isFinite(awayRank)) {
      signals.push("classement Elo/ATP");
    }
    const homeRecord = getRecordSummary(home);
    const awayRecord = getRecordSummary(away);
    if (homeRecord && awayRecord) {
      signals.push("forme surface");
    }
    if (competition?.notes?.some?.((note) => /injury|withdrawal|blessure/i.test(note?.headline ?? ""))) {
      signals.push("info physique");
    }
  } else if (sport === "Basket") {
    const homeRecord = getRecordSummary(home);
    const awayRecord = getRecordSummary(away);
    if (homeRecord && awayRecord) {
      signals.push("bilan saison");
    }
    const homeForm = getFormString(home);
    const awayForm = getFormString(away);
    if (homeForm && awayForm) {
      signals.push("forme L5");
    }
    if (competition?.status?.type?.description) {
      signals.push("status confirmé");
    }
  }

  if (Number.isFinite(pick?.marketDispersion) && pick.marketDispersion < DISPERSION_THRESHOLD) {
    signals.push("marché stable");
  }

  const uniqueSignals = Array.from(new Set(signals));
  if (uniqueSignals.length >= 2) {
    return { ok: true, signals: uniqueSignals };
  }

  return {
    ok: false,
    signals: uniqueSignals,
    reason: "Signaux insuffisants (<2)",
  };
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

function summarizeFormValues(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }
  let wins = 0;
  let draws = 0;
  let losses = 0;
  for (const value of values) {
    if (value >= 3) {
      wins += 1;
    } else if (value >= 1) {
      draws += 1;
    } else {
      losses += 1;
    }
  }
  const parts = [];
  if (wins) parts.push(`${wins}V`);
  if (draws) parts.push(`${draws}N`);
  if (losses) parts.push(`${losses}D`);
  return parts.length > 0 ? parts.join("-") : null;
}

function joinSentences(parts) {
  return parts
    .map((part) => (typeof part === "string" ? part.trim().replace(/\s+/g, " ") : ""))
    .filter((part) => part.length > 0)
    .join(" ")
    .replace(/\s+([,.])/g, "$1")
    .replace(/\.\./g, ".");
}

function describeFootball(match, probability) {
  const { home, away, angle } = match;
  const favorite = match.preferred === "home" ? home : away;
  const outsider = match.preferred === "home" ? away : home;
  const percent = Math.round(probability * 100);
  const favoriteForm = summarizeFormValues(favorite.form);
  const outsiderForm = summarizeFormValues(outsider.form);
  const attackDiff = favorite.attackRating - outsider.attackRating;
  const defenseDiff = outsider.defenseRating - favorite.defenseRating;

  const parts = [
    angle ? angle : null,
    favoriteForm
      ? `Forme récente : ${favorite.name} reste sur ${favoriteForm}${
          outsiderForm ? ` contre ${outsider.name} (${outsiderForm})` : ""
        }.`
      : null,
    `Comparatif stats : attaque ${favorite.attackRating} vs ${outsider.attackRating}, défense ${favorite.defenseRating} vs ${outsider.defenseRating}.`,
    attackDiff > 0
      ? `${favorite.name} domine offensivement de ${attackDiff} points selon notre rating.`
      : null,
    defenseDiff > 0
      ? `${outsider.name} concède ${defenseDiff} points de plus en efficacité défensive.`
      : null,
    `Probabilité interne à ${percent}% pour ${favorite.name}.`,
  ];

  return joinSentences(parts);
}

function describeTennis(match, probability) {
  const { home, away, angle } = match;
  const percent = Math.round(probability * 100);
  if (match.preferred === "over") {
    const holdAvg = ((home.holdPct ?? 0) + (away.holdPct ?? 0)) / 2;
    return joinSentences([
      `Le scénario over s'impose : ${angle}`,
      `Moyenne de jeux conservés au service ${holdAvg.toFixed(1)}%.`,
      `Probabilité de dépasser la ligne estimée à ${percent}%.`,
    ]);
  }
  const favorite = match.preferred === "home" ? home : away;
  const outsider = match.preferred === "home" ? away : home;
  const parts = [
    `${favorite.name} part avec l'avantage. ${angle}`,
    `Serveur : ${favorite.name} tient ${favorite.holdPct}% de ses engagements contre ${outsider.holdPct}% pour ${outsider.name}.`,
    `Retour : ${favorite.breakPct}% de jeux repris, ${outsider.breakPct}% pour ${outsider.name}.`,
    `Indice Elo : ${favorite.elo} vs ${outsider.elo}.`,
    `Probabilité interne à ${percent}% pour ${favorite.name}.`,
  ];
  return joinSentences(parts);
}

function describeBasket(match, probability) {
  const { home, away, angle } = match;
  const percent = Math.round(probability * 100);
  if (match.preferred === "over") {
    const pace = ((home.pace ?? 0) + (away.pace ?? 0)) / 2;
    const offense = ((home.offensiveRating ?? 0) + (away.offensiveRating ?? 0)) / 2;
    return joinSentences([
      `Pace élevé attendu : ${angle}`,
      `Tempo projeté ${pace.toFixed(1)} possessions, attaque moyenne ${offense.toFixed(1)} pts/100.`,
      `Probabilité d'un total supérieur estimée à ${percent}%.`,
    ]);
  }
  const favorite = match.preferred === "home" ? home : away;
  const outsider = match.preferred === "home" ? away : home;
  const parts = [
    `${favorite.name} possède un edge sur 48 minutes. ${angle}`,
    `Rating offensif : ${favorite.offensiveRating} vs ${outsider.offensiveRating}.`,
    `Rating défensif : ${favorite.defensiveRating} vs ${outsider.defensiveRating}.`,
    `Forme récente : ${summarizeFormValues(favorite.recent)} pour ${favorite.name} contre ${summarizeFormValues(outsider.recent)}.`,
    `Probabilité interne à ${percent}% pour ${favorite.name}.`,
  ];
  return joinSentences(parts);
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
    marketOdds: null,
    marketProvider: null,
    marketDetail: null,
    marketImpliedProbability: null,
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

async function buildLivePicks(now, context) {
  const entries = await Promise.all([
    collectPicksForSport("Football", 3, now, context),
    collectPicksForSport("Tennis", 3, now, context),
    collectPicksForSport("Basket", 3, now, context),
  ]);

  return {
    picksBySport: {
      Football: entries[0]?.picks ?? [],
      Tennis: entries[1]?.picks ?? [],
      Basket: entries[2]?.picks ?? [],
    },
    summaries: {
      Football: entries[0]?.summary,
      Tennis: entries[1]?.summary,
      Basket: entries[2]?.summary,
    },
  };
}

function mergeDynamicWithFallback(dynamicBySport, fallbackBySport, summaries) {
  const combined = [];
  for (const sport of Object.keys(SPORT_CONFIG)) {
    const live = Array.isArray(dynamicBySport[sport]) ? [...dynamicBySport[sport]] : [];
    const fallback = fallbackBySport.get(sport) ?? [];
    const needed = Math.max(0, 3 - live.length);
    if (needed > 0) {
      live.push(...fallback.slice(0, needed));
      if (summaries?.[sport]) {
        const prefix = summaries[sport].coverageNote ? `${summaries[sport].coverageNote} · ` : "";
        summaries[sport].coverageNote = `${prefix}${needed} fallback utilisé(s)`;
      }
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
  const context = getBrusselsContext(now);
  const fallbackBySport = buildFallbackLibrary(now);

  try {
    const { picksBySport, summaries } = await buildLivePicks(now, context);
    const merged = mergeDynamicWithFallback(picksBySport, fallbackBySport, summaries);
    if (merged.length === 0) {
      throw new Error("Aucun pronostic généré");
    }
    const enriched = await generateAnalysesWithGemini(merged, {
      context,
      summaries,
    });
    const responseMeta = {
      dateISO: context.dateISO,
      dateLabel: context.dateLabel,
      windowLabel: context.windowLabel,
      windowStart: context.windowStart.toISOString(),
      windowEnd: context.windowEnd.toISOString(),
    };
    return { picks: enriched, summary: summaries, meta: responseMeta };
  } catch (error) {
    console.error("Dynamic pick generation failed", error);
    const fallback = Array.from(fallbackBySport.values()).flat().slice(0, 9);
    const enriched = await generateAnalysesWithGemini(fallback, { context, summaries: null, fallback: true });
    const responseMeta = {
      dateISO: context.dateISO,
      dateLabel: context.dateLabel,
      windowLabel: context.windowLabel,
      windowStart: context.windowStart.toISOString(),
      windowEnd: context.windowEnd.toISOString(),
    };
    return { picks: enriched, summary: null, meta: responseMeta, fallback: true };
  }
}
