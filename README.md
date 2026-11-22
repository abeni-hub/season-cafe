# Season Cake customer website

Customer-facing React, TypeScript, Vite, and Tailwind CSS site. Product examples,
gallery images, and business details are centralized in `src/data/siteData.ts`.
The six signature cake family names were provided by Season Cake; their current
photos are illustrative samples. Other cake entries are development examples.

## Run locally

```sh
npm install
npm run dev
```

For a production build, run `npm run build`; preview it with `npm run preview`.

## Motion

The hero entrance, section reveals, and signature-cake treatments are managed in
`src/animations/` with GSAP and ScrollTrigger. Framer Motion handles gallery
filter transitions, the featured-family spotlight, and image dialogs; CSS
handles lightweight hover feedback. Motion respects reduced-motion settings.
Cursor movement is limited to fine-pointer desktop devices, while scroll parallax
is reduced or skipped on tablet and mobile viewports.

## Customer requests

The order form posts JSON to `/orders`. It is now accepted by the private
Django BMS API; requests remain unassigned until an owner selects a location.
For local development, the Vite server proxies `/orders` to Django at port
8000. In production, route that path through a same-origin reverse proxy to
the BMS API. Cross-origin API requests are not enabled by this project.

Each public cake ID must be mapped to an active BMS cake product using its
`web_id` field. Unmapped or inactive products are rejected, and the website
does not claim the request was accepted unless the API confirms it.

Contact messages still require a configured customer-service endpoint at
`/contact`; the BMS does not currently store or process those messages.

The cake form currently submits the selected cake ID, requested size and
quantity, contact details, fulfillment choice, date, and optional instructions.
The backend should resolve the selected cake and confirm availability and
pricing; this site does not promise a price or order confirmation.

## Before launch

- Replace development-example cake entries and illustrative photography with
  approved menu details and licensed brand imagery.
- Add Season Cake's confirmed phone, email, address, opening hours, and social
  profile URLs in `src/data/siteData.ts`.
- Add only approved client logos and genuine customer feedback.
- Configure and test the order and contact endpoints described above.

## Private business portal

The separate owner, manager, and employee portal and Django API live in
`bms-frontend/` and `backend/`. See [backend/README.md](backend/README.md) for
local development, Compose setup, migrations, and business configuration.
The existing public site remains independently buildable with `npm run build`.
