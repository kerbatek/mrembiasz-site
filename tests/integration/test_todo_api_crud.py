from tests.integration.todo_api_support import TodoApiDynamoDbTestCase, event, response_body


class TodoApiCrudIntegrationTest(TodoApiDynamoDbTestCase):
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
