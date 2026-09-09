import { Children, $id, useState } from "yract-beta";
import { BreadCrumbs, Crumb, Window, WindowBar, WindowBody } from "../../dos";

function* SlotComponent({ children }: { children: Children[] | Children }) {
  return <span>{children}</span>;
}

export function* SlotsDemo() {
  const titleId = yield* $id();
  const [renders, rerender] = yield* useState(0);
  return (
    <>
      <BreadCrumbs label="Location" hint="/slots">
        <Crumb>yract-beta</Crumb>
        <Crumb>Slots</Crumb>
      </BreadCrumbs>
      <Window labelledBy={titleId}>
        <WindowBar title="Slots" titleId={titleId} aside="/slots" />
        <WindowBody>
          <div>
            <button onClick={() => rerender(renders + 1)}>Rerender</button>
            <div>
              {"text"} {"text2"}
            </div>
            <div>
              {"tex3"}
              {"text4"}
            </div>
            <div>{["tex3", "text4"]}</div>
            <SlotComponent>
              {"text"} {"text2"}
            </SlotComponent>
            <SlotComponent>
              {"tex3"}
              {"text4"}
            </SlotComponent>
            <SlotComponent>{["tex3", "text4"]}</SlotComponent>
            <SlotComponent>
              <SlotComponent>
                text5 text6
                <SlotComponent children={""} />
                <SlotComponent>
                  <SlotComponent children={[""]} />
                  <SlotComponent children={<SlotComponent children={[]} />} />
                </SlotComponent>
              </SlotComponent>
            </SlotComponent>
          </div>
        </WindowBody>
      </Window>
    </>
  );
}
