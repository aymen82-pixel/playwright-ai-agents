import { z } from 'zod';

/**
 * Schéma volontairement permissif — à utiliser uniquement tant qu'un contrat
 * d'interface n'est pas confirmé (ex. corps d'erreur avant récupération du
 * contrat Confluence). Ne jamais le laisser en l'état sur un endpoint validé :
 * remplacer par un schéma strict dès que la forme réelle de la réponse est connue.
 */
export const UnknownSchema = z.unknown();
