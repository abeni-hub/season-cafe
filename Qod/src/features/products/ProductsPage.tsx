import { useState } from 'react';
import { PencilLine, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { TableShell } from '@/components/ui/table';
import { Pill } from '@/components/ui/badge';
import { ProductArt } from '@/components/shared/ProductArt';
import { Money } from '@/components/shared/Money';
import { useDb } from '@/hooks/useStore';
import { useToast } from '@/components/ui/toast';
import { updateProduct } from '@/services/live/catalogService';
import type { Product } from '@/types/domain';
import { parseMoneyToCents } from '@/utils/money';

export function ProductsPage() {
  const db = useDb();
  const toast = useToast();
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ tagline: '', description: '', price: '' });

  const openEdit = (product: Product) => {
    setEditing(product);
    setForm({
      tagline: product.tagline,
      description: product.description,
      price: (product.priceCents / 100).toString(),
    });
  };

  const save = async () => {
    if (!editing) return;
    try {
      await updateProduct(editing.id, {
        tagline: form.tagline,
        description: form.description,
        priceCents: parseMoneyToCents(form.price),
      });
      toast.success(`${editing.name} updated.`);
      setEditing(null);
    } catch (error) {
      toast.error(error);
    }
  };

  const toggle = async (product: Product, key: 'isPublished' | 'isAvailable') => {
    try {
      await updateProduct(product.id, { [key]: !product[key] });
      toast.success(
        `${product.name} is now ${key === 'isPublished' ? (product.isPublished ? 'unpublished from' : 'published to') : product.isAvailable ? 'unavailable at' : 'available at'} the storefront.`,
      );
    } catch (error) {
      toast.error(error);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Catalogue"
        description="The regular catalogue is fixed at seven products. Presentation, pricing and publication are managed here; product creation and deletion are intentionally disabled."
      />

      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-forest/15 bg-forest-wash/70 px-4 py-3 text-xs leading-relaxed text-forest-deep">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Seven products only. Custom cakes and corporate orders belong to the order desk, never to this
          catalogue. Price edits apply to new POS sales immediately; existing orders retain their agreed
          totals.
        </p>
      </div>

      <TableShell>
        <table className="table-base">
          <thead>
            <tr>
              <th className="th">Product</th>
              <th className="th">Tagline</th>
              <th className="th text-right">Price</th>
              <th className="th text-center">Published</th>
              <th className="th text-center">Available</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody>
            {db.products
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((product) => (
                <tr key={product.id} className="transition-colors hover:bg-paper/40">
                  <td className="td">
                    <div className="flex items-center gap-3">
                      <ProductArt artIndex={product.artIndex} className="h-12 w-16 shrink-0 rounded-lg" />
                      <div>
                        <p className="font-semibold text-ink">{product.name}</p>
                        <p className="text-[11px] text-muted">/{product.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="td max-w-[260px] text-xs text-muted">{product.tagline}</td>
                  <td className="td text-right font-medium"><Money cents={product.priceCents} /></td>
                  <td className="td text-center">
                    <button type="button" onClick={() => toggle(product, 'isPublished')} aria-label="Toggle publication">
                      <Pill tone={product.isPublished ? 'green' : 'neutral'} className="cursor-pointer">
                        {product.isPublished ? 'Live' : 'Hidden'}
                      </Pill>
                    </button>
                  </td>
                  <td className="td text-center">
                    <button type="button" onClick={() => toggle(product, 'isAvailable')} aria-label="Toggle availability">
                      <Pill tone={product.isAvailable ? 'blue' : 'amber'} className="cursor-pointer">
                        {product.isAvailable ? 'Selling' : 'Paused'}
                      </Pill>
                    </button>
                  </td>
                  <td className="td text-right">
                    <Button size="sm" variant="outline" onClick={() => openEdit(product)}>
                      <PencilLine className="h-3.5 w-3.5" /> Edit
                    </Button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </TableShell>

      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        Website cards are generated from this data. Images are illustrative demo artwork — the business can
        replace descriptions, pricing and availability, and the storefront reflects it immediately.
      </p>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.name}` : 'Edit product'}
        description="This content appears on the public product page."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save}>Save changes</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="Tagline" htmlFor="product-tagline">
            <Input id="product-tagline" value={form.tagline} onChange={(e) => setForm((current) => ({ ...current, tagline: e.target.value }))} />
          </Field>
          <Field label="Description" htmlFor="product-description">
            <Textarea id="product-description" value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} />
          </Field>
          <Field label="Regular price" htmlFor="product-price" hint="Shown in the working currency; stored as integer minor units.">
            <Input id="product-price" inputMode="decimal" value={form.price} onChange={(e) => setForm((current) => ({ ...current, price: e.target.value }))} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
