/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_BACKEND: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_BASE44_APP_ID?: string;
  readonly VITE_BASE44_FUNCTIONS_VERSION?: string;
  readonly VITE_BASE44_APP_BASE_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
