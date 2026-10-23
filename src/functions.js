/**
 * functions
 * The custom functions people type in cells, each one normalizes its range, builds through core, asks through client and shapes back
 **/

/**
 * Probability that a yes/no question is true of the text, 0 to 1.
 * @param {A2:A50} range The text, one answer per row, a row of several cells is read together.
 * @param {"Is this a complaint?"} question The yes/no question.
 * @return {number[]}
 * @customfunction
 */
function JEV_PROB(range, question) {
	var items = itemsOf(range);
	return column(shapeIf(ask(buildIf(items, String(question)))));
}

/**
 * TRUE when the probability of yes is at least the threshold.
 * @param {A2:A50} range The text.
 * @param {"Is this a complaint?"} question The yes/no question.
 * @param {0.5} threshold Optional, default 0.5.
 * @return {boolean[]}
 * @customfunction
 */
function JEV_IF(range, question, threshold) {
	var t = threshold === undefined || threshold === '' ? 0.5 : Number(threshold);
	return column(shapeIf(ask(buildIf(itemsOf(range), String(question)))).map(function (p) { return p >= t; }));
}

/**
 * The option that fits the text, UNSURE under the confidence floor, NONE when nothing fits.
 * @param {A2:A50} range The text.
 * @param {"billing, technical, sales"} options Comma separated or a range.
 * @param {"Which team should handle this?"} question Optional.
 * @param {0.5} min_confidence Optional, default 0.
 * @return {string[]}
 * @customfunction
 */
function JEV_CHOICE(range, options, question, min_confidence) {
	var built = buildChoice(itemsOf(range), listOf(options), question ? String(question) : '');
	return column(shapeChoice(ask(built), Number(min_confidence || 0)));
}

/**
 * Where the text falls on your scale, 1 for the first level to N for the last, can land between.
 * @param {A2:A50} range The text.
 * @param {"How urgent is this?"} question The question.
 * @param {"low, medium, high"} levels Comma separated or a range, lowest first, 2 to 10.
 * @param {0.5} min_confidence Optional, default 0.
 * @return {number[]}
 * @customfunction
 */
function JEV_SCORE(range, question, levels, min_confidence) {
	var built = buildScore(itemsOf(range), String(question), listOf(levels));
	return column(shapeScore(ask(built), Number(min_confidence || 0)));
}

/**
 * Every label that applies to the text, comma joined, several may apply.
 * @param {A2:A50} range The text.
 * @param {"urgent, billing, bug"} labels Comma separated or a range.
 * @param {0.5} threshold Optional, probability a label needs, default 0.5.
 * @return {string[]}
 * @customfunction
 */
function JEV_TAGS(range, labels, threshold) {
	var list = listOf(labels);
	var t = threshold === undefined || threshold === '' ? 0.5 : Number(threshold);
	return column(shapeTags(ask(buildTags(itemsOf(range), list)), list, t));
}

/**
 * Picks a value out of the text, such as the email or the invoice number, from candidates found in the text, never invented.
 * @param {A2:A50} range The text.
 * @param {"the email address"} what What to pick.
 * @param {"[\w.]+@[\w.]+"} pattern Optional regex whose matches are the candidates, every word when empty.
 * @param {0.5} min_probability Optional, default 0.5.
 * @return {string[]}
 * @customfunction
 */
function JEV_PICK(range, what, pattern, min_probability) {
	var built = buildPick(itemsOf(range), String(what), pattern ? String(pattern) : '');
	var answers = ask(built.map(function (b) { return { state: b.state, questions: b.questions }; }));
	return column(shapePick(answers, built, min_probability === undefined || min_probability === '' ? 0.5 : Number(min_probability)));
}

/**
 * Ranks every row of the range on your criteria in one request, returns two columns, the composite score 1 to 5 and the rank.
 * @param {A2:A20} range The items, one per row.
 * @param {"How good is this for a group of ten?, How cheap is it?"} criteria One question per criterion, comma separated or a range.
 * @param {"3, 1"} weights Optional, a weight per criterion, equal when empty.
 * @return {number[][]}
 * @customfunction
 */
function JEV_RANK(range, criteria, weights) {
	var items = itemsOf(range);
	var crit = listOf(criteria);
	var w = weights === undefined || weights === '' ? [] : listOf(weights).map(Number);
	var built = buildRank(items, crit, w);
	var answers = ask([built])[0];
	return shapeRank(answers, items.length, crit.length, w).map(function (r) { return [r.score, r.rank]; });
}

/**
 * A fuzzy VLOOKUP, the entry in the lookup range that refers to the same thing as the text, blank when none.
 * @param {A2:A50} range The text to look up.
 * @param {Sheet2!A2:A200} lookup The list to match against, at most 254 rows.
 * @param {0.5} min_probability Optional, default 0.5.
 * @param {"Which product is this?"} question Optional, what counts as a match.
 * @return {string[]}
 * @customfunction
 */
function JEV_MATCH(range, lookup, min_probability, question) {
	var list = listOf(lookup);
	var built = buildMatch(itemsOf(range), list, question ? String(question) : '');
	return column(shapeMatch(ask(built), list, min_probability === undefined || min_probability === '' ? 0.5 : Number(min_probability)));
}

/**
 * itemsOf
 * Turns the range argument into one text per row, a header row is used to name the cells when the range is several columns and the first row looks like headers
 * @param range {any} - the argument
 * @return {Array<string>}
 **/
function itemsOf(range) {
	var rows = rowsOf(range);
	var headers = rows.length > 1 && rows[0].length > 1 && rows[0].every(function (h) { return typeof h === 'string' && h.trim() !== '' && h.length < 40; }) ? rows[0] : null;
	var body = headers ? rows.slice(1) : rows;
	var items = body.map(function (r) { return cellText(r.length === 1 ? r[0] : r, headers); });
	if (items.every(function (t) { return t === ''; })) throw new Error('#JEV the range is empty');
	return items;
}

/**
 * column
 * Shapes a list into the one column Sheets expects back from a custom function
 * @param list {Array} - the values
 * @return {Array<Array>}
 **/
function column(list) {
	return list.map(function (v) { return [v]; });
}
