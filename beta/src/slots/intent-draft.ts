import type { ContextSlotType } from "./slot";
import { type ComponentSlotType, type ElementSlotType, type FragmentSlotType } from "./slot";
import type { DraftBy } from "../general-types";
import type { SlotIntent } from "./slot-intent";

type DraftSlotType = ComponentSlotType | ContextSlotType | FragmentSlotType | ElementSlotType;

export type DraftIntent<T extends DraftSlotType = DraftSlotType> = T extends DraftSlotType
  ? DraftBy<SlotIntent<T>, "index" | "key" | "path" | "instance">
  : never;
