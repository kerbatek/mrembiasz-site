resource "aws_apigatewayv2_api" "todo" {
  name          = "${var.name_prefix}-http-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_headers = ["Authorization", "Content-Type"]
    allow_methods = ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
    allow_origins = var.allowed_origins
    max_age       = 300
  }

  tags = var.tags
}

resource "aws_apigatewayv2_authorizer" "todo_cognito" {
  api_id           = aws_apigatewayv2_api.todo.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${var.name_prefix}-cognito"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.todo_spa.id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.todo.id}"
  }
}

resource "aws_apigatewayv2_integration" "todo_lambda" {
  api_id                 = aws_apigatewayv2_api.todo.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.todo_api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "todo_collection" {
  for_each = toset(["GET", "POST"])

  api_id             = aws_apigatewayv2_api.todo.id
  route_key          = "${each.key} /todos"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.todo_cognito.id
  target             = "integrations/${aws_apigatewayv2_integration.todo_lambda.id}"
}

resource "aws_apigatewayv2_route" "todo_item" {
  for_each = toset(["PATCH", "DELETE"])

  api_id             = aws_apigatewayv2_api.todo.id
  route_key          = "${each.key} /todos/{id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.todo_cognito.id
  target             = "integrations/${aws_apigatewayv2_integration.todo_lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.todo.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 20
    throttling_rate_limit  = 10
  }

  tags = var.tags
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowExecutionFromApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.todo_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.todo.execution_arn}/*/*"
}
