/**
 * sidebar
 * The Jev menu and the sidebar that stores the key in the user's properties
 **/

/**
 * onOpen
 * Adds the Jev menu when the sheet opens
 **/
function onOpen() {
	SpreadsheetApp.getUi().createMenu('Jev').addItem('Set API key', 'showSidebar').addItem('Clear API key', 'clearKey').addItem('Help', 'showHelp').addToUi();
}

/**
 * onInstall
 * Same as onOpen, for the marketplace install
 **/
function onInstall() {
	onOpen();
}

/**
 * showSidebar
 * Opens the key sidebar
 **/
function showSidebar() {
	SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutputFromFile('Sidebar').setTitle('Jev'));
}

/**
 * saveKey
 * Stores the key for this user, called from the sidebar
 * @param key {string} - the key
 * @return {string}
 **/
function saveKey(key) {
	var k = String(key || '').trim();
	if (!k) throw new Error('empty key');
	PropertiesService.getUserProperties().setProperty(KEY_PROPERTY, k);
	return 'saved';
}

/**
 * clearKey
 * Forgets the key for this user
 **/
function clearKey() {
	PropertiesService.getUserProperties().deleteProperty(KEY_PROPERTY);
	SpreadsheetApp.getUi().alert('Jev key cleared');
}

/**
 * hasKey
 * Says whether a key is stored, for the sidebar
 * @return {boolean}
 **/
function hasKey() {
	return !!PropertiesService.getUserProperties().getProperty(KEY_PROPERTY);
}

/**
 * showHelp
 * A short cheat sheet of the formulas
 **/
function showHelp() {
	SpreadsheetApp.getUi().alert(
		'Jev formulas',
		'=JEV_PROB(A2:A50, "Is this a complaint?")\n=JEV_IF(A2, "Is this urgent?", 0.7)\n=JEV_CHOICE(A2:A50, "billing, technical, sales")\n=JEV_SCORE(A2:A50, "How urgent?", "low, medium, high")\n=JEV_TAGS(A2:A50, "urgent, billing, bug")\n=JEV_PICK(A2:A50, "the email address", "[\\w.]+@[\\w.]+")\n=JEV_RANK(A2:A20, "How good for a group?, How cheap?", "3, 1")\n=JEV_MATCH(A2:A50, Sheet2!A2:A200)\n\nText in the cells goes to TypeSafe. Answers are cached for six hours.',
		SpreadsheetApp.getUi().ButtonSet.OK,
	);
}
