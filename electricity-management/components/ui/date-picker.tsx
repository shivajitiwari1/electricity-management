"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface DatePickerProps
  extends Omit<React.ComponentProps<"input">, "onClick"> {
  onClick?: React.MouseEventHandler<HTMLInputElement>;
}

/**
 * Date input that opens the browser calendar picker when clicking anywhere
 * on the field (not just the calendar icon button).
 *
 * Uses HTMLInputElement.showPicker(), supported in Chrome/Edge/Safari on
 * secure contexts (localhost and HTTPS both qualify).
 * Falls back gracefully in browsers that don't support it.
 */
export function DatePicker({ onClick, className, ref, ...props }: DatePickerProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  // Merge the caller's ref (e.g. react-hook-form's register()) with the
  // internal ref needed for showPicker(); spreading {...props} after a
  // hardcoded ref={inputRef} would otherwise overwrite inputRef and leave it null.
  const mergedRef = React.useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as React.RefObject<HTMLInputElement | null>).current = node;
      }
    },
    [ref]
  );

  const handleClick = (event: React.MouseEvent<HTMLInputElement>) => {
    const input = inputRef.current;
    if (input) {
      // Clicks on the native calendar indicator must not be handled twice:
      // Chrome opens/closes the picker as the click's default action, so
      // calling showPicker() here as well cancels it out (calendar appears
      // to need a second click). Field clicks, by contrast, do nothing
      // natively, so we open the picker ourselves there.
      const dir = window.getComputedStyle(input).direction;
      const offsetX = event.nativeEvent.offsetX;
      const onIndicator =
        dir === "rtl" ? offsetX < 30 : offsetX > input.offsetWidth - 30;
      if (!onIndicator) {
        try {
          input.showPicker?.();
        } catch {
          // showPicker not supported or blocked — fall back to focusing input
          input.focus?.();
        }
      }
    }
    onClick?.(event);
  };

  return (
    <input
      ref={mergedRef}
      type="date"
      onClick={handleClick}
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  );
}
