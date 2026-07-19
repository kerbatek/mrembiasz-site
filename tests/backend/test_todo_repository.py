import unittest
from types import SimpleNamespace
from unittest.mock import patch

from backend.todo_api.repository import DynamoDbTodoRepository


class FakeDynamoDbTable:
    def __init__(self, items=None):
        self.items = {item["id"]: item.copy() for item in items or []}
        self.put_items = []
        self.deleted_keys = []
        self.scan_kwargs = []

    def scan(self, **kwargs):
        self.scan_kwargs.append(kwargs)
        return {"Items": list(self.items.values())}

    def put_item(self, Item):
        self.put_items.append(Item.copy())
        self.items[Item["id"]] = Item.copy()

    def get_item(self, Key):
        item = self.items.get(Key["id"])
        return {"Item": item.copy()} if item else {}

    def delete_item(self, Key):
        self.deleted_keys.append(Key.copy())
        self.items.pop(Key["id"], None)


class TodoRepositoryTest(unittest.TestCase):
    def test_from_env_uses_table_name_and_optional_local_endpoint(self):
        class FakeDynamoDbResource:
            def __init__(self):
                self.table_name = None

            def Table(self, table_name):
                self.table_name = table_name
                return FakeDynamoDbTable()

        fake_resource = FakeDynamoDbResource()
        calls = []

        def fake_resource_factory(service_name, **kwargs):
            calls.append((service_name, kwargs))
            return fake_resource

        with (
            patch.dict(
                "os.environ",
                {
                    "TODO_TABLE_NAME": "personal-todos",
                    "TODO_DYNAMODB_ENDPOINT": "http://127.0.0.1:8000",
                },
                clear=True,
            ),
            patch.dict(
                "sys.modules",
                {"boto3": SimpleNamespace(resource=fake_resource_factory)},
            ),
        ):
            repository = DynamoDbTodoRepository.from_env()

        self.assertIsInstance(repository.table, FakeDynamoDbTable)
        self.assertEqual(fake_resource.table_name, "personal-todos")
        self.assertEqual(
            calls, [("dynamodb", {"endpoint_url": "http://127.0.0.1:8000"})]
        )

    def test_from_env_requires_table_name(self):
        with patch.dict("os.environ", {}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "TODO_TABLE_NAME is required"):
                DynamoDbTodoRepository.from_env()

    def test_list_todos_normalizes_legacy_items_and_sorts_newest_first(self):
        table = FakeDynamoDbTable(
            [
                {
                    "id": "older",
                    "title": "Older task",
                    "completed": False,
                    "createdAt": "2026-07-19T09:00:00Z",
                    "updatedAt": "2026-07-19T09:00:00Z",
                },
                {
                    "id": "newer",
                    "title": "Newer task",
                    "priority": 2,
                    "status": "in_progress",
                    "category": "work",
                    "description": "Follow up",
                    "completed": False,
                    "createdAt": "2026-07-19T10:00:00Z",
                    "updatedAt": "2026-07-19T10:00:00Z",
                },
            ]
        )

        todos = DynamoDbTodoRepository(table).list_todos()

        self.assertEqual([todo["id"] for todo in todos], ["newer", "older"])
        self.assertEqual(table.scan_kwargs, [{}])
        self.assertEqual(todos[1]["priority"], 0)
        self.assertEqual(todos[1]["status"], "todo")
        self.assertEqual(todos[1]["category"], "")
        self.assertEqual(todos[1]["description"], "")

    def test_create_todo_persists_full_item_with_generated_id_and_timestamps(self):
        table = FakeDynamoDbTable()

        with (
            patch("backend.todo_api.repository.uuid4", return_value="generated-id"),
            patch(
                "backend.todo_api.repository._now", return_value="2026-07-19T10:00:00Z"
            ),
        ):
            todo = DynamoDbTodoRepository(table).create_todo(
                {
                    "title": "Buy milk",
                    "priority": 3,
                    "status": "in_progress",
                    "category": "errands",
                    "description": "Use lactose-free milk.",
                    "completed": False,
                }
            )

        self.assertEqual(todo["id"], "generated-id")
        self.assertEqual(todo["createdAt"], "2026-07-19T10:00:00Z")
        self.assertEqual(table.put_items[0], todo)

    def test_update_todo_merges_changes_and_updates_timestamp(self):
        table = FakeDynamoDbTable(
            [
                {
                    "id": "task-1",
                    "title": "Buy milk",
                    "priority": 1,
                    "status": "todo",
                    "category": "errands",
                    "description": "",
                    "completed": False,
                    "createdAt": "2026-07-19T10:00:00Z",
                    "updatedAt": "2026-07-19T10:00:00Z",
                }
            ]
        )

        with patch(
            "backend.todo_api.repository._now", return_value="2026-07-19T11:00:00Z"
        ):
            todo = DynamoDbTodoRepository(table).update_todo(
                "task-1",
                {"priority": 5, "status": "done", "completed": True},
            )

        self.assertEqual(todo["title"], "Buy milk")
        self.assertEqual(todo["priority"], 5)
        self.assertEqual(todo["status"], "done")
        self.assertEqual(todo["completed"], True)
        self.assertEqual(todo["updatedAt"], "2026-07-19T11:00:00Z")

    def test_update_todo_returns_none_when_missing(self):
        table = FakeDynamoDbTable()

        todo = DynamoDbTodoRepository(table).update_todo("missing", {"completed": True})

        self.assertIsNone(todo)
        self.assertEqual(table.put_items, [])

    def test_delete_todo_deletes_existing_item(self):
        table = FakeDynamoDbTable(
            [
                {
                    "id": "task-1",
                    "title": "Buy milk",
                    "completed": False,
                    "createdAt": "2026-07-19T10:00:00Z",
                    "updatedAt": "2026-07-19T10:00:00Z",
                }
            ]
        )

        deleted = DynamoDbTodoRepository(table).delete_todo("task-1")

        self.assertEqual(deleted, True)
        self.assertEqual(table.deleted_keys, [{"id": "task-1"}])

    def test_delete_todo_returns_false_when_missing(self):
        table = FakeDynamoDbTable()

        deleted = DynamoDbTodoRepository(table).delete_todo("missing")

        self.assertEqual(deleted, False)
        self.assertEqual(table.deleted_keys, [])


if __name__ == "__main__":
    unittest.main()
