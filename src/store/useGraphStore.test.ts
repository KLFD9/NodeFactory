import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Edge } from '@xyflow/react';
import { useGraphStore, type MachineNode } from './useGraphStore';
import { useFactoryStore } from './useFactoryStore';
import { useProgressionStore } from './useProgressionStore';
import { loadMockGameData } from '@/test/loadMock';

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

describe('useGraphStore — auto-assignation de recette à la pose', () => {
  beforeEach(() => {
    useGraphStore.setState({ nodes: [], edges: [], selectedNodeId: null, clipboard: null });
    useFactoryStore.setState({ gameData: loadMockGameData() });
  });
  afterEach(() => {
    useFactoryStore.setState({ gameData: null });
  });

  it('un bâtiment mono-recette (Coal Generator) reçoit sa recette automatiquement', () => {
    useGraphStore.getState().addBuildingNode('coal-generator', { x: 0, y: 0 }, 'power');
    const n = useGraphStore.getState().nodes.at(-1)!;
    expect(n.data.recipeId).toBe('coal-generator-power');
  });

  it('un bâtiment multi-recettes (Smelter) reste à configurer', () => {
    useGraphStore.getState().addBuildingNode('smelter', { x: 0, y: 0 }, 'smelting');
    const n = useGraphStore.getState().nodes.at(-1)!;
    expect(n.data.recipeId).toBeUndefined();
  });
});

describe('useGraphStore — liaison mineur ↔ gisement', () => {
  const binding = {
    depositId: 'dep-1',
    pinIndex: 0,
    resourceId: 'iron-ore',
    purity: 'pure' as const,
    x: 300,
    y: 200,
  };

  beforeEach(() => {
    useGraphStore.setState({ nodes: [], edges: [], selectedNodeId: null, clipboard: null });
  });

  it('snapMinerToPin dénormalise ressource/pureté et repositionne le node sur le pin', () => {
    useGraphStore.setState({ nodes: [node('M', 'miner-mk1')], edges: [] });
    useGraphStore.getState().snapMinerToPin('M', binding);
    const m = useGraphStore.getState().nodes.find((n) => n.id === 'M')!;
    expect(m.data.depositId).toBe('dep-1');
    expect(m.data.pinIndex).toBe(0);
    expect(m.data.resourceId).toBe('iron-ore');
    expect(m.data.purity).toBe('pure');
    // Centré sur le pin (pin - demi-taille).
    expect(m.position.x).toBeLessThan(binding.x);
    expect(m.position.y).toBeLessThan(binding.y);
  });

  it('unbindMiner efface la liaison (mineur redevenu inactif)', () => {
    useGraphStore.setState({ nodes: [node('M', 'miner-mk1')], edges: [] });
    useGraphStore.getState().snapMinerToPin('M', binding);
    useGraphStore.getState().unbindMiner('M');
    const m = useGraphStore.getState().nodes.find((n) => n.id === 'M')!;
    expect(m.data.depositId).toBeUndefined();
    expect(m.data.resourceId).toBeUndefined();
    expect(m.data.purity).toBeUndefined();
  });

  it('placeMinerOnPin crée un mineur déjà lié', () => {
    useGraphStore.getState().placeMinerOnPin(binding);
    const st = useGraphStore.getState();
    expect(st.nodes).toHaveLength(1);
    const m = st.nodes[0];
    expect(m.data.buildingId).toBe('miner-mk1');
    expect(m.data.depositId).toBe('dep-1');
    expect(m.data.resourceId).toBe('iron-ore');
    expect(st.selectedNodeId).toBe(m.id);
  });

  it('unbindAllMiners détache tous les mineurs liés (régénération de carte)', () => {
    useGraphStore.setState({ nodes: [node('M1', 'miner-mk1'), node('M2', 'miner-mk1')], edges: [] });
    useGraphStore.getState().snapMinerToPin('M1', binding);
    useGraphStore.getState().snapMinerToPin('M2', { ...binding, depositId: 'dep-2', pinIndex: 1 });
    useGraphStore.getState().unbindAllMiners();
    for (const n of useGraphStore.getState().nodes) {
      expect(n.data.depositId).toBeUndefined();
    }
  });
});

describe('useGraphStore — copier/coller facture les AP comme une pose (anti-duplication gratuite)', () => {
  beforeEach(() => {
    useGraphStore.setState({ nodes: [], edges: [], selectedNodeId: null, clipboard: null });
    useProgressionStore.setState({ bolts: 50 });
  });

  it('coller un Smelter copié déduit son coût (10 AP), comme une pose depuis la palette', () => {
    const s = { ...node('A', 'smelter', 'iron-ingot'), selected: true };
    useGraphStore.setState({ nodes: [s], edges: [] });

    useGraphStore.getState().copySelection();
    useGraphStore.getState().paste();

    expect(useGraphStore.getState().nodes).toHaveLength(2);
    expect(useProgressionStore.getState().bolts).toBe(40);
  });

  it('Cmd/Ctrl+D (duplicateSelection) facture également le coût du bâtiment dupliqué', () => {
    const g = { ...node('G', 'coal-generator', 'coal-generator-power'), selected: true };
    useGraphStore.setState({ nodes: [g], edges: [] });

    useGraphStore.getState().duplicateSelection();

    expect(useGraphStore.getState().nodes).toHaveLength(2);
    expect(useProgressionStore.getState().bolts).toBe(35); // 50 - 15 AP (coal-generator)
  });

  it('AP insuffisants → le coller est refusé (aucun node ajouté, AP inchangés)', () => {
    useProgressionStore.setState({ bolts: 5 });
    const s = { ...node('A', 'smelter', 'iron-ingot'), selected: true };
    useGraphStore.setState({ nodes: [s], edges: [] });

    useGraphStore.getState().copySelection();
    useGraphStore.getState().paste();

    expect(useGraphStore.getState().nodes).toHaveLength(1);
    expect(useGraphStore.getState().placementDenied).not.toBeNull();
    expect(useProgressionStore.getState().bolts).toBe(5);
  });

  it('coller des hubs logistiques (splitter/merger, 5 AP chacun) déduit la somme', () => {
    const a = { ...node('A', 'splitter'), selected: true };
    const b = { ...node('B', 'merger'), selected: true };
    useGraphStore.setState({ nodes: [a, b], edges: [] });

    useGraphStore.getState().copySelection();
    useGraphStore.getState().paste();

    expect(useGraphStore.getState().nodes).toHaveLength(4);
    expect(useProgressionStore.getState().bolts).toBe(40); // 50 - (5 + 5)
  });
});
