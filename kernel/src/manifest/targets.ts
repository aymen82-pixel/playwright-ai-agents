import { compileClaudeAgent, type AgentMeta } from "./manifest";

/** Fichier de sortie produit par la compilation. */
export interface OutputFile {
  /** Chemin relatif à la racine du projet. */
  path: string;
  content: string;
}

export const TARGETS = ["claude", "opencode", "codex", "copilot", "gemini"] as const;
export type Target = (typeof TARGETS)[number];

/** Serveur MCP unique de la plateforme (décision §7 : un seul serveur). */
const MCP_COMMAND = "npx";
const MCP_ARGS = ["playwright", "run-test-mcp-server"];

interface AgentInput {
  meta: AgentMeta;
  body: string;
}

/**
 * Compile le manifeste vers les fichiers d'un runtime : définitions d'agents +
 * déclaration du serveur MCP (fin du drift, §7).
 */
export function compileTarget(target: Target, agents: AgentInput[]): OutputFile[] {
  switch (target) {
    case "claude":
      return [
        ...agents.map((a) => ({
          path: `.claude/agents/${a.meta.name}.md`,
          content: compileClaudeAgent(a.meta, a.body), // byte-identique
        })),
        { path: ".mcp.json", content: json({ mcpServers: { "playwright-test": { command: MCP_COMMAND, args: MCP_ARGS } } }) },
      ];

    case "opencode":
      return [
        ...agents.map((a) => ({
          path: `.opencode/agent/${a.meta.name}.md`,
          content: opencodeAgent(a),
        })),
        {
          path: "opencode.json",
          content: json({
            $schema: "https://opencode.ai/config.json",
            mcp: { "playwright-test": { type: "local", command: [MCP_COMMAND, ...MCP_ARGS], enabled: true } },
          }),
        },
      ];

    case "codex":
      return [
        { path: "AGENTS.md", content: bundle(agents, "Codex") },
        { path: ".codex/config.toml", content: codexToml() },
      ];

    case "copilot":
      return [
        { path: ".github/copilot-instructions.md", content: bundle(agents, "GitHub Copilot") },
        { path: ".vscode/mcp.json", content: json({ servers: { "playwright-test": { command: MCP_COMMAND, args: MCP_ARGS } } }) },
      ];

    case "gemini":
      return [
        { path: "GEMINI.md", content: bundle(agents, "Gemini CLI") },
        { path: ".gemini/settings.json", content: json({ mcpServers: { "playwright-test": { command: MCP_COMMAND, args: MCP_ARGS } } }) },
      ];
  }
}

function json(obj: unknown): string {
  return JSON.stringify(obj, null, 2) + "\n";
}

/** Agent OpenCode : frontmatter md + tools en map. Corps normalisé en LF. */
function opencodeAgent(a: AgentInput): string {
  const body = a.body.replace(/\r\n/g, "\n");
  const toolLines = a.meta.tools.map((t) => `  ${t}: true`).join("\n");
  return (
    "---\n" +
    `description: ${a.meta.description}\n` +
    "mode: subagent\n" +
    `model: ${a.meta.model}\n` +
    "tools:\n" +
    toolLines +
    "\n---\n" +
    body
  );
}

/** Bundle d'instructions unique (runtimes sans sous-agents fichiers dédiés). */
function bundle(agents: AgentInput[], runtime: string): string {
  const parts = [
    `# Agents qa-mesh — bundle ${runtime} (généré par \`qa-mesh compile\`)`,
    "",
    "> Source unique : agents/manifest.yaml + agents/bodies/. Ne pas éditer ici.",
    "",
  ];
  for (const a of agents) {
    const body = a.body.replace(/\r\n/g, "\n").replace(/^\n+/, "");
    parts.push(`## ${a.meta.name} (${a.meta.model})`);
    parts.push("");
    parts.push(a.meta.description);
    parts.push("");
    parts.push(`**Outils autorisés :** ${a.meta.tools.join(", ")}`);
    parts.push("");
    parts.push(body.trimEnd());
    parts.push("");
    parts.push("---");
    parts.push("");
  }
  return parts.join("\n");
}

function codexToml(): string {
  return (
    "# Fragment à fusionner dans ~/.codex/config.toml (généré par qa-mesh compile)\n" +
    "[mcp_servers.playwright-test]\n" +
    `command = "${MCP_COMMAND}"\n` +
    `args = [${MCP_ARGS.map((a) => `"${a}"`).join(", ")}]\n`
  );
}
