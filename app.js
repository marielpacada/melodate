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
    res.redirect('https://accounts.spotify.com/authorize' +
        '?response_type=code' +
        '&client_id=' + my_client_id +
        (scopes ? '&scope=' + encodeURIComponent(scopes) : '') +
        '&redirect_uri=' + encodeURIComponent(redirect_uri)) +
        "&state=state";
});

/* ---------------- NOW YOU HAVE USER AUTH, GET ALL THE DATA NEEDED!!! ---------------- */

// getting refresh token
// app.get("/callback", function (req, res) {
//     getTokens(req, res);
// });

// async function getTokens(request, response) {
//     response.sendFile(__dirname + "/public/pug/landing.html");
//     const auth_code = request.query.code;
//     console.log(auth_code);
//     const url = "https://accounts.spotify.com/api/token";
//     const body = "?grant_type=authorization_code&code=" + auth_code + "&redirect_uri=" + encodeURIComponent(redirect_uri);

//     const req_params = {
//         method: "POST",
//         headers: {
//             "Authorization": "Basic " + my_client_id_64 + ":" + my_client_secret_64,
//             'Content-Type': 'application/x-www-form-urlencoded'
//         }
//         // body: {
//         //     "grant_type": "authorization_code",
//         //     "code": auth_code,
//         //     "redirect_uri": encodeURIComponent(redirect_uri)
//         // }


//     };
//     const data = await fetch(url + body, req_params);
//     console.log(data);
// }
app.get('/callback', function (req, res) {
    // res.sendFile(__dirname + "/public/pug/landing.html");

    // your application requests refresh and access tokens
    // after checking the state parameter

    var code = req.query.code || null;
    // var state = req.query.state || null;
    // var storedState = req.cookies ? req.cookies[stateKey] : null;

    // if (state === null || state !== storedState) {
    //     res.redirect('/#' +
    //         querystring.stringify({
    //             error: 'state_mismatch'
    //         }));
    // } else {
    // res.clearCookie(stateKey);

    var authOptions = {
        url: 'https://accounts.spotify.com/api/token',
        form: {
            code: code,
            redirect_uri: redirect_uri,
            grant_type: 'authorization_code'
        },
        headers: {
            'Authorization': 'Basic ' + (new Buffer.from(my_client_id + ':' + my_client_secret).toString('base64'))
        },
        json: true
    };

    request.post(authOptions, function (error, response, body) {
        if (!error && response.statusCode === 200) {

            // WE GET THE ACCESS TOKENS HERE!!! WOOOO!!!

            var access_token = body.access_token,
                refresh_token = body.refresh_token;

            var options = {
                url: 'https://api.spotify.com/v1/me',
                headers: { 'Authorization': 'Bearer ' + access_token },
                json: true
            };

            // getting profile
            request.get(options, function (error, response, body) {
                console.log("status code");
                console.log(response.statusCode);
            });

            // we can also pass the token to the browser to make requests from there
            res.redirect('/#' +
                querystring.stringify({
                    access_token: access_token,
                    refresh_token: refresh_token
                }));
        } else {
            res.redirect('/#' +
                querystring.stringify({
                    error: 'invalid_token'
                }));
        }
    });
});

app.listen(3000);