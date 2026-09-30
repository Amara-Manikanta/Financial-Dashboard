import test from 'node:test';
import assert from 'node:assert/strict';
import { parseYahooNews, parseGoogleNews, mergeNews } from './news.js';

const NOW = Date.parse('2026-09-30T12:00:00Z');

test('Yahoo and Google headlines parse, dedupe and sort newest first', () => {
    const yahoo = parseYahooNews({ news: [
        { title: 'Infosys wins $1.5 billion deal', publisher: 'Reuters', link: 'https://y/1', providerPublishTime: NOW / 1000 - 3600 },
        { title: 'Old story', publisher: 'X', link: 'https://y/2', providerPublishTime: NOW / 1000 - 90 * 86400 },
    ] });
    const google = parseGoogleNews(`<rss><channel>
        <item><title>Infosys wins $1.5 billion deal - Mint</title><link>https://g/1</link><pubDate>Wed, 30 Sep 2026 10:00:00 GMT</pubDate><source url="https://mint">Mint</source></item>
        <item><title><![CDATA[Infosys Q2 results: profit rises 5% &amp; margins hold - Economic Times]]></title><link>https://g/2</link><pubDate>Wed, 30 Sep 2026 11:30:00 GMT</pubDate><source url="https://et">Economic Times</source></item>
    </channel></rss>`);
    assert.equal(google[1].title, 'Infosys Q2 results: profit rises 5% & margins hold');
    assert.equal(google[1].source, 'Economic Times');

    const merged = mergeNews([yahoo, google], NOW);
    assert.deepEqual(merged.map((n) => n.title), [
        'Infosys Q2 results: profit rises 5% & margins hold',
        'Infosys wins $1.5 billion deal',
    ]);
    assert.equal(merged[1].source, 'Reuters'); // the newer copy of the same story wins
});

test('garbage in gives nothing out', () => {
    assert.deepEqual(parseYahooNews(null), []);
    assert.deepEqual(parseGoogleNews('<html>blocked</html>'), []);
});
