import { readFileSync } from "node:fs";
import { ContractRegistry } from "../contracts";
import { findQaDir } from "../paths";

export interface ValidateOptions {
  /** Fichier livrable, ou `-` pour stdin. */
  file: string;
  /** Force l'identifiant agent (sinon déduit de l'enveloppe). */
  agent?: string;
  /** Sortie JSON machine au lieu du format humain. */
  json?: boolean;
  qaDir?: string;
}

export interface ValidateOutcome {
  exitCode: number;
  stdout: string;
}

/**
 * `qa-mesh validate <file> [--agent id] [--json]`
 * Valide un livrable contre l'enveloppe + le contrat de payload de l'agent.
 * Remplace la validation faite jusqu'ici en tokens sonnet par le QA Analyst.
 */
export function runValidate(opts: ValidateOptions): ValidateOutcome {
  const qaDir = opts.qaDir ?? findQaDir();
  const registry = ContractRegistry.load(qaDir);

  const raw = opts.file === "-"
    ? readFileSync(0, "utf8")
    : readFileSync(opts.file, "utf8");

  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return emit(opts.json, {
      valid: false,
      agent: opts.agent ?? null,
      errors: [{ layer: "envelope", path: "/", message: `JSON invalide : ${message}` }],
    });
  }

  const agentId = opts.agent ?? (doc as { agent?: string })?.agent ?? null;
  const result = registry.validateDeliverable(doc, opts.agent);

  return emit(opts.json, {
    valid: result.valid,
    agent: agentId,
    errors: result.errors,
  });
}

interface Report {
  valid: boolean;
  agent: string | null;
  errors: { layer: string; path: string; message: string }[];
}

function emit(asJson: boolean | undefined, report: Report): ValidateOutcome {
  if (asJson) {
    return { exitCode: report.valid ? 0 : 1, stdout: JSON.stringify(report) };
  }
  const agent = report.agent ?? "?";
  if (report.valid) {
    return { exitCode: 0, stdout: `OK ${agent} — livrable conforme` };
  }
  const lines = [`KO ${agent} — ${report.errors.length} erreur(s) :`];
  for (const err of report.errors) {
    lines.push(`  [${err.layer}] ${err.path} ${err.message}`);
  }
  return { exitCode: 1, stdout: lines.join("\n") };
}
