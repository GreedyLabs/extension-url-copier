// Chrome serialises this function into the tab, so keep it self-contained.
export function showCopyToast(message, ok) {
  const id = '__url_copier_toast__';
  document.getElementById(id)?.remove();

  const host = document.createElement('div');
  host.id = id;
  host.style.cssText = `
    all: initial !important; position: fixed !important;
    right: 20px !important; bottom: 20px !important;
    z-index: 2147483647 !important; pointer-events: none !important;
  `;
  const root = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = `
    .toast {
      display: flex; align-items: center; gap: 8px;
      box-sizing: border-box; max-width: min(320px, calc(100vw - 40px));
      padding: 10px 14px; border-radius: 10px;
      background: ${ok ? 'rgba(32, 33, 36, .95)' : '#8c1d18'}; color: #fff;
      font: 500 13px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      overflow-wrap: anywhere; box-shadow: 0 4px 18px rgba(0, 0, 0, .18);
      animation: leave .2s ease-in 1.6s forwards;
    }
    .icon { color: ${ok ? '#81c995' : '#ffb4ab'}; }
    @keyframes leave { to { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .toast { animation: none; } }
  `;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  const icon = document.createElement('span');
  icon.className = 'icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = ok ? '✓' : '!';
  toast.append(icon, document.createTextNode(message));
  root.append(style, toast);
  (document.body || document.documentElement).appendChild(host);
  setTimeout(() => host.remove(), 1800);
}
