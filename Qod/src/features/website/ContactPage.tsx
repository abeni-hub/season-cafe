import { useState } from 'react';
import { CheckCircle2, Clock, Mail, MapPin, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { useDb } from '@/hooks/useStore';
import { submitMessage } from '@/services/live/siteService';
import { HAS_REMOTE_API } from '@/config/brand';

export function ContactPage() {
  const db = useDb();
  const content = db.siteContent;
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', body: '' });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const hasContact = Boolean(content.contactPhone || content.contactEmail || content.contactAddress || content.openingHours);

  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await submitMessage(form);
      setSent(true);
      toast.success(HAS_REMOTE_API ? 'Message sent to the bakery team.' : 'Message received in the demo workspace.');
      setForm({ name: '', email: '', phone: '', subject: '', body: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      toast.error(err);
    }
  };

  const channels = [
    { icon: Phone, label: 'Phone', value: content.contactPhone },
    { icon: Mail, label: 'Email', value: content.contactEmail },
    { icon: MapPin, label: 'Address', value: content.contactAddress },
    { icon: Clock, label: 'Opening hours', value: content.openingHours },
  ];

  return (
    <div className="container-page py-14 lg:py-20">
      <div className="max-w-2xl">
        <p className="eyebrow">Contact</p>
        <h1 className="mt-3 font-display text-4xl text-forest-deep sm:text-5xl">Talk to the bakery.</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Questions about the counter, an existing order or a celebration bake — send a note and it lands
          directly in the business workspace.
        </p>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-line bg-cream p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Bakery channels</p>
            {hasContact ? (
              <ul className="mt-4 space-y-4">
                {channels.map((channel) =>
                  channel.value ? (
                    <li key={channel.label} className="flex gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest-wash text-forest">
                        <channel.icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">{channel.label}</p>
                        <p className="mt-0.5 whitespace-pre-line text-sm text-ink">{channel.value}</p>
                      </div>
                    </li>
                  ) : null,
                )}
              </ul>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-line bg-paper/60 p-4 text-xs leading-relaxed text-muted">
                The bakery has not published contact details yet. An administrator can add a phone number,
                email address, address and opening hours in the BMS Website module — this page will display
                them automatically.
              </div>
            )}
            <div className="mt-5 border-t border-line pt-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Locations</p>
              <ul className="mt-2 space-y-1.5 text-sm text-ink">
                {db.settings.locations.map((location) => (
                  <li key={location.id} className="flex items-center justify-between gap-2">
                    <span>{location.name}</span>
                    <span className="text-xs text-muted">{location.kind}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-paper/60 p-5 text-xs leading-relaxed text-muted">
            For custom cakes and corporate orders, the{' '}
            <a href="/custom-orders" className="font-semibold text-forest underline-offset-2 hover:underline">
              custom-order form
            </a>{' '}
            captures the details needed for a written quotation.
          </div>
        </div>

        <form onSubmit={submit} className="card p-6 sm:p-8">
          {sent && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-forest/20 bg-forest-wash px-4 py-3 text-sm text-forest-deep">
              <CheckCircle2 className="mt-0.5 h-4 w-4" />
              <p>
                {HAS_REMOTE_API
                  ? 'Message received by the bakery. The team can read it in the business workspace.'
                  : 'Message saved to the demo inbox.'}{' '}
                Open <span className="font-semibold">BMS → Website &amp; settings → Enquiries</span> to read it.
              </p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="contact-name">
              <Input id="contact-name" value={form.name} onChange={(e) => update('name', e.target.value)} required />
            </Field>
            <Field label="Email" htmlFor="contact-email">
              <Input id="contact-email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
            </Field>
            <Field label="Phone" htmlFor="contact-phone">
              <Input id="contact-phone" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
            </Field>
            <Field label="Subject" htmlFor="contact-subject">
              <Input id="contact-subject" value={form.subject} onChange={(e) => update('subject', e.target.value)} required />
            </Field>
            <Field label="Message" htmlFor="contact-body" className="sm:col-span-2" error={error}>
              <Textarea id="contact-body" value={form.body} onChange={(e) => update('body', e.target.value)} required />
            </Field>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <p className="text-[11px] text-muted">Include an email or phone so the bakery can reply.</p>
            <Button type="submit">Send message</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
