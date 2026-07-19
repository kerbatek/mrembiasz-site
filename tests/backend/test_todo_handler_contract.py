import base64
import json
import os
import unittest
from unittest.mock import patch

import backend.todo_api.handler as todo_handler
from backend.todo_api.handler import create_handler


class InMemoryTodoRepository:
    def __init__(self):
        self.todos = {}

    def list_todos(self):
        return list(self.todos.values())

    def create_todo(self, todo_data):
        todo = {
            "id": "task-1",
            **todo_data,
            "completed": False,
            "createdAt": "2026-07-19T10:00:00Z",
            "updatedAt": "2026-07-19T10:00:00Z",
        }
        self.todos[todo["id"]] = todo
        return todo

    def update_todo(self, todo_id, changes):
        if todo_id not in self.todos:
            return None

        updated = {**self.todos[todo_id], **changes}
        updated["updatedAt"] = "2026-07-19T11:00:00Z"
        self.todos[todo_id] = updated
        return updated

    def delete_todo(self, todo_id):
        return self.todos.pop(todo_id, None) is not None


def event(method, path, body=None):
    return {
        "requestContext": {
            "http": {
                "method": method,
                "path": path,
            },
        },
        "rawPath": path,
        "body": json.dumps(body) if body is not None else None,
    }


def v1_event(method, path, body=None):
    return {
        "httpMethod": method,
        "path": path,
        "body": json.dumps(body) if body is not None else None,
    }


def response_body(response):
    return json.loads(response["body"]) if response.get("body") else None


class TodoHandlerContractTest(unittest.TestCase):
    def setUp(self):
        self.repository = InMemoryTodoRepository()
        self.handler = create_handler(lambda: self.repository)

    def test_get_todos_returns_json_array(self):
        self.repository.create_todo(
            {
                "title": "Pay invoice",
                "priority": 2,
                "status": "todo",
                "category": "finance",
                "description": "",
            }
        )

        response = self.handler(event("GET", "/todos"), None)

        self.assertEqual(response["statusCode"], 200)
        self.assertEqual(response["headers"]["Content-Type"], "application/json")
        self.assertEqual(response["headers"]["Access-Control-Allow-Origin"], "*")
        self.assertEqual(response_body(response)[0]["title"], "Pay invoice")

    def test_default_handler_reuses_repository_between_warm_invocations(self):
        todo_handler._repository = None
        repository = InMemoryTodoRepository()

        with patch.object(
            todo_handler.DynamoDbTodoRepository, "from_env", return_value=repository
        ) as from_env:
            handler = create_handler()
            self.assertEqual(handler(event("GET", "/todos"), None)["statusCode"], 200)
            self.assertEqual(handler(event("GET", "/todos"), None)["statusCode"], 200)

        self.assertEqual(from_env.call_count, 1)
        todo_handler._repository = None

    def test_auth_is_not_required_when_cognito_mode_is_not_enabled(self):
        response = self.handler(event("GET", "/todos"), None)

        self.assertEqual(response["statusCode"], 200)

    def test_cognito_mode_rejects_missing_authorizer_claims(self):
        with patch.dict(os.environ, {"TODO_AUTH_MODE": "cognito"}):
            response = self.handler(event("GET", "/todos"), None)

        self.assertEqual(response["statusCode"], 401)
        self.assertEqual(response_body(response)["message"], "unauthorized")

    def test_cognito_mode_accepts_api_gateway_jwt_authorizer_claims(self):
        request = event("GET", "/todos")
        request["requestContext"]["authorizer"] = {
            "jwt": {
                "claims": {
                    "sub": "user-123",
                    "client_id": "todo-client",
                },
            },
        }

        with patch.dict(os.environ, {"TODO_AUTH_MODE": "cognito"}):
            response = self.handler(request, None)

        self.assertEqual(response["statusCode"], 200)

    def test_cognito_mode_accepts_matching_local_bearer_token(self):
        request = event("GET", "/todos")
        request["headers"] = {"Authorization": "Bearer local-token"}

        with patch.dict(
            os.environ,
            {
                "TODO_AUTH_MODE": "cognito",
                "TODO_LOCAL_ACCESS_TOKEN": "local-token",
            },
        ):
            response = self.handler(request, None)

        self.assertEqual(response["statusCode"], 200)

    def test_options_does_not_require_cognito_authorizer_claims(self):
        with patch.dict(os.environ, {"TODO_AUTH_MODE": "cognito"}):
            response = self.handler(event("OPTIONS", "/todos"), None)

        self.assertEqual(response["statusCode"], 204)

    def test_get_todos_supports_api_gateway_v1_events(self):
        self.repository.create_todo(
            {
                "title": "Pay invoice",
                "priority": 2,
                "status": "todo",
                "category": "finance",
                "description": "",
            }
        )

        response = self.handler(v1_event("GET", "/todos/"), None)

        self.assertEqual(response["statusCode"], 200)
        self.assertEqual(response_body(response)[0]["title"], "Pay invoice")

    def test_post_todos_creates_todo(self):
        response = self.handler(
            event(
                "POST",
                "/todos",
                {
                    "title": "  Buy milk  ",
                    "priority": 3,
                    "status": "in_progress",
                    "category": "errands",
                    "description": "  Use lactose-free milk.  ",
                },
            ),
            None,
        )

        self.assertEqual(response["statusCode"], 201)
        self.assertEqual(
            response_body(response),
            {
                "id": "task-1",
                "title": "Buy milk",
                "priority": 3,
                "status": "in_progress",
                "category": "errands",
                "description": "Use lactose-free milk.",
                "completed": False,
                "createdAt": "2026-07-19T10:00:00Z",
                "updatedAt": "2026-07-19T10:00:00Z",
            },
        )

    def test_post_todos_uses_defaults_for_optional_fields(self):
        response = self.handler(event("POST", "/todos", {"title": "Buy milk"}), None)

        self.assertEqual(response["statusCode"], 201)
        self.assertEqual(response_body(response)["priority"], 0)
        self.assertEqual(response_body(response)["status"], "todo")
        self.assertEqual(response_body(response)["category"], "")
        self.assertEqual(response_body(response)["description"], "")

    def test_post_todos_rejects_blank_title(self):
        response = self.handler(event("POST", "/todos", {"title": "   "}), None)

        self.assertEqual(response["statusCode"], 400)
        self.assertEqual(response_body(response)["message"], "title is required")

    def test_post_todos_rejects_invalid_status(self):
        response = self.handler(
            event("POST", "/todos", {"title": "Buy milk", "status": "blocked"}), None
        )

        self.assertEqual(response["statusCode"], 400)
        self.assertEqual(
            response_body(response)["message"],
            "status must be one of: todo, in_progress, done",
        )

    def test_post_todos_rejects_non_integer_priority(self):
        response = self.handler(
            event("POST", "/todos", {"title": "Buy milk", "priority": "high"}), None
        )

        self.assertEqual(response["statusCode"], 400)
        self.assertEqual(
            response_body(response)["message"], "priority must be an integer"
        )

    def test_post_todos_rejects_boolean_priority(self):
        response = self.handler(
            event("POST", "/todos", {"title": "Buy milk", "priority": True}), None
        )

        self.assertEqual(response["statusCode"], 400)
        self.assertEqual(
            response_body(response)["message"], "priority must be an integer"
        )

    def test_post_todos_rejects_non_string_category(self):
        response = self.handler(
            event("POST", "/todos", {"title": "Buy milk", "category": 12}), None
        )

        self.assertEqual(response["statusCode"], 400)
        self.assertEqual(
            response_body(response)["message"], "category must be a string"
        )

    def test_post_todos_rejects_invalid_json(self):
        response = self.handler(
            {
                "requestContext": {"http": {"method": "POST", "path": "/todos"}},
                "rawPath": "/todos",
                "body": "{",
            },
            None,
        )

        self.assertEqual(response["statusCode"], 400)
        self.assertEqual(
            response_body(response)["message"], "request body must be valid JSON"
        )

    def test_post_todos_rejects_json_array_body(self):
        response = self.handler(
            {
                "requestContext": {"http": {"method": "POST", "path": "/todos"}},
                "rawPath": "/todos",
                "body": json.dumps(["not", "an", "object"]),
            },
            None,
        )

        self.assertEqual(response["statusCode"], 400)
        self.assertEqual(
            response_body(response)["message"], "request body must be a JSON object"
        )

    def test_post_todos_supports_base64_encoded_body(self):
        body = base64.b64encode(
            json.dumps({"title": "Encoded task"}).encode("utf-8")
        ).decode("utf-8")

        response = self.handler(
            {
                "requestContext": {"http": {"method": "POST", "path": "/todos"}},
                "rawPath": "/todos",
                "body": body,
                "isBase64Encoded": True,
            },
            None,
        )

        self.assertEqual(response["statusCode"], 201)
        self.assertEqual(response_body(response)["title"], "Encoded task")

    def test_patch_todo_updates_allowed_fields(self):
        self.repository.create_todo(
            {
                "title": "Pay invoice",
                "priority": 1,
                "status": "todo",
                "category": "finance",
                "description": "",
            }
        )

        response = self.handler(
            event(
                "PATCH",
                "/todos/task-1",
                {
                    "title": "Paid invoice",
                    "completed": True,
                    "priority": 5,
                    "status": "done",
                    "category": "admin",
                    "description": "Filed receipt.",
                },
            ),
            None,
        )

        self.assertEqual(response["statusCode"], 200)
        self.assertEqual(response_body(response)["title"], "Paid invoice")
        self.assertEqual(response_body(response)["completed"], True)
        self.assertEqual(response_body(response)["priority"], 5)
        self.assertEqual(response_body(response)["status"], "done")
        self.assertEqual(response_body(response)["category"], "admin")
        self.assertEqual(response_body(response)["description"], "Filed receipt.")

    def test_patch_todo_returns_404_for_missing_todo(self):
        response = self.handler(
            event("PATCH", "/todos/missing", {"completed": True}), None
        )

        self.assertEqual(response["statusCode"], 404)
        self.assertEqual(response_body(response)["message"], "todo not found")

    def test_patch_todo_rejects_empty_change_set(self):
        self.repository.create_todo(
            {
                "title": "Pay invoice",
                "priority": 1,
                "status": "todo",
                "category": "finance",
                "description": "",
            }
        )

        response = self.handler(
            event("PATCH", "/todos/task-1", {"unknown": "ignored"}), None
        )

        self.assertEqual(response["statusCode"], 400)
        self.assertEqual(
            response_body(response)["message"],
            "at least one editable field is required",
        )

    def test_patch_completed_false_sets_status_todo(self):
        self.repository.create_todo(
            {
                "title": "Pay invoice",
                "priority": 1,
                "status": "done",
                "category": "finance",
                "description": "",
                "completed": True,
            }
        )

        response = self.handler(
            event("PATCH", "/todos/task-1", {"completed": False}), None
        )

        self.assertEqual(response["statusCode"], 200)
        self.assertEqual(response_body(response)["completed"], False)
        self.assertEqual(response_body(response)["status"], "todo")

    def test_delete_todo_returns_no_content(self):
        self.repository.create_todo(
            {
                "title": "Pay invoice",
                "priority": 1,
                "status": "todo",
                "category": "finance",
                "description": "",
            }
        )

        response = self.handler(event("DELETE", "/todos/task-1"), None)

        self.assertEqual(response["statusCode"], 204)
        self.assertNotIn("body", response)

    def test_delete_todo_returns_404_for_missing_todo(self):
        response = self.handler(event("DELETE", "/todos/missing"), None)

        self.assertEqual(response["statusCode"], 404)
        self.assertEqual(response_body(response)["message"], "todo not found")

    def test_unknown_route_returns_404(self):
        response = self.handler(event("GET", "/unknown"), None)

        self.assertEqual(response["statusCode"], 404)
        self.assertEqual(response_body(response)["message"], "route not found")

    def test_options_returns_cors_preflight_response(self):
        response = self.handler(event("OPTIONS", "/todos"), None)

        self.assertEqual(response["statusCode"], 204)
        self.assertEqual(
            response["headers"]["Access-Control-Allow-Methods"],
            "GET,POST,PATCH,DELETE,OPTIONS",
        )

    def test_cors_origin_can_be_configured(self):
        with patch.dict(os.environ, {"TODO_ALLOWED_ORIGIN": "https://mrembiasz.pl"}):
            response = self.handler(event("OPTIONS", "/todos"), None)

        self.assertEqual(
            response["headers"]["Access-Control-Allow-Origin"], "https://mrembiasz.pl"
        )


if __name__ == "__main__":
    unittest.main()
