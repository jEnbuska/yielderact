/**
 * TodoList – a component demonstrating array state management
 * with `yield* useState`.
 */
import { useId, useState } from "yract";
import { Window, WindowBar, WindowBody } from "../../dos";

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

interface TodoState {
  todos: Todo[];
  nextId: number;
  inputValue: string;
}

export function* TodoList() {
  const inputId = yield* useId();
  const addBtnId = yield* useId();
  const listId = yield* useId();
  const emptyMsgId = yield* useId();

  const [state, setState] = yield* useState<TodoState>({
    todos: [],
    nextId: 3,
    inputValue: "",
  });

  const { todos, nextId, inputValue } = state;

  function addTodo() {
    const text = inputValue.trim();
    if (!text) return;
    void setState({
      todos: [...todos, { id: nextId, text, done: false }],
      nextId: nextId + 1,
      inputValue: "",
    });
  }

  function toggleTodo(id: number) {
    void setState({
      ...state,
      todos: todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    });
  }

  function removeTodo(id: number) {
    void setState({ ...state, todos: todos.filter((t) => t.id !== id) });
  }

  return (
    <Window>
      <WindowBar title="Todo List" aside="/todos" />
      <WindowBody>
        <h2>Todo List {todos.length % 2 ? "EVEN" : null}</h2>
        <p>
          Array state lives in <code>yield* useState</code> — no special reactive primitives needed,
          just plain objects and setters.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <label htmlFor={inputId}>New todo:</label>
          <input
            id={inputId}
            data-testid="todo-input"
            type="text"
            value={inputValue}
            placeholder="New todo…"
            onInput={(e) => {
              setState({ ...state, inputValue: e.currentTarget?.value ?? "" });
            }}
            onKeydown={(e) => {
              if (e.nativeEvent.key === "Enter") addTodo();
            }}
          />
          <button id={addBtnId} data-testid="add-todo-btn" onClick={addTodo}>
            Add
          </button>
        </div>
        <ul
          id={listId}
          data-testid="todo-list"
          style={{ listStyle: "none", padding: 0, margin: 0 }}
        >
          {todos.map((todo) => (
            <li
              key={String(todo.id)}
              data-testid={`todo-item-${todo.id}`}
              data-id={todo.id}
              style={{
                display: "flex",
                gap: "0.5rem",
                alignItems: "center",
                marginBottom: "0.35rem",
              }}
            >
              <input
                type="checkbox"
                checked={todo.done}
                id={`todo-${todo.id}`}
                onChange={() => toggleTodo(todo.id)}
              />
              <label
                style={{ textDecoration: todo.done ? "line-through" : "none", flex: 1 }}
                htmlFor={`todo-${todo.id}`}
              >
                {todo.text}
              </label>
              <button
                data-testid={`todo-remove-${todo.id}`}
                data-remove={todo.id}
                onClick={() => removeTodo(todo.id)}
                aria-label={`Remove ${todo.text}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        {todos.length === 0 && (
          <p id={emptyMsgId} data-testid="empty-message" style={{ color: "#888" }}>
            No todos yet. Add one above!
          </p>
        )}
      </WindowBody>
    </Window>
  );
}
