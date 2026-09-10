/**
 * JSX type definitions for yract.
 *
 * Provides strongly-typed props for every standard HTML and SVG element,
 * keeping the developer experience close to TypeScript + React while
 * remaining framework-agnostic.
 *
 * @module jsx-types
 */
import type { SyntheticEvent } from "./events";
import type { Children, FrameworkProps } from "./jsx";
import { WeakRefLike } from "./render/element-props";

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
  alignmentBaseline?: string;
  all?: string;
  anchorName?: string;
  anchorScope?: string;
  animation?: string;
  animationComposition?: string;
  animationDelay?: string;
  animationDirection?: string;
  animationDuration?: string;
  animationFillMode?: string;
  animationIterationCount?: string | number;
  animationName?: string;
  animationPlayState?: string;
  animationRange?: string;
  animationRangeEnd?: string;
  animationRangeStart?: string;
  animationTimeline?: string;
  animationTimingFunction?: string;
  animationTrigger?: string;
  appearance?: string;
  aspectRatio?: string | number;
  backdropFilter?: string;
  backfaceVisibility?: string;
  background?: string;
  backgroundAttachment?: string;
  backgroundBlendMode?: string;
  backgroundClip?: string;
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundOrigin?: string;
  backgroundPosition?: string;
  backgroundPositionX?: string;
  backgroundPositionY?: string;
  backgroundRepeat?: string;
  backgroundSize?: string;
  baselineShift?: string;
  baselineSource?: string;
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
  borderEndEndRadius?: string | number;
  borderEndStartRadius?: string | number;
  borderImage?: string;
  borderImageOutset?: string | number;
  borderImageRepeat?: string;
  borderImageSlice?: string | number;
  borderImageSource?: string;
  borderImageWidth?: string | number;
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
  borderShape?: string;
  borderSpacing?: string | number;
  borderStartEndRadius?: string | number;
  borderStartStartRadius?: string | number;
  borderStyle?: string;
  borderTop?: string;
  borderTopColor?: string;
  borderTopLeftRadius?: string | number;
  borderTopRightRadius?: string | number;
  borderTopStyle?: string;
  borderTopWidth?: string | number;
  borderWidth?: string | number;
  bottom?: string | number;
  boxDecorationBreak?: string;
  boxShadow?: string;
  boxSizing?: string;
  breakAfter?: string;
  breakBefore?: string;
  breakInside?: string;
  captionSide?: string;
  caretAnimation?: string;
  caretColor?: string;
  caretShape?: string;
  clear?: string;
  clip?: string;
  clipPath?: string;
  clipRule?: string;
  color?: string;
  colorInterpolation?: string;
  colorInterpolationFilters?: string;
  colorScheme?: string;
  columnCount?: string | number;
  columnFill?: string;
  columnGap?: string | number;
  columnHeight?: string | number;
  columnRule?: string;
  columnRuleColor?: string;
  columnRuleStyle?: string;
  columnRuleWidth?: string | number;
  columnSpan?: string;
  columnWidth?: string | number;
  columnWrap?: string;
  columns?: string;
  contain?: string;
  containIntrinsicBlockSize?: string | number;
  containIntrinsicHeight?: string | number;
  containIntrinsicInlineSize?: string | number;
  containIntrinsicSize?: string | number;
  containIntrinsicWidth?: string | number;
  container?: string;
  containerName?: string;
  containerType?: string;
  content?: string;
  contentVisibility?: string;
  cornerBlockEndShape?: string;
  cornerBlockStartShape?: string;
  cornerBottomLeftShape?: string;
  cornerBottomRightShape?: string;
  cornerBottomShape?: string;
  cornerEndEndShape?: string;
  cornerEndStartShape?: string;
  cornerInlineEndShape?: string;
  cornerInlineStartShape?: string;
  cornerLeftShape?: string;
  cornerRightShape?: string;
  cornerShape?: string;
  cornerStartEndShape?: string;
  cornerStartStartShape?: string;
  cornerTopLeftShape?: string;
  cornerTopRightShape?: string;
  cornerTopShape?: string;
  counterIncrement?: string;
  counterReset?: string;
  counterSet?: string;
  cursor?: string;
  cx?: string | number;
  cy?: string | number;
  d?: string;
  direction?: string;
  display?: string;
  dominantBaseline?: string;
  dynamicRangeLimit?: string;
  emptyCells?: string;
  fieldSizing?: string;
  fill?: string;
  fillOpacity?: string | number;
  fillRule?: string;
  filter?: string;
  flex?: string | number;
  flexBasis?: string | number;
  flexDirection?: string;
  flexFlow?: string;
  flexGrow?: number;
  flexShrink?: number;
  flexWrap?: string;
  float?: string;
  floodColor?: string;
  floodOpacity?: string | number;
  font?: string;
  fontFamily?: string;
  fontFeatureSettings?: string;
  fontKerning?: string;
  fontLanguageOverride?: string;
  fontOpticalSizing?: string;
  fontPalette?: string;
  fontSize?: string | number;
  fontSizeAdjust?: string | number;
  fontStretch?: string;
  fontStyle?: string;
  fontSynthesis?: string;
  fontSynthesisSmallCaps?: string;
  fontSynthesisStyle?: string;
  fontSynthesisWeight?: string;
  fontVariant?: string;
  fontVariantAlternates?: string;
  fontVariantCaps?: string;
  fontVariantEastAsian?: string;
  fontVariantEmoji?: string;
  fontVariantLigatures?: string;
  fontVariantNumeric?: string;
  fontVariantPosition?: string;
  fontVariationSettings?: string;
  fontWeight?: string | number;
  forcedColorAdjust?: string;
  gap?: string | number;
  grid?: string;
  gridArea?: string;
  gridAutoColumns?: string;
  gridAutoFlow?: string;
  gridAutoRows?: string;
  gridColumn?: string;
  gridColumnEnd?: string | number;
  gridColumnGap?: string | number;
  gridColumnStart?: string | number;
  gridGap?: string | number;
  gridRow?: string;
  gridRowEnd?: string | number;
  gridRowGap?: string | number;
  gridRowStart?: string | number;
  gridTemplate?: string;
  gridTemplateAreas?: string;
  gridTemplateColumns?: string;
  gridTemplateRows?: string;
  height?: string | number;
  hyphenateCharacter?: string;
  hyphenateLimitChars?: string | number;
  hyphens?: string;
  imageOrientation?: string;
  imageRendering?: string;
  initialLetter?: string | number;
  inlineSize?: string | number;
  inset?: string | number;
  insetBlock?: string | number;
  insetBlockEnd?: string | number;
  insetBlockStart?: string | number;
  insetInline?: string | number;
  insetInlineEnd?: string | number;
  insetInlineStart?: string | number;
  interactivity?: string;
  interestDelay?: string;
  interestDelayEnd?: string;
  interestDelayStart?: string;
  interpolateSize?: string;
  isolation?: string;
  justifyContent?: string;
  justifyItems?: string;
  justifySelf?: string;
  left?: string | number;
  letterSpacing?: string | number;
  lightingColor?: string;
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
  marker?: string;
  markerEnd?: string;
  markerMid?: string;
  markerStart?: string;
  mask?: string;
  maskClip?: string;
  maskComposite?: string;
  maskImage?: string;
  maskMode?: string;
  maskOrigin?: string;
  maskPosition?: string;
  maskRepeat?: string;
  maskSize?: string;
  maskType?: string;
  mathDepth?: string | number;
  mathShift?: string;
  mathStyle?: string;
  maxBlockSize?: string | number;
  maxHeight?: string | number;
  maxInlineSize?: string | number;
  maxWidth?: string | number;
  minBlockSize?: string | number;
  minHeight?: string | number;
  minInlineSize?: string | number;
  minWidth?: string | number;
  mixBlendMode?: string;
  objectFit?: string;
  objectPosition?: string;
  offset?: string;
  offsetAnchor?: string;
  offsetDistance?: string | number;
  offsetPath?: string;
  offsetPosition?: string;
  offsetRotate?: string;
  opacity?: number | string;
  order?: number;
  orphans?: string | number;
  outline?: string;
  outlineColor?: string;
  outlineOffset?: string | number;
  outlineStyle?: string;
  outlineWidth?: string | number;
  overflow?: string;
  overflowAnchor?: string;
  overflowBlock?: string;
  overflowClipMargin?: string | number;
  overflowInline?: string;
  overflowWrap?: string;
  overflowX?: string;
  overflowY?: string;
  overlay?: string;
  overscrollBehavior?: string;
  overscrollBehaviorBlock?: string;
  overscrollBehaviorInline?: string;
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
  page?: string;
  pageBreakAfter?: string;
  pageBreakBefore?: string;
  pageBreakInside?: string;
  paintOrder?: string;
  perspective?: string | number;
  perspectiveOrigin?: string;
  placeContent?: string;
  placeItems?: string;
  placeSelf?: string;
  pointerEvents?: string;
  position?: string;
  positionAnchor?: string;
  positionArea?: string;
  positionTry?: string;
  positionTryFallbacks?: string;
  positionTryOrder?: string;
  positionVisibility?: string;
  printColorAdjust?: string;
  quotes?: string;
  r?: string | number;
  readingFlow?: string;
  readingOrder?: string;
  resize?: string;
  right?: string | number;
  rotate?: string;
  rowGap?: string | number;
  rubyAlign?: string;
  rubyPosition?: string;
  rx?: string | number;
  ry?: string | number;
  scale?: string | number;
  scrollBehavior?: string;
  scrollInitialTarget?: string;
  scrollMargin?: string | number;
  scrollMarginBlock?: string | number;
  scrollMarginBlockEnd?: string | number;
  scrollMarginBlockStart?: string | number;
  scrollMarginBottom?: string | number;
  scrollMarginInline?: string | number;
  scrollMarginInlineEnd?: string | number;
  scrollMarginInlineStart?: string | number;
  scrollMarginLeft?: string | number;
  scrollMarginRight?: string | number;
  scrollMarginTop?: string | number;
  scrollMarkerGroup?: string;
  scrollPadding?: string | number;
  scrollPaddingBlock?: string | number;
  scrollPaddingBlockEnd?: string | number;
  scrollPaddingBlockStart?: string | number;
  scrollPaddingBottom?: string | number;
  scrollPaddingInline?: string | number;
  scrollPaddingInlineEnd?: string | number;
  scrollPaddingInlineStart?: string | number;
  scrollPaddingLeft?: string | number;
  scrollPaddingRight?: string | number;
  scrollPaddingTop?: string | number;
  scrollSnapAlign?: string;
  scrollSnapStop?: string;
  scrollSnapType?: string;
  scrollTargetGroup?: string;
  scrollTimeline?: string;
  scrollTimelineAxis?: string;
  scrollTimelineName?: string;
  scrollbarColor?: string;
  scrollbarGutter?: string;
  scrollbarWidth?: string;
  shapeImageThreshold?: string | number;
  shapeMargin?: string | number;
  shapeOutside?: string;
  shapeRendering?: string;
  stopColor?: string;
  stopOpacity?: string | number;
  stroke?: string;
  strokeDasharray?: string;
  strokeDashoffset?: string | number;
  strokeLinecap?: string;
  strokeLinejoin?: string;
  strokeMiterlimit?: string | number;
  strokeOpacity?: string | number;
  strokeWidth?: string | number;
  tabSize?: string | number;
  tableLayout?: string;
  textAlign?: string;
  textAlignLast?: string;
  textAnchor?: string;
  textAutospace?: string;
  textBox?: string;
  textBoxEdge?: string;
  textBoxTrim?: string;
  textCombineUpright?: string;
  textDecoration?: string;
  textDecorationColor?: string;
  textDecorationLine?: string;
  textDecorationSkipInk?: string;
  textDecorationStyle?: string;
  textDecorationThickness?: string | number;
  textEmphasis?: string;
  textEmphasisColor?: string;
  textEmphasisPosition?: string;
  textEmphasisStyle?: string;
  textIndent?: string | number;
  textJustify?: string;
  textOrientation?: string;
  textOverflow?: string;
  textRendering?: string;
  textShadow?: string;
  textSizeAdjust?: string;
  textSpacingTrim?: string;
  textTransform?: string;
  textUnderlineOffset?: string | number;
  textUnderlinePosition?: string;
  textWrap?: string;
  textWrapMode?: string;
  textWrapStyle?: string;
  timelineScope?: string;
  timelineTrigger?: string;
  timelineTriggerActivationRange?: string;
  timelineTriggerActivationRangeEnd?: string;
  timelineTriggerActivationRangeStart?: string;
  timelineTriggerActiveRange?: string;
  timelineTriggerActiveRangeEnd?: string;
  timelineTriggerActiveRangeStart?: string;
  timelineTriggerName?: string;
  timelineTriggerSource?: string;
  top?: string | number;
  touchAction?: string;
  transform?: string;
  transformBox?: string;
  transformOrigin?: string;
  transformStyle?: string;
  transition?: string;
  transitionBehavior?: string;
  transitionDelay?: string;
  transitionDuration?: string;
  transitionProperty?: string;
  transitionTimingFunction?: string;
  translate?: string;
  triggerScope?: string;
  unicodeBidi?: string;
  userSelect?: string;
  vectorEffect?: string;
  verticalAlign?: string | number;
  viewTimeline?: string;
  viewTimelineAxis?: string;
  viewTimelineInset?: string | number;
  viewTimelineName?: string;
  viewTransitionClass?: string;
  viewTransitionGroup?: string;
  viewTransitionName?: string;
  viewTransitionScope?: string;
  visibility?: string;
  whiteSpace?: string;
  whiteSpaceCollapse?: string;
  widows?: string | number;
  width?: string | number;
  willChange?: string;
  wordBreak?: string;
  wordSpacing?: string | number;
  wordWrap?: string;
  writingMode?: string;
  x?: string | number;
  y?: string | number;
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
 * throughout yract – for example:
 *  - `click`       → `onClick`
 *  - `keydown`     → `onKeydown`
 *  - `input`       → `onInput`
 *  - `mouseenter`  → `onMouseenter`
 */
export type EventHandlers<T extends EventTarget = EventTarget> = {
  [K in keyof HTMLElementEventMap as `on${Capitalize<string & K>}`]?: (
    event: SyntheticEvent<HTMLElementEventMap[K], T>,
  ) => void;
};

// ---------------------------------------------------------------------------
// ARIA Attributes
// ---------------------------------------------------------------------------

/** WAI-ARIA attributes applicable to any HTML element. */
export interface AriaAttributes {
  "aria-activedescendant"?: string;
  "aria-atomic"?: boolean | "false" | "true";
  "aria-autocomplete"?: "none" | "inline" | "list" | "both";
  "aria-busy"?: boolean | "false" | "true";
  "aria-checked"?: boolean | "false" | "mixed" | "true";
  "aria-colcount"?: number;
  "aria-colindex"?: number;
  "aria-colspan"?: number;
  "aria-controls"?: string;
  "aria-current"?: boolean | "false" | "true" | "page" | "step" | "location" | "date" | "time";
  "aria-describedby"?: string;
  "aria-details"?: string;
  "aria-disabled"?: boolean | "false" | "true";
  "aria-dropeffect"?: "none" | "copy" | "execute" | "link" | "move" | "popup";
  "aria-errormessage"?: string;
  "aria-expanded"?: boolean | "false" | "true";
  "aria-flowto"?: string;
  "aria-grabbed"?: boolean | "false" | "true";
  "aria-haspopup"?: boolean | "false" | "true" | "menu" | "listbox" | "tree" | "grid" | "dialog";
  "aria-hidden"?: boolean | "false" | "true";
  "aria-invalid"?: boolean | "false" | "true" | "grammar" | "spelling";
  "aria-keyshortcuts"?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-level"?: number;
  "aria-live"?: "off" | "assertive" | "polite";
  "aria-modal"?: boolean | "false" | "true";
  "aria-multiline"?: boolean | "false" | "true";
  "aria-multiselectable"?: boolean | "false" | "true";
  "aria-orientation"?: "horizontal" | "vertical";
  "aria-owns"?: string;
  "aria-placeholder"?: string;
  "aria-posinset"?: number;
  "aria-pressed"?: boolean | "false" | "mixed" | "true";
  "aria-readonly"?: boolean | "false" | "true";
  "aria-required"?: boolean | "false" | "true";
  "aria-roledescription"?: string;
  "aria-rowcount"?: number;
  "aria-rowindex"?: number;
  "aria-rowspan"?: number;
  "aria-selected"?: boolean | "false" | "true";
  "aria-setsize"?: number;
  "aria-sort"?: "none" | "ascending" | "descending" | "other";
  "aria-valuemax"?: number;
  "aria-valuemin"?: number;
  "aria-valuenow"?: number;
  "aria-valuetext"?: string;
  role?: string;
}

// ---------------------------------------------------------------------------
// Base HTML attributes (common to every element)
// ---------------------------------------------------------------------------

/**
 * Attributes shared by **every** HTML element.
 *
 * Extends {@link AriaAttributes} and {@link EventHandlers} so that any
 * element can receive accessibility attributes and DOM event listeners.
 *
 * The type parameter `T` is the concrete `HTMLElement` subtype for this
 * element, used to narrow `event.currentTarget` in event handlers.
 */
export interface HTMLAttributes<T extends HTMLElement = HTMLElement>
  extends FrameworkProps, AriaAttributes, EventHandlers<T> {
  /** Ref object — set to the DOM element on mount, undefined on unmount. */
  ref?: WeakRefLike<T>;
  /**
   * JSX children. Uses the unprefixed `children` name (not `children`)
   * because TypeScript's automatic JSX runtime hardcodes `children` as the
   * synthesized children prop name when validating intrinsic elements.
   * `LibraryManagedAttributes` only bridges this for components, so HTML
   * elements have to expose `children` directly. Optional on every HTML
   * element; void elements are not yet enforced.
   */
  children?: Children;
  // ── Global HTML attributes ───────────────────────────────────────────────
  autoCapitalize?: string;
  autoFocus?: boolean;
  className?: string;
  contentEditable?: boolean | "true" | "false" | "inherit" | "plaintext-only";
  dir?: "ltr" | "rtl" | "auto";
  draggable?: boolean;
  enterKeyHint?: "enter" | "done" | "go" | "next" | "previous" | "search" | "send";
  hidden?: boolean;
  id?: string;
  inert?: boolean;
  inputMode?: "none" | "text" | "decimal" | "numeric" | "tel" | "search" | "email" | "url";
  is?: string;
  lang?: string;
  nonce?: string;
  popover?: string;
  slot?: string;
  spellCheck?: boolean;
  style?: CSSProperties;
  tabIndex?: number;
  title?: string;
  translate?: "yes" | "no";

  /** Any `data-*` attribute. */
  [key: `data-${string}`]: string | number | boolean | undefined;
}

// ---------------------------------------------------------------------------
// Element-specific attribute interfaces
// ---------------------------------------------------------------------------

/** `<a>` – hyperlink */
export interface AnchorHTMLAttributes extends HTMLAttributes<HTMLAnchorElement> {
  download?: string | boolean;
  href?: string;
  hrefLang?: string;
  media?: string;
  ping?: string;
  referrerPolicy?: ReferrerPolicy;
  rel?: string;
  /** `string & object` keeps IDE autocomplete for the named values while still accepting any string. */
  target?: "_self" | "_blank" | "_parent" | "_top" | (string & object);
  type?: string;
}

/** `<area>` */
export interface AreaHTMLAttributes extends HTMLAttributes<HTMLAreaElement> {
  alt?: string;
  coords?: string;
  download?: string | boolean;
  href?: string;
  ping?: string;
  referrerPolicy?: ReferrerPolicy;
  rel?: string;
  shape?: "rect" | "circle" | "poly" | "default";
  target?: string;
}

/** `<audio>` */
export interface AudioHTMLAttributes extends HTMLAttributes<HTMLAudioElement> {
  autoPlay?: boolean;
  controls?: boolean;
  crossOrigin?: "anonymous" | "use-credentials";
  loop?: boolean;
  mediaGroup?: string;
  muted?: boolean;
  preload?: "none" | "metadata" | "auto" | "";
  src?: string;
}

/** `<base>` */
export interface BaseHTMLAttributes extends HTMLAttributes<HTMLBaseElement> {
  href?: string;
  target?: string;
}

/** `<blockquote>` / `<q>` */
export interface BlockquoteHTMLAttributes extends HTMLAttributes<HTMLQuoteElement> {
  cite?: string;
}

/** `<button>` */
export interface ButtonHTMLAttributes extends HTMLAttributes<HTMLButtonElement> {
  autoFocus?: boolean;
  disabled?: boolean;
  form?: string;
  formAction?: string;
  formEncType?: string;
  formMethod?: string;
  formNoValidate?: boolean;
  formTarget?: string;
  name?: string;
  type?: "submit" | "reset" | "button";
  value?: string | number;
}

/** `<canvas>` */
export interface CanvasHTMLAttributes extends HTMLAttributes<HTMLCanvasElement> {
  height?: string | number;
  width?: string | number;
}

/** `<col>` / `<colgroup>` */
export interface ColHTMLAttributes extends HTMLAttributes<HTMLTableColElement> {
  span?: number;
  width?: string | number;
}

/** `<data>` */
export interface DataHTMLAttributes extends HTMLAttributes<HTMLDataElement> {
  value?: string | number;
}

/** `<del>` / `<ins>` */
export interface ModHTMLAttributes extends HTMLAttributes<HTMLModElement> {
  cite?: string;
  dateTime?: string;
}

/** `<details>` */
export interface DetailsHTMLAttributes extends HTMLAttributes<HTMLDetailsElement> {
  open?: boolean;
}

/** `<dialog>` */
export interface DialogHTMLAttributes extends HTMLAttributes<HTMLDialogElement> {
  open?: boolean;
}

/** `<embed>` */
export interface EmbedHTMLAttributes extends HTMLAttributes<HTMLEmbedElement> {
  height?: string | number;
  src?: string;
  type?: string;
  width?: string | number;
}

/** `<fieldset>` */
export interface FieldsetHTMLAttributes extends HTMLAttributes<HTMLFieldSetElement> {
  disabled?: boolean;
  form?: string;
  name?: string;
}

/** `<form>` */
export interface FormHTMLAttributes extends HTMLAttributes<HTMLFormElement> {
  acceptCharset?: string;
  action?: string;
  autoComplete?: string;
  encType?: string;
  method?: "get" | "post" | "dialog";
  name?: string;
  noValidate?: boolean;
  rel?: string;
  target?: string;
}

/** `<html>` */
export interface HtmlHTMLAttributes extends HTMLAttributes<HTMLHtmlElement> {
  manifest?: string;
}

/** `<iframe>` */
export interface IframeHTMLAttributes extends HTMLAttributes<HTMLIFrameElement> {
  allow?: string;
  allowFullScreen?: boolean;
  allowTransparency?: boolean;
  frameBorder?: string | number;
  height?: string | number;
  loading?: "eager" | "lazy";
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
export interface ImgHTMLAttributes extends HTMLAttributes<HTMLImageElement> {
  alt?: string;
  crossOrigin?: "anonymous" | "use-credentials";
  decoding?: "async" | "auto" | "sync";
  fetchPriority?: "high" | "low" | "auto";
  height?: string | number;
  loading?: "eager" | "lazy";
  referrerPolicy?: ReferrerPolicy;
  sizes?: string;
  src?: string;
  srcSet?: string;
  useMap?: string;
  width?: string | number;
}

/** `<input>` */
export interface InputHTMLAttributes extends HTMLAttributes<HTMLInputElement> {
  accept?: string;
  alt?: string;
  autoComplete?: string;
  capture?: boolean | "user" | "environment";
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
    | "button"
    | "checkbox"
    | "color"
    | "date"
    | "datetime-local"
    | "email"
    | "file"
    | "hidden"
    | "image"
    | "month"
    | "number"
    | "password"
    | "radio"
    | "range"
    | "reset"
    | "search"
    | "submit"
    | "tel"
    | "text"
    | "time"
    | "url"
    | "week";
  value?: string | number;
  width?: string | number;
}

/** `<label>` */
export interface LabelHTMLAttributes extends HTMLAttributes<HTMLLabelElement> {
  form?: string;
  /** Maps to the `for` HTML attribute. */
  htmlFor?: string;
}

/** `<li>` */
export interface LiHTMLAttributes extends HTMLAttributes<HTMLLIElement> {
  value?: number;
}

/** `<link>` */
export interface LinkHTMLAttributes extends HTMLAttributes<HTMLLinkElement> {
  as?: string;
  crossOrigin?: "anonymous" | "use-credentials";
  fetchPriority?: "high" | "low" | "auto";
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
export interface MapHTMLAttributes extends HTMLAttributes<HTMLMapElement> {
  name?: string;
}

/** `<meta>` */
export interface MetaHTMLAttributes extends HTMLAttributes<HTMLMetaElement> {
  charSet?: string;
  content?: string;
  httpEquiv?: string;
  media?: string;
  name?: string;
}

/** `<meter>` */
export interface MeterHTMLAttributes extends HTMLAttributes<HTMLMeterElement> {
  form?: string;
  high?: number;
  low?: number;
  max?: number;
  min?: number;
  optimum?: number;
  value?: string | number;
}

/** `<object>` */
export interface ObjectHTMLAttributes extends HTMLAttributes<HTMLObjectElement> {
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
export interface OlHTMLAttributes extends HTMLAttributes<HTMLOListElement> {
  reversed?: boolean;
  start?: number;
  type?: "1" | "a" | "A" | "i" | "I";
}

/** `<optgroup>` */
export interface OptgroupHTMLAttributes extends HTMLAttributes<HTMLOptGroupElement> {
  disabled?: boolean;
  label?: string;
}

/** `<option>` */
export interface OptionHTMLAttributes extends HTMLAttributes<HTMLOptionElement> {
  disabled?: boolean;
  label?: string;
  selected?: boolean;
  value?: string | number;
}

/** `<output>` */
export interface OutputHTMLAttributes extends HTMLAttributes<HTMLOutputElement> {
  form?: string;
  htmlFor?: string;
  name?: string;
}

/** `<param>` */
export interface ParamHTMLAttributes extends HTMLAttributes<HTMLParamElement> {
  name?: string;
  value?: string;
}

/** `<progress>` */
export interface ProgressHTMLAttributes extends HTMLAttributes<HTMLProgressElement> {
  max?: number;
  value?: string | number;
}

/** `<script>` */
export interface ScriptHTMLAttributes extends HTMLAttributes<HTMLScriptElement> {
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
export interface SelectHTMLAttributes extends HTMLAttributes<HTMLSelectElement> {
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
export interface SlotHTMLAttributes extends HTMLAttributes<HTMLSlotElement> {
  name?: string;
}

/** `<source>` */
export interface SourceHTMLAttributes extends HTMLAttributes<HTMLSourceElement> {
  height?: string | number;
  media?: string;
  sizes?: string;
  src?: string;
  srcSet?: string;
  type?: string;
  width?: string | number;
}

/** `<style>` */
export interface StyleHTMLAttributes extends HTMLAttributes<HTMLStyleElement> {
  media?: string;
  scoped?: boolean;
  type?: string;
}

/** `<table>` */
export interface TableHTMLAttributes extends HTMLAttributes<HTMLTableElement> {
  cellPadding?: string | number;
  cellSpacing?: string | number;
  summary?: string;
  width?: string | number;
}

/** `<td>` */
export interface TdHTMLAttributes extends HTMLAttributes<HTMLTableCellElement> {
  abbr?: string;
  align?: "left" | "center" | "right" | "justify" | "char";
  colSpan?: number;
  headers?: string;
  height?: string | number;
  rowSpan?: number;
  scope?: string;
  valign?: "top" | "middle" | "bottom" | "baseline";
  width?: string | number;
}

/** `<textarea>` */
export interface TextareaHTMLAttributes extends HTMLAttributes<HTMLTextAreaElement> {
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
export interface ThHTMLAttributes extends HTMLAttributes<HTMLTableCellElement> {
  abbr?: string;
  align?: "left" | "center" | "right" | "justify" | "char";
  colSpan?: number;
  headers?: string;
  rowSpan?: number;
  scope?: "col" | "row" | "colgroup" | "rowgroup";
}

/** `<time>` */
export interface TimeHTMLAttributes extends HTMLAttributes<HTMLTimeElement> {
  dateTime?: string;
}

/** `<track>` */
export interface TrackHTMLAttributes extends HTMLAttributes<HTMLTrackElement> {
  default?: boolean;
  kind?: "subtitles" | "captions" | "descriptions" | "chapters" | "metadata";
  label?: string;
  src?: string;
  srcLang?: string;
}

/** `<video>` */
export interface VideoHTMLAttributes extends HTMLAttributes<HTMLVideoElement> {
  autoPlay?: boolean;
  controls?: boolean;
  crossOrigin?: "anonymous" | "use-credentials";
  disablePictureInPicture?: boolean;
  disableRemotePlayback?: boolean;
  height?: string | number;
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  poster?: string;
  preload?: "none" | "metadata" | "auto" | "";
  src?: string;
  width?: string | number;
}

// ---------------------------------------------------------------------------
// SVG Attributes
// ---------------------------------------------------------------------------

/** Presentation attributes shared by all SVG elements. */
export interface SVGAttributes<T extends SVGElement = SVGElement>
  extends FrameworkProps, AriaAttributes, EventHandlers<T> {
  /** Ref object — set to the SVG element on mount, undefined on unmount. */
  ref?: WeakRefLike<T>;
  /** JSX children. See `HTMLAttributes.children` for why this isn't `children`. */
  children?: Children;
  className?: string;
  id?: string;
  style?: CSSProperties;
  tabIndex?: number;

  // Core SVG attributes
  color?: string;
  fill?: string;
  fillOpacity?: string | number;
  fillRule?: "nonzero" | "evenodd";
  filter?: string;
  mask?: string;
  opacity?: string | number;
  stroke?: string;
  strokeDasharray?: string | number;
  strokeDashoffset?: string | number;
  strokeLinecap?: "butt" | "round" | "square" | "inherit";
  strokeLinejoin?: "miter" | "round" | "bevel" | "inherit";
  strokeMiterlimit?: string | number;
  strokeOpacity?: string | number;
  strokeWidth?: string | number;
  transform?: string;
  vectorEffect?: string;
  visibility?: string;

  // Presentation
  clipPath?: string;
  clipRule?: "nonzero" | "evenodd";
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
export interface SvgHTMLAttributes extends SVGAttributes<SVGSVGElement> {
  height?: string | number;
  preserveAspectRatio?: string;
  viewBox?: string;
  width?: string | number;
  x?: string | number;
  xmlns?: string;
  y?: string | number;
}

/** `<path>` */
export interface PathSVGAttributes extends SVGAttributes<SVGPathElement> {
  d?: string;
  pathLength?: number;
}

/** `<circle>` */
export interface CircleSVGAttributes extends SVGAttributes<SVGCircleElement> {
  cx?: string | number;
  cy?: string | number;
  r?: string | number;
  pathLength?: number;
}

/** `<ellipse>` */
export interface EllipseSVGAttributes extends SVGAttributes<SVGEllipseElement> {
  cx?: string | number;
  cy?: string | number;
  rx?: string | number;
  ry?: string | number;
  pathLength?: number;
}

/** `<rect>` */
export interface RectSVGAttributes extends SVGAttributes<SVGRectElement> {
  height?: string | number;
  pathLength?: number;
  rx?: string | number;
  ry?: string | number;
  width?: string | number;
  x?: string | number;
  y?: string | number;
}

/** `<line>` */
export interface LineSVGAttributes extends SVGAttributes<SVGLineElement> {
  pathLength?: number;
  x1?: string | number;
  x2?: string | number;
  y1?: string | number;
  y2?: string | number;
}

/** `<polyline>` / `<polygon>` */
export interface PolylineSVGAttributes extends SVGAttributes<SVGPolylineElement> {
  pathLength?: number;
  points?: string;
}

/** `<text>` */
export interface TextSVGAttributes extends SVGAttributes<SVGTextElement> {
  dx?: string | number;
  dy?: string | number;
  lengthAdjust?: "spacing" | "spacingAndGlyphs";
  rotate?: string | number;
  textLength?: string | number;
  x?: string | number;
  y?: string | number;
}

/** `<tspan>` */
export interface TSpanSVGAttributes extends SVGAttributes<SVGTSpanElement> {
  dx?: string | number;
  dy?: string | number;
  lengthAdjust?: "spacing" | "spacingAndGlyphs";
  rotate?: string | number;
  textLength?: string | number;
  x?: string | number;
  y?: string | number;
}

/** `<use>` */
export interface UseSVGAttributes extends SVGAttributes<SVGUseElement> {
  href?: string;
  height?: string | number;
  width?: string | number;
  x?: string | number;
  y?: string | number;
}

/** `<symbol>` */
export interface SymbolSVGAttributes extends SVGAttributes<SVGSymbolElement> {
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
export interface PatternSVGAttributes extends SVGAttributes<SVGPatternElement> {
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
export interface LinearGradientSVGAttributes extends SVGAttributes<SVGLinearGradientElement> {
  gradientTransform?: string;
  gradientUnits?: string;
  href?: string;
  spreadMethod?: "pad" | "reflect" | "repeat";
  x1?: string | number;
  x2?: string | number;
  y1?: string | number;
  y2?: string | number;
}

/** `<radialGradient>` */
export interface RadialGradientSVGAttributes extends SVGAttributes<SVGRadialGradientElement> {
  cx?: string | number;
  cy?: string | number;
  fr?: string | number;
  fx?: string | number;
  fy?: string | number;
  gradientTransform?: string;
  gradientUnits?: string;
  href?: string;
  r?: string | number;
  spreadMethod?: "pad" | "reflect" | "repeat";
}

/** `<stop>` */
export interface StopSVGAttributes extends SVGAttributes<SVGStopElement> {
  offset?: string | number;
}

/** `<clipPath>` */
export interface ClipPathSVGAttributes extends SVGAttributes<SVGClipPathElement> {
  clipPathUnits?: "userSpaceOnUse" | "objectBoundingBox";
}

/** `<mask>` */
export interface MaskSVGAttributes extends SVGAttributes<SVGMaskElement> {
  height?: string | number;
  maskContentUnits?: string;
  maskUnits?: string;
  width?: string | number;
  x?: string | number;
  y?: string | number;
}

/** `<filter>` */
export interface FilterSVGAttributes extends SVGAttributes<SVGFilterElement> {
  filterUnits?: string;
  height?: string | number;
  primitiveUnits?: string;
  width?: string | number;
  x?: string | number;
  y?: string | number;
}

/** `<image>` (SVG) */
export interface ImageSVGAttributes extends SVGAttributes<SVGImageElement> {
  crossOrigin?: "anonymous" | "use-credentials";
  decoding?: "async" | "auto" | "sync";
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
  head: HTMLAttributes<HTMLHeadElement>;
  body: HTMLAttributes<HTMLBodyElement>;

  // ── Metadata ─────────────────────────────────────────────────────────────
  base: BaseHTMLAttributes;
  link: LinkHTMLAttributes;
  meta: MetaHTMLAttributes;
  noscript: HTMLAttributes<HTMLElement>;
  script: ScriptHTMLAttributes;
  style: StyleHTMLAttributes;
  title: HTMLAttributes<HTMLTitleElement>;

  // ── Sectioning ───────────────────────────────────────────────────────────
  address: HTMLAttributes<HTMLElement>;
  article: HTMLAttributes<HTMLElement>;
  aside: HTMLAttributes<HTMLElement>;
  footer: HTMLAttributes<HTMLElement>;
  header: HTMLAttributes<HTMLElement>;
  hgroup: HTMLAttributes<HTMLElement>;
  main: HTMLAttributes<HTMLElement>;
  nav: HTMLAttributes<HTMLElement>;
  section: HTMLAttributes<HTMLElement>;

  // ── Headings ─────────────────────────────────────────────────────────────
  h1: HTMLAttributes<HTMLHeadingElement>;
  h2: HTMLAttributes<HTMLHeadingElement>;
  h3: HTMLAttributes<HTMLHeadingElement>;
  h4: HTMLAttributes<HTMLHeadingElement>;
  h5: HTMLAttributes<HTMLHeadingElement>;
  h6: HTMLAttributes<HTMLHeadingElement>;

  // ── Text content ─────────────────────────────────────────────────────────
  blockquote: BlockquoteHTMLAttributes;
  dd: HTMLAttributes<HTMLElement>;
  div: HTMLAttributes<HTMLDivElement>;
  dl: HTMLAttributes<HTMLDListElement>;
  dt: HTMLAttributes<HTMLElement>;
  figcaption: HTMLAttributes<HTMLElement>;
  figure: HTMLAttributes<HTMLElement>;
  hr: HTMLAttributes<HTMLHRElement>;
  li: LiHTMLAttributes;
  menu: HTMLAttributes<HTMLMenuElement>;
  ol: OlHTMLAttributes;
  p: HTMLAttributes<HTMLParagraphElement>;
  pre: HTMLAttributes<HTMLPreElement>;
  ul: HTMLAttributes<HTMLUListElement>;

  // ── Inline text ──────────────────────────────────────────────────────────
  a: AnchorHTMLAttributes;
  abbr: HTMLAttributes<HTMLElement>;
  b: HTMLAttributes<HTMLElement>;
  bdi: HTMLAttributes<HTMLElement>;
  bdo: HTMLAttributes<HTMLElement>;
  br: HTMLAttributes<HTMLBRElement>;
  cite: HTMLAttributes<HTMLElement>;
  code: HTMLAttributes<HTMLElement>;
  data: DataHTMLAttributes;
  dfn: HTMLAttributes<HTMLElement>;
  em: HTMLAttributes<HTMLElement>;
  i: HTMLAttributes<HTMLElement>;
  kbd: HTMLAttributes<HTMLElement>;
  mark: HTMLAttributes<HTMLElement>;
  q: BlockquoteHTMLAttributes;
  rp: HTMLAttributes<HTMLElement>;
  rt: HTMLAttributes<HTMLElement>;
  ruby: HTMLAttributes<HTMLElement>;
  s: HTMLAttributes<HTMLElement>;
  samp: HTMLAttributes<HTMLElement>;
  small: HTMLAttributes<HTMLElement>;
  span: HTMLAttributes<HTMLSpanElement>;
  strong: HTMLAttributes<HTMLElement>;
  sub: HTMLAttributes<HTMLElement>;
  sup: HTMLAttributes<HTMLElement>;
  time: TimeHTMLAttributes;
  u: HTMLAttributes<HTMLElement>;
  var: HTMLAttributes<HTMLElement>;
  wbr: HTMLAttributes<HTMLElement>;

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
  picture: HTMLAttributes<HTMLPictureElement>;
  source: SourceHTMLAttributes;
  track: TrackHTMLAttributes;
  video: VideoHTMLAttributes;

  // ── Tables ───────────────────────────────────────────────────────────────
  caption: HTMLAttributes<HTMLTableCaptionElement>;
  col: ColHTMLAttributes;
  colgroup: ColHTMLAttributes;
  table: TableHTMLAttributes;
  tbody: HTMLAttributes<HTMLTableSectionElement>;
  td: TdHTMLAttributes;
  tfoot: HTMLAttributes<HTMLTableSectionElement>;
  th: ThHTMLAttributes;
  thead: HTMLAttributes<HTMLTableSectionElement>;
  tr: HTMLAttributes<HTMLTableRowElement>;

  // ── Forms ────────────────────────────────────────────────────────────────
  button: ButtonHTMLAttributes;
  datalist: HTMLAttributes<HTMLDataListElement>;
  fieldset: FieldsetHTMLAttributes;
  form: FormHTMLAttributes;
  input: InputHTMLAttributes;
  label: LabelHTMLAttributes;
  legend: HTMLAttributes<HTMLLegendElement>;
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
  summary: HTMLAttributes<HTMLElement>;

  // ── Web components ───────────────────────────────────────────────────────
  slot: SlotHTMLAttributes;
  template: HTMLAttributes<HTMLTemplateElement>;

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
