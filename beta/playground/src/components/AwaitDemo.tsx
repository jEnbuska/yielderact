import { $load } from "../../../src/hooks/load";
import { useEffect, useState } from "yract-beta";
import { $render } from "../../../src/hooks/render";
import { $halt } from "../../../src/hooks/halt";
import { $halted } from "../../../src/hooks/halted";

export function* AwaitDemo() {
  const [promise, setPromise] = yield* useState(() => {
    const { promise, resolve } = Promise.withResolvers<number>();
    setTimeout(() => resolve(Date.now()), 1000);
    return promise;
  });
  const result = yield* $load<number>(promise);

  yield* useEffect(() => {
    if (result.error) return;
    let timeout: number = -1;
    const interval = setInterval(() => {
      const { promise, resolve } = Promise.withResolvers<number>();
      void setPromise(promise);
      timeout = setTimeout(() => {
        resolve(Date.now());
      }, 1000);
    }, 3000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [result.error]);

  if (result.error) {
    yield* $render(<ErrorChild retry={() => setPromise(Promise.resolve(Date.now()))} />);
  }

  const { data } = result;
  yield* useEffect(() => {
    console.log("set error timeout");
    let timeout = setTimeout(() => {
      const { promise, reject } = Promise.withResolvers<number>();
      setPromise(promise);
      timeout = setTimeout(() => {
        console.log("ERROR");
        reject(new Error("Invalid date"));
      }, 333);
    }, 15555);
    return () => {
      console.log("run error cleanup");
      clearTimeout(timeout);
    };
  });

  if (!result.data) {
    console.log("halt");
    yield* $halt(<p>Initial loading...</p>);
  }

  return (
    <ul>
      <li>
        <time dateTime={new Date(data!).toTimeString()}>
          Awaiting time: {new Date(data!).toTimeString().substring(0, 8)}
        </time>
      </li>
      <ul>
        <li>
          <AwaitedChild />
        </li>
      </ul>
    </ul>
  );
}

function* AwaitedChild() {
  const [time, setTime] = yield* useState(Date.now);
  yield* useEffect(() => {
    const interval = setInterval(() => {
      setTime(Date.now());
    }, 1000);
    return () => {
      console.log("unmount");
      clearInterval(interval);
    };
  });
  const inert = yield* $halted();
  const [clicks, setClicks] = yield* useState(0);
  return (
    <div
      onClick={() => setClicks(clicks + 1)}
      inert={inert.current}
      style={{ opacity: inert ? 0.5 : 1 }}
    >
      <time dateTime={new Date(new Date()).toTimeString()}>
        Child time: {new Date(time).toTimeString().substring(0, 8)}
      </time>
      Clicks: {clicks}
    </div>
  );
}

function* ErrorChild({ retry }: { retry: () => void }) {
  return (
    <div>
      <p>Something went wrong...</p>
      <button onClick={retry}>Try again</button>
    </div>
  );
}
