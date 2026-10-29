/**
 * Copies plain or tab-separated text to the system clipboard.
 * Uses the async Clipboard API first and falls back to an off-screen textarea
 * so copying works reliably inside cross-origin preview iframes.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error('[Clipboard] navigator.clipboard.writeText fallback triggered:', err);
    }
  }

  if (typeof document === 'undefined') {
    return false;
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.className = 'fixed -top-96 -left-96 opacity-0 pointer-events-none';
    document.body.appendChild(textarea);

    const activeEl = document.activeElement as HTMLElement | null;
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);

    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    activeEl?.focus?.();
    return copied;
  } catch (err) {
    console.error('[Clipboard] Fallback copy failed:', err);
    return false;
  }
}

/**
 * Sanitizes a single cell value so tabs or line breaks never split columns/rows when pasted into Excel.
 */
export function cleanTsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Formats a 2D array of rows into tab-separated text (TSV) ready to paste directly into Excel columns.
 */
export function formatTsv(
  rows: Array<Array<string | number | null | undefined>>
): string {
  return rows.map((row) => row.map(cleanTsvCell).join('\t')).join('\n');
}
