import fs from "fs";
import express from "express";
import Router from "express-promise-router";
import { createServer } from "vite";
import viteConfig from "./vite.config.js";
import { Server } from 'socket.io';

// Create router
const router = Router();

// Create vite front end dev server
const vite = await createServer({
    configFile: false,
    server: {
        middlewareMode: "html",
    },
    ...viteConfig,
});

// Main route serves the index HTML
router.get("/", async (req, res, next) => {
    let html = fs.readFileSync("index.html", "utf-8");
    html = await vite.transformIndexHtml(req.url, html);
    res.send(html);
});

// Use vite middleware so it rebuilds frontend
router.use(vite.middlewares);

// Everything else that's not index 404s
router.use("*", (req, res) => {
    res.status(404).send({ message: "Not Found" });
});

// Create express app and listen on port 4444
const app = express();
app.use(router);
const server = app.listen(process.env.PORT || 4444, () => {
    console.log(`Listening on port http://localhost:4444...`);
});

const ioServer = new Server(server);

let clients = {};

ioServer.on('connection', client => {
    console.log('User ' + client.id + ' connected');

    client.emit('introduction', client.id, ioServer.engine.clientsCount, Object.keys(clients));

    //Add a new client indexed by his id
    clients[client.id] = {
        position: [0, 0, 0],
        rotation: [0, 0, 0]
    };

    ioServer.sockets.emit('userConnected', ioServer.engine.clientsCount, client.id, Object.keys(clients));

    client.on('move', (payload) => {
        const { id, rotation, position } = payload;
        clients[id].position = position;
        clients[id].rotation = rotation;
    });

    client.on('disconnect', () => {

        //Delete this client from the object
        delete clients[client.id];

        ioServer.sockets.emit('userDisconnected', ioServer.engine.clientsCount, client.id, Object.keys(clients));

        console.log('User ' + client.id + ' dissconeted');

    });
});