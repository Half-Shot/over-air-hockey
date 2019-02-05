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
        return request.get(`/session/${sessionId}`).use(this.prefix);
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
        ws.sendJson = (j) => {
            ws.send(JSON.stringify(Object.assign(j, {gameId})));
        };
        ws.addEventListener("message", (msg) => {
            ws.onJson(JSON.parse(msg));
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
