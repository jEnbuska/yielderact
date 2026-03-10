/**
 * E2E tests for a TodoList component with add, toggle, remove,
 * keyed reconciliation, and $shown-based empty state.
 */
import { expect, test } from "./fixtures";

/** Helper that mounts the TodoList component into the page. */
async function mountTodoList(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const { createElement, render, useState } = (
      window as unknown as { Yielderact: typeof import("../src/index") }
    ).Yielderact;

    type Todo = { id: number; text: string; done: boolean };

    function* TodoList(_: object) {
      const [todos, setTodos] = yield* useState<Todo[]>([]);
      const [input, setInput] = yield* useState("");
      let nextId = todos.length > 0 ? Math.max(...todos.map((t: Todo) => t.id)) + 1 : 1;

      const addTodo = () => {
        const trimmed = input.trim();
        if (!trimmed) return;
        setTodos([...todos, { id: nextId++, text: trimmed, done: false }]);
        setInput("");
      };

      const toggleTodo = (id: number) =>
        setTodos(todos.map((t: Todo) => (t.id === id ? { ...t, done: !t.done } : t)));
      const removeTodo = (id: number) => setTodos(todos.filter((t: Todo) => t.id !== id));

      return createElement(
        "section",
        null,
        createElement(
          "div",
          { style: "display:flex;gap:0.5rem;margin-bottom:0.75rem" },
          createElement("input", {
            "data-testid": "todo-input",
            type: "text",
            value: input,
            oninput: (e: Event) => setInput((e.target as HTMLInputElement).value),
            onkeydown: (e: KeyboardEvent) => {
              if (e.key === "Enter") addTodo();
            },
          }),
          createElement("button", { "data-testid": "add-todo-btn", onclick: addTodo }, "Add"),
        ),
        createElement(
          "ul",
          { "data-testid": "todo-list", style: "list-style:none;padding:0" },
          ...todos.map((todo: Todo) =>
            createElement(
              "li",
              {
                $key: String(todo.id),
                "data-testid": `todo-item-${todo.id}`,
                style: "display:flex;gap:0.5rem;align-items:center;padding:0.3rem 0",
              },
              createElement("input", {
                type: "checkbox",
                checked: todo.done,
                onchange: () => toggleTodo(todo.id),
              }),
              createElement(
                "span",
                {
                  "data-testid": `todo-text-${todo.id}`,
                  style: todo.done
                    ? "text-decoration:line-through;color:#999"
                    : "text-decoration:none",
                },
                todo.text,
              ),
              createElement(
                "button",
                {
                  "data-testid": `todo-remove-${todo.id}`,
                  onclick: () => removeTodo(todo.id),
                },
                "\u00d7",
              ),
            ),
          ),
        ),
        createElement(
          "p",
          { $shown: todos.length === 0, "data-testid": "empty-message" },
          "No todos yet",
        ),
      );
    }

    render(createElement(TodoList as never, {}), document.getElementById("root") as HTMLElement);
  });
}

test("initial render shows empty message and empty list", async ({ page, setupPage }) => {
  await setupPage();
  await mountTodoList(page);

  await expect(page.getByTestId("empty-message")).toBeVisible();
  await expect(page.getByTestId("empty-message")).toHaveText("No todos yet");
  await expect(page.getByTestId("todo-list").locator("li")).toHaveCount(0);
});

test("add a todo item - empty message hides, item appears", async ({ page, setupPage }) => {
  await setupPage();
  await mountTodoList(page);

  await page.getByTestId("todo-input").fill("Buy milk");
  await page.getByTestId("add-todo-btn").click();

  await expect(page.getByTestId("todo-list").locator("li")).toHaveCount(1);
  await expect(page.getByTestId("todo-text-1")).toHaveText("Buy milk");
  await expect(page.getByTestId("empty-message")).not.toBeVisible();
});

test("add multiple items - all appear in order", async ({ page, setupPage }) => {
  await setupPage();
  await mountTodoList(page);

  const items = ["Walk the dog", "Read a book", "Write tests"];
  for (const item of items) {
    await page.getByTestId("todo-input").fill(item);
    await page.getByTestId("add-todo-btn").click();
  }

  const listItems = page.getByTestId("todo-list").locator("li");
  await expect(listItems).toHaveCount(3);
  await expect(page.getByTestId("todo-text-1")).toHaveText("Walk the dog");
  await expect(page.getByTestId("todo-text-2")).toHaveText("Read a book");
  await expect(page.getByTestId("todo-text-3")).toHaveText("Write tests");
});

test("toggle todo done - text gets strikethrough style", async ({ page, setupPage }) => {
  await setupPage();
  await mountTodoList(page);

  await page.getByTestId("todo-input").fill("Exercise");
  await page.getByTestId("add-todo-btn").click();

  // Verify initially not struck through
  const textSpan = page.getByTestId("todo-text-1");
  await expect(textSpan).toHaveCSS("text-decoration-line", "none");

  // Toggle done via checkbox
  await page.getByTestId("todo-item-1").locator('input[type="checkbox"]').click();

  // Verify strikethrough applied
  await expect(textSpan).toHaveCSS("text-decoration-line", "line-through");
});

test("remove a todo - item disappears", async ({ page, setupPage }) => {
  await setupPage();
  await mountTodoList(page);

  await page.getByTestId("todo-input").fill("Temporary task");
  await page.getByTestId("add-todo-btn").click();

  await expect(page.getByTestId("todo-list").locator("li")).toHaveCount(1);

  await page.getByTestId("todo-remove-1").click();

  await expect(page.getByTestId("todo-list").locator("li")).toHaveCount(0);
});

test("remove all todos - empty message reappears", async ({ page, setupPage }) => {
  await setupPage();
  await mountTodoList(page);

  // Add two items
  await page.getByTestId("todo-input").fill("First");
  await page.getByTestId("add-todo-btn").click();
  await page.getByTestId("todo-input").fill("Second");
  await page.getByTestId("add-todo-btn").click();

  await expect(page.getByTestId("empty-message")).not.toBeVisible();
  await expect(page.getByTestId("todo-list").locator("li")).toHaveCount(2);

  // Remove both
  await page.getByTestId("todo-remove-1").click();
  await expect(page.getByTestId("todo-list").locator("li")).toHaveCount(1);

  await page.getByTestId("todo-remove-2").click();
  await expect(page.getByTestId("todo-list").locator("li")).toHaveCount(0);
  await expect(page.getByTestId("empty-message")).toBeVisible();
  await expect(page.getByTestId("empty-message")).toHaveText("No todos yet");
});

test("add todo via Enter key", async ({ page, setupPage }) => {
  await setupPage();
  await mountTodoList(page);

  await page.getByTestId("todo-input").fill("Enter-key todo");
  await page.getByTestId("todo-input").press("Enter");

  await expect(page.getByTestId("todo-list").locator("li")).toHaveCount(1);
  await expect(page.getByTestId("todo-text-1")).toHaveText("Enter-key todo");
});

test("empty input is rejected - no item added", async ({ page, setupPage }) => {
  await setupPage();
  await mountTodoList(page);

  // Click Add with empty input
  await page.getByTestId("add-todo-btn").click();
  await expect(page.getByTestId("todo-list").locator("li")).toHaveCount(0);
  await expect(page.getByTestId("empty-message")).toBeVisible();

  // Press Enter with empty input
  await page.getByTestId("todo-input").press("Enter");
  await expect(page.getByTestId("todo-list").locator("li")).toHaveCount(0);
});

test("whitespace-only input is rejected - no item added", async ({ page, setupPage }) => {
  await setupPage();
  await mountTodoList(page);

  await page.getByTestId("todo-input").fill("   ");
  await page.getByTestId("add-todo-btn").click();

  await expect(page.getByTestId("todo-list").locator("li")).toHaveCount(0);
  await expect(page.getByTestId("empty-message")).toBeVisible();
});

test("rapid add operations work correctly", async ({ page, setupPage }) => {
  await setupPage();
  await mountTodoList(page);

  for (let i = 1; i <= 5; i++) {
    await page.getByTestId("todo-input").fill(`Task ${i}`);
    await page.getByTestId("add-todo-btn").click();
  }

  await expect(page.getByTestId("todo-list").locator("li")).toHaveCount(5);

  // Verify all items rendered in order
  for (let i = 1; i <= 5; i++) {
    await expect(page.getByTestId(`todo-text-${i}`)).toHaveText(`Task ${i}`);
  }
});

test("toggle done then remove - item gone", async ({ page, setupPage }) => {
  await setupPage();
  await mountTodoList(page);

  await page.getByTestId("todo-input").fill("Toggle and remove");
  await page.getByTestId("add-todo-btn").click();

  // Toggle done
  await page.getByTestId("todo-item-1").locator('input[type="checkbox"]').click();
  await expect(page.getByTestId("todo-text-1")).toHaveCSS("text-decoration-line", "line-through");

  // Remove
  await page.getByTestId("todo-remove-1").click();
  await expect(page.getByTestId("todo-list").locator("li")).toHaveCount(0);
  await expect(page.getByTestId("empty-message")).toBeVisible();
});
