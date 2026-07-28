import { strict as assert } from "node:assert";
import { test } from "node:test";
import { levenshtein } from "./distance";

test("levenshtein : cas de base", () => {
  assert.equal(levenshtein("", ""), 0);
  assert.equal(levenshtein("abc", "abc"), 0);
  assert.equal(levenshtein("", "abc"), 3);
  assert.equal(levenshtein("abc", ""), 3);
});

test("levenshtein : substitution / insertion / suppression", () => {
  assert.equal(levenshtein("kitten", "sitting"), 3);
  assert.equal(levenshtein("emailField", "emailFld"), 2);
  assert.equal(levenshtein("submitBtn", "submit"), 3);
});
