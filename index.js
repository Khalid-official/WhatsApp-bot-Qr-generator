const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');
const QRCode = require('qrcode');
const fs = require('fs');

let currentQR = null;

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('session');

  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    browser: ['QR HTTP Bot', 'Chrome', '1.0.0']
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, qr, lastDisconnect } = update;

    if (qr) {
      currentQR = qr;
      console.log('New QR generated. Visit http://localhost:3000/qr to scan.');
    }

    if (connection === 'open') {
      console.log(`✅ WhatsApp Connected as: ${sock.user.id}`);
      currentQR = null;

      const credsPath = './session/creds.json';
      if (fs.existsSync(credsPath)) {
        console.log(`Session credentials saved at: ${credsPath}`);
      }
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason === DisconnectReason.loggedOut) {
        console.log('Logged out. Scan again to reconnect.');
      } else {
        console.log('Connection lost. Reconnecting...');
        startBot();
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);
}

// Start Express Server
const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
  res.send(`<h2>WhatsApp QR Login</h2><p>Go to <a href="/qr">/qr</a> to view QR Code</p>`);
});

app.get('/qr', async (req, res) => {
  if (!currentQR) {
    return res.send('<h3>No QR Code available. WhatsApp might be connected already.</h3>');
  }

  const qrImage = await QRCode.toDataURL(currentQR);
  res.send(`
    <h2>Scan QR Code with WhatsApp</h2>
    <img src="${qrImage}" alt="QR Code">
    <p>This QR updates if disconnected.</p>
  `);
});

app.listen(PORT, () => {
  console.log(`QR HTTP Server running on http://localhost:${PORT}`);
});

// Start Baileys Bot
startBot();
  
