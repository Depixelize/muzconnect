const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// Раздача статики
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Пример REST API
app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong' });
});

// Инициализация SQLite
const db = new sqlite3.Database(path.join(__dirname, '..', 'db.sqlite'), (err) => {
  if (err) {
    console.error('Ошибка подключения к базе:', err.message);
  } else {
    console.log('Подключено к базе данных SQLite');
  }
});

// Запуск HTTP сервера
const server = http.createServer(app);

// WebSocket сервер
const wss = new WebSocket.Server({ server });

// Очередь для матчмейкинга
let waiting = null;

// Массив всех подключённых клиентов
let clients = [];

wss.on('connection', (ws) => {
  ws.instrument = null; // по умолчанию инструмент не выбран
  clients.push(ws);
  broadcastClients();

  // Логика чат-рулетки (matchmaking)
  if (waiting && waiting.readyState === WebSocket.OPEN) {
    const peer = waiting;
    waiting = null;

    ws.peer = peer;
    peer.peer = ws;

    ws.send(JSON.stringify({ type: 'status', message: 'Собеседник найден!' }));
    peer.send(JSON.stringify({ type: 'status', message: 'Собеседник найден!' }));
  } else {
    waiting = ws;
    ws.send(JSON.stringify({ type: 'status', message: 'Ожидание собеседника...' }));
  }

  ws.on('message', (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch (e) {
      return;
    }

    if (data.type === 'register') {
      ws.instrument = data.instrument;
      broadcastClients();
    }

    // WebRTC сигналинг
    if (data.type === 'signal') {
      if (ws.peer && ws.peer.readyState === WebSocket.OPEN) {
        ws.peer.send(JSON.stringify({
          type: 'signal',
          from: ws._socket.remotePort, // или генерируйте свой id
          signal: data.signal
        }));
      }
    }
  });

  ws.on('close', () => {
    // Если был в очереди — убираем
    if (waiting === ws) waiting = null;
    // Если был в паре — уведомляем собеседника
    if (ws.peer && ws.peer.readyState === WebSocket.OPEN) {
      ws.peer.send(JSON.stringify({ type: 'status', message: 'Собеседник отключился.' }));
      ws.peer.peer = null;
    }
    // Удаляем из массива клиентов и обновляем онлайн-список
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

// Запуск сервера
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
