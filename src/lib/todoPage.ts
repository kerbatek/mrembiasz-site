import { createTodo, deleteTodo, listTodos, updateTodo } from "./todoApi.js";
import {
  beginTodoLogin,
  clearTodoSession,
  completeTodoLogin,
  getStoredTodoSession,
  todoLogoutUrl,
} from "./todoAuth.js";

type TodoStatus = "todo" | "in_progress" | "done";
type TodoFilter = "all" | TodoStatus;
type StatusTone = "neutral" | "error";
type Todo = {
  id: string;
  title: string;
  priority: number;
  status: TodoStatus;
  category: string;
  description: string;
  completed: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
};
type ApiTodo = Omit<Todo, "status"> & { status: string };
type TodoChanges = Partial<
  Pick<Todo, "title" | "priority" | "status" | "category" | "description">
>;
type TodoSession = {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  expiresAt?: number;
};
function requireElement<T extends Element>(
  parent: ParentNode,
  selector: string,
  constructor: new () => T,
): T {
  const element = parent.querySelector(selector);

  if (!(element instanceof constructor)) {
    throw new Error(`Missing required todo element: ${selector}`);
  }

  return element;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function todoStatusFromValue(value: string): TodoStatus {
  return value === "in_progress" || value === "done" ? value : "todo";
}

function todoFilterFromValue(value: string | undefined): TodoFilter {
  return value === "todo" || value === "in_progress" || value === "done"
    ? value
    : "all";
}

function todoFromApi(todo: ApiTodo): Todo {
  return {
    ...todo,
    status: todoStatusFromValue(todo.status),
  };
}

const app = requireElement(document, "[data-todo-app]", HTMLElement);
const authPanel = requireElement(document, "[data-auth-panel]", HTMLElement);
const loginButton = requireElement(document, "[data-login]", HTMLButtonElement);
const logoutButton = requireElement(
  document,
  "[data-logout]",
  HTMLButtonElement,
);
const form = requireElement(document, "[data-create-form]", HTMLFormElement);
const titleInput = requireElement(
  document,
  "[data-title-input]",
  HTMLInputElement,
);
const priorityInput = requireElement(
  document,
  "[data-priority-input]",
  HTMLInputElement,
);
const statusInput = requireElement(
  document,
  "[data-status-input]",
  HTMLSelectElement,
);
const categoryInput = requireElement(
  document,
  "[data-category-input]",
  HTMLInputElement,
);
const descriptionInput = requireElement(
  document,
  "[data-description-input]",
  HTMLTextAreaElement,
);
const list = requireElement(document, "[data-list]", HTMLUListElement);
const status = requireElement(document, "[data-status]", HTMLElement);
const count = requireElement(document, "[data-count]", HTMLElement);
const refreshButton = requireElement(
  document,
  "[data-refresh]",
  HTMLButtonElement,
);
const itemTemplate = requireElement(
  document,
  "[data-item-template]",
  HTMLTemplateElement,
);
const emptyTemplate = requireElement(
  document,
  "[data-empty-template]",
  HTMLTemplateElement,
);
const filterButtons = Array.from(
  document.querySelectorAll("[data-filter]"),
  (button) => {
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error("Todo filters must be buttons");
    }

    return button;
  },
);
const apiBaseUrl = import.meta.env.PUBLIC_TODO_API_BASE_URL || "/api";
const authConfig = {
  domain: import.meta.env.PUBLIC_TODO_COGNITO_DOMAIN || "",
  clientId: import.meta.env.PUBLIC_TODO_COGNITO_CLIENT_ID || "",
  redirectUri:
    import.meta.env.PUBLIC_TODO_COGNITO_REDIRECT_URI ||
    `${window.location.origin}/todo/`,
  logoutUri:
    import.meta.env.PUBLIC_TODO_COGNITO_LOGOUT_URI ||
    `${window.location.origin}/todo/`,
  scopes: import.meta.env.PUBLIC_TODO_COGNITO_SCOPES || "openid email profile",
};
const previewSampleEnabled = import.meta.env.PUBLIC_TODO_PREVIEW_SAMPLE === "1";

let todos: Todo[] = [];
let activeFilter: TodoFilter = "all";
const pendingIds = new Set<string>();
let authSession: TodoSession | null =
  getStoredTodoSession() || legacyLocalSession();

function hasCognitoConfig(): boolean {
  return Boolean(authConfig.domain && authConfig.clientId);
}

function legacyLocalSession(): TodoSession | null {
  const token = import.meta.env.PUBLIC_TODO_ACCESS_TOKEN || "";
  return token ? { accessToken: token } : null;
}

function accessToken(): string {
  return authSession?.accessToken || "";
}

function isAuthenticated(): boolean {
  return Boolean(accessToken());
}

function renderAuth(): void {
  const configured = hasCognitoConfig();
  const authenticated = isAuthenticated();

  if (previewSampleEnabled) {
    loginButton.hidden = true;
    logoutButton.hidden = true;
    form.dataset.authenticated = "false";
    refreshButton.disabled = true;
    authPanel.hidden = false;
    authPanel.textContent = "Preview sample data.";
    authPanel.dataset.tone = "neutral";
    return;
  }

  loginButton.hidden = authenticated || !configured;
  logoutButton.hidden = !authenticated || !configured;
  form.dataset.authenticated = String(authenticated);
  refreshButton.disabled = !authenticated;

  if (!authenticated) {
    authPanel.hidden = false;
    authPanel.textContent = configured
      ? "Sign in with Cognito to load your tasks."
      : "Cognito is not configured for this build.";
    authPanel.dataset.tone = configured ? "neutral" : "error";
    return;
  }

  authPanel.hidden = true;
  authPanel.textContent = "";
  authPanel.dataset.tone = "neutral";
}

function filteredTodos(): Todo[] {
  if (activeFilter === "all") {
    return sortTodosByPriority(todos.filter((todo) => !isDoneTodo(todo)));
  }

  return sortTodosByPriority(
    todos.filter((todo) => todo.status === activeFilter),
  );
}

function sortTodosByPriority(items: Todo[]): Todo[] {
  return [...items].sort((left, right) => {
    const doneOrder = Number(isDoneTodo(left)) - Number(isDoneTodo(right));

    if (doneOrder !== 0) {
      return doneOrder;
    }

    return right.priority - left.priority;
  });
}

function isDoneTodo(todo: Todo): boolean {
  return todo.status === "done" || todo.completed;
}

function setStatus(message: string, tone: StatusTone = "neutral"): void {
  status.textContent = message;
  status.dataset.tone = tone;
  status.hidden = !message;
}

function renderCount(): void {
  const openCount = todos.filter((todo) => !isDoneTodo(todo)).length;
  count.textContent = `${openCount} open`;
}

function renderFilters(): void {
  for (const button of filterButtons) {
    button.setAttribute(
      "aria-selected",
      String(button.dataset.filter === activeFilter),
    );
  }
}

function renderTodos(): void {
  list.replaceChildren();
  const visibleTodos = filteredTodos();

  if (visibleTodos.length === 0) {
    list.append(emptyTemplate.content.cloneNode(true));
    renderCount();
    renderFilters();
    return;
  }

  for (const todo of visibleTodos) {
    const node = itemTemplate.content.cloneNode(true) as DocumentFragment;
    const item = requireElement(node, ".todo-item", HTMLElement);
    const editTitle = requireElement(
      node,
      "[data-edit-title]",
      HTMLInputElement,
    );
    const editPriority = requireElement(
      node,
      "[data-edit-priority]",
      HTMLInputElement,
    );
    const editStatus = requireElement(
      node,
      "[data-edit-status]",
      HTMLSelectElement,
    );
    const editCategory = requireElement(
      node,
      "[data-edit-category]",
      HTMLInputElement,
    );
    const editDescription = requireElement(
      node,
      "[data-edit-description]",
      HTMLTextAreaElement,
    );
    const deleteButton = requireElement(
      node,
      "[data-delete]",
      HTMLButtonElement,
    );
    const editControls = [
      editTitle,
      editPriority,
      editStatus,
      editCategory,
      editDescription,
    ];
    const readonly = pendingIds.has(todo.id) || previewSampleEnabled;

    item.dataset.completed = String(isDoneTodo(todo));
    item.dataset.status = todo.status;
    item.dataset.pending = String(pendingIds.has(todo.id));
    editTitle.value = todo.title;
    editPriority.value = String(todo.priority);
    editStatus.value = todo.status;
    editCategory.value = todo.category;
    editDescription.value = todo.description;
    editControls.forEach((control) => {
      control.disabled = readonly;
    });
    deleteButton.disabled = readonly;

    editTitle.addEventListener("blur", () => {
      updateExistingTodo(todo, { title: editTitle.value.trim() });
    });
    editPriority.addEventListener("change", () => {
      updateExistingTodo(todo, {
        priority: integerFromInput(editPriority),
      });
    });
    editStatus.addEventListener("change", () => {
      updateExistingTodo(todo, {
        status: todoStatusFromValue(editStatus.value),
      });
    });
    editCategory.addEventListener("blur", () => {
      updateExistingTodo(todo, { category: editCategory.value.trim() });
    });
    editDescription.addEventListener("blur", () => {
      updateExistingTodo(todo, {
        description: editDescription.value.trim(),
      });
    });
    editDescription.addEventListener("input", () => {
      autosizeTextarea(editDescription);
    });

    deleteButton.addEventListener("click", () => {
      removeTodo(todo);
    });

    list.append(node);
    autosizeTextarea(editDescription);
  }

  renderCount();
  renderFilters();
}

async function withPending(
  todoId: string,
  action: () => Promise<void>,
): Promise<void> {
  pendingIds.add(todoId);
  renderTodos();

  try {
    await action();
  } finally {
    pendingIds.delete(todoId);
    renderTodos();
  }
}

async function loadTodos(): Promise<void> {
  if (previewSampleEnabled) {
    todos = [previewSampleTodo()];
    setStatus("");
    renderTodos();
    renderAuth();
    return;
  }

  if (!isAuthenticated()) {
    todos = [];
    setStatus("");
    renderTodos();
    renderAuth();
    return;
  }

  setStatus("Loading tasks");

  try {
    todos = (await listTodos({ apiBaseUrl, accessToken: accessToken() })).map(
      todoFromApi,
    );
    setStatus("");
  } catch (error) {
    const message = errorMessage(error, "Could not load tasks");

    if (message === "unauthorized") {
      clearTodoSession();
      authSession = null;
      renderAuth();
    }

    setStatus(message, "error");
  }

  renderTodos();
}

function previewSampleTodo(): Todo {
  const timestamp = new Date("2026-07-19T12:00:00.000Z");

  return {
    id: "preview-sample-task",
    title: "Preview deployment smoke test",
    priority: 1,
    status: "in_progress",
    category: "Preview",
    description: "This task is injected only by npm run preview.",
    completed: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function integerFromInput(input: HTMLInputElement): number {
  const value = Number.parseInt(input.value, 10);
  return Number.isNaN(value) ? 0 : value;
}

function autosizeTextarea(textarea: HTMLTextAreaElement): void {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function bindAutosizeTextarea(textarea: HTMLTextAreaElement): void {
  autosizeTextarea(textarea);
  textarea.addEventListener("input", () => {
    autosizeTextarea(textarea);
  });
}

function changedFields(todo: Todo, changes: TodoChanges): TodoChanges {
  const changed: TodoChanges = {};
  copyChangedTextField(changed, "title", todo.title, changes.title);
  copyChangedNumberField(changed, todo.priority, changes.priority);
  copyChangedStatusField(changed, todo.status, changes.status);
  copyChangedTextField(changed, "category", todo.category, changes.category);
  copyChangedTextField(
    changed,
    "description",
    todo.description,
    changes.description,
  );
  return changed;
}

function todoWithChanges(todo: Todo, changes: TodoChanges): Todo {
  const status = changes.status ?? todo.status;

  return {
    ...todo,
    ...changes,
    status,
    completed: status === "done",
  };
}

function applyLocalTodoChanges(todo: Todo, changes: TodoChanges): void {
  todos = todos.map((item) =>
    item.id === todo.id ? todoWithChanges(item, changes) : item,
  );
}

function restoreLocalTodo(todo: Todo): void {
  todos = todos.map((item) => (item.id === todo.id ? todo : item));
}

function copyChangedTextField(
  changed: TodoChanges,
  field: "title" | "category" | "description",
  current: string,
  value: string | undefined,
): void {
  if (value === undefined || current === value) {
    return;
  }

  switch (field) {
    case "title":
      changed.title = value;
      break;
    case "category":
      changed.category = value;
      break;
    case "description":
      changed.description = value;
      break;
  }
}

function copyChangedNumberField(
  changed: TodoChanges,
  current: number,
  value: number | undefined,
): void {
  if (value !== undefined && current !== value) {
    changed.priority = value;
  }
}

function copyChangedStatusField(
  changed: TodoChanges,
  current: TodoStatus,
  value: TodoStatus | undefined,
): void {
  if (value !== undefined && current !== value) {
    changed.status = value;
  }
}

async function addTodo(): Promise<void> {
  const normalizedTitle = titleInput.value.trim();

  if (!normalizedTitle) {
    titleInput.focus();
    return;
  }

  form.dataset.pending = "true";

  try {
    const todo = todoFromApi(
      await createTodo({
        apiBaseUrl,
        accessToken: accessToken(),
        title: normalizedTitle,
        priority: integerFromInput(priorityInput),
        status: todoStatusFromValue(statusInput.value),
        category: categoryInput.value.trim(),
        description: descriptionInput.value.trim(),
      }),
    );
    todos = [todo, ...todos];
    titleInput.value = "";
    priorityInput.value = "0";
    statusInput.value = "todo";
    categoryInput.value = "";
    descriptionInput.value = "";
    autosizeTextarea(descriptionInput);
    setStatus("");
  } catch (error) {
    setStatus(errorMessage(error, "Could not add task"), "error");
  } finally {
    form.dataset.pending = "false";
    renderTodos();
  }
}

async function updateExistingTodo(
  todo: Todo,
  changes: TodoChanges,
): Promise<void> {
  const normalizedChanges = changedFields(todo, changes);

  if ("title" in normalizedChanges && !String(normalizedChanges.title).trim()) {
    renderTodos();
    return;
  }

  if (Object.keys(normalizedChanges).length === 0) {
    renderTodos();
    return;
  }

  applyLocalTodoChanges(todo, normalizedChanges);

  await withPending(todo.id, async () => {
    try {
      const updated = todoFromApi(
        await updateTodo({
          apiBaseUrl,
          accessToken: accessToken(),
          id: todo.id,
          changes: normalizedChanges,
        }),
      );
      todos = todos.map((item) => (item.id === todo.id ? updated : item));
      setStatus("");
    } catch (error) {
      restoreLocalTodo(todo);
      setStatus(errorMessage(error, "Could not update task"), "error");
    }
  });
}

async function removeTodo(todo: Todo): Promise<void> {
  await withPending(todo.id, async () => {
    try {
      await deleteTodo({
        apiBaseUrl,
        accessToken: accessToken(),
        id: todo.id,
      });
      todos = todos.filter((item) => item.id !== todo.id);
      setStatus("");
    } catch (error) {
      setStatus(errorMessage(error, "Could not delete task"), "error");
    }
  });
}

form.addEventListener("submit", (event: SubmitEvent) => {
  event.preventDefault();
  addTodo();
});

refreshButton.addEventListener("click", loadTodos);
bindAutosizeTextarea(descriptionInput);
loginButton.addEventListener("click", () => {
  beginTodoLogin({
    ...authConfig,
    storage: window.localStorage,
    crypto: window.crypto,
    location: window.location,
  });
});
logoutButton.addEventListener("click", () => {
  window.location.assign(
    todoLogoutUrl({
      ...authConfig,
      storage: window.localStorage,
    }).toString(),
  );
});

for (const button of filterButtons) {
  button.addEventListener("click", () => {
    activeFilter = todoFilterFromValue(button.dataset.filter);
    renderTodos();
  });
}

async function initialize(): Promise<void> {
  app.dataset.ready = "true";
  renderAuth();

  if (hasCognitoConfig()) {
    try {
      authSession =
        (await completeTodoLogin({
          ...authConfig,
          storage: window.localStorage,
        })) || authSession;
    } catch (error) {
      clearTodoSession();
      authSession = null;
      setStatus(errorMessage(error, "Could not sign in"), "error");
    }
  }

  renderAuth();
  loadTodos();
}

initialize();
