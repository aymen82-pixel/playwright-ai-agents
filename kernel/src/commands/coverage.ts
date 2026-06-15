/**
 * Coverage Intelligence — commandes `score`, `prioritize` et `ci put-metric`
 * (étape 9). Assemble les faits déterministes (config + AgentDB + git) et
 * délègue le calcul aux fonctions pures de `coverage/score.ts`.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AgentDb } from "../db/agentdb";
import { findQaDir, repoRoot } from "../paths";
import { staleCutoff } from "../db/migrate";
import {
  DEFAULT_CI_CONFIG,
  ewmaFailure,
  scoreDomains,
  type CiConfig,
  type DomainFacts,
  type ScoredDomain,
} from "../ci/score";
import { computeGitActivity, parseGitLog } from "../ci/git";

export interface CoverageOptions {
  mode: "score" | "prioritize" | "put-metric";
  flags: Map<string, string[]>;
  bools: Set<string>;
  qaDir?: string;
  now?: () => string;
  nowMs?: number;
  /** Override de l'invocation git (tests). */
  gitRunner?: (sinceIso: string, cwd: string) => string;
}

export interface CoverageOutcome {
  exitCode: number;
  stdout: string;
}

export function runCoverage(opts: CoverageOptions): CoverageOutcome {
  const qaDir = opts.qaDir ?? findQaDir();
  const json = opts.bools.has("json");
  const flag = (n: string) => opts.flags.get(n)?.[0];
  const nowMs = opts.nowMs ?? Date.now();
  const config = loadCiConfig(qaDir);
  const db = AgentDb.open(join(qaDir, "agentdb", "agentdb.sqlite"), opts.now);

  try {
    if (opts.mode === "put-metric") {
      const domain = flag("domain");
      if (!domain) return fail(json, "ci put-metric : --domain requis");
      db.putCriticality({
        domain,
        dependents: num(flag("dependents")),
        depth: num(flag("depth")),
        users_impacted: num(flag("users")),
        frequency: num(flag("frequency")),
      });
      return ok(json, { domain }, `OK criticité enregistrée — ${domain}`);
    }

    // score / prioritize : rafraîchir git (1 log/campagne), scorer tous les domaines.
    refreshGit(db, config, qaDir, flag("since") ?? `${config.max_staleness_days}d`, nowMs, opts.gitRunner);
    const scored = computeScores(db, config, nowMs);

    if (opts.bools.has("record")) {
      const runId = flag("run") ?? new Date(nowMs).toISOString().slice(0, 10);
      db.recordScores(
        runId,
        scored.map((s) => ({
          entity_type: "domain",
          entity_key: s.domain,
          priority: s.priority,
          factors: s.factors,
          reason: s.reason,
        })),
      );
    }

    if (opts.mode === "score") {
      const domain = flag("domain");
      if (!domain) return fail(json, "score : --domain requis");
      const one = scored.find((s) => s.domain === domain);
      if (!one) return fail(json, `score : domaine inconnu "${domain}" (aucune donnée)`);
      return ok(json, one, renderOne(one), one);
    }

    const top = num(flag("top"));
    const list = top ? scored.slice(0, top) : scored;
    return ok(json, list, renderList(list), list);
  } finally {
    db.close();
  }
}

function computeScores(db: AgentDb, config: CiConfig, nowMs: number): ScoredDomain[] {
  const domains = new Set<string>([...db.knownDomains(), ...Object.keys(config.business_risk)]);
  const crit = new Map(db.allCriticality().map((c) => [c.domain, c]));
  const git = new Map(db.gitActivityByDomain().map((g) => [g.domain, g]));
  const k = config.criticality_coeffs;

  const facts: DomainFacts[] = [...domains].map((domain) => {
    const c = crit.get(domain);
    const criticalityRaw = c
      ? k.dependents * c.dependents + k.depth * c.depth + k.frequency * c.frequency + k.users * c.users_impacted
      : 0;
    const last = db.lastRunAt(domain);
    return {
      domain,
      businessRisk: config.business_risk[domain] ?? 0,
      criticalityRaw,
      failure: ewmaFailure(db.runPassRates(domain, config.ewma_k), config.ewma_alpha),
      gitRaw: git.get(domain)?.recency ?? 0,
      greenStreak: db.greenStreak(domain),
      ageDays: last ? (nowMs - Date.parse(last)) / 86_400_000 : Infinity,
    };
  });
  return scoreDomains(facts, config);
}

function refreshGit(
  db: AgentDb,
  config: CiConfig,
  qaDir: string,
  since: string,
  nowMs: number,
  runner?: (sinceIso: string, cwd: string) => string,
): void {
  const sinceIso = staleCutoff(since, nowMs);
  const root = repoRoot(qaDir);
  let raw: string;
  try {
    raw = runner
      ? runner(sinceIso, root)
      : execFileSync("git", ["log", `--since=${sinceIso}`, "--name-only", "--pretty=format:%x1f%cI"], {
          cwd: root,
          encoding: "utf8",
          maxBuffer: 16 * 1024 * 1024,
        });
  } catch {
    return; // git indisponible / pas un dépôt → facteur git neutre (0).
  }
  const knownDomains = new Set([...db.knownDomains(), ...Object.keys(config.business_risk)]);
  const activity = computeGitActivity(parseGitLog(raw), {
    pathDomainMap: config.path_domain_map,
    knownDomains,
    tauDays: config.recency_tau_days,
    nowMs,
  });
  db.replaceGitActivity(activity);
}

export function loadCiConfig(qaDir: string): CiConfig {
  const path = join(qaDir, "qa.config.json");
  if (!existsSync(path)) return DEFAULT_CI_CONFIG;
  let raw: { coverage_intelligence?: Partial<CiConfig> };
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return DEFAULT_CI_CONFIG;
  }
  const ci = raw?.coverage_intelligence ?? {};
  const d = DEFAULT_CI_CONFIG;
  return {
    weights: { ...d.weights, ...(ci.weights ?? {}) },
    floors: { ...d.floors, ...(ci.floors ?? {}) },
    business_risk: { ...d.business_risk, ...(ci.business_risk ?? {}) },
    stability_window: ci.stability_window ?? d.stability_window,
    max_staleness_days: ci.max_staleness_days ?? d.max_staleness_days,
    staleness_floor: ci.staleness_floor ?? d.staleness_floor,
    ewma_k: ci.ewma_k ?? d.ewma_k,
    ewma_alpha: ci.ewma_alpha ?? d.ewma_alpha,
    criticality_coeffs: { ...d.criticality_coeffs, ...(ci.criticality_coeffs ?? {}) },
    recency_tau_days: ci.recency_tau_days ?? d.recency_tau_days,
    path_domain_map: { ...d.path_domain_map, ...(ci.path_domain_map ?? {}) },
  };
}

function renderList(list: ScoredDomain[]): string {
  if (!list.length) return "Aucun domaine à prioriser (aucune donnée).";
  return list.map((s) => `${String(s.priority).padStart(3)}  ${s.domain}  [${s.reason.join(", ")}]`).join("\n");
}

function renderOne(s: ScoredDomain): string {
  const f = s.factors;
  return [
    `${s.domain} — priorité ${s.priority}`,
    `  facteurs : business=${f.business} criticality=${f.criticality} failure=${f.failure} git=${f.git} stability=${f.stability}`,
    `  raison : ${s.reason.join(", ")}`,
  ].join("\n");
}

function num(s: string | undefined): number | undefined {
  return s === undefined ? undefined : Number(s);
}

function ok(json: boolean, payload: unknown, human: string, machineOverride?: unknown): CoverageOutcome {
  return { exitCode: 0, stdout: json ? JSON.stringify(machineOverride ?? payload) : human };
}

function fail(json: boolean, message: string): CoverageOutcome {
  return { exitCode: 2, stdout: json ? JSON.stringify({ error: message }) : message };
}
