/**
 * Loops autonomes (v3) — décision bornée. Fonction PURE : transforme un
 * verdict (`verify.ts`) + l'itération courante en statut de loop. Le kernel
 * tranche, l'orchestrateur applique — jamais l'inverse.
 */
import type { LoopStatus } from "../db/agentdb";

export interface DecideInput {
  verdict: "PASS" | "FAIL";
  /** Itération qui vient de produire ce verdict (1-based). */
  iteration: number;
  maxIterations: number;
}

export interface DecideResult {
  status: LoopStatus;
  /** Explique le choix — utile pour PROGRESS.md. */
  reason: string;
}

export function decide(input: DecideInput): DecideResult {
  if (input.verdict === "PASS") {
    return { status: "done", reason: "verdict PASS" };
  }
  if (input.iteration < input.maxIterations) {
    return { status: "retry", reason: `verdict FAIL, itération ${input.iteration}/${input.maxIterations}` };
  }
  return {
    status: "needs_human",
    reason: `verdict FAIL après ${input.iteration}/${input.maxIterations} itérations — escalade humaine`,
  };
}
