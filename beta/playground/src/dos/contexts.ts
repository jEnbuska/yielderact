/**
 * Shared contexts for the DOS kit.
 *
 * Compound components talk to each other through these rather than through
 * props, so a caller can nest `<Tab>` inside anything `<Tabs>` renders and it
 * still finds its group.
 */
import { createContext } from "yract-beta";

export interface TabsContextValue {
  /** Value of the currently selected tab. */
  selected: string;
  select: (value: string) => void;
  /** Prefix for the generated tab/panel ids, so `aria-controls` can be derived. */
  baseId: string;
  /** Accessible name for the tablist. */
  label: string;
}

export const TabsContext = createContext<TabsContextValue>(
  { selected: "", select: () => {}, baseId: "", label: "" },
  "DosTabs",
);

export interface FieldContextValue {
  controlId: string;
  descriptionId: string;
  errorId: string;
  invalid: boolean;
}

export const FieldContext = createContext<FieldContextValue>(
  { controlId: "", descriptionId: "", errorId: "", invalid: false },
  "DosField",
);

export interface RadioGroupContextValue {
  /** Shared `name`, which is what makes the radios one group in the DOM. */
  name: string;
  value: string;
  select: (value: string) => void;
}

export const RadioGroupContext = createContext<RadioGroupContextValue>(
  { name: "", value: "", select: () => {} },
  "DosRadioGroup",
);

export interface ListBoxContextValue {
  selected: string;
  select: (value: string) => void;
}

export const ListBoxContext = createContext<ListBoxContextValue>(
  { selected: "", select: () => {} },
  "DosListBox",
);
