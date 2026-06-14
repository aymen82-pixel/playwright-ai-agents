import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Localise le répertoire `.qa` du projet en remontant depuis un point de départ.
 * Ordre de résolution :
 *   1. variable d'environnement `QA_DIR` (chemin absolu vers `.qa`)
 *   2. recherche ascendante d'un dossier `.qa` depuis `startDir` jusqu'à la racine
 *
 * Rend le kernel invocable depuis n'importe quel cwd, sur les 5 runtimes,
 * sans dépendre de l'emplacement d'installation du CLI.
 */
export function findQaDir(startDir: string = process.cwd()): string {
  const fromEnv = process.env.QA_DIR;
  if (fromEnv && existsSync(fromEnv)) {
    return resolve(fromEnv);
  }

  let dir = resolve(startDir);
  // Remontée bornée par la racine du système de fichiers.
  for (;;) {
    const candidate = join(dir, ".qa");
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  throw new Error(
    "Répertoire `.qa` introuvable. Lancer qa-mesh depuis un projet QA ou définir QA_DIR.",
  );
}

export function contractsDir(qaDir: string): string {
  return join(qaDir, "contracts");
}

export function runsDir(qaDir: string): string {
  return join(qaDir, "runs");
}

export function runDir(qaDir: string, runId: string): string {
  return join(runsDir(qaDir), runId);
}
