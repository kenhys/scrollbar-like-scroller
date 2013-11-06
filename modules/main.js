load('lib/WindowManager');
load('lib/prefs');

var PREF_BASE         = 'extensions.scrollbar-like-scroller@piro.sakura.ne.jp.';
var PREF_DEBUG        = PREF_BASE + 'debug';
var PREF_AREA_SIZE_RIGHT  = PREF_BASE + 'areaSize.right';
var PREF_AREA_SIZE_BOTTOM = PREF_BASE + 'areaSize.button';
var PREF_SCROLL_DELAY = PREF_BASE + 'scrollDelay';

var config = require('lib/config');
config.setDefault(PREF_DEBUG,        false);
config.setDefault(PREF_AREA_SIZE_RIGHT,  64);
config.setDefault(PREF_AREA_SIZE_BOTTOM, 64);
config.setDefault(PREF_SCROLL_DELAY, 50);

Cu.import('resource://gre/modules/Services.jsm');

const TYPE_BROWSER = 'navigator:browser';

function parseTouchEvent(aEvent) {
	var chrome = WindowManager.getWindow(TYPE_BROWSER);
	var content = aEvent.originalTarget;
	content = content.defaultView || content.ownerDocument.defaultView;
	var touch = aEvent.touches.item(0);
	var chromeZoom = chrome.QueryInterface(Ci.nsIInterfaceRequestor)
						.getInterface(Ci.nsIDOMWindowUtils)
						.screenPixelsPerCSSPixel;
	var viewport = chrome.BrowserApp.selectedTab.getViewport();
	var contentZoom = viewport.zoom;
	var parsed = {
		zoom    : contentZoom,
		width   : Math.round(viewport.width),
		height  : Math.round(viewport.height),
		eventX  : Math.round(touch.clientX * contentZoom),
		eventY  : Math.round(touch.clientY * contentZoom)
	};
	parsed.rightEdgeTouching = parsed.width - parsed.eventX <= prefs.getPref(PREF_AREA_SIZE_RIGHT);
	parsed.bottomEdgeTouching = parsed.height - parsed.eventY <= prefs.getPref(PREF_AREA_SIZE_BOTTOM);

	if (prefs.getPref(PREF_DEBUG) && aEvent.type != 'touchmove')
		chrome.NativeWindow.toast.show(aEvent.type+'\n'+
			JSON.stringify(parsed).replace(/,/g,',\n'), 'short');

	parsed.chrome = chrome;
	parsed.content = content;
	return parsed;
}

function updateScrollPosition(aParsedTouch) {
	var window = aParsedTouch.content;
	var x = window.scrollX;
	var y = window.scrollY;
	if (aParsedTouch.bottomEdgeTouching)
		x = window.scrollMaxX * (aParsedTouch.eventX / aParsedTouch.width);
	if (aParsedTouch.rightEdgeTouching)
		y = window.scrollMaxY * (aParsedTouch.eventY / aParsedTouch.height);
/*
	Services.obs.notifyObservers(null, 'Gesture:Scroll', JSON.stringify({
		x : x,
		y : y
	}));
*/
//	window.scrollTo(x, y);
	// set scroll position with delay, because the screen is scrolled by Firefox itself.
	window.setTimeout(function() {
		window.scrollTo(x, y);
	}, prefs.getPref(PREF_SCROLL_DELAY));
}

var handling = false;

function handleTouchStart(aEvent) {
	if (aEvent.touches.length > 1)
		return;
	var parsed = parseTouchEvent(aEvent);
	if (!parsed.rightEdgeTouching && !parsed.bottomEdgeTouching)
		return;
	handling = true;
	updateScrollPosition(parsed);
	aEvent.stopPropagation();
	aEvent.preventDefault();
}

function handleTouchEnd(aEvent) {
	if (!handling)
		return;
	if (aEvent.touches.length > 1) {
		handling = false;
		return;
	}
	handling = false;
	var parsed = parseTouchEvent(aEvent);
	updateScrollPosition(parsed);
	aEvent.stopPropagation();
	aEvent.preventDefault();
}

function handleTouchMove(aEvent) {
	if (!handling)
		return;
	if (aEvent.touches.length > 1) {
		handling = false;
		return;
	}
	var parsed = parseTouchEvent(aEvent);
	updateScrollPosition(parsed);
	aEvent.stopPropagation();
	aEvent.preventDefault();
}

function handleWindow(aWindow)
{
	var doc = aWindow.document;
	if (doc.documentElement.getAttribute('windowtype') != TYPE_BROWSER)
		return;

	aWindow.addEventListener('touchstart', handleTouchStart, true);
	aWindow.addEventListener('touchend', handleTouchEnd, true);
	aWindow.addEventListener('touchmove', handleTouchMove, true);
}

WindowManager.getWindows(TYPE_BROWSER).forEach(handleWindow);
WindowManager.addHandler(handleWindow);

function shutdown()
{
	WindowManager.getWindows(TYPE_BROWSER).forEach(function(aWindow) {
		aWindow.removeEventListener('touchstart', handleTouchStart, true);
		aWindow.removeEventListener('touchend', handleTouchEnd, true);
		aWindow.removeEventListener('touchmove', handleTouchMove, true);
	});
	WindowManager = undefined;
	prefs = undefined;
	config = undefined;
}
