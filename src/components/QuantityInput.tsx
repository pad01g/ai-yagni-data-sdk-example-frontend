/**
 * 数量の欄。打っている途中の文字は下書きとして持ち、欄を離れたときか Enter で確定する。
 * 1 以上の整数でなければ元の数に戻す（空欄にしても行は消えない。消すのは「削除」ボタン）。
 */
import { useState } from "react";

import { parseQuantity } from "../cart.ts";

export function QuantityInput(props: {
  value: number;
  max: number;
  label: string;
  disabled: boolean;
  onCommit: (quantity: number) => void;
}) {
  const { value, max, label, disabled, onCommit } = props;
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (): void => {
    if (draft === null) return;
    const n = parseQuantity(draft);
    setDraft(null);
    if (n !== null && n !== value) onCommit(n);
  };
  return (
    <input
      type="number"
      inputMode="numeric"
      min={1}
      max={max}
      step={1}
      value={draft ?? String(value)}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        else if (e.key === "Escape") setDraft(null);
      }}
    />
  );
}
