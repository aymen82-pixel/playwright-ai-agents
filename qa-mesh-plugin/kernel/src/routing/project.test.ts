import { strict as assert } from "node:assert";
import { test } from "node:test";
import { applyRule, parsePath, project } from "./project";

test("parsePath : champ simple", () => {
  assert.deepEqual(parsePath("domain"), { base: "domain", steps: [] });
});

test("parsePath : tableau + projection", () => {
  const p = parsePath("pages[].{url,title,complexity}");
  assert.equal(p.base, "pages");
  assert.deepEqual(p.steps, [
    { type: "array" },
    { type: "pick", keys: ["url", "title", "complexity"] },
  ]);
});

test("parsePath : filtre de tableau + projection", () => {
  const p = parsePath("results[?failure.kind==SCRIPT].{id,spec}");
  assert.equal(p.base, "results");
  assert.deepEqual(p.steps, [
    { type: "filter", path: "failure.kind", value: "SCRIPT" },
    { type: "pick", keys: ["id", "spec"] },
  ]);
});

test("applyRule : projection d'objet", () => {
  const src = { session: { role: "admin", storage_state_path: "/s", secret: "x" } };
  const { key, value } = applyRule(src, "session.{role,storage_state_path}");
  assert.equal(key, "session");
  assert.deepEqual(value, { role: "admin", storage_state_path: "/s" });
});

test("applyRule : projection par élément de tableau", () => {
  const src = {
    pages: [
      { url: "/a", title: "A", complexity: "simple", extra: 1 },
      { url: "/b", title: "B", complexity: "multi-step", extra: 2 },
    ],
  };
  const { value } = applyRule(src, "pages[].{url,title,complexity}");
  assert.deepEqual(value, [
    { url: "/a", title: "A", complexity: "simple" },
    { url: "/b", title: "B", complexity: "multi-step" },
  ]);
});

test("applyRule : filtre SCRIPT puis projection", () => {
  const src = {
    results: [
      { id: "1", spec: "a", status: "OK" },
      { id: "2", spec: "b", status: "KO", failure: { kind: "SCRIPT", message: "x" } },
      { id: "3", spec: "c", status: "KO", failure: { kind: "PRODUIT", message: "y" } },
    ],
  };
  const { value } = applyRule(src, "results[?failure.kind==SCRIPT].{id,spec,failure}");
  assert.equal((value as unknown[]).length, 1);
  assert.deepEqual(value, [{ id: "2", spec: "b", failure: { kind: "SCRIPT", message: "x" } }]);
});

test("project : champ absent omis du résultat", () => {
  const out = project({ domain: "auth" }, ["domain", "pages[].{url}"]);
  assert.deepEqual(out, { domain: "auth" });
});

test("project : sous-arbre complet conservé", () => {
  const src = { api_calls: [{ method: "GET", endpoint: "/x" }] };
  assert.deepEqual(project(src, ["api_calls"]), src);
});
