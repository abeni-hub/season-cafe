import type { Variants } from "framer-motion";

export const dialogContentVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.22, 0.72, 0.24, 1] },
  },
};
