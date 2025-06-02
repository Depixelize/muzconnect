const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

// Путь к папке frontend (от backend/server.js)
const frontendPath = path.join(__dirname, '..', 'frontend');

// Раздача статики
app.use(express.static(frontendPath));

// Явная обработка /
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Создаем HTTP сервер
const server = http.createServer(app);

// WebSocket сервер
const wss = new WebSocket.Server({ server });

// Массив всех подключённых клиентов
let clients = [];

// При подключении нового клиента
wss.on('connection', (ws) => {
  ws.instrument = null; // по умолчанию инструмент не выбран
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

// Функция рассылки списка всех подключённых пользователей
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
