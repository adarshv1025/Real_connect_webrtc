import express from "express";
import { createServer } from "https"; // Use HTTPS
import { Server } from "socket.io";
import fs from "fs";  
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import os from "os";

const app = express();

// Load SSL certificate
const options = {
    key: fs.readFileSync("server.key"),   // Read private key
    cert: fs.readFileSync("server.cert") // Read public certificate
};

// Create an HTTPS server
const server = createServer(options, app);
const io = new Server(server, { 
    cors: { origin: "*" }  // Allow cross-origin requests (CORS)
});
const allusers = {};

const __dirname = dirname(fileURLToPath(import.meta.url));

// Expose public directory
app.use(express.static("public"));

app.get("/", (req, res) => {
    res.sendFile(join(__dirname, "/app/index.html"));
});

io.on("connection", (socket) => {
    console.log(`✅ User connected: ${socket.id}`);

    socket.on("join-user", username => {
        allusers[username] = { username, id: socket.id };
        io.emit("joined", allusers);
    });

    socket.on("offer", ({ from, to, offer }) => {
        if (to in allusers) {
            io.to(allusers[to].id).emit("offer", { from, to, offer });
        }
    });

    socket.on("answer", ({ from, to, answer }) => {
        if (from in allusers) {
            io.to(allusers[from].id).emit("answer", { from, to, answer });
        }
    });

    socket.on("icecandidate", ({ to, candidate }) => {
        if (to in allusers) {
            io.to(allusers[to].id).emit("icecandidate", candidate);
        }
    });

    socket.on("end-call", ({ from, to }) => {
        if (to in allusers) {
            io.to(allusers[to].id).emit("end-call", { from, to });
        }
    });

    socket.on("call-ended", caller => {
        const [from, to] = caller;
        if (from in allusers && to in allusers) {
            io.to(allusers[from].id).emit("call-ended", caller);
            io.to(allusers[to].id).emit("call-ended", caller);
        }
    });

    socket.on("disconnect", () => {
        const user = Object.keys(allusers).find(username => allusers[username].id === socket.id);
        if (user) {
            delete allusers[user];
            io.emit("joined", allusers);
        }
    });
});

// Get network IP address
const getNetworkIP = () => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
};

// Start the server with HTTPS
const port = 9000;
server.listen(port, '0.0.0.0', () => {
    const networkIP = getNetworkIP();
    console.log('🚀 Server running on:');
    console.log(`➡️  Local:  https://localhost:${port}`);
    console.log(`➡️  Network: https://${networkIP}:${port}`);
});
