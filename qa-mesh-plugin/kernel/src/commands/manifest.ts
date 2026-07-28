import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { findQaDir, repoRoot } from "../paths";
import { parseAgentFile, serializeManifest, type AgentMeta } from "../manifest/manifest";

export interface ManifestOptions {
  subcommand: string;
  /** Dossier source des agents Claude (défaut .claude/agents). */
  source?: string;
  json?: boolean;
  qaDir?: string;
}

export interface ManifestOutcome {
  exitCode: number;
  stdout: string;
}

/**
 * `qa-mesh manifest build` — migre les `.claude/agents/*.md` vers la source
 * unique : `agents/manifest.yaml` (métadonnées) + `agents/bodies/<name>.md`
 * (corps verbatim). Outil de migration de l'étape 4.
 */
export function runManifest(opts: ManifestOptions): ManifestOutcome {
  const root = repoRoot(opts.qaDir ?? findQaDir());
  if (opts.subcommand !== "build") {
    return fail(opts.json, `manifest : sous-commande inconnue "${opts.subcommand}"`);
  }

  const sourceDir = opts.source ?? join(root, ".claude", "agents");
  const agentsDir = join(root, "agents");
  const bodiesDir = join(agentsDir, "bodies");
  mkdirSync(bodiesDir, { recursive: true });

  const files = readdirSync(sourceDir).filter((f) => f.endsWith(".md")).sort();
  const metas: AgentMeta[] = [];
  for (const file of files) {
    const raw = readFileSync(join(sourceDir, file), "utf8");
    const { meta, body } = parseAgentFile(raw);
    metas.push(meta);
    // Corps verbatim (préserve l'eol propre à chaque fichier).
    writeFileSync(join(bodiesDir, `${meta.name}.md`), body, "utf8");
  }

  // Règles partagées (doctrine source unique) : déclarées dans le manifeste.
  const rulesDir = join(root, ".claude", "rules");
  const rules = existsSync(rulesDir)
    ? readdirSync(rulesDir).filter((f) => f.endsWith(".md")).sort().map((f) => `.claude/rules/${f}`)
    : [];

  const manifestPath = join(agentsDir, "manifest.yaml");
  writeFileSync(manifestPath, serializeManifest(metas, rules), "utf8");

  const summary = { agents: metas.length, manifest: manifestPath, bodies: bodiesDir };
  return {
    exitCode: 0,
    stdout: opts.json
      ? JSON.stringify(summary)
      : `OK manifeste construit — ${metas.length} agents -> ${manifestPath}`,
  };
}

function fail(json: boolean | undefined, message: string): ManifestOutcome {
  return { exitCode: 2, stdout: json ? JSON.stringify({ error: message }) : message };
}
