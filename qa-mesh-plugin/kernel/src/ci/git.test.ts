import { strict as assert } from "node:assert";
import { test } from "node:test";
import { computeGitActivity, mapPathToDomain, parseGitLog } from "./git";

const KNOWN = new Set(["checkout", "login"]);

test("mapPathToDomain : préfixe explicite de la config", () => {
  assert.equal(mapPathToDomain("src/billing/Pay.tsx", { "src/billing": "checkout" }, KNOWN), "checkout");
});

test("mapPathToDomain : heuristique <dir>/<domaine>/", () => {
  assert.equal(mapPathToDomain("pages/checkout/cart.page.ts", {}, KNOWN), "checkout");
  assert.equal(mapPathToDomain("tests/login/login.spec.ts", {}, KNOWN), "login");
});

test("mapPathToDomain : premier segment si domaine connu", () => {
  assert.equal(mapPathToDomain("checkout/util.ts", {}, KNOWN), "checkout");
});

test("mapPathToDomain : non rattachable -> null", () => {
  assert.equal(mapPathToDomain("README.md", {}, KNOWN), null);
  assert.equal(mapPathToDomain("pages/unknown/x.ts", {}, KNOWN), null);
});

test("parseGitLog : associe les fichiers à la date du commit", () => {
  const raw = "\x1f2026-06-14T10:00:00Z\npages/checkout/cart.ts\npages/checkout/pay.ts\n\x1f2026-06-01T10:00:00Z\npages/login/login.ts";
  const commits = parseGitLog(raw);
  assert.equal(commits.length, 3);
  assert.equal(commits[0].path, "pages/checkout/cart.ts");
  assert.equal(commits[2].path, "pages/login/login.ts");
});

test("computeGitActivity : agrège commits + récence décroissante par domaine", () => {
  const nowMs = Date.parse("2026-06-14T10:00:00Z");
  const commits = [
    { path: "pages/checkout/pay.ts", committedAtMs: nowMs }, // âge 0 -> decay 1
    { path: "pages/checkout/pay.ts", committedAtMs: nowMs }, // 2e commit même fichier
    { path: "README.md", committedAtMs: nowMs }, // non rattaché -> ignoré
  ];
  const out = computeGitActivity(commits, { pathDomainMap: {}, knownDomains: KNOWN, tauDays: 14, nowMs });
  assert.equal(out.length, 1, "README.md ignoré");
  assert.equal(out[0].domain, "checkout");
  assert.equal(out[0].commits_window, 2);
  assert.ok(out[0].recency_score > 1.9, `2 commits récents -> récence ~2, vu ${out[0].recency_score}`);
});
