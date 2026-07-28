import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseYaml } from "./yaml";

test("parse mapping imbriqué + séquence de scalaires", () => {
  const text = `edges:
  "agent-1->agent-2":
    description: "1 -> 2"
    fields:
      - pages[].{url,title}
      - elements[].{page,label}
`;
  const parsed = parseYaml(text) as any;
  assert.equal(parsed.edges["agent-1->agent-2"].description, "1 -> 2");
  assert.deepEqual(parsed.edges["agent-1->agent-2"].fields, [
    "pages[].{url,title}",
    "elements[].{page,label}",
  ]);
});

test("ignore commentaires et lignes vides", () => {
  const text = `# commentaire
edges:

  "a->b":
    # inline comment line
    fields:
      - domain
`;
  const parsed = parseYaml(text) as any;
  assert.deepEqual(parsed.edges["a->b"].fields, ["domain"]);
});

test("plusieurs arêtes au même niveau", () => {
  const text = `edges:
  "a->b":
    fields:
      - x
  "c->d":
    fields:
      - y
      - z
`;
  const parsed = parseYaml(text) as any;
  assert.deepEqual(Object.keys(parsed.edges), ["a->b", "c->d"]);
  assert.deepEqual(parsed.edges["c->d"].fields, ["y", "z"]);
});
