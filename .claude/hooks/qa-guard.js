#!/usr/bin/env node
/**
 * Hook PreToolUse (Edit|Write) — applique .claude/rules/testing.md de façon
 * déterministe : un agent ne peut pas écrire un spec qui viole les interdits.
 * Exit 0 = autorisé · Exit 2 = bloqué (stderr renvoyé à l'agent pour correction).
 */
'use strict';

const GUARDED_PATH = /(^|[\\/])(tests|pages|fixtures)[\\/].*\.ts$|\.(spec|page|fixture)\.ts$/;

const RULES = [
  {
    pattern: /\bwaitForTimeout\s*\(/,
    message: 'waitForTimeout est interdit — utiliser une assertion web-first auto-retry, waitForURL ou waitForResponse (.claude/rules/testing.md).',
  },
  {
    pattern: /['"`]networkidle['"`]/,
    message: "networkidle est interdit — attendre un élément ou une réponse réseau précise à la place (.claude/rules/testing.md).",
  },
  {
    pattern: /\b(?:test|describe|it)\.only\s*\(/,
    message: 'test.only / describe.only ne doit jamais être committé (.claude/rules/testing.md).',
  },
  {
    pattern: /(?:goto|navigate)\s*\(\s*['"`]https?:\/\//,
    message: "URL en dur interdite — utiliser baseURL (page.goto('/chemin')) (.claude/rules/testing.md).",
  },
  {
    pattern: /\b(?:password|mot_de_passe|passwd)\s*[:=]\s*['"`][^'"`]{4,}['"`]/i,
    message: 'Credentials en dur interdits — utiliser utils/test-data.ts + variables d\'environnement (QA_DEFAULT_PASSWORD, …).',
  },
];

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
  if (!GUARDED_PATH.test(filePath)) process.exit(0);

  // Write → content ; Edit → new_string. On ne contrôle que ce qui est AJOUTÉ.
  const added = [toolInput.content, toolInput.new_string].filter(Boolean).join('\n');
  if (!added) process.exit(0);

  const violations = RULES.filter((r) => r.pattern.test(added)).map((r) => `- ${r.message}`);

  if (violations.length > 0) {
    console.error(`qa-guard : écriture bloquée dans ${filePath}\n${violations.join('\n')}`);
    process.exit(2);
  }
  process.exit(0);
})();
