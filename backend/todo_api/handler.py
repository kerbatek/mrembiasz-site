import base64
import json
import os

from .repository import DynamoDbTodoRepository


ALLOWED_METHODS = "GET,POST,PATCH,DELETE,OPTIONS"
ALLOWED_HEADERS = "Content-Type,Authorization"
TODO_STATUSES = ("todo", "in_progress", "done")
_repository = None


def create_handler(repository_factory=None):
    def lambda_handler(event, context):
        del context

        method = _method_from_event(event)
        path = _path_from_event(event)
        return _handle_request(event, method, path, repository_factory)

    return lambda_handler


handler = create_handler()


def _handle_request(event, method, path, repository_factory=None):
    if method == "OPTIONS":
        return _response(204)

    if not _is_authorized(event):
        return _json_response(401, {"message": "unauthorized"})

    try:
        repository = (
            repository_factory() if repository_factory else _repository_from_env()
        )

        if method == "GET" and path == "/todos":
            return _json_response(200, repository.list_todos())

        if method == "POST" and path == "/todos":
            body = _json_body(event)
            todo_data = _todo_data_from_body(body)
            return _json_response(201, repository.create_todo(todo_data))

        todo_id = _todo_id_from_path(path)
        if todo_id and method == "PATCH":
            body = _json_body(event)
            changes = _changes_from_body(body)
            todo = repository.update_todo(todo_id, changes)

            if todo is None:
                return _json_response(404, {"message": "todo not found"})

            return _json_response(200, todo)

        if todo_id and method == "DELETE":
            deleted = repository.delete_todo(todo_id)

            if not deleted:
                return _json_response(404, {"message": "todo not found"})

            return _response(204)

        return _json_response(404, {"message": "route not found"})
    except ValueError as error:
        return _json_response(400, {"message": str(error)})


def _repository_from_env():
    global _repository

    if _repository is None:
        _repository = DynamoDbTodoRepository.from_env()

    return _repository


def _method_from_event(event):
    return (
        event.get("requestContext", {})
        .get("http", {})
        .get("method", event.get("httpMethod", ""))
        .upper()
    )


def _path_from_event(event):
    path = event.get("rawPath") or event.get("path") or "/"
    normalized = path.rstrip("/")
    return normalized or "/"


def _todo_id_from_path(path):
    prefix = "/todos/"

    if not path.startswith(prefix):
        return None

    todo_id = path.removeprefix(prefix).strip()
    return todo_id or None


def _json_body(event):
    raw_body = event.get("body")

    if raw_body is None or raw_body == "":
        return {}

    if event.get("isBase64Encoded"):
        raw_body = base64.b64decode(raw_body).decode("utf-8")

    try:
        body = json.loads(raw_body)
    except json.JSONDecodeError as error:
        raise ValueError("request body must be valid JSON") from error

    if not isinstance(body, dict):
        raise ValueError("request body must be a JSON object")

    return body


def _is_authorized(event):
    if os.environ.get("TODO_AUTH_MODE") != "cognito":
        return True

    if _has_cognito_claims(event):
        return True

    return _has_local_access_token(event)


def _has_cognito_claims(event):
    claims = (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("jwt", {})
        .get("claims", {})
    )

    return bool(claims.get("sub"))


def _has_local_access_token(event):
    local_access_token = os.environ.get("TODO_LOCAL_ACCESS_TOKEN")

    if not local_access_token:
        return False

    authorization = _header(event, "authorization") or ""
    return authorization == f"Bearer {local_access_token}"


def _header(event, name):
    headers = event.get("headers") or {}
    normalized_name = name.lower()

    for key, value in headers.items():
        if key.lower() == normalized_name:
            return value

    return None


def _title_from_body(body):
    title = body.get("title")

    if not isinstance(title, str) or not title.strip():
        raise ValueError("title is required")

    return title.strip()


def _todo_data_from_body(body):
    status = _status_from_body(body, default="todo")

    return {
        "title": _title_from_body(body),
        "priority": _priority_from_body(body, default=0),
        "status": status,
        "category": _string_field_from_body(body, "category", default=""),
        "description": _string_field_from_body(body, "description", default=""),
        "completed": status == "done",
    }


def _changes_from_body(body):
    changes = {}

    if "title" in body:
        changes["title"] = _title_from_body(body)

    if "priority" in body:
        changes["priority"] = _priority_from_body(body)

    if "status" in body:
        changes["status"] = _status_from_body(body)
        changes["completed"] = changes["status"] == "done"

    if "category" in body:
        changes["category"] = _string_field_from_body(body, "category")

    if "description" in body:
        changes["description"] = _string_field_from_body(body, "description")

    if "completed" in body:
        if not isinstance(body["completed"], bool):
            raise ValueError("completed must be a boolean")

        changes["completed"] = body["completed"]

        if "status" not in changes:
            changes["status"] = "done" if body["completed"] else "todo"

    if not changes:
        raise ValueError("at least one editable field is required")

    return changes


def _priority_from_body(body, default=None):
    priority = body.get("priority", default)

    if not isinstance(priority, int) or isinstance(priority, bool):
        raise ValueError("priority must be an integer")

    return priority


def _status_from_body(body, default=None):
    status = body.get("status", default)

    if status not in TODO_STATUSES:
        raise ValueError(f"status must be one of: {', '.join(TODO_STATUSES)}")

    return status


def _string_field_from_body(body, field, default=None):
    value = body.get(field, default)

    if not isinstance(value, str):
        raise ValueError(f"{field} must be a string")

    return value.strip()


def _json_response(status_code, body):
    return _response(
        status_code,
        body=json.dumps(body, separators=(",", ":")),
        extra_headers={"Content-Type": "application/json"},
    )


def _response(status_code, body=None, extra_headers=None):
    headers = {
        "Access-Control-Allow-Origin": os.environ.get("TODO_ALLOWED_ORIGIN", "*"),
        "Access-Control-Allow-Methods": ALLOWED_METHODS,
        "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    }

    if extra_headers:
        headers.update(extra_headers)

    response = {
        "statusCode": status_code,
        "headers": headers,
    }

    if body is not None:
        response["body"] = body

    return response
