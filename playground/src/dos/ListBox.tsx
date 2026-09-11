/**
 * ListBox — selectable rows.
 *
 * `aria-selected` only carries meaning inside a listbox, which is why these
 * are `role="option"` elements rather than buttons. Arrow keys move and
 * select; the whole row is the pointer target.
 *
 * `onValueChange` and `optionValue` are named around the native props they sit
 * beside: `<ul>` already has an `onChange` handler, and `<li value>` is an
 * ordinal number, so the kit's own props take distinct names.
 */
import { useContext, useState } from "yract";
import type { ComponentProps, SEvent } from "yract";
import { ListBoxContext } from "./contexts";
import { useRoving } from "./roving";

export interface ListBoxProps extends ComponentProps<"ul"> {
  /** Value selected on first render. */
  defaultValue: string;
  label: string;
  /** Controlled selection. Pair with `onValueChange`. */
  value?: string;
  onValueChange?: (value: string) => void;
}

export function* ListBox({
  defaultValue,
  label,
  value,
  onValueChange,
  children,
  ...rest
}: ListBoxProps) {
  const [internal, setInternal] = yield* useState(defaultValue);
  const { containerRef, onKeydown } = yield* useRoving<HTMLUListElement>("vertical");

  const selected = value ?? internal;

  function select(next: string): void {
    if (value === undefined) void setInternal(next);
    onValueChange?.(next);
  }

  return (
    <ListBoxContext value={{ selected, select }}>
      <ul
        {...rest}
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

export interface ListBoxOptionProps extends ComponentProps<"li"> {
  /** Identifies the option. Named apart from `<li value>`, which is an ordinal. */
  optionValue: string;
}

export function* ListBoxOption({ optionValue, children, ...rest }: ListBoxOptionProps) {
  const { selected, select } = yield* useContext(ListBoxContext);
  const isSelected = selected === optionValue;

  function onKeydown(event: SEvent<"keydown">): void {
    const { key } = event.nativeEvent;
    if (key !== "Enter" && key !== " ") return;
    event.preventDefault();
    select(optionValue);
  }

  return (
    <li
      {...rest}
      className="dos-list__row"
      role="option"
      data-dos-item=""
      aria-selected={isSelected}
      tabIndex={isSelected ? 0 : -1}
      onClick={() => select(optionValue)}
      onKeydown={onKeydown}
    >
      {children}
    </li>
  );
}
