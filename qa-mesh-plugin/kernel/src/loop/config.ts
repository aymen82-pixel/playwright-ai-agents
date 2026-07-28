/**
 * Loops autonomes (v3) — schéma `loop.yaml`. Parseur/sérialiseur PURS,
 * réutilisent `routing/yaml.ts` (même grammaire que routing.yaml/manifest.yaml
 * — mapping + séquences de scalaires, zéro dépendance).
 */

export const DEFAULT_MAX_ITERATIONS = 3;

export interface LoopConfig {
  loop_id: string;
  /** Description du module ciblé (domaine, chemin, prose libre). */
  target: string;
  success_criteria: string;
  max_iterations: number;
  allowed_agents: string[];
  whitelist: string[];
}

/** Lit un loop.yaml parsé (objet de routing/yaml.ts) en LoopConfig. */
export function readLoopConfig(parsed: unknown): LoopConfig {
  const p = (parsed ?? {}) as Record<string, unknown>;
  return {
    loop_id: String(p.loop_id ?? ""),
    target: String(p.target ?? ""),
    success_criteria: String(p.success_criteria ?? ""),
    max_iterations: p.max_iterations != null ? Number(p.max_iterations) : DEFAULT_MAX_ITERATIONS,
    allowed_agents: Array.isArray(p.allowed_agents) ? p.allowed_agents.map(String) : [],
    whitelist: Array.isArray(p.whitelist) ? p.whitelist.map(String) : [],
  };
}

/** Sérialise un LoopConfig en loop.yaml (style routing.yaml/manifest.yaml). */
export function serializeLoopConfig(config: LoopConfig): string {
  const lines: string[] = [
    "# Loop autonome qa-mesh/2.0 (v3) — SOURCE UNIQUE de ce loop.",
    "# Lu exclusivement par le kernel (qa-mesh loop *) et le hook loop-guard.js.",
    `loop_id: ${config.loop_id}`,
    `target: ${config.target}`,
    `success_criteria: ${config.success_criteria}`,
    `max_iterations: ${config.max_iterations}`,
    "allowed_agents:",
  ];
  for (const a of config.allowed_agents) lines.push(`  - ${a}`);
  lines.push("whitelist:");
  for (const w of config.whitelist) lines.push(`  - ${w}`);
  return lines.join("\n") + "\n";
}
