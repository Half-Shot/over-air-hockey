import request from 'superagent'
import prefix from 'superagent-prefix'

export class Backend {
    constructor(baseUrl) {
        this.prefix = prefix(baseUrl);
        this.baseUrl = baseUrl;
    }

    /**
     * Get the status of a session.
     * @param  {stiring} sessionId
     * @return {[type]}    [description]
     */
    async getSession(sessionId) {
        return (await request.get(`/session/${sessionId}`).use(this.prefix).set('accept', 'json')).body;
    }

    /**
     * Create a new session.
     * @return {Game}    [description]
     */
    async createSession() {
        return (await request.post("/session/create").use(this.prefix).send({})).body;
    }

    async getWebsocket(gameId) {
        const ws = new WebSocket(`${this.baseUrl.replace("http", "ws")}/ws`);
        ws.sendJson = (j, awaitResponse, addId) => {
            if (addId) {
                j.id = String(Math.ceil(Math.random()*Math.pow(10,16)));
            }
            ws.send(JSON.stringify(Object.assign(j, {gameId})));
            if (awaitResponse && j.id) {
                return new Promise((resolve) => {
                    let listener;
                    listener = (msg) => {
                        msg = JSON.parse(msg.data);
                        if (j.id === msg.id) {
                            ws.removeEventListener("message", listener);
                            resolve(msg);
                        }
                    }
                    ws.addEventListener("message", listener);
                });
            }
        };
        ws.addEventListener("message", (msg) => {
            ws.onJson ? ws.onJson(JSON.parse(msg.data)) : null;
        });
        return new Promise((resolve) => {
            ws.onopen = () => {
                console.log("Websocket is ready");
                ws.onopen = undefined;
                resolve(ws);
            };
        });
    }
}
