function setupListener()
{
	chrome.webRequest.onBeforeSendHeaders.addListener
	(
		// callback
		function(info)
		{
			var info_url = info.url;
			var interceptUrl = interceptOrNot(info);

			if( interceptUrl == 1 )
			{
				var b64Msg = "";
				var b64Url = window.btoa(info_url);

				var parser = document.createElement("a");
				parser.href = info_url;
				var lHostName = parser.hostname.toLowerCase();

				var lHostNameOrig = lHostName;
				lHostName=normalizeHostname(lHostNameOrig);

				var respArr = getRespArr(lHostName, b64Url, b64Msg, info_url);

				var actionStr = respArr[0];
				var policyStr = respArr[1];
				var categoryStr = respArr[2];
				var keywordScanStr = respArr[3];
				var ytSSStr = respArr[4];
				var gmSmStr = respArr[4];
				var ytEduStr = respArr[5];
				var ytEduAccStr = respArr[6];

				if(actionStr == "GM") {
					info.requestHeaders.push({name: 'X-GoogApps-Allowed-Domains', value: gmSmStr});
					return{requestHeaders: info.requestHeaders}; // GM return
				}

				// TODO: Ignore keyword scanning for YT for now
				if(actionStr == "YT") {
					if (ytSSStr == 1) {
						info.requestHeaders.push({name: 'YouTube-Restrict', value: 'Strict'});
					}
					return {requestHeaders: info.requestHeaders}; // YT return
				}
				return {requestHeaders: info.requestHeaders}; // Default return
			}
		},
		// filters
		{
			urls:
				["*://*.youtube.com/*", "*://accounts.google.com/*", "*://mail.google.com/*", "*://drive.google.com/*"]
		},
		// extraInfoSpec
		["blocking", "requestHeaders"] // make the callback blocking type so request waits until this returns
	);

	chrome.webRequest.onBeforeRequest.addListener
	(
		// callback
		function (info)
		{
			var rawInfoURL = info.url;
			var info_url;

			// don't convert youtube.com URL since the video ID is case sensitive
			/*if (rawInfoURL.indexOf('youtube.com') == -1) {
				info_url = rawInfoURL.toLowerCase();
			} else {
				info_url = rawInfoURL;
			}*/
			info_url = rawInfoURL;
			
			var interceptUrl = interceptOrNot(info);
            if(info.type == "sub_frame" && info.initiator == "file://" && info.url.indexOf("http") === 0){
                interceptUrl = 1;
			}

			if( interceptUrl == 1 )
			{
				var b64Msg = "";
				b64Msg = getSocialPost(info, info_url);

				var b64Url = window.btoa(info_url);

				var lHostName;
				if(info_url.indexOf("translate.google.com") != -1)
				{
					lHostName = extractTranslateHostname(info_url);
				}
				else
				{
					var parser = document.createElement("a");
					parser.href = info_url;
					lHostName = parser.hostname.toLowerCase();
				}

				var lHostNameOrig = lHostName;
				lHostName = normalizeHostname(lHostNameOrig);

				// If geolocation is turned on, get user location if the IP has changed.
				if (window.geolocation) {
					getRemoteIPGeo();
				}

				// info.tabId is the id of tab which sends this web request, and it may be not the current tab
				var respArr = getRespArrTabs(lHostName, b64Url, b64Msg, info_url, info.tabId);

				/*

				Response string formats:

				value of "-1" wherever a field is irrelevant

				"ALLOW:$policy_id:$genes_vector:$keyword_scanning:-1:-1:-1"; // allow
				"DENY:$policy_id:$genes_vector:$keyword_scanning:-1:-1:-1"; // deny
				"SS:$policy_id:$genes_vector:$keyword_scanning:-1:-1:-1"; // safe search for G/B/Y
				"YT:$policy_id:$genes_vector:$keyword_scanning:$yt_sm:$yt_edu:$yt_edu_string"; // safety &/or edu mode for YT
				"GM:$policy_id:$genes_vector:$keyword_scanning:$gm_sm_string:-1:-1"; // "safety mode string" for GM and Google drive

				Examples:
				"ALLOW:0:-1:-1:-1:-1:-1";
				"ALLOW:G:WL:-1:-1:-1:-1"; // G=global, WL=Whitelist
				"ALLOW:$policy_id:$genes_vector:$keyword_scanning:-1:-1:-1";
				"ALLOW:$policy_id:WL:-1:-1:-1:-1";
				"DENY:0:-1:-1:-1:-1:-1";
				"DENY:G:BL:-1:-1:-1:-1";
				"DENY:$policy_id:BL:-1:-1:-1:-1";
				"DENY:$policy_id:$genes_vector:-1:-1:-1:-1";
				"SS:$policy_id:$genes_vector:$keyword_scanning:-1:-1:-1";
				"YT:$policy_id:$genes_vector:$keyword_scanning:$yt_sm:$yt_edu:$yt_edu_string";
				"GM:$policy_id:$genes_vector:$keyword_scanning:$gm_sm_string:-1:-1";
				"PAUSE:998:-1:-1:-1:-1:-1";

				*/

				var actionStr = respArr[0];
				var policyStr = respArr[1];
				var categoryStr = respArr[2];
				var keywordScanStr = respArr[3];
				var ytSSStr = respArr[4];
				var ytEduStr = respArr[5];
				var ytEduAccStr = respArr[6];

				/* Removed DENY for ERROR cases. ERROR means ALLOW now. This was because of issues with Captive portals. */
				if ( actionStr == "DENY" )
				{
					return takeDenyAction(policyStr, categoryStr, b64Url);
				}

				if ( actionStr == "PAUSE" )
				{
					return getPauseAction(b64Url);
				}

				// check if safe search or common creative image search is on
				var isSSOrCC = false;

				if (actionStr == "SS") {
					rawInfoURL = takeSafeSearchAction(lHostName, rawInfoURL);
					isSSOrCC = true;
				}

				// creative common search
				if (categoryStr == "CC") {
					rawInfoURL = takeCreativeCommonImageSearchAction(rawInfoURL);
					isSSOrCC = true;
				}

				// if safe search of common creative image search is checked, redirect to the new url
				if (isSSOrCC === true) {
					return {redirectUrl: rawInfoURL};
				}

				// YT action moved to onbeforesendheaders()

				return; // Default Allow
			}
		},
		// filters
		{
			urls:
				["<all_urls>"]
		},
		// extraInfoSpec
		["blocking", "requestBody"] // make the callback blocking type so request waits until this returns
	);

	chrome.identity.onSignInChanged.addListener
	(
		function(account, signedIn) {
			if (signedIn === true) {
				fetchUserAPI();
			}
		}
	);

}
