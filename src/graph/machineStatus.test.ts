import { describe, expect, it } from 'vitest';
import { loadMockGameData } from '@/test/loadMock';
import type { MachineNodeData } from '@/store/useGraphStore';
import { computeMachineStatus, type NodeActualFlow } from './machineStatus';

const game = loadMockGameData();

const flow = (inputs: Record<string, number>): NodeActualFlow => ({
  inputs: new Map(Object.entries(inputs)),
  outputs: new Map(),
});

describe('computeMachineStatus', () => {
  it('node non configuré → non configuré, pas d’état', () => {
    const s = computeMachineStatus({ buildingId: 'constructor' }, undefined, game);
    expect(s.configured).toBe(false);
    expect(s.state).toBeNull();
  });

  it('extracteur configuré → toujours nominal', () => {
    const data: MachineNodeData = { buildingId: 'miner-mk1', resourceId: 'iron-ore', purity: 'normal' };
    const s = computeMachineStatus(data, undefined, game);
    expect(s.state).toBe('nominal');
    expect(s.efficiency).toBe(1);
  });

  it('machine configurée sans aucun flux → en attente (blocked)', () => {
    // Constructor iron-plate consomme 30 iron-ingot/min ; aucun reçu → bloqué.
    const data: MachineNodeData = { buildingId: 'constructor', recipeId: 'iron-plate' };
    const s = computeMachineStatus(data, undefined, game);
    expect(s.state).toBe('blocked');
    expect(s.efficiency).toBe(0);
    expect(s.missing).toHaveLength(1);
    expect(s.missing[0].itemId).toBe('iron-ingot');
    expect(s.missing[0].actual).toBe(0);
    expect(s.missing[0].required).toBe(30);
  });

  it('machine partiellement alimentée → sous-alimentée (starved)', () => {
    const data: MachineNodeData = { buildingId: 'constructor', recipeId: 'iron-plate' };
    const s = computeMachineStatus(data, flow({ 'iron-ingot': 15 }), game);
    expect(s.state).toBe('starved');
    expect(s.efficiency).toBeCloseTo(0.5, 5);
    expect(s.missing[0].actual).toBe(15);
  });

  it('machine pleinement alimentée → nominal, aucun manque', () => {
    const data: MachineNodeData = { buildingId: 'constructor', recipeId: 'iron-plate' };
    const s = computeMachineStatus(data, flow({ 'iron-ingot': 30 }), game);
    expect(s.state).toBe('nominal');
    expect(s.efficiency).toBe(1);
    expect(s.missing).toHaveLength(0);
  });
});
