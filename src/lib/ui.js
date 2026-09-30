import * as React from 'react';
let lockCount = 0;
let originalOverflow = '';
function useScrollLock(active = true) {
  React.useEffect(() => {
    if (!active) return;
    if (lockCount++ === 0) {
      originalOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden';
      document.body.dataset.overlayOpen = 'true';
      window.dispatchEvent(new Event('pause-scroll'));
    }
    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.documentElement.style.overflow = originalOverflow;
        delete document.body.dataset.overlayOpen;
        window.dispatchEvent(new Event('resume-scroll'));
      }
    };
  }, [active]);
}
export { useScrollLock };
function useDialogFocus(onClose) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const last = document.activeElement;
    const getNodes = () =>
      [
        ...(ref.current?.querySelectorAll(
          'button:not(:disabled), a[href], input, select, textarea, [tabindex="0"]',
        ) || []),
      ].filter((n) => n.getClientRects().length);
    const timer = setTimeout(
      () =>
        getNodes()[0]?.focus({
          preventScroll: true,
        }),
      40,
    );
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.key !== 'Tab') return;
      const nodes = getNodes();
      if (!nodes.length) {
        e.preventDefault();
        return;
      }
      const first = nodes[0],
        final = nodes[nodes.length - 1];
      if (
        e.shiftKey &&
        (document.activeElement === first || !ref.current?.contains(document.activeElement))
      ) {
        e.preventDefault();
        final.focus();
      } else if (!e.shiftKey && document.activeElement === final) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKey);
      last?.focus?.({
        preventScroll: true,
      });
    };
  }, [onClose]);
  return ref;
}
export { useDialogFocus };
function downloadText(name, text) {
  const url = URL.createObjectURL(
    new Blob(['\uFEFF' + text], {
      type: 'text/plain;charset=utf-8',
    }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
export { downloadText };
async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* file:// may deny clipboard; use a selected textarea. */
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.style.cssText = 'position:fixed;left:-9999px;top:0;';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}
export { copyText };
function navigateScene(id) {
  window.dispatchEvent(
    new CustomEvent('sequence-navigate', {
      detail: id,
    }),
  );
}
export { navigateScene };
