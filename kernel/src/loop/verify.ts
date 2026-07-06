/**
 * Loops autonomes (v3) — moteur de vérification déterministe. Fonctions
 * PURES : aucune I/O. La commande `loop.ts` assemble les faits (rapport
 * Playwright, résultat de validation de contrat, diff git) et appelle
 * `verifyLoop`. Le verifier ne corrige jamais, il valide ou rejette avec motif.
 *
 * Règle clé : un échec PRODUIT (vrai bug applicatif) n'est PAS un échec de
 * loop — seuls SCRIPT (test cassé) et ENV (environnement) bloquent.
 */
import { checkScope, type ScopeCheck } from "./whitelist";

export type FailureKind = "PRODUIT" | "SCRIPT" | "ENV";

export interface TestResult {
  id: string;
  spec: string;
  title: string;
  status: "OK" | "KO" | "INS" | "IGN";
  failure?: { kind: FailureKind; message: string; line?: number };
}

export interface ExecutionReport {
  results: TestResult[];
}

export interface ReportCheck {
  ok: boolean;
  motifs: string[];
}

/** SCRIPT/ENV bloquent le loop ; PRODUIT est un vrai bug, pas un échec de loop. */
export function checkPlaywrightReport(report: ExecutionReport): ReportCheck {
  const blocking = report.results.filter(
    (r) => r.status === "KO" && r.failure && (r.failure.kind === "SCRIPT" || r.failure.kind === "ENV"),
  );
  if (blocking.length === 0) return { ok: true, motifs: [] };
  return {
    ok: false,
    motifs: blocking.map((r) => `${r.spec} :: ${r.title} — échec ${r.failure!.kind} : ${r.failure!.message}`),
  };
}

export interface VerifyLoopInput {
  /** null si aucun rapport d'exécution n'existe encore pour ce run. */
  report: ExecutionReport | null;
  contractValid: boolean;
  contractErrors: string[];
  changedFiles: string[];
  whitelist: string[];
}

export interface VerifyLoopResult {
  verdict: "PASS" | "FAIL";
  motifs: string[];
}

/** Combine les 3 checks mécaniques (rapport, contrat, scope) en un verdict unique. */
export function verifyLoop(input: VerifyLoopInput): VerifyLoopResult {
  const motifs: string[] = [];

  const reportCheck: ReportCheck = input.report
    ? checkPlaywrightReport(input.report)
    : { ok: false, motifs: ["aucun rapport d'exécution trouvé pour ce run"] };
  if (!reportCheck.ok) motifs.push(...reportCheck.motifs);

  if (!input.contractValid) motifs.push(...input.contractErrors);

  const scopeCheck: ScopeCheck = checkScope(input.changedFiles, input.whitelist);
  if (!scopeCheck.ok) motifs.push(...scopeCheck.motifs);

  return { verdict: motifs.length === 0 ? "PASS" : "FAIL", motifs };
}
