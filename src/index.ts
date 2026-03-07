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
export { createElement, Fragment } from './jsx';
export { render, createRoot, startUIPatch, commitUIPatch } from './render';
export type { Root } from './render';
export { createContext, useContext } from './context';
export {
  useState,
  useEffect,
  useResolve,
  useResolveRaw,
  useRef,
  useId,
  useMemo,
  useRender,
  useResume,
  useUIPatch,
  usePatchContext,
} from './hooks';
export type { VNode, Child, GeneratorComponentFn, PlainComponentFn, AnyComponentFn } from './jsx';
export type { Context } from './context';
export type { SyntheticEvent, SEvent } from './events';
export type {
  UseResolveOptions,
  Renderable,
  RefObject,
  UseRenderFn,
  ResolveRawResult,
} from './hooks';
export type {
  CSSProperties,
  EventHandlers,
  AriaAttributes,
  HTMLAttributes,
  AnchorHTMLAttributes,
  AreaHTMLAttributes,
  AudioHTMLAttributes,
  ButtonHTMLAttributes,
  CanvasHTMLAttributes,
  ColHTMLAttributes,
  DetailsHTMLAttributes,
  DialogHTMLAttributes,
  EmbedHTMLAttributes,
  FieldsetHTMLAttributes,
  FormHTMLAttributes,
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
  TableHTMLAttributes,
  TdHTMLAttributes,
  TextareaHTMLAttributes,
  ThHTMLAttributes,
  TimeHTMLAttributes,
  TrackHTMLAttributes,
  VideoHTMLAttributes,
  SVGAttributes,
  SvgHTMLAttributes,
} from './jsx-types';
