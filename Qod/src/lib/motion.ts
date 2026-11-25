import type { Variants } from 'motion/react';

export const EDITORIAL_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const SPRING_GENTLE = {
  type: 'spring' as const,
  stiffness: 260,
  damping: 28,
  mass: 0.9,
};

export const SPRING_SNAPPY = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 32,
};

export const fadeInVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.16, ease: 'easeIn' } },
};

export const modalPanelVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.24, ease: EDITORIAL_EASE },
  },
  exit: {
    opacity: 0,
    y: 10,
    scale: 0.985,
    transition: { duration: 0.16, ease: 'easeIn' },
  },
};

export const mobileDrawerVariants: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.24, ease: EDITORIAL_EASE, when: 'beforeChildren', staggerChildren: 0.035 },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: 0.16, ease: 'easeIn' },
  },
};

export const drawerLinkVariants: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.2, ease: EDITORIAL_EASE } },
  exit: { opacity: 0, x: -4, transition: { duration: 0.12 } },
};

export const toastVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.24, ease: EDITORIAL_EASE },
  },
  exit: {
    opacity: 0,
    y: 8,
    scale: 0.96,
    transition: { duration: 0.18, ease: 'easeIn' },
  },
};

export const formFeedbackVariants: Variants = {
  hidden: { opacity: 0, y: -4, height: 0 },
  visible: {
    opacity: 1,
    y: 0,
    height: 'auto',
    transition: { duration: 0.22, ease: EDITORIAL_EASE },
  },
  exit: {
    opacity: 0,
    y: -4,
    height: 0,
    transition: { duration: 0.15, ease: 'easeIn' },
  },
};

export const hoverLiftProps = {
  whileHover: { y: -4 },
  whileTap: { scale: 0.99 },
  transition: SPRING_GENTLE,
};

export const ctaTapProps = {
  whileHover: { y: -1 },
  whileTap: { scale: 0.98 },
  transition: SPRING_SNAPPY,
};
