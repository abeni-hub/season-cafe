import { animationEase, gsap, prefersReducedMotion } from "./animationConfig";

export function setupHeroAnimations(root: HTMLElement): () => void {
  if (prefersReducedMotion()) return () => {};

  const hero = root.querySelector<HTMLElement>(".hero-section");
  const navigation = root.querySelector<HTMLElement>(".site-header");
  const visual = root.querySelector<HTMLElement>(".hero-visual");
  const photo = root.querySelector<HTMLElement>(".hero-photo");
  const image = root.querySelector<HTMLImageElement>(".hero-photo img");
  const content = root.querySelector<HTMLElement>(".hero-content");
  const stamp = root.querySelector<HTMLElement>(".hero-stamp");

  if (!hero || !navigation || !visual || !photo || !image || !content) {
    return () => {};
  }

  let entranceComplete = false;
  let pointerMove: ((event: PointerEvent) => void) | undefined;
  let pointerLeave: (() => void) | undefined;

  const context = gsap.context(() => {
    const timeline = gsap.timeline({
      defaults: { ease: animationEase },
      onComplete: () => { entranceComplete = true; },
    });

    timeline
      .fromTo(hero, { backgroundColor: "#ffffff" }, { backgroundColor: "#faf7f2", duration: 0.65 })
      .fromTo(navigation, { y: -12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.55 }, 0.08)
      .fromTo(".hero-eyebrow", { y: 12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.48 }, 0.2)
      .fromTo(".hero-line > span", { yPercent: 110 }, {
        yPercent: 0,
        duration: 0.78,
        stagger: 0.12,
      }, 0.28)
      .fromTo(".hero-copy", { y: 15, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.55 }, 0.76)
      .fromTo(".hero-actions", { y: 12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.48 }, 0.9)
      .fromTo(visual, { x: 54, y: 18, scale: 0.96, autoAlpha: 0 }, {
        x: 0,
        y: 0,
        scale: 1,
        autoAlpha: 1,
        duration: 0.9,
      }, 0.28)
      .fromTo(".hero-caption, .hero-stamp", { y: 12, autoAlpha: 0 }, {
        y: 0,
        autoAlpha: 1,
        duration: 0.48,
        stagger: 0.1,
      }, 0.88)
      .fromTo(".hero-scroll", { y: 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.42 }, 1.08);

    const float = gsap.to(photo, {
      y: -6,
      duration: 3.2,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
      paused: true,
    });
    timeline.add(() => float.play(), ">");

    const moveX = gsap.quickTo(visual, "x", { duration: 0.65, ease: "power2.out" });
    const moveY = gsap.quickTo(visual, "y", { duration: 0.65, ease: "power2.out" });
    const moveStampX = stamp
      ? gsap.quickTo(stamp, "x", { duration: 0.75, ease: "power2.out" })
      : undefined;
    const moveStampY = stamp
      ? gsap.quickTo(stamp, "y", { duration: 0.75, ease: "power2.out" })
      : undefined;
    pointerMove = (event) => {
      if (!entranceComplete) return;
      const bounds = hero.getBoundingClientRect();
      const pointerX = (event.clientX - bounds.left) / bounds.width - 0.5;
      const pointerY = (event.clientY - bounds.top) / bounds.height - 0.5;
      moveX(pointerX * 8);
      moveY(pointerY * 6);
      moveStampX?.(pointerX * -4);
      moveStampY?.(pointerY * -3);
    };
    pointerLeave = () => {
      moveX(0);
      moveY(0);
      moveStampX?.(0);
      moveStampY?.(0);
    };

    if (!window.matchMedia("(max-width: 900px)").matches) {
      gsap.to(image, {
        scale: 1.07,
        yPercent: 3,
        ease: "none",
        scrollTrigger: {
          trigger: hero,
          start: "top top",
          end: "bottom top",
          scrub: 0.8,
        },
      });
      gsap.to(content, {
        y: -16,
        autoAlpha: 0.72,
        ease: "none",
        scrollTrigger: {
          trigger: hero,
          start: "top top",
          end: "bottom top",
          scrub: 0.8,
        },
      });
    }
  }, root);

  if (
    window.matchMedia("(hover: hover) and (pointer: fine)").matches
    && pointerMove
    && pointerLeave
  ) {
    hero.addEventListener("pointermove", pointerMove);
    hero.addEventListener("pointerleave", pointerLeave);
  }

  return () => {
    if (pointerMove) hero.removeEventListener("pointermove", pointerMove);
    if (pointerLeave) hero.removeEventListener("pointerleave", pointerLeave);
    context.revert();
  };
}
