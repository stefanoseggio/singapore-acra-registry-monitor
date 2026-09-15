# run_monitor.py
# Calls the ACRA Singapore Registry Delta Monitor via the Apify API.
import os
from apify_client import ApifyClient

client = ApifyClient(os.environ["APIFY_TOKEN"])  # set this to your Apify API token

run_input = {
    "shardSelection": ["A", "B", "C"],
    "onlyNew": True,
    "eventTypes": ["NEW_LISTING", "STATUS_CHANGE", "UPDATED"],
    "maxItems": 5000,
}

run = client.actor("ht22I1rCH3Ah9QGnM").call(run_input=run_input)
print(f"Run {run['id']} finished with status: {run['status']}")

dataset_items = client.dataset(run["defaultDatasetId"]).list_items().items
print(f"Delivered {len(dataset_items)} record(s):")
for item in dataset_items:
    print(f"- [{item['event_type']}] {item['uen']}: {item['entity_name']} ({item['entity_status_description']})")
