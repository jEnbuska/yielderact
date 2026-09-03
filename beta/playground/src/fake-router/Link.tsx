import { ComponentProps, useContext } from "yract-beta";
import { RouteContext } from "./contexts";

export type LinkProps = ComponentProps<"a">;
export function* Link(props: LinkProps) {
  const { href = "/", children, onClick, ...anchorProps } = props;
  const router = yield* useContext(RouteContext);
  return (
    <a
      {...anchorProps}
      href={href}
      onClick={(e: any) => {
        onClick?.(e);
        if (
          e.defaultPrevented ||
          e.button !== 0 ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey ||
          (anchorProps.target && anchorProps.target !== "_self")
        ) {
          return;
        }
        e.preventDefault();
        void router.navigate(href);
      }}
    >
      {children}
    </a>
  );
}
