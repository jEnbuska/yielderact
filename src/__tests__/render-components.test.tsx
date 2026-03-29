import { useState } from "../hooks";
import { render } from "../render";

// jsdom is provided by vitest (see vitest.config.ts)

describe("render – components", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("renders a component that returns JSX", () => {
    function* Greeting({ name }: { name: string }) {
      return <h2>{`Hi, ${name}!`}</h2>;
    }
    render(<Greeting name="Alice" />, container);
    expect(container.querySelector("h2")?.textContent).toBe("Hi, Alice!");
  });

  it("rerenders via useState setter", async () => {
    let setCount: (v: number) => void = () => {};

    function* Counter() {
      const [count, sc] = yield* useState(0);
      setCount = sc;
      return <button>{String(count)}</button>;
    }

    render(<Counter />, container);
    expect(container.querySelector("button")?.textContent).toBe("0");

    await setCount(1);
    expect(container.querySelector("button")?.textContent).toBe("1");

    await setCount(5);
    expect(container.querySelector("button")?.textContent).toBe("5");
  });

  it("rerenders when rerender() is called directly from an event handler", () => {
    function* Counter(_props: Record<string, unknown>, _rerender: () => void) {
      const [count, setCount] = yield* useState(0);
      return (
        <button
          onClick={() => {
            setCount(count + 1);
          }}
        >
          {String(count)}
        </button>
      );
    }

    render(<Counter />, container);

    expect(container.querySelector("button")?.textContent).toBe("0");
    container.querySelector("button")?.click();
    expect(container.querySelector("button")?.textContent).toBe("1");
    container.querySelector("button")?.click();
    expect(container.querySelector("button")?.textContent).toBe("2");
  });

  it("renders components nested inside HTML elements", () => {
    function* Label({ text }: { text: string }) {
      return <span>{text}</span>;
    }

    render(
      <div className="wrapper">
        <Label text="nested" />
      </div>,
      container,
    );

    expect(container.querySelector("span")?.textContent).toBe("nested");
  });

  it("passes children in props", () => {
    function* Wrapper({ children }: { children: unknown }) {
      return <section>{...(children as never[])}</section>;
    }

    render(
      <Wrapper>
        <p>child content</p>
      </Wrapper>,
      container,
    );

    expect(container.querySelector("p")?.textContent).toBe("child content");
  });
});

describe("render – components with useState", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("useState persists value across re-renders", async () => {
    let setLabel: (v: string) => void = () => {};

    function* Label() {
      const [text, st] = yield* useState("initial");
      setLabel = st;
      return <p>{text}</p>;
    }

    render(<Label />, container);
    expect(container.querySelector("p")?.textContent).toBe("initial");

    await setLabel("updated");
    expect(container.querySelector("p")?.textContent).toBe("updated");

    await setLabel("again");
    expect(container.querySelector("p")?.textContent).toBe("again");
  });

  it("multiple useState calls maintain independent state", async () => {
    let setA: (v: string) => void = () => {};
    let setB: (v: number) => void = () => {};

    function* Multi() {
      const [a, sa] = yield* useState("hello");
      const [b, sb] = yield* useState(0);
      setA = sa;
      setB = sb;
      return <p>{`${a}-${b}`}</p>;
    }

    render(<Multi />, container);
    expect(container.querySelector("p")?.textContent).toBe("hello-0");

    await setA("world");
    expect(container.querySelector("p")?.textContent).toBe("world-0");

    await setB(42);
    expect(container.querySelector("p")?.textContent).toBe("world-42");
  });
});
