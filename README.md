# ნაწილები — Nawilebi

A Georgian-language car-parts catalog with a customer storefront and an inventory dashboard. The dashboard manages SKU, OEM number, fitment, condition, GEL price, stock quantity, publication status, and up to eight ordered photos per part. Quantity controls the stock label, and an empty price displays as negotiable.

## Run locally

Use Node.js 22.12 or later.

```sh
npm ci
npm run dev
```

Open the [local storefront](http://localhost:5173/) or the [local admin dashboard](http://localhost:5173/#admin). Follow the URL printed by Vite if the default port is busy.

Without Supabase credentials, the app runs in demo mode with sample inventory and one-click demo admin access. Demo records use local storage and demo uploads use IndexedDB. They persist in the same browser profile and site origin, are visible only there, and do not transfer to Supabase when you connect a project. Use demo mode for testing the dashboard and use live mode for a catalog shared with customers.

```sh
npm run check
npm run build
npm run preview
```

`npm run build` type-checks the app and generates the production site in `dist/`. `npm run preview` serves that build for local review, normally at [http://localhost:4173/](http://localhost:4173/).

## Connect Supabase

1. Create a Supabase project with **Enable Data API** on and **Automatically expose new tables** off. In its SQL Editor, run the [catalog migration](supabase/migrations/20261110000100_catalog.sql) once. It creates the catalog, access policies, admin allowlist, and `part-images` storage bucket. The migration grants the specific Data API permissions the app uses.
2. Keep the Email provider enabled and disable **Allow new users to sign up** and **Allow anonymous sign-ins** in the project's Authentication configuration. Storefront visitors can browse published listings without an Auth account. [Supabase Auth configuration](https://supabase.com/docs/guides/auth/general-configuration)
3. In **Authentication → Users**, create the owner's account with an email and password. Confirm the email for that account and copy its User UID.
4. Grant that user catalog access in the SQL Editor by replacing the example UUID with the copied User UID.

   ```sql
   insert into private.catalog_admins (user_id)
   values ('00000000-0000-0000-0000-000000000000'::uuid)
   on conflict do nothing;
   ```

5. Copy [`.env.example`](.env.example) to `.env.local` and fill in both Supabase settings. Get the project URL and publishable key from the project's **Connect** dialog. Use the `sb_publishable_...` key. Keep Supabase secret keys and legacy `service_role` keys out of the browser and all `VITE_` variables. [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
6. Restart the dev server. Open `/#admin`, sign in with the owner account, add a part, and publish it. Check the storefront in a private browser window to verify customer access. You can connect and deploy the empty storefront before creating the owner account if you are waiting for their email address.

Supabase enforces access in the database. Only accounts on the allowlist can read drafts and change inventory or upload photos. Published rows expose their catalog details, including stock quantity. Product image URLs can be opened by anyone with the exact URL, including URLs for photos uploaded to drafts. Use the bucket for product photos suitable for public viewing. [Supabase Storage buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals)

## Configuration and hosting

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL, such as `https://your-project.supabase.co`. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable browser key from the same project. |
| `VITE_STORE_PHONE` | Optional public phone number with international country code, such as `+995555000000`. |
| `VITE_STORE_EMAIL` | Optional public contact email. |
| `VITE_STORE_WHATSAPP` | Optional public WhatsApp number with international country code, such as `995555000000`. |

The frontend is a static site. Set the variables in your build environment, run `npm ci` and `npm run build`, then deploy `dist/` over HTTPS. Vite embeds these public variables at build time, so rebuild and redeploy after changing them. Send customers the deployed storefront URL and use `/#admin` on the same domain to manage inventory. [Vite environment variables](https://vite.dev/guide/env-and-mode)
