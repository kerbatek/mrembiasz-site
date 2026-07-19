from tests.integration.todo_api_support import TodoApiDynamoDbTestCase, event, response_body


class TodoApiValidationIntegrationTest(TodoApiDynamoDbTestCase):
    def test_validation_errors_do_not_create_or_modify_tasks(self):
        existing = self.create_todo(
            {
                "title": "Renew insurance",
                "priority": 8,
                "status": "todo",
                "category": "admin",
                "description": "Check renewal quote.",
            }
        )

        create_error = self.handler(
            event(
                "POST",
                "/todos",
                {
                    "title": "Invalid task",
                    "priority": "high",
                },
            ),
            None,
        )
        update_error = self.handler(
            event(
                "PATCH",
                f"/todos/{existing['id']}",
                {
                    "status": "blocked",
                },
            ),
            None,
        )
        listed = response_body(self.handler(event("GET", "/todos"), None))

        self.assertEqual(create_error["statusCode"], 400)
        self.assertEqual(update_error["statusCode"], 400)
        self.assertEqual(len(listed), 1)
        self.assertEqual(listed[0]["title"], "Renew insurance")
        self.assertEqual(listed[0]["priority"], 8)
        self.assertEqual(listed[0]["status"], "todo")
