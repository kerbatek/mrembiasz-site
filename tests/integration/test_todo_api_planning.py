from unittest.mock import patch

from tests.integration.todo_api_support import (
    TodoApiDynamoDbTestCase,
    event,
    response_body,
)


class TodoApiPlanningIntegrationTest(TodoApiDynamoDbTestCase):
    def test_daily_planning_flow_keeps_multiple_tasks_sorted_and_editable(self):
        with patch(
            "backend.todo_api.repository._now",
            side_effect=[
                "2026-07-19T08:00:00Z",
                "2026-07-19T12:00:00Z",
                "2026-07-19T18:00:00Z",
                "2026-07-19T19:00:00Z",
            ],
        ):
            morning = self.create_todo(
                {
                    "title": "Pay rent",
                    "priority": 10,
                    "status": "todo",
                    "category": "finance",
                    "description": "Transfer before noon.",
                }
            )
            afternoon = self.create_todo(
                {
                    "title": "Prepare AWS notes",
                    "priority": 6,
                    "status": "in_progress",
                    "category": "learning",
                    "description": "Summarize DynamoDB and Lambda reminders.",
                }
            )
            evening = self.create_todo(
                {
                    "title": "Buy groceries",
                    "priority": 3,
                    "status": "todo",
                    "category": "home",
                    "description": "Milk, bread, eggs.",
                }
            )

            updated = self.update_todo(
                afternoon["id"],
                {
                    "status": "done",
                    "description": "Notes finished and reviewed.",
                },
            )

        listed = response_body(self.handler(event("GET", "/todos"), None))

        self.assertEqual(
            [todo["id"] for todo in listed],
            [evening["id"], afternoon["id"], morning["id"]],
        )
        self.assertEqual(
            [
                (todo["title"], todo["priority"], todo["status"], todo["category"])
                for todo in listed
            ],
            [
                ("Buy groceries", 3, "todo", "home"),
                ("Prepare AWS notes", 6, "done", "learning"),
                ("Pay rent", 10, "todo", "finance"),
            ],
        )

        self.assertEqual(updated["completed"], True)
        self.assertEqual(updated["status"], "done")
        self.assertEqual(updated["description"], "Notes finished and reviewed.")
