/**
 * Loops autonomes (v3) — `qa-mesh loop init|verify|decide|status`.
 * Assemble les faits (config, rapport Playwright, git diff) et délègue le
 * calcul aux fonctions pures de `loop/{config,verify,decide}.ts`.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { findQaDir, repoRoot } from "../paths";
import { parseYaml } from "../routing/yaml";
import { DEFAULT_MAX_ITERATIONS, readLoopConfig, serializeLoopConfig, type LoopConfig } from "../loop/config";
import { verifyLoop, type ExecutionReport } from "../loop/verify";
import { decide } from "../loop/decide";
import { renderProgress } from "../loop/render";
import { AgentDb } from "../db/agentdb";
import { ContractRegistry } from "../contracts";

export interface LoopOptions {
  mode: "init" | "verify" | "decide" | "status";
  flags: Map<string, string[]>;
  bools: Set<string>;
  qaDir?: string;
  now?: () => string;
  /** Override du diff git (tests). */
  gitDiffRunner?: (root: string) => string[];
}

export interface LoopOutcome {
  exitCode: number;
  stdout: string;
}

export function runLoop(opts: LoopOptions): LoopOutcome {
  const qaDir = opts.qaDir ?? findQaDir();
  const root = repoRoot(qaDir);
  const json = opts.bools.has("json");
  const flag = (n: string) => opts.flags.get(n)?.[0];
  const list = (n: string) => (flag(n) ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  if (opts.mode === "init") {
    return runInit(root, flag, list, json, opts.bools.has("force"));
  }
  if (opts.mode === "verify") {
    return runVerify(root, qaDir, flag, json, opts);
  }
  if (opts.mode === "decide") {
    return runDecide(root, qaDir, flag, json, opts);
  }
  return runStatus(qaDir, flag, json, opts);
}

function loadLoopConfig(root: string, loopId: string): LoopConfig | null {
  const yamlPath = join(root, "loops", loopId, "loop.yaml");
  if (!existsSync(yamlPath)) return null;
  return readLoopConfig(parseYaml(readFileSync(yamlPath, "utf8")));
}

function defaultGitDiff(root: string): string[] {
  try {
    const tracked = execFileSync("git", ["diff", "--name-only", "HEAD"], { cwd: root, encoding: "utf8" });
    const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" });
    const files = new Set(
      [...tracked.split(/\r?\n/), ...untracked.split(/\r?\n/)].map((f) => f.trim()).filter(Boolean),
    );
    return [...files];
  } catch {
    return []; // pas un dépôt / git indisponible -> aucun fichier signalé (fail-open sur ce check)
  }
}

function runVerify(
  root: string,
  qaDir: string,
  flag: (n: string) => string | undefined,
  json: boolean,
  opts: LoopOptions,
): LoopOutcome {
  const loopId = flag("loop");
  const runId = flag("run");
  if (!loopId || !runId) return fail(json, "loop verify : --loop <id> et --run <run_id> requis");

  const config = loadLoopConfig(root, loopId);
  if (!config) return fail(json, `loop verify : loop.yaml introuvable pour "${loopId}" (lancer 'loop init' d'abord)`);

  const reportPath = flag("report") ?? join(root, "loops", loopId, "outputs", runId, "execution_report.json");
  let report: ExecutionReport | null = null;
  let contractValid = true;
  let contractErrors: string[] = [];
  if (existsSync(reportPath)) {
    const raw = JSON.parse(readFileSync(reportPath, "utf8"));
    report = { results: raw?.payload?.results ?? raw?.results ?? [] };
    try {
      const registry = ContractRegistry.load(qaDir);
      const result = registry.validateDeliverable(raw, flag("agent"));
      contractValid = result.valid;
      contractErrors = result.errors.map((e) => `[${e.layer}] ${e.path} ${e.message}`);
    } catch (e) {
      // Fail-closed : contrats introuvables/invalides = anomalie de configuration, pas un skip silencieux.
      contractValid = false;
      contractErrors = [`contrats indisponibles (${qaDir}) : ${(e as Error).message}`];
    }
  }

  const changedFiles = (opts.gitDiffRunner ?? defaultGitDiff)(root);
  const verdict = verifyLoop({ report, contractValid, contractErrors, changedFiles, whitelist: config.whitelist });

  const db = AgentDb.open(join(qaDir, "agentdb", "agentdb.sqlite"), opts.now);
  try {
    // `decide` ajoute une 2e ligne par itération (même n° iteration) -> se baser
    // sur le n° d'itération max connu, jamais sur le nombre de lignes.
    const previous = db.loopIterations(loopId, runId);
    const iteration = previous.length ? Math.max(...previous.map((r) => r.iteration)) + 1 : 1;
    db.recordLoopIteration({
      loop_id: loopId,
      run_id: runId,
      iteration,
      agent: flag("agent") ?? null,
      verdict: verdict.verdict,
      motifs: verdict.motifs,
      status: "running",
    });
    return ok(json, { loop_id: loopId, run_id: runId, iteration, ...verdict }, renderVerifyHuman(loopId, iteration, verdict));
  } finally {
    db.close();
  }
}

function runDecide(
  root: string,
  qaDir: string,
  flag: (n: string) => string | undefined,
  json: boolean,
  opts: LoopOptions,
): LoopOutcome {
  const loopId = flag("loop");
  const runId = flag("run");
  if (!loopId || !runId) return fail(json, "loop decide : --loop <id> et --run <run_id> requis");

  const config = loadLoopConfig(root, loopId);
  if (!config) return fail(json, `loop decide : loop.yaml introuvable pour "${loopId}"`);

  const db = AgentDb.open(join(qaDir, "agentdb", "agentdb.sqlite"), opts.now);
  try {
    const iterations = db.loopIterations(loopId, runId);
    const latest = iterations[iterations.length - 1];
    if (!latest || latest.status !== "running" || !latest.verdict) {
      return fail(json, `loop decide : aucun verdict en attente pour ${loopId}/${runId} (lancer 'loop verify' d'abord)`);
    }
    const maxIterations = flag("max-iterations") ? Number(flag("max-iterations")) : config.max_iterations;
    const decision = decide({
      verdict: latest.verdict as "PASS" | "FAIL",
      iteration: latest.iteration,
      maxIterations,
    });
    db.recordLoopIteration({
      loop_id: loopId,
      run_id: runId,
      iteration: latest.iteration,
      agent: latest.agent,
      verdict: latest.verdict,
      motifs: latest.motifs,
      status: decision.status,
    });
    // PROGRESS.md accumule l'historique de TOUTES les campagnes du loop (pas
    // seulement celle en cours) — un loop vit sur plusieurs runs successifs.
    const progressPath = join(root, "loops", loopId, "PROGRESS.md");
    writeFileSync(progressPath, renderProgress(config, db.loopIterations(loopId)), "utf8");

    return ok(
      json,
      { loop_id: loopId, run_id: runId, iteration: latest.iteration, ...decision },
      `${decision.status.toUpperCase()} — ${decision.reason}`,
    );
  } finally {
    db.close();
  }
}

function runStatus(
  qaDir: string,
  flag: (n: string) => string | undefined,
  json: boolean,
  opts: LoopOptions,
): LoopOutcome {
  const db = AgentDb.open(join(qaDir, "agentdb", "agentdb.sqlite"), opts.now);
  try {
    const loopId = flag("loop");
    if (loopId) {
      const rows = db.loopIterations(loopId, flag("run"));
      return ok(json, rows, renderStatusHuman(rows), rows);
    }
    const active = db.activeLoops();
    return ok(json, active, renderStatusHuman(active), active);
  } finally {
    db.close();
  }
}

function renderVerifyHuman(loopId: string, iteration: number, verdict: { verdict: string; motifs: string[] }): string {
  const lines = [`${verdict.verdict} — ${loopId} · itération ${iteration}`];
  for (const m of verdict.motifs) lines.push(`  - ${m}`);
  return lines.join("\n");
}

function renderStatusHuman(rows: Array<{ loop_id: string; run_id: string; iteration: number; status: string }>): string {
  if (!rows.length) return "Aucun loop actif.";
  return rows.map((r) => `${r.loop_id} (${r.run_id}) · itération ${r.iteration} · ${r.status}`).join("\n");
}

function runInit(
  root: string,
  flag: (n: string) => string | undefined,
  list: (n: string) => string[],
  json: boolean,
  force: boolean,
): LoopOutcome {
  const loopId = flag("loop");
  if (!loopId) return fail(json, "loop init : --loop <id> requis");

  const dir = join(root, "loops", loopId);
  const yamlPath = join(dir, "loop.yaml");
  if (existsSync(yamlPath) && !force) {
    return fail(json, `loop init : ${yamlPath} existe déjà (utiliser --force pour écraser)`);
  }

  const config: LoopConfig = {
    loop_id: loopId,
    target: flag("target") ?? "",
    success_criteria: flag("criteria") ?? "Suite verte, 0 échec SCRIPT/ENV",
    max_iterations: flag("max-iterations") ? Number(flag("max-iterations")) : DEFAULT_MAX_ITERATIONS,
    allowed_agents: list("agents"),
    whitelist: list("whitelist"),
  };

  mkdirSync(join(dir, "outputs"), { recursive: true });
  writeFileSync(yamlPath, serializeLoopConfig(config), "utf8");
  writeFileSync(join(dir, "TASK.md"), taskTemplate(config), "utf8");
  writeFileSync(join(dir, "LOOP_INSTRUCTIONS.md"), instructionsTemplate(config), "utf8");
  writeFileSync(join(dir, "PROGRESS.md"), progressHeader(config), "utf8");
  writeFileSync(join(dir, "outputs", ".gitkeep"), "", "utf8");

  return ok(json, { loop_id: loopId, dir }, `OK loop initialisé — ${dir}`);
}

function taskTemplate(config: LoopConfig): string {
  return [
    `# Objectif du loop \`${config.loop_id}\``,
    "",
    `Module ciblé : ${config.target || "(à compléter)"}`,
    "",
    `Critère de succès mesurable : ${config.success_criteria}`,
    "",
    "> Modifier ce fichier pour préciser le contexte métier de ce run.",
  ].join("\n") + "\n";
}

function instructionsTemplate(config: LoopConfig): string {
  const agents = config.allowed_agents.length ? config.allowed_agents.join(", ") : "(à compléter)";
  const whitelist = config.whitelist.length ? config.whitelist.map((w) => `- ${w}`).join("\n") : "- (à compléter)";
  return [
    `# Règles fixes — loop \`${config.loop_id}\``,
    "",
    `Agents autorisés : ${agents}`,
    "",
    "Chemins modifiables (whitelist, appliquée par loop-guard.js) :",
    whitelist,
    "",
    "Conventions POM et interdits : voir .claude/rules/ (source unique, ne pas dupliquer ici).",
  ].join("\n") + "\n";
}

function progressHeader(config: LoopConfig): string {
  return [
    `# Progression — loop \`${config.loop_id}\``,
    "",
    "> Fichier généré par le kernel (\`qa-mesh loop decide\`). Ne jamais éditer à la main.",
    "",
  ].join("\n") + "\n";
}

function ok(json: boolean, payload: unknown, human: string, machineOverride?: unknown): LoopOutcome {
  return { exitCode: 0, stdout: json ? JSON.stringify(machineOverride ?? payload) : human };
}

function fail(json: boolean, message: string): LoopOutcome {
  return { exitCode: 2, stdout: json ? JSON.stringify({ error: message }) : message };
}
