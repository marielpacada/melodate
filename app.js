global.fetch = require("node-fetch");
const querystring = require('querystring');
const express = require("express");
var request = require('request');
const app = express();

const { my_client_id } = require('./secrets/auth.js');
const { my_client_secret } = require('./secrets/auth.js');
const redirect_uri = "http://localhost:3000/callback";

app.set("view engine", "pug");
app.set("query parser", "extended");
app.use(express.static("public"));

// TIME FOR HEAVYLIFTING WOO
// get auth from spotify (watch the black guy's video, desktop 2 hehe)
// also watch angela's course to review how to use express

app.get('/login', function (req, res) {
    var scopes = 'user-top-read playlist-modify-public user-follow-modify';
    res.redirect('https://accounts.spotify.com/authorize' + '?response_type=code' +
        '&client_id=' + my_client_id + (scopes ? '&scope=' + encodeURIComponent(scopes) : '') +
        '&redirect_uri=' + encodeURIComponent(redirect_uri)) + "&state=state";
});

/* ---------------- NOW YOU HAVE USER AUTH, GET ALL THE DATA NEEDED!!! ---------------- */

app.get("/landing", function (req, res) {
    res.sendFile(__dirname + "/public/html/landing.html")
});

app.get('/callback', async function (req, res) {
    const auth_code = await req.query.code || null;
    var auth_options = {
        url: 'https://accounts.spotify.com/api/token',
        method: "POST",
        form: {
            code: auth_code,
            redirect_uri: redirect_uri,
            grant_type: 'authorization_code'
        },
        headers: {
            'Authorization': 'Basic ' + (new Buffer.from(my_client_id + ':' + my_client_secret).toString('base64'))
        },
        json: true
    };

    request.post(auth_options, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            const access_token = body.access_token;

            // getting user's top artists
            var top_artists_options = {
                url: 'https://api.spotify.com/v1/me/top/artists?limit=50&time_range=short_term',
                headers: { 'Authorization': 'Bearer ' + access_token },
                json: true
            };

            request.get(top_artists_options, async function (error, response, body) {
                var user_artists = body.items;

                var related_artists = {};
                for (artist in user_artists) {
                    var artist_id = user_artists[artist].id;
                    var url = "https://api.spotify.com/v1/artists/" + artist_id + "/related-artists";
                    var related_artists_options = {
                        method: "GET",
                        headers: { 'Authorization': 'Bearer ' + access_token },
                    };
            
                    const result = await fetch(url, related_artists_options);
                    const item = await result.json();
                    related_artists[artist] = item;
                }


                var initial_pool = [];
                for (artist in related_artists) {
                    for (const x of Array(20).keys()) {
                        if (!initial_pool.includes(related_artists[artist].artists[x].id) &&
                            related_artists[artist].artists[x].popularity < 70 &&
                            related_artists[artist].artists[x].popularity > 60) {
                            initial_pool.push(related_artists[artist].artists[x].id);
                        }
                    }
                }

                var artist_query = getRandomArtists(initial_pool);
                var artist_url = "https://api.spotify.com/v1/artists?ids=" + artist_query;
                var artist_options = {
                    method: "GET",
                    headers: { 'Authorization': 'Bearer ' + access_token },
                };
                const artist_pool = await fetch(artist_url, artist_options);
                const final_pool = JSON.parse(JSON.stringify(await artist_pool.json()));
                // console.log(final_pool.artists);
                // console.log(final_pool);
                getArtistInfo(final_pool.artists);



            });
            res.redirect("/landing");
        } else {
            res.redirect('/#' + querystring.stringify({ error: 'invalid_token' }));
        }
    });
});

// lessen the shit we have to render
// for each artist, we need image, name, followers, and genres
function getArtistInfo(data) {
    for (const x of Array(50).keys()) { 
       console.log(data[x].name);
    }
}

function getRandomArtists(arr) {
    var query = "";
    for (const x of Array(50).keys()) {
        var artistID = arr[Math.floor(Math.random() * arr.length)];
        query = query + artistID + "%2C";
    }
    return query.slice(0, query.length - 3);
}

app.listen(3000);