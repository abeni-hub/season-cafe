import { useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Clock3, Mail, MapPin, Phone } from "lucide-react";
import { CakeDialog } from "./CakeDialog";
import { GalleryDialog } from "./GalleryDialog";
import { Header } from "./Header";
import { OrderDialog } from "./OrderDialog";
import type { Cake, GalleryImage } from "../data/siteData";
import type { PublicWebsiteContent } from "../services/customerApi";
import { submitContactMessage } from "../services/customerApi";
import { getResponsiveImageSrcSet } from "../utils/imageSources";

function SectionHeading({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy?: string;
}) {
  return (
    <div className="section-heading">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2>{title}</h2>
      {copy && <p className="section-lede">{copy}</p>}
    </div>
  );
}

function ManagedProductCard({
  cake,
  onDetails,
  onOrder,
}: {
  cake: Cake;
  onDetails: (cake: Cake) => void;
  onOrder: (cake: Cake) => void;
}) {
  return (
    <article className="product-card">
      <button
        className="product-image-button"
        type="button"
        onClick={() => onDetails(cake)}
        aria-label={`View details for ${cake.name}`}
      >
        {cake.image ? (
          <img
            src={cake.image}
            srcSet={getResponsiveImageSrcSet(cake.image)}
            sizes="(max-width: 700px) 45vw, (max-width: 1000px) 45vw, 30vw"
            alt={cake.alt}
            loading="lazy"
            decoding="async"
          />
        ) : <span className="managed-product-image-empty">{cake.name}</span>}
        <span className="product-open" aria-hidden="true"><ArrowUpRight size={19} /></span>
      </button>
      <div className="product-copy">
        <div>
          <p className="product-category">{cake.category}</p>
          <h3>{cake.name}</h3>
          {cake.price && <p className="managed-product-price">{Number(cake.price).toLocaleString("en-ET")} ETB</p>}
        </div>
        <button className="text-button product-order" onClick={() => onOrder(cake)}>
          Ask about this cake <ArrowRight size={15} />
        </button>
      </div>
    </article>
  );
}

function ContactForm() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestKey = useRef<{ signature: string; key: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();
    const subject = String(data.get("subject") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();
    if (!name || !email || !message) {
      setError("Enter your name, email address, and message.");
      return;
    }

    setBusy(true);
    setError("");
    const signature = JSON.stringify({ name, email, phone, subject, message });
    if (requestKey.current?.signature !== signature) {
      requestKey.current = { signature, key: crypto.randomUUID() };
    }
    try {
      await submitContactMessage({
        name,
        email,
        ...(phone ? { phone } : {}),
        ...(subject ? { subject } : {}),
        message,
        idempotencyKey: requestKey.current.key,
      });
      requestKey.current = null;
      setSent(true);
      form.reset();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The inquiry could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  return sent ? (
    <div className="contact-success" role="status">
      <h3>Your message was sent.</h3>
      <p>The team will follow up using the contact details you provided.</p>
      <button className="text-button" type="button" onClick={() => setSent(false)}>Send another message</button>
    </div>
  ) : (
    <form className="contact-form" onSubmit={submit}>
      <label>Name <span aria-hidden="true">*</span><input name="name" autoComplete="name" required maxLength={160} /></label>
      <label>Email <span aria-hidden="true">*</span><input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
      <label>Phone <span className="optional">(optional)</span><input name="phone" type="tel" autoComplete="tel" maxLength={40} /></label>
      <label>Subject <span className="optional">(optional)</span><input name="subject" maxLength={200} /></label>
      <label>Your message <span aria-hidden="true">*</span><textarea name="message" rows={5} required maxLength={5000} /></label>
      {error && <p className="form-alert" role="alert">{error}</p>}
      <button className="button button-dark" type="submit" disabled={busy}>
        {busy ? "Sending…" : "Send message"} <ArrowRight size={16} />
      </button>
    </form>
  );
}

function ContactDetails({ content }: { content: PublicWebsiteContent }) {
  const settings = content.settings!;
  const details = [
    { label: "Call", value: settings.phone, icon: Phone, href: settings.phone ? `tel:${settings.phone.replace(/[^\d+]/g, "")}` : "" },
    { label: "Email", value: settings.email, icon: Mail, href: settings.email ? `mailto:${settings.email}` : "" },
    { label: "Visit", value: settings.address, icon: MapPin, href: settings.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}` : "" },
    { label: "Opening hours", value: settings.opening_hours, icon: Clock3, href: "" },
  ].filter((detail) => detail.value);

  return (
    <div className="contact-details">
      {details.map(({ label, value, icon: Icon, href }) => (
        <div className="contact-detail" key={label}>
          <Icon size={18} aria-hidden="true" />
          <div>
            <span>{label}</span>
            <p>{href ? <a href={href}>{value}</a> : value}</p>
          </div>
        </div>
      ))}
      {(settings.instagram_url || settings.facebook_url) && (
        <div className="social-links" aria-label="Social profiles">
          {settings.instagram_url && <a href={settings.instagram_url} target="_blank" rel="noreferrer">Instagram</a>}
          {settings.facebook_url && <a href={settings.facebook_url} target="_blank" rel="noreferrer">Facebook</a>}
        </div>
      )}
    </div>
  );
}

export function ManagedSite({ content }: { content: PublicWebsiteContent }) {
  const settings = content.settings;
  const [category, setCategory] = useState("All cakes");
  const [selectedCake, setSelectedCake] = useState<Cake | null>(null);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderCake, setOrderCake] = useState<Cake>();
  const cakes = useMemo(
    () => (content.products ?? []).map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      category: product.category || "Cakes",
      image: product.image,
      alt: product.image_alt || (product.image ? product.name : ""),
      featured: product.featured,
      price: product.price,
    })),
    [content.products],
  );
  const categories = ["All cakes", ...new Set(cakes.map((cake) => cake.category))];
  const visibleCakes = category === "All cakes" ? cakes : cakes.filter((cake) => cake.category === category);
  if (!settings) return <main className="site-content-error" role="alert">The published website content is incomplete.</main>;

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
    <div className="page-shell">
      <Header onOrder={() => openOrder()} showOrder={cakes.length > 0} />
      <main>
        {(content.banners ?? []).length > 0 && (
          <section className="managed-banners" aria-label="Current promotions">
            {(content.banners ?? []).map((banner) => (
              <article className="managed-banner" key={banner.id}>
                {banner.image && <img src={banner.image} alt={banner.image_alt || ""} />}
                <div>
                  {banner.eyebrow && <p className="eyebrow">{banner.eyebrow}</p>}
                  <h2>{banner.title}</h2>
                  {banner.body && <p>{banner.body}</p>}
                  {banner.cta_label && banner.cta_url && <a className="text-link" href={banner.cta_url}>{banner.cta_label} <ArrowRight size={15} /></a>}
                </div>
              </article>
            ))}
          </section>
        )}

        <section className="hero-section" id="home">
          <div className="hero-content">
            <p className="eyebrow hero-eyebrow"><span className="eyebrow-rule" />{settings.hero_eyebrow || settings.site_name}</p>
            <h1>{settings.hero_title}</h1>
            {settings.hero_body && <p className="hero-copy">{settings.hero_body}</p>}
            <div className="hero-actions">
              <a className="button button-dark" href={settings.hero_cta_url || "#cakes"}>{settings.hero_cta_label || "Explore the menu"} <ArrowRight size={16} /></a>
              {cakes.length > 0 && <button className="button button-outline" onClick={() => openOrder()} type="button">Start an order</button>}
            </div>
            <a className="hero-scroll" href="#about"><ArrowRight size={15} /> About us</a>
          </div>
          <div className="hero-visual">
            {settings.hero_image && (
              <div className="hero-photo">
                <img
                  src={settings.hero_image}
                  alt={settings.hero_image_alt || settings.site_name}
                  fetchPriority="high"
                  decoding="async"
                />
              </div>
            )}
          </div>
        </section>

        {(settings.about_title || settings.about_body || settings.about_image) && (
          <section className="about-section section-pad" id="about">
            <div className="content-width about-layout">
              {settings.about_image && (
                <div className="about-image-wrap">
                  <div className="about-image-frame"><img src={settings.about_image} alt={settings.about_image_alt || settings.site_name} loading="lazy" /></div>
                </div>
              )}
              <div className="about-copy">
                {settings.about_eyebrow && <p className="eyebrow">{settings.about_eyebrow}</p>}
                {settings.about_title && <h2>{settings.about_title}</h2>}
                {settings.about_body && <p className="managed-content-copy">{settings.about_body}</p>}
              </div>
            </div>
          </section>
        )}

        <section className="cakes-section section-pad" id="cakes">
          <div className="content-width">
            <SectionHeading eyebrow={settings.menu_eyebrow} title={settings.menu_title} copy={settings.menu_body} />
            {categories.length > 1 && (
              <div className="category-list" role="group" aria-label="Filter cakes by category">
                {categories.map((item) => (
                  <button
                    type="button"
                    className={`category-button${category === item ? " is-active" : ""}`}
                    aria-pressed={category === item}
                    key={item}
                    onClick={() => setCategory(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
            {visibleCakes.length ? (
              <div className="product-grid">
                {visibleCakes.map((cake) => (
                  <ManagedProductCard key={cake.id} cake={cake} onDetails={setSelectedCake} onOrder={openOrder} />
                ))}
              </div>
            ) : <p className="managed-empty">The menu is being prepared. Please check back soon.</p>}
          </div>
        </section>

        {(content.products ?? []).some((product) => product.featured) && (
          <section className="featured-section section-pad managed-featured">
            <div className="content-width">
              <SectionHeading eyebrow={settings.featured_eyebrow} title={settings.featured_title} copy={settings.featured_body} />
              <div className="product-grid">
                {cakes.filter((cake) => cake.featured).map((cake) => (
                  <ManagedProductCard key={cake.id} cake={cake} onDetails={setSelectedCake} onOrder={openOrder} />
                ))}
              </div>
            </div>
          </section>
        )}

        {(content.sections ?? []).map((section) => (
          <section className={`managed-content-section section-pad managed-section-${section.kind}`} id={`section-${section.slug}`} key={section.id}>
            <div className="content-width managed-section-layout">
              {section.image && <img src={section.image} alt={section.image_alt || section.title} loading="lazy" />}
              <div>
                {section.eyebrow && <p className="eyebrow">{section.eyebrow}</p>}
                <h2>{section.title}</h2>
                {section.body && <p className="managed-content-copy">{section.body}</p>}
                {section.cta_label && section.cta_url && <a className="text-link" href={section.cta_url}>{section.cta_label} <ArrowRight size={15} /></a>}
              </div>
            </div>
          </section>
        ))}

        {(content.gallery ?? []).length > 0 && (
          <section className="gallery-section section-pad" id="gallery">
            <div className="content-width">
              <SectionHeading eyebrow={settings.gallery_eyebrow} title={settings.gallery_title} copy={settings.gallery_body} />
              <div className="gallery-grid managed-gallery">
                {(content.gallery ?? []).map((item, index) => (
                  <button
                    className={`gallery-image gallery-image-${(index % 5) + 1}`}
                    key={item.id}
                    type="button"
                    aria-label={`Open photo: ${item.alt_text}`}
                    onClick={() => setSelectedImage({ image: item.image, alt: item.alt_text })}
                  >
                    <img src={item.image} alt={item.alt_text} loading="lazy" decoding="async" />
                    <span className="gallery-open" aria-hidden="true"><ArrowUpRight size={18} /></span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {(content.testimonials ?? []).length > 0 && (
          <section className="trust-section section-pad">
            <div className="content-width">
              <SectionHeading eyebrow={settings.trust_eyebrow} title={settings.trust_title} copy={settings.trust_body} />
              <div className="managed-testimonials">
                {(content.testimonials ?? []).map((item) => (
                  <figure key={item.id}><blockquote>{item.quote}</blockquote><figcaption>{item.customer_name}</figcaption></figure>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="contact-section section-pad" id="contact">
          <div className="content-width contact-layout">
            <div className="contact-copy">
              {settings.contact_eyebrow && <p className="eyebrow">{settings.contact_eyebrow}</p>}
              <h2>{settings.contact_title || "Contact the bakery"}</h2>
              {settings.contact_body && <p>{settings.contact_body}</p>}
              <ContactDetails content={content} />
            </div>
            <div className="contact-form-panel">
              <h3>Send us a message</h3>
              <p className="contact-form-intro">Your message will be added to the bakery’s inquiry list.</p>
              <ContactForm />
            </div>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="content-width footer-layout">
          <a className="brand footer-brand" href="#home">
            <span className="brand-mark" aria-hidden="true">{settings.site_name.slice(0, 1)}</span>
            <span className="brand-name">{settings.site_name}</span>
          </a>
          <p>{settings.site_name}</p>
          <a className="footer-top" href="#home">Back to top <ArrowUpRight size={15} /></a>
          <span className="footer-copyright">© {new Date().getFullYear()} {settings.site_name}</span>
        </div>
      </footer>
      <CakeDialog cake={selectedCake} onClose={() => setSelectedCake(null)} onOrder={openOrder} />
      <GalleryDialog image={selectedImage} caption="From the Season Cake gallery." onClose={() => setSelectedImage(null)} />
      <OrderDialog open={orderOpen} initialCake={orderCake} availableCakes={cakes} onClose={closeOrder} />
    </div>
  );
}
