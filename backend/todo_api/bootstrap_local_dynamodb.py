import argparse


def ensure_table(endpoint_url, table_name):
    import boto3
    from botocore.exceptions import ClientError

    dynamodb = boto3.client("dynamodb", endpoint_url=endpoint_url)

    try:
        dynamodb.describe_table(TableName=table_name)
        print(f"DynamoDB table already exists: {table_name}")
        return
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") != "ResourceNotFoundException":
            raise

    dynamodb.create_table(
        TableName=table_name,
        AttributeDefinitions=[
            {
                "AttributeName": "id",
                "AttributeType": "S",
            },
        ],
        KeySchema=[
            {
                "AttributeName": "id",
                "KeyType": "HASH",
            },
        ],
        BillingMode="PAY_PER_REQUEST",
    )
    waiter = dynamodb.get_waiter("table_exists")
    waiter.wait(TableName=table_name)
    print(f"DynamoDB table created: {table_name}")


def main():
    parser = argparse.ArgumentParser(
        description="Create the local Todo DynamoDB table."
    )
    parser.add_argument("--endpoint-url", default="http://127.0.0.1:8000")
    parser.add_argument("--table-name", default="personal-todos")
    args = parser.parse_args()

    ensure_table(endpoint_url=args.endpoint_url, table_name=args.table_name)


if __name__ == "__main__":
    main()
