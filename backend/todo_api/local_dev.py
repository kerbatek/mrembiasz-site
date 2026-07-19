import argparse
from datetime import UTC, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from uuid import uuid4

from .handler import create_handler
from .repository import DynamoDbTodoRepository


class InMemoryTodoRepository:
    def __init__(self):
        self.todos = {}

    def list_todos(self):
        return sorted(
            [todo.copy() for todo in self.todos.values()],
            key=lambda todo: todo["createdAt"],
            reverse=True,
        )

    def create_todo(self, todo_data):
        now = _now()
        todo = {
            "id": str(uuid4()),
            **todo_data,
            "createdAt": now,
            "updatedAt": now,
        }
        self.todos[todo["id"]] = todo
        return todo.copy()

    def update_todo(self, todo_id, changes):
        existing = self.todos.get(todo_id)

        if existing is None:
            return None

        updated = {
            **existing,
            **changes,
            "updatedAt": _now(),
        }
        self.todos[todo_id] = updated
        return updated.copy()

    def delete_todo(self, todo_id):
        return self.todos.pop(todo_id, None) is not None


def build_event(method, path, body=b"", headers=None):
    normalized_headers = {key.lower(): value for key, value in (headers or {}).items()}

    return {
        "requestContext": {
            "http": {
                "method": method,
                "path": path,
            },
        },
        "rawPath": path,
        "headers": normalized_headers,
        "body": body.decode("utf-8") if body else None,
        "isBase64Encoded": False,
    }


def create_request_handler(lambda_handler):
    class TodoDevRequestHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            self._handle_request()

        def do_POST(self):
            self._handle_request()

        def do_PATCH(self):
            self._handle_request()

        def do_DELETE(self):
            self._handle_request()

        def do_OPTIONS(self):
            self._handle_request()

        def log_message(self, format, *args):
            return

        def _handle_request(self):
            body = self.rfile.read(_content_length(self.headers))
            event = build_event(
                method=self.command,
                path=self.path.split("?", 1)[0],
                body=body,
                headers=dict(self.headers.items()),
            )
            response = lambda_handler(event, None)
            self.send_response(response["statusCode"])

            for key, value in response.get("headers", {}).items():
                self.send_header(key, value)

            self.end_headers()

            if "body" in response:
                self.wfile.write(response["body"].encode("utf-8"))

    return TodoDevRequestHandler


def run(host="127.0.0.1", port=3000, storage="memory"):
    repository = _repository_for_storage(storage)
    lambda_handler = create_handler(lambda: repository)
    server = ThreadingHTTPServer((host, port), create_request_handler(lambda_handler))
    print(f"Todo API dev server running at http://{host}:{port}")
    if storage == "dynamodb":
        print("Data is stored in DynamoDB.")
    else:
        print("Data is stored in memory and resets when the server stops.")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


def main():
    parser = argparse.ArgumentParser(description="Run the local Todo API dev server.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=3000, type=int)
    parser.add_argument("--storage", choices=("memory", "dynamodb"), default="memory")
    args = parser.parse_args()

    run(host=args.host, port=args.port, storage=args.storage)


def _content_length(headers):
    value = headers.get("Content-Length", "0")

    try:
        return int(value)
    except ValueError:
        return 0


def _now():
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _repository_for_storage(storage):
    if storage == "dynamodb":
        return DynamoDbTodoRepository.from_env()

    return InMemoryTodoRepository()


if __name__ == "__main__":
    main()
