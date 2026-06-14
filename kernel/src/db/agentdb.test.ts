import { strict as assert } from "node:assert";
import { test } from "node:test";
import { AgentDb } from "./agentdb";

function fixedClock(iso = "2026-06-13T18:00:00.000Z") {
  return () => iso;
}

test("put versionne en append-only ; get retourne la version courante", () => {
  const db = AgentDb.open(":memory:", fixedClock());
  db.putSelector({ domain: "auth", page: "/login", label: "email", selector_primary: "#email" });
  db.putSelector({ domain: "auth", page: "/login", label: "email", selector_primary: "#email-v2", validated: true });

  const rows = db.getSelectors({ domain: "auth", page: "/login", label: "email" });
  assert.equal(rows.length, 1, "get ne retourne que la version courante");
  assert.equal(rows[0].version, 2);
  assert.equal(rows[0].selector_primary, "#email-v2");
  assert.equal(rows[0].validated, true);
  db.close();
});

test("getSelectors filtre validated-only", () => {
  const db = AgentDb.open(":memory:", fixedClock());
  db.putSelector({ domain: "auth", page: "/login", label: "email", selector_primary: "#a", validated: true });
  db.putSelector({ domain: "auth", page: "/login", label: "pwd", selector_primary: "#b", validated: false });

  assert.equal(db.getSelectors({ domain: "auth" }).length, 2);
  assert.equal(db.getSelectors({ domain: "auth", validatedOnly: true }).length, 1);
  db.close();
});

test("pack groupe les sélecteurs validés par page", () => {
  const db = AgentDb.open(":memory:", fixedClock());
  db.putSelectors([
    { domain: "shop", page: "/cart", label: "checkout", selector_primary: "#co", validated: true },
    { domain: "shop", page: "/cart", label: "qty", selector_primary: "#qty", validated: true },
    { domain: "shop", page: "/home", label: "search", selector_primary: "#s", validated: true },
    { domain: "shop", page: "/home", label: "draft", selector_primary: "#d", validated: false },
  ]);
  const pack = db.pack("shop");
  assert.equal(pack.domain, "shop");
  assert.equal(pack.pages["/cart"].length, 2);
  assert.equal(pack.pages["/home"].length, 1, "le sélecteur non validé est exclu");
  assert.equal(pack.pages["/cart"][0].label, "checkout");
  db.close();
});

test("similar classe par distance d'édition sur la même page", () => {
  const db = AgentDb.open(":memory:", fixedClock());
  db.putSelectors([
    { domain: "auth", page: "/login", label: "emailField", selector_primary: "#e", validated: true },
    { domain: "auth", page: "/login", label: "passwordField", selector_primary: "#p", validated: true },
    { domain: "auth", page: "/login", label: "submitBtn", selector_primary: "#s", validated: true },
  ]);
  const candidates = db.similar("auth", "/login", "emailFld", 2);
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].label, "emailField", "le plus proche en premier");
  assert.ok(candidates[0].distance < candidates[1].distance);
  db.close();
});

test("prune supprime les sélecteurs antérieurs au cutoff", () => {
  const db = AgentDb.open(":memory:", fixedClock("2026-01-01T00:00:00.000Z"));
  db.putSelector({ domain: "old", page: "/p", label: "a", selector_primary: "#a" });
  const cutoff = "2026-06-01T00:00:00.000Z";
  assert.equal(db.staleSelectorCount(cutoff), 1);
  assert.equal(db.pruneSelectors(cutoff), 1);
  assert.equal(db.getSelectors({ domain: "old" }).length, 0);
  db.close();
});

test("sessions : getSession ignore les sessions expirées", () => {
  const db = AgentDb.open(":memory:", fixedClock("2026-06-13T18:00:00.000Z"));
  db.putSession({ role: "admin", storage_state_path: "/s/expired.json", expires_at: "2026-06-12T00:00:00.000Z" });
  db.putSession({ role: "admin", storage_state_path: "/s/valid.json", expires_at: "2026-06-30T00:00:00.000Z" });
  const session = db.getSession("admin");
  assert.equal(session?.storage_state_path, "/s/valid.json");
  assert.equal(db.getSession("inconnu"), null);
  db.close();
});

test("coverage : upsert par domaine", () => {
  const db = AgentDb.open(":memory:", fixedClock());
  db.putCoverage({ domain: "auth", score: 0.5, routes_hash: "h1" });
  db.putCoverage({ domain: "auth", score: 0.8, routes_hash: "h2" });
  const cov = db.getCoverage("auth");
  assert.equal(cov?.score, 0.8);
  assert.equal(cov?.routes_hash, "h2");
  db.close();
});

test("journal SQLite : append + query par run", () => {
  const db = AgentDb.open(":memory:", fixedClock());
  db.appendJournal({ run_id: "2026-06-14-001", agent: "agent-0", ts: "2026-06-14T10:00:00Z", status: "ok" });
  db.appendJournal({ run_id: "2026-06-14-001", agent: "agent-1", ts: "2026-06-14T10:05:00Z", status: "retry", anomalies: ["x"] });
  db.appendJournal({ run_id: "2026-06-14-002", agent: "agent-0", ts: "2026-06-14T11:00:00Z", status: "ok" });
  const rows = db.queryJournal("2026-06-14-001");
  assert.equal(rows.length, 2);
  assert.equal(rows[1].agent, "agent-1");
  assert.equal(rows[1].anomalies, JSON.stringify(["x"]));
  db.close();
});

test("mémoire d'exécution : recordResults + passedScenarios (campagne précédente)", () => {
  const db = AgentDb.open(":memory:", () => "2026-06-13T10:00:00Z");
  db.recordResults("2026-06-13-001", "checkout", [
    { spec: "checkout/pay.spec.ts", title: "paiement ok", status: "OK" },
    { spec: "checkout/pay.spec.ts", title: "paiement refusé", status: "KO" },
  ]);
  const passed = db.passedScenarios("checkout");
  assert.equal(passed.length, 1);
  assert.equal(passed[0].title, "paiement ok");
  db.close();
});

test("passedScenarios ne retient que la campagne la plus récente", () => {
  const db = AgentDb.open(":memory:", () => "2026-06-10T10:00:00Z");
  db.recordResults("run-old", "auth", [{ spec: "auth/login.spec.ts", title: "login ok", status: "OK" }]);
  db.recordResults("run-new", "auth", [{ spec: "auth/login.spec.ts", title: "login ok", status: "KO" }]);
  // ts identiques -> départage par id DESC : run-new (KO) prime.
  const passed = db.passedScenarios("auth");
  assert.equal(passed.length, 0, "la campagne la plus récente (KO) prime");
  db.close();
});

test("pack annote trusted = validé ET frais", () => {
  let clock = "2026-06-14T10:00:00Z";
  const db = AgentDb.open(":memory:", () => clock);
  db.putSelector({ domain: "auth", page: "/login", label: "old", selector_primary: "#o", validated: true });
  clock = "2026-06-14T12:00:00Z";
  db.putSelector({ domain: "auth", page: "/login", label: "fresh", selector_primary: "#f", validated: true });
  const cutoff = "2026-06-14T11:00:00Z"; // entre les deux
  const pack = db.pack("auth", true, cutoff);
  const byLabel = Object.fromEntries(pack.pages["/login"].map((s) => [s.label, s]));
  assert.equal(byLabel["fresh"].trusted, true);
  assert.equal(byLabel["old"].trusted, false, "validé mais périmé -> non trusted");
  db.close();
});

test("export produit un dump JSON des trois namespaces", () => {
  const db = AgentDb.open(":memory:", fixedClock());
  db.putSelector({ domain: "auth", page: "/login", label: "email", selector_primary: "#e", validated: true });
  db.putSession({ role: "admin", storage_state_path: "/s.json", expires_at: "2026-06-30T00:00:00.000Z" });
  db.putCoverage({ domain: "auth", score: 0.9 });
  const dump = db.export();
  assert.equal(dump.schema_version, "2");
  assert.equal(dump["browser-selectors"].length, 1);
  assert.equal(dump["browser-sessions"].length, 1);
  assert.equal(dump["coverage-memory"].length, 1);
  db.close();
});
