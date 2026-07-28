import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  compileClaudeAgent,
  parseAgentFile,
  readManifest,
  serializeManifest,
  type AgentMeta,
} from "./manifest";
import { compileTarget } from "./targets";
import { parseYaml } from "../routing/yaml";

const CLAUDE_AGENTS = resolve(__dirname, "..", "..", "..", ".claude", "agents");

test("parseAgentFile extrait métadonnées + corps", () => {
  const raw =
    "---\nname: foo\ndescription: une desc avec : deux-points\ntools: Read, Write\nmodel: haiku\ncolor: pink\n---\n\n# Corps\ntexte\n";
  const { meta, body } = parseAgentFile(raw);
  assert.equal(meta.name, "foo");
  assert.equal(meta.description, "une desc avec : deux-points");
  assert.deepEqual(meta.tools, ["Read", "Write"]);
  assert.equal(meta.model, "haiku");
  assert.equal(meta.color, "pink");
  assert.equal(body, "\n# Corps\ntexte\n");
});

test("compileClaudeAgent est l'inverse exact de parseAgentFile (LF)", () => {
  const raw =
    "---\nname: foo\ndescription: d\ntools: Read, Write\nmodel: haiku\ncolor: pink\n---\n\n# Corps\n";
  const { meta, body } = parseAgentFile(raw);
  assert.equal(compileClaudeAgent(meta, body), raw);
});

test("compileClaudeAgent préserve l'eol CRLF", () => {
  const raw =
    "---\r\nname: foo\r\ndescription: d\r\ntools: Read\r\nmodel: haiku\r\ncolor: pink\r\n---\r\n\r\n# Corps\r\n";
  const { meta, body } = parseAgentFile(raw);
  assert.equal(compileClaudeAgent(meta, body), raw);
});

test("NON-RÉGRESSION : compile reproduit byte-identique les 13 agents Claude", () => {
  const files = readdirSync(CLAUDE_AGENTS).filter((f) => f.endsWith(".md"));
  assert.ok(files.length >= 13, `attendu >= 13 agents, vu ${files.length}`);
  for (const file of files) {
    const original = readFileSync(join(CLAUDE_AGENTS, file), "utf8");
    const { meta, body } = parseAgentFile(original);
    const recompiled = compileClaudeAgent(meta, body);
    assert.equal(recompiled, original, `byte-identique échoué pour ${file}`);
  }
});

test("serializeManifest -> parseYaml -> readManifest round-trip", () => {
  const metas: AgentMeta[] = [
    { name: "a-agent", description: "desc a: avec colon", model: "haiku", color: "pink", tools: ["Read", "Write"] },
    { name: "b-agent", description: "desc b", model: "sonnet", color: "blue", tools: ["Bash"] },
  ];
  const yaml = serializeManifest(metas);
  const back = readManifest(parseYaml(yaml));
  assert.deepEqual(back, metas);
});

test("compileTarget claude : 13 agents + .mcp.json avec le serveur unique", () => {
  const agents = [
    { meta: { name: "x", description: "d", model: "haiku", color: "pink", tools: ["Read"] }, body: "\n# x\n" },
  ];
  const out = compileTarget("claude", agents);
  assert.ok(out.some((o) => o.path === ".claude/agents/x.md"));
  const mcp = out.find((o) => o.path === ".mcp.json");
  assert.ok(mcp, ".mcp.json doit être émis");
  assert.match(mcp!.content, /playwright-test/);
  assert.match(mcp!.content, /run-test-mcp-server/);
});

test("compileTarget bundle : injecte les règles partagées (doctrine, étape 8)", () => {
  const agents = [
    { meta: { name: "x", description: "d", model: "haiku", color: "pink", tools: ["Read"] }, body: "\n# x\n" },
  ];
  const rules = [{ path: ".claude/rules/selectors.md", content: "# Sélecteurs\nPriorité: getByRole d'abord." }];
  const out = compileTarget("gemini", agents, rules);
  const bundleFile = out.find((o) => o.path === "GEMINI.md");
  assert.ok(bundleFile, "GEMINI.md attendu");
  assert.match(bundleFile!.content, /Règles partagées/);
  assert.match(bundleFile!.content, /Priorité: getByRole d'abord/);
});

test("compileTarget : chaque runtime émet sa config MCP", () => {
  const agents = [
    { meta: { name: "x", description: "d", model: "haiku", color: "pink", tools: ["Read"] }, body: "\n# x\n" },
  ];
  const expected: Record<string, string> = {
    opencode: "opencode.json",
    codex: ".codex/config.toml",
    copilot: ".vscode/mcp.json",
    gemini: ".gemini/settings.json",
  };
  for (const [target, configPath] of Object.entries(expected)) {
    const out = compileTarget(target as any, agents);
    const cfg = out.find((o) => o.path === configPath);
    assert.ok(cfg, `${target} doit émettre ${configPath}`);
    assert.match(cfg!.content, /playwright/);
  }
});
