import type { Edge } from '@xyflow/react';
import type { Belt, GameData } from '@/data/types';
import type { MachineNode } from '@/store/useGraphStore';
import { computeNodeInfo } from './nodeInfo';
import {
  computePowerNetworks,
  generatorFuelRequirement,
  isPowerSourceHandle,
  isPowerTargetHandle,
  type PowerNetwork,
} from './power';

/** Plan de convoyage pour un débit donné. */
export interface BeltPlan {
  /** Tier du convoyeur retenu (1..6), ou null si aucune donnée de belt. */
  tier: number | null;
  beltId: string | null;
  /** Nombre de lignes parallèles nécessaires (>1 = il faut splitter). */
  lines: number;
  capacityPerMin: number;
  /** true si une seule ligne ne suffit pas (surcharge → lignes parallèles). */
  overloaded: boolean;
}

/**
 * Choisit le convoyeur minimal couvrant `ratePerMin`. Au-delà du tier max,
 * répartit sur N lignes parallèles (brief : 1500/min → 2 lignes Mk6 + splitter).
 */
export function planBelt(ratePerMin: number, belts: Belt[]): BeltPlan {
  if (belts.length === 0) {
    return { tier: null, beltId: null, lines: 1, capacityPerMin: 0, overloaded: false };
  }
  const sorted = [...belts].sort((a, b) => a.capacityPerMin - b.capacityPerMin);
  const single = sorted.find((b) => b.capacityPerMin >= ratePerMin);
  if (single) {
    return {
      tier: single.tier,
      beltId: single.id,
      lines: 1,
      capacityPerMin: single.capacityPerMin,
      overloaded: false,
    };
  }
  const max = sorted[sorted.length - 1];
  return {
    tier: max.tier,
    beltId: max.id,
    lines: Math.ceil(ratePerMin / max.capacityPerMin),
    capacityPerMin: max.capacityPerMin,
    overloaded: true,
  };
}

export interface ItemRate {
  itemId: string;
  itemName: string;
  ratePerMin: number;
}

/** Plan logistique d'une arête : ce qui y circule et le convoyeur requis. */
export interface EdgePlan {
  edgeId: string;
  itemId: string | null;
  itemName: string | null;
  /** Débit effectivement transporté (plafonné à la capacité du meilleur convoyeur disponible). */
  ratePerMin: number;
  /** Débit théorique demandé (avant plafonnement) — sert au dimensionnement du convoyeur. */
  demandPerMin: number;
  belt: BeltPlan;
}

/** Bilan complet d'une usine construite sur le graphe — calcul PUR. */
export interface FactorySummary {
  totalMachines: number;
  totalPowerMW: number;
  /**
   * Machines configurées mais HORS TENSION (réseau électrique absent ou en déficit) :
   * elles ne produisent rien et ne comptent pas dans `totalMachines`/`production`.
   * L'électricité est une mécanique de jeu : pas de courant, pas de production.
   */
  unpoweredMachines: number;
  /** Items où il manque de la production (net < 0) et qui ne sont PAS bruts : vrais goulots. */
  deficits: ItemRate[];
  /** Ressources brutes à importer (net < 0 et item brut). */
  rawInputs: ItemRate[];
  /** Excédents (net > 0). */
  surplus: ItemRate[];
  /**
   * Production BRUTE par item (avant déduction de la consommation aval).
   * Contrairement à `surplus`, inclut les intermédiaires entièrement consommés —
   * c'est la base des milestones de production de la couche jeu (« produire N lingots »
   * compte même si les lingots sont consommés en aval). Trié par débit décroissant.
   */
  production: ItemRate[];
  /**
   * Consommation BRUTE par item (toutes machines confondues), miroir de `production`.
   * Permet d'afficher « X produit / Y consommé » par ressource (Diagnostics réseau).
   */
  consumption: ItemRate[];
  edges: EdgePlan[];
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Agrège le graphe : machines, énergie, bilan matière (production vs consommation),
 * et plan logistique par arête. Indépendant de React.
 *
 * ÉLECTRICITÉ (mécanique de jeu) : une machine dont le réseau électrique est absent
 * ou en déficit NE PRODUIT PAS (elle est comptée dans `unpoweredMachines`). Par défaut,
 * les réseaux sont calculés ici via `computePowerNetworks`. `poweredOverride` permet
 * d'injecter un état (ou de neutraliser le gating avec `new Map()` — utile pour les
 * calculs THÉORIQUES : assistance LP, score d'efficacité, tests logistiques purs).
 */
export function computeFactory(
  nodes: MachineNode[],
  edges: Edge[],
  game: GameData,
  poweredOverride?: Map<string, boolean>,
): FactorySummary {
  if (poweredOverride) return runPass(nodes, edges, game, poweredOverride);
  return computeFactoryAndPower(nodes, edges, game).summary;
}

export interface FactoryAndPower {
  summary: FactorySummary;
  networks: PowerNetwork[];
  poweredByNode: Map<string, boolean>;
}

/**
 * Calcule le bilan ET les réseaux électriques en une seule passe cohérente, en tenant compte
 * du combustible des générateurs (« pas de charbon, pas de courant »).
 *
 * Le combustible d'un générateur dépend du flux de matière, qui dépend lui-même de l'état
 * d'alimentation des machines amont (le mineur de charbon a besoin de courant pour tourner) :
 * deux passes suffisent (pas de boucle énergie→fuel→énergie autorisée) :
 *  1. Réseaux + bilan en supposant tous les générateurs nourris (comportement historique) →
 *     donne le flux de combustible réel vers chaque générateur.
 *  2. À partir de ce flux, détermine quels générateurs sont effectivement nourris, recalcule
 *     les réseaux (générateur non nourri = 0 MW généré) puis le bilan final.
 */
export function computeFactoryAndPower(nodes: MachineNode[], edges: Edge[], game: GameData): FactoryAndPower {
  const pass1Powered = computePowerNetworks(nodes, edges, game).poweredByNode;
  const pass1 = runPass(nodes, edges, game, pass1Powered);

  const fedByNode = computeFedByNode(nodes, edges, game, pass1);
  const { networks, poweredByNode } = computePowerNetworks(nodes, edges, game, fedByNode);
  const summary = runPass(nodes, edges, game, poweredByNode, fedByNode);

  return { summary, networks, poweredByNode };
}

const FUEL_EPS = 0.01;

/** Pour chaque générateur consommant un combustible, est-il nourri par le flux réel (passe 1) ? */
function computeFedByNode(
  nodes: MachineNode[],
  edges: Edge[],
  game: GameData,
  pass1: FactorySummary,
): Map<string, boolean> {
  const fed = new Map<string, boolean>();
  const plans = new Map(pass1.edges.map((p) => [p.edgeId, p]));
  for (const node of nodes) {
    const building = game.buildings.find((b) => b.id === node.data.buildingId);
    if (!building || building.category !== 'power') continue;
    const req = generatorFuelRequirement(building.id, game);
    if (!req) {
      fed.set(node.id, true);
      continue;
    }
    const count = Math.max(1, node.data.count ?? 1);
    const required = req.ratePerMin * count;
    const targetHandle = `in-${req.itemId}`;
    let incoming = 0;
    for (const e of edges) {
      if (e.target !== node.id || e.targetHandle !== targetHandle) continue;
      incoming += plans.get(e.id)?.ratePerMin ?? 0;
    }
    fed.set(node.id, incoming >= required - FUEL_EPS);
  }
  return fed;
}

function runPass(
  nodes: MachineNode[],
  edges: Edge[],
  game: GameData,
  powered: Map<string, boolean>,
  fedByNode?: Map<string, boolean>,
): FactorySummary {
  const itemName = (id: string) => game.items.find((i) => i.id === id)?.name ?? id;
  const isRaw = (id: string) => game.items.find((i) => i.id === id)?.raw ?? false;

  const production = new Map<string, number>();
  const consumption = new Map<string, number>();
  const add = (map: Map<string, number>, id: string, v: number) =>
    map.set(id, (map.get(id) ?? 0) + v);

  let totalMachines = 0;
  let totalPowerMW = 0;
  let unpoweredMachines = 0;

  // Débit de sortie par item de chaque node (pour router les arêtes par handle).
  const nodeOutputs = new Map<string, Map<string, number>>();

  for (const node of nodes) {
    const info = computeNodeInfo(node.data, game);
    if (!info.building || info.building.category === 'logistics') continue;
    const count = Math.max(1, node.data.count ?? 1);

    if (info.configured) {
      if (info.building.category === 'power') {
        // Pas de combustible, pas de courant : un générateur non nourri ne produit rien
        // (ni MW, ni la sortie virtuelle « electricity ») et ne consomme pas son fuel.
        if ((fedByNode?.get(node.id) ?? true) === false) continue;
      } else if (powered.get(node.id) === false) {
        // Hors tension : la machine existe mais ne tourne pas (zéro flux, zéro conso).
        unpoweredMachines += count;
        continue;
      }
      totalMachines += count;
      totalPowerMW += info.powerMW * count;
      for (const out of info.outputs) add(production, out.itemId, out.ratePerMin * count);
      for (const inp of info.inputs) add(consumption, inp.itemId, inp.ratePerMin * count);
      const outMap = new Map<string, number>();
      for (const out of info.outputs) outMap.set(out.itemId, out.ratePerMin * count);
      nodeOutputs.set(node.id, outMap);
    }
  }

  const deficits: ItemRate[] = [];
  const rawInputs: ItemRate[] = [];
  const surplus: ItemRate[] = [];
  const allItems = new Set([...production.keys(), ...consumption.keys()]);
  for (const id of allItems) {
    const net = round((production.get(id) ?? 0) - (consumption.get(id) ?? 0));
    if (net < 0) {
      const entry = { itemId: id, itemName: itemName(id), ratePerMin: -net };
      (isRaw(id) ? rawInputs : deficits).push(entry);
    } else if (net > 0) {
      surplus.push({ itemId: id, itemName: itemName(id), ratePerMin: net });
    }
  }

  // Propagation de flux : résout l'item + débit de chaque arête, en traversant les hubs
  // logistiques (merger = somme des entrées ; splitter = entrée répartie sur les sorties).
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const isLogistics = (id: string) =>
    game.buildings.find((b) => b.id === nodeById.get(id)?.data.buildingId)?.category === 'logistics';
  const out = new Map<string, Edge[]>();
  const inc = new Map<string, Edge[]>();
  for (const e of edges) {
    (out.get(e.source) ?? out.set(e.source, []).get(e.source)!).push(e);
    (inc.get(e.target) ?? inc.set(e.target, []).get(e.target)!).push(e);
  }

  // Capacité du meilleur convoyeur disponible : un flux qui la dépasse est plafonné
  // (le surplus n'est ni transporté ni propagé en aval — surcharge réelle).
  const maxBeltCapacity =
    game.belts.length > 0 ? Math.max(...game.belts.map((b) => b.capacityPerMin)) : Infinity;

  const edgeFlow = new Map<string, { itemId: string | null; rate: number; demand: number }>();
  const resolving = new Set<string>();
  const isPowerEdge = (e: Edge) => isPowerSourceHandle(e.sourceHandle) && isPowerTargetHandle(e.targetHandle);

  const resolveEdge = (e: Edge): { itemId: string | null; rate: number; demand: number } => {
    // Câbles énergie : réseau séparé, ne portent aucun flux d'item.
    if (isPowerEdge(e)) return { itemId: null, rate: 0, demand: 0 };
    const cached = edgeFlow.get(e.id);
    if (cached) return cached;
    if (resolving.has(e.id)) return { itemId: null, rate: 0, demand: 0 }; // garde anti-cycle
    resolving.add(e.id);

    let item: string | null;
    let demand: number;
    if (isLogistics(e.source)) {
      // Total réellement entrant du hub (déjà plafonné en amont), réparti sur ses arêtes sortantes.
      let total = 0;
      item = null;
      for (const ie of inc.get(e.source) ?? []) {
        const r = resolveEdge(ie);
        total += r.rate;
        if (item == null) item = r.itemId;
      }
      const outDeg = (out.get(e.source) ?? []).length || 1;
      demand = total / outDeg;
    } else {
      // Node machine : débit de l'item du handle source, réparti sur les belts du même handle.
      const map = nodeOutputs.get(e.source);
      const handleItem = e.sourceHandle?.startsWith('out-') ? e.sourceHandle.slice(4) : undefined;
      item = handleItem && map?.has(handleItem) ? handleItem : (map?.keys().next().value ?? null);
      const sameHandle = (out.get(e.source) ?? []).filter(
        (x) => (x.sourceHandle ?? '') === (e.sourceHandle ?? ''),
      ).length;
      demand = item ? (map?.get(item) ?? 0) / (sameHandle || 1) : 0;
    }

    const res = { itemId: item, rate: Math.min(demand, maxBeltCapacity), demand };
    resolving.delete(e.id);
    edgeFlow.set(e.id, res);
    return res;
  };

  const edgePlans: EdgePlan[] = edges.map((e) => {
    const flow = resolveEdge(e);
    return {
      edgeId: e.id,
      itemId: flow.itemId,
      itemName: flow.itemId ? itemName(flow.itemId) : null,
      ratePerMin: round(flow.rate),
      demandPerMin: round(flow.demand),
      belt: planBelt(flow.demand, game.belts),
    };
  });

  const byRate = (a: ItemRate, b: ItemRate) => b.ratePerMin - a.ratePerMin;
  const grossProduction: ItemRate[] = [];
  for (const [id, rate] of production) {
    if (rate > 0) grossProduction.push({ itemId: id, itemName: itemName(id), ratePerMin: round(rate) });
  }
  const grossConsumption: ItemRate[] = [];
  for (const [id, rate] of consumption) {
    if (rate > 0) grossConsumption.push({ itemId: id, itemName: itemName(id), ratePerMin: round(rate) });
  }
  return {
    totalMachines,
    totalPowerMW: round(totalPowerMW),
    unpoweredMachines,
    deficits: deficits.sort(byRate),
    rawInputs: rawInputs.sort(byRate),
    surplus: surplus.sort(byRate),
    production: grossProduction.sort(byRate),
    consumption: grossConsumption.sort(byRate),
    edges: edgePlans,
  };
}
