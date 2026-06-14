import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import Ajv from "ajv";
import type { ErrorObject, ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import { contractsDir } from "./paths";

/** Résultat de validation déterministe — aucune interprétation LLM. */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  /** Avertissements non bloquants (ex. protocole déprécié). */
  warnings: string[];
}

export interface ValidationError {
  /** `envelope` ou `payload` — quelle couche a échoué. */
  layer: "envelope" | "payload";
  /** Chemin JSON Pointer de l'instance fautive (ex. `/pages/0/url`). */
  path: string;
  message: string;
}

/**
 * Registre des contrats qa-mesh : charge l'enveloppe + les payloads par agent
 * depuis `.qa/contracts/*.schema.json` et les compile une fois avec Ajv.
 *
 * La validation est strictement mécanique (déterministe, 0 token) : c'est le
 * cœur du kernel qa-mesh/2.0 — ce travail ne doit jamais être fait par un LLM.
 */
export class ContractRegistry {
  private readonly ajv: Ajv;
  private readonly envelopeValidate: ValidateFunction;
  /** clé = identifiant agent (`agent-1`, `agent-a11y`, …) → validateur payload. */
  private readonly payloadValidators = new Map<string, ValidateFunction>();

  private constructor(ajv: Ajv, envelopeValidate: ValidateFunction) {
    this.ajv = ajv;
    this.envelopeValidate = envelopeValidate;
  }

  static load(qaDir: string): ContractRegistry {
    const dir = contractsDir(qaDir);
    // strict:false — tolère les mots-clés draft-07 (title, description, $id…)
    // sans rejeter les schémas existants. allErrors — rapport exhaustif.
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);

    const files = readdirSync(dir).filter((f) => f.endsWith(".schema.json"));

    // Première passe : enregistrer tous les schémas (résolution des $ref/$id).
    const schemas: Record<string, unknown> = {};
    for (const file of files) {
      const schema = JSON.parse(readFileSync(join(dir, file), "utf8"));
      const key = basename(file, ".schema.json"); // `envelope`, `agent-1`, …
      schemas[key] = schema;
      ajv.addSchema(schema, key);
    }

    const envelopeValidate = ajv.getSchema("envelope");
    if (!envelopeValidate) {
      throw new Error(`Contrat enveloppe introuvable dans ${dir}`);
    }

    const registry = new ContractRegistry(ajv, envelopeValidate);
    for (const key of Object.keys(schemas)) {
      if (key === "envelope") continue;
      // `agent-0.schema.json` → identifiant agent `agent-0`.
      const validate = ajv.getSchema(key);
      if (validate) {
        registry.payloadValidators.set(key, validate);
      }
    }
    return registry;
  }

  /** Identifiants agents disposant d'un contrat de payload. */
  knownAgents(): string[] {
    return [...this.payloadValidators.keys()].sort();
  }

  hasPayloadContract(agent: string): boolean {
    return this.payloadValidators.has(agent);
  }

  /**
   * Valide un livrable complet : structure d'enveloppe + payload selon l'agent.
   * @param doc      Document JSON parsé (enveloppe qa-mesh).
   * @param agent    Identifiant agent (sinon déduit de `doc.agent`).
   */
  validateDeliverable(doc: unknown, agent?: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (!this.envelopeValidate(doc)) {
      errors.push(...mapErrors(this.envelopeValidate.errors, "envelope"));
    }

    const envelope = (doc ?? {}) as { agent?: string; payload?: unknown; protocol?: string };

    // Dépréciation du protocole 1.0 (grâce d'une campagne) — non bloquant.
    if (envelope.protocol === "qa-mesh/1.0") {
      warnings.push("protocole qa-mesh/1.0 DÉPRÉCIÉ — migrer vers qa-mesh/2.0.");
    }

    const agentId = agent ?? envelope.agent;

    if (agentId && this.payloadValidators.has(agentId)) {
      const validate = this.payloadValidators.get(agentId)!;
      if (!validate(envelope.payload)) {
        errors.push(...mapErrors(validate.errors, "payload"));
      }
    }
    // qa-analyst (report.json) n'a pas de contrat de payload → enveloppe seule.

    return { valid: errors.length === 0, errors, warnings };
  }
}

function mapErrors(
  errors: ErrorObject[] | null | undefined,
  layer: "envelope" | "payload",
): ValidationError[] {
  if (!errors) return [];
  return errors.map((e) => ({
    layer,
    path: e.instancePath || "/",
    message: `${e.message ?? "invalide"}${
      e.params && Object.keys(e.params).length
        ? " " + JSON.stringify(e.params)
        : ""
    }`,
  }));
}
