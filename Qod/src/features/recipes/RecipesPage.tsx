import { useState } from 'react';
import { Calculator, PencilLine } from 'lucide-react';
import { PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { TableShell } from '@/components/ui/table';
import { Pill } from '@/components/ui/badge';
import { ProductMedia } from '@/components/shared/ProductMedia';
import { Money } from '@/components/shared/Money';
import { useDb, usePermission } from '@/hooks/useStore';
import { useToast } from '@/components/ui/toast';
import {
  calculateRecipeCost,
  listRecipes,
  recipeForProduct,
  upsertRecipe,
} from '@/services/live/productionService';
import type { Product, RecipeLine } from '@/types/domain';
import { formatCents } from '@/utils/money';
import { cn } from '@/utils/cn';

interface LineDraft {
  itemId: string;
  quantity: string;
}

export function RecipesPage() {
  const db = useDb();
  const toast = useToast();
  const canManage = usePermission('recipes.manage');
  const [editing, setEditing] = useState<Product | null>(null);
  const [yieldQuantity, setYieldQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([]);

  const products = db.products.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const recipes = listRecipes();
  const ingredients = db.inventoryItems.filter((item) => item.kind !== 'finished');
  const currency = db.settings.currency;

  const openEditor = (product: Product) => {
    const recipe = recipeForProduct(product.id);
    setEditing(product);
    setYieldQuantity(recipe ? String(recipe.yieldQuantity) : '8');
    setNotes(recipe?.notes ?? '');
    setLines(
      recipe
        ? recipe.lines.map((line) => ({ itemId: line.itemId, quantity: String(line.quantity) }))
        : [{ itemId: ingredients[0]?.id ?? '', quantity: '' }],
    );
  };

  const save = async () => {
    if (!editing) return;
    try {
      await upsertRecipe({
        productId: editing.id,
        yieldQuantity: Number(yieldQuantity),
        notes,
        lines: lines
          .filter((line) => line.itemId && Number(line.quantity) > 0)
          .map<RecipeLine>((line) => ({ itemId: line.itemId, quantity: Number(line.quantity) })),
      });
      toast.success(`Recipe for ${editing.name} saved.`);
      setEditing(null);
    } catch (error) {
      toast.error(error);
    }
  };

  const totalValue = recipes.reduce((sum, recipe) => {
    const cost = calculateRecipeCost(recipe);
    return sum + (cost ? cost.batchTotalCents : 0);
  }, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Recipes & costing"
        description="Ingredient and packaging quantities per batch, converted into unit costs and margins using current inventory costs."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Recipes defined</p>
          <p className="mt-1 font-display text-xl text-forest-deep">{recipes.length} / {products.length}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Combined batch cost</p>
          <p className="mt-1 font-display text-xl text-forest-deep">{formatCents(totalValue, currency)}</p>
        </div>
        <div className="card px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Average margin</p>
          <p className="mt-1 font-display text-xl text-forest-deep">
            {recipes.length
              ? `${Math.round(
                  recipes.reduce((sum, recipe) => sum + (calculateRecipeCost(recipe)?.marginPct ?? 0), 0) / recipes.length,
                )}%`
              : '—'}
          </p>
        </div>
      </div>

      <TableShell>
        <table className="table-base">
          <thead>
            <tr>
              <th className="th">Product</th>
              <th className="th text-right">Yield</th>
              <th className="th text-right">Ingredients</th>
              <th className="th text-right">Packaging</th>
              <th className="th text-right">Cost / unit</th>
              <th className="th text-right">Price</th>
              <th className="th text-right">Margin</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const recipe = recipeForProduct(product.id);
              const cost = recipe ? calculateRecipeCost(recipe) : null;
              return (
                <tr key={product.id} className="transition-colors hover:bg-paper/45">
                  <td className="td">
                    <div className="flex items-center gap-3">
                      <ProductMedia
                        slug={product.slug}
                        artIndex={product.artIndex}
                        name={product.name}
                        sizes="48px"
                        className="h-9 w-12 shrink-0 rounded-lg border border-line"
                      />
                      <div>
                        <p className="font-medium text-ink">{product.name}</p>
                        <p className="text-[11px] text-muted">
                          {recipe ? `${recipe.lines.length} line(s)` : 'No recipe yet'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="td text-right text-xs">{recipe ? recipe.yieldQuantity : '—'}</td>
                  <td className="td text-right text-xs">{cost ? <Money cents={cost.ingredientCents} /> : '—'}</td>
                  <td className="td text-right text-xs">{cost ? <Money cents={cost.packagingCents} /> : '—'}</td>
                  <td className="td text-right text-xs font-medium">{cost ? <Money cents={cost.perUnitCents} /> : '—'}</td>
                  <td className="td text-right text-xs"><Money cents={product.priceCents} /></td>
                  <td className="td text-right text-xs">
                    {cost ? (
                      <Pill tone={cost.marginCents < 0 ? 'red' : cost.marginPct < 25 ? 'amber' : 'green'}>
                        {Math.round(cost.marginPct)}%
                      </Pill>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="td text-right">
                    {canManage && (
                      <Button size="sm" variant="outline" onClick={() => openEditor(product)}>
                        <PencilLine className="h-3.5 w-3.5" /> {recipe ? 'Edit' : 'Add'}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableShell>

      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-line/60 bg-paper/60 px-4 py-3 text-[11px] leading-relaxed text-muted">
        <Calculator className="mt-0.5 h-4 w-4 shrink-0 text-forest" />
        <p>
          Costs follow the current weighted average cost of each material. Updating a purchase receipt price
          automatically changes recipe costing and margin analysis here. Production batches snapshot the
          consumption quantity, not the cost, so historical batches remain traceable.
        </p>
      </div>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `${recipeForProduct(editing.id) ? 'Edit' : 'Add'} recipe — ${editing.name}` : 'Recipe'}
        description="Quantities are for a full batch at the stated yield."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save}>Save recipe</Button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Batch yield (units)" htmlFor="recipe-yield">
            <Input id="recipe-yield" inputMode="decimal" value={yieldQuantity} onChange={(e) => setYieldQuantity(e.target.value)} />
          </Field>
          <Field label="Notes" htmlFor="recipe-notes">
            <Input id="recipe-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>

        <div className="mt-4">
          <p className="field-label">Ingredients & packaging</p>
          <div className="space-y-2">
            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-12 gap-2">
                <div className="col-span-8">
                  <Select
                    aria-label={`Recipe line ${index + 1} item`}
                    value={line.itemId}
                    onChange={(e) =>
                      setLines((current) => current.map((entry, i) => (i === index ? { ...entry, itemId: e.target.value } : entry)))
                    }
                  >
                    {ingredients.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.unit})
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="col-span-3">
                  <Input
                    aria-label={`Recipe line ${index + 1} quantity`}
                    inputMode="decimal"
                    placeholder="Qty"
                    value={line.quantity}
                    onChange={(e) =>
                      setLines((current) => current.map((entry, i) => (i === index ? { ...entry, quantity: e.target.value } : entry)))
                    }
                  />
                </div>
                <div className="col-span-1 flex items-center justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Remove line"
                    onClick={() => setLines((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : current))}
                  >
                    ×
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Button
            size="sm"
            variant="subtle"
            className="mt-2"
            onClick={() => setLines((current) => [...current, { itemId: ingredients[0]?.id ?? '', quantity: '' }])}
          >
            Add ingredient
          </Button>
        </div>

        {editing && (
          <div className={cn('mt-4 rounded-xl px-3 py-2 text-[11px]', 'bg-forest-wash/60 text-forest-deep')}>
            Estimated cost: batch total is calculated from current material costs when you save.
          </div>
        )}
      </Modal>
    </div>
  );
}
