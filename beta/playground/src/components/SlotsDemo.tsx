import { $state, Children } from "yract-beta";

function* SlotComponent({ children }: { children: Children[] | Children }) {
  return <span>{children}</span>;
}

export function* SlotsDemo() {
  const [renders, rerender] = yield* $state(0);
  return (
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
          text5
          <SlotComponent shown={false} children={[<SlotComponent children={null} />]} />
          text6
          <SlotComponent children={""} />
          <SlotComponent>
            <SlotComponent children={[""]} />
            <SlotComponent children={<SlotComponent children={[]} />} />
          </SlotComponent>
        </SlotComponent>
      </SlotComponent>
    </div>
  );
}
