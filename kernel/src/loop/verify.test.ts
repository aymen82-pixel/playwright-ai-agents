import { strict as assert } from "node:assert";
import { test } from "node:test";
import { checkPlaywrightReport, verifyLoop } from "./verify";

test("checkPlaywrightReport : tout vert -> ok", () => {
  const r = checkPlaywrightReport({ results: [{ id: "1", spec: "a", title: "t", status: "OK" }] });
  assert.equal(r.ok, true);
});

test("checkPlaywrightReport : échec SCRIPT bloque", () => {
  const r = checkPlaywrightReport({
    results: [{ id: "1", spec: "a", title: "t", status: "KO", failure: { kind: "SCRIPT", message: "selector introuvable" } }],
  });
  assert.equal(r.ok, false);
  assert.match(r.motifs[0], /SCRIPT/);
});

test("checkPlaywrightReport : échec ENV bloque", () => {
  const r = checkPlaywrightReport({
    results: [{ id: "1", spec: "a", title: "t", status: "KO", failure: { kind: "ENV", message: "timeout réseau" } }],
  });
  assert.equal(r.ok, false);
});

test("checkPlaywrightReport : échec PRODUIT ne bloque PAS le loop (vrai bug, pas un défaut de loop)", () => {
  const r = checkPlaywrightReport({
    results: [{ id: "1", spec: "a", title: "t", status: "KO", failure: { kind: "PRODUIT", message: "500 serveur" } }],
  });
  assert.equal(r.ok, true, "un KO PRODUIT ne doit jamais faire échouer le loop");
});

test("verifyLoop : PASS quand rapport propre + contrat valide + scope respecté", () => {
  const r = verifyLoop({
    report: { results: [{ id: "1", spec: "a", title: "t", status: "OK" }] },
    contractValid: true,
    contractErrors: [],
    changedFiles: ["tests/checkout/pay.spec.ts"],
    whitelist: ["tests/checkout/**"],
  });
  assert.equal(r.verdict, "PASS");
  assert.deepEqual(r.motifs, []);
});

test("verifyLoop : FAIL et agrège les motifs de chaque check en échec", () => {
  const r = verifyLoop({
    report: { results: [{ id: "1", spec: "a", title: "t", status: "KO", failure: { kind: "SCRIPT", message: "x" } }] },
    contractValid: false,
    contractErrors: ["payload.results[0] : champ manquant"],
    changedFiles: ["kernel/src/cli.ts"],
    whitelist: ["tests/checkout/**"],
  });
  assert.equal(r.verdict, "FAIL");
  assert.equal(r.motifs.length, 3, "un motif par check en échec");
});

test("verifyLoop : aucun rapport -> FAIL explicite", () => {
  const r = verifyLoop({ report: null, contractValid: true, contractErrors: [], changedFiles: [], whitelist: [] });
  assert.equal(r.verdict, "FAIL");
  assert.match(r.motifs[0], /aucun rapport/);
});
