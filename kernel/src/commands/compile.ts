import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { findQaDir, repoRoot } from "../paths";
import { parseYaml } from "../routing/yaml";
import { readManifest, readRules, type AgentMeta } from "../manifest/manifest";
import { compileTarget, TARGETS, type OutputFile, type RuleFile, type Target } from "../manifest/targets";

export interface CompileOptions {
  target: string;
  /** Mode vérification : compare aux fichiers existants, n'écrit rien. */
  check?: boolean;
  /** Liste les fichiers sans écrire. */
  dryRun?: boolean;
  json?: boolean;
  qaDir?: string;
}

export interface CompileOutcome {
  exitCode: number;
  stdout: string;
}

export function runCompile(opts: CompileOptions): CompileOutcome {
  if (!TARGETS.includes(opts.target as Target)) {
    return fail(opts.json, `compile : cible inconnue "${opts.target}". Cibles : ${TARGETS.join(", ")}`);
  }
  const target = opts.target as Target;
  const root = repoRoot(opts.qaDir ?? findQaDir());

  const { agents, rules } = loadAgents(root);
  const outputs = compileTarget(target, agents, rules);

  if (opts.check) {
    return runCheck(root, outputs, opts.json);
  }
  if (opts.dryRun) {
    const list = outputs.map((o) => o.path);
    return {
      exitCode: 0,
      stdout: opts.json ? JSON.stringify({ wouldWrite: list }) : list.map((p) => `+ ${p}`).join("\n"),
    };
  }

  for (const out of outputs) {
    const abs = join(root, out.path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, out.content, "utf8");
  }
  return {
    exitCode: 0,
    stdout: opts.json
      ? JSON.stringify({ target, written: outputs.map((o) => o.path) })
      : `OK compile ${target} — ${outputs.length} fichier(s) écrit(s)`,
  };
}

interface AgentInput {
  meta: AgentMeta;
  body: string;
}

function loadAgents(root: string): { agents: AgentInput[]; rules: RuleFile[] } {
  const agentsDir = join(root, "agents");
  const manifestPath = join(agentsDir, "manifest.yaml");
  if (!existsSync(manifestPath)) {
    throw new Error(`manifest.yaml introuvable : ${manifestPath} (lancer 'qa-mesh manifest build').`);
  }
  const parsed = parseYaml(readFileSync(manifestPath, "utf8"));
  const agents = readManifest(parsed).map((meta) => {
    const bodyPath = join(agentsDir, "bodies", `${meta.name}.md`);
    if (!existsSync(bodyPath)) {
      throw new Error(`Corps manquant pour ${meta.name} : ${bodyPath}`);
    }
    return { meta, body: readFileSync(bodyPath, "utf8") };
  });
  // Règles partagées (doctrine source unique) — contenu lu depuis le projet.
  const rules: RuleFile[] = readRules(parsed)
    .filter((p) => existsSync(join(root, p)))
    .map((p) => ({ path: p, content: readFileSync(join(root, p), "utf8") }));
  return { agents, rules };
}

/** Compare chaque sortie au fichier sur disque — preuve de non-régression. */
function runCheck(root: string, outputs: OutputFile[], asJson?: boolean): CompileOutcome {
  const mismatches: string[] = [];
  const missing: string[] = [];
  for (const out of outputs) {
    const abs = join(root, out.path);
    if (!existsSync(abs)) {
      missing.push(out.path);
      continue;
    }
    if (readFileSync(abs, "utf8") !== out.content) {
      mismatches.push(out.path);
    }
  }
  const ok = mismatches.length === 0 && missing.length === 0;
  if (asJson) {
    return { exitCode: ok ? 0 : 1, stdout: JSON.stringify({ ok, mismatches, missing }) };
  }
  if (ok) {
    return { exitCode: 0, stdout: `OK byte-identique — ${outputs.length} fichier(s) conforme(s)` };
  }
  const lines = ["KO compile --check :"];
  for (const m of mismatches) lines.push(`  diff  ${m}`);
  for (const m of missing) lines.push(`  absent ${m}`);
  return { exitCode: 1, stdout: lines.join("\n") };
}

function fail(json: boolean | undefined, message: string): CompileOutcome {
  return { exitCode: 2, stdout: json ? JSON.stringify({ error: message }) : message };
}
