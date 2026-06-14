/**
 * Manifeste unique des agents qa-mesh/2.0.
 *
 * Le manifeste (`agents/manifest.yaml`) porte les MÉTADONNÉES (name, description,
 * tools, model, color) ; le corps prose de chaque agent vit verbatim dans
 * `agents/bodies/<name>.md`. `qa-mesh compile` régénère les définitions pour
 * chaque runtime — fin du drift des 5 copies maintenues à la main.
 *
 * Contrainte clé (§9.4) : `compile --target claude` reproduit byte-identique les
 * `.claude/agents/*.md` actuels. Pour y parvenir sans se battre avec les fins de
 * ligne (certains fichiers sont en LF, d'autres en CRLF), le corps est stocké
 * verbatim et le frontmatter reconstruit avec l'eol détecté dans le corps.
 */

export interface AgentMeta {
  name: string;
  description: string;
  tools: string[];
  model: string;
  color: string;
}

export interface ParsedAgent {
  meta: AgentMeta;
  /** Tout ce qui suit la clôture du frontmatter (`---<eol>`), verbatim. */
  body: string;
}

/** Détecte l'eol dominant d'un texte. */
export function detectEol(text: string): "\r\n" | "\n" {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

/** Parse un fichier d'agent Claude (frontmatter + corps). */
export function parseAgentFile(raw: string): ParsedAgent {
  const eol = detectEol(raw);
  const fence = `---${eol}`;
  if (!raw.startsWith(fence)) {
    throw new Error("Frontmatter manquant (le fichier doit commencer par '---').");
  }
  const rest = raw.slice(fence.length);
  const closer = `${eol}---${eol}`;
  const end = rest.indexOf(closer);
  if (end === -1) {
    throw new Error("Clôture de frontmatter '---' introuvable.");
  }
  const fmText = rest.slice(0, end);
  const body = rest.slice(end + closer.length);

  const meta: Partial<AgentMeta> = {};
  for (const line of fmText.split(eol)) {
    const idx = line.indexOf(": ");
    if (idx === -1) continue;
    const key = line.slice(0, idx);
    const value = line.slice(idx + 2);
    if (key === "tools") {
      meta.tools = value.split(", ");
    } else if (key === "name" || key === "description" || key === "model" || key === "color") {
      meta[key] = value;
    }
  }

  for (const k of ["name", "description", "tools", "model", "color"] as const) {
    if (meta[k] === undefined) throw new Error(`Champ frontmatter manquant : ${k}`);
  }
  return { meta: meta as AgentMeta, body };
}

/**
 * Reconstruit le fichier d'agent Claude byte-identique : frontmatter (ordre fixe
 * name/description/tools/model/color) + corps verbatim, avec l'eol du corps.
 */
export function compileClaudeAgent(meta: AgentMeta, body: string): string {
  const eol = detectEol(body);
  const fm = [
    "---",
    `name: ${meta.name}`,
    `description: ${meta.description}`,
    `tools: ${meta.tools.join(", ")}`,
    `model: ${meta.model}`,
    `color: ${meta.color}`,
    "---",
  ].join(eol);
  return fm + eol + body;
}

/**
 * Sérialise le manifeste en YAML (sous-ensemble lu par src/routing/yaml.ts) :
 * mapping `agents` indexé par nom, corps stockés à part.
 */
export function serializeManifest(metas: AgentMeta[]): string {
  const lines: string[] = [
    "# Manifeste unique des agents qa-mesh/2.0 — SOURCE UNIQUE",
    "# Métadonnées ici ; corps prose dans agents/bodies/<name>.md (verbatim).",
    "# Régénéré par `qa-mesh manifest build`, compilé par `qa-mesh compile`.",
    "agents:",
  ];
  for (const m of metas) {
    lines.push(`  ${m.name}:`);
    lines.push(`    description: ${m.description}`);
    lines.push(`    model: ${m.model}`);
    lines.push(`    color: ${m.color}`);
    lines.push(`    tools:`);
    for (const t of m.tools) lines.push(`      - ${t}`);
  }
  return lines.join("\n") + "\n";
}

/** Lit le manifeste parsé (objet de src/routing/yaml.ts) en liste d'AgentMeta. */
export function readManifest(parsed: unknown): AgentMeta[] {
  const agents = (parsed as { agents?: Record<string, unknown> })?.agents;
  if (!agents || typeof agents !== "object") {
    throw new Error("manifest.yaml : clé 'agents' manquante.");
  }
  const out: AgentMeta[] = [];
  for (const [name, raw] of Object.entries(agents)) {
    const a = raw as Record<string, unknown>;
    out.push({
      name,
      description: String(a.description ?? ""),
      model: String(a.model ?? ""),
      color: String(a.color ?? ""),
      tools: Array.isArray(a.tools) ? a.tools.map(String) : [],
    });
  }
  return out;
}
