import { useFactoryStore } from '@/store/useFactoryStore';
import { useGraphStore } from '@/store/useGraphStore';
import { useProgressionStore } from '@/store/useProgressionStore';
import { isRecipeUnlocked } from '@/game/progression';
import { computeNodeInfo, recipesForBuilding } from '@/graph/nodeInfo';

/** Panneau de configuration du node sélectionné. Vide si rien n'est sélectionné. */
export function Inspector() {
  const gameData = useFactoryStore((s) => s.gameData);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const node = useGraphStore((s) => s.nodes.find((n) => n.id === s.selectedNodeId));
  const updateNodeData = useGraphStore((s) => s.updateNodeData);
  const duplicateSelection = useGraphStore((s) => s.duplicateSelection);
  const unlockedRecipes = useProgressionStore((s) => s.unlockedRecipes);

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

  const round = (n: number) => Math.round(n * 1000) / 1000;
  const rawItems = gameData.items.filter((i) => i.raw);
  // Masque les recettes alternatives non débloquées (les standard restent toujours visibles).
  const recipes = recipesForBuilding(building.id, gameData).filter((r) =>
    isRecipeUnlocked({ unlockedRecipes }, r.id),
  );

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div>
        <h2 className="text-sm font-semibold text-zinc-300">{building.name}</h2>
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
      </div>

      {building.category === 'extraction' && (
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">Ressource extraite</label>
          <select
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
            value={node.data.resourceId ?? ''}
            onChange={(e) => updateNodeData(node.id, { resourceId: e.target.value || undefined })}
          >
            <option value="">— choisir —</option>
            {rawItems.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {building.category !== 'extraction' && building.category !== 'logistics' && (
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">Recette</label>
          <select
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
            value={node.data.recipeId ?? ''}
            onChange={(e) => updateNodeData(node.id, { recipeId: e.target.value || undefined })}
          >
            <option value="">— choisir —</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {(info.inputs.length > 0 || info.outputs.length > 0) && (
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
