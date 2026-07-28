/**
 * Loops autonomes (v3) — appariement chemin/whitelist. Fonctions PURES,
 * réutilisées à la fois par `loop verify` (kernel/src/loop/verify.ts) et par
 * le hook `loop-guard.js` (source unique — pas de duplication de logique).
 *
 * Grammaire de motif supportée : littéral, `*` (un segment), `**` (profondeur
 * quelconque). Suffisant pour des whitelists de chemins de fichiers.
 */

function globToRegex(pattern: string): RegExp {
  const normalized = pattern.replace(/\\/g, "/");
  let re = "";
  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i];
    if (c === "*") {
      if (normalized[i + 1] === "*") {
        re += ".*";
        i++;
        if (normalized[i + 1] === "/") i++; // "**/" -> profondeur zéro ou plus
      } else {
        re += "[^/]*";
      }
    } else if ("+.()^${}|[]\\".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`);
}

export function isPathAllowed(path: string, whitelist: string[]): boolean {
  const norm = path.replace(/\\/g, "/");
  return whitelist.some((pattern) => globToRegex(pattern).test(norm));
}

export interface ScopeCheck {
  ok: boolean;
  motifs: string[];
}

/** Vérifie que tous les fichiers modifiés sont couverts par la whitelist. */
export function checkScope(changedFiles: string[], whitelist: string[]): ScopeCheck {
  const outside = changedFiles.filter((f) => !isPathAllowed(f, whitelist));
  if (outside.length === 0) return { ok: true, motifs: [] };
  return { ok: false, motifs: outside.map((f) => `hors whitelist : ${f}`) };
}
