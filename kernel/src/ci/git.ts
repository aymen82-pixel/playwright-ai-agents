/**
 * Coverage Intelligence — facteur git (étape 9). Mappe les fichiers modifiés
 * récemment vers des domaines et calcule un score de récence décroissant.
 * Le parsing est PUR ; l'invocation `git log` vit dans la commande.
 */
import type { GitActivityInput } from "../db/agentdb";

const SEGMENT_DIRS = ["pages", "tests", "src", "app", "components", "features", "modules"];

/**
 * Mappe un chemin de fichier vers un domaine :
 *  1. préfixe explicite de `path_domain_map` (config) ;
 *  2. heuristique `<dir>/<domaine>/…` où dir ∈ pages/tests/src/… et domaine connu ;
 *  3. premier segment s'il est un domaine connu.
 * Retourne `null` si non rattachable (le fichier est alors ignoré).
 */
export function mapPathToDomain(
  path: string,
  pathDomainMap: Record<string, string>,
  knownDomains: Set<string>,
): string | null {
  const norm = path.replace(/\\/g, "/");
  for (const [prefix, domain] of Object.entries(pathDomainMap)) {
    if (norm.startsWith(prefix.replace(/\\/g, "/"))) return domain;
  }
  const segs = norm.split("/").filter(Boolean);
  for (let i = 0; i < segs.length - 1; i++) {
    if (SEGMENT_DIRS.includes(segs[i]) && knownDomains.has(segs[i + 1])) {
      return segs[i + 1];
    }
  }
  if (segs.length && knownDomains.has(segs[0])) return segs[0];
  return null;
}

interface RawCommitFile {
  path: string;
  committedAtMs: number;
}

/**
 * Parse la sortie de `git log --name-only --pretty=format:"%x1f%cI"`.
 * `%x1f` (separator) préfixe chaque ligne de date de commit ; les lignes
 * suivantes non vides sont les fichiers touchés.
 */
export function parseGitLog(raw: string): RawCommitFile[] {
  const out: RawCommitFile[] = [];
  let currentMs = NaN;
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith("\x1f")) {
      const iso = line.slice(1).trim();
      currentMs = Date.parse(iso);
      continue;
    }
    const file = line.trim();
    if (file && Number.isFinite(currentMs)) {
      out.push({ path: file, committedAtMs: currentMs });
    }
  }
  return out;
}

/**
 * Agrège les commits par fichier rattachable à un domaine :
 * récence = Σ exp(-âge_jours / τ), commits_window = nombre de commits.
 */
export function computeGitActivity(
  commits: RawCommitFile[],
  opts: {
    pathDomainMap: Record<string, string>;
    knownDomains: Set<string>;
    tauDays: number;
    nowMs: number;
  },
): GitActivityInput[] {
  const byPath = new Map<string, { domain: string; commits: number; recency: number; lastMs: number }>();
  for (const c of commits) {
    const domain = mapPathToDomain(c.path, opts.pathDomainMap, opts.knownDomains);
    if (!domain) continue;
    const ageDays = Math.max(0, (opts.nowMs - c.committedAtMs) / 86_400_000);
    const decay = Math.exp(-ageDays / Math.max(1, opts.tauDays));
    const entry = byPath.get(c.path) ?? { domain, commits: 0, recency: 0, lastMs: 0 };
    entry.commits += 1;
    entry.recency += decay;
    entry.lastMs = Math.max(entry.lastMs, c.committedAtMs);
    byPath.set(c.path, entry);
  }
  return [...byPath.entries()].map(([path, e]) => ({
    path,
    domain: e.domain,
    last_changed_at: new Date(e.lastMs).toISOString(),
    commits_window: e.commits,
    recency_score: Math.round(e.recency * 1000) / 1000,
  }));
}
