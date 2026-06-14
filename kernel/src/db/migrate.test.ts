import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgentDb } from "./agentdb";
import { migrateFromJson, staleCutoff } from "./migrate";

test("staleCutoff convertit les durées relatives", () => {
  const nowMs = Date.parse("2026-06-13T00:00:00.000Z");
  assert.equal(staleCutoff("30d", nowMs), "2026-05-14T00:00:00.000Z");
  assert.equal(staleCutoff("24h", nowMs), "2026-06-12T00:00:00.000Z");
  assert.throws(() => staleCutoff("banane", nowMs), /Durée invalide/);
});

test("migrateFromJson importe les fichiers legacy présents", () => {
  const dir = mkdtempSync(join(tmpdir(), "qa-mesh-migrate-"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "browser-selectors.json"),
    JSON.stringify([
      { domain: "auth", page: "/login", label: "email", selector_primary: "#email", validated: true, validated_by: "agent-1" },
      { domain: "auth", page: "/login", label: "pwd", selector_primary: "#pwd", validated: false },
    ]),
  );
  writeFileSync(
    join(dir, "coverage-memory.json"),
    JSON.stringify([{ domain: "auth", coverage_score: 0.7, last_pass_rate_pct: 92 }]),
  );

  const db = AgentDb.open(":memory:", () => "2026-06-13T18:00:00.000Z");
  const summary = migrateFromJson(db, dir);

  assert.equal(summary.selectors, 2);
  assert.equal(summary.coverage, 1);
  assert.equal(summary.sessions, 0, "pas de fichier sessions → 0");
  assert.equal(db.getSelectors({ domain: "auth" }).length, 2);
  assert.equal(db.getCoverage("auth")?.last_pass_rate, 92);
  db.close();
});
