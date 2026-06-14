import { strict as assert } from "node:assert";
import { test } from "node:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runJournal } from "./journal";

const REAL_QA = resolve(__dirname, "..", "..", "..", ".qa");

/** Crée un .qa temporaire isolé contenant le schéma agentdb réel. */
function tempQaDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "qa-mesh-journal-"));
  mkdirSync(join(dir, "agentdb"), { recursive: true });
  cpSync(join(REAL_QA, "agentdb", "schema.json"), join(dir, "agentdb", "schema.json"));
  return dir;
}

const FIXED_NOW = () => "2026-06-13T18:00:00.000Z";

test("écrit une ligne JSONL valide dans pipeline.log", () => {
  const qaDir = tempQaDir();
  const outcome = runJournal({
    runId: "2026-06-13-001",
    agent: "agent-1",
    status: "ok",
    deliverable: ".qa/runs/2026-06-13-001/context_catalog.json",
    qaDir,
    now: FIXED_NOW,
  });
  assert.equal(outcome.exitCode, 0);

  const logPath = join(qaDir, "runs", "2026-06-13-001", "pipeline.log");
  const content = readFileSync(logPath, "utf8").trim();
  const entry = JSON.parse(content);
  assert.equal(entry.agent, "agent-1");
  assert.equal(entry.status, "ok");
  assert.equal(entry.start, "2026-06-13T18:00:00.000Z");
  assert.equal(entry.deliverable_path, ".qa/runs/2026-06-13-001/context_catalog.json");
});

test("append : deux appels produisent deux lignes", () => {
  const qaDir = tempQaDir();
  const opts = { runId: "2026-06-13-002", agent: "agent-0", qaDir, now: FIXED_NOW } as const;
  runJournal({ ...opts, status: "ok" });
  runJournal({ ...opts, agent: "agent-1", status: "retry" });

  const logPath = join(qaDir, "runs", "2026-06-13-002", "pipeline.log");
  const lines = readFileSync(logPath, "utf8").trim().split("\n");
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[1]).status, "retry");
});

test("inclut les anomalies quand fournies", () => {
  const qaDir = tempQaDir();
  const outcome = runJournal({
    runId: "2026-06-13-003",
    agent: "agent-5",
    status: "partial",
    anomalies: ["3 tests SCRIPT en échec", "session rafraîchie"],
    qaDir,
    now: FIXED_NOW,
  });
  assert.deepEqual(outcome.entry?.anomalies, [
    "3 tests SCRIPT en échec",
    "session rafraîchie",
  ]);
});

test("rejette un status hors enum", () => {
  const qaDir = tempQaDir();
  const outcome = runJournal({
    runId: "2026-06-13-004",
    agent: "agent-1",
    // @ts-expect-error test runtime d'une valeur invalide
    status: "done",
    qaDir,
    now: FIXED_NOW,
  });
  assert.equal(outcome.exitCode, 1);
  assert.equal(outcome.entry, null);
});
