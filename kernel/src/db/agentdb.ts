import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { levenshtein } from "./distance";

export const AGENTDB_SCHEMA_VERSION = "2";

/** DDL idempotent de l'AgentDB v2. Source unique du schéma SQLite. */
const DDL = `
CREATE TABLE IF NOT EXISTS selectors (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  domain            TEXT    NOT NULL,
  page              TEXT    NOT NULL,
  label             TEXT    NOT NULL,
  selector_primary  TEXT    NOT NULL,
  selector_fallback TEXT,
  validated         INTEGER NOT NULL DEFAULT 0,
  validated_by      TEXT,
  version           INTEGER NOT NULL,
  last_validated_at TEXT,
  created_at        TEXT    NOT NULL,
  run_id            TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_selectors_key_version ON selectors(domain, page, label, version);
CREATE INDEX IF NOT EXISTS idx_selectors_key ON selectors(domain, page, label);

CREATE TABLE IF NOT EXISTS sessions (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id         TEXT,
  role               TEXT NOT NULL,
  storage_state_path TEXT NOT NULL,
  created_at         TEXT NOT NULL,
  expires_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_role ON sessions(role);

CREATE TABLE IF NOT EXISTS coverage (
  domain         TEXT PRIMARY KEY,
  score          REAL,
  last_run_id    TEXT,
  last_pass_rate REAL,
  routes_hash    TEXT,
  updated_at     TEXT
);

CREATE TABLE IF NOT EXISTS journal (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id           TEXT NOT NULL,
  agent            TEXT NOT NULL,
  ts               TEXT NOT NULL,
  status           TEXT NOT NULL,
  deliverable_path TEXT,
  anomalies        TEXT
);
CREATE INDEX IF NOT EXISTS idx_journal_run ON journal(run_id);

CREATE TABLE IF NOT EXISTS scenario_runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id      TEXT NOT NULL,
  scenario_id TEXT,
  spec        TEXT,
  title       TEXT,
  domain      TEXT,
  status      TEXT NOT NULL,
  ts          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scenario_runs_run ON scenario_runs(run_id);
CREATE INDEX IF NOT EXISTS idx_scenario_runs_spec ON scenario_runs(spec, title);

CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
`;

export interface SelectorInput {
  domain: string;
  page: string;
  label: string;
  selector_primary: string;
  selector_fallback?: string;
  validated?: boolean;
  validated_by?: string;
  run_id?: string;
}

export interface SelectorRow {
  domain: string;
  page: string;
  label: string;
  selector_primary: string;
  selector_fallback: string | null;
  validated: boolean;
  validated_by: string | null;
  version: number;
  last_validated_at: string | null;
  created_at: string;
  run_id: string | null;
}

export interface SessionInput {
  session_id?: string;
  role: string;
  storage_state_path: string;
  created_at?: string;
  expires_at: string;
}

export interface CoverageInput {
  domain: string;
  score?: number;
  last_run_id?: string;
  last_pass_rate?: number;
  routes_hash?: string;
}

export interface SelectorFilter {
  domain?: string;
  page?: string;
  label?: string;
  validatedOnly?: boolean;
}

export interface PackSelector {
  label: string;
  selector_primary: string;
  selector_fallback: string | null;
  validated: boolean;
  /** Validation MCP différentielle (étape 5) : validé ET frais → skip live. */
  trusted: boolean;
}

export interface JournalEntry {
  run_id: string;
  agent: string;
  ts: string;
  status: string;
  deliverable_path?: string | null;
  anomalies?: string[] | null;
}

export interface ScenarioResult {
  scenario_id?: string | null;
  spec?: string | null;
  title?: string | null;
  status: string;
}

type Clock = () => string;

/**
 * AgentDB v2 — mémoire persistante inter-campagnes sur SQLite (WAL).
 *
 * Toute lecture/écriture de la mémoire passe par cette classe (exposée via
 * `qa-mesh db`). Les agents n'accèdent JAMAIS au fichier directement : c'est ce
 * qui rend la concurrence des spécialistes sûre et la résolution déterministe.
 */
export class AgentDb {
  private readonly db: DatabaseSync;
  private readonly now: Clock;

  private constructor(db: DatabaseSync, now: Clock) {
    this.db = db;
    this.now = now;
  }

  /** Ouvre (et crée si besoin) la base au chemin donné, applique le schéma. */
  static open(path: string, now: Clock = () => new Date().toISOString()): AgentDb {
    if (path !== ":memory:") {
      mkdirSync(dirname(path), { recursive: true });
    }
    const db = new DatabaseSync(path);
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA busy_timeout = 5000;");
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec(DDL);
    const instance = new AgentDb(db, now);
    instance.db
      .prepare("INSERT OR IGNORE INTO meta(key, value) VALUES('schema_version', ?)")
      .run(AGENTDB_SCHEMA_VERSION);
    return instance;
  }

  close(): void {
    this.db.close();
  }

  // ---- selectors -----------------------------------------------------------

  /**
   * Insère une nouvelle version d'un sélecteur (append-only). La version est
   * calculée atomiquement = MAX(version) de la clé (domain,page,label) + 1,
   * ce qui préserve l'historique pour le rollback d'un healing raté.
   */
  putSelector(input: SelectorInput): number {
    const ts = this.now();
    const validated = input.validated ? 1 : 0;
    const result = this.db
      .prepare(
        `INSERT INTO selectors
           (domain, page, label, selector_primary, selector_fallback,
            validated, validated_by, version, last_validated_at, created_at, run_id)
         VALUES
           (?, ?, ?, ?, ?, ?, ?,
            COALESCE((SELECT MAX(version) FROM selectors
                      WHERE domain = ? AND page = ? AND label = ?), 0) + 1,
            ?, ?, ?)`,
      )
      .run(
        input.domain,
        input.page,
        input.label,
        input.selector_primary,
        input.selector_fallback ?? null,
        validated,
        input.validated_by ?? null,
        input.domain,
        input.page,
        input.label,
        validated ? ts : null,
        ts,
        input.run_id ?? null,
      );
    return Number(result.lastInsertRowid);
  }

  putSelectors(inputs: SelectorInput[]): number {
    let count = 0;
    this.db.exec("BEGIN");
    try {
      for (const input of inputs) {
        this.putSelector(input);
        count++;
      }
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
    return count;
  }

  /** Sélecteurs « courants » (version max par clé), filtrés. */
  getSelectors(filter: SelectorFilter = {}): SelectorRow[] {
    const where: string[] = [];
    const params: string[] = [];
    if (filter.domain) {
      where.push("s.domain = ?");
      params.push(filter.domain);
    }
    if (filter.page) {
      where.push("s.page = ?");
      params.push(filter.page);
    }
    if (filter.label) {
      where.push("s.label = ?");
      params.push(filter.label);
    }
    if (filter.validatedOnly) {
      where.push("s.validated = 1");
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const rows = this.db
      .prepare(
        `SELECT s.* FROM selectors s
         JOIN (SELECT domain, page, label, MAX(version) AS v
               FROM selectors GROUP BY domain, page, label) m
           ON s.domain = m.domain AND s.page = m.page
              AND s.label = m.label AND s.version = m.v
         ${clause}
         ORDER BY s.page, s.label`,
      )
      .all(...params) as Record<string, unknown>[];
    return rows.map(toSelectorRow);
  }

  /**
   * Pack domaine pour injection en prompt (Agent 4) : sélecteurs validés
   * courants, groupés et triés par page. Chaque sélecteur porte un flag
   * `trusted` (validation MCP différentielle, étape 5) = validé ET frais
   * (`last_validated_at >= freshCutoffIso`). Si `freshCutoffIso` est omis,
   * `trusted` vaut `validated`.
   */
  pack(domain: string, validatedOnly = true, freshCutoffIso?: string): {
    domain: string;
    pages: Record<string, PackSelector[]>;
  } {
    const rows = this.getSelectors({ domain, validatedOnly });
    const pages: Record<string, PackSelector[]> = {};
    for (const r of rows) {
      const fresh = freshCutoffIso
        ? r.last_validated_at != null && r.last_validated_at >= freshCutoffIso
        : true;
      (pages[r.page] ??= []).push({
        label: r.label,
        selector_primary: r.selector_primary,
        selector_fallback: r.selector_fallback,
        validated: r.validated,
        trusted: r.validated && fresh,
      });
    }
    return { domain, pages };
  }

  /**
   * Top-N sélecteurs courants dont le `label` est le plus proche (distance
   * d'édition) sur la même page et le même domaine — candidats de healing.
   */
  similar(
    domain: string,
    page: string,
    label: string,
    top = 3,
  ): Array<SelectorRow & { distance: number }> {
    const candidates = this.getSelectors({ domain, page });
    return candidates
      .map((row) => ({ ...row, distance: levenshtein(label, row.label) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, top);
  }

  /** Nombre de sélecteurs qui seraient purgés (pour `--dry-run`). */
  staleSelectorCount(cutoffIso: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS n FROM selectors
         WHERE COALESCE(last_validated_at, created_at) < ?`,
      )
      .get(cutoffIso) as { n: number };
    return Number(row.n);
  }

  /** Purge les sélecteurs plus vieux que `cutoffIso` (ISO). Retourne le nombre supprimé. */
  pruneSelectors(cutoffIso: string): number {
    const result = this.db
      .prepare(
        `DELETE FROM selectors
         WHERE COALESCE(last_validated_at, created_at) < ?`,
      )
      .run(cutoffIso);
    return Number(result.changes);
  }

  // ---- sessions ------------------------------------------------------------

  putSession(input: SessionInput): void {
    this.db
      .prepare(
        `INSERT INTO sessions (session_id, role, storage_state_path, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        input.session_id ?? null,
        input.role,
        input.storage_state_path,
        input.created_at ?? this.now(),
        input.expires_at,
      );
  }

  /** Session non expirée la plus récente pour un rôle, ou null. */
  getSession(role: string): Record<string, unknown> | null {
    const row = this.db
      .prepare(
        `SELECT * FROM sessions
         WHERE role = ? AND expires_at > ?
         ORDER BY created_at DESC LIMIT 1`,
      )
      .get(role, this.now()) as Record<string, unknown> | undefined;
    return row ?? null;
  }

  // ---- coverage ------------------------------------------------------------

  putCoverage(input: CoverageInput): void {
    this.db
      .prepare(
        `INSERT INTO coverage (domain, score, last_run_id, last_pass_rate, routes_hash, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(domain) DO UPDATE SET
           score = excluded.score,
           last_run_id = excluded.last_run_id,
           last_pass_rate = excluded.last_pass_rate,
           routes_hash = excluded.routes_hash,
           updated_at = excluded.updated_at`,
      )
      .run(
        input.domain,
        input.score ?? null,
        input.last_run_id ?? null,
        input.last_pass_rate ?? null,
        input.routes_hash ?? null,
        this.now(),
      );
  }

  getCoverage(domain: string): Record<string, unknown> | null {
    const row = this.db
      .prepare("SELECT * FROM coverage WHERE domain = ?")
      .get(domain) as Record<string, unknown> | undefined;
    return row ?? null;
  }

  // ---- journal (SQLite, étape 6 — requêtable pour le dashboard) ------------

  appendJournal(entry: JournalEntry): void {
    this.db
      .prepare(
        `INSERT INTO journal (run_id, agent, ts, status, deliverable_path, anomalies)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.run_id,
        entry.agent,
        entry.ts,
        entry.status,
        entry.deliverable_path ?? null,
        entry.anomalies && entry.anomalies.length ? JSON.stringify(entry.anomalies) : null,
      );
  }

  queryJournal(runId: string): Record<string, unknown>[] {
    return this.db
      .prepare("SELECT * FROM journal WHERE run_id = ? ORDER BY id")
      .all(runId) as Record<string, unknown>[];
  }

  // ---- mémoire d'exécution (étape 5/6 — validation MCP différentielle) -----

  /** Enregistre les résultats d'une campagne (depuis le rapport Agent 5). */
  recordResults(runId: string, domain: string | null, results: ScenarioResult[]): number {
    const ts = this.now();
    let count = 0;
    this.db.exec("BEGIN");
    try {
      const stmt = this.db.prepare(
        `INSERT INTO scenario_runs (run_id, scenario_id, spec, title, domain, status, ts)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const r of results) {
        stmt.run(runId, r.scenario_id ?? null, r.spec ?? null, r.title ?? null, domain, r.status, ts);
        count++;
      }
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
    return count;
  }

  /**
   * Scénarios passés au vert lors de la campagne précédente (la plus récente).
   * Sert à l'Agent 4 : un test déjà vert + sélecteurs `trusted` → pas de rejeu live.
   */
  passedScenarios(domain?: string): Array<{ spec: string | null; title: string | null; scenario_id: string | null }> {
    const latest = this.db
      .prepare(
        `SELECT run_id FROM scenario_runs
         ${domain ? "WHERE domain = ?" : ""}
         ORDER BY ts DESC, id DESC LIMIT 1`,
      )
      .get(...(domain ? [domain] : [])) as { run_id?: string } | undefined;
    if (!latest?.run_id) return [];

    const params: string[] = [latest.run_id];
    if (domain) params.push(domain);
    return this.db
      .prepare(
        `SELECT spec, title, scenario_id FROM scenario_runs
         WHERE run_id = ? AND status = 'OK' ${domain ? "AND domain = ?" : ""}`,
      )
      .all(...params) as Array<{ spec: string | null; title: string | null; scenario_id: string | null }>;
  }

  // ---- export / import -----------------------------------------------------

  /** Dump complet pour versioning Git / mutualisation multi-repos. */
  export(): {
    schema_version: string;
    "browser-selectors": SelectorRow[];
    "browser-sessions": Record<string, unknown>[];
    "coverage-memory": Record<string, unknown>[];
  } {
    return {
      schema_version: AGENTDB_SCHEMA_VERSION,
      "browser-selectors": this.getSelectors(),
      "browser-sessions": this.db.prepare("SELECT * FROM sessions").all() as Record<string, unknown>[],
      "coverage-memory": this.db.prepare("SELECT * FROM coverage").all() as Record<string, unknown>[],
    };
  }
}

function toSelectorRow(r: Record<string, unknown>): SelectorRow {
  return {
    domain: String(r.domain),
    page: String(r.page),
    label: String(r.label),
    selector_primary: String(r.selector_primary),
    selector_fallback: r.selector_fallback == null ? null : String(r.selector_fallback),
    validated: Number(r.validated) === 1,
    validated_by: r.validated_by == null ? null : String(r.validated_by),
    version: Number(r.version),
    last_validated_at: r.last_validated_at == null ? null : String(r.last_validated_at),
    created_at: String(r.created_at),
    run_id: r.run_id == null ? null : String(r.run_id),
  };
}
