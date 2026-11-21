/**
 * Light haptic tick where the platform supports it (Vibration API, e.g. Android/Chrome).
 * iOS Safari/PWA has no web haptics; a native shell (Capacitor) would add real haptics.
 */
export function hapticTick() {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
  } catch {
    // Haptics are a nicety; never break the interaction.
  }
}
