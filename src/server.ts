const fs = require("fs");
import http, {IncomingMessage, ServerResponse} from "http";
const nstatic = require('node-static');

const host = "0.0.0.0";
const port = 80;

let state: any = null;

const file = new(nstatic.Server)(__dirname + "/../dist");

const requestListener = function (req: IncomingMessage, res: ServerResponse) {

    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
        'Access-Control-Max-Age': 2592000, // 30 days
    };

    if (req.method === 'OPTIONS') {
        console.log(`OPTOINS requested: ${req.url}`);
        res.writeHead(204, headers);
        res.end();
        return;
    }

    switch(req.url){
        case "/load":
            res.setHeader("Content-Type", "application/json");
            console.log(`load received: ${req.method}`);
            if(state === null){
                res.writeHead(400, headers);
                res.end();
            }
            else{
                res.writeHead(200, headers);
                res.end(JSON.stringify(state));
            }
            break;
        case "/save":
            res.setHeader("Content-Type", "application/json");
            console.log(`save received: ${req.method} readable: ${req.readable}`);
            if(req.method === "POST"){
                const chunks: Buffer[] = [];
                req.on("data", (chunk) => {
                    try{
                        console.log(`saving: ${chunk}`);
                        chunks.push(Buffer.from(chunk));
                    }
                    catch(e){
                        console.log(`error: ${e}`);
                        res.writeHead(500, headers);
                        res.end('{result: "error"}');
                    }
                });
                req.on("end", () => {
                    state = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                    res.writeHead(200, headers);
                    res.end('{result: "ok"}');
                });
            }
            break;
        default:
            file.serve(req, res);
    }
};

const server = http.createServer(requestListener);
server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
});