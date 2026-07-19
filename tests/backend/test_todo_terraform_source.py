from pathlib import Path
import re
import unittest


class TodoTerraformSourceTest(unittest.TestCase):
    def test_lambda_memory_is_set_to_256_mb(self):
        source = Path("infra/aws-personal-todo/lambda.tf").read_text()

        self.assertRegex(source, re.compile(r"memory_size\s*=\s*256"))


if __name__ == "__main__":
    unittest.main()
