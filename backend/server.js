const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

// Раздача статики
app.use(express.static(path.join(__dirname, 'frontend')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let clients = [];

wss.on('connection', (ws) => {
  // По умолчанию инструмент null, но user уже онлайн
  ws.instrument = null;
  clients.push(ws);
  broadcastClients();

  ws.on('message', (msg) => {
    let data;
    try { data = JSON.parse(msg); } catch (e) { return; }

    // Регистрация инструмента или его смена
    if (data.type === 'register') {
      ws.instrument = data.instrument;
      broadcastClients();
    }
  });

  ws.on('close', () => {
    clients = clients.filter(client => client !== ws);
    broadcastClients();
  });
});

// Рассылка списка онлайн всем клиентам
function broadcastClients() {
  const users = clients.map(ws => ({
    instrument: ws.instrument
  }));
  const msg = JSON.stringify({ type: 'clients', users });
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
