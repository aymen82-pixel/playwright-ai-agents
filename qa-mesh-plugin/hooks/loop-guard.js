#!/usr/bin/env node
/**
 * Hook PreToolUse (Edit|Write) — loops autonomes (v3). Si un loop est actif
 * (statut running/retry), bloque toute écriture hors de sa whitelist
 * (loop.yaml) SAUF dans le dossier propre du loop (loops/<id>/*, bookkeeping).
 * Source unique de la logique de correspondance : kernel/dist/loop/whitelist.js
 * (requis directement, jamais dupliqué). Exit 0 = autorisé · Exit 2 = bloqué.
 *
 * Le kernel vit TOUJOURS dans le projet cible (jamais dans le cache du
 * plugin), donc on le localise par recherche ascendante depuis le cwd —
 * PAS relative à __dirname, qui pointe vers ${CLAUDE_PLUGIN_ROOT}/hooks/
 * quand ce hook est installé via le plugin, un emplacement différent du
 * projet et donc du kernel.
 *
 * Fail-open : si le kernel n'est pas compilé ou la base est indisponible, ne
 * jamais bloquer par accident (l'absence de vérification n'est pas un rejet).
 */
'use strict';

const path = require('node:path');
const { existsSync, readFileSync } = require('node:fs');

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
  });
}

/** Recherche ascendante de kernel/dist/db/agentdb.js depuis `startDir`. */
function findKernelDist(startDir) {
  let dir = startDir;
  for (;;) {
    const candidate = path.join(dir, 'kernel', 'dist');
    if (existsSync(path.join(candidate, 'db', 'agentdb.js'))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null; // racine du système de fichiers atteinte
    dir = parent;
  }
}

(async () => {
  let input;
  try {
    input = JSON.parse(await readStdin());
  } catch {
    process.exit(0); // entrée illisible → ne jamais bloquer par accident
  }

  const toolInput = input.tool_input || {};
  const filePath = toolInput.file_path || '';
  if (!filePath) process.exit(0);

  const kernelDist = findKernelDist(process.cwd());
  if (!kernelDist) process.exit(0); // kernel non compilé/absent → pas de vérification possible

  let AgentDb, isPathAllowed, readLoopConfig, parseYaml, findQaDir, repoRoot;
  try {
    ({ AgentDb } = require(path.join(kernelDist, 'db', 'agentdb.js')));
    ({ isPathAllowed } = require(path.join(kernelDist, 'loop', 'whitelist.js')));
    ({ readLoopConfig } = require(path.join(kernelDist, 'loop', 'config.js')));
    ({ parseYaml } = require(path.join(kernelDist, 'routing', 'yaml.js')));
    ({ findQaDir, repoRoot } = require(path.join(kernelDist, 'paths.js')));
  } catch {
    process.exit(0); // kernel incomplet/corrompu → ne pas bloquer
  }

  let qaDir, root;
  try {
    qaDir = findQaDir();
    root = repoRoot(qaDir);
  } catch {
    process.exit(0); // hors d'un projet qa-mesh → rien à garder
  }

  const relPath = path.isAbsolute(filePath) ? path.relative(root, filePath) : filePath;
  const normalized = relPath.split(path.sep).join('/');
  // Le cwd du process hook peut appartenir à un AUTRE projet que celui édité
  // (ex. deux repos qa-mesh ouverts dans la même session). Si le fichier
  // cible n'est pas sous le `root` trouvé, ce loop n'a rien à en dire.
  if (relPath.startsWith('..') || path.isAbsolute(relPath)) process.exit(0);

  let active;
  try {
    const db = AgentDb.open(path.join(qaDir, 'agentdb', 'agentdb.sqlite'));
    active = db.activeLoops();
    db.close();
  } catch {
    process.exit(0); // base indisponible → ne pas bloquer
  }
  if (!active.length) process.exit(0); // aucun loop actif → rien à garder

  // Autorisé si couvert par AU MOINS UN loop actif (des loops parallèles sur des
  // scopes différents ne doivent pas se bloquer mutuellement) OU si c'est le
  // bookkeeping propre de ce loop (loop.yaml, TASK.md, PROGRESS.md, outputs/).
  const scopes = [];
  let allowed = false;
  for (const loop of active) {
    if (normalized.startsWith(`loops/${loop.loop_id}/`)) {
      allowed = true;
      break;
    }
    const yamlPath = path.join(root, 'loops', loop.loop_id, 'loop.yaml');
    if (!existsSync(yamlPath)) continue;
    const config = readLoopConfig(parseYaml(readFileSync(yamlPath, 'utf8')));
    scopes.push(`- loop "${loop.loop_id}" (${loop.status}) : whitelist = [${config.whitelist.join(', ')}]`);
    if (isPathAllowed(normalized, config.whitelist)) {
      allowed = true;
      break;
    }
  }

  if (!allowed) {
    console.error(`loop-guard : écriture bloquée dans ${normalized} — hors whitelist de tous les loops actifs :\n${scopes.join('\n')}`);
    process.exit(2);
  }
  process.exit(0);
})();
