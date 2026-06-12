import { useProgressionStore } from '@/store/useProgressionStore';
import { ExtractionIcon, ManufacturingIcon } from '@/ui/icons';

function OptimizeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      {...props}
    >
      <path d="M3 3v18h18" />
      <path d="m18.5 7.5-6 6-3-3-4.5 4.5" />
      <path d="M14 7.5h4.5V12" />
    </svg>
  );
}

/**
 * Écran d'accueil du premier lancement — le pitch du jeu en 3 temps, version HUD premium.
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

  const directives = [
    {
      id: '01',
      title: 'Extrais',
      detail: 'Pose des mineurs sur les gisements de la carte pour collecter les ressources brutes.',
      icon: <ExtractionIcon className="h-5 w-5 text-orange-400 group-hover:scale-110 transition-transform duration-200" />,
      themeColor: '#f97316',
      glowColor: 'rgba(249, 115, 22, 0.25)',
      params: 'RESOURCE: RAW_ORE // RATE: 60/MIN // SYSTEM: ACTIVE',
      badgeColor: 'border-orange-500/30 bg-orange-500/10 text-orange-400',
    },
    {
      id: '02',
      title: 'Automatise',
      detail: 'Relie machines et convoyeurs : la production coule en continu, même hors-ligne.',
      icon: <ManufacturingIcon className="h-5 w-5 text-cyan-400 group-hover:scale-110 transition-transform duration-200" />,
      themeColor: '#22d3ee',
      glowColor: 'rgba(34, 211, 238, 0.25)',
      params: 'LOGISTICS: BELTS // FLOW: AUTO // OFFLINE_PROD: COMPLIANT',
      badgeColor: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400',
    },
    {
      id: '03',
      title: 'Optimise',
      detail: 'Franchis des paliers, débloque des recettes alternatives, et vise le score parfait.',
      icon: <OptimizeIcon className="h-5 w-5 text-emerald-400 group-hover:scale-110 transition-transform duration-200" />,
      themeColor: '#34d399',
      glowColor: 'rgba(52, 211, 153, 0.25)',
      params: 'METRIC: SOLVER_LP // RATING: EFFICIENT // LEVEL: OPTIMAL',
      badgeColor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center nf-welcome-backdrop overflow-y-auto p-4 animate-fade-in"
      data-testid="welcome-modal"
    >
      {/* Glow d'arrière-plan atmosphérique */}
      <div className="absolute inset-0 pointer-events-none opacity-25 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-500/15 via-transparent to-transparent"></div>

      <div className="relative w-full max-w-xl rounded-xl border border-zinc-800/80 bg-zinc-950/85 p-8 shadow-2xl backdrop-blur-xl nf-glow-box-orange animate-slide-up">
        {/* Coins HUD Industriels */}
        <div className="nf-hud-corner nf-hud-corner-tl" style={{ '--hud-border-color': 'rgba(249, 115, 22, 0.5)' } as React.CSSProperties} />
        <div className="nf-hud-corner nf-hud-corner-tr" style={{ '--hud-border-color': 'rgba(249, 115, 22, 0.5)' } as React.CSSProperties} />
        <div className="nf-hud-corner nf-hud-corner-bl" style={{ '--hud-border-color': 'rgba(249, 115, 22, 0.5)' } as React.CSSProperties} />
        <div className="nf-hud-corner nf-hud-corner-br" style={{ '--hud-border-color': 'rgba(249, 115, 22, 0.5)' } as React.CSSProperties} />

        {/* Télémétrie supérieure */}
        <div className="flex justify-between items-center text-[9px] font-mono text-zinc-500 tracking-wider mb-6 border-b border-zinc-900 pb-2">
          <span>SYS_BOOT: OK // VER_0.1.0</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse"></span>
            SECTOR_NODE_FACTORY_ONLINE
          </span>
        </div>

        {/* En-tête et Titre du Jeu */}
        <div className="text-center md:text-left mb-6">
          <h1 className="text-3xl font-black tracking-tight text-zinc-50 uppercase flex items-center justify-center md:justify-start gap-2">
            <span>Node</span>
            <span className="text-orange-500 nf-glow-text-orange relative">
              Factory
              <span className="absolute -bottom-1 left-0 w-full h-[2px] bg-orange-500/25"></span>
            </span>
          </h1>
          <p className="mt-2 text-sm text-zinc-400 font-sans">
            Construis une usine qui tourne toute seule — puis rends-la parfaite.
          </p>
        </div>

        {/* Liste des directives (Modules Interactifs) */}
        <div className="mt-6 space-y-4">
          <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-2 px-1">
            // DIRECTIVES DU SYSTEME
          </div>

          <div className="flex flex-col gap-3">
            {directives.map((dir) => (
              <div
                key={dir.title}
                className="group relative flex flex-col md:flex-row items-start gap-4 p-4 rounded-lg bg-zinc-900/30 nf-interactive-module hover:cursor-default"
                style={{
                  '--hover-color-border': dir.themeColor,
                  '--hover-color-glow': dir.glowColor,
                } as React.CSSProperties}
              >
                {/* Conteneur de l'icône */}
                <div 
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 shadow-inner transition-colors duration-200"
                  style={{ borderColor: 'rgba(63, 63, 70, 0.4)' }}
                >
                  {dir.icon}
                </div>

                {/* Contenu textuel */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${dir.badgeColor}`}>
                      DIR_{dir.id}
                    </span>
                    <h3 className="text-sm font-bold text-zinc-100 group-hover:text-zinc-50 transition-colors duration-150">
                      {dir.title}
                    </h3>
                  </div>

                  <p className="mt-1 text-xs text-zinc-400 leading-relaxed font-sans">
                    {dir.detail}
                  </p>

                  {/* Paramètres techniques (Style Télémétrie) */}
                  <div className="mt-2 nf-tech-stat">
                    {dir.params}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bouton d'action et bas de page */}
        <div className="mt-8 pt-4 border-t border-zinc-900">
          <button
            onClick={markWelcomeSeen}
            className="w-full py-3.5 px-6 rounded-lg text-sm font-black tracking-widest text-zinc-950 uppercase nf-cta-btn cursor-pointer"
            data-testid="welcome-start"
          >
            Commencer la simulation ⚡
          </button>
          
          <div className="mt-4 flex flex-col md:flex-row justify-between items-center text-[9px] font-mono text-zinc-500 gap-2 px-1">
            <span>STATUS: READY_TO_LAUNCH</span>
            <span>DATA_PERSIST: LOCAL_STORAGE</span>
            <span>BUILD: 100%_CLIENT_SIDE</span>
          </div>
        </div>
      </div>
    </div>
  );
}
