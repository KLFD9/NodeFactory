import type { MachineNode } from '@/store/useGraphStore';

/** Un point de branchement : un handle précis d'un node. */
export interface Endpoint {
  node: string;
  handle: string;
}

/** Collecteur de nodes/arêtes + fabrique d'ids/positions de hubs. */
export interface LogisticsSink {
  pushNode: (node: MachineNode) => void;
  pushEdge: (src: Endpoint, dst: Endpoint) => void;
  hubId: () => string;
  hubPosition: () => { x: number; y: number };
}

// Capacités réelles des hubs Satisfactory.
const MERGER_INPUTS = 3; // 3 entrées max → 1 sortie
const SPLITTER_OUTPUTS = 3; // 1 entrée → 3 sorties max

/** Découpe un tableau en `k` groupes contigus à peu près égaux. */
function partition<T>(arr: T[], k: number): T[][] {
  const groups: T[][] = [];
  const size = Math.ceil(arr.length / k);
  for (let i = 0; i < arr.length; i += size) groups.push(arr.slice(i, i + size));
  return groups;
}

/** Arbre de mergers (3→1) : combine N sources en une seule sortie. */
function mergeInputs(sources: Endpoint[], sink: LogisticsSink): Endpoint {
  let level = sources;
  while (level.length > 1) {
    const next: Endpoint[] = [];
    for (let i = 0; i < level.length; i += MERGER_INPUTS) {
      const chunk = level.slice(i, i + MERGER_INPUTS);
      if (chunk.length === 1) {
        next.push(chunk[0]);
        continue;
      }
      const mg = sink.hubId();
      sink.pushNode({
        id: mg,
        type: 'machine',
        position: sink.hubPosition(),
        data: { buildingId: 'merger', portsIn: chunk.length, portsOut: 1 },
      });
      chunk.forEach((src, k) => sink.pushEdge(src, { node: mg, handle: `in-${k}` }));
      next.push({ node: mg, handle: 'out-0' });
    }
    level = next;
  }
  return level[0];
}

/** Arbre de splitters (1→3) : distribue une source vers N consommateurs. */
function splitOutput(src: Endpoint, consumers: Endpoint[], sink: LogisticsSink): void {
  if (consumers.length === 1) {
    sink.pushEdge(src, consumers[0]);
    return;
  }
  const branches = Math.min(SPLITTER_OUTPUTS, consumers.length);
  const sp = sink.hubId();
  sink.pushNode({
    id: sp,
    type: 'machine',
    position: sink.hubPosition(),
    data: { buildingId: 'splitter', portsIn: 1, portsOut: branches },
  });
  sink.pushEdge(src, { node: sp, handle: 'in-0' });
  partition(consumers, branches).forEach((group, i) =>
    splitOutput({ node: sp, handle: `out-${i}` }, group, sink),
  );
}

/**
 * Relie N producteurs à M consommateurs d'un même item via un arbre merger (3→1)
 * puis splitter (1→3), en respectant les capacités réelles du jeu (hubs chaînés).
 */
export function connectFlow(producers: Endpoint[], consumers: Endpoint[], sink: LogisticsSink): void {
  if (producers.length === 0 || consumers.length === 0) return;
  const bus = mergeInputs(producers, sink);
  splitOutput(bus, consumers, sink);
}
