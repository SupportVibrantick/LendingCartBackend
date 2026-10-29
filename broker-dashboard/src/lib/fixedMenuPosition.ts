export type FixedMenuPosition = {
  top: number;
  left: number;
};

/**
 * Place a fixed portal menu near a trigger without clipping the viewport.
 * Prefers below the trigger; flips above when space below is short.
 */
export function getFixedMenuPosition(
  rect: DOMRect,
  options?: {
    width?: number;
    height?: number;
    gap?: number;
    padding?: number;
  },
): FixedMenuPosition {
  const menuWidth = options?.width ?? 192;
  const menuHeight = options?.height ?? 200;
  const gap = options?.gap ?? 8;
  const padding = options?.padding ?? 8;

  const left = Math.min(
    Math.max(padding, rect.right - menuWidth),
    Math.max(padding, window.innerWidth - menuWidth - padding),
  );

  const spaceBelow = window.innerHeight - rect.bottom - padding;
  const spaceAbove = rect.top - padding;

  let top: number;
  if (spaceBelow >= menuHeight + gap) {
    top = rect.bottom + gap;
  } else if (spaceAbove >= menuHeight + gap) {
    top = rect.top - menuHeight - gap;
  } else if (spaceAbove > spaceBelow) {
    top = Math.max(padding, rect.top - menuHeight - gap);
  } else {
    top = Math.min(
      rect.bottom + gap,
      Math.max(padding, window.innerHeight - menuHeight - padding),
    );
  }

  return { top, left };
}
