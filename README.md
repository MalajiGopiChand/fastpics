# fastpics

A clean event photography app: photographers upload a collection, share its QR code, and guests use a selfie to find and download their solo and group photos.

**Stack:** Next.js + React, ImageKit for private photo storage and delivery, Supabase for PostgreSQL, admin authentication and realtime metadata, and a locally bundled face-recognition model. ImageKit is a media service, not a replacement for the event/auth database.

## Run

Requires Node.js 22.14+.

```powershell
npm ci
npm run dev
```

Open http://localhost:3000. Without Supabase configuration the app runs a clearly labelled **local demo**, with events and photos saved in this browser's IndexedDB. It does not pretend that local photos are shared across phones. The three sample covers are illustrative; sample events start with zero uploaded photos.

Local demo: create event → upload → wait for face indexing → Share gallery → Open gallery → preview guest experience → consent → upload one clear selfie. Keep the admin tab open while uploading. JPEG, PNG and WebP files up to 20 MB are accepted, with up to 2,000 photos and 50 detected faces per image.

## Configure ImageKit

Copy `.env.example` to `.env.local`, then set the ImageKit public key, private key and URL endpoint from your ImageKit account. Keep all keys in environment variables; **never commit `.env.local`**. The private key remains server-only.

In ImageKit's image security settings, enable **Restrict all requests** under signed URLs before sharing real event photos. Files are uploaded as private, but ImageKit private files can otherwise be served through existing named transformations. Global signed-URL enforcement closes that route. Verify that both unsigned originals and unsigned named transformations are denied in your account.

The app uses direct browser uploads authorized by a five-minute server-generated ImageKit upload signature. Only authenticated, allowlisted photographers can obtain one. Before saving photo metadata, the server fetches the uploaded file details and verifies its owner/event path, private flag, image type and size. Use a dedicated ImageKit account for this studio: ImageKit V1 upload signatures are not restricted to a single folder, so only trusted studio administrators should be allowlisted.

Original and thumbnail URLs are generated on the server and signed. Guest links expire after ten minutes; admin preview links last one hour. Original links explicitly disable image optimization to retain the uploaded file. Thumbnail transformations do not require storing a second preview file in the app.

## Configure Supabase

1. Create a free project at https://supabase.com/dashboard.
2. Run `supabase/schema.sql` once in SQL Editor. It creates event/photo tables, admin membership, RLS policies, realtime publications, a per-event photo limit and an atomic match rate limiter. It does **not** create a Supabase image bucket; images live in ImageKit.
3. Create your email/password admin user in Authentication. Alternatively request an account through the app and confirm your email. New accounts remain pending until approved in the photographers table. Set the Auth Site URL to https://fastpics.vercel.app and allow https://fastpics.vercel.app/account/reset as a redirect URL.
4. Allow that user by substituting its actual Auth UUID:

```sql
insert into public.photographers (id) values ('YOUR-AUTH-USER-UUID');
```

5. Put your project URL, publishable key and server secret key in `.env.local`. Never put the service-role key in a `NEXT_PUBLIC_` variable.
6. Restart the app and sign in. Upload new photos in connected mode; local demo photos do not automatically migrate.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLISHABLE-KEY
SUPABASE_SECRET_KEY=YOUR-SERVER-ONLY-SECRET-KEY
IMAGEKIT_PUBLIC_KEY=YOUR-IMAGEKIT-PUBLIC-KEY
IMAGEKIT_PRIVATE_KEY=YOUR-SERVER-ONLY-IMAGEKIT-KEY
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/YOUR-ENDPOINT
```

The sample schema is for a new project. If you used an earlier Supabase Storage schema, migrate the photo records and objects before switching; do not run the new schema over an existing database without a migration and backup.

## Deploy on Vercel

1. Import https://github.com/MalajiGopiChand/fastpics into Vercel.
2. Choose Next.js, Node 22.x, install `npm ci`, build `npm run build`. The repository root contains `package.json`.
3. Set all six environment variables above in Vercel. The app checks configuration and database tables at runtime through /api/config. Redeploy after changing Vercel variables. Hosted sites never silently fall back to browser-only storage.
4. Deploy, sign in, upload a consenting test collection, then check QR access from a second phone over HTTPS.
5. Add your domain in Vercel → Project Settings → Domains and apply the DNS records it provides. Generate QR codes from your final domain; their links use the current browser origin.

Camera capture requires HTTPS or localhost. Uploading a selfie works without camera permission. The application source does not provision a Vercel/Supabase account or purchase a domain.

## Included

- Separate photographer accounts, account requests, password reset, owner-scoped realtime updates, event creation/editing/deletion, search, filters, list/grid views, draft/live/archive states.
- Sequential batch uploads, progress, stop-after-current-file, per-file errors and retry.
- SSD MobileNet face detection, 68-point landmarks and 128-dimensional face descriptors, all processed in the browser with locally served models.
- Recognition against every indexed face, so group photos and solo photos can both appear in guest results. Photos without detected faces remain available to the admin with an explicit status.
- ImageKit private photo storage, server-verified finalization, signed originals and transformed thumbnails.
- Supabase realtime admin counts and metadata. Guest results update when the guest repeats their search; there is no anonymous push feed of new matches.
- Per-event QR PNG download, link copy, guest preview and sharing pause/resume.
- Consent, camera/selfie upload, no-match/error states, photo preview, individual original downloads and selected-photo ZIP downloads with a 150 MB cap.
- Event-scoped matching without exposing the collection's face descriptors to guests.
- Twenty searches per event/client-IP per ten minutes, enforced atomically in the database. A keyed hash is stored instead of the raw IP, with stale entries cleaned after one day. This assumes Vercel's trusted `x-vercel-forwarded-for` header; adapt trusted proxy handling on another host.
- Matching, signing, persistence and event-isolation tests; GitHub Actions runs the tests and production build.

## Cost and capacity

As checked on 17 November 2026, [ImageKit Free](https://imagekit.io/plans) includes **3 GB media storage** and **20 GB monthly bandwidth**. [Supabase Free](https://supabase.com/pricing) includes a **500 MB database**. These are limited allowances, not unlimited free storage. ImageKit stops new uploads or delivery when the relevant free limit is exhausted. Storage shown by this app is the sum of registered original files; check ImageKit for account-wide usage, other files, versions and bandwidth.

At 8 MB per original, 3 GB holds roughly 375 files before any other account usage. Repeated original downloads also consume bandwidth. Supabase free projects can pause after inactivity. Keep your own original-file backups.

[Vercel Hobby](https://vercel.com/docs/plans/hobby) permits personal/non-commercial use. Use an eligible plan for a paid photography business. Domain registration is separate.

The local demo stores self-contained encoded image data so it can survive browser file-handle restoration restrictions. Encoding adds roughly one-third storage overhead. Local data can still be removed by clearing site data or browser eviction and is not shared across devices.

This MVP has a 2,000-photo event cap and sequential browser indexing. Server matching scans the bounded event's descriptors. Larger collections need background ingestion, resumable uploads, a vector index, monitoring and a more substantial storage plan.

## Privacy and recognition limits

The selfie image stays in memory on the guest's device and is not saved. In cloud mode, only its face descriptor is sent for comparison, without persistence by this app. Event photos/descriptors stay private until deleted by the photographer. Face matching uses Euclidean distance below 0.48; this is a starting threshold, not an accuracy guarantee.

Get participants' permission for face indexing and sharing, explain retention, and test with representative images. A face match is not identity verification: another person's photo may retrieve their gallery. Group photos include other people. For sensitive events, add attendee verification or photographer approval before downloads. Side profiles, small faces, poor lighting, occlusion and lookalikes can produce misses or incorrect matches. No age, gender, ethnicity or emotion classification is performed.

Deleting a photo removes the ImageKit asset and database face data. ImageKit CDN copies may remain cached; temporary signed links and their expiry still matter. For immediate removal, also use ImageKit cache purge. Pausing an event prevents new matches but does not revoke previously issued links. A rare interrupted upload/finalization can leave an unregistered ImageKit file; reconcile the owner's event folder in ImageKit if an upload repeatedly fails. Do not enable logging of selfie vectors/request bodies in hosting integrations.

## Verification

```powershell
npm test
npm run build
```

Tests cover group/solo matching, threshold/ranking behavior, malformed descriptors, signed URL generation, persisted image bytes, event isolation and paused-gallery denial. A local browser fixture check detected three faces and gave a distance of about 0.137 to a crop of the matching face, versus 0.660/0.684 to the others. This is only a smoke test, not a real-world accuracy benchmark.

Verify the configured cloud setup before real events: two-admin isolation, anonymous access denial, ImageKit signed-only delivery, real-phone camera permissions, upload/quota failures, signed-link expiry, event pause/delete behavior and recognition with consenting test images. Supabase integration cannot be validated without your project configuration.

## Source map

- `app/page.js` — admin dashboard.
- `components/GuestGallery.js` — guest camera/search/download flow.
- `lib/store.js` — local persistence and authenticated cloud requests.
- `lib/face.js`, `lib/matching.mjs` — face indexing and matching.
- `lib/imagekit.js` — server-only media signing/deletion.
- `app/api/admin/` — authenticated ImageKit upload/finalization and photo access.
- `app/api/events/[token]/match/route.js` — guest event-scoped matching.
- `supabase/schema.sql` — database/access setup.

Models come from `@vladmandic/face-api` and are copied into `public/models` at installation; consult its [documentation](https://github.com/vladmandic/face-api/blob/master/TUTORIAL.md) and bundled license. Fonts use Google Fonts with local fallbacks; example event covers use Unsplash. Real event photos and selfies are never sent to those providers.


## Owner console and monthly subscriptions

Open `/admin` and sign in with the securely provisioned owner account. Owner authority uses server-controlled Supabase `app_metadata.fastpics_role`; public profile fields cannot grant it. No owner password is stored in this repository.

Run `supabase/subscriptions.sql` after the base schema, including on existing installations. It updates RLS to check current server metadata and expiry on every database request. The readiness endpoint requires this migration before enabling the hosted UI.

The only paid plan is **INR 500 per calendar month**, manually activated by the owner after payment is confirmed outside Fastpics. There is no payment gateway, automatic billing, or automatic renewal. Each activation extends a still-active paid period by one month, or starts from the activation time. Month-end dates are clamped to the last day of the next month.

Approving a confirmed client starts a one-time 48-hour trial. Reapproval and resuming a suspended account never reset the trial. The owner can approve, suspend/resume, activate/renew/end paid access, view client event/photo counts and the latest 100 event records, and pause/open individual galleries. No passwords, face descriptors or original images are exposed in the client directory. Suspended and expired accounts lose uploads, direct database access, and new guest photo searches; already-issued signed photo links last until their existing expiry.

Only allowlist trusted photographers while using ImageKit V1 upload signatures (see ImageKit section).


### Management-only owner dashboard

The owner signs in at `/admin` (or is redirected there after signing in at `/`). Owners have no photographer signup, trial-approval screen, studio link, or upload access. Client accounts remain separate.

Run `supabase/owner-management.sql` once in SQL Editor after the base schema. It includes the subscription migration and adds aggregate usage reports, a private manual-payment ledger, and transactional subscription updates. Payment activations use unique request IDs: retries of the same request cannot charge the ledger twice or extend the subscription twice. All management functions are restricted to the server service role; API routes independently verify the authenticated owner.

Income is the sum of INR 500 payments explicitly recorded with activations from this release, not projected revenue or proof of money collected. Existing paid accounts are not backfilled as received income. Sign-in totals use retained `auth.audit_log_entries` login records and require Supabase database audit logging; they are not active-session counts. Storage usage sums uploaded photo sizes, not CDN bandwidth or Supabase database capacity.


### Signup without email verification

New Fastpics registrations use `/api/signup`: bounded input, database-backed per-IP throttling, server-confirmed email, and a fixed pending subscription. The endpoint never accepts roles, subscription grants, or edits to existing accounts. It does not send confirmation email. Existing unconfirmed accounts can be enabled when the owner approves them. Password reset still uses email. Owner approval and subscriptions remain required for photographer uploads.
