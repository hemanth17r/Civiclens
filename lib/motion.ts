import { Transition, Variants } from 'framer-motion';

// ── 1. Physics Spring Presets ────────────────────────────────────────────────
// Low damping = more jelly/bounce; Higher damping = snappier, crisp settle

/** Snappy spring for interactive buttons, primary CTAs, cards */
export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 450,
  damping: 22,
  mass: 0.6,
};

/** Bouncy "jelly" spring for icons, badges, hype reactions, and FABs */
export const springJelly: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 16,
  mass: 0.7,
};

/** Smooth momentum spring for mobile bottom sheets and slide-over drawers */
export const springSheet: Transition = {
  type: 'spring',
  stiffness: 320,
  damping: 28,
  mass: 0.8,
};

/** Elegant spring for centered modal dialogs and dropdown menus */
export const springModal: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 26,
  mass: 0.8,
};

// ── 2. Tap Micro-Interaction Presets ─────────────────────────────────────────

export const tapScale = {
  /** Standard buttons & CTAs */
  button: {
    whileHover: { scale: 1.02 },
    whileTap: { scale: 0.96 },
    transition: springSnappy,
  },
  /** Micro icon triggers (Heart, Flame, Bookmark, Share, Close X) */
  icon: {
    whileHover: { scale: 1.12 },
    whileTap: { scale: 0.88 },
    transition: springJelly,
  },
  /** Floating Action Buttons (FAB) */
  fab: {
    whileHover: { scale: 1.06 },
    whileTap: { scale: 0.92 },
    transition: springJelly,
  },
  /** Interactive cards in feeds and lists */
  card: {
    whileTap: { scale: 0.985 },
    transition: springSnappy,
  },
  /** Small category pills & tags */
  pill: {
    whileHover: { scale: 1.04 },
    whileTap: { scale: 0.94 },
    transition: springSnappy,
  },
};

// ── 3. Animation Variants ────────────────────────────────────────────────────

/** Smooth backdrop overlay fade */
export const backdropVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

/** Standard center modal dialog with spring pop */
export const modalVariants: Variants = {
  initial: { opacity: 0, scale: 0.93, y: 16 },
  animate: { opacity: 1, scale: 1, y: 0, transition: springModal },
  exit: { opacity: 0, scale: 0.95, y: 16, transition: { duration: 0.15, ease: 'easeIn' } },
};

/** Dropdown menu spring pop (anchored top-right) */
export const dropdownVariants: Variants = {
  initial: { opacity: 0, scale: 0.92, y: -8, transformOrigin: 'top right' },
  animate: { opacity: 1, scale: 1, y: 0, transition: springModal },
  exit: { opacity: 0, scale: 0.94, y: -8, transition: { duration: 0.12 } },
};

/** Mobile bottom sheet slide up */
export const bottomSheetVariants: Variants = {
  initial: { y: '100%' },
  animate: { y: 0, transition: springSheet },
  exit: { y: '100%', transition: { duration: 0.2, ease: 'easeInOut' } },
};
