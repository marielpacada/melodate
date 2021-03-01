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
app.set("views", __dirname + "/html");
app.use(express.static("public"));

app.get('/login', function (req, res) {
    var scopes = 'user-top-read playlist-modify-public user-follow-modify';
    res.redirect('https://accounts.spotify.com/authorize' + '?response_type=code' +
        '&client_id=' + my_client_id + (scopes ? '&scope=' + encodeURIComponent(scopes) : '') +
        '&redirect_uri=' + encodeURIComponent(redirect_uri)) + "&state=state";
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

            var artist_info;
            request.get(top_artists_options, async function (error, response, body) {
                var user_artists = body.items;
                var related_artists = await getRelatedArtists(user_artists, access_token);
                var initial_pool = getInitialArtistPool(related_artists);
                var final_pool = await getFinalArtistPool(initial_pool, access_token);
                artist_info = JSON.parse(JSON.stringify(getArtistInfo(final_pool.artists)));
                console.log(artist_info);

            });

            // res.redirect("/landing");
            res.render("landing", { artists: artist_info });

        } else {
            res.redirect('/#' + querystring.stringify({ error: 'invalid_token' }));
        }
    });
});

// app.get("/landing", function (req, res) {
//     // console.log(artist_info); // WHY IS THIS EMPTY
//     res.render("landing", { artists: artist_info });

// })



async function getRelatedArtists(userData, token) {
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

function getInitialArtistPool(data) {
    var initial_pool = [];
    for (artist in data) {
        for (const x of Array(20).keys()) {
            var id = JSON.parse(JSON.stringify(data[artist].artists[x].id));

            if (!initial_pool.includes(id) &&
                data[artist].artists[x].popularity < 70 &&
                data[artist].artists[x].popularity > 60) {
                initial_pool.push(id);
            }
        }
    }
    return initial_pool;
}

async function getFinalArtistPool(initial, token) {
    var artist_query = getRandomArtists(initial);
    var artist_url = "https://api.spotify.com/v1/artists?ids=" + artist_query;
    var artist_options = {
        method: "GET",
        headers: { 'Authorization': 'Bearer ' + token },
    };

    const artist_pool = await fetch(artist_url, artist_options);
    const final_pool = JSON.parse(JSON.stringify(await artist_pool.json()));
    return final_pool;
}

// lessen the shit we have to render
// for each artist, we need image, name, followers, and genres
function getArtistInfo(data) {
    var artists = [];
    for (const x of Array(50).keys()) {
        var item = {};
        item["name"] = JSON.parse(JSON.stringify(data[x].name));
        item["image"] = JSON.parse(JSON.stringify(data[x].images[0].url));
        item["follow"] = JSON.parse(JSON.stringify(data[x].followers.total));
        item["genre"] = JSON.parse(JSON.stringify(data[x].genres));
        artists.push(item);
    }
    return artists;
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