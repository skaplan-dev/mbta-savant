"""Download raw arrival/departure events from the TransitMatters S3 bucket."""

import csv
import zlib
from concurrent.futures import ThreadPoolExecutor
from datetime import date

from botocore.exceptions import ClientError

from savant.groups import stop_ids

BUCKET = "tm-mbta-performance"
KEEP = ("ARR", "DEP")


def _client(client):
    if client is not None:
        return client
    import boto3
    from botocore.client import Config

    return boto3.client("s3", config=Config(max_pool_connections=25))


def is_bus(stop_id: str) -> bool:
    return "-0-" in stop_id or "-1-" in stop_id


def _lamp_key(stop_id: str, day: date) -> str:
    folder = "bus-daily-data" if is_bus(stop_id) else "daily-data"
    return f"Events-lamp/{folder}/{stop_id}/Year={day.year}/Month={day.month}/Day={day.day}/events.csv"


def _monthly_key(stop_id: str, year: int, month: int) -> str:
    folder = "monthly-bus-data" if is_bus(stop_id) else "monthly-data"
    return f"Events/{folder}/{stop_id}/Year={year}/Month={month}/events.csv.gz"


def download(client, key: str, compressed: bool, encoding: str = "utf8") -> str | None:
    """Fetch and decode one object; None if the key does not exist."""
    try:
        data = client.get_object(Bucket=BUCKET, Key=key)["Body"].read()
    except ClientError as ex:
        if ex.response["Error"]["Code"] == "NoSuchKey":
            return None
        raise
    if compressed:
        data = zlib.decompress(data, zlib.MAX_WBITS | 32)
    return data.decode(encoding)


def _fetch_all(client, keys: list[str], compressed: bool) -> list[dict]:
    def one(key):
        text = download(client, key, compressed)
        if text is None:
            return []
        return [r for r in csv.DictReader(text.splitlines()) if r["event_type"] in KEEP]

    with ThreadPoolExecutor(max_workers=25) as pool:
        return [row for rows in pool.map(one, keys) for row in rows]


def day_events(group: str, day: date, client=None) -> list[dict]:
    client = _client(client)
    return _fetch_all(client, [_lamp_key(s, day) for s in stop_ids(group)], compressed=False)


def month_events(group: str, year: int, month: int, client=None) -> list[dict]:
    client = _client(client)
    return _fetch_all(client, [_monthly_key(s, year, month) for s in stop_ids(group)], compressed=True)
