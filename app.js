global.fetch = require("node-fetch");
const express = require("express");
const app = express();

const { my_client_id } = require('./secrets/auth.js');
const { my_client_secret } = require('./secrets/auth.js');
const my_client_id_64 = Buffer.from(my_client_id).toString('base64');
const my_client_secret_64 = Buffer.from(my_client_secret).toString('base64');
const redirect_uri = "http://localhost:3000/callback";

app.set("view engine", "pug");
app.set("query parser", "extended");
app.use(express.static("public"));

// TIME FOR HEAVYLIFTING WOO
// get auth from spotify (watch the black guy's video, desktop 2 hehe)
// also watch angela's course to review how to use express

app.get('/login', function (req, res) {
    console.log(my_client_id);
    console.log(my_client_secret);
    var scopes = 'user-top-read playlist-modify-public user-follow-modify';
    res.redirect('https://accounts.spotify.com/authorize' +
        '?response_type=code' +
        '&client_id=' + my_client_id +
        (scopes ? '&scope=' + encodeURIComponent(scopes) : '') +
        '&redirect_uri=' + encodeURIComponent(redirect_uri));
});

/* ---------------- NOW YOU HAVE USER AUTH, GET ALL THE DATA NEEDED!!! ---------------- */

// getting refresh token
app.get("/callback", function (req, res) {
    getTokens(req, res);
});

async function getTokens(request, response) {
    response.sendFile(__dirname + "/public/pug/landing.html");
    const auth_code = request.query.code;
    const url = "https://accounts.spotify.com/api/token";

    // your problem is here!!! you need to place all the body params in the url (like with ? and & you know)

    const req_params = {
        method: "POST",
        body: {
            grant_type: "authorization_code",
            code: auth_code,
            redirect_uri: redirect_uri
        },
        headers: {
            "Authorization": "Basic " + my_client_id_64 + ":" + my_client_secret_64
        }
    };
    const data = await fetch(url, req_params);

    console.log(data);
}










app.listen(3000);