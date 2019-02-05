import {Backend} from './Backend'
import config from './config'

let backend;
let ws;

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
    const gameId = window.location.hash.substr(1);
    backend = new Backend(config.backendUrl);
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
        } else if (msg.type === "players") {
            const button = document.querySelector("button#startGame");
            button.disabled = !msg.canStart;
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
