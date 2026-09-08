/**
 * ListBox — selectable rows.
 *
 * `aria-selected` only carries meaning inside a listbox, which is why these
 * are `role="option"` elements rather than buttons. Arrow keys move and
 * select; the whole row is the pointer target.
 */
import { useContext, useState } from "yract-beta";
import type { PropsWithChildren } from "yract-beta";
import type { SEvent } from "yract-beta";
import { ListBoxContext } from "./contexts";
import { useRoving } from "./roving";

export interface ListBoxProps extends PropsWithChildren {
  /** Value selected on first render. */
  defaultValue: string;
  label: string;
  /** Controlled selection. Pair with `onChange`. */
  value?: string;
  onChange?: (value: string) => void;
}

export function* ListBox({ defaultValue, label, value, onChange, children }: ListBoxProps) {
  const [internal, setInternal] = yield* useState(defaultValue);
  const { containerRef, onKeydown } = yield* useRoving<HTMLUListElement>("vertical");

  const selected = value ?? internal;

  function select(next: string): void {
    if (value === undefined) void setInternal(next);
    onChange?.(next);
  }

  return (
    <ListBoxContext value={{ selected, select }}>
      <ul
        className="dos-list"
        role="listbox"
        aria-label={label}
        ref={containerRef}
        onKeydown={onKeydown}
      >
        {children}
      </ul>
    </ListBoxContext>
  );
}

export interface ListBoxOptionProps extends PropsWithChildren {
  value: string;
}

export function* ListBoxOption({ value, children }: ListBoxOptionProps) {
  const { selected, select } = yield* useContext(ListBoxContext);
  const isSelected = selected === value;

  function onKeydown(event: SEvent<"keydown">): void {
    const { key } = event.nativeEvent;
    if (key !== "Enter" && key !== " ") return;
    event.preventDefault();
    select(value);
  }

  return (
    <li
      className="dos-list__row"
      role="option"
      data-dos-item=""
      aria-selected={isSelected}
      tabIndex={isSelected ? 0 : -1}
      onClick={() => select(value)}
      onKeydown={onKeydown}
    >
      {children}
    </li>
  );
}
