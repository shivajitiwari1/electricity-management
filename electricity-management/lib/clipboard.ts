/**
 * Clipboard helper with graceful fallback.
 *
 * The Clipboard API requires a secure context (HTTPS or localhost).
 * When it's unavailable, we fall back to a temporary <textarea> approach
 * that works in more browsers but still may be blocked by user settings.
 * All errors are caught so a copy failure never crashes the component.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text || typeof text !== "string") {
    return false;
  }

  // Modern Clipboard API (requires secure context)
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to textarea fallback below
    }
  }

  // Fallback: temporary textarea + document.execCommand
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const succeeded = document.execCommand("copy");
    document.body.removeChild(textarea);
    return succeeded;
  } catch {
    return false;
  }
}
