# over-air-hockey

TODO: More helpful description

## Building

### Client

Building the clients is as easy as:

```shell
cd displayApp
npm i
```

**Before running**, edit `./displayApp/src/client.js` to include URLs for your webserver
which are probably "http://localhost".

```
backendUrl: "http://localhost:9000/api",
wsUrl: "http://localhost:3000/ws",
joinUrl: "http://localhost:9000/client.html",
```

Now you can start with `npm run dev`

### Backend

You will need to start this first before running the front-end. It's very simple:

```shell
cd backend
npm i
npm run start
```

If the games get screwed up, just restart the backend. It's currently stateless.
