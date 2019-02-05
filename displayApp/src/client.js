import {Backend} from './Backend'
import config from './config'

let backend;
let ws;

// Code for the client.html stuff
window.startClient = async (nick) => {
    const joinForm = document.querySelector("#joinForm");
    const lobbySection = document.querySelector("section#lobby");
    const loadingSection = document.querySelector("section#loading");
    const gameSection = document.querySelector("section#game");
    joinForm.hidden = true;
    loadingSection.hidden = false;
    const gameId = window.location.hash.substr(1);
    backend = new Backend(config.backendUrl);
    ws = await backend.getWebsocket(gameId);
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
        }
    }
}

window.readyUp = async () => {
    const res = await ws.sendJson({type: "ready"}, true, true);
    if (res.type !== "ok") {
        console.error("Something went wrong:", res);
        return;
    }
    const button = document.querySelector("button#readyup");
    button.disabled = true;
    button.innerHTML = "Ready";
}
