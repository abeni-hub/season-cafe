import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { ProductArt } from '@/components/shared/ProductArt';
import { useDb } from '@/hooks/useStore';

export function GalleryPage() {
  const db = useDb();
  const captions = db.siteContent.galleryCaptions;
  const arts = [0, 5, 3, 1, 4, 2, 6, 0];

  return (
    <div className="container-page py-14 lg:py-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <p className="eyebrow">Gallery</p>
          <h1 className="mt-3 font-display text-4xl text-forest-deep">From the counter and the kitchen.</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            A visual space reserved for the bakery&apos;s own photography. The tiles below are illustrative
            demo artwork; real images and captions are managed in the BMS Website module.
          </p>
        </div>
        <Link to="/custom-orders" className="link-underline">
          Commission a cake <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {arts.map((art, index) => (
          <figure
            key={index}
            className={
              index === 0
                ? 'overflow-hidden rounded-3xl border border-line bg-cream sm:col-span-2 lg:col-span-2'
                : 'overflow-hidden rounded-2xl border border-line bg-cream'
            }
          >
            <ProductArt
              artIndex={art}
              className={index === 0 ? 'aspect-[16/9] w-full' : 'aspect-square w-full'}
            />
            <figcaption className="flex items-center justify-between px-4 py-2.5 text-[11px] text-muted">
              <span>{captions[index % captions.length] ?? 'Bakery imagery'}</span>
              <span className="uppercase tracking-[0.12em] opacity-60">Placeholder</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
