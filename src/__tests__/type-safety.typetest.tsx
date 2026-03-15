/**
 * Compile-time type safety tests for children and $ref props.
 *
 * This file is checked by `npm run typecheck`.
 * Lines marked `@ts-expect-error` MUST produce a type error — if they
 * don't, tsc reports an "unused directive" error and the check fails.
 * Unmarked lines MUST compile without errors.
 */
import type { ComponentGenerator } from "../hooks/types";
import { type Child, createElement, Fragment } from "../jsx";

// Suppress unused-variable warnings — this file is purely for type checking.
const _sink = (..._args: unknown[]) => {};

// ---------------------------------------------------------------------------
// Test components
// ---------------------------------------------------------------------------

/** Component that accepts no props. */
function* NoProps(): ComponentGenerator<Child> {
  return <div>no props</div>;
}

/** Component that accepts some props but NOT children or $ref. */
function* WithName(_props: { name: string }): ComponentGenerator<Child> {
  return <div />;
}

/** Component that explicitly declares children. */
function* WithChildren(_props: { children?: Child[] }): ComponentGenerator<Child> {
  return <div />;
}

/** Component that explicitly declares $ref. */
function* WithRef(_props: {
  $ref?: { current: HTMLElement | undefined };
}): ComponentGenerator<Child> {
  return <div />;
}

/** Component that explicitly declares both children and $ref. */
function* WithBoth(_props: {
  children?: Child[];
  $ref?: { current: HTMLElement | undefined };
}): ComponentGenerator<Child> {
  return <div />;
}

// ---------------------------------------------------------------------------
// 1. Components without props must NOT accept children or $ref
// ---------------------------------------------------------------------------

// @ts-expect-error — children not declared in NoProps
_sink(<NoProps children={[]} />);

// @ts-expect-error — $ref not declared in NoProps
_sink(<NoProps $ref={{ current: null }} />);

// Valid: NoProps with no special props
_sink(<NoProps />);

// ---------------------------------------------------------------------------
// 2. Components with unrelated props must NOT accept children or $ref
// ---------------------------------------------------------------------------

// @ts-expect-error — children not declared in WithName
_sink(<WithName name="hello" children={[]} />);

// @ts-expect-error — $ref not declared in WithName
_sink(<WithName name="hello" $ref={{ current: null }} />);

// Valid: WithName with only declared props
_sink(<WithName name="hello" />);

// ---------------------------------------------------------------------------
// 3. Components that declare children CAN receive it
// ---------------------------------------------------------------------------

_sink(<WithChildren children={[]} />);
_sink(<WithChildren children={["text", <span />]} />);
_sink(<WithChildren />);

// ---------------------------------------------------------------------------
// 4. Components that declare $ref CAN receive it
// ---------------------------------------------------------------------------

_sink(<WithRef $ref={{ current: undefined }} />);
_sink(<WithRef />);

// ---------------------------------------------------------------------------
// 5. Components with both children and $ref CAN receive them
// ---------------------------------------------------------------------------

_sink(<WithBoth children={[]} $ref={{ current: undefined }} />);
_sink(<WithBoth children={[]} />);
_sink(<WithBoth $ref={{ current: undefined }} />);
_sink(<WithBoth />);

// ---------------------------------------------------------------------------
// 6. Framework props (key, $shown, $patch, $deferred) are always valid
//    on ANY component — they are in FrameworkProps / IntrinsicAttributes
// ---------------------------------------------------------------------------

_sink(<NoProps key="k" />);
_sink(<NoProps $shown={true} />);
_sink(<NoProps $patch="live" />);
_sink(<NoProps $deferred={true} />);

_sink(<WithName name="hello" key="k" />);
_sink(<WithName name="hello" $shown={false} />);
_sink(<WithName name="hello" $patch="default" />);
_sink(<WithName name="hello" $deferred={false} />);

// ---------------------------------------------------------------------------
// 7. HTML elements always accept children (via SpecialProps in HTMLAttributes)
// ---------------------------------------------------------------------------

_sink(<div children={[<span />]} />);
_sink(<div children={["text"]} />);
_sink(<span children={["text"]} />);

// ---------------------------------------------------------------------------
// 8. HTML elements always accept $ref (via SpecialProps in HTMLAttributes)
// ---------------------------------------------------------------------------

_sink(<div $ref={{ current: undefined as HTMLDivElement | undefined }} />);
_sink(<input $ref={{ current: undefined as HTMLInputElement | undefined }} />);
_sink(<button $ref={{ current: undefined }} />);

// ---------------------------------------------------------------------------
// 9. HTML elements accept both children and $ref together
// ---------------------------------------------------------------------------

_sink(<div children={["text"]} $ref={{ current: undefined as HTMLDivElement | undefined }} />);

// ---------------------------------------------------------------------------
// 10. HTML elements also accept framework props
// ---------------------------------------------------------------------------

_sink(<div key="k" $shown={true} $patch="live" $deferred={false} />);
