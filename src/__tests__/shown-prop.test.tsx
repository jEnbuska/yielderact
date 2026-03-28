import { useState } from "../hooks";
import { render } from "../render";

// jsdom is provided by vitest (see vitest.config.ts)

describe("shown prop", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("renders an HTML element when shown is true", () => {
    render(<div $shown={true}>visible</div>, container);
    expect(container.querySelector("div")).not.toBeNull();
    expect(container.querySelector("div")?.textContent).toBe("visible");
  });

  it("does not render an HTML element when shown is false", () => {
    render(<div $shown={false}>hidden</div>, container);
    expect(container.querySelector("div")).toBeNull();
  });

  it("renders an HTML element when shown is omitted (defaults to shown)", () => {
    render(<div>visible</div>, container);
    expect(container.querySelector("div")).not.toBeNull();
  });

  it("does not set shown as a DOM attribute", () => {
    render(<div $shown={true}>visible</div>, container);
    const el = container.querySelector("div") as HTMLElement;
    expect(el.hasAttribute("$shown")).toBe(false);
  });

  it("renders a component when shown is true (no hooks)", () => {
    function* Greeting() {
      return <p>hello</p>;
    }
    render(
      <div>
        <Greeting $shown={true} />
      </div>,
      container,
    );
    expect(container.querySelector("p")).not.toBeNull();
  });

  it("does not render a component when shown is false (no hooks)", () => {
    function* Greeting() {
      return <p>hello</p>;
    }
    render(
      <div>
        <Greeting $shown={false} />
      </div>,
      container,
    );
    expect(container.querySelector("p")).toBeNull();
  });

  it("renders a component when shown is true", () => {
    function* Counter() {
      return <p>counter</p>;
    }
    render(
      <div>
        <Counter $shown={true} />
      </div>,
      container,
    );
    expect(container.querySelector("p")).not.toBeNull();
  });

  it("does not render a component when shown is false", () => {
    function* Counter() {
      return <p>counter</p>;
    }
    render(
      <div>
        <Counter $shown={false} />
      </div>,
      container,
    );
    expect(container.querySelector("p")).toBeNull();
  });

  it("unmounts an HTML element when shown changes from true to false", () => {
    let setShown: (v: boolean) => void = () => {};

    function* Wrapper() {
      const [$shown, setS] = yield* useState(true);
      setShown = setS;
      return <div $shown={$shown}>content</div>;
    }

    render(<Wrapper />, container);
    expect(container.querySelector("div")).not.toBeNull();

    void setShown(false);
    expect(container.querySelector("div")).toBeNull();
  });

  it("mounts an HTML element when shown changes from false to true", () => {
    let setShown: (v: boolean) => void = () => {};

    function* Wrapper() {
      const [$shown, setS] = yield* useState(false);
      setShown = setS;
      return <div $shown={$shown}>content</div>;
    }

    render(<Wrapper />, container);
    expect(container.querySelector("div")).toBeNull();

    void setShown(true);
    expect(container.querySelector("div")).not.toBeNull();
    expect(container.querySelector("div")?.textContent).toBe("content");
  });

  it("unmounts a component when shown changes from true to false", () => {
    let setShown: (v: boolean) => void = () => {};

    function* Inner() {
      return <p>inner</p>;
    }

    function* Wrapper() {
      const [$shown, setS] = yield* useState(true);
      setShown = setS;
      return <Inner $shown={$shown} />;
    }

    render(<Wrapper />, container);
    expect(container.querySelector("p")).not.toBeNull();

    void setShown(false);
    expect(container.querySelector("p")).toBeNull();
  });

  it("mounts a component when shown changes from false to true", () => {
    let setShown: (v: boolean) => void = () => {};

    function* Inner() {
      return <p>inner</p>;
    }

    function* Wrapper() {
      const [$shown, setS] = yield* useState(false);
      setShown = setS;
      return <Inner $shown={$shown} />;
    }

    render(<Wrapper />, container);
    expect(container.querySelector("p")).toBeNull();

    void setShown(true);
    expect(container.querySelector("p")).not.toBeNull();
    expect(container.querySelector("p")?.textContent).toBe("inner");
  });
});
