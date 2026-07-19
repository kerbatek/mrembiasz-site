import json
import os
import unittest

from backend.todo_api.bootstrap_local_dynamodb import ensure_table
from backend.todo_api.handler import create_handler
from backend.todo_api.repository import DynamoDbTodoRepository


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


def response_body(response):
    return json.loads(response["body"]) if response.get("body") else None


@unittest.skipUnless(
    os.environ.get("RUN_INTEGRATION_TESTS") == "1",
    "integration tests require RUN_INTEGRATION_TESTS=1",
)
class TodoApiDynamoDbTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.endpoint_url = os.environ["TODO_DYNAMODB_ENDPOINT"]
        cls.table_name = os.environ["TODO_TABLE_NAME"]
        ensure_table(endpoint_url=cls.endpoint_url, table_name=cls.table_name)

        import boto3

        cls.table = boto3.resource(
            "dynamodb",
            endpoint_url=cls.endpoint_url,
        ).Table(cls.table_name)

    def setUp(self):
        for item in self.table.scan(ConsistentRead=True).get("Items", []):
            self.table.delete_item(Key={"id": item["id"]})

        self.handler = create_handler(DynamoDbTodoRepository.from_env)

    def create_todo(self, body):
        response = self.handler(event("POST", "/todos", body), None)
        self.assertEqual(response["statusCode"], 201)
        return response_body(response)

    def update_todo(self, todo_id, body):
        response = self.handler(event("PATCH", f"/todos/{todo_id}", body), None)
        self.assertEqual(response["statusCode"], 200)
        return response_body(response)
