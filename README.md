# ნაწილები — Nawilebi

A Georgian-language car-parts catalog with a customer storefront and an inventory dashboard. The dashboard manages free-text categories, OEM number, fitment, condition, GEL price, stock quantity, publication status, and up to eight ordered photos per part. Customers can type a category into the catalog search field.

## Run locally

Use Node.js 22.12 or later.

```sh
npm ci
npm run dev
```

Open the [local storefront](http://localhost:5173/) or the [local admin dashboard](http://localhost:5173/#admin). Follow the URL printed by Vite if the default port is busy.

Local and hosted builds connect to the Nawilebi Supabase project by default. Set both Supabase environment overrides to use a separate project for development.

```sh
npm run check
npm run build
npm run preview
```

`npm run build` type-checks the app and generates the production site in `dist/`. `npm run preview` serves that build for local review, normally at [http://localhost:4173/](http://localhost:4173/).

## Connect Supabase

1. For a fresh project, keep **Enable Data API** on and **Automatically expose new tables** off. Run the [initial catalog migration](supabase/migrations/20261110000100_catalog.sql) once in the SQL Editor. Then run the [SKU compatibility migration](supabase/migrations/20261110000200_optional_legacy_sku.sql) so new listings can be saved without an internal code. Existing projects with the initial migration only need the second migration.
2. Keep the Email provider enabled and disable **Allow new users to sign up** and **Allow anonymous sign-ins** in the project's Authentication configuration. Storefront visitors can browse published listings without an Auth account. [Supabase Auth configuration](https://supabase.com/docs/guides/auth/general-configuration)
3. In **Authentication → Users**, create the owner's account with an email and password. Confirm the email for that account and copy its User UID.
4. Grant that user catalog access in the SQL Editor by replacing the example UUID with the copied User UID.

   ```sql
   insert into private.catalog_admins (user_id)
   values ('00000000-0000-0000-0000-000000000000'::uuid)
   on conflict do nothing;
   ```

5. When using a different Supabase project, copy [`.env.example`](.env.example) to `.env.local` and fill in both Supabase settings from the project's **Connect** dialog. Use the `sb_publishable_...` key. Keep Supabase secret keys and legacy `service_role` keys out of the browser and all `VITE_` variables. [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
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

On Vercel, use the Vite preset, `npm run build`, and the `dist` output directory. The existing site uses the public browser configuration in `src/supabase-project.ts`. Optional Vercel environment variables are read at build time, so redeploy after changing them. The storefront is [nawilebi.vercel.app](https://nawilebi.vercel.app/) and its admin panel is at `/#admin`. [Vercel environment variables](https://vercel.com/docs/environment-variables)
