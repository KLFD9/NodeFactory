import { beforeEach, describe, expect, it } from 'vitest';
import type { Edge } from '@xyflow/react';
import { useGraphStore, type MachineNode } from './useGraphStore';

const node = (id: string, buildingId: string, recipeId?: string): MachineNode => ({
  id,
  type: 'machine',
  position: { x: 0, y: 0 },
  data: { buildingId, recipeId },
});

describe('useGraphStore — division d’arête (drop sur convoyeur)', () => {
  beforeEach(() => {
    useGraphStore.setState({ nodes: [], edges: [], selectedNodeId: null, clipboard: null });
  });

  it('insère un hub sur une arête : retire l’arête et la remplace par deux segments', () => {
    const a = node('A', 'smelter', 'iron-ingot');
    const b = node('B', 'constructor', 'iron-plate');
    const edge: Edge = {
      id: 'e1',
      source: 'A',
      sourceHandle: 'out-iron-ingot',
      target: 'B',
      targetHandle: 'in-iron-ingot',
    };
    useGraphStore.setState({ nodes: [a, b], edges: [edge] });

    useGraphStore.getState().dropBuildingNode('splitter', { x: 100, y: 0 }, 'logistics', 'e1');
    const st = useGraphStore.getState();

    // L'arête d'origine a disparu, un splitter a été ajouté.
    expect(st.edges.find((e) => e.id === 'e1')).toBeUndefined();
    const splitter = st.nodes.find((n) => n.data.buildingId === 'splitter');
    expect(splitter).toBeDefined();

    // Segment amont : A (handle d'origine conservé) → splitter in-0.
    const up = st.edges.find((e) => e.source === 'A');
    expect(up?.sourceHandle).toBe('out-iron-ingot');
    expect(up?.target).toBe(splitter!.id);
    expect(up?.targetHandle).toBe('in-0');

    // Segment aval : splitter out-0 → B (handle d'origine conservé).
    const down = st.edges.find((e) => e.target === 'B');
    expect(down?.source).toBe(splitter!.id);
    expect(down?.sourceHandle).toBe('out-0');
    expect(down?.targetHandle).toBe('in-iron-ingot');
  });

  it('sans splitEdgeId : pose simplement le node, sans toucher aux arêtes', () => {
    useGraphStore.setState({ nodes: [], edges: [] });
    useGraphStore.getState().dropBuildingNode('smelter', { x: 0, y: 0 }, 'smelting');
    const st = useGraphStore.getState();
    expect(st.nodes).toHaveLength(1);
    expect(st.edges).toHaveLength(0);
  });
});
