"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const SPORTS_ORDER = ["Football", "Tennis", "Basket"];

function groupBySport(picks) {
  return picks.reduce((acc, pick) => {
    acc[pick.sport] = acc[pick.sport] ?? [];
    acc[pick.sport].push(pick);
    return acc;
  }, {});
}

function formatModelName(model) {
  if (typeof model !== "string" || model.trim().length === 0) {
    return null;
  }
  const formatted = model
    .replace(/^gemini/i, "Gemini")
    .replace(/-/g, " ")
    .replace(/\b([a-z])/g, (match) => match.toUpperCase());
  return formatted;
}

function formatKickoff(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "À confirmer";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function PickCard({ pick }) {
  const isGemini = pick.analysisSource === "gemini";
  const formattedModel = formatModelName(pick.analysisModel);
  const badgeLabel = isGemini
    ? formattedModel
      ? `Analyse ${formattedModel}`
      : "Analyse Gemini"
    : "Analyse interne";
  const badgeStyles = isGemini
    ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-100"
    : "border-neutral-500/30 bg-neutral-500/10 text-neutral-200";

  return (
    <article className="rounded-2xl border border-emerald-500/20 bg-neutral-950/80 p-5 shadow-lg">
      <header className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-emerald-400">
            {pick.league}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-white">{pick.match}</h3>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-200">
            {pick.confidence}%
          </span>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide ${badgeStyles}`}
          >
            {badgeLabel}
          </span>
        </div>
      </header>
      <dl className="grid grid-cols-2 gap-2 text-sm text-neutral-300">
        <div>
          <dt className="text-neutral-500">Coup d'envoi</dt>
          <dd>{formatKickoff(pick.kickoffISO)}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Marché</dt>
          <dd>{pick.market}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Pronostic</dt>
          <dd className="font-medium text-white">{pick.pick}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Cote simulée</dt>
          <dd>{pick.odds.toFixed(2)}</dd>
        </div>
      </dl>
      <p className="mt-4 text-sm leading-relaxed text-neutral-300">{pick.analysis}</p>
    </article>
  );
}

export default function PronoAIApp() {
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPicks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/autopicks", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Impossible de récupérer les pronostics (${response.status})`);
      }
      const payload = await response.json();
      setPicks(Array.isArray(payload.picks) ? payload.picks : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setPicks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPicks();
  }, [fetchPicks]);

  const grouped = useMemo(() => groupBySport(picks), [picks]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-black px-4 py-10 text-neutral-100">
      <section className="mx-auto max-w-5xl space-y-10">
        <header className="flex flex-col gap-4 rounded-3xl border border-emerald-500/20 bg-neutral-950/60 p-8 text-center shadow-xl">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-emerald-400">
              PronoAI
            </p>
            <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
              9 pronostics IA du jour
            </h1>
            <p className="mt-4 text-base text-neutral-300">
              Analyse automatique pour 3 matchs de football, 3 rencontres de tennis
              et 3 affiches de basket. Probabilités et cote simulée calculées à partir
              de statistiques récentes.
            </p>
          </div>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={fetchPicks}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-5 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
            >
              Rafraîchir les pronostics
            </button>
            {loading && <span className="text-sm text-neutral-400">Chargement…</span>}
            {error && (
              <span className="text-sm text-rose-300">{error}</span>
            )}
          </div>
        </header>

        {SPORTS_ORDER.map((sport) => {
          const picksForSport = grouped[sport] ?? [];
          if (picksForSport.length === 0) {
            return null;
          }
          return (
            <section key={sport} className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-white">{sport}</h2>
                <span className="text-sm text-neutral-400">
                  {picksForSport.length} pronostics
                </span>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                {picksForSport.map((pick) => (
                  <PickCard key={pick.id} pick={pick} />
                ))}
              </div>
            </section>
          );
        })}

        {!loading && picks.length === 0 && !error && (
          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-6 text-center text-sm text-yellow-100">
            Aucun pronostic disponible pour le moment. Réessaie un peu plus tard.
          </div>
        )}
      </section>
    </main>
  );
}
