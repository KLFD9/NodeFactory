import { useProgressionStore } from '@/store/useProgressionStore';

/**
 * Écran d'accueil du premier lancement — le pitch du jeu en 3 temps, zéro jargon.
 *
 * Ne s'affiche qu'une fois (welcomeSeen persisté) et uniquement pour un profil
 * vierge : un joueur qui revient avec de la progression ne le revoit jamais.
 * À la fermeture, le TutorialPanel prend le relais pour guider la première chaîne.
 */
export function WelcomeModal() {
  const welcomeSeen = useProgressionStore((s) => s.welcomeSeen);
  const hasProgress = useProgressionStore((s) => s.reachedMilestones.length > 0);
  const markWelcomeSeen = useProgressionStore((s) => s.markWelcomeSeen);

  if (welcomeSeen || hasProgress) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm"
      data-testid="welcome-modal"
    >
      <div className="mx-4 w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-7 shadow-2xl">
        <h1 className="text-xl font-black tracking-tight text-zinc-50">
          Node<span className="text-amber-400">Factory</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Construis une usine qui tourne toute seule — puis rends-la parfaite.
        </p>

        <ol className="mt-5 flex flex-col gap-3">
          {[
            ['⛏️', 'Extrais', 'Pose des mineurs sur les gisements de la carte.'],
            ['🏭', 'Automatise', 'Relie machines et convoyeurs : la production coule en continu, même hors-ligne.'],
            ['📈', 'Optimise', 'Franchis des paliers, débloque des recettes, vise le score d’efficacité parfait.'],
          ].map(([icon, title, detail]) => (
            <li key={title} className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-lg">
                {icon}
              </span>
              <div>
                <div className="text-sm font-bold text-zinc-100">{title}</div>
                <div className="text-xs text-zinc-500">{detail}</div>
              </div>
            </li>
          ))}
        </ol>

        <button
          onClick={markWelcomeSeen}
          className="mt-6 w-full cursor-pointer rounded-xl bg-amber-500 py-3 text-sm font-black text-zinc-950 transition-colors hover:bg-amber-400"
          data-testid="welcome-start"
        >
          Commencer — c’est parti ⚡
        </button>
        <p className="mt-3 text-center text-[10px] text-zinc-600">
          Gratuit, open source, sans compte. Ta progression est sauvegardée dans ce navigateur.
        </p>
      </div>
    </div>
  );
}
