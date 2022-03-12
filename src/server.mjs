import http from "http";

const host = "localhost";
const port = 8000;

const books = JSON.stringify([
    { title: "The Alchemist", author: "Paulo Coelho", year: 1988 },
    { title: "The Prophet", author: "Kahlil Gibran", year: 1923 }
]);

const authors = JSON.stringify([
    { name: "Paulo Coelho", countryOfBirth: "Brazil", yearOfBirth: 1947 },
    { name: "Kahlil Gibran", countryOfBirth: "Lebanon", yearOfBirth: 1883 }
]);

let state = {};


const requestListener = function (req, res) {

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
    
    res.setHeader("Content-Type", "application/json");
    switch(req.url){
        case "/load":
            console.log(`load received: ${req.method}`);
            res.writeHead(200, headers);
            res.end(JSON.stringify(state));
            break;
        case "/save":
            console.log(`save received: ${req.method} readable: ${req.readable}`);
            if(req.method === "POST"){
                req.on("data", (chunk) => {
                    console.log(`saving: ${chunk}`);
                    state = JSON.parse(chunk);
                });
                res.writeHead(200, headers);
                res.end(JSON.stringify(state));
            }
            break;
        default:
            res.end(`{"count": ${state}}`);
    }
};

const server = http.createServer(requestListener);
server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
});