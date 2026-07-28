import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { AgentDb, type SelectorInput } from "../db/agentdb";
import { migrateFromJson, staleCutoff } from "../db/migrate";
import { findQaDir } from "../paths";

export interface DbOptions {
  subcommand: string;
  positionals: string[];
  flags: Map<string, string[]>;
  bools: Set<string>;
  qaDir?: string;
  now?: () => string;
  nowMs?: number;
}

export interface DbOutcome {
  exitCode: number;
  stdout: string;
}

const DB_FILE = "agentdb.sqlite";

export function runDb(opts: DbOptions): DbOutcome {
  const qaDir = opts.qaDir ?? findQaDir();
  const agentdbDir = join(qaDir, "agentdb");
  const dbPath = join(agentdbDir, DB_FILE);
  const json = opts.bools.has("json");
  const flag = (n: string) => opts.flags.get(n)?.[0];

  const db = AgentDb.open(dbPath, opts.now);
  try {
    switch (opts.subcommand) {
      case "init": {
        return ok(json, { initialized: true, path: dbPath }, `OK agentdb initialisée — ${dbPath}`);
      }

      case "migrate": {
        const summary = migrateFromJson(db, agentdbDir);
        return ok(
          json,
          summary,
          `OK migration — ${summary.selectors} sélecteurs, ${summary.sessions} sessions, ` +
            `${summary.coverage} couvertures (sources: ${summary.sources.length || "aucune"})`,
        );
      }

      case "put": {
        const inputs = readSelectorInputs(opts, flag);
        if (inputs.length === 0) {
          return fail(json, "put : aucun sélecteur (flags --domain/--label/--primary ou JSON sur stdin)");
        }
        const count = db.putSelectors(inputs);
        return ok(json, { put: count }, `OK ${count} sélecteur(s) enregistré(s)`);
      }

      case "get": {
        const rows = db.getSelectors({
          domain: flag("domain"),
          page: flag("page"),
          label: flag("label"),
          validatedOnly: opts.bools.has("validated-only"),
        });
        return ok(json, rows, `${rows.length} sélecteur(s) courant(s)`, rows);
      }

      case "pack": {
        const domain = flag("domain");
        if (!domain) return fail(json, "pack : --domain requis");
        // --fresh <durée> : fenêtre de fraîcheur pour le flag `trusted` (défaut 30d).
        const freshCutoff = staleCutoff(flag("fresh") ?? "30d", opts.nowMs ?? Date.now());
        const pack = db.pack(domain, !opts.bools.has("all"), freshCutoff);
        // pack est toujours du JSON (destiné à l'injection en prompt).
        return { exitCode: 0, stdout: JSON.stringify(pack) };
      }

      case "record-results": {
        const runId = flag("run");
        if (!runId) return fail(json, "record-results : --run <run_id> requis");
        const raw = readFileSync(0, "utf8").trim();
        if (!raw) return fail(json, "record-results : JSON attendu sur stdin (payload Agent 5 ou results[])");
        const parsed = JSON.parse(raw);
        const results = Array.isArray(parsed) ? parsed : parsed?.payload?.results ?? parsed?.results;
        if (!Array.isArray(results)) return fail(json, "record-results : `results[]` introuvable dans l'entrée");
        const domain = flag("domain") ?? parsed?.domain ?? null;
        const count = db.recordResults(runId, domain, results);
        return ok(json, { recorded: count }, `OK ${count} résultat(s) enregistré(s)`);
      }

      case "passed-scenarios": {
        const passed = db.passedScenarios(flag("domain"));
        return ok(json, passed, `${passed.length} scénario(s) verts à la campagne précédente`, passed);
      }

      case "journal": {
        const runId = flag("run");
        if (!runId) return fail(json, "journal : --run <run_id> requis");
        const rows = db.queryJournal(runId);
        return ok(json, rows, `${rows.length} événement(s) pour ${runId}`, rows);
      }

      case "similar": {
        const domain = flag("domain");
        const page = flag("page");
        const label = flag("label");
        if (!domain || !page || !label) {
          return fail(json, "similar : --domain, --page et --label requis");
        }
        const top = flag("top") ? Number(flag("top")) : 3;
        const candidates = db.similar(domain, page, label, top);
        return ok(json, candidates, `${candidates.length} candidat(s)`, candidates);
      }

      case "prune": {
        const stale = flag("stale");
        if (!stale) return fail(json, "prune : --stale <durée> requis (ex. 30d)");
        const cutoff = staleCutoff(stale, opts.nowMs ?? Date.now());
        if (opts.bools.has("dry-run")) {
          const n = db.staleSelectorCount(cutoff);
          return ok(json, { wouldPrune: n, cutoff }, `${n} sélecteur(s) seraient purgés (avant ${cutoff})`);
        }
        const n = db.pruneSelectors(cutoff);
        return ok(json, { pruned: n, cutoff }, `OK ${n} sélecteur(s) purgé(s)`);
      }

      case "export": {
        const dump = db.export();
        const out = flag("out");
        if (out) {
          writeFileSync(out, JSON.stringify(dump, null, 2) + "\n", "utf8");
          return ok(json, { exported: out }, `OK export -> ${out}`);
        }
        return { exitCode: 0, stdout: JSON.stringify(dump) };
      }

      case "session-put": {
        const role = flag("role");
        const storage = flag("storage-state");
        const expires = flag("expires");
        if (!role || !storage || !expires) {
          return fail(json, "session-put : --role, --storage-state et --expires requis");
        }
        db.putSession({ role, storage_state_path: storage, expires_at: expires, session_id: flag("session-id") });
        return ok(json, { role }, `OK session ${role} enregistrée`);
      }

      case "session-get": {
        const role = flag("role");
        if (!role) return fail(json, "session-get : --role requis");
        const session = db.getSession(role);
        return ok(json, session, session ? `session valide pour ${role}` : `aucune session valide pour ${role}`, session);
      }

      case "coverage-put": {
        const domain = flag("domain");
        if (!domain) return fail(json, "coverage-put : --domain requis");
        db.putCoverage({
          domain,
          score: flag("score") ? Number(flag("score")) : undefined,
          last_run_id: flag("last-run"),
          last_pass_rate: flag("pass-rate") ? Number(flag("pass-rate")) : undefined,
          routes_hash: flag("routes-hash"),
        });
        return ok(json, { domain }, `OK couverture ${domain} mise à jour`);
      }

      case "coverage-get": {
        const domain = flag("domain");
        if (!domain) return fail(json, "coverage-get : --domain requis");
        const cov = db.getCoverage(domain);
        return ok(json, cov, cov ? `couverture ${domain}` : `aucune couverture pour ${domain}`, cov);
      }

      default:
        return fail(json, `db : sous-commande inconnue "${opts.subcommand}"`);
    }
  } finally {
    db.close();
  }
}

function readSelectorInputs(opts: DbOptions, flag: (n: string) => string | undefined): SelectorInput[] {
  // Mode flags : un seul sélecteur.
  if (flag("domain") && flag("label") && flag("primary")) {
    return [
      {
        domain: flag("domain")!,
        page: flag("page") ?? "",
        label: flag("label")!,
        selector_primary: flag("primary")!,
        selector_fallback: flag("fallback"),
        validated: opts.bools.has("validated"),
        validated_by: flag("validated-by"),
        run_id: flag("run-id"),
      },
    ];
  }
  // Mode stdin : objet unique ou tableau JSON.
  const raw = readFileSync(0, "utf8").trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [parsed];
}

function ok(json: boolean, payload: unknown, human: string, machineOverride?: unknown): DbOutcome {
  return {
    exitCode: 0,
    stdout: json ? JSON.stringify(machineOverride ?? payload) : human,
  };
}

function fail(json: boolean, message: string): DbOutcome {
  return { exitCode: 2, stdout: json ? JSON.stringify({ error: message }) : message };
}
