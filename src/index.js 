// Server Token per Phonly You su Railway
require('dotenv').config();
const express = require('express');
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Configurazione Agora
const AGORA_APP_ID = process.env.AGORA_APP_ID || '5207a70aa7f143cf8836989977da308c';
const AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || '14f43aa68e7b4162847dda4230d5d4f4';

// Middleware
app.use(cors({
    origin: ['https://bussolaweb.it', 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'Server Railway attivo',
        timestamp: new Date().toISOString(),
        appId: AGORA_APP_ID,
        environment: process.env.NODE_ENV || 'development'
    });
});

// Endpoint principale per token anonimi
app.post('/api/anonymous-token', async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId è richiesto'
            });
        }

        console.log(`🔑 Generazione token per utente: ${userId}`);

        // Genera UID unico basato su userId
        const uid = Math.abs(userId.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0)) % 1000000;

        const channelName = 'anonymous-channel';
        const role = RtcRole.PUBLISHER;
        const expirationTimeInSeconds = 3600; // 1 ora
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const expirationTimestamp = currentTimestamp + expirationTimeInSeconds;

        // Genera token dinamico con i certificati
        const token = RtcTokenBuilder.buildTokenWithUid(
            AGORA_APP_ID,
            AGORA_APP_CERTIFICATE,
            channelName,
            uid,
            role,
            expirationTimestamp
        );

        console.log(`✅ Token generato per UID: ${uid}, expires: ${new Date(expirationTimestamp * 1000).toISOString()}`);

        res.json({
            success: true,
            data: {
                token: token,
                appId: AGORA_APP_ID,
                channelName: channelName,
                uid: uid,
                userId: userId,
                expiresAt: expirationTimestamp,
                expiresIn: expirationTimeInSeconds,
                generatedAt: currentTimestamp
            }
        });

    } catch (error) {
        console.error('❌ Errore generazione token:', error);
        res.status(500).json({
            success: false,
            error: 'Errore interno del server',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Endpoint generico per token personalizzati
app.post('/api/token', async (req, res) => {
    try {
        const {
            channelName,
            uid = 0,
            role = 'publisher',
            expirationTimeInSeconds = 3600
        } = req.body;

        if (!channelName) {
            return res.status(400).json({
                success: false,
                error: 'channelName è richiesto'
            });
        }

        const roleType = role === 'audience' ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const expirationTimestamp = currentTimestamp + expirationTimeInSeconds;

        const token = RtcTokenBuilder.buildTokenWithUid(
            AGORA_APP_ID,
            AGORA_APP_CERTIFICATE,
            channelName,
            uid,
            roleType,
            expirationTimestamp
        );

        res.json({
            success: true,
            data: {
                token: token,
                appId: AGORA_APP_ID,
                channelName: channelName,
                uid: uid,
                role: role,
                expiresAt: expirationTimestamp,
                expiresIn: expirationTimeInSeconds
            }
        });

    } catch (error) {
        console.error('❌ Errore generazione token generico:', error);
        res.status(500).json({
            success: false,
            error: 'Errore interno del server'
        });
    }
});

// Gestione 404
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint non trovato',
        availableEndpoints: [
            'GET /health',
            'POST /api/anonymous-token',
            'POST /api/token'
        ]
    });
});

// Gestione errori globali
app.use((error, req, res, next) => {
    console.error('❌ Errore non gestito:', error);
    res.status(500).json({
        error: 'Errore interno del server'
    });
});

// Avvio server
app.listen(PORT, () => {
    console.log(`🚀 Server Phonly You Token avviato sulla porta ${PORT}`);
    console.log(`📡 Agora App ID: ${AGORA_APP_ID}`);
    console.log(`🌐 Endpoint disponibili:`);
    console.log(`   - GET  /health`);
    console.log(`   - POST /api/anonymous-token`);
    console.log(`   - POST /api/token`);
    console.log(`🔧 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🎯 Railway URL: https://[PROJECT-NAME].up.railway.app`);
});
