import React, { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CookingPot, Download } from "lucide-react";
import { api } from "../api";
import { exportToCsv } from "../utils/exportCsv";

export type Location = { id: number; name: string; kind: "home_bakery" | "cafe" | "other" };
export type Product = { id: number; name: string };
export type IngredientUnit = "kg" | "g" | "l" | "ml" | "piece";

export type Recipe = {
  id: number;
  product: number;
  product_name: string;
  version: number;
  is_current: boolean;
  estimated_cost: string | null;
  ingredients: Array<{
    id?: number;
    ingredient: number;
    ingredient_name: string;
    quantity: string;
    unit: IngredientUnit;
    unit_cost?: string;
  }>;
};

export type ProductionPlan = {
  product: number;
  product_name: string;
  quantity: number;
  recipe_version: number;
  ingredients: Array<{
    ingredient: number;
    ingredient_name: string;
    recipe_quantity: string;
    recipe_unit: IngredientUnit;
    required_quantity: string;
    unit: IngredientUnit;
    available_quantity: string;
    sufficient: boolean;
  }>;
};

export type ProductionBatch = {
  id: number;
  product_name: string;
  quantity: number;
  produced_at: string;
  finished_quantity: number;
  adjustment_note: string;
  wastage_quantity: number;
  wastage_note: string;
  recipe_version: number | null;
  estimated_cost: string | null;
  actual_cost: string | null;
  consumptions: Array<{
    ingredient_name: string;
    quantity: string;
    unit: string;
    total_cost: string | null;
  }>;
};

const unitFactors: Record<IngredientUnit, { dimension: string; factor: number }> = {
  kg: { dimension: "mass", factor: 1000 },
  g: { dimension: "mass", factor: 1 },
  l: { dimension: "volume", factor: 1000 },
  ml: { dimension: "volume", factor: 1 },
  piece: { dimension: "piece", factor: 1 },
};

function convertDisplayQuantity(amount: number, from: IngredientUnit, to: IngredientUnit) {
  if (unitFactors[from].dimension !== unitFactors[to].dimension) return null;
  return (amount * unitFactors[from].factor) / unitFactors[to].factor;
}

function formatMoney(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-ET", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

interface ProductionPanelProps {
  batches: ProductionBatch[];
  products: Product[];
  recipes: Recipe[];
  location?: Location;
  disabled: boolean;
  onSubmit: (payload: unknown) => Promise<boolean>;
}

export function ProductionPanel({
  batches,
  products,
  recipes,
  location,
  disabled,
  onSubmit,
}: ProductionPanelProps) {
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [wastageQuantity, setWastageQuantity] = useState("0");
  const [wastageNote, setWastageNote] = useState("");
  const [adjustmentNote, setAdjustmentNote] = useState("");
  const [actualValues, setActualValues] = useState<Record<number, string>>({});
  const requestKey = useRef<{ signature: string; key: string } | null>(null);

  const recipe = recipes.find(
    (item) => item.product === Number(productId) && item.is_current,
  );

  const planQuery = useQuery({
    queryKey: ["production-plan", location?.id, productId, quantity],
    queryFn: () =>
      api<ProductionPlan>(
        `/api/production/requirements/?location=${location?.id}&product=${productId}&quantity=${quantity}`,
      ),
    enabled: Boolean(
      location && productId && Number.isInteger(Number(quantity)) && Number(quantity) > 0,
    ),
    retry: false,
  });
  const plan = planQuery.data;

  const enoughStock = Boolean(
    plan &&
      plan.ingredients.every((item) => {
        const entered = actualValues[item.ingredient]?.trim();
        const recipeLine = recipe?.ingredients.find(
          (line) => line.ingredient === item.ingredient,
        );
        const actualRequired =
          entered && recipeLine
            ? convertDisplayQuantity(Number(entered), recipeLine.unit, item.unit)
            : Number(item.required_quantity);
        return actualRequired !== null && actualRequired <= Number(item.available_quantity);
      }),
  );

  const hasConsumptionAdjustment = Boolean(
    recipe?.ingredients.some((line) => {
      const entered = actualValues[line.ingredient]?.trim();
      return entered && Math.abs(Number(entered) - Number(line.quantity) * Number(quantity)) > 0.0005;
    }),
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const actualConsumption = recipe?.ingredients
      .filter((line) => actualValues[line.ingredient]?.trim())
      .map((line) => ({
        ingredient: line.ingredient,
        quantity: actualValues[line.ingredient],
        unit: line.unit,
      }));

    const payload = {
      product: Number(productId),
      quantity: Number(quantity),
      note: String(new FormData(formElement).get("note") ?? ""),
      wastage_quantity: Number(wastageQuantity),
      wastage_note: wastageNote,
      adjustment_note: adjustmentNote,
      ...(actualConsumption?.length ? { actual_consumption: actualConsumption } : {}),
    };
    const signature = JSON.stringify(payload);
    if (requestKey.current?.signature !== signature) {
      requestKey.current = { signature, key: crypto.randomUUID() };
    }
    const saved = await onSubmit({ ...payload, idempotency_key: requestKey.current.key });
    if (!saved) return;

    formElement.reset();
    requestKey.current = null;
    setProductId("");
    setQuantity("1");
    setWastageQuantity("0");
    setWastageNote("");
    setAdjustmentNote("");
    setActualValues({});
  }

  function handleExportCsv() {
    const headers = [
      "Batch ID",
      "Cake",
      "Quantity Made",
      "Finished (Stocked)",
      "Recipe Version",
      "Ingredients Used",
      "Wastage",
      "Wastage Note",
      "Adjustment Note",
      "Estimated Cost",
      "Actual Cost",
      "Date",
    ];
    const rows = batches.map((b) => [
      `#${b.id}`,
      b.product_name,
      b.quantity,
      b.finished_quantity,
      b.recipe_version ? `v${b.recipe_version}` : "Historical",
      b.consumptions.map((c) => `${c.quantity} ${c.unit} ${c.ingredient_name}`).join("; "),
      b.wastage_quantity,
      b.wastage_note || "—",
      b.adjustment_note || "—",
      b.estimated_cost ?? "—",
      b.actual_cost ?? "—",
      formatDate(b.produced_at),
    ]);
    exportToCsv("seasons-cake-production-batches", headers, rows);
  }

  return (
    <div className="operation-layout">
      <section className="panel form-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Plan against the current recipe and stock</p>
            <h2>Production batch</h2>
          </div>
        </div>

        {!location && (
          <div className="setup-notice">
            Select one location to record production, or create locations from Catalog &amp; users.
          </div>
        )}

        <form className="portal-form" onSubmit={submit}>
          <label>
            Cake
            <select
              name="product"
              value={productId}
              onChange={(event) => {
                setProductId(event.target.value);
                setActualValues({});
              }}
              required
            >
              <option value="">Choose cake</option>
              {products.map((product) => (
                <option value={product.id} key={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Total cakes made, including wastage
            <input
              name="quantity"
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              required
            />
          </label>

          <label>
            Wasted cakes
            <input
              name="wastage_quantity"
              type="number"
              min="0"
              max={quantity}
              step="1"
              value={wastageQuantity}
              onChange={(event) => setWastageQuantity(event.target.value)}
              required
            />
          </label>

          {Number(wastageQuantity) > 0 && (
            <label>
              Wastage reason
              <textarea
                name="wastage_note"
                rows={2}
                value={wastageNote}
                onChange={(event) => setWastageNote(event.target.value)}
                required
              />
            </label>
          )}

          {recipe && (
            <div className="consumption-editor">
              <div>
                <strong>Recipe v{recipe.version}</strong>
                <span>Estimated ingredient cost: {formatMoney(recipe.estimated_cost)}</span>
              </div>
              {planQuery.isFetching && (
                <p className="form-hint">Checking Home Bakery ingredient stock…</p>
              )}
              {planQuery.error && (
                <p className="form-error" role="alert">
                  {planQuery.error instanceof Error
                    ? planQuery.error.message
                    : "Production requirements could not be calculated."}
                </p>
              )}
              {recipe.ingredients.map((line) => {
                const requirement = plan?.ingredients.find(
                  (entry) => entry.ingredient === line.ingredient,
                );
                const entered = actualValues[line.ingredient]?.trim();
                const actualRequired =
                  requirement && entered
                    ? convertDisplayQuantity(Number(entered), line.unit, requirement.unit)
                    : requirement
                    ? Number(requirement.required_quantity)
                    : null;
                const hasAvailableStock =
                  requirement &&
                  actualRequired !== null &&
                  actualRequired <= Number(requirement.available_quantity);
                return (
                  <label key={line.ingredient}>
                    {line.ingredient_name}
                    <span className="optional">
                      Recipe: {(Number(line.quantity) * Number(quantity || 0)).toFixed(3)}{" "}
                      {line.unit}
                      {requirement
                        ? ` · Need ${requirement.required_quantity} ${requirement.unit} · On hand ${requirement.available_quantity} ${requirement.unit}`
                        : ""}
                    </span>
                    <input
                      aria-label={`Actual use of ${line.ingredient_name}`}
                      type="number"
                      min=".001"
                      step=".001"
                      placeholder="Use recipe quantity"
                      value={actualValues[line.ingredient] ?? ""}
                      onChange={(event) =>
                        setActualValues((values) => ({
                          ...values,
                          [line.ingredient]: event.target.value,
                        }))
                      }
                    />
                    {requirement && (
                      <small
                        className={hasAvailableStock ? "stock-sufficient" : "field-error"}
                      >
                        {hasAvailableStock
                          ? "Stock available"
                          : `Short by ${(
                              (actualRequired ?? 0) - Number(requirement.available_quantity)
                            ).toFixed(3)} ${requirement.unit}`}
                      </small>
                    )}
                  </label>
                );
              })}
              <p className="form-hint">
                Leave actual use blank to consume the calculated recipe amount. Actual usage
                that differs from the recipe requires a reason.
              </p>
            </div>
          )}

          {hasConsumptionAdjustment && (
            <label>
              Production adjustment reason
              <textarea
                name="adjustment_note"
                rows={2}
                value={adjustmentNote}
                onChange={(event) => setAdjustmentNote(event.target.value)}
                required
              />
            </label>
          )}

          <label>
            Production note <span className="optional">(optional)</span>
            <textarea name="note" rows={3} />
          </label>

          <button
            className="button button-dark"
            disabled={
              disabled ||
              !location ||
              !recipe ||
              planQuery.isFetching ||
              !enoughStock ||
              Number(wastageQuantity) > Number(quantity) ||
              (Number(wastageQuantity) > 0 && !wastageNote.trim()) ||
              (hasConsumptionAdjustment && !adjustmentNote.trim())
            }
          >
            <CookingPot size={16} /> Confirm production
          </button>
          <p className="form-hint">
            Only the non-wasted cake quantity is added to finished stock. Confirmation records
            actual ingredient use and the responsible employee.
          </p>
        </form>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Immutable batch history</p>
            <h2>Production history</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>{batches.length} batches</span>
            {batches.length > 0 && (
              <button
                type="button"
                className="button button-outline button-sm"
                onClick={handleExportCsv}
                title="Export batches to CSV"
              >
                <Download size={14} /> Export CSV
              </button>
            )}
          </div>
        </div>

        {batches.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Cake</th>
                  <th>Made / stocked</th>
                  <th>Recipe</th>
                  <th>Ingredients used</th>
                  <th>Adjustments / wastage</th>
                  <th>Estimated / actual cost</th>
                  <th>Recorded</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id}>
                    <td>{batch.product_name}</td>
                    <td>
                      {batch.quantity} made
                      <small>{batch.finished_quantity} added to stock</small>
                    </td>
                    <td>
                      {batch.recipe_version
                        ? `v${batch.recipe_version}`
                        : "Historical record"}
                    </td>
                    <td>
                      {batch.consumptions
                        .map((item) => `${item.quantity} ${item.unit} ${item.ingredient_name}`)
                        .join(", ") || "—"}
                    </td>
                    <td>
                      {batch.adjustment_note || "—"}
                      {batch.wastage_quantity > 0 && (
                        <small>
                          {batch.wastage_quantity} wasted: {batch.wastage_note}
                        </small>
                      )}
                    </td>
                    <td>
                      {formatMoney(batch.estimated_cost)} / {formatMoney(batch.actual_cost)}
                    </td>
                    <td>{formatDate(batch.produced_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <h3>No production recorded</h3>
            <p>
              Production batches preserve the recipe version, ingredient use, adjustments,
              and wastage.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
