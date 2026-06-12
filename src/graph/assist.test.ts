import { describe, expect, it } from 'vitest';
import { loadMockGameData } from '@/test/loadMock';
import type { MachineNode } from '@/store/useGraphStore';
import { completeFactory } from './assist';
import { computeFactory } from './computeFactory';

const game = loadMockGameData();
const machine = (id: string, buildingId: string, recipeId: string): MachineNode => ({
  id,
  type: 'machine',
  position: { x: 0, y: 0 },
  data: { buildingId, recipeId, count: 1 },
});

describe('completeFactory (optimisation assistée)', () => {
  it('comble le déficit : un Constructor de plaques seul → amont ajouté, plus aucun déficit', async () => {
    // 1 Constructor Iron Plate seul : consomme 30 Iron Ingot/min, déficit 30.
    const nodes = [machine('c', 'constructor', 'iron-plate')];
    const before = computeFactory(nodes, [], game, new Map());
    expect(before.deficits.find((d) => d.itemId === 'iron-ingot')?.ratePerMin).toBe(30);

    const res = await completeFactory(nodes, [], game, 'raw-resources');
    expect(res).not.toBeNull();

    // Après complétion : aucune production manquante, et le minerai apparaît en ressource brute.
    const after = computeFactory(res!.nodes, res!.edges, game, new Map());
    expect(after.deficits).toHaveLength(0);
    expect(after.rawInputs.find((r) => r.itemId === 'iron-ore')?.ratePerMin).toBe(30);

    // Le Constructor d'origine est conservé et un Smelter a été ajouté.
    expect(res!.nodes.some((n) => n.id === 'c')).toBe(true);
    expect(res!.nodes.some((n) => n.data.recipeId === 'iron-ingot')).toBe(true);
    expect(res!.filled).toEqual([{ item: 'iron-ingot', rate: 30 }]);
  });

  it('renvoie null si le graphe n’a aucun déficit', async () => {
    const nodes = [
      machine('s', 'smelter', 'iron-ingot'),
      machine('c', 'constructor', 'iron-plate'),
    ];
    // Smelter (30 ingot) couvre un peu, mais 1 constructor en consomme 30 → équilibré pile.
    const res = await completeFactory(nodes, [], game, 'raw-resources');
    expect(res).toBeNull();
  });
});
