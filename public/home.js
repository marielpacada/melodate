import { Cookies } from "/cookies.js";

$(function () {
    var like_names = [];
    var like_pics = [];
    var like_ids = [];
    var like_covers = [];
    var like_titles = [];
    var like_tracks = [];
    var animating = false;
    var cardsCounter = 0;
    var numOfCards = 6;
    var decisionVal = 80;
    var pullDeltaX = 0;
    var deg = 0;
    var $card, $cardReject, $cardLike;

    function pullChange() {
        animating = true;
        deg = pullDeltaX / 10;
        $card.css("transform", "translateX(" + pullDeltaX + "px) rotate(" + deg + "deg)");

        var opacity = pullDeltaX / 100;
        var rejectOpacity = (opacity >= 0) ? 0 : Math.abs(opacity);
        var likeOpacity = (opacity <= 0) ? 0 : opacity;
        $cardReject.css("opacity", rejectOpacity);
        $cardLike.css("opacity", likeOpacity);
    };

    function release() {
        if (pullDeltaX >= decisionVal) {
            $card.addClass("to-right");
            if ($card.attr("id") != "not-artist") {
                like_names.push($card.find(".artist-info").find(".artist-name").find(".card-title").text());
                like_pics.push($card.find(".artist-pic").find("img").attr("src"));
                like_ids.push($card.attr("id"));
                like_covers.push($card.find("#top-track").find(".track-info").find(".track-image").find("img").attr("src"));
                like_titles.push($card.find("#top-track").find(".track-info").find(".track-player").find("p").text());
                like_tracks.push($card.find("#top-track").find(".track-info").find(".track-player").attr("id"));
            }
        } else if (pullDeltaX <= -decisionVal) {
            $card.addClass("to-left");
        }

        if (Math.abs(pullDeltaX) >= decisionVal) {
            $card.addClass("inactive");

            setTimeout(function () {
                $card.addClass("done");
                cardsCounter++;
                if (cardsCounter === numOfCards) {
                    cardsCounter = 0;
                    $(".artist-card").removeClass("below");
                }
            }, 300);

            if ($card.attr("id") != "not-artist") {
                $card.find("#top-track").find(".track-info").find(".track-player").find("audio").trigger("pause");
            }
        }

        if (Math.abs(pullDeltaX) < decisionVal) {
            $card.addClass("reset");
        }

        setTimeout(function () {
            $card.attr("style", "").removeClass("reset")
                .find(".card-choice").attr("style", "");

            pullDeltaX = 0;
            animating = false;
        }, 300);
    };

    $(document).on("mousedown touchstart", ".artist-card:not(.inactive)", function (e) {
        if (animating) return;

        $card = $(this); // current card
        $cardReject = $(".card-choice.reject", $card);
        $cardLike = $(".card-choice.like", $card);
        var startX = e.pageX || e.originalEvent.touches[0].pageX;

        if ($card.hasClass("button-card")) return;

        $(document).on("mousemove touchmove", function (e) {
            var x = e.pageX || e.originalEvent.touches[0].pageX;
            pullDeltaX = (x - startX);
            if (!pullDeltaX) return;
            pullChange();
        });

        $(document).on("mouseup touchend", function () {
            $(document).off("mousemove touchmove mouseup touchend");
            if (!pullDeltaX) return; // prevents from rapid click events
            release();
            if ($card.hasClass("last-card")) {
                Cookies.set("names", like_names);
                Cookies.set("pics", like_pics);
                Cookies.set("ids", like_ids);
                Cookies.set("covers", like_covers);
                Cookies.set("titles", like_titles);
                Cookies.set("tracks", like_tracks);
            }
        });
    });
});
