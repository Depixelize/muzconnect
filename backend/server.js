// backend/server.js

const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// === Раздача статики из frontend ===
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// === Пример REST API (можно расширить) ===
app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong' });
});

// === Инициализация SQLite ===
const db = new sqlite3.Database(path.join(__dirname, '..', 'db.sqlite'), (err) => {
  if (err) {
    console.error('Ошибка подключения к базе:', err.message);
  } else {
    console.log('Подключено к базе данных SQLite');
  }
});

// === Запуск HTTP сервера ===
const server = http.createServer(app);

// === WebSocket сервер ===
const wss = new WebSocket.Server({ server });

// === Очередь пользователей для поиска собеседников ===
let waiting = null;

wss.on('connection', (ws, req) => {
  console.log('Новое WebSocket-соединение');

  // Простейшая логика "чат-рулетки"
  if (waiting && waiting.readyState === WebSocket.OPEN) {
    // Соединяем двух пользователей
    const peer = waiting;
    waiting = null;

    ws.peer = peer;
    peer.peer = ws;

    ws.send(JSON.stringify({ type: 'status', message: 'Собеседник найден!' }));
    peer.send(JSON.stringify({ type: 'status', message: 'Собеседник найден!' }));
  } else {
    // Если нет ожидающих — ставим в очередь
    waiting = ws;
    ws.send(JSON.stringify({ type: 'status', message: 'Ожидание собеседника...' }));
  }

  ws.on('message', (msg) => {
    // Пересылаем сообщения собеседнику
    if (ws.peer && ws.peer.readyState === WebSocket.OPEN) {
      ws.peer.send(msg);
    }
  });

  ws.on('close', () => {
    // Оповещаем собеседника о разрыве соединения
    if (ws.peer && ws.peer.readyState === WebSocket.OPEN) {
      ws.peer.send(JSON.stringify({ type: 'status', message: 'Собеседник отключился.' }));
      ws.peer.peer = null;
    }
    // Если пользователь был в ожидании — убираем из очереди
    if (waiting === ws) {
      waiting = null;
    }
  });
});

// === Запуск сервера ===
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
