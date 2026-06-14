import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { runFilter } from "./filter";

const ROUTING = resolve(__dirname, "..", "..", "..", ".qa", "routing.yaml");

function writeDeliverable(doc: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "qa-mesh-filter-"));
  const path = join(dir, "deliverable.json");
  writeFileSync(path, JSON.stringify(doc), "utf8");
  return path;
}

test("1 -> 2 : projette pages et éléments, exclut sélecteurs et API", () => {
  const file = writeDeliverable({
    protocol: "qa-mesh/2.0",
    run_id: "2026-06-14-001",
    agent: "agent-1",
    status: "ok",
    domain: "auth",
    payload: {
      pages: [{ url: "/login", title: "Login", complexity: "simple", error_states: [] }],
      elements: [
        { page: "/login", type: "input", label: "email", action: "fill", selector_primary: "#email", selector_fallback: "#e" },
      ],
      api_calls: [{ method: "POST", endpoint: "/api/login" }],
    },
  });
  const out = runFilter({ file, from: "1", to: "2", routingPath: ROUTING });
  assert.equal(out.exitCode, 0);
  const extract = JSON.parse(out.stdout);
  assert.deepEqual(extract.pages, [{ url: "/login", title: "Login", complexity: "simple" }]);
  assert.deepEqual(extract.elements, [{ page: "/login", type: "input", label: "email", action: "fill" }]);
  assert.equal(extract.api_calls, undefined, "les API ne sont pas transmises à l'agent 2");
  assert.equal(extract.elements[0].selector_primary, undefined, "les sélecteurs ne transitent pas");
});

test("5 -> 6 : ne transmet QUE les échecs SCRIPT", () => {
  const file = writeDeliverable({
    protocol: "qa-mesh/2.0",
    run_id: "2026-06-14-002",
    agent: "agent-5",
    status: "partial",
    payload: {
      results: [
        { id: "1", spec: "a.spec.ts", title: "ok", status: "OK", duration_ms: 10 },
        { id: "2", spec: "b.spec.ts", title: "cassé", status: "KO", duration_ms: 20, failure: { kind: "SCRIPT", message: "selector not found" } },
        { id: "3", spec: "c.spec.ts", title: "bug", status: "KO", duration_ms: 30, failure: { kind: "PRODUIT", message: "500" } },
      ],
      bugs: [],
      summary: { total: 3, pass: 1, fail: 2, skip: 0, pass_rate_pct: 33.3 },
    },
  });
  const out = runFilter({ file, from: "agent-5", to: "agent-6", routingPath: ROUTING });
  assert.equal(out.exitCode, 0);
  const extract = JSON.parse(out.stdout);
  assert.equal(extract.results.length, 1);
  assert.equal(extract.results[0].id, "2");
  assert.equal(extract.results[0].failure.kind, "SCRIPT");
});

test("0 -> 1 : domain injecté depuis l'enveloppe si absent du payload", () => {
  const file = writeDeliverable({
    protocol: "qa-mesh/2.0",
    run_id: "2026-06-14-003",
    agent: "agent-0",
    status: "ok",
    domain: "checkout",
    payload: {
      coverage_gaps: [{ route: "/cart", domain: "checkout", priority: "C", existing_tests: 0 }],
      session: { role: "user", storage_state_path: "/s/user.json", expires_at: "2026-06-30T00:00:00Z" },
    },
  });
  const out = runFilter({ file, from: "0", to: "1", routingPath: ROUTING });
  const extract = JSON.parse(out.stdout);
  assert.equal(extract.domain, "checkout");
  assert.deepEqual(extract.coverage_gaps, [{ route: "/cart", domain: "checkout", priority: "C" }]);
  assert.equal(extract.session.role, "user");
});

test("arête inconnue → code de sortie 2", () => {
  const file = writeDeliverable({ protocol: "qa-mesh/2.0", agent: "agent-1", payload: {} });
  const out = runFilter({ file, from: "1", to: "9", routingPath: ROUTING });
  assert.equal(out.exitCode, 2);
  assert.match(JSON.parse(out.stdout).error, /Ar[êe]te inconnue/);
});
