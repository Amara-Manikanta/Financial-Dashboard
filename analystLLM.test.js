import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanFacts, factsText, parseBrief, stripThinking } from './analystLLM.js';

const facts = {
    date: '2026-09-29',
    financialYear: '2026-27 (ends 31 Mar 2027, 183 days away)',
    portfolio: '₹14,27,590 across 16 holdings',
    tax: 'estimated tax ₹2,200',
    prices: 'Prices are 2 hours old.',
    findings: [
        { id: 'alert:holding:101:a1', severity: 'act', title: 'HDFC Bank is above your ₹1,700 alert', why: 'Now ₹1,720.', suggestion: 'Decide.', figures: 'Price: ₹1,720' },
        { id: 'concentration:101', severity: 'review', title: 'HDFC Bank is 14.5%', why: 'SEBI caps…', suggestion: 'Trim 38 shares.', figures: '' },
    ],
    holdings: ['HDFC Bank (HDFCBANK): 14.5% of portfolio'],
};

test('facts are reduced to known fields of bounded size', () => {
    const cleaned = cleanFacts({ ...facts, secret: 'x', findings: [...facts.findings, { title: 'no id' }], holdings: Array(100).fill('h') });
    assert.equal(cleaned.secret, undefined);
    assert.equal(cleaned.findings.length, 2, 'a finding without an id is dropped');
    assert.equal(cleaned.holdings.length, 60);
    assert.equal(cleanFacts({ findings: [{ id: 'x', why: 'y'.repeat(5000) }] }).findings[0].why.length, 1500);
    assert.equal(cleanFacts(null), null);
    assert.equal(cleanFacts({ findings: 'nope' }), null);
});

test('the facts read as plain text, with each finding under its id', () => {
    const text = factsText(cleanFacts(facts), { withHoldings: true });
    assert.match(text, /- id: alert:holding:101:a1 \(act now\)\n {2}HDFC Bank is above your ₹1,700 alert/);
    assert.match(text, /Holdings, largest first:\n- HDFC Bank/);
    assert.doesNotMatch(factsText(cleanFacts(facts)), /Holdings/);
    assert.match(factsText(cleanFacts({ ...facts, findings: [] })), /Findings: none/);
});

test('a reasoning model\'s working is removed, with or without its opening tag', () => {
    assert.equal(stripThinking('<think>hmm</think>\n{"a":1}'), '{"a":1}');
    assert.equal(stripThinking('still thinking</think>answer'), 'answer');
    assert.equal(stripThinking('plain'), 'plain');
});

test('a brief keeps only priorities that name a real finding, once each', () => {
    const ids = facts.findings.map((f) => f.id);
    const reply = `Sure! {"summary":"Two things.","priorities":[
        {"id":"concentration:999","why":"invented"},
        {"id":"concentration:101","why":"first"},
        {"id":"concentration:101","why":"again"},
        {"id":"alert:holding:101:a1","why":"second"}]} Hope that helps.`;
    const brief = parseBrief(reply, ids);
    assert.equal(brief.summary, 'Two things.');
    assert.deepEqual(brief.priorities.map((p) => p.id), ['concentration:101', 'alert:holding:101:a1']);
    assert.equal(brief.discarded, 2);
    assert.equal(parseBrief('no json here', ids), null);
    assert.equal(parseBrief('{not json}', ids), null);
});
