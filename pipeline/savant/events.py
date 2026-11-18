"""Download raw arrival/departure events from the TransitMatters S3 bucket."""

import csv
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date

from botocore.exceptions import ClientError, ResponseStreamingError
from urllib3.exceptions import ProtocolError

from savant.groups import stop_ids

BUCKET = "tm-mbta-performance"
KEEP = ("ARR", "DEP")
RETRYABLE = (ProtocolError, ResponseStreamingError, ConnectionError)
BACKOFF = (1, 2, 4)
_sleep = time.sleep  # patched in tests


def _client(client):
    if client is not None:
        return client
    import boto3
    from botocore.client import Config

    return boto3.client("s3", config=Config(max_pool_connections=25, retries={"max_attempts": 8, "mode": "adaptive"}))


def is_bus(stop_id: str) -> bool:
    return "-0-" in stop_id or "-1-" in stop_id


def _lamp_key(stop_id: str, day: date) -> str:
    folder = "bus-daily-data" if is_bus(stop_id) else "daily-data"
    return f"Events-lamp/{folder}/{stop_id}/Year={day.year}/Month={day.month}/Day={day.day}/events.csv"


def download(client, key: str, encoding: str = "utf8") -> str | None:
    """Fetch and decode one object; None if the key does not exist.

    The get_object + body read pair is retried on transient stream errors.
    """
    for attempt in range(len(BACKOFF) + 1):
        try:
            return client.get_object(Bucket=BUCKET, Key=key)["Body"].read().decode(encoding)
        except ClientError as ex:
            if ex.response["Error"]["Code"] == "NoSuchKey":
                return None
            raise
        except RETRYABLE:
            if attempt == len(BACKOFF):
                raise
            _sleep(BACKOFF[attempt])


def _fetch_all(client, keys: list[str]) -> list[dict]:
    def one(key):
        text = download(client, key)
        if text is None:
            return []
        return [r for r in csv.DictReader(text.splitlines()) if r["event_type"] in KEEP]

    with ThreadPoolExecutor(max_workers=25) as pool:
        return [row for rows in pool.map(one, keys) for row in rows]


def day_events(group: str, day: date, client=None) -> list[dict]:
    client = _client(client)
    return _fetch_all(client, [_lamp_key(s, day) for s in stop_ids(group)])
