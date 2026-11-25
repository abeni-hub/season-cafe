import { useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";

export type CatalogProduct = {
  id: number;
  name: string;
  description: string;
  image: string | null;
  image_alt: string;
  category: number | null;
  category_name: string;
  web_id: string | null;
  selling_unit: string;
  sku: string | null;
  unit_price: string | null;
  is_active: boolean;
  is_published: boolean;
  is_featured: boolean;
  public_sort_order: number;
};

export type CatalogCategory = {
  id: number;
  kind: "product" | "ingredient";
  name: string;
  sort_order: number;
  is_active: boolean;
  is_published: boolean;
};

export type CatalogIngredient = {
  id: number;
  name: string;
  unit: "kg" | "g" | "l" | "ml" | "piece";
  category: number | null;
  category_name: string;
  supplier_names: string[];
  reorder_level: string;
  is_active: boolean;
};

type ProductInput = {
  name: string;
  description: string;
  image_alt: string;
  image_file: File | null;
  category: string;
  web_id: string;
  selling_unit: string;
  unit_price: string | null;
  is_active: boolean;
  is_published: boolean;
  is_featured: boolean;
  public_sort_order: string;
};
type IngredientInput = Pick<CatalogIngredient, "name" | "unit" | "reorder_level" | "is_active">;
type CategoryInput = Pick<CatalogCategory, "kind" | "name" | "sort_order" | "is_active" | "is_published">;
type Props = {
  products: CatalogProduct[];
  ingredients: CatalogIngredient[];
  categories: CatalogCategory[];
  disabled: boolean;
  canManageWebsite: boolean;
  onSaveProduct: (id: number | null, input: FormData) => Promise<boolean>;
  onDeleteProduct: (id: number) => Promise<boolean>;
  onSaveIngredient: (id: number | null, input: IngredientInput) => Promise<boolean>;
  onSaveCategory: (id: number | null, input: CategoryInput) => Promise<boolean>;
  onDeleteCategory: (id: number) => Promise<boolean>;
};

const emptyProduct = (): ProductInput => ({
  name: "",
  description: "",
  image_alt: "",
  image_file: null,
  category: "",
  web_id: "",
  selling_unit: "cake",
  unit_price: null,
  is_active: true,
  is_published: false,
  is_featured: false,
  public_sort_order: "0",
});

const emptyIngredient = (): IngredientInput => ({
  name: "",
  unit: "kg",
  reorder_level: "0",
  is_active: true,
});

function formatPrice(value: string | null) {
  if (value === null) return "Not set";
  return new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function CatalogPanel({
  products,
  ingredients,
  categories,
  disabled,
  canManageWebsite,
  onSaveProduct,
  onDeleteProduct,
  onSaveIngredient,
  onSaveCategory,
  onDeleteCategory,
}: Props) {
  const [productId, setProductId] = useState<number | null>(null);
  const [product, setProduct] = useState<ProductInput>(emptyProduct);
  const [ingredientId, setIngredientId] = useState<number | null>(null);
  const [ingredient, setIngredient] = useState<IngredientInput>(emptyIngredient);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [category, setCategory] = useState<CategoryInput>({
    kind: "product",
    name: "",
    sort_order: 0,
    is_active: true,
    is_published: false,
  });

  async function submitProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = new FormData();
    payload.set("name", product.name.trim());
    payload.set("description", product.description.trim());
    payload.set("image_alt", product.image_alt.trim());
    payload.set("category", product.category);
    payload.set("web_id", product.web_id.trim());
    payload.set("selling_unit", product.selling_unit);
    payload.set("unit_price", product.unit_price ? Number(product.unit_price).toFixed(2) : "");
    payload.set("is_active", String(product.is_active));
    payload.set("is_published", String(product.is_published));
    payload.set("is_featured", String(product.is_featured));
    payload.set("public_sort_order", product.public_sort_order);
    if (product.image_file) payload.set("image", product.image_file);
    const saved = await onSaveProduct(productId, payload);
    if (saved) {
      setProductId(null);
      setProduct(emptyProduct());
    }
  }

  async function submitIngredient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await onSaveIngredient(ingredientId, {
      ...ingredient,
      name: ingredient.name.trim(),
      reorder_level: Number(ingredient.reorder_level || "0").toFixed(3),
    });
    if (saved) {
      setIngredientId(null);
      setIngredient(emptyIngredient());
    }
  }

  async function submitCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await onSaveCategory(categoryId, { ...category, name: category.name.trim() });
    if (saved) {
      setCategoryId(null);
      setCategory({
        kind: "product",
        name: "",
        sort_order: 0,
        is_active: true,
        is_published: false,
      });
    }
  }

  function editProduct(item: CatalogProduct) {
    setProductId(item.id);
    setProduct({
      name: item.name,
      description: item.description,
      web_id: item.web_id ?? "",
      image_alt: item.image_alt,
      image_file: null,
      category: item.category ? String(item.category) : "",
      selling_unit: item.selling_unit,
      unit_price: item.unit_price,
      is_active: item.is_active,
      is_published: item.is_published,
      is_featured: item.is_featured,
      public_sort_order: String(item.public_sort_order),
    });
  }

  async function deleteProduct(item: CatalogProduct) {
    if (!window.confirm(`Delete ${item.name}? Products used by recipes, stock, or orders must be deactivated instead.`)) {
      return;
    }
    await onDeleteProduct(item.id);
  }

  function editIngredient(item: CatalogIngredient) {
    setIngredientId(item.id);
    setIngredient({
      name: item.name,
      unit: item.unit,
      reorder_level: item.reorder_level,
      is_active: item.is_active,
    });
  }

  function editCategory(item: CatalogCategory) {
    setCategoryId(item.id);
    setCategory({
      kind: item.kind,
      name: item.name,
      sort_order: item.sort_order,
      is_active: item.is_active,
      is_published: item.is_published,
    });
  }

  return (
    <div className="stacked-panels catalog-workspace">
      <section className="operation-layout catalog-operation">
        <section className="panel form-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Menu and selling details</p>
              <h2>{productId ? "Edit cake product" : "Add cake product"}</h2>
            </div>
          </div>
          <form className="portal-form" onSubmit={submitProduct}>
            <label>
              Cake name
              <input
                required
                maxLength={120}
                value={product.name}
                onChange={(event) => setProduct({ ...product, name: event.target.value })}
              />
            </label>
            <label>
              Product category
              <select value={product.category} onChange={(event) => setProduct({ ...product, category: event.target.value })}>
                <option value="">No category</option>
                {categories.filter((item) => item.kind === "product").map((item) => <option value={item.id} key={item.id}>{item.name}{item.is_published ? "" : " (draft)"}</option>)}
              </select>
            </label>
            <label>
              Public cake ID <span className="optional">(required to publish)</span>
              <input
                maxLength={80}
                pattern="[A-Za-z0-9_-]+"
                value={product.web_id ?? ""}
                onChange={(event) => setProduct({ ...product, web_id: event.target.value })}
                aria-describedby="website-cake-id-help"
              />
            </label>
            <p className="form-hint" id="website-cake-id-help">
              This stable ID connects the published cake to customer order requests.
            </p>
            <label>
              Selling price in ETB <span className="optional">(optional)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={product.unit_price ?? ""}
                onChange={(event) => setProduct({ ...product, unit_price: event.target.value || null })}
              />
            </label>
            <label>
              Description <span className="optional">(optional)</span>
              <textarea
                rows={3}
                value={product.description}
                onChange={(event) => setProduct({ ...product, description: event.target.value })}
              />
            </label>
            <label>
              Image description <span className="optional">(for screen readers)</span>
              <input maxLength={240} value={product.image_alt} onChange={(event) => setProduct({ ...product, image_alt: event.target.value })} />
            </label>
            <label>
              Product image <span className="optional">(up to 5 MB)</span>
              <input type="file" accept="image/*" onChange={(event) => setProduct({ ...product, image_file: event.target.files?.[0] ?? null })} />
              {productId && products.find((item) => item.id === productId)?.image && <span className="form-hint">Choose a file to replace the current image.</span>}
            </label>
            <label className="catalog-checkbox">
              <input
                type="checkbox"
                checked={product.is_active}
                disabled={Boolean(productId && products.find((item) => item.id === productId)?.is_published && !canManageWebsite)}
                onChange={(event) => setProduct({ ...product, is_active: event.target.checked })}
              />
              Available for orders
            </label>
            {canManageWebsite && (
              <>
                <label className="catalog-checkbox"><input type="checkbox" checked={product.is_published} onChange={(event) => setProduct({ ...product, is_published: event.target.checked })} />Show on public website</label>
                <label className="catalog-checkbox"><input type="checkbox" checked={product.is_featured} onChange={(event) => setProduct({ ...product, is_featured: event.target.checked })} />Feature on homepage</label>
                <label>Menu order<input type="number" min="0" value={product.public_sort_order} onChange={(event) => setProduct({ ...product, public_sort_order: event.target.value })} /></label>
              </>
            )}
            <div className="catalog-form-actions">
              <button className="button button-dark" disabled={disabled}>
                <Plus size={15} />{productId ? "Save cake changes" : "Add cake"}
              </button>
              {productId && (
                <button
                  type="button"
                  className="quiet-button"
                  onClick={() => {
                    setProductId(null);
                    setProduct(emptyProduct());
                  }}
                >
                  <X size={14} /> Cancel editing
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Available to the team</p>
              <h2>Cake products</h2>
            </div>
            <span>{products.length} products</span>
          </div>
          {products.length ? (
            <div className="table-scroll">
              <table>
                <thead><tr><th>Cake</th><th>Website ID</th><th>Price</th><th>Availability</th><th>Public page</th><th /></tr></thead>
                <tbody>
                  {products.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.web_id || "—"}</td>
                      <td>{formatPrice(item.unit_price)}</td>
                      <td><span className={`status-pill${item.is_active ? " status-ready" : " status-cancelled"}`}>{item.is_active ? "Available" : "Unavailable"}</span></td>
                      <td><span className={`status-pill${item.is_published ? " status-ready" : ""}`}>{item.is_published ? item.is_featured ? "Featured" : "Published" : "Draft"}</span></td>
                      <td>
                        <div className="catalog-row-actions">
                          <button className="quiet-button" type="button" onClick={() => editProduct(item)}><Pencil size={13} />Edit</button>
                          <button
                            className="icon-action"
                            type="button"
                            aria-label={`Delete ${item.name}`}
                            title={item.is_published && !canManageWebsite ? "Only website managers can delete published products." : "Delete product"}
                            disabled={disabled || (item.is_published && !canManageWebsite)}
                            onClick={() => deleteProduct(item)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state"><h3>No cakes added</h3><p>Add the cakes your team sells. A website ID also connects a cake to public orders.</p></div>
          )}
        </section>
      </section>

      <section className="operation-layout catalog-operation">
        <section className="panel form-panel">
          <div className="panel-heading"><div><p className="eyebrow">Menu organization</p><h2>{categoryId ? "Edit category" : "Add category"}</h2></div></div>
          <form className="portal-form" onSubmit={submitCategory}>
            <label>Category name<input required maxLength={80} value={category.name} onChange={(event) => setCategory({ ...category, name: event.target.value })} /></label>
            <label>Category type<select disabled={Boolean(categoryId)} value={category.kind} onChange={(event) => setCategory({ ...category, kind: event.target.value as CatalogCategory["kind"] })}><option value="product">Cake products</option><option value="ingredient">Ingredients</option></select></label>
            <label>Display order<input type="number" min="0" value={category.sort_order} onChange={(event) => setCategory({ ...category, sort_order: Number(event.target.value) })} /></label>
            <label className="catalog-checkbox"><input type="checkbox" checked={category.is_active} disabled={Boolean(category.is_published && !canManageWebsite)} onChange={(event) => setCategory({ ...category, is_active: event.target.checked })} />Category is active</label>
            {canManageWebsite && <label className="catalog-checkbox"><input type="checkbox" checked={category.is_published} onChange={(event) => setCategory({ ...category, is_published: event.target.checked })} />Show product category publicly</label>}
            <div className="catalog-form-actions"><button className="button button-dark" disabled={disabled}><Plus size={15} />{categoryId ? "Save category" : "Add category"}</button>{categoryId && <button type="button" className="quiet-button" onClick={() => { setCategoryId(null); setCategory({ kind: "product", name: "", sort_order: 0, is_active: true, is_published: false }); }}>Cancel editing</button>}</div>
          </form>
        </section>
        <section className="panel">
          <div className="panel-heading"><div><p className="eyebrow">Product and ingredient groups</p><h2>Categories</h2></div><span>{categories.length}</span></div>
          {categories.length ? categories.map((item) => (
            <article className="website-list-row" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <span className="category-tag-kind">{item.kind === "product" ? "Cake products" : "Ingredients"}</span>
                <span className={`status-pill ${item.is_published ? "status-ready" : "status-unpaid"}`}>
                  {item.is_published ? "Published" : "Draft"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <button className="button button-sm button-outline" type="button" onClick={() => editCategory(item)}>
                  <Pencil size={13} /> Edit
                </button>
                <button
                  className="icon-action"
                  type="button"
                  aria-label={`Delete ${item.name}`}
                  disabled={disabled || (item.is_published && !canManageWebsite)}
                  onClick={() => onDeleteCategory(item.id)}
                >
                  <X size={15} />
                </button>
              </div>
            </article>
          )) : <div className="empty-state"><h3>No categories</h3><p>Create categories to organize cakes and ingredients.</p></div>}
        </section>
      </section>

      <section className="operation-layout catalog-operation">
        <section className="panel form-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Ingredients used in production</p>
              <h2>{ingredientId ? "Edit ingredient" : "Add ingredient"}</h2>
            </div>
          </div>
          <form className="portal-form" onSubmit={submitIngredient}>
            <label>
              Ingredient name
              <input
                required
                maxLength={120}
                value={ingredient.name}
                onChange={(event) => setIngredient({ ...ingredient, name: event.target.value })}
              />
            </label>
            <div className="form-row">
              <label>
                Stock unit
                <select
                  value={ingredient.unit}
                  onChange={(event) => setIngredient({ ...ingredient, unit: event.target.value as CatalogIngredient["unit"] })}
                >
                  <option value="kg">Kilogram (kg)</option>
                  <option value="g">Gram (g)</option>
                  <option value="l">Litre (l)</option>
                  <option value="ml">Millilitre (ml)</option>
                  <option value="piece">Piece</option>
                </select>
              </label>
              <label>
                Reorder level
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={ingredient.reorder_level}
                  onChange={(event) => setIngredient({ ...ingredient, reorder_level: event.target.value })}
                />
              </label>
            </div>
            <p className="form-hint">Choose the unit you purchase and count this ingredient in. Recipe units can use compatible gram/kilogram or millilitre/litre conversions.</p>
            <label className="catalog-checkbox">
              <input
                type="checkbox"
                checked={ingredient.is_active}
                onChange={(event) => setIngredient({ ...ingredient, is_active: event.target.checked })}
              />
              Available for recipes and purchases
            </label>
            <div className="catalog-form-actions">
              <button className="button button-dark" disabled={disabled}>
                <Plus size={15} />{ingredientId ? "Save ingredient changes" : "Add ingredient"}
              </button>
              {ingredientId && (
                <button
                  type="button"
                  className="quiet-button"
                  onClick={() => {
                    setIngredientId(null);
                    setIngredient(emptyIngredient());
                  }}
                >
                  <X size={14} /> Cancel editing
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Stock definitions</p>
              <h2>Ingredients</h2>
            </div>
            <span>{ingredients.length} ingredients</span>
          </div>
          {ingredients.length ? (
            <div className="table-scroll">
              <table>
                <thead><tr><th>Ingredient</th><th>Unit</th><th>Reorder at</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {ingredients.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.unit}</td>
                      <td>{item.reorder_level}</td>
                      <td><span className={`status-pill${item.is_active ? " status-ready" : " status-cancelled"}`}>{item.is_active ? "Active" : "Inactive"}</span></td>
                      <td><button className="quiet-button" type="button" onClick={() => editIngredient(item)}><Pencil size={13} />Edit</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state"><h3>No ingredients added</h3><p>Add ingredients here before setting up recipes or recording purchases.</p></div>
          )}
        </section>
      </section>
    </div>
  );
}
