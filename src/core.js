/**
 * core
 * The pure part of jevcells, builds requests from cell values and shapes answers back into cell values, no Apps Script in here so it runs in tests
 **/

// The option that means nothing fits
var NONE = 'none';

// The levels every rank criterion is scored on
var RANK_LEVELS = ['Very poor', 'Poor', 'Okay', 'Good', 'Excellent'];

// The most options a choice may carry
var MAX_OPTIONS = 255;

/**
 * cellText
 * Turns one cell or one row of cells into the text Jev reads, a row becomes "header: value" lines when headers are given
 * @param row {Array|any} - the cell or the row
 * @param headers {Array|undefined} - the column headers for a row
 * @return {string}
 **/
function cellText(row, headers) {
	// A single cell is just its text
	if (!Array.isArray(row)) return String(row == null ? '' : row).trim();

	// A row is one line per cell, named when there is a header
	var parts = [];
	for (var i = 0; i < row.length; i++) {
		var v = row[i] == null ? '' : String(row[i]).trim();
		if (v === '') continue;
		parts.push(headers && headers[i] ? headers[i] + ': ' + v : v);
	}
	return parts.join('\n');
}

/**
 * rowsOf
 * Normalizes a range argument into a list of rows, a scalar becomes one row of one cell
 * @param range {any} - the argument as Sheets passes it
 * @return {Array<Array>}
 **/
function rowsOf(range) {
	if (!Array.isArray(range)) return [[range]];
	if (range.length > 0 && !Array.isArray(range[0])) return range.map(function (v) { return [v]; });
	return range;
}

/**
 * listOf
 * Turns a comma separated string or a range into a flat list of trimmed non empty strings
 * @param v {any} - the argument
 * @return {Array<string>}
 **/
function listOf(v) {
	var out = [];
	var raw = Array.isArray(v) ? [].concat.apply([], rowsOf(v)) : String(v == null ? '' : v).split(',');
	for (var i = 0; i < raw.length; i++) {
		var s = String(raw[i] == null ? '' : raw[i]).trim();
		if (s !== '') out.push(s);
	}
	return out;
}

/**
 * noulQuestion
 * Builds a yes/no question
 * @param instructions {any} - the question
 * @return {Object}
 **/
function noulQuestion(instructions) {
	return { type: 'noul', instructions: instructions };
}

/**
 * choiceQuestion
 * Builds a pick one question over named options, null descriptions
 * @param instructions {any} - the question
 * @param options {Array<string>} - the option names
 * @param withNone {boolean} - whether to add a none option
 * @return {Object}
 **/
function choiceQuestion(instructions, options, withNone) {
	var criteria = {};
	for (var i = 0; i < options.length; i++) criteria[options[i]] = null;
	if (withNone) criteria[NONE] = 'None of the listed options fits';
	return { type: 'choice', instructions: instructions, criteria: criteria };
}

/**
 * scoreQuestion
 * Builds a rubric question over ordered levels
 * @param instructions {any} - the question
 * @param levels {Array<string>} - the levels lowest first
 * @return {Object}
 **/
function scoreQuestion(instructions, levels) {
	return { type: 'score', instructions: instructions, criteria: levels };
}

/**
 * buildIf
 * One request per item, one noul
 * @param items {Array<string>} - the texts
 * @param question {string} - the yes/no question
 * @return {Array<{state: any, questions: Object}>}
 **/
function buildIf(items, question) {
	return items.map(function (text) { return { state: text, questions: { q: noulQuestion(question) } }; });
}

/**
 * shapeIf
 * The probability of yes per item
 * @param answersList {Array<Object>} - the answers per item
 * @return {Array<number>}
 **/
function shapeIf(answersList) {
	return answersList.map(function (a) { return noulOf(a, 'q'); });
}

/**
 * buildChoice
 * One request per item, one choice over the options plus none
 * @param items {Array<string>} - the texts
 * @param options {Array<string>} - the option names
 * @param question {string} - the question, a default when empty
 * @return {Array<{state: any, questions: Object}>}
 **/
function buildChoice(items, options, question) {
	if (options.length < 2) throw new Error('JEV_CHOICE needs at least two options');
	if (options.length > MAX_OPTIONS) throw new Error('JEV_CHOICE takes at most ' + MAX_OPTIONS + ' options');
	var q = question || 'Which option best describes the text?';
	return items.map(function (text) { return { state: text, questions: { q: choiceQuestion(q, options, true) } }; });
}

/**
 * shapeChoice
 * The picked option per item, UNSURE under the confidence floor, NONE when nothing fit
 * @param answersList {Array<Object>} - the answers per item
 * @param minConfidence {number} - the confidence floor
 * @return {Array<string>}
 **/
function shapeChoice(answersList, minConfidence) {
	return answersList.map(function (a) {
		var ans = a.q || {};
		if (!ans.choice) return '#JEV no answer';
		if (ans.choice === NONE) return 'NONE';
		if ((ans.confidence || 0) < minConfidence) return 'UNSURE';
		return ans.choice;
	});
}

/**
 * buildScore
 * One request per item, one score over the levels
 * @param items {Array<string>} - the texts
 * @param question {string} - the question
 * @param levels {Array<string>} - the levels lowest first
 * @return {Array<{state: any, questions: Object}>}
 **/
function buildScore(items, question, levels) {
	if (levels.length < 2 || levels.length > 10) throw new Error('JEV_SCORE needs 2 to 10 levels');
	return items.map(function (text) { return { state: text, questions: { q: scoreQuestion(question, levels) } }; });
}

/**
 * shapeScore
 * The score per item on a 1 to N scale, blank under the confidence floor
 * @param answersList {Array<Object>} - the answers per item
 * @param minConfidence {number} - the confidence floor
 * @return {Array<number|string>}
 **/
function shapeScore(answersList, minConfidence) {
	return answersList.map(function (a) {
		var ans = a.q || {};
		if (typeof ans.score !== 'number') return '#JEV no answer';
		if ((ans.confidence || 0) < minConfidence) return 'UNSURE';
		return Math.round((ans.score + 1) * 100) / 100;
	});
}

/**
 * buildTags
 * One request per item, one noul per label, several labels may apply
 * @param items {Array<string>} - the texts
 * @param labels {Array<string>} - the labels
 * @return {Array<{state: any, questions: Object}>}
 **/
function buildTags(items, labels) {
	if (labels.length < 1) throw new Error('JEV_TAGS needs at least one label');
	return items.map(function (text) {
		var questions = {};
		for (var i = 0; i < labels.length; i++) {
			questions['l' + i] = noulQuestion({ label: labels[i], question: 'Does `label` apply to the text?' });
		}
		return { state: text, questions: questions };
	});
}

/**
 * shapeTags
 * The labels over the threshold per item, comma joined
 * @param answersList {Array<Object>} - the answers per item
 * @param labels {Array<string>} - the labels
 * @param threshold {number} - the probability a label needs
 * @return {Array<string>}
 **/
function shapeTags(answersList, labels, threshold) {
	return answersList.map(function (a) {
		var out = [];
		for (var i = 0; i < labels.length; i++) if (noulOf(a, 'l' + i) >= threshold) out.push(labels[i]);
		return out.join(', ');
	});
}

/**
 * buildPick
 * One request per item, one choice over the candidates found in the item plus none, so a value is selected not written
 * @param items {Array<string>} - the texts
 * @param what {string} - what to pick, such as the email address or the invoice number
 * @param pattern {string} - a regex whose matches are the candidates, every word when empty
 * @return {Array<{state: any, questions: Object, candidates: Array<string>}>}
 **/
function buildPick(items, what, pattern) {
	var re = pattern ? new RegExp(pattern, 'g') : /[^\s,;]+/g;
	return items.map(function (text) {
		var found = [];
		var seen = {};
		var m;
		re.lastIndex = 0;
		while ((m = re.exec(text)) !== null) {
			if (!seen[m[0]] && found.length < MAX_OPTIONS - 1) { seen[m[0]] = true; found.push(m[0]); }
			if (m[0] === '') re.lastIndex++;
		}
		var options = {};
		for (var i = 0; i < found.length; i++) options[String(i + 1)] = found[i];
		options[NONE] = 'The text does not contain it';
		return {
			state: { text: text, candidates: options },
			questions: found.length ? { q: { type: 'choice', instructions: { what: what, question: 'Which entry in `candidates` is `what` in `text`?' }, criteria: options } } : {},
			candidates: found,
		};
	});
}

/**
 * shapePick
 * The picked candidate per item, blank when none or under the floor
 * @param answersList {Array<Object>} - the answers per item
 * @param built {Array<Object>} - the built requests with their candidates
 * @param minProbability {number} - the probability the pick needs
 * @return {Array<string>}
 **/
function shapePick(answersList, built, minProbability) {
	return answersList.map(function (a, i) {
		var ans = a.q || {};
		if (!ans.choice || ans.choice === NONE || !/^[1-9]\d*$/.test(ans.choice)) return '';
		var idx = Number(ans.choice);
		var p = (ans.probabilities || {})[ans.choice] || 0;
		if (idx > built[i].candidates.length || p < minProbability) return '';
		return built[i].candidates[idx - 1];
	});
}

/**
 * buildRank
 * One request for the whole range, one score per item per criterion, the composite is averaged in code
 * @param items {Array<string>} - the texts
 * @param criteria {Array<string>} - one question per criterion
 * @param weights {Array<number>} - a weight per criterion, equal when empty
 * @return {{state: any, questions: Object}}
 **/
function buildRank(items, criteria, weights) {
	if (items.length < 2) throw new Error('JEV_RANK needs at least two items');
	if (criteria.length < 1) throw new Error('JEV_RANK needs at least one criterion');
	if (weights.length && weights.length !== criteria.length) throw new Error('JEV_RANK weights must match the criteria');
	var state = { items: {} };
	var questions = {};
	for (var i = 0; i < items.length; i++) {
		state.items[String(i + 1)] = items[i];
		for (var c = 0; c < criteria.length; c++) {
			questions[(i + 1) + '__' + (c + 1)] = scoreQuestion('Consider only `items.' + (i + 1) + '`. ' + criteria[c], RANK_LEVELS);
		}
	}
	return { state: state, questions: questions };
}

/**
 * shapeRank
 * The composite per item, weighted average of the scores on a 1 to 5 scale, plus the rank position
 * @param answers {Object} - the answers
 * @param count {number} - how many items
 * @param criteriaCount {number} - how many criteria
 * @param weights {Array<number>} - a weight per criterion, equal when empty
 * @return {Array<{score: number, rank: number}>}
 **/
function shapeRank(answers, count, criteriaCount, weights) {
	var w = weights.length ? weights : [];
	for (var c = 0; !weights.length && c < criteriaCount; c++) w.push(1);
	var total = w.reduce(function (s, x) { return s + x; }, 0) || 1;
	var rows = [];
	for (var i = 1; i <= count; i++) {
		var sum = 0;
		for (var k = 1; k <= criteriaCount; k++) {
			var a = answers[i + '__' + k] || {};
			sum += (typeof a.score === 'number' ? a.score + 1 : 0) * w[k - 1];
		}
		rows.push({ i: i - 1, score: Math.round((sum / total) * 100) / 100 });
	}
	var order = rows.slice().sort(function (x, y) { return y.score - x.score || x.i - y.i; });
	var out = new Array(count);
	for (var r = 0; r < order.length; r++) out[order[r].i] = { score: order[r].score, rank: r + 1 };
	return out;
}

/**
 * buildMatch
 * One request per item, one choice over the lookup list plus none, a fuzzy VLOOKUP
 * @param items {Array<string>} - the texts to look up
 * @param lookup {Array<string>} - the list to match against
 * @param question {string} - what counts as a match, a default when empty
 * @return {Array<{state: any, questions: Object}>}
 **/
function buildMatch(items, lookup, question) {
	if (lookup.length < 1) throw new Error('JEV_MATCH needs a lookup range');
	if (lookup.length > MAX_OPTIONS - 1) throw new Error('JEV_MATCH takes at most ' + (MAX_OPTIONS - 1) + ' lookup rows');
	var q = question || 'Which entry in `lookup` refers to the same thing as `text`, allowing for typos, abbreviations and different word order?';
	return items.map(function (text) {
		var options = {};
		for (var i = 0; i < lookup.length; i++) options[String(i + 1)] = lookup[i];
		options[NONE] = 'Nothing in the lookup list matches';
		return { state: { text: text, lookup: options }, questions: { q: { type: 'choice', instructions: q, criteria: options } } };
	});
}

/**
 * shapeMatch
 * The matched lookup entry per item, blank under the floor or when none
 * @param answersList {Array<Object>} - the answers per item
 * @param lookup {Array<string>} - the lookup list
 * @param minProbability {number} - the probability the match needs
 * @return {Array<string>}
 **/
function shapeMatch(answersList, lookup, minProbability) {
	return answersList.map(function (a) {
		var ans = a.q || {};
		if (!ans.choice || ans.choice === NONE || !/^[1-9]\d*$/.test(ans.choice)) return '';
		var idx = Number(ans.choice);
		var p = (ans.probabilities || {})[ans.choice] || 0;
		if (idx > lookup.length || p < minProbability) return '';
		return lookup[idx - 1];
	});
}

/**
 * noulOf
 * Reads a noul answer, 0 when missing
 * @param answers {Object} - the answers
 * @param id {string} - the question id
 * @return {number}
 **/
function noulOf(answers, id) {
	var a = answers && answers[id];
	return a && typeof a.noul === 'number' ? a.noul : 0;
}

// node only
if (typeof module !== 'undefined') {
	module.exports = { NONE, RANK_LEVELS, cellText, rowsOf, listOf, buildIf, shapeIf, buildChoice, shapeChoice, buildScore, shapeScore, buildTags, shapeTags, buildPick, shapePick, buildRank, shapeRank, buildMatch, shapeMatch, noulOf };
}
