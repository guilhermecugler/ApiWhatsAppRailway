const express = require('express');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const app = express();
const PORT = process.env.PORT || 3000;
const cors = require('cors');


// Configuração do CORS
const corsOptions = {
  origin: ['chrome-extension://cjikiplmnkkknokjcblebpjkenddcgin', 'chrome-extension://oigbloghhgeboadhcjiobnfhaefhkdci', 'chrome-extension://ilpjchcakegncgmemldlhiingmabkcbb'], // Substitua pelo ID da sua extensão
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true, // Se você precisar enviar cookies ou cabeçalhos de autenticação
};


app.use(cors(corsOptions));

app.use(express.json());

let sock;

const formatPhoneNumber = (phone) => {
    // Remove espaços, hífens e sinais de mais
    const cleaned = phone.replace(/[\s-+]/g, '');

    // Adiciona o código do país 55 caso não esteja presente
    if (!cleaned.startsWith('55')) {
        return '55' + cleaned;
    }

    return cleaned;
};

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

    // Formatar o número de telefone
    const formattedPhone = formatPhoneNumber(phone);

    try {
        const result = await sock.sendMessage(`${formattedPhone}@s.whatsapp.net`, { text: message });
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
