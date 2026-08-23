const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const pcSessions = new Map();

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('request_new_session', async () => {
        const sessionId = uuidv4();
        pcSessions.set(sessionId, socket.id);
        socket.sessionId = sessionId;

        const phoneUrl = `https://${socket.handshake.headers.host}/phone.html?session=${sessionId}`;
        
        QRCode.toDataURL(phoneUrl, (err, qrCodeData) => {
            if (err) {
                console.error("Error generating QR", err);
                return;
            }
            socket.emit('session_created', { sessionId, qrCode: qrCodeData });
        });
    });

    socket.on('register_pc', (data) => {
        const { sessionId } = data;
        pcSessions.set(sessionId, socket.id);
        socket.sessionId = sessionId;
        console.log(`PC re-registered with session: ${sessionId}`);
    });

    socket.on('motion_detected', (data) => {
        const { sessionId, action } = data;
        const pcSocketId = pcSessions.get(sessionId);

        if (pcSocketId) {
            console.log(`Motion detected! Sending action to PC for session: ${sessionId}`);
            io.to(pcSocketId).emit('execute_action', { action: 'shutdown' }); // Default or dynamic action
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});