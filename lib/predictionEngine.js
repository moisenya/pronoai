const MATCH_BLUEPRINTS = [
  {
    id: "foot-1",
    sport: "Football",
    league: "Premier League",
    venue: "Etihad Stadium",
    kickoffISO: "2025-03-29T17:30:00Z",
    home: {
      name: "Manchester City",
      attackRating: 92,
      defenseRating: 89,
      form: [3, 3, 3, 1, 3],
    },
    away: {
      name: "Arsenal",
      attackRating: 88,
      defenseRating: 87,
      form: [3, 3, 1, 3, 3],
    },
    market: "1X2",
    preferred: "home",
    angle: "City conserve un léger avantage à domicile avec une attaque toujours aussi productive.",
  },
  {
    id: "foot-2",
    sport: "Football",
    league: "Liga",
    venue: "Santiago Bernabéu",
    kickoffISO: "2025-03-29T20:00:00Z",
    home: {
      name: "Real Madrid",
      attackRating: 91,
      defenseRating: 90,
      form: [3, 3, 1, 3, 3],
    },
    away: {
      name: "Real Sociedad",
      attackRating: 83,
      defenseRating: 84,
      form: [1, 3, 0, 1, 3],
    },
    market: "1X2",
    preferred: "home",
    angle: "Madrid domine la Liga et arrive reposé après la rotation en coupe.",
  },
  {
    id: "foot-3",
    sport: "Football",
    league: "Serie A",
    venue: "Giuseppe Meazza",
    kickoffISO: "2025-03-30T18:45:00Z",
    home: {
      name: "Inter Milan",
      attackRating: 90,
      defenseRating: 91,
      form: [3, 3, 3, 3, 0],
    },
    away: {
      name: "Bologna",
      attackRating: 79,
      defenseRating: 82,
      form: [1, 3, 0, 3, 1],
    },
    market: "Handicap -1",
    preferred: "home",
    angle: "Inter déroule à domicile, Bologna souffre face aux blocs hauts.",
  },
  {
    id: "tennis-1",
    sport: "Tennis",
    league: "ATP Miami",
    surface: "Dur",
    kickoffISO: "2025-03-28T15:00:00Z",
    home: {
      name: "Carlos Alcaraz",
      holdPct: 86,
      breakPct: 31,
      elo: 2155,
      recent: [1, 1, 1, 0, 1],
    },
    away: {
      name: "Jannik Sinner",
      holdPct: 84,
      breakPct: 28,
      elo: 2095,
      recent: [1, 1, 1, 1, 0],
    },
    market: "Vainqueur du match",
    preferred: "home",
    angle: "Alcaraz possède un léger avantage dans les rallies longs sur dur rapide.",
  },
  {
    id: "tennis-2",
    sport: "Tennis",
    league: "WTA Miami",
    surface: "Dur",
    kickoffISO: "2025-03-28T18:00:00Z",
    home: {
      name: "Iga Swiatek",
      holdPct: 78,
      breakPct: 49,
      elo: 2090,
      recent: [1, 1, 1, 1, 1],
    },
    away: {
      name: "Jessica Pegula",
      holdPct: 74,
      breakPct: 36,
      elo: 1960,
      recent: [1, 0, 1, 1, 0],
    },
    market: "Vainqueur du match",
    preferred: "home",
    angle: "Swiatek domine Pegula dans les échanges croisés et retourne mieux.",
  },
  {
    id: "tennis-3",
    sport: "Tennis",
    league: "ATP Challenger Lille",
    surface: "Indoor",
    kickoffISO: "2025-03-28T11:00:00Z",
    home: {
      name: "Arthur Fils",
      holdPct: 83,
      breakPct: 24,
      elo: 1825,
      recent: [1, 1, 0, 1, 1],
    },
    away: {
      name: "Jack Draper",
      holdPct: 80,
      breakPct: 22,
      elo: 1885,
      recent: [1, 1, 1, 0, 1],
    },
    market: "Total jeux - Over/Under",
    preferred: "over",
    angle: "Deux gros serveurs indoor, peu de breaks attendus dans ce duel.",
  },
  {
    id: "basket-1",
    sport: "Basket",
    league: "NBA",
    venue: "TD Garden",
    kickoffISO: "2025-03-29T23:30:00Z",
    home: {
      name: "Boston Celtics",
      offensiveRating: 119,
      defensiveRating: 110,
      pace: 98,
      recent: [1, 1, 1, 1, 0],
    },
    away: {
      name: "Miami Heat",
      offensiveRating: 112,
      defensiveRating: 111,
      pace: 96,
      recent: [0, 1, 0, 1, 1],
    },
    market: "Vainqueur",
    preferred: "home",
    angle: "Boston solide à domicile, Heat en back-to-back avec rotation courte.",
  },
  {
    id: "basket-2",
    sport: "Basket",
    league: "EuroLeague",
    venue: "Palau Blaugrana",
    kickoffISO: "2025-03-28T19:30:00Z",
    home: {
      name: "Barcelone",
      offensiveRating: 113,
      defensiveRating: 106,
      pace: 95,
      recent: [1, 1, 1, 0, 1],
    },
    away: {
      name: "Fenerbahçe",
      offensiveRating: 111,
      defensiveRating: 108,
      pace: 94,
      recent: [1, 0, 1, 1, 0],
    },
    market: "Handicap -4.5",
    preferred: "home",
    angle: "Le Barça domine au rebond et profite du retour de Vesely.",
  },
  {
    id: "basket-3",
    sport: "Basket",
    league: "Betclic Élite",
    venue: "Astroballe",
    kickoffISO: "2025-03-30T16:00:00Z",
    home: {
      name: "ASVEL",
      offensiveRating: 108,
      defensiveRating: 104,
      pace: 97,
      recent: [1, 1, 0, 1, 1],
    },
    away: {
      name: "Paris Basketball",
      offensiveRating: 110,
      defensiveRating: 107,
      pace: 99,
      recent: [1, 1, 1, 0, 0],
    },
    market: "Total points",
    preferred: "over",
    angle: "Deux équipes rapides, Paris accélère en transition contre les gros.",
  },
];

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
  const logistic = 1 / (1 + Math.exp(-capped / 6));
  return logistic;
}

function toOdds(prob) {
  const decimal = 1 / Math.max(prob, 0.01);
  return Number(decimal.toFixed(2));
}

function describeFootball(match, probability) {
  const { home, away, venue, angle } = match;
  const favorite = match.preferred === "home" ? home : away;
  const outsider = match.preferred === "home" ? away : home;
  const percent = Math.round(probability * 100);
  return `${favorite.name} profite de ${angle} Probabilité estimée à ${percent}%. ${outsider.name} montre des signes de fatigue récemment.`;
}

function describeTennis(match, probability) {
  const { home, away, surface, angle } = match;
  const percent = Math.round(probability * 100);
  if (match.preferred === "over") {
    return `Le scénario over s'impose : ${angle} La probabilité que l'on dépasse la ligne est estimée à ${percent}%.`;
  }
  const favorite = match.preferred === "home" ? home : away;
  const outsider = match.preferred === "home" ? away : home;
  return `${favorite.name} part avec l'avantage sur ${surface}. ${angle} Probabilité estimée à ${percent}%. ${outsider.name} devra hausser son % de première balle.`;
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

function buildAnalysis(match, probability) {
  if (match.sport === "Football") {
    return describeFootball(match, probability);
  }
  if (match.sport === "Tennis") {
    return describeTennis(match, probability);
  }
  return describeBasket(match, probability);
}

function computeProbability(match) {
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

  // Basket
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
  const offenseEdge = normalize(
    favorite.offensiveRating - outsider.offensiveRating,
    -15,
    15
  );
  const defenseEdge = normalize(
    outsider.defensiveRating - favorite.defensiveRating,
    -15,
    15
  );
  const recentEdge = normalize(
    rollingScore(favorite.recent) - rollingScore(outsider.recent),
    -0.5,
    0.5
  );
  return Math.min(0.88, 0.48 + offenseEdge * 0.2 + defenseEdge * 0.2 + recentEdge * 0.2);
}

export function generateAutoPicks() {
  return MATCH_BLUEPRINTS.map((match) => {
    const probability = computeProbability(match);
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
      kickoffISO: match.kickoffISO,
      match: `${match.home.name} vs ${match.away.name}`,
      market: match.market,
      pick: pickLabel,
      confidence: Math.round(probability * 100),
      odds,
      analysis: buildAnalysis(match, probability),
    };
  });
}
