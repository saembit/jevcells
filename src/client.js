/**
 * client
 * The Apps Script side, the key in user properties, requests through UrlFetchApp in parallel batches with retries, answers cached for six hours
 **/

// The api root
var JEV_API = 'https://api.typesafe.ai/v1/systemone';

// The model
var JEV_MODEL = 'jev-latest';

// The property the key is kept under, per user, never in the sheet
var KEY_PROPERTY = 'TYPESAFE_API_KEY';

// How many requests go out at once
var BATCH_SIZE = 20;

// How many times a rate limited batch is retried
var MAX_RETRIES = 3;

// How long an answer is cached, seconds
var CACHE_SECONDS = 6 * 60 * 60;

// The most cells one formula may take, custom functions get thirty seconds
var MAX_CELLS = 500;

/**
 * getKey
 * Reads the user's key, throws a cell friendly error when there is none
 * @return {string}
 **/
function getKey() {
	var key = PropertiesService.getUserProperties().getProperty(KEY_PROPERTY);
	if (!key) throw new Error('#JEV set your TypeSafe key from the Jev menu first');
	return key;
}

/**
 * cacheKey
 * Hashes a request so the same question on the same text is answered from cache
 * @param req {Object} - the request with state and questions
 * @return {string}
 **/
function cacheKey(req) {
	var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify([JEV_MODEL, req.state, req.questions]), Utilities.Charset.UTF_8);
	var hex = '';
	for (var i = 0; i < digest.length; i++) hex += ('0' + ((digest[i] + 256) % 256).toString(16)).slice(-2);
	return 'jev:' + hex;
}

/**
 * ask
 * Sends many requests, each a state with its questions, and gives back the answers in the same order
 * @param reqs {Array<{state: any, questions: Object}>} - the requests
 * @return {Array<Object>}
 **/
function ask(reqs) {
	if (reqs.length > MAX_CELLS) throw new Error('#JEV at most ' + MAX_CELLS + ' cells per formula');
	var key = getKey();
	var cache = CacheService.getUserCache();
	var out = new Array(reqs.length);

	// Answer what the cache has, collect the rest
	var pending = [];
	for (var i = 0; i < reqs.length; i++) {
		if (!reqs[i].questions || Object.keys(reqs[i].questions).length === 0) { out[i] = {}; continue; }
		var hit = cache.get(cacheKey(reqs[i]));
		if (hit) out[i] = JSON.parse(hit);
		else pending.push(i);
	}

	// The rest in parallel batches
	for (var b = 0; b < pending.length; b += BATCH_SIZE) {
		var slice = pending.slice(b, b + BATCH_SIZE);
		var answers = fetchBatch(slice.map(function (i) { return reqs[i]; }), key);
		for (var k = 0; k < slice.length; k++) {
			out[slice[k]] = answers[k];
			try { cache.put(cacheKey(reqs[slice[k]]), JSON.stringify(answers[k]), CACHE_SECONDS); } catch (e) { /* a too large answer just isn't cached */ }
		}
	}
	return out;
}

/**
 * fetchBatch
 * Sends one batch with UrlFetchApp.fetchAll, retrying the rate limited ones with a short wait
 * @param reqs {Array<Object>} - the requests
 * @param key {string} - the api key
 * @return {Array<Object>}
 **/
function fetchBatch(reqs, key) {
	var answers = new Array(reqs.length);
	var todo = reqs.map(function (_, i) { return i; });
	for (var attempt = 0; attempt <= MAX_RETRIES && todo.length; attempt++) {
		if (attempt > 0) Utilities.sleep(500 * Math.pow(2, attempt - 1));
		var calls = todo.map(function (i) {
			return {
				url: JEV_API,
				method: 'post',
				contentType: 'application/json',
				headers: { Authorization: 'Bearer ' + key },
				payload: JSON.stringify({ model: JEV_MODEL, state: reqs[i].state, questions: reqs[i].questions }),
				muteHttpExceptions: true,
			};
		});
		var responses = UrlFetchApp.fetchAll(calls);
		var again = [];
		for (var k = 0; k < responses.length; k++) {
			var code = responses[k].getResponseCode();
			var i = todo[k];
			if (code === 429 || code === 529 || code >= 500) { again.push(i); continue; }
			if (code !== 200) throw new Error('#JEV HTTP ' + code + ' ' + responses[k].getContentText().slice(0, 120));
			answers[i] = JSON.parse(responses[k].getContentText()).answers || {};
		}
		todo = again;
	}
	if (todo.length) throw new Error('#JEV rate limited, try again in a moment');
	return answers;
}

// node only
if (typeof module !== 'undefined') {
	module.exports = { JEV_API, JEV_MODEL, BATCH_SIZE, MAX_CELLS };
}
