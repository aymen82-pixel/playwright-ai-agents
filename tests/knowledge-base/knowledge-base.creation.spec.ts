// Cartographie des endpoints Nova — famille "base de connaissances"
// (créer / dupliquer / supprimer, testés en séquence — cf. onboarding).
// Chemin d'API à confirmer contre le contrat d'interface Confluence ;
// NOVA_API_URL / NOVA_KB_ENDPOINT permettent de le brancher sans toucher au test.

import { test, expect } from '../../fixtures/pages.fixture';
import { KnowledgeBaseSchema, KnowledgeBaseListSchema } from '../../schemas/nova/knowledge-base.schema';
import { UnknownSchema } from '../../schemas/common.schema';
import { uniqueId } from '../../utils/test-data';

test.describe('Nova — base de connaissances', () => {
  test.skip(
    !process.env.NOVA_API_URL || !process.env.NOVA_KB_ENDPOINT || !process.env.NOVA_API_TOKEN,
    'NOVA_API_URL / NOVA_KB_ENDPOINT / NOVA_API_TOKEN non configurés — voir README section "Tests API (Nova)"',
  );

  // @scenario KB-NOM-01
  // Créer une base de connaissances doit renvoyer la ressource créée conforme au contrat,
  // et la faire apparaître dans le listing (relation métamorphique — cf. note ISTQB CT-AI Ch.9).
  test('KB-NOM-01: création nominale', async ({ apiRequest }) => {
    const name = uniqueId('KB-TestE2E');
    const endpoint = process.env.NOVA_KB_ENDPOINT!;

    const created = await apiRequest('POST', endpoint, {
      schema: KnowledgeBaseSchema,
      data: { name },
    });

    try {
      expect(created.status, 'la création doit renvoyer 201').toBe(201);
      expect(created.body.name, 'le nom renvoyé doit correspondre au nom envoyé').toBe(name);

      const list = await apiRequest('GET', endpoint, { schema: KnowledgeBaseListSchema });

      expect(
        list.body.some((kb) => kb.id === created.body.id),
        'la base créée doit apparaître dans le listing des bases de connaissances',
      ).toBe(true);
    } finally {
      // Nettoyage — évite d'accumuler des bases de connaissances sur l'environnement
      // Nova partagé à chaque exécution (5 projets navigateurs × retries CI).
      await apiRequest('DELETE', `${endpoint}/${created.body.id}`, { schema: UnknownSchema });
    }
  });

  // @scenario KB-ERR-01
  // Créer une base sans nom doit être rejeté par l'API (4xx), pas accepté silencieusement.
  test('KB-ERR-01: création sans nom', async ({ apiRequest }) => {
    const result = await apiRequest('POST', process.env.NOVA_KB_ENDPOINT!, {
      schema: UnknownSchema,
      data: {},
    });

    expect(result.status, 'une création sans nom doit être rejetée (4xx)').toBeGreaterThanOrEqual(400);
    expect(result.status, 'un rejet ne doit pas être une erreur serveur (5xx)').toBeLessThan(500);
  });
});
