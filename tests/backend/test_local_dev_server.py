import json
import unittest
from unittest.mock import patch

from backend.todo_api.local_dev import InMemoryTodoRepository, build_event


class LocalDevServerTest(unittest.TestCase):
    def test_build_event_creates_api_gateway_v2_shape(self):
        event = build_event(
            method="POST",
            path="/todos",
            body=b'{"title":"Buy milk"}',
            headers={"Content-Type": "application/json"},
        )

        self.assertEqual(event["requestContext"]["http"]["method"], "POST")
        self.assertEqual(event["requestContext"]["http"]["path"], "/todos")
        self.assertEqual(event["rawPath"], "/todos")
        self.assertEqual(event["headers"]["content-type"], "application/json")
        self.assertEqual(event["body"], '{"title":"Buy milk"}')
        self.assertEqual(event["isBase64Encoded"], False)

    def test_in_memory_repository_crud_roundtrip(self):
        repository = InMemoryTodoRepository()

        created = repository.create_todo(
            {
                "title": "Buy milk",
                "priority": 2,
                "status": "todo",
                "category": "errands",
                "description": "Use lactose-free milk.",
                "completed": False,
            }
        )
        listed = repository.list_todos()
        updated = repository.update_todo(created["id"], {"status": "done", "completed": True})
        deleted = repository.delete_todo(created["id"])

        self.assertEqual(listed, [created])
        self.assertEqual(updated["status"], "done")
        self.assertEqual(updated["completed"], True)
        self.assertEqual(deleted, True)
        self.assertEqual(repository.list_todos(), [])

    def test_in_memory_repository_sorts_newest_first(self):
        repository = InMemoryTodoRepository()

        with patch("backend.todo_api.local_dev._now", side_effect=["2026-07-19T09:00:00Z", "2026-07-19T10:00:00Z"]):
            first = repository.create_todo(_todo_data("First"))
            second = repository.create_todo(_todo_data("Second"))

        todos = repository.list_todos()

        self.assertEqual([todo["id"] for todo in todos], [second["id"], first["id"]])

    def test_in_memory_repository_returns_none_and_false_for_missing_items(self):
        repository = InMemoryTodoRepository()

        self.assertIsNone(repository.update_todo("missing", {"completed": True}))
        self.assertEqual(repository.delete_todo("missing"), False)

    def test_local_repository_output_is_json_serializable(self):
        repository = InMemoryTodoRepository()
        repository.create_todo(_todo_data("Buy milk"))

        json.dumps(repository.list_todos())


def _todo_data(title):
    return {
        "title": title,
        "priority": 0,
        "status": "todo",
        "category": "",
        "description": "",
        "completed": False,
    }


if __name__ == "__main__":
    unittest.main()
