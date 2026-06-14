/**
 * src/ui/assets.tsx — Résolveur d'assets visuels (images webp) → chemin servable.
 *
 * Les fichiers réels dans `public/images/game/` NE suivent PAS toujours l'id kebab-case du jeu
 * (ex. l'item `iron-ore` est stocké `items/raw/ore_iron.webp`). Ce mapping explicite fait le pont
 * id → chemin : on l'étend au fur et à mesure que des assets sont ajoutés. Tant qu'un item n'a pas
 * d'image, l'UI retombe proprement sur ses icônes SVG par catégorie.
 */

/**
 * Mapping id d'item → chemin de l'image webp (servie depuis /public).
 *
 * VIDE depuis le pivot thématique « Scrappy AI Lab » (2026-06-14) : les anciennes images
 * (minerais, lingots) contredisaient le thème données/IA. Tant qu'un jeu d'icônes thématiques
 * n'existe pas, tous les items retombent proprement sur le badge monochrome (lettre), cohérent
 * avec l'esthétique console de labo. À repeupler avec les futurs assets IA.
 */
const ITEM_IMAGE: Record<string, string> = {};

/** Chemin de l'image d'un item, ou `undefined` si aucun asset n'est disponible. */
export function itemImage(itemId: string): string | undefined {
  return ITEM_IMAGE[itemId];
}

interface ItemIconProps {
  itemId: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Icône d'item basée sur son image webp. Rend `null` si l'item n'a pas (encore) d'asset —
 * l'appelant peut alors afficher un fallback (icône SVG de catégorie).
 */
export function ItemIcon({ itemId, size = 16, className, style }: ItemIconProps) {
  const src = itemImage(itemId);
  if (!src) {
    const letter = itemId.charAt(0).toUpperCase();
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
          background: 'rgba(63, 63, 70, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          fontSize: `${Math.max(size * 0.6, 8)}px`,
          fontFamily: 'monospace',
          fontWeight: 'extrabold',
          color: '#a1a1aa',
          userSelect: 'none',
          flexShrink: 0,
          ...style
        }}
        title={itemId}
      >
        {letter}
      </div>
    );
  }
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt=""
      draggable={false}
      className={className}
      style={{ objectFit: 'contain', flexShrink: 0, ...style }}
    />
  );
}
