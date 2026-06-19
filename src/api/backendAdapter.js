import { supabaseBase44 } from './supabaseAdapter';
import { getRealBase44 } from './realBase44Client';

//On the supabase path getRealBase44() is never called, so the Base44 SDK's
//analytics/auth initialisation (createClient → trackInitializationEvent) never fires.
export const base44 =
  import.meta.env.VITE_BACKEND === 'supabase' ? supabaseBase44 : getRealBase44();
