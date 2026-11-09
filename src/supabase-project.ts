// This storefront's public browser connection. Supabase access is enforced by RLS.
// Use VITE_ overrides together to point a build at a different project.
const overrideUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const overrideKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const supabaseProject = overrideUrl || overrideKey
  ? { url: overrideUrl, key: overrideKey }
  : {
      url: 'https://sqgonwlmvcpiywxnmkcu.supabase.co',
      key: 'sb_publishable_f-a0iPF3r7Ci8arwn44Ktw_SqCphv7A',
    };
