import { resolveSupabaseProject } from './supabase-config';

export const supabaseProject = resolveSupabaseProject(import.meta.env);
