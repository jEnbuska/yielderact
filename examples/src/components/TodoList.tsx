/**
 * TodoList – a generator component demonstrating array state management.
 */
import { render } from 'yielderact';

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

export function* TodoList(_props: object, rerender: () => void) {
  let todos: Todo[] = [
    { id: 1, text: 'Learn yielderact', done: false },
    { id: 2, text: 'Build something with generators', done: false },
  ];
  let nextId = 3;
  let inputValue = '';

  function addTodo() {
    const text = inputValue.trim();
    if (!text) return;
    todos = [...todos, { id: nextId++, text, done: false }];
    inputValue = '';
    rerender();
  }

  function toggleTodo(id: number) {
    todos = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
    rerender();
  }

  function removeTodo(id: number) {
    todos = todos.filter((t) => t.id !== id);
    rerender();
  }

  while (true) {
    yield (
      <section aria-label="Todo list example">
        <h2>Todo List</h2>
        <p>
          Array state lives in a plain <code>let</code> variable and is replaced
          on every update — no special reactive primitives needed.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <input
            id="todo-input"
            type="text"
            placeholder="New todo…"
            onInput={(e: Event) => {
              inputValue = (e.target as HTMLInputElement).value;
            }}
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key === 'Enter') addTodo();
            }}
          />
          <button id="add-todo-btn" onClick={addTodo}>
            Add
          </button>
        </div>
        <ul id="todo-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {todos.map((todo) => (
            <li
              key={todo.id}
              data-id={todo.id}
              style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.35rem' }}
            >
              <input
                type="checkbox"
                checked={todo.done}
                onChange={() => toggleTodo(todo.id)}
              />
              <span
                style={{ textDecoration: todo.done ? 'line-through' : 'none', flex: 1 }}
              >
                {todo.text}
              </span>
              <button
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
          <p id="empty-message" style={{ color: '#888' }}>
            No todos yet. Add one above!
          </p>
        )}
      </section>
    );
  }
}

export function mountTodoList(container: HTMLElement): void {
  render(<TodoList />, container);
}
