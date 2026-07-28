/**
 * Coverage Intelligence — moteur de scoring déterministe (étape 9).
 * Fonctions PURES : aucune I/O, aucune horloge implicite. La commande
 * `coverage.ts` assemble les faits depuis l'AgentDB + git + config et appelle
 * `scoreDomains`. Design figé : voir COVERAGE-INTELLIGENCE.md.
 */

export interface CiConfig {
  weights: { business: number; criticality: number; failure: number; git: number; stability: number };
  /** Plancher de priorité par domaine (anti-angle-mort métier). */
  floors: Record<string, number>;
  /** Risque métier 0..10 par domaine (saisie projet, source = config). */
  business_risk: Record<string, number>;
  /** Nb de campagnes vertes pour atteindre la stabilité maximale. */
  stability_window: number;
  /** Au-delà de N jours sans run, la priorité est forcée au plancher de péremption. */
  max_staleness_days: number;
  staleness_floor: number;
  /** EWMA du taux d'échec : nb de campagnes considérées + lissage. */
  ewma_k: number;
  ewma_alpha: number;
  /** Coefficients de la criticité (somme pondérée du graphe de parcours). */
  criticality_coeffs: { dependents: number; depth: number; frequency: number; users: number };
  /** Demi-vie de la récence git (jours). */
  recency_tau_days: number;
  /** Mapping explicite chemin→domaine (préfixes). */
  path_domain_map: Record<string, string>;
}

export const DEFAULT_CI_CONFIG: CiConfig = {
  weights: { business: 0.3, criticality: 0.2, failure: 0.2, git: 0.2, stability: 0.1 },
  floors: { checkout: 40, payment: 40, login: 30 },
  business_risk: {},
  stability_window: 5,
  max_staleness_days: 14,
  staleness_floor: 70,
  ewma_k: 5,
  ewma_alpha: 0.5,
  criticality_coeffs: { dependents: 1, depth: 1, frequency: 1, users: 1 },
  recency_tau_days: 14,
  path_domain_map: {},
};

export interface DomainFacts {
  domain: string;
  businessRisk: number; // 0..10
  criticalityRaw: number; // somme pondérée brute
  failure: number; // 0..1 (déjà normalisé : 1 - EWMA pass_rate)
  gitRaw: number; // récence brute
  greenStreak: number;
  ageDays: number; // jours depuis le dernier run (Infinity si jamais)
}

export interface ScoredDomain {
  domain: string;
  priority: number; // 0..100
  factors: { business: number; criticality: number; failure: number; git: number; stability: number };
  reason: string[];
}

/** EWMA du taux d'échec depuis les taux de réussite (plus récent d'abord). */
export function ewmaFailure(passRates: number[], alpha: number): number {
  if (passRates.length === 0) return 0; // cold start : aucun échec connu
  let w = 1;
  let sum = 0;
  let wsum = 0;
  for (const p of passRates) {
    sum += w * p;
    wsum += w;
    w *= 1 - alpha;
  }
  const ewmaPass = wsum > 0 ? sum / wsum : 1;
  return clamp01(1 - ewmaPass);
}

/** Score l'ensemble des domaines (normalisation croisée min/max requise). */
export function scoreDomains(facts: DomainFacts[], config: CiConfig): ScoredDomain[] {
  const maxCrit = Math.max(0, ...facts.map((f) => f.criticalityRaw));
  const maxGit = Math.max(0, ...facts.map((f) => f.gitRaw));
  const { weights: w } = config;

  const scored = facts.map((f) => {
    const business = clamp01(f.businessRisk / 10);
    const criticality = maxCrit > 0 ? clamp01(f.criticalityRaw / maxCrit) : 0;
    const git = maxGit > 0 ? clamp01(f.gitRaw / maxGit) : 0;
    const failure = clamp01(f.failure);
    const stability = clamp01(f.greenStreak / Math.max(1, config.stability_window));

    const raw =
      w.business * business +
      w.criticality * criticality +
      w.failure * failure +
      w.git * git -
      w.stability * stability;

    const floor = config.floors[f.domain] ?? 0;
    const base = Math.round(100 * raw);
    let priority = clamp(base, floor, 100);

    const stale = f.ageDays > config.max_staleness_days;
    if (stale) priority = Math.max(priority, config.staleness_floor);

    const factors = {
      business: round2(business),
      criticality: round2(criticality),
      failure: round2(failure),
      git: round2(git),
      stability: round2(stability),
    };

    const reason: string[] = [];
    if (business >= 0.8) reason.push("business_risk");
    if (git >= 0.5) reason.push("recent_git_changes");
    if (failure >= 0.3) reason.push("low_pass_rate");
    if (criticality >= 0.5) reason.push("high_criticality");
    if (!Number.isFinite(f.ageDays)) reason.push("never_tested");
    else if (stale) reason.push("stale_coverage");
    if (stability >= 0.6) reason.push(`stable_${f.greenStreak}_campaigns`);
    if (base < floor) reason.push("business_floor");
    if (reason.length === 0) reason.push("baseline");

    return { domain: f.domain, priority, factors, reason };
  });

  return scored.sort((a, b) => b.priority - a.priority || a.domain.localeCompare(b.domain));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function clamp01(v: number): number {
  return clamp(v, 0, 1);
}
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
