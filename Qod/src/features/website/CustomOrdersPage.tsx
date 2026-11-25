import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, CalendarDays, CheckCircle2, ClipboardList, MessageSquare, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { BakeryImage } from '@/components/shared/BakeryImage';
import { useDb } from '@/hooks/useStore';
import { createCustomInquiry, ORDER_TYPE_LABELS } from '@/services/live/orderService';
import { HAS_REMOTE_API } from '@/config/brand';
import { EDITORIAL_MEDIA } from '@/config/media';
import { useGsapScope } from '@/lib/gsap';
import { EDITORIAL_EASE } from '@/lib/motion';
import type { Order } from '@/types/domain';

type FormState = {
  name: string;
  email: string;
  phone: string;
  kind: 'individual' | 'organization';
  organization: string;
  type: 'custom' | 'organizational' | 'bulk';
  occasion: string;
  deliveryDate: string;
  servings: string;
  budget: string;
  description: string;
  notes: string;
};

const initial: FormState = {
  name: '',
  email: '',
  phone: '',
  kind: 'individual',
  organization: '',
  type: 'custom',
  occasion: '',
  deliveryDate: '',
  servings: '',
  budget: '',
  description: '',
  notes: '',
};

export function CustomOrdersPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const db = useDb();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitted, setSubmitted] = useState<Order | null>(null);

  useGsapScope(
    rootRef,
    ({ gsap, reduced }) => {
      if (reduced) return;
      gsap.from('[data-custom-hero]', {
        y: 18,
        opacity: 0,
        duration: 0.65,
        stagger: 0.1,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
      });
    },
    [submitted],
  );

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) nextErrors.name = 'Please include your name.';
    if (!form.phone.trim() && !form.email.trim()) nextErrors.phone = 'Add a phone number or email.';
    if (!form.description.trim()) nextErrors.description = 'Tell us what you need.';
    if (form.kind === 'organization' && !form.organization.trim()) {
      nextErrors.organization = 'Add the organisation name.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    try {
      const order = await createCustomInquiry({
        contact: {
          name: form.name,
          kind: form.kind,
          organization: form.organization,
          phone: form.phone,
          email: form.email,
        },
        type: form.type,
        description: form.description,
        deliveryDate: form.deliveryDate,
        occasion: form.occasion,
        servings: form.servings,
        budget: form.budget,
        notes: form.notes,
      });
      setSubmitted(order);
      toast.success(`Enquiry logged as ${order.code}.`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      toast.error(error);
    }
  };

  if (submitted) {
    return (
      <div className="container-page flex justify-center py-16">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EDITORIAL_EASE }}
          className="w-full max-w-2xl"
        >
          <div className="rounded-3xl border border-line bg-cream p-8 text-center shadow-soft">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-forest-wash text-forest">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <p className="eyebrow mt-5">Enquiry received</p>
            <h1 className="mt-2 font-display text-3xl text-forest-deep">
              Thank you, {form.name.split(' ')[0]}.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Your request was logged as <span className="font-semibold text-ink">{submitted.code}</span>.{' '}
              {HAS_REMOTE_API
                ? 'The bakery team can now review it and prepare a written quotation.'
                : 'In this demo build it appears immediately in the BMS custom-order queue, ready for a written quotation.'}
            </p>
            <dl className="mt-6 grid gap-3 rounded-2xl border border-line bg-paper/60 p-5 text-left text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Order type</dt>
                <dd className="mt-1 font-medium text-ink">{ORDER_TYPE_LABELS[submitted.type]}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Requested date</dt>
                <dd className="mt-1 font-medium text-ink">{submitted.deliveryDate ?? 'To be discussed'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Brief</dt>
                <dd className="mt-1 font-medium text-ink">{submitted.items[0]?.description}</dd>
              </div>
            </dl>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button
                onClick={() => {
                  setSubmitted(null);
                  setForm(initial);
                }}
              >
                Submit another enquiry
              </Button>
              <Link
                to="/products"
                className="inline-flex items-center gap-2 rounded-xl border border-forest/25 px-4 py-2.5 text-sm font-semibold text-forest hover:bg-forest-wash"
              >
                Browse the catalogue
              </Link>
            </div>
            <p className="mt-5 text-[11px] leading-relaxed text-muted">
              {HAS_REMOTE_API
                ? 'Recorded in the bakery ledger. No payment is collected online and no production is scheduled until the quotation is accepted.'
                : 'Demo note: no payment is collected online and no production is scheduled automatically.'}
              {db.siteContent.contactPhone ? ` For urgent requests, call ${db.siteContent.contactPhone}.` : ''}
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="container-page py-14 lg:py-20">
      <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <div data-custom-hero className="max-w-2xl">
          <p className="eyebrow">Custom, bulk &amp; corporate</p>
          <h1 className="mt-3 text-balance font-display text-4xl text-forest-deep sm:text-5xl">
            Let&apos;s plan the bake.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted">{db.siteContent.customOrderNote}</p>
          <div className="mt-6 flex flex-wrap gap-3 text-xs text-ink-soft">
            <span className="rounded-full border border-line bg-cream px-3.5 py-1.5 font-medium">
              Botanical celebration cakes
            </span>
            <span className="rounded-full border border-line bg-cream px-3.5 py-1.5 font-medium">
              Corporate events &amp; gifting
            </span>
            <span className="rounded-full border border-line bg-cream px-3.5 py-1.5 font-medium">
              Separate from the 7-item counter menu
            </span>
          </div>
        </div>

        <div data-custom-hero className="mx-auto w-full max-w-md lg:max-w-none">
          <div className="overflow-hidden rounded-3xl border border-line bg-cream shadow-soft">
            <BakeryImage
              src={EDITORIAL_MEDIA.customCelebration.src}
              srcSmall={EDITORIAL_MEDIA.customCelebration.srcSmall}
              width={EDITORIAL_MEDIA.customCelebration.width}
              height={EDITORIAL_MEDIA.customCelebration.height}
              alt={EDITORIAL_MEDIA.customCelebration.alt}
              sizes="(max-width: 1024px) 100vw, 40vw"
              priority
              className="aspect-[4/3] w-full lg:aspect-[5/4]"
            />
          </div>
        </div>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-[1.35fr_0.65fr]">
        <form onSubmit={submit} className="card p-6 sm:p-8" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact name" htmlFor="name" error={errors.name}>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="Full name"
              />
            </Field>
            <Field label="Customer type" htmlFor="kind">
              <Select
                id="kind"
                value={form.kind}
                onChange={(e) => update('kind', e.target.value as FormState['kind'])}
              >
                <option value="individual">Individual</option>
                <option value="organization">Organisation</option>
              </Select>
            </Field>
            <Field label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="name@example.com"
              />
            </Field>
            <Field label="Phone" htmlFor="phone" error={errors.phone}>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="Phone number"
              />
            </Field>
            {form.kind === 'organization' && (
              <Field label="Organisation" htmlFor="organization" error={errors.organization} className="sm:col-span-2">
                <Input
                  id="organization"
                  value={form.organization}
                  onChange={(e) => update('organization', e.target.value)}
                  placeholder="Company or institution"
                />
              </Field>
            )}
            <Field label="Order type" htmlFor="type">
              <Select
                id="type"
                value={form.type}
                onChange={(e) => update('type', e.target.value as FormState['type'])}
              >
                <option value="custom">Custom cake</option>
                <option value="organizational">Organisational order</option>
                <option value="bulk">Bulk order</option>
              </Select>
            </Field>
            <Field label="Occasion" htmlFor="occasion">
              <Input
                id="occasion"
                value={form.occasion}
                onChange={(e) => update('occasion', e.target.value)}
                placeholder="Birthday, launch, gifting…"
              />
            </Field>
            <Field label="Requested date" htmlFor="deliveryDate">
              <Input
                id="deliveryDate"
                type="date"
                value={form.deliveryDate}
                onChange={(e) => update('deliveryDate', e.target.value)}
              />
            </Field>
            <Field label="Servings / quantity" htmlFor="servings">
              <Input
                id="servings"
                value={form.servings}
                onChange={(e) => update('servings', e.target.value)}
                placeholder="e.g. 40 guests"
              />
            </Field>
            <Field label="Budget guide (optional)" htmlFor="budget" className="sm:col-span-2">
              <Input
                id="budget"
                value={form.budget}
                onChange={(e) => update('budget', e.target.value)}
                placeholder="A range helps us shape the quotation"
              />
            </Field>
            <Field
              label="What do you have in mind?"
              htmlFor="description"
              error={errors.description}
              className="sm:col-span-2"
            >
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Flavours, tiers, colours, style references, dietary notes…"
              />
            </Field>
            <Field label="Anything else?" htmlFor="notes" className="sm:col-span-2">
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
                placeholder="Delivery expectations, purchase orders, invoicing requirements…"
              />
            </Field>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <p className="max-w-sm text-[11px] leading-relaxed text-muted">
              No payment is taken here. Submissions are{' '}
              {HAS_REMOTE_API ? 'sent securely to the bakery team' : 'stored in the demo workspace'} and will be quoted by
              the bakery.
            </p>
            <Button type="submit" size="lg">
              Submit enquiry <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>

        <aside className="space-y-5">
          <div className="rounded-2xl border border-line bg-cream p-5">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
              <ClipboardList className="h-3.5 w-3.5" /> What happens next
            </p>
            <ol className="mt-4 space-y-4">
              {[
                {
                  icon: MessageSquare,
                  title: 'We review the brief',
                  copy: 'Availability and any clarifications are confirmed with you.',
                },
                {
                  icon: Sparkles,
                  title: 'Written quotation',
                  copy: 'Specification, price and delivery schedule are agreed in writing.',
                },
                {
                  icon: CalendarDays,
                  title: 'Deposit & production',
                  copy: 'A deposit confirms the order; production is scheduled separately.',
                },
              ].map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest-wash text-[11px] font-bold text-forest tabular-nums">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{step.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">{step.copy}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-2xl border border-line bg-forest-deep p-5 text-cream/80">
            <p className="font-display text-lg text-cream">Corporate &amp; government orders</p>
            <p className="mt-2 text-xs leading-relaxed">
              Share purchase-order and invoicing requirements in the notes field. Quotations, deposits, balances and
              delivery schedules are tracked per order in the BMS.
            </p>
            <Link
              to="/contact"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-clay-soft transition-colors hover:text-cream"
            >
              Prefer to talk? Contact the bakery <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <p className="px-1 text-[11px] leading-relaxed text-muted">
            {HAS_REMOTE_API
              ? 'This form creates a real enquiry record in the bakery system. No payment is taken and no email is sent automatically.'
              : 'This form writes to a local demo dataset. No email is sent and no real order is created.'}
          </p>
        </aside>
      </div>
    </div>
  );
}
