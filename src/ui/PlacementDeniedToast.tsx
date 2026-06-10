import { useEffect } from 'react';
import { useFactoryStore } from '@/store/useFactoryStore';
import { useGraphStore } from '@/store/useGraphStore';

/** Durée d'affichage avant auto-fermeture (ms). */
const TOAST_TTL = 3000;

/**
 * Avertissement « AP insuffisants » : pose refusée faute de solde suffisant.
 * Consomme `placementDenied` du store de graphe, auto-disparaît après TOAST_TTL.
 */
export function PlacementDeniedToast() {
  const gameData = useFactoryStore((s) => s.gameData);
  const denied = useGraphStore((s) => s.placementDenied);
  const dismiss = useGraphStore((s) => s.dismissPlacementDenied);

  useEffect(() => {
    if (!denied) return;
    const id = setTimeout(() => dismiss(), TOAST_TTL);
    return () => clearTimeout(id);
  }, [denied, dismiss]);

  if (!gameData || !denied) return null;
  const name = gameData.buildings.find((b) => b.id === denied.buildingId)?.name ?? denied.buildingId;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <div
        role="alert"
        className="pointer-events-auto rounded-lg border border-red-800/60 bg-red-950/80 px-3 py-2 text-xs text-red-200 shadow-lg backdrop-blur"
      >
        <span className="font-semibold">AP insuffisants</span> — {name} coûte {denied.cost} AP
        (solde : {Math.floor(denied.available)}).
      </div>
    </div>
  );
}
