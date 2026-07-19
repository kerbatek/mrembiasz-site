import unittest
from pathlib import Path


class NoTimingInstrumentationTest(unittest.TestCase):
    def test_backend_and_terraform_do_not_include_temporary_timing_logs(self):
        for path in [
            Path("backend/todo_api/handler.py"),
            Path("backend/todo_api/repository.py"),
            Path("infra/aws-personal-todo/lambda.tf"),
        ]:
            with self.subTest(path=str(path)):
                source = path.read_text()
                self.assertNotIn("TODO_TIMING_LOGS", source)
                self.assertNotIn("timing ", source)
                self.assertNotIn("perf_counter", source)


if __name__ == "__main__":
    unittest.main()
