/* Loading modules */
global.fetch = require("node-fetch");
const querystring = require('querystring');
const express = require("express");
const cookieparser = require("cookie-parser");
const request = require('request');
const app = express();

/* Importing authorization IDs */
const { my_client_id } = require('./secrets/auth.js');
const { my_client_secret } = require('./secrets/auth.js');
const redirect_uri = "http://localhost:3000/home";

/* Registering middleware and settings */
app.use(cookieparser());
app.use(express.static("public"));
app.set("view engine", "pug");
app.set("query parser", "extended");
app.set("views", __dirname + "/html");

/**
 * Login page. 
 * Redirects user to Spotify authorization page, then redirects back to web app after logging in with Spotify account.
 */
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
            getAllArtistInfo(top_artists_options, access_token, function (artistRes) {
                var artist_info = JSON.parse(JSON.stringify(artistRes));
                // Sends artist info as a header (to be iterated in pug file)
                res.render("landing", { artists: artist_info });
            });
        } else { // Redirects on error
            res.redirect('/#' + querystring.stringify({ error: 'invalid_token' }));
        }
    });
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
     * Returns map of user's top artist's index to that artist's related artists
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
     * Returns array of Spotify Artist objects
     */
    function _getInitialArtistPool(data) {
        var initial_pool = [];
        for (artist in data) {
            for (const x of Array(20).keys()) { // Each artist has 20 related artists
                var id = JSON.parse(JSON.stringify(data[artist].artists[x].id));
                // Avoids duplicates (artist overlap) and filters through artists who are fairly popular
                if (!initial_pool.includes(id) &&
                    data[artist].artists[x].popularity < 70 &&
                    data[artist].artists[x].popularity > 60) {
                    initial_pool.push(id);
                }
            }
        }
        return initial_pool;
    }

    /**
     * Chooses 50 artists and produces a query parameter from their artist ids
     * @param {*} arr array of artists
     * Returns string to be passed as a query paramter to an API call
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
     * Returns object in JSON format containing artists and their info
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
     * Iterates through artists and parses out necessary information
     * @param {*} data final array of 50 artists to be swiped on
     * Returns array of artists mapped to their info that the program needs
     */
    async function _getEachArtistInfo(data) {
        var artists = [];
        for (const x of Array(50).keys()) {
            var item = {};
            item["name"] = JSON.parse(JSON.stringify(data[x].name));
            item["image"] = JSON.parse(JSON.stringify(data[x].images[0].url));
            item["follow"] = JSON.parse(JSON.stringify(data[x].followers.total));
            item["genre"] = JSON.parse(JSON.stringify(data[x].genres));
            item["id"] = JSON.parse(JSON.stringify(data[x].id));
            artists.push(item);
        }
        return artists;
    }

    /* _______________________________________________________________________________________________________ */

    /* Returns callback function in order to access final artist array in "/home" GET request */
    request.get(options, async function (error, response, body) {
        var user_artists = body.items;
        var related_artists = await _getRelatedArtists(user_artists, token);
        var initial_pool = _getInitialArtistPool(related_artists);
        var final_pool = await _getFinalArtistPool(initial_pool, token);
        var info = JSON.parse(JSON.stringify(await _getEachArtistInfo(final_pool.artists)));
        return callback(info);
    });
}
