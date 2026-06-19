import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

//Create a client with authentication required — called lazily so the SDK
//never initialises (analytics, auth) when the Supabase backend is active.
export function getRealBase44() {
  const { appId, token, functionsVersion, appBaseUrl } = appParams;
  return createClient({
    appId,
    token,
    functionsVersion,
    serverUrl: '',
    requiresAuth: false,
    appBaseUrl
  });
}
