import { useEffect, useState } from "react";
import { Check, Eye, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import { api } from "../api";

export type WebsiteSettings = {
  site_name: string;
  is_published: boolean;
  hero_eyebrow: string;
  hero_title: string;
  hero_body: string;
  hero_image: string;
  hero_image_alt: string;
  hero_cta_label: string;
  hero_cta_url: string;
  about_eyebrow: string;
  about_title: string;
  about_body: string;
  about_image: string;
  about_image_alt: string;
  menu_eyebrow: string;
  menu_title: string;
  menu_body: string;
  featured_eyebrow: string;
  featured_title: string;
  featured_body: string;
  gallery_eyebrow: string;
  gallery_title: string;
  gallery_body: string;
  trust_eyebrow: string;
  trust_title: string;
  trust_body: string;
  contact_eyebrow: string;
  contact_title: string;
  contact_body: string;
  phone: string;
  email: string;
  address: string;
  opening_hours: string;
  instagram_url: string;
  facebook_url: string;
  updated_at?: string;
};

export type WebsiteBanner = {
  id: number;
  eyebrow: string;
  title: string;
  body: string;
  image: string | null;
  image_alt: string;
  cta_label: string;
  cta_url: string;
  sort_order: number;
  is_published: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

export type WebsiteSection = {
  id: number;
  slug: string;
  kind: "content" | "promotion";
  eyebrow: string;
  title: string;
  body: string;
  image: string | null;
  image_alt: string;
  cta_label: string;
  cta_url: string;
  sort_order: number;
  is_published: boolean;
};

export type WebsiteGalleryItem = {
  id: number;
  image: string;
  alt_text: string;
  sort_order: number;
  is_published: boolean;
};

export type WebsiteTestimonial = {
  id: number;
  quote: string;
  customer_name: string;
  is_approved: boolean;
  is_published: boolean;
  sort_order: number;
};

type Preview = {
  cms_active: boolean;
  settings: WebsiteSettings | null;
  products: Array<{ id: string; name: string; category: string; price: string | null; featured: boolean }>;
  banners: Array<{ id: number; title: string }>;
  sections: Array<{ id: number; title: string }>;
};

type Props = {
  settings: WebsiteSettings | undefined;
  banners: WebsiteBanner[];
  sections: WebsiteSection[];
  gallery: WebsiteGalleryItem[];
  testimonials: WebsiteTestimonial[];
  disabled: boolean;
  onSaveSettings: (payload: FormData) => Promise<boolean>;
  onSaveBanner: (id: number | null, payload: FormData) => Promise<boolean>;
  onDeleteBanner: (id: number) => Promise<boolean>;
  onSaveSection: (id: number | null, payload: FormData) => Promise<boolean>;
  onDeleteSection: (id: number) => Promise<boolean>;
  onSaveGallery: (id: number | null, payload: FormData) => Promise<boolean>;
  onDeleteGallery: (id: number) => Promise<boolean>;
  onSaveTestimonial: (id: number | null, payload: FormData) => Promise<boolean>;
  onDeleteTestimonial: (id: number) => Promise<boolean>;
};

type Tab = "site" | "banners" | "sections" | "gallery" | "testimonials";
type ContentDraft = {
  slug: string;
  kind: "content" | "promotion";
  eyebrow: string;
  title: string;
  body: string;
  image_alt: string;
  cta_label: string;
  cta_url: string;
  sort_order: string;
  is_published: boolean;
  image: File | null;
};

const blankDraft = (): ContentDraft => ({
  slug: "",
  kind: "content",
  eyebrow: "",
  title: "",
  body: "",
  image_alt: "",
  cta_label: "",
  cta_url: "",
  sort_order: "0",
  is_published: false,
  image: null,
});

const settingsGroups: Array<{ title: string; fields: Array<{ key: keyof WebsiteSettings; label: string; multiline?: boolean }> }> = [
  {
    title: "Homepage",
    fields: [
      { key: "hero_eyebrow", label: "Small heading" },
      { key: "hero_title", label: "Main headline" },
      { key: "hero_body", label: "Introduction", multiline: true },
      { key: "hero_cta_label", label: "Button text" },
      { key: "hero_cta_url", label: "Button destination" },
      { key: "hero_image_alt", label: "Hero image description" },
    ],
  },
  {
    title: "About the bakery",
    fields: [
      { key: "about_eyebrow", label: "Small heading" },
      { key: "about_title", label: "Heading" },
      { key: "about_body", label: "About copy", multiline: true },
      { key: "about_image_alt", label: "About image description" },
    ],
  },
  {
    title: "Menu and featured cakes",
    fields: [
      { key: "menu_eyebrow", label: "Menu small heading" },
      { key: "menu_title", label: "Menu heading" },
      { key: "menu_body", label: "Menu introduction", multiline: true },
      { key: "featured_eyebrow", label: "Featured small heading" },
      { key: "featured_title", label: "Featured heading" },
      { key: "featured_body", label: "Featured introduction", multiline: true },
    ],
  },
  {
    title: "Gallery and customer stories",
    fields: [
      { key: "gallery_eyebrow", label: "Gallery small heading" },
      { key: "gallery_title", label: "Gallery heading" },
      { key: "gallery_body", label: "Gallery introduction", multiline: true },
      { key: "trust_eyebrow", label: "Customer stories small heading" },
      { key: "trust_title", label: "Customer stories heading" },
      { key: "trust_body", label: "Customer stories introduction", multiline: true },
    ],
  },
  {
    title: "Contact and business details",
    fields: [
      { key: "contact_eyebrow", label: "Contact small heading" },
      { key: "contact_title", label: "Contact heading" },
      { key: "contact_body", label: "Contact introduction", multiline: true },
      { key: "phone", label: "Business phone" },
      { key: "email", label: "Business email" },
      { key: "address", label: "Address" },
      { key: "opening_hours", label: "Opening hours" },
      { key: "instagram_url", label: "Instagram URL" },
      { key: "facebook_url", label: "Facebook URL" },
    ],
  },
];

function makeFormData(values: Record<string, string | boolean | File | null>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value instanceof File) formData.append(key, value);
    else if (value !== null) formData.append(key, String(value));
  }
  return formData;
}

export function WebsitePanel({
  settings,
  banners,
  sections,
  gallery,
  testimonials,
  disabled,
  onSaveSettings,
  onSaveBanner,
  onDeleteBanner,
  onSaveSection,
  onDeleteSection,
  onSaveGallery,
  onDeleteGallery,
  onSaveTestimonial,
  onDeleteTestimonial,
}: Props) {
  const [tab, setTab] = useState<Tab>("site");
  const [draft, setDraft] = useState<WebsiteSettings | null>(settings ?? null);
  const [heroImage, setHeroImage] = useState<File | null>(null);
  const [aboutImage, setAboutImage] = useState<File | null>(null);
  const [itemDraft, setItemDraft] = useState<ContentDraft>(blankDraft);
  const [bannerId, setBannerId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [galleryId, setGalleryId] = useState<number | null>(null);
  const [galleryFile, setGalleryFile] = useState<File | null>(null);
  const [galleryAlt, setGalleryAlt] = useState("");
  const [galleryPublished, setGalleryPublished] = useState(false);
  const [gallerySortOrder, setGallerySortOrder] = useState("0");
  const [testimonialId, setTestimonialId] = useState<number | null>(null);
  const [testimonialQuote, setTestimonialQuote] = useState("");
  const [testimonialName, setTestimonialName] = useState("");
  const [testimonialApproved, setTestimonialApproved] = useState(false);
  const [testimonialPublished, setTestimonialPublished] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState("");

  useEffect(() => {
    if (settings) setDraft(settings);
  }, [settings]);

  async function loadPreview() {
    setPreviewError("");
    try {
      setPreview(await api<Preview>("/api/website/preview/"));
    } catch (requestError) {
      setPreviewError(requestError instanceof Error ? requestError.message : "The preview could not be loaded.");
    }
  }

  async function saveSettings(publish?: boolean) {
    if (!draft) return;
    const values: Record<string, string | boolean | File | null> = {};
    for (const group of settingsGroups) {
      for (const field of group.fields) values[field.key] = String(draft[field.key] ?? "");
    }
    values.site_name = draft.site_name;
    values.is_published = publish ?? draft.is_published;
    values.hero_image = heroImage;
    values.about_image = aboutImage;
    const saved = await onSaveSettings(makeFormData(values));
    if (saved) {
      setHeroImage(null);
      setAboutImage(null);
    }
  }

  function editBanner(item: WebsiteBanner) {
    setBannerId(item.id);
    setSectionId(null);
    setItemDraft({
      slug: "",
      kind: "content",
      eyebrow: item.eyebrow,
      title: item.title,
      body: item.body,
      image_alt: item.image_alt,
      cta_label: item.cta_label,
      cta_url: item.cta_url,
      sort_order: String(item.sort_order),
      is_published: item.is_published,
      image: null,
    });
  }

  function editSection(item: WebsiteSection) {
    setSectionId(item.id);
    setBannerId(null);
    setItemDraft({
      slug: item.slug,
      kind: item.kind,
      eyebrow: item.eyebrow,
      title: item.title,
      body: item.body,
      image_alt: item.image_alt,
      cta_label: item.cta_label,
      cta_url: item.cta_url,
      sort_order: String(item.sort_order),
      is_published: item.is_published,
      image: null,
    });
  }

  async function saveBanner(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("sort_order", itemDraft.sort_order);
    formData.set("is_published", String(itemDraft.is_published));
    if (itemDraft.image) formData.set("image", itemDraft.image);
    if (await onSaveBanner(bannerId, formData)) {
      setBannerId(null);
      setItemDraft(blankDraft());
      form.reset();
    }
  }

  async function saveSection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("sort_order", itemDraft.sort_order);
    formData.set("is_published", String(itemDraft.is_published));
    formData.set("kind", itemDraft.kind);
    if (itemDraft.image) formData.set("image", itemDraft.image);
    if (await onSaveSection(sectionId, formData)) {
      setSectionId(null);
      setItemDraft(blankDraft());
      form.reset();
    }
  }

  async function saveGallery(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!galleryId && !galleryFile) return;
    const payload = makeFormData({
      image: galleryFile,
      alt_text: galleryAlt,
      sort_order: gallerySortOrder,
      is_published: galleryPublished,
    });
    if (await onSaveGallery(galleryId, payload)) {
      setGalleryId(null);
      setGalleryFile(null);
      setGalleryAlt("");
      setGalleryPublished(false);
      setGallerySortOrder("0");
    }
  }

  async function saveTestimonial(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = makeFormData({
      quote: testimonialQuote,
      customer_name: testimonialName,
      is_approved: testimonialApproved,
      is_published: testimonialPublished,
      sort_order: "0",
    });
    if (await onSaveTestimonial(testimonialId, payload)) {
      setTestimonialId(null);
      setTestimonialQuote("");
      setTestimonialName("");
      setTestimonialApproved(false);
      setTestimonialPublished(false);
    }
  }

  return (
    <div className="stacked-panels website-workspace">
      <div className="website-tabs" role="tablist" aria-label="Website content sections">
        {([
          ["site", "Site details"],
          ["banners", "Banners"],
          ["sections", "Page sections"],
          ["gallery", "Gallery"],
          ["testimonials", "Testimonials"],
        ] as Array<[Tab, string]>).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "is-selected" : ""} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === "site" && (
        <section className="panel website-settings-panel">
          <div className="panel-heading">
            <div><p className="eyebrow">Public site controls</p><h2>{draft?.is_published ? "Website is live" : "Website content is in draft"}</h2></div>
            <span className={`status-pill${draft?.is_published ? " status-ready" : ""}`}>{draft?.is_published ? "Published" : "Draft"}</span>
          </div>
          {draft && (
            <form className="portal-form" onSubmit={(event) => { event.preventDefault(); void saveSettings(); }}>
              <label>Business name<input required maxLength={120} value={draft.site_name} onChange={(event) => setDraft({ ...draft, site_name: event.target.value })} /></label>
              {settingsGroups.map((group) => (
                <fieldset className="website-fieldset" key={group.title}>
                  <legend>{group.title}</legend>
                  <div className="website-fields">
                    {group.fields.map((field) => (
                      <label key={field.key}>
                        {field.label}
                        {field.multiline ? (
                          <textarea rows={3} value={String(draft[field.key] ?? "")} onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })} />
                        ) : (
                          <input
                            type={field.key === "email" ? "email" : field.key.endsWith("_url") ? "url" : "text"}
                            maxLength={field.key === "hero_title" || field.key.endsWith("_title") ? 240 : 300}
                            value={String(draft[field.key] ?? "")}
                            onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                          />
                        )}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              <fieldset className="website-fieldset">
                <legend>Photography</legend>
                <div className="website-fields">
                  <label>Homepage image<input type="file" accept="image/*" onChange={(event) => setHeroImage(event.target.files?.[0] ?? null)} /></label>
                  <label>About image<input type="file" accept="image/*" onChange={(event) => setAboutImage(event.target.files?.[0] ?? null)} /></label>
                </div>
                {draft.hero_image && <p className="form-hint">A homepage image is already uploaded. Choose a file to replace it.</p>}
              </fieldset>
              <div className="website-action-row">
                <button className="button button-dark" disabled={disabled}><Check size={15} />Save changes</button>
                <button className="quiet-button" type="button" disabled={disabled} onClick={() => void saveSettings(true)}><Send size={14} />Publish website</button>
                {draft.is_published && <button className="quiet-button" type="button" disabled={disabled} onClick={() => void saveSettings(false)}>Unpublish</button>}
                <button className="quiet-button" type="button" onClick={loadPreview}><Eye size={14} />Preview draft</button>
              </div>
            </form>
          )}
          {previewError && <p className="inline-alert" role="alert">{previewError}</p>}
          {preview && (
            <section className="website-preview">
              <div className="panel-heading"><div><p className="eyebrow">Preview</p><h3>{preview.settings?.site_name || "Website draft"}</h3></div><button className="icon-action" type="button" aria-label="Close preview" onClick={() => setPreview(null)}><X size={15} /></button></div>
              <h2>{preview.settings?.hero_title || "Homepage headline not set"}</h2>
              <p>{preview.settings?.hero_body}</p>
              <h3>{preview.settings?.menu_title || "Menu heading not set"}</h3>
              {preview.products.length ? <ul>{preview.products.map((product) => <li key={product.id}>{product.name}{product.featured ? " · Featured" : ""}{product.price ? ` · ${product.price} ETB` : ""}</li>)}</ul> : <p>No products are currently marked for public display.</p>}
              <p>{preview.banners.length} banner(s) · {preview.sections.length} custom section(s)</p>
            </section>
          )}
        </section>
      )}

      {tab === "banners" && (
        <div className="operation-layout website-content-layout">
          <section className="panel form-panel">
            <div className="panel-heading"><div><p className="eyebrow">Homepage promotions</p><h2>{bannerId ? "Edit banner" : "Add a banner"}</h2></div></div>
            <form className="portal-form" onSubmit={saveBanner}>
              <label>Small heading<input name="eyebrow" maxLength={120} value={itemDraft.eyebrow} onChange={(event) => setItemDraft({ ...itemDraft, eyebrow: event.target.value })} /></label>
              <label>Title<input name="title" required maxLength={240} value={itemDraft.title} onChange={(event) => setItemDraft({ ...itemDraft, title: event.target.value })} /></label>
              <label>Message<textarea name="body" rows={3} value={itemDraft.body} onChange={(event) => setItemDraft({ ...itemDraft, body: event.target.value })} /></label>
              <label>Image<input type="file" accept="image/*" onChange={(event) => setItemDraft({ ...itemDraft, image: event.target.files?.[0] ?? null })} /></label>
              <label>Image description<input name="image_alt" maxLength={240} value={itemDraft.image_alt} onChange={(event) => setItemDraft({ ...itemDraft, image_alt: event.target.value })} /></label>
              <div className="form-row"><label>Button text<input name="cta_label" maxLength={80} value={itemDraft.cta_label} onChange={(event) => setItemDraft({ ...itemDraft, cta_label: event.target.value })} /></label><label>Button destination<input name="cta_url" maxLength={300} value={itemDraft.cta_url} onChange={(event) => setItemDraft({ ...itemDraft, cta_url: event.target.value })} /></label></div>
              <label>Display order<input type="number" min="0" value={itemDraft.sort_order} onChange={(event) => setItemDraft({ ...itemDraft, sort_order: event.target.value })} /></label>
              <label className="catalog-checkbox"><input type="checkbox" checked={itemDraft.is_published} onChange={(event) => setItemDraft({ ...itemDraft, is_published: event.target.checked })} />Publish this banner</label>
              <div className="catalog-form-actions"><button className="button button-dark" disabled={disabled}><Plus size={15} />{bannerId ? "Save banner" : "Add banner"}</button>{bannerId && <button type="button" className="quiet-button" onClick={() => { setBannerId(null); setItemDraft(blankDraft()); }}>Cancel</button>}</div>
            </form>
          </section>
          <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Public homepage</p><h2>Banners</h2></div><span>{banners.length}</span></div>
            {banners.length ? banners.map((item) => <article className="website-list-row" key={item.id}><div><strong>{item.title}</strong><span>{item.is_published ? "Published" : "Draft"}</span></div><button className="quiet-button" type="button" onClick={() => editBanner(item)}><Pencil size={13} />Edit</button><button className="icon-action" type="button" aria-label={`Delete ${item.title}`} disabled={disabled} onClick={() => onDeleteBanner(item.id)}><Trash2 size={15} /></button></article>) : <div className="empty-state"><h3>No banners yet</h3><p>Create a promotion or homepage notice. Drafts are not visible publicly.</p></div>}
          </section>
        </div>
      )}

      {tab === "sections" && (
        <div className="operation-layout website-content-layout">
          <section className="panel form-panel">
            <div className="panel-heading"><div><p className="eyebrow">Additional homepage content</p><h2>{sectionId ? "Edit page section" : "Add a page section"}</h2></div></div>
            <form className="portal-form" onSubmit={saveSection}>
              <label>Section ID<input name="slug" required maxLength={100} pattern="[a-zA-Z0-9_-]+" value={itemDraft.slug} onChange={(event) => setItemDraft({ ...itemDraft, slug: event.target.value })} /></label>
              <label>Layout<select value={itemDraft.kind} onChange={(event) => setItemDraft({ ...itemDraft, kind: event.target.value as ContentDraft["kind"] })}><option value="content">Content</option><option value="promotion">Promotion</option></select></label>
              <label>Small heading<input name="eyebrow" maxLength={120} value={itemDraft.eyebrow} onChange={(event) => setItemDraft({ ...itemDraft, eyebrow: event.target.value })} /></label>
              <label>Title<input name="title" required maxLength={240} value={itemDraft.title} onChange={(event) => setItemDraft({ ...itemDraft, title: event.target.value })} /></label>
              <label>Message<textarea name="body" rows={4} value={itemDraft.body} onChange={(event) => setItemDraft({ ...itemDraft, body: event.target.value })} /></label>
              <label>Image<input type="file" accept="image/*" onChange={(event) => setItemDraft({ ...itemDraft, image: event.target.files?.[0] ?? null })} /></label>
              <label>Image description<input name="image_alt" maxLength={240} value={itemDraft.image_alt} onChange={(event) => setItemDraft({ ...itemDraft, image_alt: event.target.value })} /></label>
              <div className="form-row"><label>Button text<input name="cta_label" maxLength={80} value={itemDraft.cta_label} onChange={(event) => setItemDraft({ ...itemDraft, cta_label: event.target.value })} /></label><label>Button destination<input name="cta_url" maxLength={300} value={itemDraft.cta_url} onChange={(event) => setItemDraft({ ...itemDraft, cta_url: event.target.value })} /></label></div>
              <label>Display order<input type="number" min="0" value={itemDraft.sort_order} onChange={(event) => setItemDraft({ ...itemDraft, sort_order: event.target.value })} /></label>
              <label className="catalog-checkbox"><input type="checkbox" checked={itemDraft.is_published} onChange={(event) => setItemDraft({ ...itemDraft, is_published: event.target.checked })} />Publish this section</label>
              <div className="catalog-form-actions"><button className="button button-dark" disabled={disabled}><Plus size={15} />{sectionId ? "Save section" : "Add section"}</button>{sectionId && <button type="button" className="quiet-button" onClick={() => { setSectionId(null); setItemDraft(blankDraft()); }}>Cancel</button>}</div>
            </form>
          </section>
          <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Page content</p><h2>Sections</h2></div><span>{sections.length}</span></div>
            {sections.length ? sections.map((item) => <article className="website-list-row" key={item.id}><div><strong>{item.title}</strong><span>{item.slug} · {item.is_published ? "Published" : "Draft"}</span></div><button className="quiet-button" type="button" onClick={() => editSection(item)}><Pencil size={13} />Edit</button><button className="icon-action" type="button" aria-label={`Delete ${item.title}`} disabled={disabled} onClick={() => onDeleteSection(item.id)}><Trash2 size={15} /></button></article>) : <div className="empty-state"><h3>No custom sections</h3><p>Add an editorial or promotional block to the homepage.</p></div>}
          </section>
        </div>
      )}

      {tab === "gallery" && (
        <div className="operation-layout website-content-layout">
          <section className="panel form-panel"><div className="panel-heading"><div><p className="eyebrow">Published photography</p><h2>{galleryId ? "Replace gallery image" : "Add gallery image"}</h2></div></div>
            <form className="portal-form" onSubmit={saveGallery}>
              <label>Image<input type="file" accept="image/*" required={!galleryId} onChange={(event) => setGalleryFile(event.target.files?.[0] ?? null)} /></label>
              <label>Image description<input required maxLength={240} value={galleryAlt} onChange={(event) => setGalleryAlt(event.target.value)} /></label>
              <label>Display order<input type="number" min="0" value={gallerySortOrder} onChange={(event) => setGallerySortOrder(event.target.value)} /></label>
              <label className="catalog-checkbox"><input type="checkbox" checked={galleryPublished} onChange={(event) => setGalleryPublished(event.target.checked)} />Publish on website</label>
              <div className="catalog-form-actions"><button className="button button-dark" disabled={disabled || !galleryAlt.trim()}><Plus size={15} />{galleryId ? "Save image" : "Add image"}</button>{galleryId && <button className="quiet-button" type="button" onClick={() => { setGalleryId(null); setGalleryFile(null); setGalleryAlt(""); setGalleryPublished(false); setGallerySortOrder("0"); }}>Cancel</button>}</div>
            </form>
          </section>
          <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Public gallery</p><h2>Images</h2></div><span>{gallery.length}</span></div>
            {gallery.map((item) => <article className="website-list-row" key={item.id}><div><strong>{item.alt_text}</strong><span>{item.is_published ? "Published" : "Draft"}</span></div><button className="quiet-button" type="button" onClick={() => { setGalleryId(item.id); setGalleryAlt(item.alt_text); setGalleryFile(null); setGalleryPublished(item.is_published); setGallerySortOrder(String(item.sort_order)); }}><Pencil size={13} />Edit</button><button className="icon-action" type="button" aria-label={`Delete ${item.alt_text}`} disabled={disabled} onClick={() => onDeleteGallery(item.id)}><Trash2 size={15} /></button></article>)}
          </section>
        </div>
      )}

      {tab === "testimonials" && (
        <div className="operation-layout website-content-layout">
          <section className="panel form-panel"><div className="panel-heading"><div><p className="eyebrow">Customer feedback</p><h2>{testimonialId ? "Edit testimonial" : "Add testimonial"}</h2></div></div>
            <form className="portal-form" onSubmit={saveTestimonial}>
              <label>Customer name<input required maxLength={120} value={testimonialName} onChange={(event) => setTestimonialName(event.target.value)} /></label>
              <label>Approved quote<textarea required rows={4} value={testimonialQuote} onChange={(event) => setTestimonialQuote(event.target.value)} /></label>
              <label className="catalog-checkbox"><input type="checkbox" checked={testimonialApproved} onChange={(event) => setTestimonialApproved(event.target.checked)} />Customer approved publication</label>
              <label className="catalog-checkbox"><input type="checkbox" checked={testimonialPublished} onChange={(event) => setTestimonialPublished(event.target.checked)} />Publish on website</label>
              <div className="catalog-form-actions"><button className="button button-dark" disabled={disabled}><Plus size={15} />Save testimonial</button>{testimonialId && <button className="quiet-button" type="button" onClick={() => { setTestimonialId(null); setTestimonialName(""); setTestimonialQuote(""); setTestimonialApproved(false); setTestimonialPublished(false); }}>Cancel</button>}</div>
            </form>
          </section>
          <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Permission-based stories</p><h2>Testimonials</h2></div><span>{testimonials.length}</span></div>
            {testimonials.map((item) => <article className="website-list-row" key={item.id}><div><strong>{item.customer_name}</strong><span>{item.is_approved ? "Approved" : "Needs approval"} · {item.is_published ? "Published" : "Draft"}</span></div><button className="quiet-button" type="button" onClick={() => { setTestimonialId(item.id); setTestimonialName(item.customer_name); setTestimonialQuote(item.quote); setTestimonialApproved(item.is_approved); setTestimonialPublished(item.is_published); }}><Pencil size={13} />Edit</button><button className="icon-action" type="button" aria-label={`Delete testimonial from ${item.customer_name}`} disabled={disabled} onClick={() => onDeleteTestimonial(item.id)}><Trash2 size={15} /></button></article>)}
          </section>
        </div>
      )}
    </div>
  );
}
