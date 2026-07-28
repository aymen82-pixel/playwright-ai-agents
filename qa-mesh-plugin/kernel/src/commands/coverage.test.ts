import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgentDb } from "../db/agentdb";
import { runCoverage } from "./coverage";

const NOW = () => "2026-06-14T10:00:00.000Z";
const NOW_MS = Date.parse("2026-06-14T10:00:00Z");
const GIT = () => "\x1f2026-06-14T09:00:00Z\npages/checkout/pay.ts";

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "qa-mesh-ci-"));
  const qaDir = join(dir, ".qa");
  mkdirSync(join(qaDir, "agentdb"), { recursive: true });
  writeFileSync(
    join(qaDir, "qa.config.json"),
    JSON.stringify({ coverage_intelligence: { business_risk: { checkout: 10, profile: 1 }, floors: { checkout: 40 } } }),
    "utf8",
  );
  // profile testé récemment et vert ; checkout jamais testé.
  const db = AgentDb.open(join(qaDir, "agentdb", "agentdb.sqlite"), NOW);
  db.recordResults("run-1", "profile", [{ spec: "p", title: "t", status: "OK" }]);
  db.close();
  return qaDir;
}

test("prioritize : checkout (business + git + jamais testé) devant profile", () => {
  const qaDir = setup();
  const out = runCoverage({
    mode: "prioritize",
    flags: new Map(),
    bools: new Set(["json"]),
    qaDir,
    now: NOW,
    nowMs: NOW_MS,
    gitRunner: GIT,
  });
  assert.equal(out.exitCode, 0);
  const list = JSON.parse(out.stdout) as Array<{ domain: string; priority: number; reason: string[] }>;
  assert.equal(list[0].domain, "checkout");
  assert.ok(list[0].priority >= 70, `checkout haute priorité, vu ${list[0].priority}`);
  assert.ok(list[0].reason.includes("business_risk"));
  assert.ok(list[0].reason.includes("never_tested"));
  const profile = list.find((s) => s.domain === "profile")!;
  assert.ok(profile.priority < list[0].priority);
});

test("score --domain : rapport détaillé d'un seul domaine", () => {
  const qaDir = setup();
  const out = runCoverage({
    mode: "score",
    flags: new Map([["domain", ["checkout"]]]),
    bools: new Set(["json"]),
    qaDir,
    now: NOW,
    nowMs: NOW_MS,
    gitRunner: GIT,
  });
  assert.equal(out.exitCode, 0);
  const s = JSON.parse(out.stdout) as { domain: string; factors: { git: number; business: number } };
  assert.equal(s.domain, "checkout");
  assert.equal(s.factors.business, 1);
  assert.ok(s.factors.git > 0, "le commit checkout doit produire un facteur git positif");
});

test("ci put-metric : enregistre la criticité", () => {
  const qaDir = setup();
  const out = runCoverage({
    mode: "put-metric",
    flags: new Map([
      ["domain", ["checkout"]],
      ["dependents", ["5"]],
      ["depth", ["3"]],
    ]),
    bools: new Set(),
    qaDir,
    now: NOW,
    nowMs: NOW_MS,
  });
  assert.equal(out.exitCode, 0);
  const db = AgentDb.open(join(qaDir, "agentdb", "agentdb.sqlite"), NOW);
  const row = db.allCriticality().find((c) => c.domain === "checkout")!;
  assert.equal(row.dependents, 5);
  assert.equal(row.depth, 3);
  db.close();
});
