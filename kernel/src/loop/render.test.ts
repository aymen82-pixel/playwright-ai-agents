import { strict as assert } from "node:assert";
import { test } from "node:test";
import { renderProgress } from "./render";
import { DEFAULT_MAX_ITERATIONS, type LoopConfig } from "./config";
import type { LoopIterationRow } from "../db/agentdb";

const CONFIG: LoopConfig = {
  loop_id: "demo",
  target: "tests/checkout",
  success_criteria: "vert",
  max_iterations: DEFAULT_MAX_ITERATIONS,
  allowed_agents: [],
  whitelist: [],
};

function row(over: Partial<LoopIterationRow>): LoopIterationRow {
  return { loop_id: "demo", run_id: "run-1", iteration: 1, agent: null, verdict: null, motifs: null, status: "running", ts: "2026-07-04T10:00:00Z", ...over };
}

test("renderProgress : ne garde que la dernière ligne par itération", () => {
  const out = renderProgress(CONFIG, [
    row({ iteration: 1, status: "running", verdict: "FAIL", motifs: ["x"] }),
    row({ iteration: 1, status: "retry", verdict: "FAIL", motifs: ["x"] }),
  ]);
  const occurrences = out.split("itération 1").length - 1;
  assert.equal(occurrences, 1, "une seule entrée pour l'itération 1 (la plus récente)");
  assert.match(out, /statut=retry/);
});

test("renderProgress : plafonne à 10 lignes par itération", () => {
  const manyMotifs = Array.from({ length: 20 }, (_, i) => `motif ${i}`);
  const out = renderProgress(CONFIG, [row({ motifs: manyMotifs, verdict: "FAIL", status: "retry" })]);
  const block = out.split("\n").filter((l) => l.trim().length > 0 && !l.startsWith("#") && !l.startsWith(">"));
  assert.ok(block.length <= 10, `attendu <= 10 lignes, vu ${block.length}`);
  assert.match(out, /autre\(s\)/);
});

test("renderProgress : accumule l'historique de plusieurs runs (les numéros d'itération repartent de 1 à chaque run)", () => {
  const out = renderProgress(CONFIG, [
    row({ run_id: "2026-07-04-001", iteration: 1, status: "retry", verdict: "FAIL" }),
    row({ run_id: "2026-07-04-001", iteration: 2, status: "needs_human", verdict: "FAIL" }),
    row({ run_id: "2026-07-05-001", iteration: 1, status: "done", verdict: "PASS" }),
  ]);
  assert.match(out, /run 2026-07-04-001 · itération 1/);
  assert.match(out, /run 2026-07-04-001 · itération 2/);
  assert.match(out, /run 2026-07-05-001 · itération 1/);
  assert.match(out, /statut=needs_human/);
  assert.match(out, /statut=done/);
});

test("renderProgress : loop sans itération -> juste l'en-tête", () => {
  const out = renderProgress(CONFIG, []);
  assert.match(out, /loop `demo`/);
  assert.doesNotMatch(out, /itération/);
});
