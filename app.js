/* Import modules */
var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var settings = require('./settings.js');

/* Import Data */
var latest;
fs.readFile(__dirname + '/data.json', 'utf8', function(err, data) {
	if (err) {

		throw err;
	}

	latest = JSON.parse(data);
});

function writeData(data) {

	fs.writeFile(__dirname + '/data.json', JSON.stringify(data, null, 4), function(err) {

		if (err) {

			throw err;
		}
	});
}

/* Declare globals */
var postedToday = false;
var beatportURL = "http://www.beatport.com/label/monstercat/23412";	// These are the links we're going to crawl/request
var soundcloudURL = "https://api.soundcloud.com/users/8553751/tracks.json?client_id=" + settings.scApiKey;
var youtubeURL = "https://www.googleapis.com/youtube/v3/playlistItems?playlistId=UUJ6td3C9QlPO9O_J5dF4ZzA&key=" + settings.ytApiKey + "&part=snippet&maxResults=1";
var bpData, bcData, scData, ytData, modhash, cookie, currentThread, postSubmittable, postSubmitted = false;
var post = {	// Build post data

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
		artwork: "",
		artworkSource: ""
	}
}
var userAgent = 'monstercat-bot/0.1.0 by 3vans'	// Maybe change this to your bot's name if you reuse code

function update() {

	var date = new Date();

	if (date.getUTCDay == 1 || date.getUTCDay == 3 || date.getUTCDay == 5) {	// Is it a day in which we should be posting on?

		if (date.getHours() == 0) {	// Is it time to post?

			bpData, bcData, scData, ytData, modhash, cookie, postSubmitted, currentThread = false;	// Clear variables
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
					artwork: "",
					artworkSource: ""
				}
			}
		}
	}

	updateSources();
}

function updateSources() {

	if (!cookie || !modhash) {

		redditLogin();
	}

	if (!post.links.beatport) {

		request(beatportURL, beatport);
	}

	if (!post.links.soundcloud) {

		request(soundcloudURL, soundcloud);
	}

	if (!post.links.youtube || !post.links.bandcamp) {

		request(youtubeURL, youtube);
	}

	if (post.links.artworkSource != 'bandcamp' && post.links.bandcamp) {

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
			
			if (bpData.link != latest.beatport) {

				addToPost(bpData);

				latest.beatport = bpData.link;
				writeData(latest);

				console.log("BTPRT: RECIEVED RESPONSE");
			}
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

		if (bcData.artwork != latest.bandcamp) {

			addToPost(bcData);

			latest.bandcamp = bcData.artwork;
			writeData(latest);

			console.log("BNCMP: RECIEVED RESPONSE");
		}

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

		if (scData.link != latest.soundcloud) {

			addToPost(scData);

			latest.soundcloud = scData.link;
			writeData(latest);

			console.log("SNCLD: RECIEVED RESPONSE");
		}
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

		if (ytData.link != latest.youtube) {

			addToPost(ytData);

			latest.youtube = ytData.link;
			writeData(latest);

			console.log("YOUTB: RECIEVED RESPONSE");
		}
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
		post.links.artworkSource = data.type;
	} else if (post.links.artwork && data.artwork) {

		if (data.type == 'bandcamp') {

			post.links.artwork = data.artwork;
			post.links.artworkSource = data.type;
		}

		if (data.type != 'soundcloud' && post.links.artworkSource != 'bandcamp') {

			post.links.artwork = data.artwork;
			post.links.artworkSource = data.type;
		}
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

		if (data.spLink != "Coming Soon") {

			post.links.spotify = data.spLink;
		}
	}

	if (post.trackTitle && post.artist) {

		post.title = post.artist + " - " + post.trackTitle + " Megathread";
	}

	updatePost();
}

function redditLogin() {

	var options = {

		url: 'https://ssl.reddit.com/api/login?api_type=json&user=' + settings.username + '&passwd=' + settings.password + '&rem=True',
		headers: {
			'User-Agent': userAgent,
		},
		method: 'POST'
	};

	request(options, function(err, res, body) {

		body = JSON.parse(body).json.data;

		modhash = body.modhash;
		cookie = 'reddit_session=' + encodeURIComponent(body.cookie);
	});
}

function updatePost() {

	if (!modhash || !cookie) {

		redditLogin();
	}

	if (modhash && cookie && post.title) {

		var compiledPost = "";

		if (post.links.youtube) {
			compiledPost += "[Watch on YouTube](" + post.links.youtube + ")\n\n";
		}

		if (post.links.beatport) {

			compiledPost += "[Support on Beatport](" + post.links.beatport + ")\n\n";
		}

		if (post.links.bandcamp) {

			compiledPost += "[Support on Bandcamp](" + post.links.bandcamp + ")\n\n";
		}

		if (post.links.itunes) {

			compiledPost += "[Support on iTunes](" + post.links.itunes + ")\n\n";
		}

		if (post.links.soundcloud) {

			compiledPost += "[Stream on SoundCloud](" + post.links.soundcloud + ")\n\n";
		}

		if (post.links.spotify) {

			compiledPost += "[Stream on Spotify](" + post.links.spotify + ")\n\n";
		}

		if (post.links.artwork) {

			compiledPost += "[Download the album art](" + post.links.artwork + ")\n\n";
		}
		compiledPost += "___"
		+ "\n\n"
		+ "All discussion about this release goes below. Please post hype about the next release in the Next Release thread. I do not recieve karma for this post."
		+ "\n\n"
		+ "*This is an automated post by a bot. If I did something wrong please message me.*";

		var options;
		if (!postSubmitted) {

			options = {

				url: "http://www.reddit.com/api/submit?"
					+ "api_type=json"
					+ "&kind=self"
					+ "&sendreplies=false"
					+ "&sr=Monstercat"
					+ "&title=" + encodeURIComponent(post.title)
					+ "&text=" + encodeURIComponent(compiledPost),
				headers: {

					"User-Agent": userAgent,
					"X-Modhash": modhash,
					"Cookie": cookie
				},
				method: "POST"
			};
		} else {

			options = {

				url: "http://www.reddit.com/api/editusertext?"
					+ "api_type=json"
					+ "&thing_id=" + currentThread
					+ "&text=" + encodeURIComponent(compiledPost),
				headers: {

					"User-Agent": userAgent,
					"X-Modhash": modhash,
					"Cookie": cookie
				},
				method: "POST"
			}
		}

		request(options, function(err, res, body) {

			if (!err && res.statusCode == 200) {

				if (!JSON.parse(body).json.data) {

					console.log(body);
				} else if (!postSubmitted) {

					currentThread = JSON.parse(body).json.data.name;
					postSubmitted = true;
					postedToday = true;
					console.log('ENGIN: Post completed successfully at', currentThread);

					options = {

						url: "http://www.reddit.com/api/distinguish?"
							+ "api_type=json"
							+ "&how=yes"
							+ "&id=" + currentThread,
						headers: {

							"User-Agent": userAgent,
							"X-Modhash": modhash,
							"Cookie": cookie
						},
						method: "POST"
					};

					request(options, distinguishThread);

					options = {

						url: "http://www.reddit.com/api/set_subreddit_sticky?"
							+ "api_type=json"
							+ "&id=" + currentThread
							+ "&state=true",
						headers: {

							"User-Agent": userAgent,
							"X-Modhash": modhash,
							"Cookie": cookie
						},
						method: "POST"
					};

					request(options, stickyThread);
				} else {

					console.log('ENGIN: Edit completed successfully');
				}
			} else if (err) {

				throw err;
			} else {

				console.log('RDDIT: ' + res.statusCode + ' - ' + res.body);
			}
		});
	}
}

function distinguishThread(err, res, body) {

	if (!err && res.statusCode == 200) {

		console.log('RDDIT: Distinguished thread successfully');
	} else if (err) {

		throw err;
	} else {

		console.log('RDDIT: ' + res.statusCode + ' - ' + res.body);
	}
}

function stickyThread(err, res, body) {

	if (!err && res.statusCode == 200) {

		console.log('RDDIT: Stickied thread successfully');
	} else if (err) {

		throw err;
	} else {

		console.log('RDDIT: ' + res.statusCode + ' - ' + res.body);
	}
}

update();
setInterval(update, 300000);