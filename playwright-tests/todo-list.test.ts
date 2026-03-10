/**
 * Visual tests for a TodoList pattern: add, remove, toggle, empty state,
 * rapid sequences, and state preservation across parent rerenders.
 */
import { expect, test } from "./fixtures";

/** Helper to set up the TodoList app inside page.evaluate. */
async function setupTodoApp(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const { createElement, render, useState } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* TodoList(_: object) {
      const [todos, setTodos] = yield* useState<{ id: number; text: string; done: boolean }[]>([]);
      const [nextId, setNextId] = yield* useState(1);
      const [inputValue, setInputValue] = yield* useState("");

      win.setTodos = setTodos;
      win.setNextId = setNextId;
      win.setInputValue = setInputValue;

      const addTodo = () => {
        const text = inputValue.trim();
        if (!text) return;
        setTodos((prev: { id: number; text: string; done: boolean }[]) => [
          ...prev,
          { id: nextId, text, done: false },
        ]);
        setNextId((n: number) => n + 1);
        setInputValue("");
      };

      const toggleTodo = (id: number) => {
        setTodos((prev: { id: number; text: string; done: boolean }[]) =>
          prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
        );
      };

      const removeTodo = (id: number) => {
        setTodos((prev: { id: number; text: string; done: boolean }[]) =>
          prev.filter((t) => t.id !== id),
        );
      };

      const children: ReturnType<typeof createElement>[] = [];

      if (todos.length === 0) {
        children.push(createElement("p", { id: "empty-message" }, "No todos yet"));
      } else {
        const items = todos.map((todo) =>
          createElement(
            "li",
            { key: String(todo.id), id: `todo-${todo.id}` },
            createElement("input", {
              type: "checkbox",
              checked: todo.done,
              id: `check-${todo.id}`,
              onchange: () => toggleTodo(todo.id),
            }),
            createElement(
              "span",
              {
                id: `text-${todo.id}`,
                style: { textDecoration: todo.done ? "line-through" : "none" },
              },
              todo.text,
            ),
            createElement(
              "button",
              { id: `remove-${todo.id}`, onclick: () => removeTodo(todo.id) },
              "Remove",
            ),
          ),
        );
        children.push(createElement("ul", { id: "todo-list" }, ...items));
      }

      return createElement(
        "div",
        { id: "todo-app" },
        createElement(
          "div",
          { id: "todo-input-area" },
          createElement("input", {
            type: "text",
            id: "todo-input",
            value: inputValue,
            oninput: (e: { target: { value: string } }) => setInputValue(e.target.value),
          }),
          createElement("button", { id: "add-btn", onclick: addTodo }, "Add"),
        ),
        createElement("p", { id: "todo-count" }, `Count: ${todos.length}`),
        ...children,
      );
    }

    render(createElement(TodoList as never, {}), document.getElementById("root") as HTMLElement);
  });
}

test("add a single todo item and verify it appears", async ({ page, setupPage }) => {
  await setupPage();
  await setupTodoApp(page);

  await expect(page.locator("#empty-message")).toHaveText("No todos yet");

  await page.fill("#todo-input", "Buy milk");
  await page.click("#add-btn");

  await expect(page.locator("#text-1")).toHaveText("Buy milk");
  await expect(page.locator("#todo-count")).toHaveText("Count: 1");
  await expect(page.locator("#empty-message")).not.toBeAttached();

  await page.screenshot({ path: "/tmp/visual-todo-add-single.png" });
});

test("add multiple todo items and verify count", async ({ page, setupPage }) => {
  await setupPage();
  await setupTodoApp(page);

  const items = ["Buy milk", "Walk the dog", "Write tests"];
  for (const item of items) {
    await page.fill("#todo-input", item);
    await page.click("#add-btn");
  }

  await expect(page.locator("#todo-count")).toHaveText("Count: 3");
  await expect(page.locator("#text-1")).toHaveText("Buy milk");
  await expect(page.locator("#text-2")).toHaveText("Walk the dog");
  await expect(page.locator("#text-3")).toHaveText("Write tests");
  await expect(page.locator("#todo-list li")).toHaveCount(3);

  await page.screenshot({ path: "/tmp/visual-todo-add-multiple.png" });
});

test("toggle a todo item done and undone", async ({ page, setupPage }) => {
  await setupPage();
  await setupTodoApp(page);

  await page.fill("#todo-input", "Toggleable task");
  await page.click("#add-btn");

  // Initially not checked
  await expect(page.locator("#check-1")).not.toBeChecked();

  // Toggle done
  await page.click("#check-1");
  await expect(page.locator("#check-1")).toBeChecked();

  // Verify line-through style
  const textDec = await page
    .locator("#text-1")
    .evaluate((el: HTMLElement) => el.style.textDecoration);
  expect(textDec).toBe("line-through");

  // Toggle undone
  await page.click("#check-1");
  await expect(page.locator("#check-1")).not.toBeChecked();

  const textDecAfter = await page
    .locator("#text-1")
    .evaluate((el: HTMLElement) => el.style.textDecoration);
  expect(textDecAfter).toBe("none");

  await page.screenshot({ path: "/tmp/visual-todo-toggle.png" });
});

test("remove a todo item", async ({ page, setupPage }) => {
  await setupPage();
  await setupTodoApp(page);

  await page.fill("#todo-input", "Task A");
  await page.click("#add-btn");
  await page.fill("#todo-input", "Task B");
  await page.click("#add-btn");
  await page.fill("#todo-input", "Task C");
  await page.click("#add-btn");

  await expect(page.locator("#todo-list li")).toHaveCount(3);

  // Remove middle item
  await page.click("#remove-2");

  await expect(page.locator("#todo-list li")).toHaveCount(2);
  await expect(page.locator("#text-1")).toHaveText("Task A");
  await expect(page.locator("#text-3")).toHaveText("Task C");
  await expect(page.locator("#todo-2")).not.toBeAttached();
  await expect(page.locator("#todo-count")).toHaveText("Count: 2");

  await page.screenshot({ path: "/tmp/visual-todo-remove.png" });
});

test("empty state message shows when no items exist", async ({ page, setupPage }) => {
  await setupPage();
  await setupTodoApp(page);

  await expect(page.locator("#empty-message")).toHaveText("No todos yet");
  await expect(page.locator("#todo-count")).toHaveText("Count: 0");
  await expect(page.locator("#todo-list")).not.toBeAttached();

  await page.screenshot({ path: "/tmp/visual-todo-empty-state.png" });
});

test("add item, remove it, verify empty state returns", async ({ page, setupPage }) => {
  await setupPage();
  await setupTodoApp(page);

  await expect(page.locator("#empty-message")).toHaveText("No todos yet");

  // Add an item
  await page.fill("#todo-input", "Temporary task");
  await page.click("#add-btn");

  await expect(page.locator("#empty-message")).not.toBeAttached();
  await expect(page.locator("#todo-count")).toHaveText("Count: 1");

  // Remove it
  await page.click("#remove-1");

  await expect(page.locator("#empty-message")).toHaveText("No todos yet");
  await expect(page.locator("#todo-count")).toHaveText("Count: 0");
  await expect(page.locator("#todo-list")).not.toBeAttached();

  await page.screenshot({ path: "/tmp/visual-todo-empty-returns.png" });
});

test("rapid add then remove sequence", async ({ page, setupPage }) => {
  await setupPage();
  await setupTodoApp(page);

  // Rapidly add 5 items
  for (let i = 1; i <= 5; i++) {
    await page.fill("#todo-input", `Rapid ${i}`);
    await page.click("#add-btn");
  }

  await expect(page.locator("#todo-count")).toHaveText("Count: 5");
  await expect(page.locator("#todo-list li")).toHaveCount(5);

  // Rapidly remove all items from first to last
  for (let i = 1; i <= 5; i++) {
    await page.click(`#remove-${i}`);
  }

  await expect(page.locator("#todo-count")).toHaveText("Count: 0");
  await expect(page.locator("#empty-message")).toHaveText("No todos yet");
  await expect(page.locator("#todo-list")).not.toBeAttached();

  await page.screenshot({ path: "/tmp/visual-todo-rapid-sequence.png" });
});

test("state preserved across unrelated parent rerenders", async ({ page, setupPage }) => {
  await setupPage();

  await page.evaluate(() => {
    const { createElement, render, useState } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    const win = window as unknown as Record<string, unknown>;

    function* TodoList(_: object) {
      const [todos, setTodos] = yield* useState<{ id: number; text: string; done: boolean }[]>([]);
      const [nextId, setNextId] = yield* useState(1);
      const [inputValue, setInputValue] = yield* useState("");

      const addTodo = () => {
        const text = inputValue.trim();
        if (!text) return;
        setTodos((prev: { id: number; text: string; done: boolean }[]) => [
          ...prev,
          { id: nextId, text, done: false },
        ]);
        setNextId((n: number) => n + 1);
        setInputValue("");
      };

      const toggleTodo = (id: number) => {
        setTodos((prev: { id: number; text: string; done: boolean }[]) =>
          prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
        );
      };

      const removeTodo = (id: number) => {
        setTodos((prev: { id: number; text: string; done: boolean }[]) =>
          prev.filter((t) => t.id !== id),
        );
      };

      const children: ReturnType<typeof createElement>[] = [];

      if (todos.length === 0) {
        children.push(createElement("p", { id: "empty-message" }, "No todos yet"));
      } else {
        const items = todos.map((todo) =>
          createElement(
            "li",
            { key: String(todo.id), id: `todo-${todo.id}` },
            createElement("input", {
              type: "checkbox",
              checked: todo.done,
              id: `check-${todo.id}`,
              onchange: () => toggleTodo(todo.id),
            }),
            createElement(
              "span",
              {
                id: `text-${todo.id}`,
                style: { textDecoration: todo.done ? "line-through" : "none" },
              },
              todo.text,
            ),
            createElement(
              "button",
              { id: `remove-${todo.id}`, onclick: () => removeTodo(todo.id) },
              "Remove",
            ),
          ),
        );
        children.push(createElement("ul", { id: "todo-list" }, ...items));
      }

      return createElement(
        "div",
        { id: "todo-app" },
        createElement(
          "div",
          { id: "todo-input-area" },
          createElement("input", {
            type: "text",
            id: "todo-input",
            value: inputValue,
            oninput: (e: { target: { value: string } }) => setInputValue(e.target.value),
          }),
          createElement("button", { id: "add-btn", onclick: addTodo }, "Add"),
        ),
        createElement("p", { id: "todo-count" }, `Count: ${todos.length}`),
        ...children,
      );
    }

    function* Parent(_: object) {
      const [tick, setTick] = yield* useState(0);
      win.rerenderParent = () => setTick((t: number) => t + 1);

      return createElement(
        "div",
        null,
        createElement("span", { id: "parent-tick" }, String(tick)),
        createElement(TodoList as never, {}),
      );
    }

    render(createElement(Parent as never, {}), document.getElementById("root") as HTMLElement);
  });

  // Add some todos and toggle one
  await page.fill("#todo-input", "Persist me");
  await page.click("#add-btn");
  await page.fill("#todo-input", "Toggle me");
  await page.click("#add-btn");

  await page.click("#check-2");
  await expect(page.locator("#check-2")).toBeChecked();
  await expect(page.locator("#todo-count")).toHaveText("Count: 2");

  // Re-render parent (unrelated state change)
  await page.evaluate(() => {
    (window as unknown as Record<string, () => void>).rerenderParent();
  });

  await expect(page.locator("#parent-tick")).toHaveText("1");

  // Verify todo state is fully preserved
  await expect(page.locator("#todo-count")).toHaveText("Count: 2");
  await expect(page.locator("#text-1")).toHaveText("Persist me");
  await expect(page.locator("#text-2")).toHaveText("Toggle me");
  await expect(page.locator("#check-2")).toBeChecked();
  await expect(page.locator("#check-1")).not.toBeChecked();

  // Re-render parent again
  await page.evaluate(() => {
    (window as unknown as Record<string, () => void>).rerenderParent();
  });

  await expect(page.locator("#parent-tick")).toHaveText("2");
  await expect(page.locator("#todo-count")).toHaveText("Count: 2");
  await expect(page.locator("#check-2")).toBeChecked();

  await page.screenshot({ path: "/tmp/visual-todo-state-preserved.png" });
});
