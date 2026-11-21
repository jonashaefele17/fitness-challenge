function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing environment variable ${name}. See .env.example.`);
  }
  return value;
}

export const env = {
  supabaseUrl: required('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL),
  supabasePublishableKey: required(
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  ),
  /** Public VAPID key for Web Push; push is unavailable without it. */
  vapidPublicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY ?? null,
  /** Absolute URL of the app root, used as OAuth redirect target. */
  appUrl: new URL(import.meta.env.BASE_URL, window.location.origin).toString(),
} as const;
