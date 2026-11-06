"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

interface DatePickerProps
  extends Omit<React.ComponentProps<typeof Input>, "onClick" | "ref"> {
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
export function DatePicker({ onClick, ...props }: DatePickerProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleClick = (event: React.MouseEvent<HTMLInputElement>) => {
    try {
      inputRef.current?.showPicker?.();
    } catch {
      // showPicker not supported or blocked — fall back to focusing input
      inputRef.current?.focus?.();
    }
    onClick?.(event);
  };

  return <Input ref={inputRef} type="date" onClick={handleClick} {...props} />;
}
