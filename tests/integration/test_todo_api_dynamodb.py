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
class TodoApiDynamoDbIntegrationTest(unittest.TestCase):
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

    def test_todo_api_crud_roundtrip_against_dynamodb_local(self):
        create_response = self.handler(
            event(
                "POST",
                "/todos",
                {
                    "title": "Integration task",
                    "priority": 7,
                    "status": "in_progress",
                    "category": "ci",
                    "description": "DynamoDB Local roundtrip",
                },
            ),
            None,
        )

        created = response_body(create_response)
        self.assertEqual(create_response["statusCode"], 201)
        self.assertEqual(created["title"], "Integration task")
        self.assertEqual(created["priority"], 7)
        self.assertEqual(created["status"], "in_progress")

        list_response = self.handler(event("GET", "/todos"), None)
        self.assertEqual(list_response["statusCode"], 200)
        self.assertEqual(response_body(list_response), [created])

        update_response = self.handler(
            event(
                "PATCH",
                f"/todos/{created['id']}",
                {
                    "status": "done",
                    "priority": 9,
                    "description": "Updated through Lambda handler",
                },
            ),
            None,
        )

        updated = response_body(update_response)
        self.assertEqual(update_response["statusCode"], 200)
        self.assertEqual(updated["status"], "done")
        self.assertEqual(updated["completed"], True)
        self.assertEqual(updated["priority"], 9)

        delete_response = self.handler(event("DELETE", f"/todos/{created['id']}"), None)
        self.assertEqual(delete_response["statusCode"], 204)

        final_list_response = self.handler(event("GET", "/todos"), None)
        self.assertEqual(response_body(final_list_response), [])


if __name__ == "__main__":
    unittest.main()
