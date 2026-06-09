import { describe, expect, it } from 'vitest';
import type { Edge } from '@xyflow/react';
import { loadMockGameData } from '@/test/loadMock';
import { isValidGraphConnection } from './connection';

const game = loadMockGameData();
const ok = (c: Parameters<typeof isValidGraphConnection>[0], edges: Edge[] = []) =>
  isValidGraphConnection(c, edges, [], game);

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
});
