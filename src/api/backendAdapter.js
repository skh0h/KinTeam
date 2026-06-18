import { supabaseBase44 } from './supabaseAdapter';
import { base44 as realBase44 } from './realBase44Client';

export const base44 =
  import.meta.env.VITE_BACKEND === 'supabase' ? supabaseBase44 : realBase44;
