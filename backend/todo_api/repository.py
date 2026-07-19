import os
from datetime import UTC, datetime
from uuid import uuid4


class DynamoDbTodoRepository:
    def __init__(self, table):
        self.table = table

    @classmethod
    def from_env(cls):
        table_name = os.environ.get("TODO_TABLE_NAME")

        if not table_name:
            raise RuntimeError("TODO_TABLE_NAME is required")

        import boto3

        resource_kwargs = {}
        endpoint_url = os.environ.get("TODO_DYNAMODB_ENDPOINT")

        if endpoint_url:
            resource_kwargs["endpoint_url"] = endpoint_url

        return cls(boto3.resource("dynamodb", **resource_kwargs).Table(table_name))

    def list_todos(self):
        response = self.table.scan()
        todos = [_todo_from_item(item) for item in response.get("Items", [])]
        return sorted(todos, key=lambda todo: todo["createdAt"], reverse=True)

    def create_todo(self, todo_data):
        now = _now()
        todo = {
            "id": str(uuid4()),
            **todo_data,
            "createdAt": now,
            "updatedAt": now,
        }

        self.table.put_item(Item=todo)
        return todo

    def update_todo(self, todo_id, changes):
        existing = self.table.get_item(Key={"id": todo_id}).get("Item")

        if existing is None:
            return None

        updated = {
            **existing,
            **changes,
            "updatedAt": _now(),
        }

        self.table.put_item(Item=updated)
        return _todo_from_item(updated)

    def delete_todo(self, todo_id):
        existing = self.table.get_item(Key={"id": todo_id}).get("Item")

        if existing is None:
            return False

        self.table.delete_item(Key={"id": todo_id})
        return True


def _todo_from_item(item):
    return {
        "id": str(item["id"]),
        "title": str(item["title"]),
        "priority": int(item.get("priority", 0)),
        "status": str(item.get("status", "done" if item.get("completed") else "todo")),
        "category": str(item.get("category", "")),
        "description": str(item.get("description", "")),
        "completed": bool(item["completed"]),
        "createdAt": str(item["createdAt"]),
        "updatedAt": str(item["updatedAt"]),
    }


def _now():
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
