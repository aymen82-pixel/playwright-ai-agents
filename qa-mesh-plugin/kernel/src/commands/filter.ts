import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findQaDir } from "../paths";
import { parseYaml } from "../routing/yaml";
import { project } from "../routing/project";

export interface FilterOptions {
  /** Livrable source, ou `-` pour stdin. */
  file: string;
  /** Agent source (ex. `agent-1` ou `1`). */
  from: string;
  /** Agent cible (ex. `agent-2` ou `2`). */
  to: string;
  qaDir?: string;
  /** Chemin de routing.yaml (par défaut <qaDir>/routing.yaml). */
  routingPath?: string;
}

export interface FilterOutcome {
  exitCode: number;
  stdout: string;
}

/**
 * `qa-mesh filter --from <a> --to <b> <livrable>`
 * Projette le payload source selon l'arête `from->to` de routing.yaml.
 * Sort l'extrait JSON destiné à l'injection dans le prompt de l'agent cible.
 * Remplace la transmission sélective faite jusqu'ici en tokens par le QA Analyst.
 */
export function runFilter(opts: FilterOptions): FilterOutcome {
  const qaDir = opts.qaDir ?? findQaDir();
  const routingPath = opts.routingPath ?? join(qaDir, "routing.yaml");
  if (!existsSync(routingPath)) {
    return err(`routing.yaml introuvable : ${routingPath}`);
  }

  const routing = parseYaml(readFileSync(routingPath, "utf8")) as {
    edges?: Record<string, { fields?: string[] }>;
  } | null;

  const from = normalizeAgent(opts.from);
  const to = normalizeAgent(opts.to);
  const edgeKey = `${from}->${to}`;
  const edge = routing?.edges?.[edgeKey];
  if (!edge) {
    const known = routing?.edges ? Object.keys(routing.edges).join(", ") : "(aucune)";
    return err(`Arête inconnue : ${edgeKey}. Arêtes déclarées : ${known}`);
  }
  if (!Array.isArray(edge.fields) || edge.fields.length === 0) {
    return err(`L'arête ${edgeKey} ne déclare aucun champ`);
  }

  const raw = opts.file === "-" ? readFileSync(0, "utf8") : readFileSync(opts.file, "utf8");
  let doc: { domain?: unknown; payload?: Record<string, unknown> };
  try {
    doc = JSON.parse(raw);
  } catch (e) {
    return err(`JSON invalide : ${e instanceof Error ? e.message : String(e)}`);
  }

  // Source = payload, avec `domain` de l'enveloppe injecté s'il manque.
  const source: Record<string, unknown> = { ...(doc.payload ?? {}) };
  if (source.domain === undefined && doc.domain !== undefined) {
    source.domain = doc.domain;
  }

  const extract = project(source, edge.fields);
  return { exitCode: 0, stdout: JSON.stringify(extract) };
}

/** `1` -> `agent-1` ; `agent-1` inchangé. */
function normalizeAgent(value: string): string {
  return /^\d+$/.test(value) ? `agent-${value}` : value;
}

function err(message: string): FilterOutcome {
  return { exitCode: 2, stdout: JSON.stringify({ error: message }) };
}
