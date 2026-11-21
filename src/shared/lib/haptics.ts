/**
 * Light haptic tick, best effort.
 *
 * - Android/Chrome: the Vibration API.
 * - iOS 18+ Safari has no Vibration API, but toggling a native switch
 *   (<input type="checkbox" switch>) plays a system haptic. We keep one hidden switch and
 *   click its label. Unofficial: Apple may change it; then this simply does nothing.
 *   Only works during a user gesture (tap/drag), which is where we use it.
 */
let label: HTMLLabelElement | null = null;

function iosSwitchLabel(): HTMLLabelElement | null {
  if (label) return label;
  if (typeof document === 'undefined') return null;
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.id = 'haptic-switch';
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');
  label = document.createElement('label');
  label.htmlFor = input.id;
  label.setAttribute('aria-hidden', 'true');
  // Visually hidden but still "clickable" for the browser.
  label.style.cssText =
    'position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;left:-100px;';
  label.appendChild(input);
  document.body.appendChild(label);
  return label;
}

export function hapticTick() {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(8);
      return;
    }
    iosSwitchLabel()?.click();
  } catch {
    // Haptics are a nicety; never break the interaction.
  }
}
