import { strict as assert } from "node:assert";
import { test } from "node:test";
import { decide } from "./decide";

test("decide : PASS -> done, quelle que soit l'itération", () => {
  assert.equal(decide({ verdict: "PASS", iteration: 1, maxIterations: 3 }).status, "done");
  assert.equal(decide({ verdict: "PASS", iteration: 3, maxIterations: 3 }).status, "done");
});

test("decide : FAIL sous le plafond -> retry", () => {
  assert.equal(decide({ verdict: "FAIL", iteration: 1, maxIterations: 3 }).status, "retry");
  assert.equal(decide({ verdict: "FAIL", iteration: 2, maxIterations: 3 }).status, "retry");
});

test("decide : FAIL au plafond -> needs_human", () => {
  const r = decide({ verdict: "FAIL", iteration: 3, maxIterations: 3 });
  assert.equal(r.status, "needs_human");
  assert.match(r.reason, /escalade/);
});

test("decide : FAIL au-delà du plafond -> needs_human (jamais de retry infini)", () => {
  assert.equal(decide({ verdict: "FAIL", iteration: 4, maxIterations: 3 }).status, "needs_human");
});

test("decide : maxIterations = 1 -> premier FAIL escalade immédiatement", () => {
  assert.equal(decide({ verdict: "FAIL", iteration: 1, maxIterations: 1 }).status, "needs_human");
});
