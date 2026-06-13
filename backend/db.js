const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'sessions.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err);
  } else {
    console.log('Database connected.');
    db.serialize(() => {
      // Table for Sessions
      db.run(`CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        agentId TEXT,
        customerId TEXT,
        startTime DATETIME DEFAULT CURRENT_TIMESTAMP,
        endTime DATETIME,
        status TEXT DEFAULT 'active'
      )`);

      // Table for Chat
      db.run(`CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId TEXT,
        senderRole TEXT,
        message TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
    });
  }
});

module.exports = {
  createSession: (sessionId, agentId) => {
    return new Promise((resolve, reject) => {
      db.run('INSERT INTO sessions (id, agentId) VALUES (?, ?)', [sessionId, agentId], function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      });
    });
  },
  endSession: (sessionId) => {
    return new Promise((resolve, reject) => {
      db.run("UPDATE sessions SET status='ended', endTime=CURRENT_TIMESTAMP WHERE id=?", [sessionId], function (err) {
        if (err) return reject(err);
        resolve(this.changes);
      });
    });
  },
  saveChat: (sessionId, senderRole, message) => {
    return new Promise((resolve, reject) => {
      db.run('INSERT INTO chats (sessionId, senderRole, message) VALUES (?, ?, ?)', [sessionId, senderRole, message], function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      });
    });
  },
  getChats: (sessionId) => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM chats WHERE sessionId = ? ORDER BY timestamp ASC', [sessionId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }
};
