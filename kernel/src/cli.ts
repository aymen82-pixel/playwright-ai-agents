#!/usr/bin/env node
import { runValidate } from "./commands/validate";
import { runJournal } from "./commands/journal";
import { runDb } from "./commands/db";

const VERSION = "2.0.0-alpha.1";

const USAGE = `qa-mesh ${VERSION} — kernel déterministe qa-mesh/2.0

Usage :
  qa-mesh validate <file|-> [--agent <id>] [--json]
      Valide un livrable contre l'enveloppe + le contrat de payload de l'agent.
      <-> lit le livrable sur stdin. Code de sortie 0 si conforme, 1 sinon.

  qa-mesh journal <run_id> --agent <id> --status <ok|partial|error|retry|skipped>
                  [--deliverable <path>] [--anomaly <msg> ...]
                  [--start <iso>] [--end <iso>] [--json]
      Ajoute une ligne JSONL à .qa/runs/<run_id>/pipeline.log.

  qa-mesh db <sous-commande> [options]   (AgentDB v2 — SQLite)
      init                          Crée .qa/agentdb/agentdb.sqlite + schéma.
      migrate                       Importe les .qa/agentdb/*.json legacy.
      put [--domain --page --label --primary [--fallback] [--validated]
           [--validated-by] [--run-id]] | (JSON objet/tableau sur stdin)
      get [--domain] [--page] [--label] [--validated-only] [--json]
      pack --domain <d> [--for <agent>] [--all]   (JSON pour injection prompt)
      similar --domain <d> --page <p> --label <l> [--top <n>]  (healing)
      prune --stale <30d|24h|…> [--dry-run]
      export [--out <fichier>]
      session-put|session-get --role <r> [--storage-state --expires --session-id]
      coverage-put|coverage-get --domain <d> [--score --last-run --pass-rate --routes-hash]

  qa-mesh --version | --help

Résolution de .qa : $QA_DIR, sinon recherche ascendante depuis le cwd.`;

/** Parseur d'arguments minimal — zéro dépendance (principe « kernel léger »). */
interface ParsedArgs {
  positionals: string[];
  flags: Map<string, string[]>;
  bools: Set<string>;
}

function parse(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags = new Map<string, string[]>();
  const bools = new Set<string>();
  const valued = new Set([
    "agent", "status", "deliverable", "anomaly", "start", "end", "qa-dir",
    // db
    "domain", "page", "label", "primary", "fallback", "validated-by", "run-id",
    "for", "top", "stale", "out", "role", "storage-state", "expires",
    "session-id", "score", "last-run", "pass-rate", "routes-hash",
  ]);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const name = arg.slice(2);
      if (valued.has(name)) {
        const value = argv[++i];
        if (value === undefined) {
          throw new Error(`Option --${name} attend une valeur`);
        }
        const list = flags.get(name) ?? [];
        list.push(value);
        flags.set(name, list);
      } else {
        bools.add(name);
      }
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, flags, bools };
}

function first(args: ParsedArgs, name: string): string | undefined {
  return args.flags.get(name)?.[0];
}

function main(argv: string[]): number {
  if (argv.includes("--version") || argv[0] === "version") {
    process.stdout.write(VERSION + "\n");
    return 0;
  }
  if (argv.length === 0 || argv.includes("--help") || argv[0] === "help") {
    process.stdout.write(USAGE + "\n");
    return argv.length === 0 ? 1 : 0;
  }

  const [command, ...rest] = argv;
  const args = parse(rest);
  const qaDir = first(args, "qa-dir");

  try {
    switch (command) {
      case "validate": {
        const file = args.positionals[0];
        if (!file) {
          process.stderr.write("validate : fichier manquant (ou '-' pour stdin)\n");
          return 2;
        }
        const outcome = runValidate({
          file,
          agent: first(args, "agent"),
          json: args.bools.has("json"),
          qaDir,
        });
        process.stdout.write(outcome.stdout + "\n");
        return outcome.exitCode;
      }
      case "journal": {
        const runId = args.positionals[0];
        const agent = first(args, "agent");
        const status = first(args, "status");
        if (!runId || !agent || !status) {
          process.stderr.write(
            "journal : <run_id>, --agent et --status sont requis\n",
          );
          return 2;
        }
        const outcome = runJournal({
          runId,
          agent,
          status: status as JournalStatus,
          deliverable: first(args, "deliverable"),
          anomalies: args.flags.get("anomaly"),
          start: first(args, "start"),
          end: first(args, "end"),
          json: args.bools.has("json"),
          qaDir,
        });
        process.stdout.write(outcome.stdout + "\n");
        return outcome.exitCode;
      }
      case "db": {
        const [subcommand, ...positionals] = args.positionals;
        if (!subcommand) {
          process.stderr.write("db : sous-commande manquante\n\n" + USAGE + "\n");
          return 2;
        }
        const outcome = runDb({
          subcommand,
          positionals,
          flags: args.flags,
          bools: args.bools,
          qaDir,
        });
        process.stdout.write(outcome.stdout + "\n");
        return outcome.exitCode;
      }
      default:
        process.stderr.write(`Commande inconnue : ${command}\n\n${USAGE}\n`);
        return 2;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    process.stderr.write(`Erreur : ${message}\n`);
    return 1;
  }
}

type JournalStatus = "ok" | "partial" | "error" | "retry" | "skipped";

process.exit(main(process.argv.slice(2)));
