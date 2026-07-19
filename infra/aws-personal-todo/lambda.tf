data "archive_file" "todo_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/../../backend"
  output_path = "${path.module}/.terraform/${var.name_prefix}-lambda.zip"

  excludes = [
    "**/__pycache__/**",
    "**/*.pyc",
  ]
}

resource "aws_cloudwatch_log_group" "todo_lambda" {
  name              = "/aws/lambda/${local.lambda_function_name}"
  retention_in_days = 14
  tags              = var.tags
}

resource "aws_lambda_function" "todo_api" {
  function_name    = local.lambda_function_name
  role             = aws_iam_role.todo_lambda.arn
  handler          = "todo_api.handler.handler"
  runtime          = var.lambda_runtime
  filename         = data.archive_file.todo_lambda.output_path
  source_code_hash = data.archive_file.todo_lambda.output_base64sha256
  timeout          = 10
  memory_size      = 256

  environment {
    variables = {
      TODO_AUTH_MODE  = "cognito"
      TODO_TABLE_NAME = aws_dynamodb_table.todos.name
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.todo_lambda,
    aws_iam_role_policy.todo_lambda,
  ]

  tags = var.tags
}
