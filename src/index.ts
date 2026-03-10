/**
 * yielderact – JSX UI library powered by JavaScript generators.
 *
 * Components are generator functions that **return** their JSX.
 * Hooks are called with `yield*` and may pause rendering until async
 * operations complete.
 *
 * Quick-start:
 *
 * ```tsx
 * import { render, useState } from 'yielderact';
 *
 * function* Counter(_props: object) {
 *   const [count, setCount] = yield* useState(0);
 *   return (
 *     <button onClick={() => setCount(count + 1)}>
 *       Clicked {count} times
 *     </button>
 *   );
 * }
 *
 * render(<Counter />, document.getElementById('root')!);
 * ```
 */

export type { Context } from "./context";
export { createContext, useContext } from "./context";
export type { SEvent, SyntheticEvent } from "./events";
export type {
  ComponentGenerator,
  DependencyList,
  HookDescriptor,
  RefObject,
  Renderable,
  ResolveRawResult,
  UseRenderFn,
  UseResolveOptions,
} from "./hooks";
export {
  useEffect,
  useId,
  useMemo,
  useRef,
  useRender,
  useResolve,
  useResolveRaw,
  useResume,
  useState,
  useUIPatch,
} from "./hooks";
export type {
  Child,
  Component,
  FrameworkProps,
  InternalProps,
  SpecialProps,
  VNode,
} from "./jsx";
export { createElement, Fragment } from "./jsx";
export type {
  AnchorHTMLAttributes,
  AreaHTMLAttributes,
  AriaAttributes,
  AudioHTMLAttributes,
  ButtonHTMLAttributes,
  CanvasHTMLAttributes,
  ColHTMLAttributes,
  CSSProperties,
  DetailsHTMLAttributes,
  DialogHTMLAttributes,
  EmbedHTMLAttributes,
  EventHandlers,
  FieldsetHTMLAttributes,
  FormHTMLAttributes,
  HTMLAttributes,
  IframeHTMLAttributes,
  ImgHTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  LiHTMLAttributes,
  LinkHTMLAttributes,
  MetaHTMLAttributes,
  MeterHTMLAttributes,
  ObjectHTMLAttributes,
  OlHTMLAttributes,
  OptgroupHTMLAttributes,
  OptionHTMLAttributes,
  OutputHTMLAttributes,
  ProgressHTMLAttributes,
  ScriptHTMLAttributes,
  SelectHTMLAttributes,
  SlotHTMLAttributes,
  SourceHTMLAttributes,
  StyleHTMLAttributes,
  SVGAttributes,
  SvgHTMLAttributes,
  TableHTMLAttributes,
  TdHTMLAttributes,
  TextareaHTMLAttributes,
  ThHTMLAttributes,
  TimeHTMLAttributes,
  TrackHTMLAttributes,
  VideoHTMLAttributes,
} from "./jsx-types";
export type { Root } from "./render";
export { commitUIPatch, createRoot, flushSync, render, startUIPatch } from "./render";
