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
  const modelOdds = Number.isFinite(pick.odds) ? pick.odds : null;
  const marketOdds = Number.isFinite(pick.marketOdds) ? pick.marketOdds : null;
  const marketProbability = Number.isFinite(pick.marketImpliedProbability)
    ? pick.marketImpliedProbability
    : null;
  const marketProvider = pick.marketProvider?.trim?.();
  const providersList = Array.isArray(pick.marketProviders)
    ? pick.marketProviders.map((name) => name.trim()).filter(Boolean).join(", ")
    : marketProvider;
  const marketRangeMin = Number.isFinite(pick.marketRange?.min) ? pick.marketRange.min : null;
  const marketRangeMax = Number.isFinite(pick.marketRange?.max) ? pick.marketRange.max : null;
  const edgeDisplay = Number.isFinite(pick.edge) ? `${pick.edge.toFixed(1)}%` : "—";
  const flags = Array.isArray(pick.flags) ? pick.flags : [];
  const signals = Array.isArray(pick.signals) ? pick.signals : [];
  const bookCount = Array.isArray(pick.marketProviders) ? pick.marketProviders.length : null;

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
          <dd>{modelOdds !== null ? modelOdds.toFixed(2) : "—"}</dd>
        </div>
        {marketOdds !== null && (
          <div>
            <dt className="text-neutral-500">Cote marché</dt>
            <dd>
              {marketOdds.toFixed(2)}
              {marketProbability ? ` (~${marketProbability}%)` : ""}
              {marketRangeMin !== null && marketRangeMax !== null
                ? ` · plage ${marketRangeMin.toFixed(2)}-${marketRangeMax.toFixed(2)}`
                : ""}
              {providersList ? ` · ${providersList}` : ""}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-neutral-500">Edge modèle</dt>
          <dd>{edgeDisplay}</dd>
        </div>
        {bookCount !== null && (
          <div>
            <dt className="text-neutral-500">Books agrégés</dt>
            <dd>{bookCount}</dd>
          </div>
        )}
      </dl>
      {signals.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-emerald-200">
          {signals.map((signal) => (
            <span key={signal} className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1">
              {signal}
            </span>
          ))}
        </div>
      )}
      {flags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-yellow-200">
          {flags.map((flag, index) => (
            <span
              key={`${flag}-${index}`}
              className="rounded-full border border-yellow-400/40 bg-yellow-500/10 px-2 py-1"
            >
              {flag}
            </span>
          ))}
        </div>
      )}
      <p className="mt-4 text-sm leading-relaxed text-neutral-300">{pick.analysis}</p>
    </article>
  );
}

export default function PronoAIApp() {
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [meta, setMeta] = useState(null);
  const [fallback, setFallback] = useState(false);

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
      setSummary(payload.summary ?? null);
      setMeta(payload.meta ?? null);
      setFallback(Boolean(payload.fallback));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setPicks([]);
      setSummary(null);
      setMeta(null);
      setFallback(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPicks();
  }, [fetchPicks]);

  const grouped = useMemo(() => groupBySport(picks), [picks]);
  const summaryEntries = useMemo(() => {
    if (!summary || typeof summary !== "object") return [];
    return SPORTS_ORDER.map((sport) => ({ sport, data: summary[sport] ?? null })).filter(
      (entry) => entry.data
    );
  }, [summary]);
  const totalPicks = picks.length;

  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-black px-4 py-10 text-neutral-100">
      <section className="mx-auto max-w-5xl space-y-10">
        <header className="flex flex-col gap-4 rounded-3xl border border-emerald-500/20 bg-neutral-950/60 p-8 text-center shadow-xl">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-emerald-400">
              PronoAI
            </p>
            <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
              Pronostics IA du jour
            </h1>
            <p className="mt-4 text-base text-neutral-300">
              {meta?.dateLabel ? `Fenêtre ${meta.dateLabel} (${meta.windowLabel ?? ""})` : "Fenêtre du jour"}.{" "}
              {fallback
                ? "Mode secours activé : analyse interne affichée."
                : "Analyse automatique multi-sources avec consolidation marché."}
            </p>
            <p className="text-sm text-neutral-400">
              {totalPicks} pronostic{totalPicks > 1 ? "s" : ""} généré{totalPicks > 1 ? "s" : ""}
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

        {summaryEntries.length > 0 && (
          <section className="rounded-3xl border border-emerald-500/20 bg-neutral-950/60 p-6 shadow-lg">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Slate summary</h2>
                <p className="text-sm text-neutral-400">
                  Sources croisées (ESPN + SofaScore) · Fenêtre {meta?.windowLabel ?? "Europe/Brussels"}
                </p>
              </div>
              {fallback && (
                <span className="rounded-full border border-yellow-400/40 bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-100">
                  Mode fallback
                </span>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {summaryEntries.map(({ sport, data }) => (
                <div key={sport} className="rounded-2xl border border-emerald-500/20 bg-neutral-950/80 p-4">
                  <h3 className="text-lg font-semibold text-white">{sport}</h3>
                  <dl className="mt-3 space-y-1 text-sm text-neutral-300">
                    <div className="flex justify-between">
                      <dt>Total listés</dt>
                      <dd>{data.totalListed ?? 0}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Confirmés</dt>
                      <dd>{data.confirmed ?? 0}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Analysés</dt>
                      <dd>{data.analysed ?? 0}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Candidats</dt>
                      <dd>{data.candidates ?? 0}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Picks retenus</dt>
                      <dd>{data.selected ?? 0}</dd>
                    </div>
                  </dl>
                  {data.coverageNote && (
                    <p className="mt-3 text-xs text-neutral-400">{data.coverageNote}</p>
                  )}
                  {Array.isArray(data.highProfileExcluded) && data.highProfileExcluded.length > 0 && (
                    <div className="mt-3 space-y-1 text-xs text-neutral-400">
                      <p className="font-medium text-neutral-300">High-profile écartés :</p>
                      <ul className="space-y-1">
                        {data.highProfileExcluded.map((item, index) => (
                          <li key={`${item.match}-${index}`} className="list-disc pl-4">
                            {item.match} ({item.league}) — {item.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

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
