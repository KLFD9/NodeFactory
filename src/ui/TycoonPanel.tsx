import { useEffect, useMemo, useState } from 'react';
import { useProgressionStore } from '@/store/useProgressionStore';
import {
  MODEL_TYPES,
  DOMAINS,
  TRAINING_PHASES,
  PHASE_INFO,
  STAFF_ROLES,
  modelTypeDef,
  normalizeAllocation,
  computeModelQuality,
  runProgress,
  isRunComplete,
  trendMatchOf,
  marketingCost,
  canMarket,
  labQualityBonus,
  totalSalaryPerMin,
  HYPE_MAX,
  TREND_FULL_MATCH_MULT,
  TREND_TYPE_MATCH_MULT,
  type ModelTypeId,
  type DomainId,
  type TrainingPhase,
  type PhaseAllocation,
  type ActiveProject,
  type ModelReview,
  type StaffRole,
} from '@/game/tycoon';

const nameOfType = (id: ModelTypeId) => MODEL_TYPES.find((m) => m.id === id)?.name ?? id;
const nameOfDomain = (id: DomainId) => DOMAINS.find((d) => d.id === id)?.name ?? id;

/** Bandeau de la tendance de marché courante. */
function TrendBanner({ modelType, domain }: { modelType?: ModelTypeId; domain?: DomainId }) {
  const trend = useProgressionStore((s) => s.tycoon.trend);
  const match = modelType && domain ? trendMatchOf(trend, modelType, domain) : 'none';
  const pct =
    match === 'full'
      ? Math.round((TREND_FULL_MATCH_MULT - 1) * 100)
      : match === 'type'
        ? Math.round((TREND_TYPE_MATCH_MULT - 1) * 100)
        : 0;
  return (
    <div className="rounded border border-cyan-500/25 bg-cyan-950/10 p-2.5" data-testid="market-trend">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-cyan-500/80">
          // TENDANCE
        </span>
        {pct > 0 && (
          <span className="font-mono text-[9px] font-bold text-emerald-400">+{pct}% réception</span>
        )}
      </div>
      <p className="mt-1 text-[11px] leading-snug text-zinc-300">
        <span className="font-semibold text-cyan-300">{nameOfType(trend.modelType)}</span>
        {' · '}
        <span className="text-zinc-400">{nameOfDomain(trend.domain)}</span>
        {' '}<span className="text-zinc-600">est « hot » en ce moment.</span>
      </p>
    </div>
  );
}

/** Petite jauge horizontale. */
function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded border border-zinc-800 bg-zinc-900">
      <span
        className={`block h-full rounded transition-[width] duration-500 ${color}`}
        style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }}
      />
    </div>
  );
}

/** Formulaire de lancement d'un projet (type × domaine × dosage des phases). */
function ProjectSetup() {
  const startProject = useProgressionStore((s) => s.startProject);
  const [modelType, setModelType] = useState<ModelTypeId>('language');
  const [domain, setDomain] = useState<DomainId>('assistant');
  const def = modelTypeDef(modelType);

  // Curseurs d'effort 0-100 par phase ; réinitialisés sur le dosage idéal du type choisi
  // (nudge pédagogique — le joueur reste libre d'ajuster).
  const [effort, setEffort] = useState<Record<TrainingPhase, number>>(() =>
    Object.fromEntries(TRAINING_PHASES.map((p) => [p, Math.round(def.idealEffort[p] * 100)])) as Record<
      TrainingPhase,
      number
    >,
  );
  useEffect(() => {
    const ideal = modelTypeDef(modelType).idealEffort;
    setEffort(
      Object.fromEntries(TRAINING_PHASES.map((p) => [p, Math.round(ideal[p] * 100)])) as Record<
        TrainingPhase,
        number
      >,
    );
  }, [modelType]);

  const normalized = useMemo(() => normalizeAllocation(effort as PhaseAllocation), [effort]);
  // Aperçu de l'adéquation du dosage au mix idéal (composante « skill » de la qualité).
  const mixScore = useMemo(() => {
    const ideal = modelTypeDef(modelType).idealEffort;
    const dist = TRAINING_PHASES.reduce((s, p) => s + Math.abs(normalized[p] - ideal[p]), 0);
    return Math.max(0, 1 - dist / 2);
  }, [normalized, modelType]);

  const keyItemDataset = def.keyDatasetItemId;

  return (
    <div className="flex flex-col gap-3" data-testid="project-setup">
      <TrendBanner modelType={modelType} domain={domain} />

      {/* Type de modèle */}
      <div>
        <label className="text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-500">
          Type de modèle
        </label>
        <select
          value={modelType}
          onChange={(e) => setModelType(e.target.value as ModelTypeId)}
          data-testid="select-model-type"
          className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 font-sans text-xs text-zinc-200 focus:border-cyan-500/60 focus:outline-none"
        >
          {MODEL_TYPES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[10px] italic leading-snug text-zinc-500">{def.blurb}</p>
      </div>

      {/* Domaine d'application */}
      <div>
        <label className="text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-500">
          Domaine
        </label>
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value as DomainId)}
          data-testid="select-domain"
          className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 font-sans text-xs text-zinc-200 focus:border-cyan-500/60 focus:outline-none"
        >
          {DOMAINS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* Répartition de l'effort sur les phases */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-500">
            Dosage des phases
          </span>
          <span
            className="font-mono text-[9px] text-zinc-500"
            title="Adéquation au dosage idéal de ce type de modèle"
          >
            mix {Math.round(mixScore * 100)}%
          </span>
        </div>
        {TRAINING_PHASES.map((p) => (
          <div key={p}>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-300" title={PHASE_INFO[p].blurb}>
                {PHASE_INFO[p].name}
              </span>
              <span className="font-mono tabular-nums text-cyan-400">
                {Math.round(normalized[p] * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={effort[p]}
              onChange={(e) => setEffort((cur) => ({ ...cur, [p]: Number(e.target.value) }))}
              data-testid={`effort-${p}`}
              className="mt-0.5 h-1 w-full cursor-pointer accent-cyan-500"
            />
            <p className="text-[9px] italic leading-tight text-zinc-600">{PHASE_INFO[p].blurb}</p>
          </div>
        ))}
      </div>

      <p className="text-[10px] leading-snug text-zinc-500">
        Dataset clé : ce modèle profite du volume de{' '}
        <span className="font-semibold text-zinc-300">{keyItemDataset}</span> produit pendant le run.
      </p>

      <button
        type="button"
        onClick={() => startProject({ modelType, domain, effort: normalized })}
        data-testid="start-project"
        className="rounded border border-cyan-500/50 bg-cyan-500/10 px-3 py-2 font-mono text-[11px] font-black uppercase tracking-wider text-cyan-300 transition-colors hover:bg-cyan-500/20"
      >
        Lancer l’entraînement
      </button>
    </div>
  );
}

/** Vue d'un run en cours : progression pilotée par le compute + ship. */
function ActiveRun({ project }: { project: ActiveProject }) {
  const shipModel = useProgressionStore((s) => s.shipModel);
  const runMarketing = useProgressionStore((s) => s.runMarketing);
  const staff = useProgressionStore((s) => s.tycoon.staff);
  const bolts = useProgressionStore((s) => s.bolts);
  const progress = runProgress(project);
  const complete = isRunComplete(project);
  // Le bonus qualité du staff (chercheurs) est intégré au preview.
  const quality = computeModelQuality(project, labQualityBonus(staff));
  const def = modelTypeDef(project.modelType);
  const mktCost = marketingCost(project.hype);
  const canBuyMkt = canMarket(project) && bolts >= mktCost;

  return (
    <div className="flex flex-col gap-3" data-testid="active-run">
      <TrendBanner modelType={project.modelType} domain={project.domain} />

      <div className="rounded border border-cyan-500/25 bg-cyan-950/10 p-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-sans text-xs font-bold text-zinc-100">{def.name}</span>
          <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">
            {nameOfDomain(project.domain)}
          </span>
        </div>

        {/* Progression du run (compute) */}
        <div className="mb-1 flex items-baseline justify-between">
          <span className="font-mono text-[9px] uppercase tracking-wider text-cyan-500/80">
            Entraînement (compute)
          </span>
          <span className="font-mono text-[10px] font-bold tabular-nums text-cyan-300">
            {Math.round(progress * 100)}%
          </span>
        </div>
        <Bar value={progress} color="bg-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
        <p className="mt-1 text-[9px] font-mono text-zinc-600">
          {Math.round(project.computeInvested)} / {project.computeRequired} compute-units
        </p>
      </div>

      {/* Qualité estimée (axe séparé du score d'efficience LP) */}
      <div className="rounded border border-zinc-800 bg-zinc-950/40 p-3">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">
            Qualité estimée
          </span>
          <span className="font-mono text-[10px] font-bold tabular-nums text-amber-400">
            benchmark {Math.round(quality.quality * 100)}
          </span>
        </div>
        <Bar value={quality.quality} color="bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
        <ul className="mt-2 space-y-0.5 text-[9px] font-mono text-zinc-500">
          <li className="flex justify-between">
            <span>Dosage des phases</span>
            <span className="text-zinc-400">{Math.round(quality.phaseMixScore * 100)}%</span>
          </li>
          <li className="flex justify-between">
            <span>Volume de dataset</span>
            <span className="text-zinc-400">{Math.round(quality.datasetScore * 100)}%</span>
          </li>
          {quality.staffBonus > 0 && (
            <li className="flex justify-between text-emerald-400/80">
              <span>Bonus chercheurs</span>
              <span>+{Math.round(quality.staffBonus * 100)}%</span>
            </li>
          )}
          {quality.defectPenalty > 0 && (
            <li className="flex justify-between text-red-400/80">
              <span>Défauts (éval. faible)</span>
              <span>−{Math.round(quality.defectPenalty * 100)}%</span>
            </li>
          )}
        </ul>
      </div>

      {/* Hype / marketing pré-lancement : décision $ qui amplifie la réception au ship */}
      <div className="rounded border border-fuchsia-500/20 bg-fuchsia-950/10 p-3" data-testid="marketing">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="font-mono text-[9px] uppercase tracking-wider text-fuchsia-400/80">
            Hype (marketing)
          </span>
          <span className="font-mono text-[10px] font-bold tabular-nums text-fuchsia-300">
            ×{project.hype.toFixed(2)}
          </span>
        </div>
        <Bar
          value={(project.hype - 1) / (HYPE_MAX - 1)}
          color="bg-fuchsia-500 shadow-[0_0_8px_rgba(217,70,239,0.5)]"
        />
        <button
          type="button"
          disabled={!canBuyMkt}
          onClick={() => runMarketing()}
          data-testid="run-marketing"
          className={`mt-2 w-full rounded border px-2 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors ${
            canBuyMkt
              ? 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300 hover:bg-fuchsia-500/20'
              : 'cursor-not-allowed border-zinc-800 bg-zinc-950/40 text-zinc-600'
          }`}
        >
          {canMarket(project) ? `Campagne · ${mktCost} $` : 'Hype au maximum'}
        </button>
      </div>

      <button
        type="button"
        disabled={!complete}
        onClick={() => shipModel()}
        data-testid="ship-model"
        className={`rounded border px-3 py-2 font-mono text-[11px] font-black uppercase tracking-wider transition-colors ${
          complete
            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
            : 'cursor-not-allowed border-zinc-800 bg-zinc-950/40 text-zinc-600'
        }`}
      >
        {complete ? 'Shipper le modèle' : 'Entraînement en cours…'}
      </button>
      {!complete && (
        <p className="text-[10px] leading-snug text-zinc-600">
          Le run avance au débit de <span className="text-cyan-400">compute</span> de ton usine.
          Plus de Datacenters = entraînement plus rapide.
        </p>
      )}
    </div>
  );
}

/** Section Staff : embauche par rôle + masse salariale (tension scrappy). */
function StaffSection() {
  const staff = useProgressionStore((s) => s.tycoon.staff);
  const bolts = useProgressionStore((s) => s.bolts);
  const hireStaff = useProgressionStore((s) => s.hireStaff);
  const salary = totalSalaryPerMin(staff);

  return (
    <div className="border-t border-zinc-900 pt-3" data-testid="staff-section">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500">
          // ÉQUIPE
        </span>
        <span
          className="font-mono text-[9px] text-amber-400/80"
          title="Masse salariale débitée en continu"
        >
          {salary.toFixed(1)} $/min
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {STAFF_ROLES.map((role) => {
          const count = staff[role.id as StaffRole];
          const affordable = bolts >= role.hireCost;
          return (
            <li
              key={role.id}
              className="flex items-center justify-between gap-2 rounded border border-zinc-800 bg-zinc-950/40 p-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[11px] font-semibold text-zinc-200">{role.name}</span>
                  {count > 0 && (
                    <span className="rounded bg-cyan-500/10 px-1 font-mono text-[9px] font-bold text-cyan-300">
                      ×{count}
                    </span>
                  )}
                </div>
                <p className="text-[9px] italic leading-tight text-zinc-600" title={role.blurb}>
                  {role.blurb}
                </p>
              </div>
              <button
                type="button"
                disabled={!affordable}
                onClick={() => hireStaff(role.id as StaffRole)}
                data-testid={`hire-${role.id}`}
                className={`shrink-0 rounded border px-2 py-1 font-mono text-[9px] font-black uppercase tracking-wider transition-colors ${
                  affordable
                    ? 'border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10'
                    : 'cursor-not-allowed border-zinc-800 text-zinc-600'
                }`}
              >
                {role.hireCost} $
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Récap du dernier modèle shippé + vitrine du labo. */
function LabStats({ review }: { review: ModelReview | null }) {
  const shipped = useProgressionStore((s) => s.tycoon.shippedModels);
  const renown = useProgressionStore((s) => s.tycoon.renown);
  const best = useProgressionStore((s) => s.tycoon.bestBenchmark);
  if (shipped === 0) return null;
  return (
    <div className="mt-1 border-t border-zinc-900 pt-3" data-testid="lab-stats">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="font-mono text-sm font-bold text-zinc-200">{shipped}</div>
          <div className="text-[8px] font-mono uppercase tracking-wider text-zinc-600">Modèles</div>
        </div>
        <div>
          <div className="font-mono text-sm font-bold text-cyan-300">{renown}</div>
          <div className="text-[8px] font-mono uppercase tracking-wider text-zinc-600">Renommée</div>
        </div>
        <div>
          <div className="font-mono text-sm font-bold text-amber-400">{best}</div>
          <div className="text-[8px] font-mono uppercase tracking-wider text-zinc-600">Best bench</div>
        </div>
      </div>
      {review && (
        <p className="mt-2 text-[10px] leading-snug text-zinc-500">
          Dernier : <span className="text-zinc-300">{nameOfType(review.modelType)}</span> — benchmark{' '}
          <span className="font-mono text-amber-400">{review.benchmark}</span>, +{review.revenue} $.
        </p>
      )}
    </div>
  );
}

/**
 * TycoonPanel — « Le Bureau » : la couche méta startup IA par-dessus l'usine.
 *
 * Lance un projet de modèle (type × domaine × dosage des phases), regarde le run avancer
 * au débit de compute de l'usine, puis shippe : benchmark + réception → revenus + renommée.
 */
export function TycoonPanel() {
  const activeProject = useProgressionStore((s) => s.tycoon.activeProject);
  const lastReview = useProgressionStore((s) => s.tycoon.lastReview);

  return (
    <div className="flex flex-col gap-3" data-testid="tycoon-panel">
      <div className="border-b border-zinc-900 pb-2">
        <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500">
          // LE BUREAU
        </h3>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
          {activeProject
            ? 'Ton modèle s’entraîne. Optimise l’usine pour aller plus vite.'
            : 'Lance un projet de modèle et transforme ton compute en produit.'}
        </p>
      </div>

      {activeProject ? <ActiveRun project={activeProject} /> : <ProjectSetup />}

      <StaffSection />
      <LabStats review={lastReview} />
    </div>
  );
}
