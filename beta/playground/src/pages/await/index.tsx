import { $halted, $id, $load, $render, requireHalt, useEffect, useState } from "yract-beta";
import { BreadCrumbs, Crumb, Window, WindowBar, WindowBody } from "../../dos";

export function* AwaitDemo() {
  const titleId = yield* $id();
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
    let timeout = setTimeout(() => {
      const { promise, resolve } = Promise.withResolvers<number>();
      void setPromise(promise);
      timeout = setTimeout(() => {
        resolve(Date.now());
      }, 333);
    }, 15555);
    return () => {
      clearTimeout(timeout);
    };
  });

  if (!result.data) {
    yield* requireHalt(<p>Initial loading...</p>);
  }

  return (
    <>
      <BreadCrumbs label="Location" hint="/await">
        <Crumb>yract-beta</Crumb>
        <Crumb>Await</Crumb>
      </BreadCrumbs>
      <Window labelledBy={titleId}>
        <WindowBar title="Await" titleId={titleId} aside="/await" />
        <WindowBody>
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
        </WindowBody>
      </Window>
    </>
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
  const halted = yield* $halted();
  const [clicks, setClicks] = yield* useState(0);
  return (
    <div
      onClick={() => setClicks(clicks + 1)}
      inert={halted.current}
      style={{ opacity: halted ? 0.5 : 1 }}
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
