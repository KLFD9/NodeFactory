import { describe, expect, it } from 'vitest';
import type { Edge } from '@xyflow/react';
import { loadMockGameData } from '@/test/loadMock';
import { computePowerNetworks } from './power';
import type { MachineNode } from '@/store/useGraphStore';

const game = loadMockGameData();

function node(id: string, buildingId: string, count?: number): MachineNode {
  return { id, type: 'machine', position: { x: 0, y: 0 }, data: { buildingId, count } };
}

function powerEdge(id: string, source: string, target: string): Edge {
  return { id, source, target, sourceHandle: 'power-out', targetHandle: 'power-in' };
}

describe('computePowerNetworks', () => {
  it('réseau équilibré : générateur (15 MW) >= Miner (5) + Smelter (4) = 9 MW', () => {
    const nodes = [
      node('gen', 'coal-generator'),
      node('miner', 'miner-mk1'),
      node('smelter', 'smelter'),
    ];
    const edges = [powerEdge('e1', 'gen', 'miner'), powerEdge('e2', 'gen', 'smelter')];
    const { networks, poweredByNode } = computePowerNetworks(nodes, edges, game);
    expect(networks).toHaveLength(1);
    expect(networks[0].totalGenMW).toBe(15);
    expect(networks[0].totalDemandMW).toBe(9);
    expect(networks[0].powered).toBe(true);
    expect(poweredByNode.get('miner')).toBe(true);
    expect(poweredByNode.get('smelter')).toBe(true);
    expect(poweredByNode.get('gen')).toBe(true);
  });

  it('réseau déficitaire : demande > génération → unpowered pour tous', () => {
    const nodes = [
      node('gen', 'coal-generator'),
      node('miner1', 'miner-mk1'),
      node('miner2', 'miner-mk1'),
      node('smelter', 'smelter'),
    ];
    // 15 MW gen vs 5+5+4 = 14 MW... ajoute un constructor (4 MW) pour dépasser 15.
    const nodes2 = [...nodes, node('ctor', 'constructor')];
    const edges = [
      powerEdge('e1', 'gen', 'miner1'),
      powerEdge('e2', 'gen', 'miner2'),
      powerEdge('e3', 'gen', 'smelter'),
      powerEdge('e4', 'gen', 'ctor'),
    ];
    const { networks, poweredByNode } = computePowerNetworks(nodes2, edges, game);
    expect(networks).toHaveLength(1);
    expect(networks[0].totalGenMW).toBe(15);
    expect(networks[0].totalDemandMW).toBe(18); // 5+5+4+4
    expect(networks[0].powered).toBe(false);
    expect(poweredByNode.get('ctor')).toBe(false);
    expect(poweredByNode.get('gen')).toBe(false);
  });

  it('node isolé non câblé : consommateur seul → unpowered, générateur seul → powered', () => {
    const nodes = [node('miner', 'miner-mk1'), node('gen', 'coal-generator')];
    const { networks, poweredByNode } = computePowerNetworks(nodes, [], game);
    expect(networks).toHaveLength(2);
    expect(poweredByNode.get('miner')).toBe(false); // 5 MW demande, 0 gen
    expect(poweredByNode.get('gen')).toBe(true); // 0 demande, 15 gen
  });

  it('ignore les hubs logistiques (pas de pins énergie)', () => {
    const nodes = [
      node('gen', 'coal-generator'),
      node('miner', 'miner-mk1'),
      node('split', 'splitter'),
    ];
    const { networks, poweredByNode } = computePowerNetworks(nodes, [powerEdge('e1', 'gen', 'miner')], game);
    expect(poweredByNode.has('split')).toBe(false);
    expect(networks.flatMap((n) => n.nodeIds)).not.toContain('split');
  });

  it('le multiplicateur `count` (×N machines) module la demande', () => {
    const nodes = [node('gen', 'coal-generator'), node('miner', 'miner-mk1', 3)];
    const { networks } = computePowerNetworks(nodes, [powerEdge('e1', 'gen', 'miner')], game);
    expect(networks[0].totalDemandMW).toBe(15); // 3 × 5 MW
    expect(networks[0].powered).toBe(true); // == gen, à epsilon près
  });

  it('poteau électrique : dispatch via power-out-0/1/2 vers plusieurs consommateurs', () => {
    const nodes = [
      node('gen', 'coal-generator'),
      node('pole', 'power-pole'),
      node('miner', 'miner-mk1'),
      node('smelter', 'smelter'),
    ];
    const edges: Edge[] = [
      powerEdge('e1', 'gen', 'pole'),
      { id: 'e2', source: 'pole', target: 'miner', sourceHandle: 'power-out-0', targetHandle: 'power-in' },
      { id: 'e3', source: 'pole', target: 'smelter', sourceHandle: 'power-out-1', targetHandle: 'power-in' },
    ];
    const { networks, poweredByNode } = computePowerNetworks(nodes, edges, game);
    expect(networks).toHaveLength(1);
    expect(networks[0].totalGenMW).toBe(15);
    expect(networks[0].totalDemandMW).toBe(9); // miner 5 + smelter 4
    expect(networks[0].powered).toBe(true);
    expect(poweredByNode.get('miner')).toBe(true);
    expect(poweredByNode.get('smelter')).toBe(true);
    expect(poweredByNode.get('pole')).toBe(true);
  });
});
