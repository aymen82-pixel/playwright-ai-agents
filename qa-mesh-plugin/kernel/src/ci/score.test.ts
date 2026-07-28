import { strict as assert } from "node:assert";
import { test } from "node:test";
import { DEFAULT_CI_CONFIG, ewmaFailure, scoreDomains, type CiConfig, type DomainFacts } from "./score";

function cfg(over: Partial<CiConfig> = {}): CiConfig {
  return { ...DEFAULT_CI_CONFIG, ...over };
}
function facts(over: Partial<DomainFacts>): DomainFacts {
  return {
    domain: "x",
    businessRisk: 0,
    criticalityRaw: 0,
    failure: 0,
    gitRaw: 0,
    greenStreak: 0,
    ageDays: 0,
    ...over,
  };
}

test("ewmaFailure : aucune donnée -> 0 (cold start, aucun échec connu)", () => {
  assert.equal(ewmaFailure([], 0.5), 0);
});

test("ewmaFailure : tout vert -> 0", () => {
  assert.equal(ewmaFailure([1, 1, 1], 0.5), 0);
});

test("ewmaFailure : pondère la campagne la plus récente", () => {
  // passRates = [0, 1] (récent KO, ancien OK) -> failure élevé
  const f = ewmaFailure([0, 1], 0.5);
  assert.ok(f > 0.6 && f < 0.7, `attendu ~0.667, vu ${f}`);
});

test("plancher métier appliqué même sans signal", () => {
  const [r] = scoreDomains([facts({ domain: "checkout" })], cfg({ floors: { checkout: 40 } }));
  assert.equal(r.priority, 40);
  assert.ok(r.reason.includes("business_floor"));
});

test("péremption force la priorité (domaine jamais testé)", () => {
  const [r] = scoreDomains([facts({ domain: "profile", ageDays: Infinity })], cfg());
  assert.equal(r.priority, DEFAULT_CI_CONFIG.staleness_floor);
  assert.ok(r.reason.includes("never_tested"));
});

test("risque métier élevé remonte la priorité + raison", () => {
  const [r] = scoreDomains([facts({ domain: "pay", businessRisk: 10 })], cfg());
  assert.equal(r.factors.business, 1);
  assert.ok(r.reason.includes("business_risk"));
  assert.ok(r.priority >= 30);
});

test("criticité normalisée en min/max croisé", () => {
  const out = scoreDomains(
    [facts({ domain: "a", criticalityRaw: 10 }), facts({ domain: "b", criticalityRaw: 5 })],
    cfg(),
  );
  const byDomain = Object.fromEntries(out.map((s) => [s.domain, s]));
  assert.equal(byDomain["a"].factors.criticality, 1);
  assert.equal(byDomain["b"].factors.criticality, 0.5);
});

test("stabilité réduit la priorité et n'efface pas le plancher", () => {
  const c = cfg({ floors: { checkout: 40 }, business_risk: { checkout: 5 } });
  const stable = scoreDomains([facts({ domain: "checkout", businessRisk: 5, greenStreak: 5, ageDays: 1 })], c)[0];
  // stabilité maximale, mais plancher métier 40 tient
  assert.equal(stable.priority, 40);
  assert.equal(stable.factors.stability, 1);
});

test("résultats triés par priorité décroissante", () => {
  const out = scoreDomains(
    [facts({ domain: "low", businessRisk: 1, ageDays: 1 }), facts({ domain: "high", businessRisk: 10, ageDays: 1 })],
    cfg(),
  );
  assert.equal(out[0].domain, "high");
  assert.ok(out[0].priority >= out[1].priority);
});
