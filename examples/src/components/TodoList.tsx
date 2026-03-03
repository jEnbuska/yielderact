/**
 * TodoList – a generator component demonstrating array state management
 * with `yield* useState`.
 */
import { render, useState } from 'yielderact';

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
  const [state, setState] = yield* useState<TodoState>({
    todos: [
      { id: 1, text: 'Learn yielderact', done: false },
      { id: 2, text: 'Build something with generators', done: false },
    ],
    nextId: 3,
    inputValue: '',
  });

  const { todos, nextId, inputValue } = state;

  function addTodo() {
    const text = inputValue.trim();
    if (!text) return;
    setState({
      todos: [...todos, { id: nextId, text, done: false }],
      nextId: nextId + 1,
      inputValue: '',
    });
  }

  function toggleTodo(id: number) {
    setState({ ...state, todos: todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) });
  }

  function removeTodo(id: number) {
    setState({ ...state, todos: todos.filter((t) => t.id !== id) });
  }

  return (
    <section aria-label="Todo list example">
      <h2>Todo List</h2>
      <p>
        Array state lives in <code>yield* useState</code> — no special reactive primitives needed,
        just plain objects and setters.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <input
          id="todo-input"
          type="text"
          value={inputValue}
          placeholder="New todo…"
          onInput={(e) => {
            setState({ ...state, inputValue: e.currentTarget?.value ?? '' });
          }}
          onKeydown={(e) => {
            if (e.nativeEvent.key === 'Enter') addTodo();
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
            style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
              marginBottom: '0.35rem',
            }}
          >
            <input type="checkbox" checked={todo.done} onChange={() => toggleTodo(todo.id)} />
            <span style={{ textDecoration: todo.done ? 'line-through' : 'none', flex: 1 }}>
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

export function mountTodoList(container: HTMLElement): void {
  render(<TodoList />, container);
}
