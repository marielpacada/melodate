const express = require("express");
const app = express();

const { my_client_id } = require('./secrets/auth.js');
const redirect_uri = "http://localhost:3000/callback";

app.set("view engine", "pug");
app.use(express.static("public"));

app.get("/callback", function (req, res) { 
    res.sendFile(__dirname + "/public/pug/landing.html");
});


// TIME FOR HEAVYLIFTING WOO
// get auth from spotify (watch the black guy's video, desktop 2 hehe)
// also watch angela's course to review how to use express


app.get('/login', function (req, res) {
    var scopes = 'user-read-private user-read-email';
    res.redirect('https://accounts.spotify.com/authorize' +
        '?response_type=code' +
        '&client_id=' + my_client_id +
        (scopes ? '&scope=' + encodeURIComponent(scopes) : '') +
        '&redirect_uri=' + encodeURIComponent(redirect_uri));
});


// NOW YOU HAVE USER AUTH, GET ALL THE DATA NEEDED!!!


















app.listen(3000);