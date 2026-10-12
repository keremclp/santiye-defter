import type { IsolationCase } from './helpers/isolation.js';

/**
 * Firma verisi taşıyan her uç buraya eklenir (Adım 3'ten itibaren). Örnek:
 *
 *   {
 *     name: 'GET /projects/:id',
 *     arrange: async ({ owner }) => {
 *       const project = await createProject(owner, { name: 'Gizli Şantiye' });
 *       return { method: 'get', path: `/projects/${project.id}`, secret: 'Gizli Şantiye' };
 *     },
 *   },
 */
export const companyIsolationCases: IsolationCase[] = [];
