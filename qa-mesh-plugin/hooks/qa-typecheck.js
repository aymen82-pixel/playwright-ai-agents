#!/usr/bin/env node
/**
 * Hook PostToolUse (Edit|Write) — lance `npm run typecheck` après toute
 * écriture de .ts dans tests/, pages/, fixtures/ ou utils/.
 * Exit 0 = OK · Exit 2 = erreurs TS renvoyées à l'agent pour correction immédiate.
 */
'use strict';

const { execSync } = require('child_process');

const GUARDED_PATH = /(^|[\\/])(tests|pages|fixtures|utils)[\\/].*\.ts$/;
const MAX_STDERR = 4000; // tronquer pour ne pas inonder le contexte de l'agent

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
    process.exit(0);
  }

  const filePath = (input.tool_input && input.tool_input.file_path) || '';
  if (!GUARDED_PATH.test(filePath)) process.exit(0);

  try {
    execSync('npm run typecheck', { stdio: 'pipe', timeout: 110000 });
    process.exit(0);
  } catch (err) {
    const out = [err.stdout, err.stderr]
      .filter(Boolean)
      .map(String)
      .join('\n')
      .slice(0, MAX_STDERR);
    // Outillage absent (script manquant, tsc non installé) → avertir sans
    // bloquer : le hook doit rester portable sur des projets non configurés.
    if (/missing script|n[’']est pas reconnu|not recognized|command not found|ENOENT/i.test(out)) {
      console.error('qa-typecheck : outillage absent (npm run typecheck indisponible) — vérification sautée. Installer typescript en devDependency.');
      process.exit(0);
    }
    console.error(`qa-typecheck : la compilation TypeScript échoue après modification de ${filePath} — corriger avant de continuer.\n${out}`);
    process.exit(2);
  }
})();
