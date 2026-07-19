# Todo API Contract

Base URL is configured in the frontend with `PUBLIC_TODO_API_BASE_URL`.

All successful JSON responses use `Content-Type: application/json`.
All routes include CORS headers for browser calls.

## Auth

When `TODO_AUTH_MODE=cognito`, every non-`OPTIONS` request must be authorized by API Gateway's Cognito/JWT authorizer before reaching Lambda.

The frontend sends the Cognito access token as:

```text
Authorization: Bearer <access token>
```

In production, API Gateway validates the token and passes JWT claims to Lambda in `requestContext.authorizer.jwt.claims`. Lambda requires a Cognito subject claim (`sub`) in Cognito mode.

For local-only development, `TODO_LOCAL_ACCESS_TOKEN` can be set and matched against the same `Authorization` header.

Unauthorized requests return `401`:

```json
{ "message": "unauthorized" }
```

## Todo Object

```json
{
  "id": "task-id",
  "title": "Buy milk",
  "priority": 0,
  "status": "todo",
  "category": "errands",
  "description": "Use lactose-free milk.",
  "completed": false,
  "createdAt": "2026-07-19T10:00:00Z",
  "updatedAt": "2026-07-19T10:00:00Z"
}
```

Fields:

- `priority`: integer. Defaults to `0`.
- `status`: enum. Allowed values are `todo`, `in_progress`, and `done`. Defaults to `todo`.
- `category`: string. Defaults to an empty string.
- `description`: string. Defaults to an empty string.
- `completed`: boolean retained for the current checkbox UI. `status: "done"` maps to `completed: true`; other statuses map to `false`.

## Routes

`GET /todos`

Returns `200` with an array of todo objects.

`POST /todos`

Request body:

```json
{
  "title": "Buy milk",
  "priority": 2,
  "status": "todo",
  "category": "errands",
  "description": "Use lactose-free milk."
}
```

Returns `201` with the created todo. Blank or missing `title`, non-integer `priority`, invalid `status`, or non-string text fields return `400`.

`PATCH /todos/{id}`

Request body can include one or both editable fields:

```json
{
  "title": "Buy oat milk",
  "priority": 3,
  "status": "in_progress",
  "category": "errands",
  "description": "Use lactose-free milk.",
  "completed": false
}
```

Returns `200` with the updated todo. Missing todo returns `404`.

`DELETE /todos/{id}`

Returns `204` when deleted. Missing todo returns `404`.

`OPTIONS /todos` and `OPTIONS /todos/{id}`

Returns `204` with CORS headers.
