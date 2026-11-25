import { useState } from 'react';
import { MailOpen, RotateCcw } from 'lucide-react';
import { PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { TableShell, Tabs } from '@/components/ui/table';
import { Pill } from '@/components/ui/badge';
import { ConfirmModal } from '@/components/ui/confirm';
import { useToast } from '@/components/ui/toast';
import { getSettings, getSiteContent, listMessages, markMessageRead, updateSettings, updateSiteContent } from '@/services/live/siteService';
import { resetDemoDatabase } from '@/services/demo/store';
import type { SiteContent } from '@/types/domain';
import { formatDateTime } from '@/utils/date';
import { HAS_REMOTE_API } from '@/config/brand';

type TabKey = 'content' | 'settings' | 'messages';

type ContentForm = Omit<SiteContent, 'galleryCaptions'> & { galleryCaptions: string[] };

export function WebsiteCmsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<TabKey>('content');
  const [content, setContent] = useState<ContentForm>(() => ({ ...getSiteContent() }));
  const [settingsForm, setSettingsForm] = useState(() => {
    const settings = getSettings();
    return { businessName: settings.businessName, tagline: settings.tagline, currency: settings.currency };
  });
  const [resetOpen, setResetOpen] = useState(false);
  const messages = listMessages();
  const unread = messages.filter((message) => !message.isRead).length;

  const set = (key: keyof ContentForm, value: string) => setContent((current) => ({ ...current, [key]: value }));

  const saveContent = async () => {
    try {
      await updateSiteContent(content);
      toast.success('Website content saved.');
    } catch (error) {
      toast.error(error);
    }
  };

  const saveSettings = async () => {
    try {
      await updateSettings(settingsForm);
      toast.success('Business settings saved.');
    } catch (error) {
      toast.error(error);
    }
  };

  const read = async (id: string) => {
    try {
      await markMessageRead(id);
      toast.success('Message marked as read.');
    } catch (error) {
      toast.error(error);
    }
  };

  const reset = () => {
    resetDemoDatabase();
    setContent({ ...getSiteContent() });
    const settings = getSettings();
    setSettingsForm({ businessName: settings.businessName, tagline: settings.tagline, currency: settings.currency });
    toast.success('Demo data restored to its original seeded state.');
  };

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Website & settings"
        description="Public copy, business identity and enquiries. Contact details start empty — the site tells visitors when details are unpublished instead of inventing them."
        actions={
          HAS_REMOTE_API ? undefined : (
            <Button variant="outline" onClick={() => setResetOpen(true)}>
              <RotateCcw className="h-4 w-4" /> Reset demo data
            </Button>
          )
        }
      />

      <Tabs<TabKey>
        items={[
          { key: 'content', label: 'Website content' },
          { key: 'settings', label: 'Business settings' },
          { key: 'messages', label: `Enquiries${unread ? ` (${unread})` : ''}` },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'content' && (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="card space-y-3 p-5">
            <p className="eyebrow">Home</p>
            <Field label="Hero eyebrow" htmlFor="cms-hero-eyebrow">
              <Input id="cms-hero-eyebrow" value={content.heroEyebrow} onChange={(e) => set('heroEyebrow', e.target.value)} />
            </Field>
            <Field label="Hero title" htmlFor="cms-hero-title">
              <Input id="cms-hero-title" value={content.heroTitle} onChange={(e) => set('heroTitle', e.target.value)} />
            </Field>
            <Field label="Hero lead" htmlFor="cms-hero-lead">
              <Textarea id="cms-hero-lead" value={content.heroLead} onChange={(e) => set('heroLead', e.target.value)} />
            </Field>
            <Field label="Custom order note" htmlFor="cms-custom-note">
              <Textarea id="cms-custom-note" value={content.customOrderNote} onChange={(e) => set('customOrderNote', e.target.value)} />
            </Field>
          </div>

          <div className="card space-y-3 p-5">
            <p className="eyebrow">About & contact</p>
            <Field label="About title" htmlFor="cms-about-title">
              <Input id="cms-about-title" value={content.aboutTitle} onChange={(e) => set('aboutTitle', e.target.value)} />
            </Field>
            <Field label="About lead" htmlFor="cms-about-lead">
              <Textarea id="cms-about-lead" value={content.aboutLead} onChange={(e) => set('aboutLead', e.target.value)} />
            </Field>
            <Field label="About body" htmlFor="cms-about-body">
              <Textarea id="cms-about-body" value={content.aboutBody} onChange={(e) => set('aboutBody', e.target.value)} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Public phone" htmlFor="cms-phone" hint="Leave empty if not yet published.">
                <Input id="cms-phone" value={content.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} />
              </Field>
              <Field label="Public email" htmlFor="cms-email">
                <Input id="cms-email" value={content.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} />
              </Field>
              <Field label="Address" htmlFor="cms-address" className="sm:col-span-2">
                <Input id="cms-address" value={content.contactAddress} onChange={(e) => set('contactAddress', e.target.value)} />
              </Field>
              <Field label="Opening hours" htmlFor="cms-hours" className="sm:col-span-2">
                <Input id="cms-hours" value={content.openingHours} onChange={(e) => set('openingHours', e.target.value)} />
              </Field>
            </div>
          </div>

          <div className="card space-y-3 p-5 xl:col-span-2">
            <p className="eyebrow">Gallery captions</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {content.galleryCaptions.map((caption, index) => (
                <Field key={index} label={`Tile ${index + 1}`} htmlFor={`cms-gallery-${index}`}>
                  <Input
                    id={`cms-gallery-${index}`}
                    value={caption}
                    onChange={(e) =>
                      setContent((current) => ({
                        ...current,
                        galleryCaptions: current.galleryCaptions.map((entry, i) => (i === index ? e.target.value : entry)),
                      }))
                    }
                  />
                </Field>
              ))}
            </div>
            <p className="text-[11px] text-muted">
              Gallery tiles use labelled placeholder artwork rather than unverified photographs. Replace the
              images once the business supplies approved photography.
            </p>
            <div className="flex justify-end">
              <Button onClick={saveContent}>Save website content</Button>
            </div>
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="card max-w-xl space-y-3 p-5">
          <p className="eyebrow">Identity</p>
          <Field label="Business name" htmlFor="settings-name">
            <Input id="settings-name" value={settingsForm.businessName} onChange={(e) => setSettingsForm((current) => ({ ...current, businessName: e.target.value }))} />
          </Field>
          <Field label="Tagline" htmlFor="settings-tagline">
            <Input id="settings-tagline" value={settingsForm.tagline} onChange={(e) => setSettingsForm((current) => ({ ...current, tagline: e.target.value }))} />
          </Field>
          <Field label="Working currency (ISO 4217)" htmlFor="settings-currency" hint="All monetary values are stored as integer minor units.">
            <Input id="settings-currency" value={settingsForm.currency} maxLength={3} onChange={(e) => setSettingsForm((current) => ({ ...current, currency: e.target.value.toUpperCase() }))} />
          </Field>
          <div className="flex justify-end">
            <Button onClick={saveSettings}>Save settings</Button>
          </div>
          <p className="text-[11px] leading-relaxed text-muted">
            Locations (Home Bakery and Café) are fixed operating locations in this implementation. Changing the
            currency changes formatting only; historical records are not converted.
          </p>
        </div>
      )}

      {tab === 'messages' && (
        <TableShell>
          <table className="table-base">
            <thead>
              <tr>
                <th className="th">Received</th>
                <th className="th">From</th>
                <th className="th">Subject</th>
                <th className="th">Message</th>
                <th className="th">Status</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {messages.map((message) => (
                <tr key={message.id} className={message.isRead ? undefined : 'bg-forest-wash/25'}>
                  <td className="td whitespace-nowrap text-xs">{formatDateTime(message.createdAt)}</td>
                  <td className="td text-xs">
                    <p className="font-medium text-ink">{message.name}</p>
                    <p className="text-muted">{message.email ?? message.phone ?? '—'}</p>
                  </td>
                  <td className="td text-xs font-medium text-ink">{message.subject}</td>
                  <td className="td max-w-[360px] text-xs text-muted">{message.body}</td>
                  <td className="td"><Pill tone={message.isRead ? 'neutral' : 'amber'}>{message.isRead ? 'Read' : 'New'}</Pill></td>
                  <td className="td text-right">
                    {!message.isRead && (
                      <Button size="sm" variant="outline" onClick={() => read(message.id)}>
                        <MailOpen className="h-3.5 w-3.5" /> Mark read
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {!messages.length && (
                <tr><td className="td text-xs text-muted" colSpan={6}>No website enquiries yet.</td></tr>
              )}
            </tbody>
          </table>
        </TableShell>
      )}

      <ConfirmModal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset demo data?"
        description="This replaces all demo records with the original seeded catalogue, orders, stock and staff accounts. It cannot be undone."
        confirmLabel="Reset demo data"
        onConfirm={reset}
      />
    </div>
  );
}
