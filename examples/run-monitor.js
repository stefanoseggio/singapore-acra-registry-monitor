// run-monitor.js
// Calls the ACRA Singapore Registry Delta Monitor via the Apify API.
const { ApifyClient } = require('apify-client');

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN, // set this to your Apify API token
});

async function main() {
    const input = {
        shardSelection: ['A', 'B', 'C'],
        onlyNew: true,
        eventTypes: ['NEW_LISTING', 'STATUS_CHANGE', 'UPDATED'],
        maxItems: 5000,
    };

    const run = await client.actor('ht22I1rCH3Ah9QGnM').call(input);
    console.log(`Run ${run.id} finished with status: ${run.status}`);

    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    console.log(`Delivered ${items.length} record(s):`);
    for (const item of items) {
        console.log(`- [${item.event_type}] ${item.uen}: ${item.entity_name} (${item.entity_status_description})`);
    }
}

main().catch((err) => {
    console.error('Run failed:', err);
    process.exit(1);
});
