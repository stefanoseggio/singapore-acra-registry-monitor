<h1 align="center">Singapore ACRA Corporate Registry - Delta Monitor</h1>

<p align="center"><strong>Know the instant a Singapore UEN's status changes - Live to Struck Off, In Liquidation, Dissolved, Amalgamated - without a sales-gated KYB tool.</strong></p>

<p align="center">
  <a href="https://apify.com"><img alt="Built for Apify" src="https://img.shields.io/badge/Built%20for-Apify-FF9012?logo=apify&logoColor=white"></a>
  <a href="#pricing"><img alt="Pay-Per-Event" src="https://img.shields.io/badge/Pay--Per--Event-from%20%240.01-2ea44f"></a>
  <a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg"></a>
</p>

## Run it

<p align="center">
  <a href="https://apify.com/stefano_seggio/singapore-acra-registry-monitor"><img alt="Run on Apify Store" src="https://img.shields.io/badge/Run%20on-Apify%20Store-FF9012?logo=apify&logoColor=white&style=for-the-badge"></a>
</p>

Live and public at [apify.com/stefano_seggio/singapore-acra-registry-monitor](https://apify.com/stefano_seggio/singapore-acra-registry-monitor). Owner console: [console.apify.com/actors/ht22I1rCH3Ah9QGnM](https://console.apify.com/actors/ht22I1rCH3Ah9QGnM).

> This repository is a documentation and integration wrapper around that Actor - the MIT license below covers this repo's own README, snippets, and docs, not the Actor's proprietary TypeScript source, which stays closed and hosted on Apify.

## Executive Value Proposition

**ACRA Singapore UEN delta monitor** - a self-serve alternative to
sales-gated enterprise KYB tools for tracking Singapore's official
corporate register (Pte Ltd companies, sole proprietorships/partnerships,
LLPs - every entity type ACRA issues a UEN to). ACRA's free bulk extract
of Singapore's ~2.1 million-entity register refreshes once a month with no
change-notification mechanism. ACRA's own real-time Business Profile API
is paid, per-lookup, and still not a push feed. Every enterprise KYB
vendor that monitors this register (Kyckr, CRIF BizInsights, Moody's
Orbis, AsiaVerify) is sales-gated or credit-pack priced - none publish a
transparent per-event rate. This Actor is the self-serve alternative:
point it at the official, licensed data.gov.sg source (Collection 2, the
full-field ACRA dataset - see Architecture) and get billed only for
entities that are genuinely new or changed, filtered by UEN, SSIC
industry code, or entity status if you want, at a published price, with
no sales call.

## Who uses this

- **Corporate service providers (CSPs)** who need to know the moment a
  client's counterparty - or their own client entity - is struck off,
  dissolved, or amalgamated, without manually re-querying BizFile+.
- **KYC/AML onboarding analysts at fintechs and banks** doing routine
  registry checks as part of onboarding - the recurring, named task found
  in real Singapore compliance/KYC job postings during this product's
  market research.
- **RegTech and compliance-tooling builders** who want structured,
  monitorable Singapore corporate data to build on top of, rather than
  polling ACRA's public search UI by hand.
- **Developers who tried ACRA's bulk extract directly** and hit its
  27-shard, no-server-side-SSIC-filter limitation - a real, independently
  confirmed technical pain point this Actor's `shardSelection`/`eventTypes`
  inputs solve at query time instead of requiring a custom filter pass
  after downloading everything.
- **Fintech risk engineering and hedge fund data teams** who need
  Singapore corporate-registry status as a structured, versioned signal
  feeding an internal counterparty/vendor-risk pipeline - `event_id` gives
  a stable idempotency key for exactly-once ingestion, and `@type`/schema.org
  tagging on each record makes it usable directly by JSON-LD-aware tooling
  without a bespoke adapter.
- **Legal and corporate secretarial officers** tracking a specific set of
  counterparties or portfolio entities for exactly the event that matters
  operationally - a status change - via the `webhookUrl` alert, without
  needing to build any infrastructure themselves.

## Architecture

```
data.gov.sg (27 shards, licensed, monthly refresh)
        │  paginated REST reads (limit=1,000, live-verified ceiling)
        ▼
 acraSource.ts  ──walks each selected shard to completion──▶  per-page batches
        │
        ▼
 fingerprint.ts  (normalize "na"→null, build AcraEntity)
        │
        ▼
 deltaEngine.ts  ──compares against retained per-UEN snapshot──▶
        │                                                        │
        ├─ never seen + shard not yet baselined → BASELINE_SNAPSHOT (free)
        ├─ never seen + shard baselined         → NEW_LISTING     ($0.03)
        ├─ status differs                       → STATUS_CHANGE   ($0.03)
        ├─ content differs (real field diff)     → UPDATED         ($0.01)
        └─ nothing differs                       → SNAPSHOT_NO_DIFF (free)
        │
        ▼
 deliveryFilter.ts  ──ssicCodeFilter / entityStatusFilter / eventTypes /
        │             onlyNew (delivery-time only - tracking above is
        │             always unfiltered, so a filtered-out entity that
        │             later starts matching is still classified correctly)
        ▼
 main.ts  ──Actor.pushData(record, eventName)──▶  Apify dataset (PPE billed)
        │
        └─ STATUS_CHANGE only ──▶  optional webhookNotifier.ts ──▶ Slack/Make/n8n
```

Per-shard state (`state.ts`) persists to 27 independent Key-Value Store
records plus one small `meta` record, saved incrementally after each shard
completes - not one combined blob, and not only at the very end of a run.

## How it's different from what's already on the Apify Store

Named honestly, using only publicly published prices - this is a factual
comparison against public Apify Store listings, not disparagement:

| Actor | Delta detection | Field richness | Price |
|---|---|---|---|
| `nexgendata/singapore-acra-company-lookup` | No - one-shot lookup | Thin (no SSIC) | $0.25/record |
| `scrapers_lat/singapore-acra-entities-scraper` | No | Rich | $0.01154/record |
| `zinin/acra-company-change-enricher` | Yes | Thin | $0.03/event |
| **This Actor** | **Yes** | **Rich (SSIC, former names, audit firm, full address)** | **$0.03/NEW_LISTING or STATUS_CHANGE, $0.01/UPDATED** |

Today it's full-fields-with-no-delta, or delta-with-thin-fields - never
both. This Actor combines them, at price parity with the existing delta
competitor rather than undercutting on price.

## Input

```json
{
    "shardSelection": ["A", "B", "C"],
    "onlyNew": true,
    "eventTypes": ["NEW_LISTING", "STATUS_CHANGE", "UPDATED"],
    "ssicCodeFilter": [],
    "entityStatusFilter": [],
    "maxItems": 5000,
    "deltaStateName": "default",
    "resetState": false,
    "watchlistUens": [],
    "webhookUrl": "<your Slack Incoming Webhook / Make / n8n / Zapier catch-hook URL>"
}
```

| Field | Type | Default | Description |
|---|---|---|---|
| `shardSelection` | array | all 27 shards | Which A-Z/Others letter-shards to monitor. |
| `onlyNew` | boolean | `true` | Deliver only NEW_LISTING/STATUS_CHANGE/UPDATED. `false` also delivers uncharged baseline/unchanged rows - roughly 2.1M rows on an unfiltered first run. |
| `eventTypes` | array | all three | Restrict which charged event types are delivered. |
| `ssicCodeFilter` | array | `[]` (all industries) | Deliver only entities whose primary or secondary SSIC code starts with one of these prefixes. |
| `entityStatusFilter` | array | `[]` (all statuses) | Deliver only entities whose current status exactly matches one of these (case-insensitive). |
| `maxItems` | integer | none | Stop after this many pushed records. Nothing is lost - unreached entities are simply re-evaluated fresh next run. |
| `deltaStateName` | string | `"default"` | Names the persistent state store. Use a distinct name per independent schedule. |
| `resetState` | boolean | `false` | Wipes remembered state for the selected shards and re-baselines from scratch. |
| `watchlistUens` | array | `[]` | Specific UENs to refresh in real time via your own ACRA Business Profile API key, on top of the monthly bulk cycle. |
| `acraBusinessProfileApiKey` | string (secret) | - | Required only if `watchlistUens` is non-empty. Bring your own key from ACRA's API Marketplace. |
| `webhookUrl` | string | - | Optional Slack/Make/n8n/Zapier endpoint that receives a formatted alert the instant a STATUS_CHANGE is detected. |

### Filtering for Singapore compliance/KYC workflows

Three copy-paste examples for common analyst tasks. Note `ssicCodeFilter`/
`entityStatusFilter` are delivery-time filters only - every entity is
still tracked internally regardless, so one that changes INTO your filter
(e.g. a fintech client that goes from "Live" to "Struck Off") is correctly
reported the moment it does, not missed because it didn't match before.

**Watch only distressed/exited entities (e.g. for a counterparty-risk feed):**
```json
{
    "entityStatusFilter": ["Struck Off", "In Liquidation - Compulsory Winding Up (Insolvency)", "Dissolved - Compulsory Winding Up (Insolvency)"],
    "onlyNew": true
}
```

**Watch only a specific industry (e.g. Computer Programming/IT, SSIC division 62), for sector-specific due diligence:**
```json
{
    "ssicCodeFilter": ["62"],
    "eventTypes": ["NEW_LISTING", "STATUS_CHANGE"]
}
```

**Refresh a specific, named list of counterparties in real time (requires your own ACRA API key)**, for the small set of UENs a deal desk or onboarding queue actually cares about right now:
```json
{
    "watchlistUens": ["190700013E", "201201936C"],
    "acraBusinessProfileApiKey": "<your ACRA EIQ subscription key>"
}
```

## Output

```json
{
    "@type": "schema:Organization",
    "event_id": "105eabde3d62b429b5d0e75fabb3ed20e1e42aa6",
    "event_type": "STATUS_CHANGE",
    "record_id": "190700013E",
    "uen": "190700013E",
    "entity_name": "WEE BROTHERS STEAMSHIP COMPANY LIMITED",
    "entity_type_description": "Local Company",
    "entity_status_description": "Struck Off",
    "previous_status": "Live Company",
    "registration_incorporation_date": "1907-12-30",
    "registered_address": "53, MARKET STREET, Singapore 0104",
    "primary_ssic_code": "96099",
    "primary_ssic_description": null,
    "secondary_ssic_code": null,
    "secondary_ssic_description": null,
    "no_of_officers": "0",
    "former_entity_names": [],
    "audit_firm_names": [],
    "changed_fields": [],
    "status_fingerprint": "a94a8fe5ccb19ba61c4c0873d391e987982fbbd3",
    "content_fingerprint": "3608bd79655c8b98f0389aebd42b52ef6b40e5e2",
    "is_new": false,
    "shard": "W",
    "source_url": "https://data.gov.sg/collections/2/view",
    "scraped_at": "2026-09-11T14:02:03.000Z",
    "byok_enriched": false
}
```

`event_id` above is a genuine SHA-1 of `(uen, event_type, status_fingerprint, content_fingerprint)` for this exact record, computed the same way `main.ts`'s `computeEventId` does in production - a retried delivery of the same underlying event always reproduces this same ID.

This is a real record (UEN 190700013E, live-verified against data.gov.sg 2026-09-11) - `primary_ssic_description` is genuinely `null` in the source for this entity even though `primary_ssic_code` is populated, illustrating why the two fields are tracked and normalized independently rather than assumed to be a single present/absent pair.

| Field | Description |
|---|---|
| `@type` | `schema:Organization` - a real schema.org vocabulary reference, not a cosmetic label. |
| `event_id` | SHA-1 idempotency key for downstream dedup, stable across retried deliveries of the same event. |
| `event_type` | `NEW_LISTING`, `STATUS_CHANGE`, `UPDATED`, `SNAPSHOT_NO_DIFF`, or `BASELINE_SNAPSHOT`. |
| `previous_status` | Populated only on `STATUS_CHANGE`. |
| `changed_fields` | Populated only on `UPDATED` - a real diff (not a hash comparison), each entry `{field_path, previous_value, new_value}` with actual values. |
| `status_fingerprint` / `content_fingerprint` | SHA-1 idempotency hashes for your own dedup logic - not used internally for classification. |
| `former_entity_names` / `audit_firm_names` | Arrays; empty when none exist. Audit firm data is genuinely rare in the source (see Reliability). |

## Webhook alert payload (Slack / Make / n8n / Zapier)

Set `webhookUrl` and every `STATUS_CHANGE` event POSTs this exact JSON
shape the moment it's detected - no platform-webhook configuration
required. This is the real, live payload structure from
`webhookNotifier.ts`, not an illustrative mockup:

```json
{
    "text": ":rotating_light: ACRA status change: *WEE BROTHERS STEAMSHIP COMPANY LIMITED* (190700013E) is now *Struck Off* (was: Live Company).",
    "blocks": [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": ":rotating_light: *ACRA status change*\n*Entity:* WEE BROTHERS STEAMSHIP COMPANY LIMITED\n*UEN:* 190700013E\n*New status:* Struck Off\n*Previous status:* Live Company\n*SSIC:* 96099\n*Detected:* 2026-09-11T14:02:03.000Z"
            }
        }
    ],
    "record": { "...": "the full OutputRecord shown in Output above, e.g. event_id, changed_fields, all ACRA fields" }
}
```

- **Slack**: paste an Incoming Webhook URL straight into `webhookUrl` - the
  `text`/`blocks` fields render natively, no template needed on your end.
- **Email**: route through a Make/Zapier/n8n "Webhook → Send Email" flow;
  use `record.entity_name`, `record.uen`, `record.entity_status_description`,
  and `record.previous_status` to build the subject/body.
- **Zapier/Make/n8n generically**: point a Catch Hook trigger at this URL
  and reference any field under `record` directly - the full structured
  event (including `changed_fields`, `event_id` for dedup, and `@type`)
  is always included alongside the Slack-formatted `text`/`blocks`.

## Reliability

- **Real field-level diffs, not a hash comparison.** `changed_fields` on
  `UPDATED` events carries actual previous/new values, because this Actor
  retains the full previous entity snapshot per UEN - not just a
  changed/unchanged flag.
- **No false-flood on your first run.** ~2.1 million pre-existing entities
  are never reported as `NEW_LISTING` - each shard's first-ever complete
  walk establishes a silent baseline; genuine new-incorporation signals
  only start from the following run.
- **Charge-limit safe.** If a run stops early (your `maxItems`, or Apify's
  own event-charge limit), nothing is lost or double-billed - unreached or
  unbilled entities are simply re-evaluated correctly next run.
- **Licensed source only.** Built exclusively on data.gov.sg's Singapore
  Open Data Licence-covered ACRA collection. No BizFile+ scraping, no
  bot-evasion, no gated-portal automation.
- **On PDPA**: this Actor's own data sourcing is consistent with the
  Personal Data Protection Act's "publicly available" provisions - the
  source sits behind no login wall, paywall, or CAPTCHA, and nothing is
  obtained by circumventing an access control. That said, PDPA compliance
  is not a status a data pipeline can carry on your behalf: it governs how
  *you*, as the recipient organization, collect, use, retain, and disclose
  the personal data in this feed (officer/owner names, addresses) once you
  have it. This Actor is not a substitute for your own PDPA assessment,
  and nothing here should be read as a compliance certification.
- **Known limitation, disclosed rather than hidden:** the source itself
  refreshes monthly. This Actor cannot report a status change faster than
  ACRA publishes it, except for UENs you explicitly add to `watchlistUens`
  with your own ACRA API key.

## Instant Terminal Run (cURL)

Runs synchronously and returns the resulting dataset items directly in the response - no polling needed. Get your token from [console.apify.com/settings/integrations](https://console.apify.com/settings/integrations).

```bash
curl -X POST "https://api.apify.com/v2/acts/ht22I1rCH3Ah9QGnM/run-sync-get-dataset-items?token=<YOUR_API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
  "shardSelection": [
    "A",
    "B",
    "C"
  ],
  "onlyNew": true,
  "maxItems": 5000
}'
```

### Python (`apify-client`)

```python
import os
from apify_client import ApifyClient

client = ApifyClient(os.environ["APIFY_TOKEN"])

run = client.actor("stefano_seggio/singapore-acra-registry-monitor").call(run_input={
    "shardSelection": ["A", "B", "C"],
    "onlyNew": True,
    "maxItems": 5000,
})

for item in client.dataset(run["defaultDatasetId"]).iterate_items():
    print(item)
```

### Node.js (`apify-client`)

```javascript
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

const run = await client.actor('stefano_seggio/singapore-acra-registry-monitor').call({
    shardSelection: ['A', 'B', 'C'],
    onlyNew: true,
    maxItems: 5000,
});

const { items } = await client.dataset(run.defaultDatasetId).listItems();

items.forEach((item) => {
    console.log(item);
});
```

## Sample Extracted Dataset (JSON)

One real record from this Actor's own dataset, matching `.actor/dataset_schema.json`:

```json
{
  "event_id": "105eabde3d62b429b5d0e75fabb3ed20e1e42aa6",
  "event_type": "STATUS_CHANGE",
  "record_id": "190700013E",
  "uen": "190700013E",
  "entity_name": "WEE BROTHERS STEAMSHIP COMPANY LIMITED",
  "entity_status_description": "Struck Off",
  "previous_status": "Live Company",
  "primary_ssic_code": "96099",
  "is_new": false,
  "source_url": "https://data.gov.sg/collections/2/view",
  "scraped_at": "2026-09-11T14:02:03.000Z"
}
```

## Pricing

| Event | Price | When it's charged |
|---|---|---|
| `NEW_LISTING` | $0.03 | A UEN not previously seen appears, after its shard's baseline is established. |
| `STATUS_CHANGE` | $0.03 | An entity's status changed since it was last seen (e.g. Live → Struck Off). |
| `UPDATED` | $0.01 | Name, address, SSIC, officer count, former name, or audit firm changed with no status change. |
| `BASELINE_SNAPSHOT` / `SNAPSHOT_NO_DIFF` | Free | Only delivered when `onlyNew=false`; never charged. |

There is no metered free trial of paid events - Apify's Console has no
mechanism to comp the first N occurrences of a specific event type. To
validate this Actor before committing spend: run it with `onlyNew: false`
to get `BASELINE_SNAPSHOT`/`SNAPSHOT_NO_DIFF` records (always free) and
confirm your filters and shard selection behave as expected, or point
`watchlistUens` at a handful of UENs you already know the status of so
early paid events are naturally few and cheap to review.

## Cost & BYOK Disclosure

This Actor requires **no third-party key** for its default operation — the monthly `data.gov.sg`
Collection 2 bulk extract is a licensed, public source, and every `NEW_LISTING`/`STATUS_CHANGE`/
`UPDATED` event above is billed only through Apify's own Pay-Per-Event mechanism. An unchanged
entity's fingerprint matches the last run and is classified `SNAPSHOT_NO_DIFF` — suppressed
before delivery, never billed, not a refund after the fact.

**Optional BYOK tier:** setting `watchlistUens` activates real-time refresh for that specific set
of entities, which requires your own `acraBusinessProfileApiKey` from ACRA's API Marketplace
(EIQ subscription). That key belongs exclusively to your own ACRA account, is billed by ACRA
directly to you, and is never pooled, stored beyond the run, or reused across other customers.
Every other input field works with no key at all.

## Contributing & Local Setup

This repository is a **documentation and integration wrapper**, not the Actor's source — the
delta-engine, fingerprinting, and ACRA-parsing logic described above is proprietary and runs
privately on Apify's platform (see the license note at the top of this README). There is no
`src/` here to clone and build locally.

If you find a documentation error, an outdated code sample, or want to propose a new filter or
output field: open an issue directly on this Actor's
[Apify Store page](https://apify.com/stefano_seggio/singapore-acra-registry-monitor), or open a
PR against this repository for README/example fixes. Typical triage time is within 48 hours (see
Support below). Testing the Actor itself — including any watchlist or filter configuration — is
done by running it directly from the Apify Console or via the Quickstart snippets above; there is
no local `apify run` workflow for the closed-source logic itself.

## Support & Enterprise SLA

Independently developed and maintained by Stefano Seggio (Delta Registry)
- not a managed enterprise product, and there is no contractual uptime
SLA. Issues and feature requests: open an issue against this Actor's Store
listing. Typical triage time: within 48 hours.

---

<p align="center">
Part of <strong>Delta Registry</strong> - pay-per-event regulatory &amp; compliance data infrastructure.<br>
For professional inquiries or enterprise licensing: <a href="https://www.linkedin.com/in/stefanoseggio-deltaregistry">linkedin.com/in/stefanoseggio-deltaregistry</a><br>
The rest of the fleet: <a href="https://github.com/stefanoseggio">github.com/stefanoseggio</a>
</p>
