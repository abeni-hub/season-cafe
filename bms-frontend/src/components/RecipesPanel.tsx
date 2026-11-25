import { useState } from "react";
import { BookOpenText, Pencil, Plus, X } from "lucide-react";
import type { CatalogIngredient, CatalogProduct } from "./CatalogPanel";

export type ManagedRecipe = {
  id: number;
  product: number;
  product_name: string;
  name: string;
  description: string;
  version: number;
  is_current: boolean;
  estimated_cost: string | null;
  ingredients: Array<{
    ingredient: number;
    ingredient_name: string;
    quantity: string;
    unit: CatalogIngredient["unit"];
  }>;
};

type RecipeInput = {
  product: number;
  name: string;
  description: string;
  ingredients: Array<{
    ingredient: number;
    quantity: string;
    unit: CatalogIngredient["unit"];
  }>;
};
type RecipeLine = {
  ingredient: string;
  search: string;
  quantity: string;
  unit: CatalogIngredient["unit"] | "";
};
type Props = {
  recipes: ManagedRecipe[];
  products: CatalogProduct[];
  ingredients: CatalogIngredient[];
  canManage: boolean;
  disabled: boolean;
  onCreate: (input: RecipeInput) => Promise<boolean>;
  onGoToCatalog: () => void;
};

const units: CatalogIngredient["unit"][] = ["kg", "g", "l", "ml", "piece"];

function formatCost(value: string | null) {
  if (value === null) return "Add purchase costs to estimate";
  return new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function RecipesPanel({
  recipes,
  products,
  ingredients,
  canManage,
  disabled,
  onCreate,
  onGoToCatalog,
}: Props) {
  const [productId, setProductId] = useState("");
  const [recipeName, setRecipeName] = useState("");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<RecipeLine[]>([{ ingredient: "", search: "", quantity: "", unit: "" }]);
  const activeProducts = products.filter((product) => product.is_active);
  const activeIngredients = ingredients.filter((ingredient) => ingredient.is_active);
  const selectedIngredients = lines.map((line) => line.ingredient).filter(Boolean);
  const hasDuplicateIngredients = new Set(selectedIngredients).size !== selectedIngredients.length;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (hasDuplicateIngredients) return;
    const saved = await onCreate({
      product: Number(productId),
      name: recipeName.trim(),
      description: description.trim(),
      ingredients: lines.map((line) => ({
        ingredient: Number(line.ingredient),
        quantity: Number(line.quantity).toFixed(3),
        unit: line.unit as CatalogIngredient["unit"],
      })),
    });
    if (saved) {
      setProductId("");
      setRecipeName("");
      setDescription("");
      setLines([{ ingredient: "", search: "", quantity: "", unit: "" }]);
    }
  }

  function updateLine(index: number, patch: Partial<RecipeLine>) {
    setLines((current) => current.map((line, lineIndex) => (
      lineIndex === index ? { ...line, ...patch } : line
    )));
  }

  function editAsNewVersion(recipe: ManagedRecipe) {
    setProductId(String(recipe.product));
    setRecipeName(recipe.name || `${recipe.product_name} recipe`);
    setDescription(recipe.description);
    setLines(recipe.ingredients.map((item) => ({
      ingredient: String(item.ingredient),
      search: item.ingredient_name,
      quantity: item.quantity,
      unit: item.unit,
    })));
    document.getElementById("recipe-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="stacked-panels">
      {canManage && (
        <section className="panel form-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">One recipe makes one cake</p>
              <h2>Create a recipe version</h2>
            </div>
          </div>
          {(!activeProducts.length || !activeIngredients.length) ? (
            <div className="catalog-guidance">
              <p>Add at least one active cake product and one ingredient before creating a recipe.</p>
              <button type="button" className="quiet-button" onClick={onGoToCatalog}>Open Catalog</button>
            </div>
          ) : (
            <form className="portal-form recipe-form" id="recipe-editor" onSubmit={submit}>
              <label>
                Recipe name
                <input required maxLength={120} value={recipeName} onChange={(event) => setRecipeName(event.target.value)} />
              </label>
              <label>
                Recipe description <span className="optional">(optional)</span>
                <textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} />
              </label>
              <label>
                Cake product
                <select required value={productId} onChange={(event) => setProductId(event.target.value)}>
                  <option value="">Choose a cake</option>
                  {activeProducts.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}
                </select>
              </label>
              <div className="line-editor">
                <div className="recipe-line-heading"><span>Ingredient</span><span>Amount</span><span>Unit</span><span /></div>
                {lines.map((line, index) => {
                  const selectedIngredient = activeIngredients.find((item) => String(item.id) === line.ingredient);
                  return (
                    <div className="line-row" key={index}>
                      <input
                        type="text"
                        list={`recipe-ingredients-${index}`}
                        aria-label={`Ingredient ${index + 1}`}
                        required
                        autoComplete="off"
                        placeholder="Search ingredients"
                        value={line.search}
                        onChange={(event) => {
                          const search = event.target.value;
                          const nextIngredient = activeIngredients.find((item) => item.name.toLowerCase() === search.trim().toLowerCase());
                          updateLine(index, {
                            ingredient: nextIngredient ? String(nextIngredient.id) : "",
                            search,
                            unit: nextIngredient?.unit ?? (search ? line.unit : ""),
                          });
                        }}
                      />
                      <datalist id={`recipe-ingredients-${index}`}>
                        {activeIngredients.map((item) => <option value={item.name} key={item.id} />)}
                      </datalist>
                      <input
                        aria-label={`Amount for ingredient ${index + 1}`}
                        type="number"
                        required
                        min="0.001"
                        step="0.001"
                        placeholder="0.000"
                        value={line.quantity}
                        onChange={(event) => updateLine(index, { quantity: event.target.value })}
                      />
                      <select
                        aria-label={`Unit for ingredient ${index + 1}`}
                        required
                        value={line.unit || selectedIngredient?.unit || ""}
                        onChange={(event) => updateLine(index, { unit: event.target.value as RecipeLine["unit"] })}
                      >
                        <option value="">Unit</option>
                        {units.map((unit) => <option value={unit} key={unit}>{unit}</option>)}
                      </select>
                      {lines.length > 1 ? (
                        <button
                          className="icon-action"
                          type="button"
                          aria-label={`Remove ingredient ${index + 1}`}
                          onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}
                        >
                          <X size={16} />
                        </button>
                      ) : <span />}
                    </div>
                  );
                })}
              </div>
              <button
                className="quiet-button"
                type="button"
                onClick={() => setLines((current) => [...current, { ingredient: "", search: "", quantity: "", unit: "" }])}
              >
                <Plus size={14} /> Add another ingredient
              </button>
              {hasDuplicateIngredients && (
                <p className="field-error" role="alert">Choose each ingredient once per recipe.</p>
              )}
              <p className="form-hint">Use the amounts for one cake. Compatible units such as grams and kilograms are converted automatically. Saving creates a new version and preserves prior production records.</p>
              <button
                className="button button-dark"
                disabled={disabled || !productId || !recipeName.trim() || lines.some((line) => !line.ingredient || !line.quantity || !line.unit) || hasDuplicateIngredients}
              >
                <BookOpenText size={15} /> Save recipe version
              </button>
            </form>
          )}
        </section>
      )}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Production reference</p>
            <h2>Recipes</h2>
          </div>
          <span>{recipes.length} versions</span>
        </div>
        {recipes.length ? (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Cake and recipe</th><th>Version</th><th>Ingredients per cake</th><th>Estimated cost</th><th /></tr></thead>
              <tbody>
                {recipes.map((recipe) => (
                  <tr key={recipe.id}>
                    <td>{recipe.product_name}<small>{recipe.name || "Recipe"} · {recipe.is_current ? "Current recipe" : "Historical version"}</small>{recipe.description && <small>{recipe.description}</small>}</td>
                    <td>v{recipe.version}</td>
                    <td>{recipe.ingredients.map((item) => `${item.quantity} ${item.unit} ${item.ingredient_name}`).join(", ")}</td>
                    <td>{formatCost(recipe.estimated_cost)}</td>
                    <td>{canManage && <button className="quiet-button" type="button" onClick={() => editAsNewVersion(recipe)}><Pencil size={13} />Create next version</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><h3>No recipes configured</h3><p>Create a recipe to calculate ingredient needs before production.</p></div>
        )}
      </section>
    </div>
  );
}
