import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Clock3,
  Instagram,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { CakeDialog } from "./components/CakeDialog";
import { GalleryDialog } from "./components/GalleryDialog";
import { Header } from "./components/Header";
import { OrderDialog } from "./components/OrderDialog";
import { ManagedSite } from "./components/ManagedSite";
import { gsap, ScrollTrigger } from "./animations/animationConfig";
import { setupHeroAnimations } from "./animations/heroAnimations";
import { setupSignatureProductAnimation } from "./animations/productAnimations";
import { setupScrollAnimations } from "./animations/scrollAnimations";
import { getResponsiveImageSrcSet } from "./utils/imageSources";
import {
  business,
  businessPlaceholders,
  cakes,
  categories,
  signatureCakes,
  galleryImages,
  type Cake,
  type GalleryImage,
  type SignatureStyle,
} from "./data/siteData";
import { getPublicWebsite, submitContactMessage } from "./services/customerApi";
import type { PublicWebsiteContent } from "./services/customerApi";

function SectionHeading({
  eyebrow,
  title,
  copy,
  light = false,
}: {
  eyebrow: string;
  title: string;
  copy?: string;
  light?: boolean;
}) {
  return (
    <div className={`section-heading${light ? " section-heading-light" : ""}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {copy && <p className="section-lede">{copy}</p>}
    </div>
  );
}

function ProductCard({
  cake,
  onDetails,
  onOrder,
}: {
  cake: Cake;
  onDetails: (cake: Cake) => void;
  onOrder: (cake: Cake) => void;
}) {
  const cardRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (!cake.signatureStyle || !cardRef.current) return;
    return setupSignatureProductAnimation(cardRef.current, cake.signatureStyle);
  }, [cake.signatureStyle]);

  return (
    <article
      className={`product-card${cake.signatureStyle ? " signature-product" : ""}`}
      data-signature-style={cake.signatureStyle}
      ref={cardRef}
    >
      <button
        className="product-image-button"
        type="button"
        onClick={() => onDetails(cake)}
        aria-label={`View details for ${cake.name}`}
      >
        <img
          src={cake.image}
          srcSet={getResponsiveImageSrcSet(cake.image)}
          sizes="(max-width: 700px) 45vw, (max-width: 1000px) 45vw, (max-width: 1400px) 30vw, 400px"
          alt={cake.alt}
          loading="lazy"
          decoding="async"
        />
        {cake.sampleImage && <span className="sample-photo-label">Sample photo</span>}
        <span className="product-open" aria-hidden="true"><ArrowUpRight size={19} /></span>
      </button>
      <div className="product-copy">
        <div>
          <p className="product-category">{cake.category}</p>
          <h3>{cake.name}</h3>
        </div>
        <button className="text-button product-order" onClick={() => onOrder(cake)}>
          Ask about this cake <ArrowRight size={15} />
        </button>
      </div>
    </article>
  );
}

function ContactSection() {
  const [messageState, setMessageState] = useState<"idle" | "sent">("idle");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; message?: string }>({});
  const requestKey = useRef<{ signature: string; key: string } | null>(null);

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name")).trim();
    const email = String(data.get("email")).trim();
    const message = String(data.get("message")).trim();
    const errors = {
      ...(!name && { name: "Enter your name." }),
      ...(!email && { email: "Enter your email address." }),
      ...(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && { email: "Enter a valid email address." }),
      ...(!message && { message: "Add a message so we know how to help." }),
    };
    setFieldErrors(errors);
    const firstInvalid = (["name", "email", "message"] as const).find((field) => errors[field]);
    if (firstInvalid) {
      document.getElementById(`contact-${firstInvalid}`)?.focus();
      return;
    }
    setBusy(true);
    setError("");
    const signature = JSON.stringify({ name, email, message });
    if (requestKey.current?.signature !== signature) {
      requestKey.current = { signature, key: crypto.randomUUID() };
    }
    try {
      await submitContactMessage({
        name,
        email,
        message,
        idempotencyKey: requestKey.current.key,
      });
      requestKey.current = null;
      setMessageState("sent");
      setFieldErrors({});
      form.reset();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The message could not be sent. Nothing has been submitted.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="contact-section section-pad" id="contact">
      <div className="content-width contact-layout">
        <div className="contact-copy">
          <p className="eyebrow">We’d love to hear from you</p>
          <h2>Let’s make something <em>beautiful.</em></h2>
          <p>Have a question or a cake idea in mind? Send us a note, and the team can help you with the next step.</p>
          <div className="contact-details">
            <div className="contact-detail">
              <Phone size={18} aria-hidden="true" />
              <div>
                <span>Call us</span>
                <p>{business.phone
                  ? <a href={`tel:${business.phone.replace(/[^\d+]/g, "")}`}>{business.phone}</a>
                  : businessPlaceholders.phone}</p>
              </div>
            </div>
            <div className="contact-detail">
              <Mail size={18} aria-hidden="true" />
              <div>
                <span>Email</span>
                <p>{business.email
                  ? <a href={`mailto:${business.email}`}>{business.email}</a>
                  : businessPlaceholders.email}</p>
              </div>
            </div>
            <div className="contact-detail">
              <MapPin size={18} aria-hidden="true" />
              <div>
                <span>Visit</span>
                <p>{business.address
                  ? <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.address)}`} target="_blank" rel="noreferrer">{business.address}</a>
                  : businessPlaceholders.address}</p>
              </div>
            </div>
            <div className="contact-detail">
              <Clock3 size={18} aria-hidden="true" />
              <div><span>Opening hours</span><p>{business.openingHours || businessPlaceholders.openingHours}</p></div>
            </div>
          </div>
          <div className="social-links" aria-label="Social profiles">
            {business.instagram ? (
              <a href={business.instagram} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18} /></a>
            ) : (
              <span className="social-placeholder"><Instagram size={18} /> Instagram profile to be added</span>
            )}
            {business.facebook && (
              <a href={business.facebook} target="_blank" rel="noreferrer" aria-label="Facebook"><span aria-hidden="true">f</span></a>
            )}
          </div>
        </div>
        <div className="contact-form-panel">
          {messageState === "sent" ? (
            <div className="contact-success" role="status">
              <span className="confirmation-mark" aria-hidden="true">✓</span>
              <h3>Your message was sent.</h3>
              <p>Thank you for getting in touch. The bakery will be in touch soon.</p>
              <button className="text-button" onClick={() => setMessageState("idle")}>Send another message <ArrowRight size={15} /></button>
            </div>
          ) : (
            <>
              <h3>Send us a message</h3>
              <p className="contact-form-intro">Tell us a little about what you’re looking for.</p>
              <form className="contact-form" onSubmit={sendMessage} noValidate>
                <label>Name <span aria-hidden="true">*</span><input id="contact-name" name="name" autoComplete="name" required aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "contact-name-error" : undefined} onChange={(event) => { if (event.target.value.trim()) setFieldErrors((current) => ({ ...current, name: undefined })); }} />{fieldErrors.name && <span className="field-error" id="contact-name-error">{fieldErrors.name}</span>}</label>
                <label>Email <span aria-hidden="true">*</span><input id="contact-email" type="email" name="email" autoComplete="email" required aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "contact-email-error" : undefined} onChange={(event) => { const value = event.target.value.trim(); if (value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) setFieldErrors((current) => ({ ...current, email: undefined })); }} />{fieldErrors.email && <span className="field-error" id="contact-email-error">{fieldErrors.email}</span>}</label>
                <label>Your message <span aria-hidden="true">*</span><textarea id="contact-message" name="message" rows={5} required aria-invalid={Boolean(fieldErrors.message)} aria-describedby={fieldErrors.message ? "contact-message-error" : undefined} onChange={(event) => { if (event.target.value.trim()) setFieldErrors((current) => ({ ...current, message: undefined })); }} />{fieldErrors.message && <span className="field-error" id="contact-message-error">{fieldErrors.message}</span>}</label>
                {error && <p className="form-alert" role="alert">{error}</p>}
                <button className="button button-dark" type="submit" disabled={busy}>
                  {busy ? "Sending…" : "Send message"} <ArrowRight size={16} />
                </button>
                <p className="form-note">Your message is only sent when our contact service is connected.</p>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

const featureBackgrounds: Record<SignatureStyle, string> = {
  "vanilla-custard": "#f0e9df",
  "chocolate-custard": "#38251f",
  mocha: "#ead9d2",
  "mille-feuille": "#faf7f2",
  "cream-puffs-strawberry-tart": "#ead9d2",
  "chocolate-tart": "#c6a36a",
};

function FeaturedCakes({ onOrder }: { onOrder: (cake?: Cake) => void }) {
  const reduceMotion = useReducedMotion();
  const [selectedId, setSelectedId] = useState(signatureCakes[0].id);
  const sectionRef = useRef<HTMLElement>(null);
  const imageFrameRef = useRef<HTMLDivElement>(null);
  const featuredCake = signatureCakes.find((cake) => cake.id === selectedId) ?? signatureCakes[0];
  const style = featuredCake.signatureStyle ?? "vanilla-custard";

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const imageFrame = imageFrameRef.current;
    if (
      !section
      || !imageFrame
      || reduceMotion
      || window.matchMedia("(max-width: 900px)").matches
    ) return;

    const context = gsap.context(() => {
      gsap.to(imageFrame, {
        yPercent: 4,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.6,
        },
      });
    }, section);
    ScrollTrigger.refresh();

    return () => context.revert();
  }, [featuredCake.id, reduceMotion]);

  return (
    <motion.section
      className="featured-section section-pad"
      data-feature-style={style}
      ref={sectionRef}
      animate={{ backgroundColor: featureBackgrounds[style] }}
      transition={{ duration: reduceMotion ? 0 : 0.55, ease: [0.22, 0.72, 0.24, 1] }}
    >
      <div className="content-width featured-layout">
        <div className="featured-image" ref={imageFrameRef}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.img
              key={featuredCake.id}
              src={featuredCake.image}
              srcSet={getResponsiveImageSrcSet(featuredCake.image)}
              sizes="(max-width: 700px) 88vw, 56vw"
              alt={featuredCake.alt}
              loading="lazy"
              decoding="async"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.04 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
              transition={{ duration: reduceMotion ? 0.16 : 0.4 }}
            />
          </AnimatePresence>
          <span className="featured-tag">Illustrative sample photo</span>
        </div>
        <div className="featured-copy scroll-reveal">
          <p className="eyebrow">Signature cake families</p>
          <h2 aria-live="polite">{featuredCake.name}</h2>
          <p>Ask the bakery for product details and availability. Photography shown here is illustrative sample imagery.</p>
          <div className="featured-picker" role="group" aria-label="Choose a signature cake family">
            {signatureCakes.map((cake) => (
              <button
                type="button"
                key={cake.id}
                aria-pressed={cake.id === featuredCake.id}
                onClick={() => setSelectedId(cake.id)}
              >
                {cake.name}
              </button>
            ))}
          </div>
          <button className="button button-dark" onClick={() => onOrder(featuredCake)}>
            Ask about this cake <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </motion.section>
  );
}

function LegacyApp() {
  const reduceMotion = useReducedMotion();
  const pageRef = useRef<HTMLDivElement>(null);
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>("All cakes");
  const [selectedCake, setSelectedCake] = useState<Cake | null>(null);
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<GalleryImage | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderCake, setOrderCake] = useState<Cake | undefined>();
  const filteredCakes = useMemo(
    () => activeCategory === "All cakes" ? cakes : cakes.filter((cake) => cake.category === activeCategory),
    [activeCategory],
  );

  useLayoutEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    const cleanUpHero = setupHeroAnimations(page);
    const cleanUpScroll = setupScrollAnimations(page);
    return () => {
      cleanUpHero();
      cleanUpScroll();
    };
  }, []);

  function openOrder(cake?: Cake) {
    setSelectedCake(null);
    setOrderCake(cake);
    setOrderOpen(true);
  }

  function closeOrder() {
    setOrderOpen(false);
    setOrderCake(undefined);
  }

  return (
    <div className="page-shell" ref={pageRef}>
      <Header onOrder={() => openOrder()} />
      <main>
        <section className="hero-section" id="home">
          <div className="hero-content">
            <p className="eyebrow hero-eyebrow"><span className="eyebrow-rule" />Seasons Cake · Delicious &amp; Fresh</p>
            <h1 aria-label="Every Celebration Deserves a Beautiful Cake.">
              <span className="hero-line" aria-hidden="true"><span>Every</span></span>
              <span className="hero-line" aria-hidden="true"><span>Celebration</span></span>
              <span className="hero-line" aria-hidden="true"><span>Deserves a</span></span>
              <span className="hero-line" aria-hidden="true"><span>Beautiful Cake.</span></span>
            </h1>
            <p className="hero-copy">From an afternoon treat to the centrepiece of a celebration, find something lovely to bring to the table.</p>
            <div className="hero-actions">
              <a className="button button-dark" href="#cakes">Explore the cake table <ArrowRight size={16} /></a>
              <button className="button button-outline" onClick={() => openOrder()}>Plan a celebration cake</button>
            </div>
            <a className="hero-scroll" href="#about"><ArrowDown size={15} /> A little about us</a>
          </div>
          <div className="hero-visual">
            <div className="hero-photo">
              <img
                src="https://images.unsplash.com/photo-1557308536-ee471ef2c390?auto=format&fit=crop&w=1400&q=90"
                srcSet={getResponsiveImageSrcSet("https://images.unsplash.com/photo-1557308536-ee471ef2c390?auto=format&fit=crop&w=1400&q=90")}
                sizes="(max-width: 700px) 100vw, 50vw"
                alt="Illustrative sample cake photo; approved Season Cake photography is not yet supplied"
                fetchPriority="high"
                decoding="async"
              />
            </div>
            <div className="hero-caption"><span>Made for moments worth keeping</span><span className="caption-line" /></div>
            <span className="hero-stamp">Sample<br />photo</span>
          </div>
        </section>

        <section className="about-section section-pad" id="about">
          <div className="content-width about-layout">
            <div className="about-image-wrap scroll-reveal">
              <div className="about-image-frame">
                <img
                  src="https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=1100&q=85"
                  srcSet={getResponsiveImageSrcSet("https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=1100&q=85")}
                  sizes="(max-width: 700px) 90vw, 46vw"
                  alt="Illustrative sample image of a cake; approved Season Cake photography is not yet supplied"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <span className="image-note">Illustrative sample image</span>
            </div>
            <div className="about-copy scroll-reveal">
              <p className="eyebrow">A sweeter kind of moment</p>
              <h2>Thoughtful cakes.<br />Made to <em>bring us together.</em></h2>
              <p>At Seasons Cake, we believe the best celebrations have something lovely at their centre. Our cakes are made with care, creativity, and an eye for the little details that make a moment feel like yours.</p>
              <p>Whether you’re planning a gathering or finding a treat for today, we’re here to help you choose something special.</p>
              <a className="text-link" href="#cakes">Find your cake <ArrowRight size={16} /></a>
            </div>
          </div>
        </section>

        <section className="cakes-section section-pad" id="cakes">
          <div className="content-width">
            <SectionHeading
              eyebrow="The cake table"
              title="Something lovely for every occasion."
              copy="Browse a few ideas, then tell us what you have in mind. We’ll confirm the details and availability with you."
            />
            <p className="sample-note">The six signature family names were provided by Season Cake. All are shown with illustrative sample photos; the remaining entries are development examples.</p>
            <div className="category-list" role="group" aria-label="Filter cakes by category">
              {categories.map((category) => (
                <button
                  type="button"
                  className={`category-button${activeCategory === category ? " is-active" : ""}`}
                  aria-pressed={activeCategory === category}
                  key={category}
                  onClick={() => setActiveCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                className="product-grid"
                key={activeCategory}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: reduceMotion ? 0 : 0.2 }}
                onAnimationComplete={() => ScrollTrigger.refresh()}
              >
                {filteredCakes.map((cake) => (
                  <ProductCard key={cake.id} cake={cake} onDetails={setSelectedCake} onOrder={openOrder} />
                ))}
              </motion.div>
            </AnimatePresence>
            <p className="menu-disclaimer">Flavours, sizes, and prices are confirmed by the bakery when you enquire.</p>
          </div>
        </section>

        <FeaturedCakes onOrder={openOrder} />

        <section className="gallery-section section-pad" id="gallery">
          <div className="content-width">
            <SectionHeading
              eyebrow="A little inspiration"
              title="Made to make you smile."
              copy="Illustrative sample product photography; these images are not presented as customer celebrations."
            />
            <div className="gallery-grid scroll-reveal">
              {galleryImages.map((item, index) => (
                <button
                  className={`gallery-image gallery-image-${index + 1}`}
                  key={item.image}
                  type="button"
                  aria-label={`Open sample photo: ${item.alt}`}
                  onClick={() => setSelectedGalleryImage(item)}
                >
                  <img
                    src={item.image}
                    srcSet={getResponsiveImageSrcSet(item.image)}
                    sizes="(max-width: 700px) 45vw, (max-width: 1000px) 45vw, 36vw"
                    alt={item.alt}
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="gallery-sample-badge">Sample image</span>
                  <span className="gallery-open" aria-hidden="true"><ArrowUpRight size={18} /></span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="trust-section section-pad">
          <div className="content-width trust-layout">
            <div className="trust-block scroll-reveal">
              <SectionHeading eyebrow="In good company" title="Made for the people around your table." copy="Company and organisation logos can be placed here once the business has approved which partnerships to display." />
              <p className="approval-note">Approved client names and logos will be added here.</p>
              <div className="client-placeholder" aria-label="Client logos will be added when approved">
                <span>Client logos</span>
                <span>to be added</span>
                <span>when approved</span>
              </div>
            </div>
            <div className="testimonial-block scroll-reveal">
              <p className="eyebrow">Kind words</p>
              <p className="testimonial-empty">No approved customer testimonials yet.</p>
              <p className="approval-note">Feedback will appear here only after customers approve it for publication.</p>
            </div>
          </div>
        </section>

        <div className="scroll-reveal">
          <ContactSection />
        </div>
        <section className="closing-cta">
          <div className="closing-cta-inner">
            <p className="eyebrow">A good thing is worth sharing</p>
            <h2>Let’s make your next moment a little sweeter.</h2>
            <button className="button button-ivory" onClick={() => openOrder()}>
              Start your order <ArrowRight size={16} />
            </button>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="content-width footer-layout">
          <a className="brand footer-brand" href="#home" style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
            <img src="/src/assets/logo.svg" alt="Seasons Cake" width="34" height="34" style={{ objectFit: "contain", flexShrink: 0 }} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span className="brand-name" style={{ fontFamily: "var(--serif)", fontSize: "19px", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--brand-spruce)", lineHeight: 1.1 }}>Seasons Cake</span>
              <span style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.08em", color: "var(--brand-terracotta)", textTransform: "uppercase" }}>Delicious &amp; Fresh</span>
            </div>
          </a>
          <p>Handcrafted artisan cakes, custom celebrations &amp; everyday treats. Delicious &amp; Fresh.</p>
          <a className="footer-top" href="#home">Back to top <ArrowUpRight size={15} /></a>
          <span className="footer-copyright">© {new Date().getFullYear()} Seasons Cake</span>
        </div>
      </footer>
      <CakeDialog
        cake={selectedCake}
        onClose={() => setSelectedCake(null)}
        onOrder={openOrder}
      />
      <GalleryDialog image={selectedGalleryImage} onClose={() => setSelectedGalleryImage(null)} />
      <OrderDialog open={orderOpen} initialCake={orderCake} onClose={closeOrder} />
    </div>
  );
}

function App() {
  const [content, setContent] = useState<PublicWebsiteContent | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setError("");
    getPublicWebsite()
      .then((result) => {
        if (active) setContent(result);
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "Website content could not be loaded.");
      });
    return () => { active = false; };
  }, []);

  if (error) {
    // Graceful offline fallback: if backend API is unreachable or restarting,
    // seamlessly present the complete built-in catalog so customers never see a crash screen
    return <LegacyApp />;
  }
  if (!content) return <main className="site-content-error" aria-live="polite">Loading Seasons Cake…</main>;
  if (content.cms_active) return <ManagedSite content={content} />;
  return <LegacyApp />;
}

export default App;
