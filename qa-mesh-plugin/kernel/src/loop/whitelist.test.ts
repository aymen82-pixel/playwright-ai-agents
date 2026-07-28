import { strict as assert } from "node:assert";
import { test } from "node:test";
import { checkScope, isPathAllowed } from "./whitelist";

test("isPathAllowed : littéral exact", () => {
  assert.equal(isPathAllowed("tests/checkout/pay.spec.ts", ["tests/checkout/pay.spec.ts"]), true);
  assert.equal(isPathAllowed("tests/checkout/other.spec.ts", ["tests/checkout/pay.spec.ts"]), false);
});

test("isPathAllowed : ** profondeur quelconque", () => {
  assert.equal(isPathAllowed("tests/checkout/sub/pay.spec.ts", ["tests/checkout/**"]), true);
  assert.equal(isPathAllowed("tests/checkout/pay.spec.ts", ["tests/checkout/**"]), true);
  assert.equal(isPathAllowed("tests/login/pay.spec.ts", ["tests/checkout/**"]), false);
});

test("isPathAllowed : * un seul segment", () => {
  assert.equal(isPathAllowed("pages/checkout.page.ts", ["pages/*.page.ts"]), true);
  assert.equal(isPathAllowed("pages/sub/checkout.page.ts", ["pages/*.page.ts"]), false);
});

test("isPathAllowed : normalise les backslashs Windows", () => {
  assert.equal(isPathAllowed("tests\\checkout\\pay.spec.ts", ["tests/checkout/**"]), true);
});

test("checkScope : tout dans la whitelist -> ok", () => {
  const r = checkScope(["tests/checkout/pay.spec.ts", "pages/checkout.page.ts"], ["tests/checkout/**", "pages/*.page.ts"]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.motifs, []);
});

test("checkScope : un fichier hors whitelist -> FAIL avec motif", () => {
  const r = checkScope(["tests/checkout/pay.spec.ts", "kernel/src/cli.ts"], ["tests/checkout/**"]);
  assert.equal(r.ok, false);
  assert.equal(r.motifs.length, 1);
  assert.match(r.motifs[0], /kernel\/src\/cli\.ts/);
});
