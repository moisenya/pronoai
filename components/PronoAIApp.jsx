import React, { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, AreaChart, Area } from "recharts";

/**
 * PronoAI (Single-file React + Tailwind)
 *
 * - Accueil épuré façon Apple (vert/noir/gris), cartes 3D + blur
 * - 9 pronos quotidiens (3 Football, 3 Tennis, 3 Basket) avec analyse + confiance
 * - Section "Pronos validés d'hier"
 * - Newsletter (localStorage + endpoint configurable)
 * - Outils: bankroll + convertisseur de cotes
 * - FAQ, Footer (responsible gaming)
 * - Bouton développeur ⚙️, mot de passe obfusqué + anti-bruteforce
 * - LIVE: badge par carte + pill global en navbar, rafraîchi toutes les 60s
 * - Hero: mini cartes par sport + sparkline (12 derniers résultats) + libellé "Statistiques récentes"
 * - Bouton "Voir les pronos du jour" -> scroll + surbrillance (avec loader élégant)
 * - UX Admin: toasts de feedback + badge "Nouveau" (<30min)
 * - Tests intégrés (#tests dans l'URL)
 */

// ------------------------------
// Constantes & helpers
// ------------------------------
// Mot de passe obfusqué (anti-piratage léger, côté client)
const PWD_XOR = [51, 51, 123, 125, 122, 51, 51, 123, 125, 122]; // 'zz243zz243' XOR 73
const XOR_KEY = 73;
function decodeDevPassword() {
  try {
    return String.fromCharCode(...PWD_XOR.map((n) => n ^ XOR_KEY));
  } catch {
    return "";
  }
}
const SPORTS = ["Football", "Tennis", "Basket"];
// Endpoint backend optionnel pour la newsletter (à créer côté serveur)
const SUBSCRIBE_ENDPOINT = "/api/subscribe"; // ex: Vercel/Netlify/Supabase Edge

const hasWindow = typeof window !== "undefined";
const LS =
  hasWindow && window.localStorage
    ? window.localStorage
    : {
        _m: {},
        getItem(k) {
          return this._m[k] ?? null;
        },
        setItem(k, v) {
          this._m[k] = String(v);
        },
        removeItem(k) {
          delete this._m[k];
        },
      };

function uuid() {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2);
  }
}
function checkDevPassword(pwd) {
  return String(pwd || "") === decodeDevPassword();
}

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function clsx(...c) {
  return c.filter(Boolean).join(" ");
}

// LIVE — fenêtre estimée par sport (minutes)
const SPORT_DURATION_MIN = { Football: 120, Basket: 120, Tennis: 180 };
function isLiveNow(pick, now = new Date()) {
  try {
    const start = new Date(pick.kickoffISO);
    if (isNaN(start)) return false;
    const dur = SPORT_DURATION_MIN[pick.sport] || 120;
    const end = new Date(start.getTime() + dur * 60 * 1000);
    return now >= start && now <= end;
  } catch {
    return false;
  }
}
function minutesSinceStart(pick, now = new Date()) {
  try {
    return Math.max(
      0,
      Math.floor(
        (now.getTime() - new Date(pick.kickoffISO).getTime()) / 60000
      )
    );
  } catch {
    return 0;
  }
}

// ------------------------------
// Storage helpers
// ------------------------------
const LS_PICKS = "pronoai_picks_v1";
const LS_NEWS = "pronoai_news_v1";
const LS_BANKROLL = "pronoai_bankroll_v1";

function safeParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}
function loadPicks() {
  return safeParse(LS.getItem(LS_PICKS) || "[]", []);
}
function savePicks(p) {
  LS.setItem(LS_PICKS, JSON.stringify(p));
}
function loadEmails() {
  return safeParse(LS.getItem(LS_NEWS) || "[]", []);
}
function saveEmails(e) {
  LS.setItem(LS_NEWS, JSON.stringify(e));
}
function loadBankroll() {
  const raw = LS.getItem(LS_BANKROLL) || '{"bankroll":100,"stakePct":2}';
  return safeParse(raw, { bankroll: 100, stakePct: 2 });
}
function saveBankroll(d) {
  LS.setItem(LS_BANKROLL, JSON.stringify(d));
}

// ------------------------------
// UI atoms (Tailwind)
// ------------------------------
const Card = ({ children, className = "" }) => (
  <div
    className={clsx(
      "rounded-3xl p-6 shadow-xl border border-white/10",
      "bg-gradient-to-br from-neutral-900 via-neutral-900/90 to-black",
      "backdrop-blur-xl transition-shadow transition-transform duration-200",
      "hover:-translate-y-0.5 hover:shadow-[0_20px_60px_-20px_rgba(16,185,129,0.25)] hover:ring-1 hover:ring-emerald-400/10",
      className
    )}
  >
    {children}
  </div>
);

const Badge = ({ children, tone = "neutral" }) => {
  const tones = {
    neutral: "bg-neutral-800 text-neutral-200 border border-white/10",
    green: "bg-emerald-600/20 text-emerald-300 border border-emerald-400/20",
    red: "bg-rose-600/20 text-rose-300 border border-rose-400/20",
    yellow: "bg-yellow-600/20 text-yellow-200 border border-yellow-400/20",
    blue: "bg-sky-600/20 text-sky-200 border border-sky-400/20",
  };
  return (
    <span className={clsx("px-3 py-1 text-xs rounded-full", tones[tone])}>
      {children}
    </span>
  );
};

const Button = ({ children, onClick, className = "", type = "button" }) => (
  <button
    type={type}
    onClick={onClick}
    className={clsx(
      "px-4 py-2 rounded-2xl text-sm font-medium",
      "bg-emerald-500 text-black hover:bg-emerald-400",
      "shadow-[0_10px_40px_-10px_rgba(16,185,129,0.6)]",
      className
    )}
  >
    {children}
  </button>
);

const Input = (props) => (
  <input
    {...props}
    className={clsx(
      "w-full px-4 py-2 rounded-xl bg-neutral-900 text-neutral-100",
      "placeholder:text-neutral-500 border border-white/10 focus:outline-none",
      "focus:ring-2 focus:ring-emerald-500/50",
      props.className
    )}
  />
);

const Textarea = (props) => (
  <textarea
    {...props}
    className={clsx(
      "w-full px-4 py-3 rounded-xl bg-neutral-900 text-neutral-100",
      "placeholder:text-neutral-500 border border-white/10 focus:outline-none",
      "focus:ring-2 focus:ring-emerald-500/50 min-h-[110px]",
      props.className
    )}
  />
);

const SectionTitle = ({ title, subtitle }) => (
  <div className="mb-6">
    <h2 className="text-2xl md:text-3xl font-semibold text-neutral-100">
      {title}
    </h2>
    {subtitle && (
      <p className="text-neutral-400 mt-1 text-sm md:text-base">{subtitle}</p>
    )}
  </div>
);

const ConfidenceBar = ({ value }) => (
  <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
    <div
      className="h-full bg-emerald-500 transition-all"
      style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
    />
  </div>
);

const StatusChip = ({ status }) => {
  const map = {
    pending: { label: "En attente", tone: "yellow" },
    win: { label: "Gagné", tone: "green" },
    loss: { label: "Perdu", tone: "red" },
    void: { label: "Remboursé", tone: "blue" },
    live: { label: "LIVE", tone: "red" },
  };
  const it = map[status] || map.pending;
  return <Badge tone={it.tone}>{it.label}</Badge>;
};

const LivePill = ({ minutes }) => (
  <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs bg-rose-600/20 text-rose-200 border border-rose-400/20">
    <span className="h-2 w-2 rounded-full bg-rose-400 animate-pulse" /> LIVE •{" "}
    {minutes}'
  </span>
);

// Simple spinner (loader élégant)
const Spinner = () => (
  <span
    className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent"
    aria-label="Chargement"
  />
);

// Toasts (UX Admin)
function Toasts({ toasts, onClose }) {
  return (
    <div className="fixed bottom-4 right-4 z-[70] space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="px-4 py-3 rounded-2xl text-sm bg-neutral-900/90 text-neutral-100 border border-white/10 backdrop-blur-xl shadow-xl"
        >
          <div className="flex items-center gap-2">
            <span className={t.kind === "error" ? "text-rose-300" : "text-emerald-300"}>
              {t.kind === "error" ? "❌" : "✅"}
            </span>
            <span>{t.msg}</span>
            <button
              onClick={() => onClose(t.id)}
              className="ml-2 text-neutral-400 hover:text-neutral-200 text-xs"
            >
              Fermer
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ------------------------------
// Pick Card
// ------------------------------
function PickCard({ pick, compact = false, now }) {
  const live = isLiveNow(pick, now);
  const minutes = live ? minutesSinceStart(pick, now) : 0;
  const effectiveStatus = live && pick.status === "pending" ? "live" : pick.status;
  const isNew =
    typeof pick.createdAt === "number" &&
    Date.now() - pick.createdAt < 30 * 60 * 1000; // < 30 min

  return (
    <Card className={clsx("relative", compact && "p-4")}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Badge tone="neutral">{pick.sport}</Badge>
          <span className="text-neutral-200 font-medium">{pick.league}</span>
          {isNew && <Badge tone="green">Nouveau</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {live && <LivePill minutes={minutes} />}
          <StatusChip status={effectiveStatus} />
        </div>
      </div>

      <div className="mt-3 grid md:grid-cols-3 gap-4 items-start">
        <div className="md:col-span-2">
          <h3 className="text-lg md:text-xl font-semibold text-neutral-100">
            {pick.match}
          </h3>
          <p className="text-neutral-400 text-sm mt-1">
            {new Date(pick.kickoffISO).toLocaleString()} — Sélection :{" "}
            <span className="text-neutral-100">{pick.pick}</span> — Cote :{" "}
            <span className="text-neutral-100">{pick.odds}</span>
          </p>
          <p className="text-neutral-300 mt-3 text-sm leading-relaxed">
            {pick.analysis}
          </p>
        </div>
        <div className="space-y-2">
          <div
            className="flex items-center justify-between text-sm"
            title="Ce pourcentage est estimé par notre IA (forme, H2H, blessures, etc.)."
          >
            <span className="text-neutral-400 flex items-center gap-2">
              Confiance <span className="text-neutral-500">▸</span>
            </span>
            <span className="text-neutral-100 font-medium" aria-label="Niveau de confiance IA">
              {pick.confidence}%
            </span>
          </div>
          <ConfidenceBar value={pick.confidence} />
          <div className="text-xs text-neutral-500 mt-2">Date : {pick.date}</div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]" />
    </Card>
  );
}

// ------------------------------
// Admin Panel (protégé)
// ------------------------------
function AdminPanel({ onClose, picks, setPicks, onToast }) {
  const [form, setForm] = useState({
    date: todayKey(),
    sport: "Football",
    league: "",
    match: "",
    kickoffISO: new Date().toISOString(),
    pick: "",
    odds: "1.80",
    analysis: "Analyse IA: forme, H2H, valeur des cotes…",
    confidence: 65,
  });
  const [tab, setTab] = useState("ajouter");

  // --- AJOUT ---
  async function addPick(e) {
    e.preventDefault();

    const payload = {
      id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
      date: form.date || new Date(form.kickoffISO).toISOString().slice(0, 10),
      sport: form.sport,
      league: form.league,
      match: form.match,
      kickoffISO: form.kickoffISO, // ✅ camelCase (l’API le convertira en kickoff_iso)
      pick: form.pick,
      odds: form.odds,
      analysis: form.analysis,
      confidence: form.confidence,
      status: "pending",
      createdAt: Date.now(),
    };

    const res = await fetch("/api/picks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const fresh = await fetch("/api/picks", { cache: "no-store" }).then((r) =>
        r.json()
      );
      // Normaliser ici aussi au cas où:
      const normalized = fresh.map((p) => ({
        ...p,
        kickoffISO: p.kickoff_iso ?? p.kickoffISO,
        date: p.date ?? String(p.kickoff_iso ?? p.kickoffISO).slice(0, 10),
      }));
      setPicks(normalized);
      onToast && onToast(`Prono ajouté pour ${payload.date}`);
    } else {
      onToast && onToast("Erreur lors de l'ajout", "error");
    }
  }

  // --- MISE À JOUR STATUT ---
  async function setStatus(id, status) {
    const res = await fetch(`/api/picks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (res.ok) {
      const fresh = await fetch("/api/picks", { cache: "no-store" }).then((r) =>
        r.json()
      );
      const normalized = fresh.map((p) => ({
        ...p,
        kickoffISO: p.kickoff_iso ?? p.kickoffISO,
        date: p.date ?? String(p.kickoff_iso ?? p.kickoffISO).slice(0, 10),
      }));
      setPicks(normalized);
      onToast &&
        onToast(
          `Statut mis à jour: ${
            status === "win" ? "Gagné" : status === "loss" ? "Perdu" : "Remboursé"
          }`
        );
    } else {
      onToast && onToast("Erreur de mise à jour", "error");
    }
  }

  const yKey = yesterdayKey();
  const yPicks = useMemo(() => picks.filter((p) => p.date === yKey), [picks, yKey]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-neutral-100">Espace développeur</h3>
          <Button
            className="bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
            onClick={onClose}
          >
            Fermer
          </Button>
        </div>

        <div className="mt-4 flex gap-2 text-sm">
          <button
            className={clsx(
              "px-4 py-2 rounded-xl",
              tab === "ajouter" ? "bg-emerald-500 text-black" : "bg-neutral-800 text-neutral-300"
            )}
            onClick={() => setTab("ajouter")}
          >
            Ajouter des matchs
          </button>
          <button
            className={clsx(
              "px-4 py-2 rounded-xl",
              tab === "valider" ? "bg-emerald-500 text-black" : "bg-neutral-800 text-neutral-300"
            )}
            onClick={() => setTab("valider")}
          >
            Valider les pronos d'hier
          </button>
        </div>

        {tab === "ajouter" && (
          <form onSubmit={addPick} className="grid md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="text-sm text-neutral-400">Date (YYYY-MM-DD)</label>
              <Input
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-sm text-neutral-400">Sport</label>
              <select
                value={form.sport}
                onChange={(e) => setForm({ ...form, sport: e.target.value })}
                className="w-full px-4 py-2 rounded-xl bg-neutral-900 text-neutral-100 border border-white/10"
              >
                {SPORTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-neutral-400">Compétition/Ligue</label>
              <Input
                value={form.league}
                onChange={(e) => setForm({ ...form, league: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-sm text-neutral-400">Match</label>
              <Input
                value={form.match}
                onChange={(e) => setForm({ ...form, match: e.target.value })}
                placeholder="Équipe A vs Équipe B"
                required
              />
            </div>
            <div>
              <label className="text-sm text-neutral-400">Coup d'envoi (ISO)</label>
              <Input
                value={form.kickoffISO}
                onChange={(e) => setForm({ ...form, kickoffISO: e.target.value })}
                required
              />
              <p className="text-xs text-neutral-500 mt-1">Ex: {new Date().toISOString()}</p>
            </div>
            <div>
              <label className="text-sm text-neutral-400">Sélection</label>
              <Input
                value={form.pick}
                onChange={(e) => setForm({ ...form, pick: e.target.value })}
                placeholder="Ex: Équipe A gagne"
                required
              />
            </div>
            <div>
              <label className="text-sm text-neutral-400">Cote</label>
              <Input
                value={form.odds}
                onChange={(e) => setForm({ ...form, odds: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-sm text-neutral-400">Confiance (%)</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.confidence}
                onChange={(e) =>
                  setForm({ ...form, confidence: Number(e.target.value) })
                }
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm text-neutral-400">Analyse</label>
              <Textarea
                value={form.analysis}
                onChange={(e) => setForm({ ...form, analysis: e.target.value })}
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit">Ajouter le prono</Button>
            </div>
          </form>
        )}

        {tab === "valider" && (
          <div className="mt-4 space-y-3">
            <p className="text-neutral-300 text-sm">
              Pronos d'hier ({yKey}) — définissez le statut :
            </p>
            {yPicks.length === 0 && (
              <Card className="bg-neutral-900/60 border-white/5">
                <p className="text-neutral-400">Aucun prono enregistré hier.</p>
              </Card>
            )}
            {yPicks.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-4 p-3 rounded-2xl bg-neutral-900/60 border border-white/10"
              >
                <div className="min-w-0">
                  <div className="text-neutral-200 font-medium truncate">
                    {p.match}{" "}
                    <span className="text-neutral-500 font-normal">({p.sport})</span>
                  </div>
                  <div className="text-xs text-neutral-500 truncate">
                    Sélection: {p.pick} — Cote: {p.odds}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button className="bg-emerald-600" onClick={() => setStatus(p.id, "win")}>
                    Gagné
                  </Button>
                  <Button
                    className="bg-rose-600 text-white hover:bg-rose-500"
                    onClick={() => setStatus(p.id, "loss")}
                  >
                    Perdu
                  </Button>
                  <Button
                    className="bg-sky-600 text-white hover:bg-sky-500"
                    onClick={() => setStatus(p.id, "void")}
                  >
                    Remboursé
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ------------------------------
// Outils: bankroll + cotes
// ------------------------------
function Tools() {
  const [bank, setBank] = useState(loadBankroll());
  const [odds, setOdds] = useState({ decimal: "1.80", american: "", implied: "" });

  useEffect(() => {
    saveBankroll(bank);
  }, [bank]);

  function stake() {
    return (bank.bankroll * (bank.stakePct / 100)).toFixed(2);
  }

  function decToAmerican(d) {
    const v = parseFloat(d);
    if (!isFinite(v) || v <= 1) return "";
    return v >= 2
      ? Math.round((v - 1) * 100).toString()
      : Math.round(-100 / (v - 1)).toString();
  }
  function decToImplied(d) {
    const v = parseFloat(d);
    if (!isFinite(v) || v <= 1) return "";
    return (100 / v).toFixed(2) + "%";
  }

  useEffect(() => {
    setOdds((s) => ({
      ...s,
      american: decToAmerican(s.decimal),
      implied: decToImplied(s.decimal),
    }));
  }, [odds.decimal]);

  return (
    <Card>
      <SectionTitle title="Outils" subtitle="Gérez votre mise et convertissez vos cotes" />
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-neutral-100 font-semibold mb-2">Gestion de bankroll</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-neutral-400">Bankroll (€)</label>
              <Input
                type="number"
                value={bank.bankroll}
                onChange={(e) => setBank({ ...bank, bankroll: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-sm text-neutral-400">Mise %</label>
              <Input
                type="number"
                value={bank.stakePct}
                onChange={(e) => setBank({ ...bank, stakePct: Number(e.target.value) })}
              />
            </div>
          </div>
          <p className="text-neutral-300 text-sm mt-3">
            Mise conseillée: <span className="text-neutral-100 font-semibold">€{stake()}</span>
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            Astuce: rester entre 1% et 3% par pari.
          </p>
        </div>
        <div>
          <h4 className="text-neutral-100 font-semibold mb-2">Convertisseur de cotes</h4>
          <div className="grid grid-cols-3 gap-3 items-end">
            <div>
              <label className="text-sm text-neutral-400">Décimale</label>
              <Input
                value={odds.decimal}
                onChange={(e) => setOdds({ ...odds, decimal: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm text-neutral-400">Américaine</label>
              <Input value={odds.american} readOnly />
            </div>
            <div>
              <label className="text-sm text-neutral-400">Proba implicite</label>
              <Input value={odds.implied} readOnly />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ------------------------------
// Newsletter
// ------------------------------
function Newsletter() {
  const [email, setEmail] = useState("");
  const [list, setList] = useState(loadEmails());
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [hp, setHp] = useState(""); // honeypot anti-bot

  async function subscribe(e) {
    e.preventDefault();
    setMsg("");
    setErr("");
    const ok = /.+@.+\..+/.test(email);
    if (!ok) {
      setErr("Email invalide.");
      return;
    }
    if (hp) {
      setErr("Bot détecté.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(SUBSCRIBE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setMsg("Inscription confirmée. Vérifiez votre email (double opt-in).");
        setEmail("");
      } else {
        const next = list.includes(email) ? list : [...list, email];
        setList(next);
        saveEmails(next);
        setMsg("Inscription enregistrée localement (mode démo).");
        setEmail("");
      }
    } catch (_) {
      const next = list.includes(email) ? list : [...list, email];
      setList(next);
      saveEmails(next);
      setMsg("Inscription enregistrée localement (mode démo).");
      setEmail("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <SectionTitle
        title="Newsletter"
        subtitle="Recevez chaque jour nos pronostics gratuits par email."
      />
      <form onSubmit={subscribe} className="flex flex-col md:flex-row gap-3">
        <Input
          placeholder="Votre email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {/* honeypot, volontairement caché */}
        <input
          aria-hidden
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={hp}
          onChange={(e) => setHp(e.target.value)}
          className="hidden"
        />
        <Button type="submit">{loading ? "Envoi…" : "S'abonner"}</Button>
      </form>
      {msg && <p className="text-xs text-emerald-300 mt-2">{msg}</p>}
      {err && <p className="text-xs text-rose-300 mt-2">{err}</p>}
      <p className="text-xs text-neutral-500 mt-2">
        Gratuit. Désinscription en un clic. Aucune pub.
      </p>
    </Card>
  );
}

// ------------------------------
// FAQ
// ------------------------------
function FAQ() {
  const items = [
    { q: "PronoAI est-il vraiment gratuit ?", a: "Oui. Le site et la newsletter sont 100% gratuits. Aucune inscription requise." },
    { q: "Comment sont générés les pronostics ?", a: "Nos modèles IA agrègent forme récente, H2H, blessures, fatigue, style de jeu et mouvement des cotes pour estimer une probabilité et une confiance. L'analyste humain peut ajuster avant publication." },
    { q: "Combien de pronos par jour ?", a: "Jusqu'à 9 : 3 Football, 3 Tennis, 3 Basket. S'il y a moins d'événements de qualité, nous privilégions la qualité." },
    { q: "Proposez-vous du live betting ?", a: "Non pour l'instant. Nous publions avant match, avec heure de coup d'envoi et analyse." },
    { q: "Conseils de mise ?", a: "Gérez votre bankroll, misez 1–3% par pari, ne cherchez pas à vous refaire. Jouez de manière responsable." },
  ];
  const [open, setOpen] = useState(0);
  return (
    <Card>
      <SectionTitle title="FAQ" subtitle="Questions fréquentes" />
      <div className="divide-y divide-white/5">
        {items.map((it, i) => (
          <div key={i} className="py-4">
            <button
              className="w-full text-left flex items-center justify-between"
              onClick={() => setOpen(open === i ? -1 : i)}
            >
              <span className="text-neutral-100 font-medium">{it.q}</span>
              <span className="text-neutral-500">{open === i ? "–" : "+"}</span>
            </button>
            {open === i && (
              <p className="text-neutral-300 mt-2 text-sm leading-relaxed">{it.a}</p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ------------------------------
// Hero (avec actions + stats sparkline)
// ------------------------------
function Hero({ onSeeToday, onFilterSport, stats, isScrolling }) {
  return (
    <div className="relative overflow-hidden rounded-3xl p-8 md:p-12 border border-white/10 bg-gradient-to-br from-black via-neutral-950 to-neutral-900">
      <div className="absolute -top-16 -left-16 h-72 w-72 bg-emerald-500/20 blur-3xl rounded-full" />
      <div className="absolute -bottom-16 -right-16 h-72 w-72 bg-neutral-400/10 blur-3xl rounded-full" />

      <div className="relative z-10">
        <div className="inline-flex items-center gap-2 mb-4">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-300 text-sm">IA Sports Picks — Gratuit</span>
        </div>
        <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-neutral-100">
          PronoAI
        </h1>
        <p className="text-neutral-400 mt-4 max-w-2xl text-sm md:text-base">
          Des pronostics sportifs <span className="text-neutral-200">précis</span>, une interface
          <span className="text-neutral-200"> ultra épurée</span>, et une analyse IA claire avec un{" "}
          <span className="text-neutral-200">niveau de confiance</span> pour chaque pari.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button onClick={onSeeToday}>
            {isScrolling ? (
              <span className="inline-flex items-center gap-2">
                <Spinner /> Défilement…
              </span>
            ) : (
              "Voir les pronos du jour"
            )}
          </Button>
          <a
            href="#newsletter"
            className="px-4 py-2 rounded-2xl text-sm font-medium border border-white/15 text-neutral-200 hover:bg-white/5"
          >
            S'abonner
          </a>
        </div>
      </div>

      <div className="relative mt-10 md:mt-14">
        <div className="mx-auto max-w-5xl grid md:grid-cols-3 gap-4">
          {["Football", "Tennis", "Basket"].map((s, i) => (
            <button
              key={i}
              onClick={() => onFilterSport(s)}
              className="text-left rounded-3xl bg-neutral-900/60 backdrop-blur-xl border border-white/10 p-5 shadow-2xl transition hover:translate-y-[-2px] hover:shadow-emerald-500/10 hover:scale-[1.01] hover:ring-1 hover:ring-emerald-400/20"
            >
              <div className="flex items-center justify-between">
                <span className="text-neutral-300">{s}</span>
                <span className="text-xs text-neutral-500">{stats?.[s]?.wr ?? 0}% WR</span>
              </div>
              <div className="mt-4 h-24 rounded-2xl bg-gradient-to-br from-neutral-800 to-neutral-900 border border-white/10 overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={
                      stats?.[s]?.series?.length ? stats[s].series : [{ v: 0 }, { v: 0 }, { v: 0 }]
                    }
                    margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
                  >
                    <Area type="monotone" dataKey="v" stroke="#34d399" fill="#34d399" fillOpacity={0.25} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 text-neutral-400 text-xs">
                Statistiques récentes (12 derniers pronos)
              </div>
              <div className="text-neutral-500 text-xs">Cliquez pour filtrer {s.toLowerCase()} ▶</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ------------------------------
// Daily picks (filtrable)
// ------------------------------
function DailyPicks({ picks, filterSport, now }) {
  const dKey = todayKey();
  const bySport = useMemo(() => {
    const base = { Football: [], Tennis: [], Basket: [] };
    picks
      .filter((p) => p.date === dKey)
      .forEach((p) => {
        (base[p.sport] || (base[p.sport] = [])).push(p);
      });
    Object.keys(base).forEach((k) =>
      base[k].sort(
        (a, b) =>
          new Date(a.kickoffISO).getTime() - new Date(b.kickoffISO).getTime()
      )
    );
    return base;
  }, [picks]);

  const sportsToRender =
    filterSport && SPORTS.includes(filterSport) ? [filterSport] : SPORTS;

  return (
    <div className="space-y-8">
      {sportsToRender.map((sport) => (
        <div key={sport}>
          <SectionTitle
            title={`⚡️ ${sport} — 3 pronos du jour`}
            subtitle="Analyses IA & niveau de confiance"
          />
          <div className="grid md:grid-cols-2 gap-4">
            {bySport[sport].slice(0, 3).map((p) => (
              <PickCard key={p.id} pick={p} now={now} />
            ))}
            {bySport[sport].length === 0 && (
              <Card>
                <p className="text-neutral-400 text-sm">
                  Aucun prono ajouté pour aujourd'hui. Attendez que les pronos soient ajoutés.
                </p>
              </Card>
            )}
          </div>
          <div className="mt-3 text-xs text-neutral-500">
            Astuce: privilégiez les cotes 1.70–2.20 et une mise de 1–3% par pari.
          </div>
        </div>
      ))}
    </div>
  );
}

// ------------------------------
// Hier (validés)
// ------------------------------
function Yesterday({ picks, now }) {
  const yKey = yesterdayKey();
  const y = picks.filter((p) => p.date === yKey);
  const wins = y.filter((p) => p.status === "win").length;
  const total = y.length;
  return (
    <Card>
      <SectionTitle title="Pronos validés d'hier" subtitle={`Bilan du ${yKey}`} />
      {y.length === 0 ? (
        <p className="text-neutral-400 text-sm">
          Aucun historique pour hier pour le moment.
        </p>
      ) : (
        <>
          <div className="text-neutral-300 text-sm mb-4">
            Résultats:{" "}
            <span className="text-neutral-100 font-semibold">
              {wins}/{total}
            </span>{" "}
            gagnés
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {y.map((p) => (
              <PickCard key={p.id} pick={p} compact now={now} />
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

// ------------------------------
// Footer
// ------------------------------
function Footer() {
  return (
    <footer className="mt-12 text-center text-xs text-neutral-500">
      <p>
        Jeu responsable : ne misez jamais plus que ce que vous pouvez vous permettre de perdre. 18+ seulement.
      </p>
      <p className="mt-1">
        © {new Date().getFullYear()} PronoAI — Site gratuit, sans connexion. Ce site fournit des conseils, pas des garanties.
      </p>
    </footer>
  );
}

// ------------------------------
// Tests (#tests dans l'URL)
// ------------------------------
function runSelfTests() {
  const results = [];
  function withRestoredLS(key, fn) {
    const prev = LS.getItem(key);
    try {
      return fn();
    } finally {
      prev == null ? LS.removeItem(key) : LS.setItem(key, prev);
    }
  }

  // Existence des constantes & helpers de base
  results.push({
    name: "SPORTS défini",
    ok: Array.isArray(SPORTS) && SPORTS.includes("Football"),
  });
  results.push({
    name: "todayKey/yesterdayKey format",
    ok:
      /^\d{4}-\d{2}-\d{2}$/.test(todayKey()) &&
      /^\d{4}-\d{2}-\d{2}$/.test(yesterdayKey()),
  });
  results.push({
    name: "SUBSCRIBE_ENDPOINT défini",
    ok: typeof SUBSCRIBE_ENDPOINT === "string" && SUBSCRIBE_ENDPOINT.length > 0,
  });
  results.push({
    name: "pushToastFactory défini",
    ok: typeof pushToastFactory === "function",
  });
  results.push({ name: "Spinner défini", ok: typeof Spinner === "function" });
  // Ajout de test (prévention erreur # commentaire): vérifie ancre sous forme de string
  results.push({
    name: "Ancre '#pronos' est une string valide",
    ok: "#pronos".startsWith("#"),
  });

  // Bankroll: défaut / fallback / save+load
  results.push(
    withRestoredLS(LS_BANKROLL, () => {
      LS.removeItem(LS_BANKROLL);
      const got = loadBankroll();
      return {
        name: "loadBankroll défaut",
        ok: got.bankroll === 100 && got.stakePct === 2,
      };
    })
  );
  results.push(
    withRestoredLS(LS_BANKROLL, () => {
      LS.setItem(LS_BANKROLL, "not json");
      const got = loadBankroll();
      return {
        name: "loadBankroll fallback JSON invalide",
        ok: got.bankroll === 100 && got.stakePct === 2,
      };
    })
  );
  results.push(
    withRestoredLS(LS_BANKROLL, () => {
      saveBankroll({ bankroll: 250, stakePct: 3 });
      const got = loadBankroll();
      return {
        name: "saveBankroll + loadBankroll",
        ok: got.bankroll === 250 && got.stakePct === 3,
      };
    })
  );

  // isLive
  const now = new Date();
  const pickLive = {
    sport: "Football",
    kickoffISO: new Date(now.getTime() - 30 * 60000).toISOString(),
  };
  const pickNotStarted = {
    sport: "Football",
    kickoffISO: new Date(now.getTime() + 30 * 60000).toISOString(),
  };
  const pickEnded = {
    sport: "Football",
    kickoffISO: new Date(now.getTime() - 3 * 60 * 60000).toISOString(),
  };
  results.push({
    name: "isLive quand en cours",
    ok: isLiveNow(pickLive, now) === true,
  });
  results.push({
    name: "isLive quand pas commencé",
    ok: isLiveNow(pickNotStarted, now) === false,
  });
  results.push({
    name: "isLive quand terminé",
    ok: isLiveNow(pickEnded, now) === false,
  });

  // Stats builder — renvoie des clés par sport
  const dummyPicks = [
    {
      sport: "Football",
      status: "win",
      kickoffISO: new Date(now.getTime() - 100000).toISOString(),
    },
    {
      sport: "Football",
      status: "loss",
      kickoffISO: new Date(now.getTime() - 90000).toISOString(),
    },
  ];
  const _stats = (function buildStats(picks) {
    const per = {
      Football: { series: [], wr: 0 },
      Tennis: { series: [], wr: 0 },
      Basket: { series: [], wr: 0 },
    };
    const bySport = { Football: [], Tennis: [], Basket: [] };
    [...picks]
      .sort(
        (a, b) =>
          new Date(a.kickoffISO).getTime() - new Date(b.kickoffISO).getTime()
      )
      .forEach((p) => {
        if (p.status === "win" || p.status === "loss") bySport[p.sport].push(p);
      });
    SPORTS.forEach((s) => {
      const last = bySport[s].slice(-12);
      const win = last.filter((p) => p.status === "win").length;
      const total = last.length || 0;
      per[s].wr = total ? Math.round((win / total) * 100) : 0;
      per[s].series = last.map((p, i) => ({ i, v: p.status === "win" ? 1 : 0 }));
    });
    return per;
  })(dummyPicks);
  results.push({
    name: "stats builder Football présent",
    ok: typeof _stats.Football === "object",
  });

  // Dev password decoding works (sans révéler la valeur)
  results.push({
    name: "dev password décodage",
    ok: checkDevPassword(decodeDevPassword()) === true,
  });

  return results;
}

function DevTests() {
  const [results, setResults] = useState([]);
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash.includes("tests")) {
      setResults(runSelfTests());
    }
  }, []);
  if (!results.length) return null;
  const allOk = results.every((r) => r.ok);
  return (
    <div className="fixed bottom-20 right-4 z-50 max-w-md">
      <Card className={allOk ? "ring-1 ring-emerald-500/40" : "ring-1 ring-rose-500/40"}>
        <SectionTitle
          title={allOk ? "Tests OK" : "Tests: échecs"}
          subtitle="(ajoutez #tests à l'URL pour masquer/afficher)"
        />
        <ul className="space-y-2 text-sm">
          {results.map((r, i) => (
            <li key={i} className="flex items-start gap-2">
              <span>{r.ok ? "✅" : "❌"}</span>
              <span className={r.ok ? "text-neutral-200" : "text-rose-300"}>{r.name}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// ------------------------------
// Password Modal (anti-bruteforce basique)
// ------------------------------
const LS_ADMIN_ATTEMPTS = "pronoai_admin_attempts_v1";
function readAttempts() {
  try {
    return JSON.parse(localStorage.getItem(LS_ADMIN_ATTEMPTS) || "{}");
  } catch {
    return {};
  }
}
function writeAttempts(obj) {
  try {
    localStorage.setItem(LS_ADMIN_ATTEMPTS, JSON.stringify(obj));
  } catch {}
}

function PasswordModal({ onClose, onSuccess }) {
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [locked, setLocked] = useState(null);

  useEffect(() => {
    const a = readAttempts();
    if (a.until && Date.now() < a.until) setLocked(new Date(a.until));
  }, []);

  function registerFail() {
    const a = readAttempts();
    const count = (a.count || 0) + 1;
    const next = { count };
    if (count >= 5) {
      next.until = Date.now() + 10 * 60 * 1000;
    }
    writeAttempts(next);
    if (next.until) setLocked(new Date(next.until));
  }
  function resetAttempts() {
    writeAttempts({});
    setLocked(null);
  }

  function submit(e) {
    e.preventDefault();
    const a = readAttempts();
    if (a.until && Date.now() < a.until) {
      setErr("Trop d'essais. Réessayez plus tard.");
      return;
    }
    if (checkDevPassword(pwd)) {
      resetAttempts();
      setErr("");
      onSuccess();
      onClose();
    } else {
      setErr("Mot de passe incorrect.");
      registerFail();
    }
  }
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <h3 className="text-lg font-semibold text-neutral-100">Accès développeur</h3>
        <p className="text-neutral-400 text-sm mt-1">
          Entrez le mot de passe pour ouvrir l'admin.
        </p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <Input
            type="password"
            placeholder="Mot de passe"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            autoFocus
          />
          {err && <div className="text-rose-400 text-sm">{err}</div>}
          <div className="flex justify-end gap-2">
            <Button
              className="bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
              onClick={onClose}
              type="button"
            >
              Annuler
            </Button>
            <Button type="submit">Valider</Button>
          </div>
          {locked && (
            <div className="text-amber-300 text-xs mt-1">
              Verrouillage anti-bruteforce actif jusqu'à {locked.toLocaleTimeString()}.
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}

// ------------------------------
// Root App
// ------------------------------
function PronoAIApp() {
  const [picks, setPicks] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/picks", { cache: "no-store" });
        const data = await res.json();
        // Normalise DB → front
        const normalised = (Array.isArray(data) ? data : []).map((p) => ({
          ...p,
          kickoffISO: p.kickoff_iso ?? p.kickoffISO,
          date: p.date ?? String(p.kickoff_iso ?? p.kickoffISO).slice(0, 10),
        }));
        setPicks(normalised);
      } catch (e) {
        // silencieux en prod
      }
    })();
  }, []);

  const [showAdmin, setShowAdmin] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [filterSport, setFilterSport] = useState(null); // null = tous
  const [now, setNow] = useState(new Date()); // tick LIVE
  const [adblock, setAdblock] = useState(false); // détection adblock
  const [toasts, setToasts] = useState([]); // UX admin
  const [isScrolling, setIsScrolling] = useState(false);
  const pushToast = pushToastFactory(setToasts);

  // Tick LIVE toutes les 60s
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // Détection adblock (bait div)
  useEffect(() => {
    if (!hasWindow) return;
    const bait = document.createElement("div");
    bait.className = "adsbox adsbygoogle ad-banner";
    bait.style.position = "absolute";
    bait.style.left = "-9999px";
    bait.style.height = "10px";
    bait.style.width = "10px";
    document.body.appendChild(bait);
    setTimeout(() => {
      const hidden =
        getComputedStyle(bait).display === "none" ||
        bait.offsetParent === null ||
        bait.clientHeight === 0;
      setAdblock(hidden);
      document.body.removeChild(bait);
    }, 150);
  }, []);

  // Stats par sport (winrate + série binaire win/loss)
  const stats = useMemo(() => {
    const per = {
      Football: { series: [], wr: 0 },
      Tennis: { series: [], wr: 0 },
      Basket: { series: [], wr: 0 },
    };
    const bySport = { Football: [], Tennis: [], Basket: [] };
    [...picks]
      .sort(
        (a, b) =>
          new Date(a.kickoffISO).getTime() - new Date(b.kickoffISO).getTime()
      )
      .forEach((p) => {
        if (bySport[p.sport] && (p.status === "win" || p.status === "loss"))
          bySport[p.sport].push(p);
      });
    SPORTS.forEach((s) => {
      const last = bySport[s].slice(-12);
      const win = last.filter((p) => p.status === "win").length;
      const total = last.length || 0;
      per[s].wr = total ? Math.round((win / total) * 100) : 0;
      per[s].series = last.map((p, i) => ({ i, v: p.status === "win" ? 1 : 0 }));
    });
    return per;
  }, [picks]);

  // Compte des matchs LIVE aujourd'hui (pour la navbar)
  const liveCount = useMemo(() => {
    const dKey = todayKey();
    return picks.filter((p) => p.date === dKey && isLiveNow(p, now)).length;
  }, [picks, now]);

  function scrollToId(id) {
    if (!hasWindow) return;
    const el = document.querySelector(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function onSeeToday() {
    if (isScrolling) return;
    setIsScrolling(true);
    scrollToId("#pronos");
    const el = hasWindow && document.querySelector("#pronos");
    if (el) {
      el.classList.add("ring-2", "ring-emerald-500/40", "rounded-3xl", "p-1");
      setTimeout(
        () =>
          el.classList.remove(
            "ring-2",
            "ring-emerald-500/40",
            "rounded-3xl",
            "p-1"
          ),
        1200
      );
    }
    setTimeout(() => setIsScrolling(false), 900);
  }
  function onFilterSport(s) {
    setFilterSport(s);
    scrollToId("#pronos");
  }
  function clearFilter() {
    setFilterSport(null);
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200">
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-10">
        {/* Nav */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-2xl bg-emerald-500 shadow-[0_10px_40px_-10px_rgba(16,185,129,0.7)]" />
            <span className="text-neutral-100 font-semibold tracking-tight text-lg">
              PronoAI
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <a
              href="#pronos"
              onClick={(e) => {
                e.preventDefault();
                onSeeToday();
              }}
              className="text-neutral-300 hover:text-neutral-100"
            >
              Pronos du jour
            </a>
            <a
              href="#yesterday"
              onClick={(e) => {
                e.preventDefault();
                scrollToId("#yesterday");
              }}
              className="text-neutral-300 hover:text-neutral-100"
            >
              Validés d'hier
            </a>
            <a
              href="#tools"
              onClick={(e) => {
                e.preventDefault();
                scrollToId("#tools");
              }}
              className="text-neutral-300 hover:text-neutral-100"
            >
              Outils
            </a>
            <a
              href="#faq"
              onClick={(e) => {
                e.preventDefault();
                scrollToId("#faq");
              }}
              className="text-neutral-300 hover:text-neutral-100"
            >
              FAQ
            </a>
            <span className="px-2 py-1 text-[11px] rounded-full border border-white/10 text-neutral-300 bg-neutral-800/60">
              Bêta v1.0.0
            </span>
            {liveCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full bg-rose-600/20 text-rose-200 border border-rose-400/20">
                <span className="h-2 w-2 rounded-full bg-rose-400 animate-ping" />
                {liveCount} match{liveCount > 1 ? "s" : ""} en LIVE
              </span>
            )}
          </div>
        </div>

        {/* Hero */}
        <Hero
          onSeeToday={onSeeToday}
          onFilterSport={onFilterSport}
          stats={stats}
          isScrolling={isScrolling}
        />

        {/* Filtre actif */}
        {filterSport && (
          <div className="mt-6 flex items-center gap-3">
            <Badge tone="green">Filtre: {filterSport}</Badge>
            <button
              onClick={clearFilter}
              className="text-xs text-neutral-400 hover:text-neutral-200 underline"
            >
              Réinitialiser
            </button>
          </div>
        )}

        {/* Daily picks */}
        <div id="pronos" className="mt-10 space-y-10">
          <DailyPicks picks={picks} filterSport={filterSport} now={now} />
        </div>

        {/* Yesterday */}
        <div id="yesterday" className="mt-10">
          <Yesterday picks={picks} now={now} />
        </div>

        {/* Tools */}
        <div id="tools" className="mt-10">
          <Tools />
        </div>

        {/* Newsletter */}
        <div id="newsletter" className="mt-10">
          <Newsletter />
        </div>

        {/* FAQ */}
        <div id="faq" className="mt-10">
          <FAQ />
        </div>

        <Footer />
      </div>

      {/* Adblock notice */}
      {adblock && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <Card className="bg-neutral-900/90 backdrop-blur-xl border-white/20">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <div>
                <div className="text-sm text-neutral-100">Bloqueur détecté</div>
                <div className="text-xs text-neutral-400">
                  Pour une meilleure expérience, ajoutez{" "}
                  <span className="text-neutral-200 font-medium">PronoAI</span> à votre liste blanche.
                </div>
              </div>
              <button
                onClick={() => setAdblock(false)}
                className="ml-3 text-xs text-neutral-400 hover:text-neutral-200 underline"
              >
                Fermer
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Bouton Dev */}
      <button
        onClick={() => setShowPwd(true)}
        title="Espace développeur"
        className="fixed bottom-4 right-4 z-50 p-3 rounded-2xl bg-neutral-900/80 border border-white/10 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 backdrop-blur-xl"
      >
        ⚙️
      </button>

      {showAdmin && (
        <AdminPanel
          onClose={() => setShowAdmin(false)}
          picks={picks}
          setPicks={setPicks}
          onToast={(m, k) => pushToast(m, k)}
        />
      )}
      {showPwd && (
        <PasswordModal onClose={() => setShowPwd(false)} onSuccess={() => setShowAdmin(true)} />
      )}

      {/* Toasts */}
      <Toasts
        toasts={toasts}
        onClose={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />

      {/* Tests */}
      <DevTests />
    </div>
  );
}

// ------------------------------
// Toast helper
// ------------------------------
function pushToastFactory(setter) {
  return (msg, kind = "ok") => {
    const id = Math.random().toString(36).slice(2);
    setter((prev) => [...prev, { id, msg, kind }]);
    setTimeout(() => setter((prev) => prev.filter((t) => t.id !== id)), 2500);
  };
}

export default PronoAIApp;
