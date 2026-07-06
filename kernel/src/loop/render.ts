/**
 * Loops autonomes (v3) — rendu PURE de PROGRESS.md depuis l'historique SQLite
 * (`AgentDb.loopIterations`). Jamais écrit à la main — régénéré à chaque
 * `qa-mesh loop decide`. Max 10 lignes par itération (règle du plan v3).
 */
import type { LoopIterationRow } from "../db/agentdb";
import type { LoopConfig } from "./config";

const MAX_LINES_PER_ITERATION = 10;

/**
 * Ne garde que la dernière ligne connue pour chaque (run_id, itération) — un
 * loop accumule l'historique de PLUSIEURS campagnes ; les numéros d'itération
 * repartent de 1 à chaque run_id, donc le groupement doit inclure le run_id.
 */
function latestPerIteration(rows: LoopIterationRow[]): LoopIterationRow[] {
  const byKey = new Map<string, LoopIterationRow>();
  for (const r of rows) byKey.set(`${r.run_id}#${r.iteration}`, r); // rows déjà triées par id croissant
  return [...byKey.values()].sort((a, b) => a.run_id.localeCompare(b.run_id) || a.iteration - b.iteration);
}

function renderIteration(row: LoopIterationRow): string[] {
  const lines = [
    `- ${row.ts} · run ${row.run_id} · itération ${row.iteration} · agent=${row.agent ?? "-"} · verdict=${row.verdict ?? "-"} · statut=${row.status}`,
  ];
  const motifs = row.motifs ?? [];
  const bodyBudget = MAX_LINES_PER_ITERATION - 1; // lignes disponibles hors en-tête
  const truncated = motifs.length > bodyBudget;
  // Si troncature, réserver 1 ligne pour le résumé "… (+N autres)".
  const shown = motifs.slice(0, truncated ? bodyBudget - 1 : bodyBudget);
  for (const m of shown) lines.push(`  - ${m}`);
  if (truncated) lines.push(`  - … (+${motifs.length - shown.length} autre(s))`);
  return lines;
}

export function renderProgress(config: LoopConfig, rows: LoopIterationRow[]): string {
  const header = [
    `# Progression — loop \`${config.loop_id}\``,
    "",
    "> Fichier généré par le kernel (`qa-mesh loop decide`). Ne jamais éditer à la main.",
    "",
  ];
  const body = latestPerIteration(rows).flatMap(renderIteration);
  return [...header, ...body, ""].join("\n");
}
