/**
 * Données de test — SEUL point d'entrée des credentials.
 * Tout vient de variables d'environnement (voir .qa/qa.config.json#roles).
 * Les agents lisent ce fichier mais ne le modifient JAMAIS.
 */

export interface TestUser {
  username: string;
  password: string;
}

/** Récupère les credentials d'un rôle depuis l'environnement. */
export function getUser(role = 'DEFAULT'): TestUser {
  const username = process.env[`QA_${role.toUpperCase()}_USER`];
  const password = process.env[`QA_${role.toUpperCase()}_PASSWORD`];
  if (!username || !password) {
    throw new Error(
      `Credentials manquants pour le rôle "${role}" — définir QA_${role.toUpperCase()}_USER et QA_${role.toUpperCase()}_PASSWORD`,
    );
  }
  return { username, password };
}

/** Identifiant unique pour les données créées par les tests (isolation). */
export function uniqueId(prefix = 'TestE2E'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
