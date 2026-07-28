import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentDb } from "./agentdb";

export interface MigrationSummary {
  selectors: number;
  sessions: number;
  coverage: number;
  sources: string[];
}

/**
 * Migre les fichiers JSON legacy AgentDB v1 (`.qa/agentdb/*.json`) vers SQLite.
 * Idempotent au sens append-only : relancer ajoute de nouvelles versions de
 * sélecteurs (la version max reste cohérente). À lancer une fois par projet.
 */
export function migrateFromJson(db: AgentDb, agentdbDir: string): MigrationSummary {
  const summary: MigrationSummary = { selectors: 0, sessions: 0, coverage: 0, sources: [] };

  const selectorsPath = join(agentdbDir, "browser-selectors.json");
  if (existsSync(selectorsPath)) {
    const items = readJsonArray(selectorsPath);
    const inputs = items.map((it) => ({
      domain: String(it.domain),
      page: String(it.page),
      label: String(it.label),
      selector_primary: String(it.selector_primary),
      selector_fallback: it.selector_fallback != null ? String(it.selector_fallback) : undefined,
      validated: Boolean(it.validated),
      validated_by: it.validated_by != null ? String(it.validated_by) : undefined,
    }));
    summary.selectors = db.putSelectors(inputs);
    summary.sources.push(selectorsPath);
  }

  const sessionsPath = join(agentdbDir, "browser-sessions.json");
  if (existsSync(sessionsPath)) {
    for (const it of readJsonArray(sessionsPath)) {
      db.putSession({
        session_id: it.session_id != null ? String(it.session_id) : undefined,
        role: String(it.role),
        storage_state_path: String(it.storage_state_path),
        created_at: it.created_at != null ? String(it.created_at) : undefined,
        expires_at: String(it.expires_at),
      });
      summary.sessions++;
    }
    summary.sources.push(sessionsPath);
  }

  const coveragePath = join(agentdbDir, "coverage-memory.json");
  if (existsSync(coveragePath)) {
    for (const it of readJsonArray(coveragePath)) {
      db.putCoverage({
        domain: String(it.domain),
        score: it.coverage_score != null ? Number(it.coverage_score) : undefined,
        last_run_id: it.last_run_id != null ? String(it.last_run_id) : undefined,
        last_pass_rate: it.last_pass_rate_pct != null ? Number(it.last_pass_rate_pct) : undefined,
      });
      summary.coverage++;
    }
    summary.sources.push(coveragePath);
  }

  return summary;
}

function readJsonArray(path: string): Array<Record<string, unknown>> {
  const data = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(data)) {
    throw new Error(`${path} : tableau JSON attendu`);
  }
  return data;
}

/**
 * Convertit une durée relative (`30d`, `24h`, `90m`, `3600s`) en timestamp ISO
 * de coupure = maintenant - durée. Utilisé par `db prune --stale`.
 */
export function staleCutoff(spec: string, nowMs: number): string {
  const match = /^(\d+)\s*([smhd])$/.exec(spec.trim());
  if (!match) {
    throw new Error(`Durée invalide : "${spec}" (attendu ex. 30d, 24h, 90m, 3600s)`);
  }
  const value = Number(match[1]);
  const unitMs: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return new Date(nowMs - value * unitMs[match[2]]).toISOString();
}
