const express = require('express');
const app = express();
const wsApp = require('express-ws')(app);   
const port = 3000;

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.ws('/ws', function(ws, req) {
    console.log(req);
    ws.on('message', function(msg) {
        console.log(msg);
        const data = JSON.parse(msg);
        console.log(data.x, data.y);
        ws.send(msg);
    });
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
