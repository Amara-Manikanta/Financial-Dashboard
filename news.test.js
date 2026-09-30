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
    assert.equal(merged[1].source, 'Reuters, Mint'); // one story, both outlets
    assert.equal(merged[1].coverage, 2);
});

test('garbage in gives nothing out', () => {
    assert.deepEqual(parseYahooNews(null), []);
    assert.deepEqual(parseGoogleNews('<html>blocked</html>'), []);
});

test('NewsAPI articles carry their description; removed ones are dropped', async () => {
    const { parseNewsApi } = await import('./news.js');
    const items = parseNewsApi({ status: 'ok', articles: [
        { source: { name: 'Business Standard' }, title: 'Infosys raises FY guidance', description: 'Revenue growth now seen at <b>3-4%</b>.', url: 'https://bs/1', publishedAt: '2026-09-29T08:00:00Z' },
        { source: { name: 'x' }, title: '[Removed]', url: 'https://removed.com' },
    ] });
    assert.equal(items.length, 1);
    assert.equal(items[0].summary, 'Revenue growth now seen at 3-4%.');
    assert.equal(items[0].source, 'Business Standard');
});

test('NewsAPI budget: counted per rolling day, persisted, and stops at the limit', async (t) => {
    const fs = await import('fs');
    const os = await import('os');
    const path = await import('path');
    const { configureNews, newsApiUsage, newsFor } = await import('./news.js');
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'news-')), 'usage.json');
    const now = Date.now();
    fs.writeFileSync(file, JSON.stringify({ calls: [now - 2 * 86400000, ...Array(99).fill(now - 3600000)] }));
    process.env.NEWSAPI_KEY = 'test-key';
    t.after(() => { delete process.env.NEWSAPI_KEY; });
    configureNews({ usageFile: file });
    assert.deepEqual({ used: newsApiUsage().used, remaining: newsApiUsage().remaining }, { used: 99, remaining: 1 });

    const seen = [];
    t.mock.method(globalThis, 'fetch', async (url) => {
        seen.push(String(url));
        return new Response(JSON.stringify({ articles: [], news: [] }), { status: 200 });
    });
    await newsFor('AAA.NS', 'Aaa Ltd');     // uses the last request
    await newsFor('BBB.NS', 'Bbb Ltd');     // over the limit: NewsAPI skipped
    assert.equal(seen.filter((u) => u.includes('newsapi.org')).length, 1);
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).calls.length, 100); // the day-old entry is pruned on save
    const second = await newsFor('BBB.NS', 'Bbb Ltd', { fresh: true });
    assert.match(second.body.errors.join(), /NewsAPI: daily limit reached \(100\/100\)/);
});

test('differently worded headlines about one event become one story; unrelated ones do not', async () => {
    const { consolidate } = await import('./newsArchive.js');
    const t = (h) => new Date(NOW - h * 3600000).toISOString();
    const stories = consolidate([
        { title: 'Infosys raises FY27 revenue guidance to 3-4%', source: 'Reuters', published: t(2), url: 'https://r/1' },
        { title: 'Infosys ups revenue guidance after large deal wins', source: 'Mint', published: t(5), url: 'https://news.google.com/x', summary: 'Outlook lifted.' },
        { title: 'Infosys revenue guidance raised; shares jump', source: 'ET', published: t(8), url: 'https://et/1' },
        { title: 'Infosys CFO resigns', source: 'BS', published: t(3), url: 'https://bs/1' },
        { title: 'Infosys raises revenue guidance', source: 'Old', published: t(24 * 90), url: 'https://o/1' },
    ], 'Infosys Limited');
    assert.equal(stories.length, 3);
    const guidance = stories.find((s) => s.coverage === 3);
    assert.deepEqual(guidance.sources, ['Reuters', 'Mint', 'ET']);
    assert.equal(guidance.summary, 'Outlook lifted.');
    assert.equal(guidance.url, 'https://r/1'); // a direct link, never the Google redirect
    assert.ok(stories.some((s) => s.title === 'Infosys CFO resigns'));
});

test('article text is pulled out of the page; a paywall stub is refused', async (t) => {
    const { articleText } = await import('./news.js');
    const body = 'Infosys raised its revenue growth guidance for the year to 3-4 percent on Thursday, citing large deal wins. '.repeat(5);
    t.mock.method(globalThis, 'fetch', async (url) => new Response(String(url).includes('paywall')
        ? '<html><body><nav>Menu</nav><p>Subscribe to read.</p></body></html>'
        : `<html><head><title>x</title></head><body><nav>Home Markets</nav><article><h1>Guidance up</h1><p>${body}</p><p>Margins held at 21 percent.</p></article><footer>Subscribe</footer></body></html>`, { status: 200 }));
    const text = await articleText('https://example.com/story');
    assert.match(text, /^Guidance up\nInfosys raised/);
    assert.match(text, /Margins held at 21 percent\.$/);
    assert.doesNotMatch(text, /Home Markets|Subscribe/);
    await assert.rejects(articleText('https://example.com/paywall'), /no readable article/);
    await assert.rejects(articleText('https://news.google.com/rss/articles/abc'), /no direct link/);
});
