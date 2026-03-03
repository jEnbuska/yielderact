/**
 * JSX type definitions for yielderact.
 *
 * Provides strongly-typed props for every standard HTML and SVG element,
 * keeping the developer experience close to TypeScript + React while
 * remaining framework-agnostic.
 *
 * @module jsx-types
 */
import type { SyntheticEvent } from './events';
import type { Child } from './jsx';

// ---------------------------------------------------------------------------
// CSS Properties
// ---------------------------------------------------------------------------

/**
 * CSS style object accepted by the `style` prop.
 *
 * Camel-cased CSS property names with string or number values.
 * Numbers are passed through as-is (the browser interprets them as pixels
 * for length properties where that is valid).
 *
 * CSS custom properties (variables) are also accepted via the
 * `--${string}` template-literal index signature, e.g.:
 *   `{ '--primary-color': '#3498db', '--spacing': '8px' }`
 *
 * Vendor-prefixed properties (e.g. `-webkit-*`, `-moz-*`) are intentionally
 * not supported; use standard CSS properties instead.
 */
export interface CSSProperties {
  accentColor?: string;
  alignContent?: string;
  alignItems?: string;
  alignSelf?: string;
  all?: string;
  animation?: string;
  animationDelay?: string;
  animationDirection?: string;
  animationDuration?: string;
  animationFillMode?: string;
  animationIterationCount?: string | number;
  animationName?: string;
  animationPlayState?: string;
  animationTimingFunction?: string;
  appearance?: string;
  aspectRatio?: string | number;
  backdropFilter?: string;
  backfaceVisibility?: string;
  background?: string;
  backgroundAttachment?: string;
  backgroundBlendMode?: string;
  backgroundColor?: string;
  backgroundClip?: string;
  backgroundImage?: string;
  backgroundOrigin?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;
  backgroundSize?: string;
  blockSize?: string | number;
  border?: string;
  borderBlock?: string;
  borderBlockColor?: string;
  borderBlockEnd?: string;
  borderBlockEndColor?: string;
  borderBlockEndStyle?: string;
  borderBlockEndWidth?: string | number;
  borderBlockStart?: string;
  borderBlockStartColor?: string;
  borderBlockStartStyle?: string;
  borderBlockStartWidth?: string | number;
  borderBlockStyle?: string;
  borderBlockWidth?: string | number;
  borderBottom?: string;
  borderBottomColor?: string;
  borderBottomLeftRadius?: string | number;
  borderBottomRightRadius?: string | number;
  borderBottomStyle?: string;
  borderBottomWidth?: string | number;
  borderCollapse?: string;
  borderColor?: string;
  borderImage?: string;
  borderInline?: string;
  borderInlineColor?: string;
  borderInlineEnd?: string;
  borderInlineEndColor?: string;
  borderInlineEndStyle?: string;
  borderInlineEndWidth?: string | number;
  borderInlineStart?: string;
  borderInlineStartColor?: string;
  borderInlineStartStyle?: string;
  borderInlineStartWidth?: string | number;
  borderInlineStyle?: string;
  borderInlineWidth?: string | number;
  borderLeft?: string;
  borderLeftColor?: string;
  borderLeftStyle?: string;
  borderLeftWidth?: string | number;
  borderRadius?: string | number;
  borderRight?: string;
  borderRightColor?: string;
  borderRightStyle?: string;
  borderRightWidth?: string | number;
  borderSpacing?: string | number;
  borderStyle?: string;
  borderTop?: string;
  borderTopColor?: string;
  borderTopLeftRadius?: string | number;
  borderTopRightRadius?: string | number;
  borderTopStyle?: string;
  borderTopWidth?: string | number;
  borderWidth?: string | number;
  bottom?: string | number;
  boxShadow?: string;
  boxSizing?: string;
  breakAfter?: string;
  breakBefore?: string;
  breakInside?: string;
  captionSide?: string;
  caretColor?: string;
  clear?: string;
  clip?: string;
  clipPath?: string;
  color?: string;
  colorScheme?: string;
  columnCount?: string | number;
  columnFill?: string;
  columnGap?: string | number;
  columnRule?: string;
  columnRuleColor?: string;
  columnRuleStyle?: string;
  columnRuleWidth?: string | number;
  columnSpan?: string;
  columnWidth?: string | number;
  columns?: string;
  contain?: string;
  content?: string;
  counterIncrement?: string;
  counterReset?: string;
  cursor?: string;
  direction?: string;
  display?: string;
  emptyCells?: string;
  filter?: string;
  flex?: string | number;
  flexBasis?: string | number;
  flexDirection?: string;
  flexFlow?: string;
  flexGrow?: number;
  flexShrink?: number;
  flexWrap?: string;
  float?: string;
  font?: string;
  fontFamily?: string;
  fontFeatureSettings?: string;
  fontKerning?: string;
  fontSize?: string | number;
  fontSizeAdjust?: string | number;
  fontStretch?: string;
  fontStyle?: string;
  fontSynthesis?: string;
  fontVariant?: string;
  fontVariantCaps?: string;
  fontVariantNumeric?: string;
  fontVariationSettings?: string;
  fontWeight?: string | number;
  gap?: string | number;
  grid?: string;
  gridArea?: string;
  gridAutoColumns?: string;
  gridAutoFlow?: string;
  gridAutoRows?: string;
  gridColumn?: string;
  gridColumnEnd?: string | number;
  gridColumnStart?: string | number;
  gridRow?: string;
  gridRowEnd?: string | number;
  gridRowStart?: string | number;
  gridTemplate?: string;
  gridTemplateAreas?: string;
  gridTemplateColumns?: string;
  gridTemplateRows?: string;
  height?: string | number;
  hyphens?: string;
  imageRendering?: string;
  inlineSize?: string | number;
  inset?: string | number;
  insetBlock?: string | number;
  insetBlockEnd?: string | number;
  insetBlockStart?: string | number;
  insetInline?: string | number;
  insetInlineEnd?: string | number;
  insetInlineStart?: string | number;
  isolation?: string;
  justifyContent?: string;
  justifyItems?: string;
  justifySelf?: string;
  left?: string | number;
  letterSpacing?: string | number;
  lineBreak?: string;
  lineHeight?: string | number;
  listStyle?: string;
  listStyleImage?: string;
  listStylePosition?: string;
  listStyleType?: string;
  margin?: string | number;
  marginBlock?: string | number;
  marginBlockEnd?: string | number;
  marginBlockStart?: string | number;
  marginBottom?: string | number;
  marginInline?: string | number;
  marginInlineEnd?: string | number;
  marginInlineStart?: string | number;
  marginLeft?: string | number;
  marginRight?: string | number;
  marginTop?: string | number;
  maxHeight?: string | number;
  maxWidth?: string | number;
  minHeight?: string | number;
  minWidth?: string | number;
  mixBlendMode?: string;
  objectFit?: string;
  objectPosition?: string;
  opacity?: number | string;
  order?: number;
  outline?: string;
  outlineColor?: string;
  outlineOffset?: string | number;
  outlineStyle?: string;
  outlineWidth?: string | number;
  overflow?: string;
  overflowWrap?: string;
  overflowX?: string;
  overflowY?: string;
  overscrollBehavior?: string;
  overscrollBehaviorX?: string;
  overscrollBehaviorY?: string;
  padding?: string | number;
  paddingBlock?: string | number;
  paddingBlockEnd?: string | number;
  paddingBlockStart?: string | number;
  paddingBottom?: string | number;
  paddingInline?: string | number;
  paddingInlineEnd?: string | number;
  paddingInlineStart?: string | number;
  paddingLeft?: string | number;
  paddingRight?: string | number;
  paddingTop?: string | number;
  perspective?: string | number;
  perspectiveOrigin?: string;
  placeContent?: string;
  placeItems?: string;
  placeSelf?: string;
  pointerEvents?: string;
  position?: string;
  quotes?: string;
  resize?: string;
  right?: string | number;
  rotate?: string;
  rowGap?: string | number;
  scale?: string | number;
  scrollBehavior?: string;
  scrollMargin?: string | number;
  scrollMarginBottom?: string | number;
  scrollMarginLeft?: string | number;
  scrollMarginRight?: string | number;
  scrollMarginTop?: string | number;
  scrollPadding?: string | number;
  scrollPaddingBottom?: string | number;
  scrollPaddingLeft?: string | number;
  scrollPaddingRight?: string | number;
  scrollPaddingTop?: string | number;
  scrollSnapAlign?: string;
  scrollSnapStop?: string;
  scrollSnapType?: string;
  shapeOutside?: string;
  tabSize?: string | number;
  tableLayout?: string;
  textAlign?: string;
  textAlignLast?: string;
  textDecoration?: string;
  textDecorationColor?: string;
  textDecorationLine?: string;
  textDecorationStyle?: string;
  textDecorationThickness?: string | number;
  textIndent?: string | number;
  textOverflow?: string;
  textRendering?: string;
  textShadow?: string;
  textTransform?: string;
  textUnderlineOffset?: string | number;
  top?: string | number;
  touchAction?: string;
  transform?: string;
  transformBox?: string;
  transformOrigin?: string;
  transformStyle?: string;
  transition?: string;
  transitionDelay?: string;
  transitionDuration?: string;
  transitionProperty?: string;
  transitionTimingFunction?: string;
  unicodeBidi?: string;
  userSelect?: string;
  verticalAlign?: string | number;
  visibility?: string;
  whiteSpace?: string;
  width?: string | number;
  willChange?: string;
  wordBreak?: string;
  wordSpacing?: string | number;
  writingMode?: string;
  zIndex?: string | number;
  zoom?: string | number;
  /** CSS custom properties (variables), e.g. `'--primary-color': '#3498db'`. */
  [key: `--${string}`]: string | number | undefined;
}

// ---------------------------------------------------------------------------
// Event Handlers
// ---------------------------------------------------------------------------

/**
 * All DOM event handler props, automatically derived from
 * `HTMLElementEventMap`.
 *
 * Props follow the `on${Capitalize<eventName>}` naming convention used
 * throughout yielderact – for example:
 *  - `click`       → `onClick`
 *  - `keydown`     → `onKeydown`
 *  - `input`       → `onInput`
 *  - `mouseenter`  → `onMouseenter`
 */
export type EventHandlers = {
  [K in keyof HTMLElementEventMap as `on${Capitalize<string & K>}`]?: (
    event: SyntheticEvent<HTMLElementEventMap[K]>,
  ) => void;
};

// ---------------------------------------------------------------------------
// ARIA Attributes
// ---------------------------------------------------------------------------

/** WAI-ARIA attributes applicable to any HTML element. */
export interface AriaAttributes {
  'aria-activedescendant'?: string;
  'aria-atomic'?: boolean | 'false' | 'true';
  'aria-autocomplete'?: 'none' | 'inline' | 'list' | 'both';
  'aria-busy'?: boolean | 'false' | 'true';
  'aria-checked'?: boolean | 'false' | 'mixed' | 'true';
  'aria-colcount'?: number;
  'aria-colindex'?: number;
  'aria-colspan'?: number;
  'aria-controls'?: string;
  'aria-current'?: boolean | 'false' | 'true' | 'page' | 'step' | 'location' | 'date' | 'time';
  'aria-describedby'?: string;
  'aria-details'?: string;
  'aria-disabled'?: boolean | 'false' | 'true';
  'aria-dropeffect'?: 'none' | 'copy' | 'execute' | 'link' | 'move' | 'popup';
  'aria-errormessage'?: string;
  'aria-expanded'?: boolean | 'false' | 'true';
  'aria-flowto'?: string;
  'aria-grabbed'?: boolean | 'false' | 'true';
  'aria-haspopup'?: boolean | 'false' | 'true' | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog';
  'aria-hidden'?: boolean | 'false' | 'true';
  'aria-invalid'?: boolean | 'false' | 'true' | 'grammar' | 'spelling';
  'aria-keyshortcuts'?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-level'?: number;
  'aria-live'?: 'off' | 'assertive' | 'polite';
  'aria-modal'?: boolean | 'false' | 'true';
  'aria-multiline'?: boolean | 'false' | 'true';
  'aria-multiselectable'?: boolean | 'false' | 'true';
  'aria-orientation'?: 'horizontal' | 'vertical';
  'aria-owns'?: string;
  'aria-placeholder'?: string;
  'aria-posinset'?: number;
  'aria-pressed'?: boolean | 'false' | 'mixed' | 'true';
  'aria-readonly'?: boolean | 'false' | 'true';
  'aria-required'?: boolean | 'false' | 'true';
  'aria-roledescription'?: string;
  'aria-rowcount'?: number;
  'aria-rowindex'?: number;
  'aria-rowspan'?: number;
  'aria-selected'?: boolean | 'false' | 'true';
  'aria-setsize'?: number;
  'aria-sort'?: 'none' | 'ascending' | 'descending' | 'other';
  'aria-valuemax'?: number;
  'aria-valuemin'?: number;
  'aria-valuenow'?: number;
  'aria-valuetext'?: string;
}

// ---------------------------------------------------------------------------
// Base HTML attributes (common to every element)
// ---------------------------------------------------------------------------

/**
 * Attributes shared by **every** HTML element.
 *
 * Extends {@link AriaAttributes} and {@link EventHandlers} so that any
 * element can receive accessibility attributes and DOM event listeners.
 */
export interface HTMLAttributes extends AriaAttributes, EventHandlers {
  /** JSX reconciliation key – not rendered to the DOM. */
  key?: string | number;
  /** Nested children. */
  children?: Child | Child[];

  // ── Global HTML attributes ───────────────────────────────────────────────
  accessKey?: string;
  autoCapitalize?: string;
  autoFocus?: boolean;
  className?: string;
  contentEditable?: boolean | 'true' | 'false' | 'inherit' | 'plaintext-only';
  dir?: 'ltr' | 'rtl' | 'auto';
  draggable?: boolean;
  enterKeyHint?: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send';
  hidden?: boolean;
  id?: string;
  inert?: boolean;
  inputMode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url';
  is?: string;
  lang?: string;
  nonce?: string;
  popover?: string;
  role?: string;
  slot?: string;
  spellCheck?: boolean;
  style?: CSSProperties;
  tabIndex?: number;
  title?: string;
  translate?: 'yes' | 'no';

  /** Any `data-*` attribute. */
  [key: `data-${string}`]: string | number | boolean | undefined;
}

// ---------------------------------------------------------------------------
// Element-specific attribute interfaces
// ---------------------------------------------------------------------------

/** `<a>` – hyperlink */
export interface AnchorHTMLAttributes extends HTMLAttributes {
  download?: string | boolean;
  href?: string;
  hrefLang?: string;
  media?: string;
  ping?: string;
  referrerPolicy?: ReferrerPolicy;
  rel?: string;
  /** `string & object` keeps IDE autocomplete for the named values while still accepting any string. */
  target?: '_self' | '_blank' | '_parent' | '_top' | (string & object);
  type?: string;
}

/** `<area>` */
export interface AreaHTMLAttributes extends HTMLAttributes {
  alt?: string;
  coords?: string;
  download?: string | boolean;
  href?: string;
  ping?: string;
  referrerPolicy?: ReferrerPolicy;
  rel?: string;
  shape?: 'rect' | 'circle' | 'poly' | 'default';
  target?: string;
}

/** `<audio>` */
export interface AudioHTMLAttributes extends HTMLAttributes {
  autoPlay?: boolean;
  controls?: boolean;
  crossOrigin?: 'anonymous' | 'use-credentials';
  loop?: boolean;
  mediaGroup?: string;
  muted?: boolean;
  preload?: 'none' | 'metadata' | 'auto' | '';
  src?: string;
}

/** `<base>` */
export interface BaseHTMLAttributes extends HTMLAttributes {
  href?: string;
  target?: string;
}

/** `<blockquote>` / `<q>` */
export interface BlockquoteHTMLAttributes extends HTMLAttributes {
  cite?: string;
}

/** `<button>` */
export interface ButtonHTMLAttributes extends HTMLAttributes {
  autoFocus?: boolean;
  disabled?: boolean;
  form?: string;
  formAction?: string;
  formEncType?: string;
  formMethod?: string;
  formNoValidate?: boolean;
  formTarget?: string;
  name?: string;
  type?: 'submit' | 'reset' | 'button';
  value?: string | number;
}

/** `<canvas>` */
export interface CanvasHTMLAttributes extends HTMLAttributes {
  height?: string | number;
  width?: string | number;
}

/** `<col>` / `<colgroup>` */
export interface ColHTMLAttributes extends HTMLAttributes {
  span?: number;
  width?: string | number;
}

/** `<data>` */
export interface DataHTMLAttributes extends HTMLAttributes {
  value?: string | number;
}

/** `<del>` / `<ins>` */
export interface ModHTMLAttributes extends HTMLAttributes {
  cite?: string;
  dateTime?: string;
}

/** `<details>` */
export interface DetailsHTMLAttributes extends HTMLAttributes {
  open?: boolean;
}

/** `<dialog>` */
export interface DialogHTMLAttributes extends HTMLAttributes {
  open?: boolean;
}

/** `<embed>` */
export interface EmbedHTMLAttributes extends HTMLAttributes {
  height?: string | number;
  src?: string;
  type?: string;
  width?: string | number;
}

/** `<fieldset>` */
export interface FieldsetHTMLAttributes extends HTMLAttributes {
  disabled?: boolean;
  form?: string;
  name?: string;
}

/** `<form>` */
export interface FormHTMLAttributes extends HTMLAttributes {
  acceptCharset?: string;
  action?: string;
  autoComplete?: string;
  encType?: string;
  method?: 'get' | 'post' | 'dialog';
  name?: string;
  noValidate?: boolean;
  rel?: string;
  target?: string;
}

/** `<html>` */
export interface HtmlHTMLAttributes extends HTMLAttributes {
  manifest?: string;
}

/** `<iframe>` */
export interface IframeHTMLAttributes extends HTMLAttributes {
  allow?: string;
  allowFullScreen?: boolean;
  allowTransparency?: boolean;
  frameBorder?: string | number;
  height?: string | number;
  loading?: 'eager' | 'lazy';
  name?: string;
  referrerPolicy?: ReferrerPolicy;
  sandbox?: string;
  scrolling?: string;
  seamless?: boolean;
  src?: string;
  srcDoc?: string;
  title?: string;
  width?: string | number;
}

/** `<img>` */
export interface ImgHTMLAttributes extends HTMLAttributes {
  alt?: string;
  crossOrigin?: 'anonymous' | 'use-credentials';
  decoding?: 'async' | 'auto' | 'sync';
  fetchPriority?: 'high' | 'low' | 'auto';
  height?: string | number;
  loading?: 'eager' | 'lazy';
  referrerPolicy?: ReferrerPolicy;
  sizes?: string;
  src?: string;
  srcSet?: string;
  useMap?: string;
  width?: string | number;
}

/** `<input>` */
export interface InputHTMLAttributes extends HTMLAttributes {
  accept?: string;
  alt?: string;
  autoComplete?: string;
  capture?: boolean | 'user' | 'environment';
  checked?: boolean;
  defaultChecked?: boolean;
  defaultValue?: string | number;
  dirName?: string;
  disabled?: boolean;
  form?: string;
  formAction?: string;
  formEncType?: string;
  formMethod?: string;
  formNoValidate?: boolean;
  formTarget?: string;
  height?: string | number;
  list?: string;
  max?: string | number;
  maxLength?: number;
  min?: string | number;
  minLength?: number;
  multiple?: boolean;
  name?: string;
  pattern?: string;
  placeholder?: string;
  readOnly?: boolean;
  required?: boolean;
  size?: number;
  src?: string;
  step?: string | number;
  type?:
    | 'button'
    | 'checkbox'
    | 'color'
    | 'date'
    | 'datetime-local'
    | 'email'
    | 'file'
    | 'hidden'
    | 'image'
    | 'month'
    | 'number'
    | 'password'
    | 'radio'
    | 'range'
    | 'reset'
    | 'search'
    | 'submit'
    | 'tel'
    | 'text'
    | 'time'
    | 'url'
    | 'week';
  value?: string | number;
  width?: string | number;
}

/** `<label>` */
export interface LabelHTMLAttributes extends HTMLAttributes {
  form?: string;
  /** Maps to the `for` HTML attribute. */
  htmlFor?: string;
}

/** `<li>` */
export interface LiHTMLAttributes extends HTMLAttributes {
  value?: number;
}

/** `<link>` */
export interface LinkHTMLAttributes extends HTMLAttributes {
  as?: string;
  crossOrigin?: 'anonymous' | 'use-credentials';
  fetchPriority?: 'high' | 'low' | 'auto';
  href?: string;
  hrefLang?: string;
  imageSizes?: string;
  imageSrcSet?: string;
  integrity?: string;
  media?: string;
  referrerPolicy?: ReferrerPolicy;
  rel?: string;
  sizes?: string;
  type?: string;
}

/** `<map>` */
export interface MapHTMLAttributes extends HTMLAttributes {
  name?: string;
}

/** `<meta>` */
export interface MetaHTMLAttributes extends HTMLAttributes {
  charSet?: string;
  content?: string;
  httpEquiv?: string;
  media?: string;
  name?: string;
}

/** `<meter>` */
export interface MeterHTMLAttributes extends HTMLAttributes {
  form?: string;
  high?: number;
  low?: number;
  max?: number;
  min?: number;
  optimum?: number;
  value?: string | number;
}

/** `<object>` */
export interface ObjectHTMLAttributes extends HTMLAttributes {
  classID?: string;
  data?: string;
  form?: string;
  height?: string | number;
  name?: string;
  type?: string;
  useMap?: string;
  width?: string | number;
}

/** `<ol>` */
export interface OlHTMLAttributes extends HTMLAttributes {
  reversed?: boolean;
  start?: number;
  type?: '1' | 'a' | 'A' | 'i' | 'I';
}

/** `<optgroup>` */
export interface OptgroupHTMLAttributes extends HTMLAttributes {
  disabled?: boolean;
  label?: string;
}

/** `<option>` */
export interface OptionHTMLAttributes extends HTMLAttributes {
  disabled?: boolean;
  label?: string;
  selected?: boolean;
  value?: string | number;
}

/** `<output>` */
export interface OutputHTMLAttributes extends HTMLAttributes {
  form?: string;
  htmlFor?: string;
  name?: string;
}

/** `<param>` */
export interface ParamHTMLAttributes extends HTMLAttributes {
  name?: string;
  value?: string;
}

/** `<progress>` */
export interface ProgressHTMLAttributes extends HTMLAttributes {
  max?: number;
  value?: string | number;
}

/** `<script>` */
export interface ScriptHTMLAttributes extends HTMLAttributes {
  async?: boolean;
  charSet?: string;
  crossOrigin?: string;
  defer?: boolean;
  integrity?: string;
  noModule?: boolean;
  referrerPolicy?: ReferrerPolicy;
  src?: string;
  type?: string;
}

/** `<select>` */
export interface SelectHTMLAttributes extends HTMLAttributes {
  autoComplete?: string;
  disabled?: boolean;
  form?: string;
  multiple?: boolean;
  name?: string;
  required?: boolean;
  size?: number;
  value?: string | number;
}

/** `<slot>` */
export interface SlotHTMLAttributes extends HTMLAttributes {
  name?: string;
}

/** `<source>` */
export interface SourceHTMLAttributes extends HTMLAttributes {
  height?: string | number;
  media?: string;
  sizes?: string;
  src?: string;
  srcSet?: string;
  type?: string;
  width?: string | number;
}

/** `<style>` */
export interface StyleHTMLAttributes extends HTMLAttributes {
  media?: string;
  scoped?: boolean;
  type?: string;
}

/** `<table>` */
export interface TableHTMLAttributes extends HTMLAttributes {
  cellPadding?: string | number;
  cellSpacing?: string | number;
  summary?: string;
  width?: string | number;
}

/** `<td>` */
export interface TdHTMLAttributes extends HTMLAttributes {
  abbr?: string;
  align?: 'left' | 'center' | 'right' | 'justify' | 'char';
  colSpan?: number;
  headers?: string;
  height?: string | number;
  rowSpan?: number;
  scope?: string;
  valign?: 'top' | 'middle' | 'bottom' | 'baseline';
  width?: string | number;
}

/** `<textarea>` */
export interface TextareaHTMLAttributes extends HTMLAttributes {
  autoComplete?: string;
  cols?: number;
  dirName?: string;
  disabled?: boolean;
  form?: string;
  maxLength?: number;
  minLength?: number;
  name?: string;
  placeholder?: string;
  readOnly?: boolean;
  required?: boolean;
  rows?: number;
  value?: string;
  wrap?: string;
}

/** `<th>` */
export interface ThHTMLAttributes extends HTMLAttributes {
  abbr?: string;
  align?: 'left' | 'center' | 'right' | 'justify' | 'char';
  colSpan?: number;
  headers?: string;
  rowSpan?: number;
  scope?: 'col' | 'row' | 'colgroup' | 'rowgroup';
}

/** `<time>` */
export interface TimeHTMLAttributes extends HTMLAttributes {
  dateTime?: string;
}

/** `<track>` */
export interface TrackHTMLAttributes extends HTMLAttributes {
  default?: boolean;
  kind?: 'subtitles' | 'captions' | 'descriptions' | 'chapters' | 'metadata';
  label?: string;
  src?: string;
  srcLang?: string;
}

/** `<video>` */
export interface VideoHTMLAttributes extends HTMLAttributes {
  autoPlay?: boolean;
  controls?: boolean;
  crossOrigin?: 'anonymous' | 'use-credentials';
  disablePictureInPicture?: boolean;
  disableRemotePlayback?: boolean;
  height?: string | number;
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  poster?: string;
  preload?: 'none' | 'metadata' | 'auto' | '';
  src?: string;
  width?: string | number;
}

// ---------------------------------------------------------------------------
// SVG Attributes
// ---------------------------------------------------------------------------

/** Presentation attributes shared by all SVG elements. */
export interface SVGAttributes extends AriaAttributes, EventHandlers {
  key?: string | number;
  children?: Child | Child[];
  className?: string;
  id?: string;
  style?: CSSProperties;
  tabIndex?: number;

  // Core SVG attributes
  color?: string;
  fill?: string;
  fillOpacity?: string | number;
  fillRule?: 'nonzero' | 'evenodd';
  filter?: string;
  mask?: string;
  opacity?: string | number;
  stroke?: string;
  strokeDasharray?: string | number;
  strokeDashoffset?: string | number;
  strokeLinecap?: 'butt' | 'round' | 'square' | 'inherit';
  strokeLinejoin?: 'miter' | 'round' | 'bevel' | 'inherit';
  strokeMiterlimit?: string | number;
  strokeOpacity?: string | number;
  strokeWidth?: string | number;
  transform?: string;
  vectorEffect?: string;
  visibility?: string;

  // Presentation
  clipPath?: string;
  clipRule?: 'nonzero' | 'evenodd';
  colorInterpolation?: string;
  colorRendering?: string;
  cursor?: string;
  dominantBaseline?: string;
  fontFamily?: string;
  fontSize?: string | number;
  fontSizeAdjust?: string | number;
  fontStretch?: string;
  fontStyle?: string;
  fontVariant?: string;
  fontWeight?: string | number;
  letterSpacing?: string | number;
  overflow?: string;
  pointerEvents?: string;
  shapeRendering?: string;
  stopColor?: string;
  stopOpacity?: string | number;
  textAnchor?: string;
  textDecoration?: string;
  textRendering?: string;
  unicodeBidi?: string;
  wordSpacing?: string | number;
  writingMode?: string;

  [key: `data-${string}`]: string | number | boolean | undefined;
}

/** `<svg>` root element */
export interface SvgHTMLAttributes extends SVGAttributes {
  height?: string | number;
  preserveAspectRatio?: string;
  viewBox?: string;
  width?: string | number;
  x?: string | number;
  xmlns?: string;
  y?: string | number;
}

/** `<path>` */
export interface PathSVGAttributes extends SVGAttributes {
  d?: string;
  pathLength?: number;
}

/** `<circle>` */
export interface CircleSVGAttributes extends SVGAttributes {
  cx?: string | number;
  cy?: string | number;
  r?: string | number;
  pathLength?: number;
}

/** `<ellipse>` */
export interface EllipseSVGAttributes extends SVGAttributes {
  cx?: string | number;
  cy?: string | number;
  rx?: string | number;
  ry?: string | number;
  pathLength?: number;
}

/** `<rect>` */
export interface RectSVGAttributes extends SVGAttributes {
  height?: string | number;
  pathLength?: number;
  rx?: string | number;
  ry?: string | number;
  width?: string | number;
  x?: string | number;
  y?: string | number;
}

/** `<line>` */
export interface LineSVGAttributes extends SVGAttributes {
  pathLength?: number;
  x1?: string | number;
  x2?: string | number;
  y1?: string | number;
  y2?: string | number;
}

/** `<polyline>` / `<polygon>` */
export interface PolylineSVGAttributes extends SVGAttributes {
  pathLength?: number;
  points?: string;
}

/** `<text>` */
export interface TextSVGAttributes extends SVGAttributes {
  dx?: string | number;
  dy?: string | number;
  lengthAdjust?: 'spacing' | 'spacingAndGlyphs';
  rotate?: string | number;
  textLength?: string | number;
  x?: string | number;
  y?: string | number;
}

/** `<tspan>` */
export interface TSpanSVGAttributes extends SVGAttributes {
  dx?: string | number;
  dy?: string | number;
  lengthAdjust?: 'spacing' | 'spacingAndGlyphs';
  rotate?: string | number;
  textLength?: string | number;
  x?: string | number;
  y?: string | number;
}

/** `<use>` */
export interface UseSVGAttributes extends SVGAttributes {
  href?: string;
  height?: string | number;
  width?: string | number;
  x?: string | number;
  y?: string | number;
}

/** `<symbol>` */
export interface SymbolSVGAttributes extends SVGAttributes {
  height?: string | number;
  preserveAspectRatio?: string;
  refX?: string | number;
  refY?: string | number;
  viewBox?: string;
  width?: string | number;
  x?: string | number;
  y?: string | number;
}

/** `<pattern>` */
export interface PatternSVGAttributes extends SVGAttributes {
  height?: string | number;
  href?: string;
  patternContentUnits?: string;
  patternTransform?: string;
  patternUnits?: string;
  preserveAspectRatio?: string;
  viewBox?: string;
  width?: string | number;
  x?: string | number;
  y?: string | number;
}

/** `<linearGradient>` */
export interface LinearGradientSVGAttributes extends SVGAttributes {
  gradientTransform?: string;
  gradientUnits?: string;
  href?: string;
  spreadMethod?: 'pad' | 'reflect' | 'repeat';
  x1?: string | number;
  x2?: string | number;
  y1?: string | number;
  y2?: string | number;
}

/** `<radialGradient>` */
export interface RadialGradientSVGAttributes extends SVGAttributes {
  cx?: string | number;
  cy?: string | number;
  fr?: string | number;
  fx?: string | number;
  fy?: string | number;
  gradientTransform?: string;
  gradientUnits?: string;
  href?: string;
  r?: string | number;
  spreadMethod?: 'pad' | 'reflect' | 'repeat';
}

/** `<stop>` */
export interface StopSVGAttributes extends SVGAttributes {
  offset?: string | number;
}

/** `<clipPath>` */
export interface ClipPathSVGAttributes extends SVGAttributes {
  clipPathUnits?: 'userSpaceOnUse' | 'objectBoundingBox';
}

/** `<mask>` */
export interface MaskSVGAttributes extends SVGAttributes {
  height?: string | number;
  maskContentUnits?: string;
  maskUnits?: string;
  width?: string | number;
  x?: string | number;
  y?: string | number;
}

/** `<filter>` */
export interface FilterSVGAttributes extends SVGAttributes {
  filterUnits?: string;
  height?: string | number;
  primitiveUnits?: string;
  width?: string | number;
  x?: string | number;
  y?: string | number;
}

/** `<image>` (SVG) */
export interface ImageSVGAttributes extends SVGAttributes {
  crossOrigin?: 'anonymous' | 'use-credentials';
  decoding?: 'async' | 'auto' | 'sync';
  height?: string | number;
  href?: string;
  preserveAspectRatio?: string;
  width?: string | number;
  x?: string | number;
  y?: string | number;
}

// ---------------------------------------------------------------------------
// IntrinsicElements – the complete valid HTML / SVG element map
// ---------------------------------------------------------------------------

/**
 * Maps every valid HTML and common SVG element name to its typed props.
 *
 * Using an element name that is not in this map (e.g. `<foo>`) is a
 * TypeScript compile-time error.
 */
export interface IntrinsicElements {
  // ── Document structure ───────────────────────────────────────────────────
  html: HtmlHTMLAttributes;
  head: HTMLAttributes;
  body: HTMLAttributes;

  // ── Metadata ─────────────────────────────────────────────────────────────
  base: BaseHTMLAttributes;
  link: LinkHTMLAttributes;
  meta: MetaHTMLAttributes;
  noscript: HTMLAttributes;
  script: ScriptHTMLAttributes;
  style: StyleHTMLAttributes;
  title: HTMLAttributes;

  // ── Sectioning ───────────────────────────────────────────────────────────
  address: HTMLAttributes;
  article: HTMLAttributes;
  aside: HTMLAttributes;
  footer: HTMLAttributes;
  header: HTMLAttributes;
  hgroup: HTMLAttributes;
  main: HTMLAttributes;
  nav: HTMLAttributes;
  section: HTMLAttributes;

  // ── Headings ─────────────────────────────────────────────────────────────
  h1: HTMLAttributes;
  h2: HTMLAttributes;
  h3: HTMLAttributes;
  h4: HTMLAttributes;
  h5: HTMLAttributes;
  h6: HTMLAttributes;

  // ── Text content ─────────────────────────────────────────────────────────
  blockquote: BlockquoteHTMLAttributes;
  dd: HTMLAttributes;
  div: HTMLAttributes;
  dl: HTMLAttributes;
  dt: HTMLAttributes;
  figcaption: HTMLAttributes;
  figure: HTMLAttributes;
  hr: HTMLAttributes;
  li: LiHTMLAttributes;
  menu: HTMLAttributes;
  ol: OlHTMLAttributes;
  p: HTMLAttributes;
  pre: HTMLAttributes;
  ul: HTMLAttributes;

  // ── Inline text ──────────────────────────────────────────────────────────
  a: AnchorHTMLAttributes;
  abbr: HTMLAttributes;
  b: HTMLAttributes;
  bdi: HTMLAttributes;
  bdo: HTMLAttributes;
  br: HTMLAttributes;
  cite: HTMLAttributes;
  code: HTMLAttributes;
  data: DataHTMLAttributes;
  dfn: HTMLAttributes;
  em: HTMLAttributes;
  i: HTMLAttributes;
  kbd: HTMLAttributes;
  mark: HTMLAttributes;
  q: BlockquoteHTMLAttributes;
  rp: HTMLAttributes;
  rt: HTMLAttributes;
  ruby: HTMLAttributes;
  s: HTMLAttributes;
  samp: HTMLAttributes;
  small: HTMLAttributes;
  span: HTMLAttributes;
  strong: HTMLAttributes;
  sub: HTMLAttributes;
  sup: HTMLAttributes;
  time: TimeHTMLAttributes;
  u: HTMLAttributes;
  var: HTMLAttributes;
  wbr: HTMLAttributes;

  // ── Edits ────────────────────────────────────────────────────────────────
  del: ModHTMLAttributes;
  ins: ModHTMLAttributes;

  // ── Embedded content ─────────────────────────────────────────────────────
  area: AreaHTMLAttributes;
  audio: AudioHTMLAttributes;
  canvas: CanvasHTMLAttributes;
  embed: EmbedHTMLAttributes;
  iframe: IframeHTMLAttributes;
  img: ImgHTMLAttributes;
  map: MapHTMLAttributes;
  object: ObjectHTMLAttributes;
  param: ParamHTMLAttributes;
  picture: HTMLAttributes;
  source: SourceHTMLAttributes;
  track: TrackHTMLAttributes;
  video: VideoHTMLAttributes;

  // ── Tables ───────────────────────────────────────────────────────────────
  caption: HTMLAttributes;
  col: ColHTMLAttributes;
  colgroup: ColHTMLAttributes;
  table: TableHTMLAttributes;
  tbody: HTMLAttributes;
  td: TdHTMLAttributes;
  tfoot: HTMLAttributes;
  th: ThHTMLAttributes;
  thead: HTMLAttributes;
  tr: HTMLAttributes;

  // ── Forms ────────────────────────────────────────────────────────────────
  button: ButtonHTMLAttributes;
  datalist: HTMLAttributes;
  fieldset: FieldsetHTMLAttributes;
  form: FormHTMLAttributes;
  input: InputHTMLAttributes;
  label: LabelHTMLAttributes;
  legend: HTMLAttributes;
  meter: MeterHTMLAttributes;
  optgroup: OptgroupHTMLAttributes;
  option: OptionHTMLAttributes;
  output: OutputHTMLAttributes;
  progress: ProgressHTMLAttributes;
  select: SelectHTMLAttributes;
  textarea: TextareaHTMLAttributes;

  // ── Interactive ──────────────────────────────────────────────────────────
  details: DetailsHTMLAttributes;
  dialog: DialogHTMLAttributes;
  summary: HTMLAttributes;

  // ── Web components ───────────────────────────────────────────────────────
  slot: SlotHTMLAttributes;
  template: HTMLAttributes;

  // ── SVG ──────────────────────────────────────────────────────────────────
  svg: SvgHTMLAttributes;
  animate: SVGAttributes;
  animateMotion: SVGAttributes;
  animateTransform: SVGAttributes;
  circle: CircleSVGAttributes;
  clipPath: ClipPathSVGAttributes;
  defs: SVGAttributes;
  desc: SVGAttributes;
  ellipse: EllipseSVGAttributes;
  feBlend: SVGAttributes;
  feColorMatrix: SVGAttributes;
  feComponentTransfer: SVGAttributes;
  feComposite: SVGAttributes;
  feConvolveMatrix: SVGAttributes;
  feDiffuseLighting: SVGAttributes;
  feDisplacementMap: SVGAttributes;
  feDistantLight: SVGAttributes;
  feDropShadow: SVGAttributes;
  feFlood: SVGAttributes;
  feFuncA: SVGAttributes;
  feFuncB: SVGAttributes;
  feFuncG: SVGAttributes;
  feFuncR: SVGAttributes;
  feGaussianBlur: SVGAttributes;
  feImage: SVGAttributes;
  feMerge: SVGAttributes;
  feMergeNode: SVGAttributes;
  feMorphology: SVGAttributes;
  feOffset: SVGAttributes;
  fePointLight: SVGAttributes;
  feSpecularLighting: SVGAttributes;
  feSpotLight: SVGAttributes;
  feTile: SVGAttributes;
  feTurbulence: SVGAttributes;
  filter: FilterSVGAttributes;
  foreignObject: SVGAttributes;
  g: SVGAttributes;
  image: ImageSVGAttributes;
  line: LineSVGAttributes;
  linearGradient: LinearGradientSVGAttributes;
  marker: SVGAttributes;
  mask: MaskSVGAttributes;
  metadata: SVGAttributes;
  mpath: SVGAttributes;
  path: PathSVGAttributes;
  pattern: PatternSVGAttributes;
  polygon: PolylineSVGAttributes;
  polyline: PolylineSVGAttributes;
  radialGradient: RadialGradientSVGAttributes;
  rect: RectSVGAttributes;
  stop: StopSVGAttributes;
  switch: SVGAttributes;
  symbol: SymbolSVGAttributes;
  text: TextSVGAttributes;
  textPath: SVGAttributes;
  tspan: TSpanSVGAttributes;
  use: UseSVGAttributes;
  view: SVGAttributes;
}
