import { animationEase, gsap, prefersReducedMotion } from "./animationConfig";
import type { SignatureStyle } from "../data/siteData";

export function setupSignatureProductAnimation(
  card: HTMLElement,
  style: SignatureStyle,
): () => void {
  if (prefersReducedMotion()) return () => {};

  const imageFrame = card.querySelector<HTMLElement>(".product-image-button");
  const copy = card.querySelector<HTMLElement>(".product-copy");
  if (!imageFrame || !copy) return () => {};

  let entranceComplete = false;
  let pointerMove: ((event: PointerEvent) => void) | undefined;
  let pointerLeave: (() => void) | undefined;
  const context = gsap.context(() => {
    const timeline = gsap.timeline({
      defaults: { ease: animationEase },
      scrollTrigger: { trigger: card, start: "top 88%", once: true },
      onComplete: () => { entranceComplete = true; },
    });

    switch (style) {
      case "vanilla-custard": {
        const float = gsap.to(imageFrame, {
          y: -4,
          duration: 3.2,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          paused: true,
        });
        timeline
          .fromTo(card, { autoAlpha: 0, y: 22, scale: 0.96 }, {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.68,
          })
          .fromTo(imageFrame, { clipPath: "inset(7% 0 0)" }, {
            clipPath: "inset(0 0 0)",
            duration: 0.68,
          }, "<")
          .add(() => float.play(), ">");
        break;
      }
      case "chocolate-custard":
        timeline
          .fromTo(card, { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.7 })
          .fromTo(imageFrame, { scale: 0.94 }, { scale: 1, duration: 0.82 }, "<")
          .fromTo(copy, { backgroundColor: "#766b64" }, {
            backgroundColor: "#38251f",
            duration: 0.68,
          }, "<0.08");
        if (!window.matchMedia("(max-width: 900px)").matches) {
          gsap.to(imageFrame, {
            yPercent: 2,
            ease: "none",
            scrollTrigger: {
              trigger: card,
              start: "top bottom",
              end: "bottom top",
              scrub: 0.5,
            },
          });
        }
        break;
      case "mocha":
        timeline.fromTo(card, { autoAlpha: 0, y: 28, rotation: -1.4 }, {
          autoAlpha: 1,
          y: 0,
          rotation: 0,
          duration: 0.72,
        });
        break;
      case "mille-feuille":
        timeline
          .fromTo(card, { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.58 })
          .fromTo(imageFrame, { clipPath: "inset(14% 0 0)" }, {
            clipPath: "inset(0 0 0)",
            duration: 0.78,
          }, "<0.06")
          .fromTo(copy.children, { y: 9, autoAlpha: 0 }, {
            y: 0,
            autoAlpha: 1,
            duration: 0.42,
            stagger: 0.1,
          }, "<0.2");
        break;
      case "cream-puffs-strawberry-tart": {
        const float = gsap.to(imageFrame, {
          y: -3,
          duration: 3.6,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          paused: true,
        });
        timeline
          .fromTo(card, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.62 })
          .fromTo(imageFrame, { scale: 0.95 }, { scale: 1, duration: 0.72 }, "<")
          .fromTo(copy.children, { y: 8, autoAlpha: 0 }, {
            y: 0,
            autoAlpha: 1,
            duration: 0.4,
            stagger: 0.09,
          }, "<0.12")
          .add(() => float.play(), ">");
        break;
      }
      case "chocolate-tart": {
        timeline
          .fromTo(card, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.38 })
          .fromTo(imageFrame, { clipPath: "circle(0% at 50% 50%)" }, {
            clipPath: "circle(74% at 50% 50%)",
            duration: 0.92,
            ease: "power2.out",
          }, "<0.08")
          .fromTo(copy, { y: 10, autoAlpha: 0 }, {
            y: 0,
            autoAlpha: 1,
            duration: 0.42,
          }, "<0.26");

        const moveX = gsap.quickTo(imageFrame, "x", { duration: 0.55, ease: "power2.out" });
        const moveY = gsap.quickTo(imageFrame, "y", { duration: 0.55, ease: "power2.out" });
          pointerMove = (event) => {
          if (!entranceComplete) return;
          const bounds = card.getBoundingClientRect();
          moveX(((event.clientX - bounds.left) / bounds.width - 0.5) * 7);
          moveY(((event.clientY - bounds.top) / bounds.height - 0.5) * 5);
          };
          pointerLeave = () => {
          moveX(0);
          moveY(0);
          };
        break;
      }
    }
  }, card);

  if (style === "chocolate-tart" && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    if (pointerMove) card.addEventListener("pointermove", pointerMove);
    if (pointerLeave) card.addEventListener("pointerleave", pointerLeave);
  }

  return () => {
    if (pointerMove) card.removeEventListener("pointermove", pointerMove);
    if (pointerLeave) card.removeEventListener("pointerleave", pointerLeave);
    context.revert();
  };
}
