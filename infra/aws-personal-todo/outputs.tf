output "api_endpoint" {
  description = "Base URL for the todo HTTP API."
  value       = aws_apigatewayv2_api.todo.api_endpoint
}

output "dynamodb_table_name" {
  description = "DynamoDB table used by the todo API."
  value       = aws_dynamodb_table.todos.name
}

output "lambda_function_name" {
  description = "Todo API Lambda function name."
  value       = aws_lambda_function.todo_api.function_name
}

output "cognito_user_pool_id" {
  description = "Cognito user pool ID."
  value       = aws_cognito_user_pool.todo.id
}

output "cognito_user_pool_client_id" {
  description = "Cognito app client ID for the SPA."
  value       = aws_cognito_user_pool_client.todo_spa.id
}

output "cognito_issuer" {
  description = "JWT issuer configured on the API Gateway authorizer."
  value       = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.todo.id}"
}

output "cognito_hosted_ui_base_url" {
  description = "Cognito hosted UI base URL when cognito_domain_prefix is set."
  value = var.cognito_domain_prefix == null ? null : (
    "https://${aws_cognito_user_pool_domain.todo[0].domain}.auth.${var.aws_region}.amazoncognito.com"
  )
}
