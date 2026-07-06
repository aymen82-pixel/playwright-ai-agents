import { strict as assert } from "node:assert";
import { test } from "node:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runLoop } from "./loop";

const REAL_CONTRACTS = resolve(__dirname, "..", "..", "..", ".qa", "contracts");

function setup(withContracts = false) {
  const dir = mkdtempSync(join(tmpdir(), "qa-mesh-loop-"));
  const qaDir = join(dir, ".qa");
  mkdirSync(join(qaDir, "agentdb"), { recursive: true });
  if (withContracts) cpSync(REAL_CONTRACTS, join(qaDir, "contracts"), { recursive: true });
  return qaDir;
}

function validReport(overrides: { status?: string; failureKind?: "SCRIPT" | "ENV" | "PRODUIT" } = {}) {
  const result =
    overrides.status === "KO"
      ? {
          id: "1",
          spec: "tests/checkout/pay.spec.ts",
          title: "paiement",
          status: "KO",
          duration_ms: 10,
          failure: { kind: overrides.failureKind ?? "SCRIPT", message: "erreur simulée" },
        }
      : { id: "1", spec: "tests/checkout/pay.spec.ts", title: "paiement", status: "OK", duration_ms: 10 };
  return {
    protocol: "qa-mesh/2.0",
    run_id: "2026-07-04-001",
    agent: "agent-5",
    status: "ok",
    payload: {
      results: [result],
      bugs: [],
      summary: { total: 1, pass: result.status === "OK" ? 1 : 0, fail: result.status === "OK" ? 0 : 1, skip: 0, pass_rate_pct: result.status === "OK" ? 100 : 0 },
    },
  };
}

test("loop init : scaffold complet (loop.yaml + TASK/LOOP_INSTRUCTIONS/PROGRESS + outputs/)", () => {
  const qaDir = setup();
  const root = join(qaDir, "..");
  const out = runLoop({
    mode: "init",
    flags: new Map([
      ["loop", ["demo-regression"]],
      ["target", ["tests/checkout"]],
      ["agents", ["qa-test-executor, qa-healing-coordinator"]],
      ["whitelist", ["tests/checkout/**"]],
    ]),
    bools: new Set(["json"]),
    qaDir,
  });
  assert.equal(out.exitCode, 0);
  const loopDir = join(root, "loops", "demo-regression");
  assert.ok(existsSync(join(loopDir, "loop.yaml")));
  assert.ok(existsSync(join(loopDir, "TASK.md")));
  assert.ok(existsSync(join(loopDir, "LOOP_INSTRUCTIONS.md")));
  assert.ok(existsSync(join(loopDir, "PROGRESS.md")));
  assert.ok(existsSync(join(loopDir, "outputs", ".gitkeep")));
  const yaml = readFileSync(join(loopDir, "loop.yaml"), "utf8");
  assert.match(yaml, /loop_id: demo-regression/);
  assert.match(yaml, /qa-test-executor/);
});

test("loop init : refuse d'écraser sans --force", () => {
  const qaDir = setup();
  const flags = new Map([["loop", ["x"]]]);
  runLoop({ mode: "init", flags, bools: new Set(), qaDir });
  const second = runLoop({ mode: "init", flags, bools: new Set(["json"]), qaDir });
  assert.equal(second.exitCode, 2);
  assert.match(JSON.parse(second.stdout).error, /existe déjà/);
});

test("loop init : --force écrase", () => {
  const qaDir = setup();
  const flags = new Map([["loop", ["x"]]]);
  runLoop({ mode: "init", flags, bools: new Set(), qaDir });
  const second = runLoop({ mode: "init", flags, bools: new Set(["force", "json"]), qaDir });
  assert.equal(second.exitCode, 0);
});

test("loop init : --loop manquant -> erreur", () => {
  const qaDir = setup();
  const out = runLoop({ mode: "init", flags: new Map(), bools: new Set(["json"]), qaDir });
  assert.equal(out.exitCode, 2);
});

function initLoop(qaDir: string, loopId = "demo") {
  const root = join(qaDir, "..");
  runLoop({
    mode: "init",
    flags: new Map([
      ["loop", [loopId]],
      ["whitelist", ["tests/checkout/**"]],
    ]),
    bools: new Set(),
    qaDir,
  });
  return { root, loopDir: join(root, "loops", loopId) };
}

function writeReport(loopDir: string, runId: string, report: unknown) {
  const dir = join(loopDir, "outputs", runId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "execution_report.json"), JSON.stringify(report), "utf8");
}

test("loop verify : rapport propre + contrat valide + scope respecté -> PASS", () => {
  const qaDir = setup(true);
  const { loopDir } = initLoop(qaDir);
  writeReport(loopDir, "2026-07-04-001", validReport());
  const out = runLoop({
    mode: "verify",
    flags: new Map([["loop", ["demo"]], ["run", ["2026-07-04-001"]]]),
    bools: new Set(["json"]),
    qaDir,
    gitDiffRunner: () => ["tests/checkout/pay.spec.ts"],
  });
  assert.equal(out.exitCode, 0);
  const body = JSON.parse(out.stdout);
  assert.equal(body.verdict, "PASS");
  assert.equal(body.iteration, 1);
});

test("loop verify : échec SCRIPT -> FAIL avec motif", () => {
  const qaDir = setup(true);
  const { loopDir } = initLoop(qaDir);
  writeReport(loopDir, "2026-07-04-001", validReport({ status: "KO", failureKind: "SCRIPT" }));
  const out = runLoop({
    mode: "verify",
    flags: new Map([["loop", ["demo"]], ["run", ["2026-07-04-001"]]]),
    bools: new Set(["json"]),
    qaDir,
    gitDiffRunner: () => ["tests/checkout/pay.spec.ts"],
  });
  const body = JSON.parse(out.stdout);
  assert.equal(body.verdict, "FAIL");
  assert.ok(body.motifs.some((m: string) => /SCRIPT/.test(m)));
});

test("loop verify : échec PRODUIT n'empêche pas le PASS (vrai bug, pas un défaut de loop)", () => {
  const qaDir = setup(true);
  const { loopDir } = initLoop(qaDir);
  writeReport(loopDir, "2026-07-04-001", validReport({ status: "KO", failureKind: "PRODUIT" }));
  const out = runLoop({
    mode: "verify",
    flags: new Map([["loop", ["demo"]], ["run", ["2026-07-04-001"]]]),
    bools: new Set(["json"]),
    qaDir,
    gitDiffRunner: () => ["tests/checkout/pay.spec.ts"],
  });
  assert.equal(JSON.parse(out.stdout).verdict, "PASS");
});

test("loop verify : fichier hors whitelist -> FAIL", () => {
  const qaDir = setup(true);
  const { loopDir } = initLoop(qaDir);
  writeReport(loopDir, "2026-07-04-001", validReport());
  const out = runLoop({
    mode: "verify",
    flags: new Map([["loop", ["demo"]], ["run", ["2026-07-04-001"]]]),
    bools: new Set(["json"]),
    qaDir,
    gitDiffRunner: () => ["kernel/src/cli.ts"],
  });
  const body = JSON.parse(out.stdout);
  assert.equal(body.verdict, "FAIL");
  assert.ok(body.motifs.some((m: string) => /whitelist/.test(m)));
});

test("loop verify : aucun rapport -> FAIL explicite", () => {
  const qaDir = setup(true);
  initLoop(qaDir);
  const out = runLoop({
    mode: "verify",
    flags: new Map([["loop", ["demo"]], ["run", ["2026-07-04-001"]]]),
    bools: new Set(["json"]),
    qaDir,
    gitDiffRunner: () => [],
  });
  assert.equal(JSON.parse(out.stdout).verdict, "FAIL");
});

test("loop decide : PASS -> done, PROGRESS.md régénéré", () => {
  const qaDir = setup(true);
  const { loopDir } = initLoop(qaDir);
  writeReport(loopDir, "2026-07-04-001", validReport());
  runLoop({ mode: "verify", flags: new Map([["loop", ["demo"]], ["run", ["2026-07-04-001"]]]), bools: new Set(), qaDir, gitDiffRunner: () => [] });
  const out = runLoop({
    mode: "decide",
    flags: new Map([["loop", ["demo"]], ["run", ["2026-07-04-001"]]]),
    bools: new Set(["json"]),
    qaDir,
  });
  assert.equal(out.exitCode, 0);
  assert.equal(JSON.parse(out.stdout).status, "done");
  const progress = readFileSync(join(loopDir, "PROGRESS.md"), "utf8");
  assert.match(progress, /itération 1/);
  assert.match(progress, /statut=done/);
});

test("loop decide : FAIL sous le plafond -> retry ; au plafond -> needs_human", () => {
  const qaDir = setup(true);
  const { loopDir } = initLoop(qaDir); // whitelist tests/checkout/** ; max_iterations défaut = 3
  for (let i = 1; i <= 3; i++) {
    writeReport(loopDir, "2026-07-04-001", validReport({ status: "KO", failureKind: "SCRIPT" }));
    runLoop({ mode: "verify", flags: new Map([["loop", ["demo"]], ["run", ["2026-07-04-001"]]]), bools: new Set(), qaDir, gitDiffRunner: () => ["tests/checkout/pay.spec.ts"] });
    const out = runLoop({ mode: "decide", flags: new Map([["loop", ["demo"]], ["run", ["2026-07-04-001"]]]), bools: new Set(["json"]), qaDir });
    const status = JSON.parse(out.stdout).status;
    if (i < 3) assert.equal(status, "retry", `itération ${i} doit être retry`);
    else assert.equal(status, "needs_human", "itération au plafond doit escalader");
  }
});

test("loop decide : sans verify préalable -> erreur", () => {
  const qaDir = setup(true);
  initLoop(qaDir);
  const out = runLoop({ mode: "decide", flags: new Map([["loop", ["demo"]], ["run", ["2026-07-04-001"]]]), bools: new Set(["json"]), qaDir });
  assert.equal(out.exitCode, 2);
});

test("loop status : liste les loops actifs (exclut done)", () => {
  const qaDir = setup(true);
  const { loopDir } = initLoop(qaDir, "a");
  writeReport(loopDir, "2026-07-04-001", validReport());
  runLoop({ mode: "verify", flags: new Map([["loop", ["a"]], ["run", ["2026-07-04-001"]]]), bools: new Set(), qaDir, gitDiffRunner: () => [] });
  runLoop({ mode: "decide", flags: new Map([["loop", ["a"]], ["run", ["2026-07-04-001"]]]), bools: new Set(), qaDir }); // -> done

  const { loopDir: loopDirB } = initLoop(qaDir, "b");
  writeReport(loopDirB, "2026-07-04-001", validReport({ status: "KO", failureKind: "SCRIPT" }));
  runLoop({ mode: "verify", flags: new Map([["loop", ["b"]], ["run", ["2026-07-04-001"]]]), bools: new Set(), qaDir, gitDiffRunner: () => ["tests/checkout/pay.spec.ts"] });
  runLoop({ mode: "decide", flags: new Map([["loop", ["b"]], ["run", ["2026-07-04-001"]]]), bools: new Set(), qaDir }); // -> retry

  const out = runLoop({ mode: "status", flags: new Map(), bools: new Set(["json"]), qaDir });
  const active = JSON.parse(out.stdout) as Array<{ loop_id: string; status: string }>;
  assert.deepEqual(active.map((r) => r.loop_id).sort(), ["b"], "loop 'a' (done) exclu, loop 'b' (retry) actif");
});
