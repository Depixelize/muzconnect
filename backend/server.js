// backend/server.js

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const db = new sqlite3.Database('./data/users.db');

// Создание �абли�� п�и ��а��е
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    instrument TEXT,
    socket_id TEXT,
    connected INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

let clients = new Map();

function findMatch(instrument, requesterId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM users WHERE instrument = ? AND connected = 0 AND id != ? ORDER BY created_at ASC LIMIT 1`,
      [instrument, requesterId],
      (err, row) => {
        if (err) return reject(err);
        resolve(row);
      }
    );
  });
}

wss.on('connection', (ws) => {
  const socketId = uuidv4();
  clients.set(socketId, ws);

  ws.on('message', async (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === 'register') {
        const userId = uuidv4();
        db.run(`INSERT INTO users (id, instrument, socket_id) VALUES (?, ?, ?)`, [userId, data.instrument, socketId]);
        ws.userId = userId;

        const match = await findMatch(data.instrument, userId);
        if (match) {
          db.run(`UPDATE users SET connected = 1 WHERE id IN (?, ?)`, [userId, match.id]);
          ws.send(JSON.stringify({ type: 'match', peerId: match.socket_id }));
          if (clients.has(match.socket_id)) {
            clients.get(match.socket_id).send(JSON.stringify({ type: 'match', peerId: socketId }));
          }
        }
      } else if (data.type === 'signal') {
        if (clients.has(data.to)) {
          clients.get(data.to).send(JSON.stringify({
            type: 'signal',
            from: socketId,
            signal: data.signal,
          }));
        }
      }
    } catch (e) {
      console.error('Error handling message', e);
    }
  });

  ws.on('close', () => {
    clients.delete(socketId);
    db.run(`DELETE FROM users WHERE socket_id = ?`, [socketId]);
  });
});

app.use(express.static(path.join(__dirname, '../frontend')));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server started on http://localhost:${PORT}`));

