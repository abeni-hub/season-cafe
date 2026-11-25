import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { dialogContentVariants } from "../animations/motionVariants";
import type { Cake } from "../data/siteData";
import { getResponsiveImageSrcSet } from "../utils/imageSources";

interface CakeDialogProps {
  cake: Cake | null;
  onClose: () => void;
  onOrder: (cake: Cake) => void;
}

export function CakeDialog({ cake, onClose, onOrder }: CakeDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (cake && !dialog.open) dialog.showModal();
    if (!cake && dialog.open) dialog.close();
  }, [cake]);

  return (
    <dialog
      className="cake-dialog"
      ref={dialogRef}
      aria-labelledby="cake-dialog-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      {cake && (
        <motion.div
          className="cake-dialog-content"
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
          variants={dialogContentVariants}
        >
          <button className="icon-button dialog-close" onClick={onClose} aria-label="Close cake details">
            <X size={20} />
          </button>
          <img
            src={cake.image}
            srcSet={getResponsiveImageSrcSet(cake.image)}
            sizes="(max-width: 700px) 90vw, 390px"
            alt={cake.alt}
            decoding="async"
          />
          <div className="cake-dialog-copy">
            <p className="eyebrow">{cake.category}</p>
            <h2 id="cake-dialog-title">{cake.name}</h2>
            <p>{cake.description}</p>
            <p className="price-note">
              {cake.price
                ? `Listed price: ${Number(cake.price).toLocaleString("en-ET")} ETB. The bakery will confirm availability.`
                : "Ask us about flavours, sizes, and pricing."}
            </p>
            <button className="button button-dark" onClick={() => onOrder(cake)}>
              Start an order
            </button>
          </div>
        </motion.div>
      )}
    </dialog>
  );
}
