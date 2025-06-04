const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const { randomUUID } = require('crypto');

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
  ws.id = randomUUID(); // уникальный id для каждого клиента
  ws.instrument = null;
  ws.avatar = null;
  ws.peer = null;
  clients.push(ws);
  console.log(`[${new Date().toLocaleTimeString()}] Новый клиент: ${ws.id}. Всего: ${clients.length}`);
  broadcastClients();

  ws.on('message', (msg) => {
    let data;
    try { data = JSON.parse(msg); } catch (e) { return; }

    // Регистрация инструмента или его смена
    if (data.type === 'register') {
      ws.instrument = data.instrument;
      broadcastClients();
      console.log(`[${new Date().toLocaleTimeString()}] ${ws.id} выбрал инструмент: ${ws.instrument}`);
    }

    // Получение аватара (миниатюры) от клиента
    if (data.type === 'avatar') {
      ws.avatar = data.image;
      broadcastClients();
      console.log(`[${new Date().toLocaleTimeString()}] ${ws.id} отправил аватар`);
    }

    // Запрос на соединение с другим пользователем
    if (data.type === 'connect') {
      // Сброс предыдущей peer-связи
      if (ws.peer && ws.peer.peer === ws) {
        ws.peer.peer = null;
      }
      ws.peer = null;

      let target = clients.find(c => c.id === data.targetId);
      if (target && target.readyState === WebSocket.OPEN && target !== ws) {
        ws.peer = target;
        target.peer = ws;
        ws.send(JSON.stringify({ type: 'status', message: 'Подключено к пользователю', peerId: target.id }));
        target.send(JSON.stringify({ type: 'status', message: 'К вам подключились', peerId: ws.id }));
        console.log(`[${new Date().toLocaleTimeString()}] ${ws.id} подключился к ${target.id}`);
      }
    }

    // WebRTC сигналинг между выбранными пользователями
    if (data.type === 'signal' && ws.peer && ws.peer.readyState === WebSocket.OPEN) {
      ws.peer.send(JSON.stringify({ type: 'signal', from: ws.id, signal: data.signal }));
      if (data.signal.type) {
        console.log(`[${new Date().toLocaleTimeString()}] Сигнал ${data.signal.type} от ${ws.id} к ${ws.peer.id}`);
      }
    }
  });

  ws.on('close', () => {
    // Отключаем peer-связь, если была
    if (ws.peer && ws.peer.readyState === WebSocket.OPEN) {
      ws.peer.peer = null;
      ws.peer.send(JSON.stringify({ type: 'status', message: 'Пользователь отключился', peerId: null }));
      console.log(`[${new Date().toLocaleTimeString()}] ${ws.id} отключился от ${ws.peer.id}`);
    }
    clients = clients.filter(client => client !== ws);
    broadcastClients();
    console.log(`[${new Date().toLocaleTimeString()}] Клиент отключён: ${ws.id}. Осталось: ${clients.length}`);
  });
});

// Функция рассылки списка всех подключённых пользователей
function broadcastClients() {
  const users = clients.map(ws => ({
    id: ws.id,
    instrument: ws.instrument,
    avatar: ws.avatar
  }));
  const msg = JSON.stringify({ type: 'clients', users });
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
