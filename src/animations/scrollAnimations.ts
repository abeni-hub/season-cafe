import { animationEase, gsap, prefersReducedMotion } from "./animationConfig";

export function setupScrollAnimations(root: HTMLElement): () => void {
  if (prefersReducedMotion()) return () => {};

  const context = gsap.context(() => {
    gsap.utils.toArray<HTMLElement>(".scroll-reveal").forEach((element) => {
      const timeline = gsap.timeline({
        defaults: { ease: animationEase },
        scrollTrigger: {
          trigger: element,
          start: "top 88%",
          once: true,
        },
      });

      timeline.fromTo(element, { y: 26, autoAlpha: 0 }, {
        y: 0,
        autoAlpha: 1,
        duration: 0.7,
      });

      if (element.classList.contains("about-image-wrap")) {
        const frame = element.querySelector<HTMLElement>(".about-image-frame");
        const image = element.querySelector<HTMLImageElement>("img");
        if (frame) {
          timeline.fromTo(frame, { clipPath: "inset(8% 8% 0 0)" }, {
            clipPath: "inset(0 0 0 0)",
            duration: 0.8,
          }, "<");
        }
        if (image && !window.matchMedia("(max-width: 900px)").matches) {
          gsap.to(image, {
            yPercent: -5,
            ease: "none",
            scrollTrigger: {
              trigger: element,
              start: "top bottom",
              end: "bottom top",
              scrub: 0.6,
            },
          });
        }
      }

      if (element.classList.contains("about-copy")) {
        timeline.fromTo(element.children, { y: 12, autoAlpha: 0 }, {
          y: 0,
          autoAlpha: 1,
          duration: 0.48,
          stagger: 0.09,
        }, "<0.12");
      }

      if (element.classList.contains("gallery-grid")) {
        timeline.fromTo(element.children, { clipPath: "inset(8% 5% 0 0)" }, {
          clipPath: "inset(0 0 0 0)",
          duration: 0.68,
          stagger: 0.1,
        }, "<0.08");
      }
    });
  }, root);

  return () => context.revert();
}
