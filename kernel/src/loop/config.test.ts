import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseYaml } from "../routing/yaml";
import { DEFAULT_MAX_ITERATIONS, readLoopConfig, serializeLoopConfig, type LoopConfig } from "./config";

test("serializeLoopConfig -> parseYaml -> readLoopConfig round-trip", () => {
  const config: LoopConfig = {
    loop_id: "demo-regression",
    target: "tests/checkout",
    success_criteria: "Suite verte, 0 echec SCRIPT/ENV",
    max_iterations: 3,
    allowed_agents: ["qa-test-executor", "qa-healing-coordinator"],
    whitelist: ["tests/checkout/**", "pages/checkout*.page.ts"],
  };
  const yaml = serializeLoopConfig(config);
  const back = readLoopConfig(parseYaml(yaml));
  assert.deepEqual(back, config);
});

test("readLoopConfig : max_iterations absent -> défaut", () => {
  const parsed = parseYaml("loop_id: x\ntarget: y\nsuccess_criteria: z\nallowed_agents:\n  - a\nwhitelist:\n  - b\n");
  const config = readLoopConfig(parsed);
  assert.equal(config.max_iterations, DEFAULT_MAX_ITERATIONS);
});

test("readLoopConfig : objet vide -> valeurs par défaut sûres (jamais d'exception)", () => {
  const config = readLoopConfig({});
  assert.equal(config.loop_id, "");
  assert.deepEqual(config.allowed_agents, []);
  assert.deepEqual(config.whitelist, []);
  assert.equal(config.max_iterations, DEFAULT_MAX_ITERATIONS);
});
