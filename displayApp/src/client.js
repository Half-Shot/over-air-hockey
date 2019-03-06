import {Backend} from './Backend'
import config from './config'
import Controller from './controller'

const backend = new Backend(config.backendUrl);
let ws;
let gameId =  window.location.hash.substr(1);
let sessionState = null;

window.preStart = async () => {
    console.log("Checking that the game exists..");
    while(!sessionState) {
        try {
            sessionState = await backend.getSession(gameId);
            console.log(sessionState);
        } catch (ex) {
            gameId = parseInt(prompt("Hmm, couldn't find that game. Try entering another?", "GameId"));
        }
    }

};

// Code for the client.html stuff
window.startClient = async (nick) => {
    if (nick.length < 1) {
        return;
    }
    const joinForm = document.querySelector("#joinForm");
    const lobbySection = document.querySelector("section#lobby");
    const loadingSection = document.querySelector("section#loading");
    const gameSection = document.querySelector("section#game");
    joinForm.hidden = true;
    loadingSection.hidden = false;
    console.log("Getting websocket");
    ws = await backend.getWebsocket(gameId);
    console.log("Sending join");
    const res = await ws.sendJson({
        type: "join",
        nick,
    }, true, true);
    if (res.type !== "ok") {
        console.error("Something went wrong:", res);
        return;
    }
    loadingSection.hidden = true;
    lobbySection.hidden = false;

    ws.onJson = (msg) => {
        if (msg.type === "start") {
            lobbySection.hidden = true;
            gameSection.hidden = false;
            // Start sending motion events.
            window._motionController = new Controller(
                (direction) => { // This fires whenever there is motion.
                    ws.sendJson({
                        type: "paddle",
                        direction,
                    }, false, true)
                }
            );
            window._motionController.startCapture();
        } else if (msg.type === "players") {
            const button = document.querySelector("button#startGame");
            button.disabled = !msg.canStart;
        } else if (msg.type === "puckUpdate" && msg.nick === nick) {
            window.navigator.vibrate(150);
            document.querySelector("audio").play();
        } else if (msg.type === "finished") {
            document.querySelector("section#finished").hidden = false;
            document.querySelector("section#game").hidden = true;
        }
    }
}

window.readyUp = async () => {
    console.log("Sending ready");
    const res = await ws.sendJson({type: "ready"}, true, true);
    if (res.type !== "ok") {
        console.error("Something went wrong:", res);
        return;
    }
    const button = document.querySelector("button#readyup");
    button.disabled = true;
    button.innerHTML = "Ready";
}

window.startGame = async () => {
    const lobbySection = document.querySelector("section#lobby");
    const gameSection = document.querySelector("section#game");
    console.log("Sending start");
    const res = await ws.sendJson({
        type: "start",
    }, true, true);
    if (res.type !== "ok") {
        console.error("Something went wrong:", res);
        return;
    }
    gameSection.hidden = false;
    lobbySection.hidden = true;

}

window.rematch = async () => {
    const lobbySection = document.querySelector("section#lobby");
    const finishedSection = document.querySelector("section#finished");
    const res = await ws.sendJson({
        type: "rematch",
    }, true, true);
    if (res.type !== "ok") {
        console.error("Something went wrong:", res);
        return;
    }
    lobbySection.hidden = false;
    finishedSection.hidden = true;
}