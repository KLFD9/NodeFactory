import { useEffect } from 'react';
import { useFactoryStore } from '@/store/useFactoryStore';
import { useGraphStore } from '@/store/useGraphStore';
import { useProgressionStore } from '@/store/useProgressionStore';
import { isRecipeUnlocked } from '@/game/progression';
import { computeNodeInfo, recipesForBuilding } from '@/graph/nodeInfo';
import { ItemIcon } from '@/ui/assets';
import { PURITY_MULTIPLIER, type Purity } from '@/data/types';

const PURITY_LABEL: Record<Purity, string> = { impure: 'Impur', normal: 'Normal', pure: 'Pur' };

/** Panneau de configuration du node sélectionné. Vide si rien n'est sélectionné. */
export function Inspector() {
  const gameData = useFactoryStore((s) => s.gameData);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const node = useGraphStore((s) => s.nodes.find((n) => n.id === s.selectedNodeId));
  const edges = useGraphStore((s) => s.edges);
  const updateNodeData = useGraphStore((s) => s.updateNodeData);
  const unbindMiner = useGraphStore((s) => s.unbindMiner);
  const duplicateSelection = useGraphStore((s) => s.duplicateSelection);
  const unlockedRecipes = useProgressionStore((s) => s.unlockedRecipes);

  // Bâtiment mono-recette (ex. Coal Generator) sans recette encore posée → auto-assignation
  // (filet de sécurité pour les nodes créés avant cette règle ; la pose la fait déjà).
  useEffect(() => {
    if (!gameData || !node || node.data.recipeId) return;
    const b = gameData.buildings.find((x) => x.id === node.data.buildingId);
    if (!b || b.category === 'extraction' || b.category === 'logistics') return;
    const std = gameData.recipes.filter(
      (r) => r.producedIn === b.id && !r.alternate && isRecipeUnlocked({ unlockedRecipes }, r.id),
    );
    if (std.length === 1) updateNodeData(node.id, { recipeId: std[0].id }, gameData);
  }, [node, gameData, unlockedRecipes, updateNodeData]);

  if (!gameData || !selectedNodeId || !node) {
    return (
      <div className="text-xs text-zinc-500">
        <h2 className="mb-2 text-sm font-semibold text-zinc-300">Inspecteur</h2>
        <p>Sélectionne un node sur le canvas pour le configurer.</p>
      </div>
    );
  }

  const info = computeNodeInfo(node.data, gameData);
  const building = info.building;
  if (!building) return null;

  const isPole = building.id === 'power-pole';
  const connections = edges.filter(
    (e) =>
      (e.source === node.id && (e.sourceHandle ?? '').startsWith('power-out')) ||
      (e.target === node.id && e.targetHandle === 'power-in'),
  ).length;

  const round = (n: number) => Math.round(n * 1000) / 1000;
  // Masque les recettes alternatives non débloquées (les standard restent toujours visibles).
  const recipes = recipesForBuilding(building.id, gameData).filter((r) =>
    isRecipeUnlocked({ unlockedRecipes }, r.id),
  );

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div>
        <h2 className="text-sm font-semibold text-zinc-300">{building.name}</h2>
        {isPole ? (
          <div className="mt-2 rounded-md border border-amber-900/40 bg-amber-950/10 p-2 text-[11px] text-zinc-400">
            <p>
              Hub de dispatch passif (0 MW). Une entrée (anneau) reçoit l'énergie d'un générateur ou
              d'un autre poteau ; jusqu'à 3 sorties (disques pleins) l'acheminent vers d'autres
              poteaux ou consommateurs.
            </p>
            <div className="mt-2 flex items-center justify-between">
              <span>Câbles connectés</span>
              <span className={`font-mono font-semibold ${connections >= 4 ? 'text-amber-400' : 'text-zinc-300'}`}>
                {connections}/4
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-zinc-500">
            <span>Catégorie</span>
            <span className="text-right text-zinc-300">{building.category}</span>
            <span>Puissance</span>
            <span className="text-right text-zinc-300">{building.powerMW} MW</span>
            {building.outputs != null && (
              <>
                <span>Sorties</span>
                <span className="text-right text-zinc-300">{building.outputs}</span>
              </>
            )}
            {building.dimensions && (
              <>
                <span>Encombrement</span>
                <span className="text-right text-zinc-300">
                  {building.dimensions.width}×{building.dimensions.length}×{building.dimensions.height} m
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {!isPole && building.category === 'extraction' && (
        node.data.depositId != null && node.data.resourceId ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Gisement</label>
            <div className="rounded-md border border-amber-900/40 bg-amber-950/10 p-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-semibold text-amber-300">
                  <ItemIcon itemId={node.data.resourceId} size={20} />
                  {gameData.items.find((i) => i.id === node.data.resourceId)?.name ?? node.data.resourceId}
                </span>
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-300">
                  {PURITY_LABEL[node.data.purity ?? 'normal']} · ×{PURITY_MULTIPLIER[node.data.purity ?? 'normal']}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">
                Ressource et pureté héritées du gisement. Détache le mineur pour le déplacer.
              </p>
            </div>
            <button
              type="button"
              onClick={() => unbindMiner(node.id)}
              className="mt-2 w-full rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"
            >
              Détacher du gisement
            </button>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-zinc-700 bg-zinc-900/40 p-2 text-[11px] text-zinc-400">
            Ce mineur n'est lié à aucun gisement. Glisse-le sur un gisement, ou clique un pin sur la
            carte. Tant qu'il n'extrait rien, il reste inactif.
          </div>
        )
      )}

      {!isPole && building.category !== 'extraction' && building.category !== 'logistics' && (
        recipes.length > 1 ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Recette</label>
            <select
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
              value={node.data.recipeId ?? ''}
              onChange={(e) => updateNodeData(node.id, { recipeId: e.target.value || undefined }, gameData)}
            >
              <option value="">— choisir —</option>
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        ) : recipes.length === 1 ? (
          // Bâtiment mono-recette : pas de choix à faire (auto-assigné), affichage lecture seule.
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Recette</label>
            <div className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1.5 text-sm text-zinc-300">
              {recipes[0].name}
            </div>
          </div>
        ) : null
      )}

      {!isPole && (info.inputs.length > 0 || info.outputs.length > 0) && (
        <div className="rounded-md border border-zinc-800 p-2 text-xs">
          <div className="mb-1.5 text-[10px] text-zinc-500">Débits (1 machine)</div>
          {info.inputs.length > 0 && (
            <div className="mb-2">
              <div className="mb-1 text-[11px] uppercase tracking-wide text-zinc-500">Entrées</div>
              {info.inputs.map((f) => (
                <div key={f.itemId} className="flex justify-between text-zinc-300">
                  <span>{f.itemName}</span>
                  <span>{round(f.ratePerMin)}/min</span>
                </div>
              ))}
            </div>
          )}
          <div className="mb-1 text-[11px] uppercase tracking-wide text-zinc-500">Sorties</div>
          {info.outputs.map((f) => (
            <div key={f.itemId} className="flex justify-between text-zinc-300">
              <span>{f.itemName}</span>
              <span>{round(f.ratePerMin)}/min</span>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => duplicateSelection()}
        className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-500"
        title="Dupliquer ce node (Cmd/Ctrl+D)"
      >
        Dupliquer
      </button>
    </div>
  );
}
