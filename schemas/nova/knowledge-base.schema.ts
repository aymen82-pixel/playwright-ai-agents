import { z } from 'zod';

/**
 * Schéma de la ressource "base de connaissances" Nova — famille donnée en
 * exemple pour la cartographie des endpoints (créer / dupliquer / supprimer).
 * Champs à confirmer contre le contrat d'interface réel une fois récupéré
 * sur Confluence ; placeholder fondé sur la doc de formation Nova (Knowledge
 * Base indexée dans Solr, rattachée à un projet).
 */
export const KnowledgeBaseSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    name: z.string(),
    createdAt: z.string(),
  })
  .strict();

export type KnowledgeBase = z.infer<typeof KnowledgeBaseSchema>;

export const KnowledgeBaseListSchema = z.array(KnowledgeBaseSchema);
