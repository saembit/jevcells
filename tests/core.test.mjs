import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

// The core is plain Apps Script style CommonJS, load it the Node way
const core = createRequire(import.meta.url)('../src/core.js');

// A noul answer
const n = (v) => ({ type: 'noul', noul: v });

// A choice answer
const c = (pick, probs, confidence = 0.8) => ({ type: 'choice', choice: pick, probabilities: probs, confidence });

// A score answer
const s = (v, confidence = 0.9) => ({ type: 'score', score: v, confidence });

describe('cell helpers', () => {
	// Scalars, columns and rows all become rows
	it('normalizes ranges and joins rows with headers', () => {
		expect(core.rowsOf('x')).toEqual([['x']]);
		expect(core.rowsOf(['a', 'b'])).toEqual([['a'], ['b']]);
		expect(core.rowsOf([['a', 1]])).toEqual([['a', 1]]);
		expect(core.cellText(' hi ')).toBe('hi');
		expect(core.cellText(['Widget', 9.5, ''], ['name', 'price'])).toBe('name: Widget\nprice: 9.5');
		expect(core.listOf('a, b ,, c')).toEqual(['a', 'b', 'c']);
		expect(core.listOf([['a'], ['b']])).toEqual(['a', 'b']);
	});
});

describe('if, choice, score', () => {
	// One request per item and the shapes back
	it('builds and shapes the basics', () => {
		expect(core.buildIf(['x', 'y'], 'ok?')).toHaveLength(2);
		expect(core.shapeIf([{ q: n(0.9) }, {}])).toEqual([0.9, 0]);
		const ch = core.buildChoice(['x'], ['a', 'b'], '');
		expect(Object.keys(ch[0].questions.q.criteria)).toEqual(['a', 'b', core.NONE]);
		expect(core.shapeChoice([{ q: c('a', { a: 0.9 }, 0.9) }, { q: c('a', { a: 0.5 }, 0.3) }, { q: c(core.NONE, {}) }, {}], 0.5)).toEqual(['a', 'UNSURE', 'NONE', '#JEV no answer']);
		expect(() => core.buildChoice(['x'], ['a'], '')).toThrow(/two options/);
		expect(core.shapeScore([{ q: s(1.4) }, { q: s(1.4, 0.1) }], 0.5)).toEqual([2.4, 'UNSURE']);
		expect(() => core.buildScore(['x'], 'q', ['one'])).toThrow(/2 to 10/);
	});
});

describe('tags', () => {
	// One noul per label, labels over the threshold joined
	it('builds one noul per label and keeps the ones over the threshold', () => {
		const built = core.buildTags(['x'], ['urgent', 'billing', 'spam']);
		expect(Object.keys(built[0].questions)).toEqual(['l0', 'l1', 'l2']);
		expect(core.shapeTags([{ l0: n(0.9), l1: n(0.6), l2: n(0.1) }], ['urgent', 'billing', 'spam'], 0.5)).toEqual(['urgent, billing']);
	});
});

describe('pick', () => {
	// Candidates come from the text and the pick is one of them
	it('finds candidates by regex and returns the picked one', () => {
		const built = core.buildPick(['mail me at ann@x.com or bob@y.org'], 'the email address', '[\\w.]+@[\\w.]+');
		expect(built[0].candidates).toEqual(['ann@x.com', 'bob@y.org']);
		expect(core.shapePick([{ q: c('2', { 2: 0.8 }) }], built, 0.5)).toEqual(['bob@y.org']);
		expect(core.shapePick([{ q: c('2', { 2: 0.2 }) }], built, 0.5)).toEqual(['']);
		expect(core.shapePick([{ q: c(core.NONE, {}) }], built, 0.5)).toEqual(['']);
		const words = core.buildPick(['pay 40 dollars'], 'the amount', '');
		expect(words[0].candidates).toEqual(['pay', '40', 'dollars']);
		expect(core.buildPick(['nothing here'], 'x', '\\d+')[0].questions).toEqual({});
	});
});

describe('rank', () => {
	// One request for the range, one score per item per criterion, weighted composite and positions
	it('ranks with weights', () => {
		const built = core.buildRank(['a', 'b', 'c'], ['tasty?', 'cheap?'], [3, 1]);
		expect(Object.keys(built.questions)).toHaveLength(6);
		expect(built.state.items['2']).toBe('b');
		const answers = { '1__1': s(4), '1__2': s(0), '2__1': s(2), '2__2': s(4), '3__1': s(0), '3__2': s(0) };
		const out = core.shapeRank(answers, 3, 2, [3, 1]);
		expect(out[0]).toEqual({ score: 4, rank: 1 });
		expect(out[1]).toEqual({ score: 3.5, rank: 2 });
		expect(out[2]).toEqual({ score: 1, rank: 3 });
		expect(() => core.buildRank(['a'], ['q'], [])).toThrow(/two items/);
		expect(() => core.buildRank(['a', 'b'], ['q'], [1, 2])).toThrow(/weights/);
	});
});

describe('match', () => {
	// A fuzzy lookup over the list plus none
	it('matches to a lookup entry', () => {
		const built = core.buildMatch(['Acme Inc.'], ['ACME Incorporated', 'Globex'], '');
		expect(Object.keys(built[0].questions.q.criteria)).toEqual(['1', '2', core.NONE]);
		expect(core.shapeMatch([{ q: c('1', { 1: 0.9 }) }], ['ACME Incorporated', 'Globex'], 0.5)).toEqual(['ACME Incorporated']);
		expect(core.shapeMatch([{ q: c(core.NONE, {}) }], ['ACME Incorporated'], 0.5)).toEqual(['']);
	});
});
