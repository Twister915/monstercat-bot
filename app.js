/* Import modules */
var request = require('request');
var cheerio = require('cheerio');
var settings = require('./settings');

var postedToday = false;
var beatportURL = "http://www.beatport.com/label/monstercat/23412";
var soundcloudURL = "https://api.soundcloud.com/users/8553751/tracks.json?client_id=" + settings.scApiKey;
var youtubeURL = "https://www.googleapis.com/youtube/v3/playlistItems?playlistId=UUJ6td3C9QlPO9O_J5dF4ZzA&key=" + settings.ytApiKey + "&part=snippet&maxResults=1";
var bpData, bcData, scData, ytData, post;

function update() {

	var date = new Date();

	if (date.getUTCDay == 1 || date.getUTCDay == 3 || date.getUTCDay == 5) {	// Is it a day in which we should be posting on?

		if (date.getHours() == 0 && date.getMinutes() < 5 && postedToday === false) {	// Is it time to post?

			compilePost();
		}
	}
}

initiatePost();

function initiatePost() {

	post = {	// Clear the post variables

		title: "",
		trackTitle: "",
		artist: "",
		links: {

			youtube: "",
			beatport: "",
			soundcloud: "",
			bandcamp: "",
			itunes: "",
			spotify: "",
			artwork: ""
		}
	}
	request(beatportURL, beatport);
	request(soundcloudURL, soundcloud);
	request(youtubeURL, youtube);
	
	if (post.links.bandcamp) {

		request(post.links.bandcamp, bandcamp);
	}
}

function beatport(err, res, body) {

	if (!err && res.statusCode == 200) {

		var $ = cheerio.load(body);	// We use JQuery to scrape for this

		bpData = {	// Make an object of values we'll need

			type: "beatport",
			title: "",
			date: "",
			artist: "",
			link: "",
			artwork: ""
		};

		$('div.release-newest-xlarge').filter(function() {	// Skip straight to the latest release box

			var data = $(this);

			// Get track title
			bpData.title = data.children().last().children().first().text();

			// Get track release date
			bpData.date = data.children().last().children().eq(3).text();

			// Get track artist(s)
			var artistBuffer = [];
			data.children().last().children().eq(1).children('a').each(function() {
				artistBuffer.push($(this).text());	// In case there's multiple artists
			});
			if (artistBuffer.length == 1) {	// If there's one artist on this track (Artist)

				bpData.artist = artistBuffer[0];
			} else {	// If there's more than two artists on this track (Artist, Artist & Artist)

				bpData.artist = artistBuffer[0];
				for (var i = 1; i < artistBuffer.length - 1; i++) {
					bpData.artist += ", " + artistBuffer[i];
				}
				bpData.artist += " & " + artistBuffer[artistBuffer.length - 1];
			}

			// Get track link
			bpData.link = 'http://www.beatport.com' + data.children().last().children().first().attr('href');

			// Get album artwork link
			bpData.artwork = data.children().first().children().first().children().first().children().first().attr('data-full-image-url');

			console.log("BTPRT: RECIEVED RESPONSE");
			addToPost(bpData);
		});
	} else if (err) {

		throw err;
	} else {

		console.log('BTPRT: ' + res.statusCode + ' - ' + res.body);
	}
}

function bandcamp(err, res, body) {	// Note: There is no mechanism to pull bandcamp URLs

	if (!err && res.statusCode == 200) {

		var $ = cheerio.load(body);

		bcData = {

			type: "bandcamp",
			artwork: ""
		};

		bcData.artwork = $('#tralbumArt').children().first().attr('href');

		console.log("BNCMP: RECIEVED RESPONSE");
		addToPost(bcData);

	} else if (err) {

		throw err;
	} else {

		console.log('BNCMP: ' + res.statusCode + ' - ' + res.body);
	}
}

function soundcloud(err, res, body) {

	if (!err && res.statusCode == 200) {

		var track = JSON.parse(body)[0];

		scData = {

			type: "soundcloud",
			title: track.title.split("-")[1].slice(1),
			date: track.release_year + "-" + track.release_month + "-" + track.release_day,
			artist: track.title.split("-")[0].slice(0, -1),
			link: track.permalink_url,
			artwork: track.artwork_url
		}

		console.log("SNCLD: RECIEVED RESPONSE");
		addToPost(scData);
	} else if (err) {

		throw err;
	} else {

		console.log('SNCLD: ' + res.statusCode + ' - ' + res.body);
	}
}

function youtube(err, res, body) {

	if (!err && res.statusCode == 200) {

		var track = JSON.parse(body).items[0].snippet;

		ytData = {

			type: "youtube",
			title: track.title.split(" - ")[2].split(" [")[0],
			date: track.publishedAt.slice(0, -14),
			artist: track.title.split(" - ")[1],
			link: "http://www.youtube.com/watch?v=" + track.resourceId.videoId,
			bcLink: track.description.split("\n")[1].slice(21),
			itLink: track.description.split("\n")[2].slice(19),
			spLink: track.description.split("\n")[5].slice(19)
		}

		addToPost(ytData);
	} else if (err) {

		throw err;
	} else {

		console.log('YOUTB: ' + res.statusCode + ' - ' + res.body);
	}
}

function addToPost(data) {

	if (!post.trackTitle && data.title) {

		post.trackTitle = data.title;
	}

	if (!post.artist && data.artist) {

		post.artist = data.artist;
	} else if (post.artist && data.artist && data.type != 'beatport') {

		post.artist = data.artist;
	}

	if (!post.links.artwork && data.artwork) {

		post.links.artwork = data.artwork;
	} else if (post.links.artwork && data.artwork && data.type != 'beatport') {

		post.links.artwork = data.artwork;
	}

	if (data.type == 'beatport') {

		post.links.beatport = data.link;
	}

	if (data.type == 'soundcloud') {

		post.links.soundcloud = data.link;
	}

	if (data.type == 'youtube') {

		post.links.youtube = data.link;
		post.links.bandcamp = data.bcLink;
		post.links.itunes = data.itLink;
		post.links.spotify = data.spLink;
	}

	if (post.trackTitle && post.artist) {
		post.title = post.artist + " - " + post.trackTitle + " Megathread";
	}

	console.log(post);
}