import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { findQaDir, runDir } from "../paths";
import { AgentDb } from "../db/agentdb";

export interface JournalOptions {
  runId: string;
  agent: string;
  status: "ok" | "partial" | "error" | "retry" | "skipped";
  deliverable?: string;
  anomalies?: string[];
  start?: string;
  end?: string;
  json?: boolean;
  qaDir?: string;
  /** Horodatage injectable pour tests déterministes. */
  now?: () => string;
}

export interface JournalOutcome {
  exitCode: number;
  stdout: string;
  /** Ligne JSONL écrite (ou null si échec de validation). */
  entry: Record<string, unknown> | null;
}

/**
 * `qa-mesh journal <run_id> --agent <id> --status <s> [--deliverable p] [--anomaly m]…`
 * Ajoute une ligne JSONL à `.qa/runs/<run_id>/pipeline.log`.
 *
 * Source unique du schéma : `.qa/agentdb/schema.json#/properties/run-journal`
 * (pas de duplication dans le kernel — principe anti-drift qa-mesh/2.0).
 */
export function runJournal(opts: JournalOptions): JournalOutcome {
  const qaDir = opts.qaDir ?? findQaDir();
  const now = opts.now ?? (() => new Date().toISOString());

  const entry: Record<string, unknown> = {
    agent: opts.agent,
    start: opts.start ?? now(),
    status: opts.status,
  };
  if (opts.end) entry.end = opts.end;
  if (opts.deliverable) entry.deliverable_path = opts.deliverable;
  if (opts.anomalies && opts.anomalies.length) entry.anomalies = opts.anomalies;

  const validate = loadJournalValidator(qaDir);
  if (!validate(entry)) {
    const errors = (validate.errors ?? []).map(
      (e) => `${e.instancePath || "/"} ${e.message ?? "invalide"}`,
    );
    const stdout = opts.json
      ? JSON.stringify({ written: false, errors })
      : `KO journal — entrée invalide :\n  ${errors.join("\n  ")}`;
    return { exitCode: 1, stdout, entry: null };
  }

  const dir = runDir(qaDir, opts.runId);
  mkdirSync(dir, { recursive: true });
  const logPath = join(dir, "pipeline.log");
  appendFileSync(logPath, JSON.stringify(entry) + "\n", "utf8");

  // Dual-write SQLite (étape 6) — requêtable pour le dashboard ; JSONL conservé
  // pour la portabilité. Best-effort : ne jamais casser le pipeline si la base
  // est indisponible (le JSONL reste la source de vérité d'orchestration).
  try {
    const db = AgentDb.open(join(qaDir, "agentdb", "agentdb.sqlite"), opts.now);
    try {
      db.appendJournal({
        run_id: opts.runId,
        agent: opts.agent,
        ts: String(entry.start),
        status: opts.status,
        deliverable_path: opts.deliverable,
        anomalies: opts.anomalies,
      });
    } finally {
      db.close();
    }
  } catch {
    /* JSONL déjà écrit — on n'échoue pas l'orchestration pour le miroir SQLite. */
  }

  const stdout = opts.json
    ? JSON.stringify({ written: true, path: logPath, entry })
    : `OK journal ${opts.runId} — ${opts.agent} ${opts.status}`;
  return { exitCode: 0, stdout, entry };
}

const validatorCache = new Map<string, ReturnType<Ajv["compile"]>>();

function loadJournalValidator(qaDir: string): ReturnType<Ajv["compile"]> {
  const schemaPath = join(qaDir, "agentdb", "schema.json");
  const cached = validatorCache.get(schemaPath);
  if (cached) return cached;
  const agentdb = JSON.parse(readFileSync(schemaPath, "utf8"));
  const journalSchema = agentdb?.properties?.["run-journal"];
  if (!journalSchema) {
    throw new Error(
      `Schéma run-journal introuvable dans ${schemaPath} (#/properties/run-journal)`,
    );
  }
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(journalSchema);
  validatorCache.set(schemaPath, validate);
  return validate;
}
