const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, delay } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

let sock;

const startWhatsApp = async () => {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    sock = makeWASocket({
        printQRInTerminal: true,
        auth: state,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            if ((lastDisconnect.error)?.output.statusCode !== 401) {
                startWhatsApp(); // Restart connection if not authenticated
            }
        } else if (connection === 'open') {
            console.log('Connected to WhatsApp!');
        }
    });

    sock.ev.on('qr', (qr) => {
        console.log('Scan this QR code:');
        qrcode.generate(qr, { small: true });
    });
};

app.post('/send', async (req, res) => {
    const { phone, message } = req.body;

    if (!phone || !message) {
        return res.status(400).json({ error: 'Phone number and message are required.' });
    }

    try {
        const result = await sock.sendMessage(`${phone}@s.whatsapp.net`, { text: message });
        return res.json({ success: true, result });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to send message.', details: error });
    }
});

// Inicie a sessão do WhatsApp
startWhatsApp();

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
