/* Loading modules */
global.fetch = require("node-fetch");
const querystring = require('querystring');
const cookieParser = require("cookie-parser");
const express = require("express");
const request = require('request');
const app = express();

/* Importing authorization IDs */
const { my_client_id } = require('./secrets/auth.js');
const { my_client_secret } = require('./secrets/auth.js');
const { Cookies } = require('./public/cookies.js');
const redirect_uri = "http://localhost:3000/home";

/* Registering middleware and settings */
app.use(express.static(__dirname + "/public"));
app.use(cookieParser());
app.set("view engine", "pug");
app.set("query parser", "extended");
app.set("views", __dirname + "/html");

/**
 * Login page. 
 * Redirects user to Spotify authorization page, then redirects back to web app after logging in with Spotify account.
 */
app.get("/", function (req, res) {
    res.sendFile(__dirname + "/public/index.html");
});

app.get('/login', function (req, res) {
    var scopes = 'user-top-read playlist-modify-public user-follow-modify';
    res.redirect('https://accounts.spotify.com/authorize' + '?response_type=code' +
        '&client_id=' + my_client_id + (scopes ? '&scope=' + encodeURIComponent(scopes) : '') +
        '&redirect_uri=' + encodeURIComponent(redirect_uri)) + "&state=state";
});

/**
 * Home page.
 * Handles all API requests for information on user profile (name, image, follower count, genre list, and id).
 */
app.get('/home', async function (req, res) {
    // Gathering token via POST request to Spotify
    const auth_code = await req.query.code || null;
    var auth_options = {
        url: 'https://accounts.spotify.com/api/token',
        method: "POST",
        json: true,
        headers: { 'Authorization': 'Basic ' + (new Buffer.from(my_client_id + ':' + my_client_secret).toString('base64')) },
        form: {
            code: auth_code,
            redirect_uri: redirect_uri,
            grant_type: 'authorization_code'
        }
    };

    // Using access token (from previous POST request) to gather all artist profile data
    request.post(auth_options, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            const access_token = body.access_token;
            var top_artists_options = {
                url: 'https://api.spotify.com/v1/me/top/artists?limit=50&time_range=short_term',
                headers: { 'Authorization': 'Bearer ' + access_token },
                json: true
            };

            // Getting all information needed for home (swiping) page
            getAllArtistInfo(top_artists_options, access_token, async function (artistRes) {
                var artist_info = await JSON.parse(JSON.stringify(artistRes));
                // Sends artist info as a header (to be iterated in pug file)
                res.render("landing", { artists: artist_info });
            });
        } else { // Redirects on error
            res.redirect('/#' + querystring.stringify({ error: 'invalid_token' }));
        }
    });
});


// TODO:

app.get("/profile", function (req, res) {
    var names = req.cookies.names;
    var pics = req.cookies.pics;
    var ids = req.cookies.ids;
    var artists = cookieHandler(names, pics, ids);
    res.render("profile", { likes: artists });
});







/* Listening on PORT 3000 */
app.listen(3000);

/**
 * Helper function (with inner private functions) to get all artists' information
 * @param {*} options object containing GET request parameters
 * @param {*} token access token for API calls
 * @param {*} callback function to access response data
 */
function getAllArtistInfo(options, token, callback) {

    /* Inner private functions _______________________________________________________________________________ */

    /**
     * Sends GET request to Spotify for related artists of _each_ artist
     * @param {*} userData user's top artists in the last four weeks (short-term)
     * @param {*} token access token for API calls
     * @returns map of user's top artist's index to that artist's related artists
     * -- Example: { '0' : [array of artist objects], '1' : [array of artist objects], ... } 
     */
    async function _getRelatedArtists(userData, token) {
        var related_artists = {};
        for (artist in userData) {
            var artist_id = userData[artist].id;
            var url = "https://api.spotify.com/v1/artists/" + artist_id + "/related-artists";
            var related_artists_options = {
                method: "GET",
                headers: { 'Authorization': 'Bearer ' + token },
            };

            const result = await fetch(url, related_artists_options);
            const item = JSON.parse(JSON.stringify(await result.json()));
            related_artists[JSON.parse(JSON.stringify(artist))] = item;
        }
        return related_artists;
    }

    /**
     * Narrows down list of related artists based on popularity criteria
     * @param {*} data the related artist map from previous function
     * @returns array of Spotify Artist objects
     */
    async function _getInitialArtistPool(data) {
        var initial_pool = [];
        for (artist in data) {
            for (const x of Array(20).keys()) { // Each artist has 20 related artists
                var id = JSON.parse(JSON.stringify(data[artist].artists[x].id));
                // Avoids duplicates (artist overlap)
                if (initial_pool.indexOf(id) === -1) {
                    initial_pool.push(id);
                }
            }
        }
        return initial_pool;
    }

    /**
     * Chooses 50 artists and produces a query parameter from their artist ids
     * @param {*} arr array of artists
     * @returns string to be passed as a query paramter to an API call
     */
    function _getRandomArtists(arr) {
        var query = "";
        for (const x of Array(50).keys()) {
            var artistID = arr[Math.floor(Math.random() * arr.length)];
            query = query + artistID + "%2C"; // Comma in URI
        }
        return query.slice(0, query.length - 3);
    }

    /**
     * Chooses 50 artists from initial pool and sends GET request to Spotify for their artist info
     * @param {*} initial array of artists from initial pool
     * @param {*} token access token for API call
     * @returns object in JSON format containing artists and their info
     */
    async function _getFinalArtistPool(initial, token) {
        // Gets multiple artists with this specific GET request (max 50 artists)
        var artist_query = _getRandomArtists(initial);
        var artist_url = "https://api.spotify.com/v1/artists?ids=" + artist_query;
        var artist_options = {
            method: "GET",
            headers: { 'Authorization': 'Bearer ' + token },
        };

        const artist_pool = await fetch(artist_url, artist_options);
        const final_pool = JSON.parse(JSON.stringify(await artist_pool.json()));
        return final_pool;
    }

    /**
     * Gets relevant data from artist's first listed top track
     * @param {*} id artist id
     * @param {*} token access token for API call
     * @returns object in JSON format containing relevant track info
     */
    async function _getTopTrack(id, token) {
        var url = "https://api.spotify.com/v1/artists/" + id + "/top-tracks?market=US";
        var track_options = {
            method: "GET",
            headers: { 'Authorization': 'Bearer ' + token },
        }
        const result = await fetch(url, track_options);
        const data = JSON.parse(JSON.stringify(await result.json()));

        var raw_track = data.tracks[0];
        var track_attrs = {};
        track_attrs["cover"] = raw_track.album.images[0].url; // album cover
        track_attrs["title"] = raw_track.name.slice(0, 75);
        track_attrs["preview"] = raw_track.preview_url; // mp3 url

        return track_attrs;
    }

    /**
     * Iterates through artists and parses out necessary information
     * @param {*} data final array of 50 artists to be swiped on
     * @returns array of artists mapped to their info that the program needs
     */
    async function _getEachArtistInfo(data, token) {
        var artists = [];
        for (const x of Array(50).keys()) {
            var item = {};
            item["name"] = JSON.parse(JSON.stringify(data[x].name));
            item["image"] = JSON.parse(JSON.stringify(data[x].images[0].url));
            item["follow"] = numberWithCommas(JSON.parse(JSON.stringify(data[x].followers.total)));
            item["genre"] = genreHandler(JSON.parse(JSON.stringify(data[x].genres)));
            item["id"] = JSON.parse(JSON.stringify(data[x].id));
            item["track"] = await _getTopTrack(item["id"], token);
            artists.push(item);
        }
        return artists;
    }

    /* _______________________________________________________________________________________________________ */

    /* Returns callback function in order to access final artist array in "/home" GET request */
    request.get(options, async function (error, response, body) {
        var user_artists = body.items;
        var related_artists = await _getRelatedArtists(user_artists, token);
        var initial_pool = await _getInitialArtistPool(related_artists);
        var final_pool = await _getFinalArtistPool(initial_pool, token);
        var info = JSON.parse(JSON.stringify(await _getEachArtistInfo(final_pool.artists, token)));
        return callback(info);
    });
}

/**
 * Styles integer with commas per decimal notations
 * @param {*} x integer in primitive form
 */
function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Limits genres to be showed on card to 3, styles list with commas
 * @param {*} arr array of artist genres
 * @returns string that contains artist genres
 */
function genreHandler(arr) {
    arrStr = "";
    if (arr.length === 0) {
        return "no listed genres :(";
    }
    for (const i of Array(3).keys()) {
        // Ensures genres will only take up one paragraph line
        if (arr.length > i && (arrStr.length + arr[i].toString().length) < 44) {
            arrStr = arrStr + arr[i].toString() + ", ";
        }
    }
    return arrStr.slice(0, arrStr.length - 2);
}

function cookieHandler(names, pics, ids) {
    var nameArr = names.split(",");
    var picArr = pics.split(",");
    var idArr = ids.split(",");
    var artists = [];
    for (const i of Array(nameArr.length).keys()) {
        var inner = {};
        inner["pic"] = picArr[i].toString();
        inner["id"] = idArr[i].toString();
        inner["name"] = nameArr[i].toString();
        artists.push(inner);
    }
    return artists;
}