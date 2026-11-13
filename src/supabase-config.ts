// Both the storefront and share previews use the public connection with RLS.
export function resolveSupabaseProject(env: Record<string, unknown>) {
  const overrideUrl = typeof env.VITE_SUPABASE_URL === 'string' ? env.VITE_SUPABASE_URL.trim() : '';
  const overrideKey = typeof env.VITE_SUPABASE_PUBLISHABLE_KEY === 'string' ? env.VITE_SUPABASE_PUBLISHABLE_KEY.trim() : '';
  return overrideUrl || overrideKey
    ? { url: overrideUrl, key: overrideKey }
    : {
        url: 'https://sqgonwlmvcpiywxnmkcu.supabase.co',
        key: 'sb_publishable_f-a0iPF3r7Ci8arwn44Ktw_SqCphv7A',
      };
}
