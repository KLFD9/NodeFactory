import { useFactoryStore } from '@/store/useFactoryStore';
import { useGraphStore } from '@/store/useGraphStore';
import type { Purity } from '@/data/types';
import { computeNodeInfo, recipesForBuilding } from '@/graph/nodeInfo';

const PURITIES: { value: Purity; label: string }[] = [
  { value: 'impure', label: 'Impur' },
  { value: 'normal', label: 'Normal' },
  { value: 'pure', label: 'Pur' },
];

/** Panneau de configuration du node sélectionné. Vide si rien n'est sélectionné. */
export function Inspector() {
  const gameData = useFactoryStore((s) => s.gameData);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const node = useGraphStore((s) => s.nodes.find((n) => n.id === s.selectedNodeId));
  const updateNodeData = useGraphStore((s) => s.updateNodeData);

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

  const count = Math.max(1, node.data.count ?? 1);
  const round = (n: number) => Math.round(n * 1000) / 1000;

  const rawItems = gameData.items.filter((i) => i.raw);
  const recipes = recipesForBuilding(building.id, gameData);

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

      {building.category !== 'logistics' && (
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">
            Nombre de machines
          </label>
          <input
            type="number"
            min={1}
            step={1}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
            value={node.data.count ?? 1}
            onChange={(e) =>
              updateNodeData(node.id, { count: Math.max(1, Math.floor(Number(e.target.value) || 1)) })
            }
          />
        </div>
      )}

      {building.category === 'extraction' && (
        <div className="flex flex-col gap-3">
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
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Pureté du nœud</label>
            <div className="flex gap-1">
              {PURITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => updateNodeData(node.id, { purity: p.value })}
                  className={[
                    'flex-1 rounded-md border px-2 py-1 text-xs',
                    (node.data.purity ?? 'normal') === p.value
                      ? 'border-orange-500 bg-orange-500/10 text-orange-300'
                      : 'border-zinc-700 text-zinc-300',
                  ].join(' ')}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
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
          <div className="mb-1.5 text-[10px] text-zinc-500">
            Débits totaux (×{count} machine{count > 1 ? 's' : ''})
          </div>
          {info.inputs.length > 0 && (
            <div className="mb-2">
              <div className="mb-1 text-[11px] uppercase tracking-wide text-zinc-500">Entrées</div>
              {info.inputs.map((f) => (
                <div key={f.itemId} className="flex justify-between text-zinc-300">
                  <span>{f.itemName}</span>
                  <span>{round(f.ratePerMin * count)}/min</span>
                </div>
              ))}
            </div>
          )}
          <div className="mb-1 text-[11px] uppercase tracking-wide text-zinc-500">Sorties</div>
          {info.outputs.map((f) => (
            <div key={f.itemId} className="flex justify-between text-zinc-300">
              <span>{f.itemName}</span>
              <span>{round(f.ratePerMin * count)}/min</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
