import { SidebarLink } from "../dos";
import { Children } from "yract-beta";

type OwnProps = {
  targetId: string;
  children: Children;
};
export function* SideBarHashLink({ targetId, children }: OwnProps) {
  return (
    <SidebarLink
      href={`#${targetId}`}
      data-testid={`link-${targetId}`}
      onClick={() => document.getElementById(targetId)?.scrollIntoView()}
    >
      {children}
    </SidebarLink>
  );
}
