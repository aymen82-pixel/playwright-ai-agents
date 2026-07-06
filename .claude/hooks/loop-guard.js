#!/usr/bin/env node
/**
 * Hook PreToolUse (Edit|Write) — loops autonomes (v3). Si un loop est actif
 * (statut running/retry), bloque toute écriture hors de sa whitelist
 * (loop.yaml) SAUF dans le dossier propre du loop (loops/<id>/*, bookkeeping).
 * Source unique de la logique de correspondance : kernel/dist/loop/whitelist.js
 * (requis directement, jamais dupliqué). Exit 0 = autorisé · Exit 2 = bloqué.
 *
 * Fail-open : si le kernel n'est pas compilé ou la base est indisponible, ne
 * jamais bloquer par accident (l'absence de vérification n'est pas un rejet).
 */
'use strict';

const path = require('node:path');

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
  });
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

  const kernelDist = path.join(__dirname, '..', '..', 'kernel', 'dist');
  let AgentDb, isPathAllowed, readLoopConfig, parseYaml, findQaDir, repoRoot, existsSync, readFileSync;
  try {
    ({ AgentDb } = require(path.join(kernelDist, 'db', 'agentdb.js')));
    ({ isPathAllowed } = require(path.join(kernelDist, 'loop', 'whitelist.js')));
    ({ readLoopConfig } = require(path.join(kernelDist, 'loop', 'config.js')));
    ({ parseYaml } = require(path.join(kernelDist, 'routing', 'yaml.js')));
    ({ findQaDir, repoRoot } = require(path.join(kernelDist, 'paths.js')));
    ({ existsSync, readFileSync } = require('node:fs'));
  } catch {
    process.exit(0); // kernel non compilé → pas de vérification possible, ne pas bloquer
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
