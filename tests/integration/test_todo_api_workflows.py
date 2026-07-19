from tests.integration.todo_api_support import (
    TodoApiDynamoDbTestCase,
    event,
    response_body,
)


class TodoApiWorkflowIntegrationTest(TodoApiDynamoDbTestCase):
    def test_status_transitions_keep_completed_compatibility_field_in_sync(self):
        todo = self.create_todo(
            {
                "title": "Write deployment checklist",
                "priority": 4,
                "status": "todo",
                "category": "project",
                "description": "",
            }
        )

        in_progress = self.update_todo(todo["id"], {"status": "in_progress"})
        done = self.update_todo(todo["id"], {"status": "done"})
        reopened = self.update_todo(todo["id"], {"completed": False})
        completed = self.update_todo(todo["id"], {"completed": True})

        self.assertEqual(
            (in_progress["status"], in_progress["completed"]), ("in_progress", False)
        )
        self.assertEqual((done["status"], done["completed"]), ("done", True))
        self.assertEqual((reopened["status"], reopened["completed"]), ("todo", False))
        self.assertEqual((completed["status"], completed["completed"]), ("done", True))

    def test_deleting_one_category_task_preserves_other_personal_work(self):
        home_task = self.create_todo(
            {
                "title": "Clean desk",
                "priority": 2,
                "status": "todo",
                "category": "home",
                "description": "",
            }
        )
        work_task = self.create_todo(
            {
                "title": "Review pull request",
                "priority": 5,
                "status": "in_progress",
                "category": "work",
                "description": "Check CI and infra changes.",
            }
        )

        delete_response = self.handler(
            event("DELETE", f"/todos/{home_task['id']}"), None
        )
        listed = response_body(self.handler(event("GET", "/todos"), None))

        self.assertEqual(delete_response["statusCode"], 204)
        self.assertEqual([todo["id"] for todo in listed], [work_task["id"]])
        self.assertEqual(listed[0]["category"], "work")
        self.assertEqual(listed[0]["title"], "Review pull request")
