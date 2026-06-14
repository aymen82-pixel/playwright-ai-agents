import { strict as assert } from "node:assert";
import { test } from "node:test";
import { join, resolve } from "node:path";
import { ContractRegistry } from "./contracts";

// Le kernel vit dans kernel/ ; le .qa du projet est à ../.qa.
const QA_DIR = resolve(__dirname, "..", "..", ".qa");

function envelope(overrides: Record<string, unknown> = {}): unknown {
  return {
    protocol: "qa-mesh/1.0",
    run_id: "2026-06-13-001",
    agent: "agent-1",
    status: "ok",
    payload: {
      pages: [{ url: "/login", title: "Login", complexity: "simple" }],
      elements: [
        { page: "/login", type: "input", label: "email", selector_primary: "#email" },
      ],
      api_calls: [],
    },
    ...overrides,
  };
}

test("charge tous les contrats du projet", () => {
  const registry = ContractRegistry.load(QA_DIR);
  const agents = registry.knownAgents();
  assert.ok(agents.includes("agent-1"), "agent-1 doit avoir un contrat");
  assert.ok(agents.includes("agent-6"), "agent-6 doit avoir un contrat");
  assert.ok(!agents.includes("envelope"), "l'enveloppe n'est pas un agent");
});

test("valide un livrable agent-1 conforme", () => {
  const registry = ContractRegistry.load(QA_DIR);
  const result = registry.validateDeliverable(envelope());
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test("rejette une enveloppe au protocole erroné", () => {
  const registry = ContractRegistry.load(QA_DIR);
  const result = registry.validateDeliverable(envelope({ protocol: "qa-mesh/9.9" }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.layer === "envelope"));
});

test("rejette un run_id mal formé", () => {
  const registry = ContractRegistry.load(QA_DIR);
  const result = registry.validateDeliverable(envelope({ run_id: "13-06-2026" }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.path.includes("run_id")));
});

test("rejette un payload agent-1 sans le champ requis selector_primary", () => {
  const registry = ContractRegistry.load(QA_DIR);
  const result = registry.validateDeliverable(
    envelope({
      payload: {
        pages: [{ url: "/x", title: "X", complexity: "simple" }],
        elements: [{ page: "/x", type: "input", label: "email" }],
        api_calls: [],
      },
    }),
  );
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((e) => e.layer === "payload"),
    "une erreur de payload est attendue",
  );
});

test("l'enveloppe accepte les agents spécialistes (a11y/compliance/perf/po/spec)", () => {
  const registry = ContractRegistry.load(QA_DIR);
  for (const agent of ["agent-a11y", "agent-compliance", "agent-perf", "agent-po", "agent-spec"]) {
    const result = registry.validateDeliverable(envelope({ agent, payload: {} }));
    const enumError = result.errors.find(
      (e) => e.layer === "envelope" && e.path === "/agent",
    );
    assert.equal(enumError, undefined, `${agent} doit être accepté par l'enum d'enveloppe`);
  }
});

test("valide un payload agent-5 (résolution des $ref croisés vers l'enveloppe)", () => {
  const registry = ContractRegistry.load(QA_DIR);
  const result = registry.validateDeliverable({
    protocol: "qa-mesh/1.0",
    run_id: "2026-06-14-005",
    agent: "agent-5",
    status: "partial",
    payload: {
      results: [
        { id: "1", spec: "a.spec.ts", title: "ok", status: "OK", duration_ms: 5 },
        { id: "2", spec: "b.spec.ts", title: "ko", status: "KO", duration_ms: 9, failure: { kind: "SCRIPT", message: "x" } },
      ],
      bugs: [],
      summary: { total: 2, pass: 1, fail: 1, skip: 0, pass_rate_pct: 50 },
    },
  });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test("déduit l'agent depuis l'enveloppe si non fourni", () => {
  const registry = ContractRegistry.load(QA_DIR);
  // payload invalide pour agent-1 → doit échouer via déduction.
  const result = registry.validateDeliverable(envelope({ payload: {} }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.layer === "payload"));
});
