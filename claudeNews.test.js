import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { configureArchive, mergeIntoArchive, attachAnalysis, readArchive } from './newsArchive.js';
import {
    configureClaudeNews, setClaudeClient, setClaudeEnabled, claudeReady, claudeStatus,
    readStoryWithClaude, refreshBrief, readBrief, unverifiedFigures, setApiKey,
} from './claudeNews.js';

const NOW = Date.parse('2026-10-29T06:00:00Z');
const daysAgo = (d) => new Date(NOW - d * 86400000).toISOString();

/** A stub that answers with the given objects in turn and records what it was sent. */
const stub = (...replies) => {
    const sent = [];
    return {
        sent,
        messages: {
            create: async (req) => {
                sent.push(req);
                const reply = replies.shift();
                if (reply?.stop_reason) return { stop_reason: reply.stop_reason, stop_details: reply.stop_details, content: [], usage: { input_tokens: 100, output_tokens: 0 } };
                return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(reply) }], usage: { input_tokens: 10000, output_tokens: 1000 } };
            },
        },
    };
};

const setup = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-news-'));
    configureArchive({ archiveDir: path.join(dir, 'news') });
    configureClaudeNews({ stateFile: path.join(dir, '.claude-news.json'), briefDir: path.join(dir, 'news', 'briefs') });
    process.env.ANTHROPIC_API_KEY = 'test-key-not-real';
    setClaudeEnabled(true);
    return dir;
};

const seed = () => {
    const { items } = mergeIntoArchive('ACME', 'Acme Ltd', [
        { title: 'Acme wins ₹1,200 crore rail order', published: daysAgo(10), source: 'Mint', url: 'https://example.com/a' },
        { title: 'Acme Q2 profit falls 8% on higher costs', published: daysAgo(3), source: 'ET', url: 'https://example.com/b' },
    ], NOW - 86400000);
    const order = items.find((s) => /order/.test(s.title));
    attachAnalysis('ACME', order.id, { keyPoints: ['Acme won a ₹1,200 crore order from Indian Railways.'], impact: 'positive', why: 'Adds to the order book.', analysedAt: daysAgo(9) });
    return readArchive('ACME').items;
};

test('figures are checked against the source text, commas ignored', () => {
    assert.deepEqual(unverifiedFigures('Profit rose 8% to ₹1,200 crore', 'profit up 8 percent, 1200 crore'), []);
    assert.deepEqual(unverifiedFigures('Profit rose 9%', 'profit up 8 percent'), ['9']);
});

test('switched off or without a key, nothing is called', () => {
    setup();
    setClaudeEnabled(false);
    assert.equal(claudeReady().ok, false);
    setClaudeEnabled(true);
    delete process.env.ANTHROPIC_API_KEY;
    assert.match(claudeReady().reason, /ANTHROPIC_API_KEY/);
});

test('a story reading flags a figure the article never states, and its cost is logged', async () => {
    setup();
    const client = stub({ key_points: ['Order worth ₹1,200 crore.', 'Margin of 14% expected.'], impact: 'positive', why_it_matters: 'Bigger order book.' });
    setClaudeClient(client);
    const r = await readStoryWithClaude({ symbol: 'ACME', company: 'Acme Ltd', title: 'Acme wins order', text: 'Acme won an order worth Rs 1,200 crore.' });
    assert.equal(r.ok, true);
    assert.equal(r.analysis.keyPoints[0], 'Order worth ₹1,200 crore.');
    assert.match(r.analysis.keyPoints[1], /^\[unverified figure 14\]/);
    assert.equal(client.sent[0].model, 'claude-haiku-5-5');
    assert.equal(client.sent[0].output_config.effort, 'low');
    // 10K in at $0.10/M + 1K out at $0.50/M = $0.0015 → ₹0.135 at ₹90.
    assert.equal(claudeStatus().spentTodayInr, 0.14);
});

test('a refusal is an error, not an empty reading, and still costs', async () => {
    setup();
    setClaudeClient(stub({ stop_reason: 'refusal', stop_details: { category: 'general_harms' } }));
    const r = await readStoryWithClaude({ symbol: 'ACME', company: 'Acme', title: 't', text: 'x' });
    assert.equal(r.ok, false);
    assert.match(r.error, /declined \(general_harms\)/);
    assert.equal(claudeStatus().calls30Days, 1);
});

test('the daily limit stops further calls', async () => {
    setup();
    process.env.CLAUDE_NEWS_DAILY_INR = '0.1';
    try {
        setClaudeClient(stub({ key_points: ['a'], impact: 'neutral', why_it_matters: '' }));
        await readStoryWithClaude({ symbol: 'ACME', company: 'Acme', title: 't', text: 'a' });
        const second = await readStoryWithClaude({ symbol: 'ACME', company: 'Acme', title: 't', text: 'a' });
        assert.equal(second.ok, false);
        assert.equal(second.capReached, true);
    } finally { delete process.env.CLAUDE_NEWS_DAILY_INR; }
});

test('a rebuilt brief cites real stories, takes dates from them, and drops uncited items', async () => {
    setup();
    const stories = seed();
    const client = stub({
        overview: 'Order book grew; profit fell 8%.',
        items: [
            { status: 'open', what_changed: 'Profit fell 8% in Q2.', why_it_matters: 'Costs rose.', check_before_acting: 'Q3 margins.', refs: ['S1'], carries: '' },
            { status: 'open', what_changed: 'Won a ₹1,200 crore order, worth 30% of revenue.', why_it_matters: 'Order book.', check_before_acting: 'Execution.', refs: ['S2'], carries: '' },
            { status: 'open', what_changed: 'Invented item.', why_it_matters: '', check_before_acting: '', refs: ['S99'], carries: '' },
        ],
    });
    setClaudeClient(client);
    const r = await refreshBrief('ACME', 'Acme Ltd', { now: NOW });
    assert.equal(r.ok, true);
    assert.equal(r.brief.mode, 'rebuild');
    assert.equal(r.brief.items.length, 2);
    const [profit, order] = r.brief.items;
    assert.deepEqual(profit.storyIds, [stories.find((s) => /profit/.test(s.title)).id]);
    assert.equal(profit.lastDate, daysAgo(3).slice(0, 10));
    assert.deepEqual(order.unverified, ['30']);
    // Read stories go in with their key points; unread ones as headlines.
    const sent = client.sent[0].messages[0].content;
    assert.match(sent, /headline only/);
    assert.match(sent, /Indian Railways/);
    assert.deepEqual(readBrief('ACME').items.length, 2);
});

test('an update reads only new stories and keeps what a carried item cited', async () => {
    setup();
    seed();
    setClaudeClient(stub({ overview: 'x', items: [{ status: 'open', what_changed: 'Order.', why_it_matters: '', check_before_acting: '', refs: ['S1'], carries: '' }] }));
    const first = await refreshBrief('ACME', 'Acme Ltd', { now: NOW });
    const carriedIds = first.brief.items[0].storyIds;

    // Nothing new: no call at all.
    setClaudeClient(stub());
    const same = await refreshBrief('ACME', 'Acme Ltd', { now: NOW + 3600000 });
    assert.equal(same.skipped, 'no new stories since the last brief');

    mergeIntoArchive('ACME', 'Acme Ltd', [{ title: 'Acme completes rail order delivery', published: daysAgo(-0.5), source: 'BS', url: 'https://example.com/c' }], NOW + 7200000);
    const client = stub({ overview: 'y', items: [{ status: 'resolved', what_changed: 'Order delivered.', why_it_matters: '', check_before_acting: '', refs: ['S1'], carries: 'P1' }] });
    setClaudeClient(client);
    const next = await refreshBrief('ACME', 'Acme Ltd', { now: NOW + 3 * 3600000 });
    assert.equal(next.brief.mode, 'update');
    assert.equal(next.brief.items[0].status, 'resolved');
    assert.equal(next.brief.items[0].isNew, false);
    assert.ok(carriedIds.every((id) => next.brief.items[0].storyIds.includes(id)));
    assert.equal(next.brief.items[0].storyIds.length, carriedIds.length + 1);
    const sent = client.sent[0].messages[0].content;
    assert.match(sent, /P1 \| open \| Order\./);
    assert.doesNotMatch(sent, /Q2 profit/);
});

test('a brief older than a week is rebuilt, not updated', async () => {
    setup();
    seed();
    setClaudeClient(stub({ overview: 'x', items: [{ status: 'open', what_changed: 'a', why_it_matters: '', check_before_acting: '', refs: ['S1'], carries: '' }] }));
    await refreshBrief('ACME', 'Acme Ltd', { now: NOW });
    mergeIntoArchive('ACME', 'Acme Ltd', [{ title: 'Acme names new chief financial officer', published: daysAgo(-8), source: 'BS', url: 'https://example.com/d' }], NOW + 8 * 86400000);
    setClaudeClient(stub({ overview: 'x', items: [{ status: 'open', what_changed: 'b', why_it_matters: '', check_before_acting: '', refs: ['S1'], carries: '' }] }));
    const later = await refreshBrief('ACME', 'Acme Ltd', { now: NOW + 8 * 86400000 });
    assert.equal(later.brief.mode, 'rebuild');
});

test('an invented figure stays flagged when an update carries it forward', async () => {
    setup();
    seed();
    const item = { status: 'open', what_changed: 'Order worth ₹1,200 crore, 4242 wagons.', why_it_matters: '', check_before_acting: '', refs: ['S2'], carries: '' };
    setClaudeClient(stub({ overview: 'x', items: [item] }));
    const first = await refreshBrief('ACME', 'Acme Ltd', { now: NOW });
    assert.deepEqual(first.brief.items[0].unverified, ['4242']);

    mergeIntoArchive('ACME', 'Acme Ltd', [{ title: 'Acme starts deliveries to railways', published: daysAgo(-0.5), source: 'BS', url: 'https://example.com/e' }], NOW + 7200000);
    // The previous brief's text contains 4242 — that must not count as a source.
    setClaudeClient(stub({ overview: 'x', items: [{ ...item, refs: ['S1'], carries: 'P1' }] }));
    const next = await refreshBrief('ACME', 'Acme Ltd', { now: NOW + 3 * 3600000 });
    assert.equal(next.brief.mode, 'update');
    assert.deepEqual(next.brief.items[0].unverified, ['4242']);
});

test('the key is saved to the env file without disturbing other lines, and never reported back whole', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-key-'));
    const envFile = path.join(dir, '.env.local');
    fs.writeFileSync(envFile, 'NEWSAPI_KEY=abc\nANTHROPIC_API_KEY=old\n');
    configureClaudeNews({ stateFile: path.join(dir, 's.json'), envFile });
    const key = 'sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789wxyz';
    assert.equal(setApiKey('not a key').ok, false);
    assert.equal(setApiKey(key).ok, true);
    assert.equal(fs.readFileSync(envFile, 'utf8'), `NEWSAPI_KEY=abc\nANTHROPIC_API_KEY=${key}\n`);
    assert.equal(fs.statSync(envFile).mode & 0o077, 0);
    assert.equal(claudeStatus().keyHint, '…wxyz');
    assert.ok(!JSON.stringify(claudeStatus()).includes(key));
    setClaudeEnabled(true);
    assert.equal(setApiKey('').ok, true);
    assert.equal(fs.readFileSync(envFile, 'utf8'), 'NEWSAPI_KEY=abc\n');
    assert.equal(claudeStatus().configured, false);
    assert.equal(claudeStatus().enabled, false);
});
