import { useRender, useResume, useState } from "../hooks";
import { render } from "../render";

// jsdom is provided by vitest (see vitest.config.ts)

describe("useRender (Variant 2 – inline function)", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("yields JSX while waiting and returns the value passed to resume", () => {
    let capturedResume: (v: string) => void = () => {};
    let finalText: string | null = null;

    function* Comp() {
      const answer = yield* useRender<string>(({ resume }) => {
        capturedResume = resume;
        return <span>waiting</span>;
      }, []);
      finalText = answer;
      return <p>{answer}</p>;
    }

    render(<Comp />, container);

    // While waiting the dialog is shown
    expect(container.querySelector("span")?.textContent).toBe("waiting");
    expect(finalText).toBeNull();

    // Resolving unblocks the generator
    capturedResume("DONE");

    expect(container.querySelector("p")?.textContent).toBe("DONE");
    expect(finalText).toBe("DONE");
  });

  it("resume is idempotent – calling it twice only resolves once", () => {
    let capturedResume: (v: number) => void = () => {};
    let resolveCount = 0;
    let finalValue: number | null = null;

    function* Comp() {
      const v = yield* useRender<number>(({ resume }) => {
        capturedResume = resume;
        return <span />;
      }, []);
      resolveCount++;
      finalValue = v;
      return <div />;
    }

    render(<Comp />, container);
    capturedResume(1);
    capturedResume(2); // second call ignored

    expect(resolveCount).toBe(1);
    expect(finalValue).toBe(1);
  });

  it("resets to waiting on parent rerender while waiting", () => {
    let capturedResume: (v: boolean) => void = () => {};
    let setVal: (v: number) => void = () => {};
    let renderCount = 0;

    function* Comp() {
      const [, sv] = yield* useState(0);
      setVal = sv;
      yield* useRender<boolean>(({ resume }) => {
        renderCount++;
        capturedResume = resume;
        return <span />;
      }, []);
      return <div />;
    }

    render(<Comp />, container);
    expect(renderCount).toBe(1);

    // Trigger a rerender while waiting
    setVal(1);
    expect(renderCount).toBe(2);

    // The generator is still waiting – resolve it now
    capturedResume(true);
    expect(container.querySelector("div")).not.toBeNull();
  });

  it("deps change resets the interaction", () => {
    let setDep: (v: number) => void = () => {};
    let capturedResume: (v: string) => void = () => {};
    let resolveCount = 0;

    function* Comp() {
      const [dep, sd] = yield* useState(0);
      setDep = sd;
      yield* useRender<string>(
        ({ resume }) => {
          capturedResume = resume;
          return <span>{String(dep)}</span>;
        },
        [dep],
      );
      resolveCount++;
      return <div />;
    }

    render(<Comp />, container);

    // Resolve first interaction
    capturedResume("first");
    expect(resolveCount).toBe(1);

    // Change dep → should reset and show dialog again
    setDep(1);
    expect(container.querySelector("span")).not.toBeNull();

    capturedResume("second");
    expect(resolveCount).toBe(2);
  });
});

describe("useRender (Variant 1 – JSX child with useResume)", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("child component receives resume via useResume and can resolve the parent", () => {
    let capturedResume: (v: string) => void = () => {};
    let finalAnswer: string | null = null;

    function* Dialog() {
      const resume = yield* useResume<string>();
      capturedResume = resume;
      return <span>dialog</span>;
    }

    function* Parent() {
      const answer = yield* useRender<string>(<Dialog />);
      finalAnswer = answer;
      return <p>{answer}</p>;
    }

    render(<Parent />, container);

    expect(container.querySelector("span")?.textContent).toBe("dialog");
    expect(finalAnswer).toBeNull();

    capturedResume("ACCEPTED");

    expect(container.querySelector("p")?.textContent).toBe("ACCEPTED");
    expect(finalAnswer).toBe("ACCEPTED");
  });

  it("does not remount the child when the parent rerenders while waiting", () => {
    let mountCount = 0;
    let capturedResume: (v: string) => void = () => {};
    let setVal: (v: number) => void = () => {};

    function* Dialog() {
      mountCount++;
      const resume = yield* useResume<string>();
      capturedResume = resume;
      return <span>dialog</span>;
    }

    function* Parent() {
      const [, sv] = yield* useState(0);
      setVal = sv;
      yield* useRender<string>(<Dialog />);
      return <div />;
    }

    render(<Parent />, container);
    expect(mountCount).toBe(1);

    // Trigger a parent rerender while the dialog is still open
    setVal(1);
    expect(mountCount).toBe(1); // Dialog must NOT remount

    // Resolve still works after the rerender
    capturedResume("OK");
    expect(container.querySelector("div")).not.toBeNull();
  });
});

describe("useRender – multiple sequential calls", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("two sequential useRender calls (inline variant)", () => {
    let resumeFirst: (v: string) => void = () => {};
    let resumeSecond: (v: number) => void = () => {};

    function* Wizard() {
      const name = yield* useRender<string>(({ resume }) => {
        resumeFirst = resume;
        return <span>step-1</span>;
      }, []);
      const age = yield* useRender<number>(({ resume }) => {
        resumeSecond = resume;
        return <span>step-2</span>;
      }, []);
      return <p>{`${name}:${age}`}</p>;
    }

    render(<Wizard />, container);
    expect(container.querySelector("span")?.textContent).toBe("step-1");

    resumeFirst("Alice");
    expect(container.querySelector("span")?.textContent).toBe("step-2");

    resumeSecond(30);
    expect(container.querySelector("p")?.textContent).toBe("Alice:30");
  });

  it("two sequential useRender calls (JSX child variant)", () => {
    let resumeFirst: (v: string) => void = () => {};
    let resumeSecond: (v: string) => void = () => {};

    function* StepOne() {
      const resume = yield* useResume<string>();
      resumeFirst = resume;
      return <span>step-1</span>;
    }

    function* StepTwo() {
      const resume = yield* useResume<string>();
      resumeSecond = resume;
      return <span>step-2</span>;
    }

    function* Wizard() {
      const a = yield* useRender<string>(<StepOne />);
      const b = yield* useRender<string>(<StepTwo />);
      return <p>{`${a}+${b}`}</p>;
    }

    render(<Wizard />, container);
    expect(container.querySelector("span")?.textContent).toBe("step-1");

    resumeFirst("X");
    expect(container.querySelector("span")?.textContent).toBe("step-2");

    resumeSecond("Y");
    expect(container.querySelector("p")?.textContent).toBe("X+Y");
  });

  it("three sequential useRender calls", () => {
    const resumes: Array<(v: number) => void> = [];

    function* Multi() {
      const a = yield* useRender<number>(({ resume }) => {
        resumes[0] = resume;
        return <span>s1</span>;
      }, []);
      const b = yield* useRender<number>(({ resume }) => {
        resumes[1] = resume;
        return <span>s2</span>;
      }, []);
      const c = yield* useRender<number>(({ resume }) => {
        resumes[2] = resume;
        return <span>s3</span>;
      }, []);
      return <p>{`${a}+${b}+${c}`}</p>;
    }

    render(<Multi />, container);
    expect(container.querySelector("span")?.textContent).toBe("s1");

    resumes[0]?.(1);
    expect(container.querySelector("span")?.textContent).toBe("s2");

    resumes[1]?.(2);
    expect(container.querySelector("span")?.textContent).toBe("s3");

    resumes[2]?.(3);
    expect(container.querySelector("p")?.textContent).toBe("1+2+3");
  });

  it("useRender after useState works correctly", () => {
    let resumeFirst: (v: string) => void = () => {};
    let resumeSecond: (v: string) => void = () => {};

    function* Comp() {
      const [count] = yield* useState(0);
      const a = yield* useRender<string>(({ resume }) => {
        resumeFirst = resume;
        return <span>{`waiting-1:${count}`}</span>;
      }, []);
      const b = yield* useRender<string>(({ resume }) => {
        resumeSecond = resume;
        return <span>{`waiting-2:${count}`}</span>;
      }, []);
      return <p>{`${a}-${b}-${count}`}</p>;
    }

    render(<Comp />, container);
    expect(container.querySelector("span")?.textContent).toBe("waiting-1:0");

    resumeFirst("A");
    expect(container.querySelector("span")?.textContent).toBe("waiting-2:0");

    resumeSecond("B");
    expect(container.querySelector("p")?.textContent).toBe("A-B-0");
  });
});

describe("useResume", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("throws when called outside a useRender context", () => {
    function* Comp() {
      yield* useResume();
      return <div />;
    }

    expect(() => render(<Comp />, container)).toThrow(
      "useResume must be called inside a component rendered by useRender",
    );
  });
});
