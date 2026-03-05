import { useState, useId } from 'yielderact';

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
      <div className="flex gap-2 mb-3">
        <label htmlFor={inputId}>New todo:</label>
        <input
          id={inputId}
          data-testid="todo-input"
          type="text"
          value={inputValue}
          placeholder="New todo…"
          onInput={(e) => setState({ ...state, inputValue: e.currentTarget?.value ?? '' })}
          onKeydown={(e) => {
            if (e.nativeEvent.key === 'Enter') addTodo();
          }}
        />
        <button id={addBtnId} data-testid="add-todo-btn" onClick={addTodo}>
          Add
        </button>
      </div>
      <ul id={listId} data-testid="todo-list" className="list-none p-0 m-0">
        {todos.map((todo) => (
          <li key={todo.id} data-id={todo.id} className="flex gap-2 items-center mb-1">
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
        <p id={emptyMsgId} data-testid="empty-message" style={{ color: '#888' }}>
          No todos yet. Add one above!
        </p>
      )}
    </section>
  );
}
