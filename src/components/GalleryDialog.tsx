import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { dialogContentVariants } from "../animations/motionVariants";
import type { GalleryImage } from "../data/siteData";
import { getResponsiveImageSrcSet } from "../utils/imageSources";

interface GalleryDialogProps {
  image: GalleryImage | null;
  caption?: string;
  onClose: () => void;
}

export function GalleryDialog({ image, caption = "Illustrative sample image. Product photography is not yet supplied.", onClose }: GalleryDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (image && !dialog.open) dialog.showModal();
    if (!image && dialog.open) dialog.close();
  }, [image]);

  return (
    <dialog
      className="gallery-dialog"
      ref={dialogRef}
      aria-label="Cake photograph"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      {image && (
        <motion.div
          className="gallery-lightbox-content"
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
          variants={dialogContentVariants}
        >
          <button className="icon-button dialog-close" onClick={onClose} aria-label="Close photo">
            <X size={20} />
          </button>
          <img
            src={image.image}
            srcSet={getResponsiveImageSrcSet(image.image)}
            sizes="(max-width: 700px) 90vw, 780px"
            alt={image.alt}
            decoding="async"
          />
          <p>{caption}</p>
        </motion.div>
      )}
    </dialog>
  );
}
