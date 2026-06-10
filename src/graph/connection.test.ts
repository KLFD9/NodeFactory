import { describe, expect, it } from 'vitest';
import type { Edge } from '@xyflow/react';
import { loadMockGameData } from '@/test/loadMock';
import { isValidGraphConnection, reconcileEdgesForNode } from './connection';
import type { MachineNode } from '@/store/useGraphStore';

const game = loadMockGameData();
const ok = (c: Parameters<typeof isValidGraphConnection>[0], edges: Edge[] = []) =>
  isValidGraphConnection(c, edges, [], game);

function node(id: string, data: MachineNode['data']): MachineNode {
  return { id, type: 'machine', position: { x: 0, y: 0 }, data };
}

describe('isValidGraphConnection', () => {
  it('refuse un self-loop', () => {
    expect(ok({ source: 'a', target: 'a', sourceHandle: 'out-iron-ingot', targetHandle: 'in-iron-ingot' })).toBe(false);
  });

  it('refuse un port d’entrée déjà occupé', () => {
    const edges: Edge[] = [{ id: 'e1', source: 'x', target: 'b', targetHandle: 'in-iron-ingot' }];
    expect(
      ok({ source: 'a', target: 'b', sourceHandle: 'out-iron-ingot', targetHandle: 'in-iron-ingot' }, edges),
    ).toBe(false);
  });

  it('refuse des items incompatibles', () => {
    expect(ok({ source: 'a', target: 'b', sourceHandle: 'out-iron-ingot', targetHandle: 'in-copper-ingot' })).toBe(false);
  });

  it('accepte des items compatibles vers un port libre', () => {
    expect(ok({ source: 'a', target: 'b', sourceHandle: 'out-iron-ingot', targetHandle: 'in-iron-ingot' })).toBe(true);
  });

  it('autorise un port logistique générique (pas de contrôle d’item)', () => {
    expect(ok({ source: 'split', target: 'b', sourceHandle: 'out-0', targetHandle: 'in-iron-ingot' })).toBe(true);
  });

  it('autorise un câble énergie power-out → power-in', () => {
    expect(ok({ source: 'a', target: 'b', sourceHandle: 'power-out', targetHandle: 'power-in' })).toBe(true);
  });

  it('autorise plusieurs câbles énergie sur le même pin (pas de règle "port occupé")', () => {
    const edges: Edge[] = [{ id: 'e1', source: 'x', target: 'b', sourceHandle: 'power-out', targetHandle: 'power-in' }];
    expect(ok({ source: 'a', target: 'b', sourceHandle: 'power-out', targetHandle: 'power-in' }, edges)).toBe(true);
  });

  it('refuse un câble énergie mal apparié (power-out → in-item, ou out-item → power-in)', () => {
    expect(ok({ source: 'a', target: 'b', sourceHandle: 'power-out', targetHandle: 'in-iron-ingot' })).toBe(false);
    expect(ok({ source: 'a', target: 'b', sourceHandle: 'out-iron-ingot', targetHandle: 'power-in' })).toBe(false);
  });

  it('autorise les sorties de dispatch du poteau électrique (power-out-0/1/2 → power-in)', () => {
    expect(ok({ source: 'pole', target: 'b', sourceHandle: 'power-out-0', targetHandle: 'power-in' })).toBe(true);
    expect(ok({ source: 'pole', target: 'c', sourceHandle: 'power-out-1', targetHandle: 'power-in' })).toBe(true);
    expect(ok({ source: 'pole', target: 'd', sourceHandle: 'power-out-2', targetHandle: 'power-in' })).toBe(true);
  });
});

describe('reconcileEdgesForNode', () => {
  it('remappe in-0 → in-<item> quand le target se configure (auto-détection de recette)', () => {
    const miner = node('miner', { buildingId: 'miner-mk1', resourceId: 'iron-ore' });
    const smelter = node('smelter', { buildingId: 'smelter', recipeId: 'iron-ingot' });
    const edges: Edge[] = [
      { id: 'e1', source: 'miner', target: 'smelter', sourceHandle: 'out-iron-ore', targetHandle: 'in-0' },
    ];
    const result = reconcileEdgesForNode('smelter', [miner, smelter], edges, game);
    expect(result).toEqual([
      { id: 'e1', source: 'miner', target: 'smelter', sourceHandle: 'out-iron-ore', targetHandle: 'in-iron-ore' },
    ]);
  });

  it('repasse targetHandle en in-0 quand le target perd sa recette', () => {
    const miner = node('miner', { buildingId: 'miner-mk1', resourceId: 'iron-ore' });
    const smelter = node('smelter', { buildingId: 'smelter' }); // recette retirée
    const edges: Edge[] = [
      { id: 'e1', source: 'miner', target: 'smelter', sourceHandle: 'out-iron-ore', targetHandle: 'in-iron-ore' },
    ];
    const result = reconcileEdgesForNode('smelter', [miner, smelter], edges, game);
    expect(result[0].targetHandle).toBe('in-0');
  });

  it('supprime une arête dont l’item ne correspond plus à aucun port après changement de recette', () => {
    const miner = node('miner', { buildingId: 'miner-mk1', resourceId: 'copper-ore' });
    // La recette iron-ingot ne consomme pas copper-ore : aucun port compatible.
    const smelter = node('smelter', { buildingId: 'smelter', recipeId: 'iron-ingot' });
    const edges: Edge[] = [
      { id: 'e1', source: 'miner', target: 'smelter', sourceHandle: 'out-copper-ore', targetHandle: 'in-copper-ore' },
    ];
    const result = reconcileEdgesForNode('smelter', [miner, smelter], edges, game);
    expect(result).toEqual([]);
  });

  it('laisse les arêtes inchangées si le node concerné n’est ni source ni target', () => {
    const miner = node('miner', { buildingId: 'miner-mk1', resourceId: 'iron-ore' });
    const smelter = node('smelter', { buildingId: 'smelter', recipeId: 'iron-ingot' });
    const edges: Edge[] = [
      { id: 'e1', source: 'miner', target: 'smelter', sourceHandle: 'out-iron-ore', targetHandle: 'in-iron-ore' },
    ];
    const result = reconcileEdgesForNode('other', [miner, smelter], edges, game);
    expect(result).toEqual(edges);
  });
});
