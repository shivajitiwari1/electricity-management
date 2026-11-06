"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

interface DatePickerProps
  extends Omit<React.ComponentProps<typeof Input>, "onClick"> {
  onClick?: React.MouseEventHandler<HTMLInputElement>;
}

/**
 * Date input that opens the browser calendar picker when clicking anywhere
 * on the field (not just the calendar icon button).
 *
 * Uses HTMLInputElement.showPicker(), supported in Chrome/Edge/Safari.
 * Falls back gracefully in browsers that don't support it.
 */
export function DatePicker({ onClick, ...props }: DatePickerProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleClick = (event: React.MouseEvent<HTMLInputElement>) => {
    inputRef.current?.showPicker?.();
    onClick?.(event);
  };

  return <Input ref={inputRef} type="date" onClick={handleClick} {...props} />;
}
