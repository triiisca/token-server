const express = require('express');
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

// Middleware
app.use(cors());
app.use(express.json());

// Configurazione Agora
const appId = process.env.AGORA_APP_ID;
const appCertificate = process.env.AGORA_APP_CERTIFICATE;

// Mappa dei canali attivi per signaling
const activeChannels = new Map();

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: "Server Railway attivo",
        timestamp: new Date().toISOString(),
        appId: appId,
        environment: "production"
    });
});

// Genera token per chiamate vocali
app.post('/api/token', (req, res) => {
    const { channelName, uid, role } = req.body;
    
    if (!channelName) {
        return res.status(400).json({ error: 'channelName richiesto' });
    }
    
    const userId = uid || 0;
    const userRole = role === 1 ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    const expirationTimeInSeconds = 3600; // 1 ora
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;
    
    try {
        const token = RtcTokenBuilder.buildTokenWithUid(
            appId,
            appCertificate,
            channelName,
            userId,
            userRole,
            privilegeExpiredTs
        );
        
        res.json({ token });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Genera token anonimo
app.post('/api/anonymous-token', (req, res) => {
    const { channelName } = req.body;
    const defaultChannel = channelName || 'anonymous-channel';
    
    const userId = 0;
    const userRole = RtcRole.PUBLISHER;
    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;
    
    try {
        const token = RtcTokenBuilder.buildTokenWithUid(
            appId,
            appCertificate,
            defaultChannel,
            userId,
            userRole,
            privilegeExpiredTs
        );
        
        res.json({ token });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// SISTEMA WEBSOCKET PER SIGNALING
wss.on('connection', (ws) => {
    console.log('Nuova connessione WebSocket per signaling');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleSignalingMessage(ws, data);
        } catch (error) {
            console.error('Errore parsing messaggio WebSocket:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('Connessione WebSocket chiusa');
        removeUserFromChannels(ws);
    });
    
    ws.on('error', (error) => {
        console.error('Errore WebSocket:', error);
    });
});

function handleSignalingMessage(ws, data) {
    console.log('Messaggio signaling ricevuto:', data.type);
    
    switch(data.type) {
        case 'join_channel':
            joinChannel(ws, data.channel, data.userId);
            break;
        case 'extension_request':
            forwardToChannel(data.channel, data, ws);
            break;
        case 'extension_response':
            forwardToChannel(data.channel, data, ws);
            break;
        case 'user_report':
            handleUserReport(data);
            break;
        default:
            console.log('Tipo messaggio sconosciuto:', data.type);
    }
}

function joinChannel(ws, channelName, userId) {
    if (!activeChannels.has(channelName)) {
        activeChannels.set(channelName, new Set());
    }
    
    ws.channelName = channelName;
    ws.userId = userId;
    activeChannels.get(channelName).add(ws);
    
    console.log(`Utente ${userId} unito al canale ${channelName}`);
    console.log(`Canale ${channelName} ha ora ${activeChannels.get(channelName).size} utenti`);
}

function forwardToChannel(channelName, data, senderWs) {
    const channelUsers = activeChannels.get(channelName);
    if (channelUsers) {
        let forwarded = 0;
        channelUsers.forEach(ws => {
            if (ws !== senderWs && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(data));
                forwarded++;
            }
        });
        console.log(`Messaggio ${data.type} inoltrato a ${forwarded} utenti nel canale ${channelName}`);
    }
}

function removeUserFromChannels(ws) {
    if (ws.channelName) {
        const channelUsers = activeChannels.get(ws.channelName);
        if (channelUsers) {
            channelUsers.delete(ws);
            console.log(`Utente ${ws.userId} rimosso dal canale ${ws.channelName}`);
            
            if (channelUsers.size === 0) {
                activeChannels.delete(ws.channelName);
                console.log(`Canale ${ws.channelName} eliminato (vuoto)`);
            }
        }
    }
}

function handleUserReport(data) {
    // TODO: Implementare sistema di segnalazioni
    console.log('Segnalazione ricevuta:', data);
}

// Gestione errori globali
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server attivo su porta ${PORT}`);
    console.log(`📡 WebSocket endpoint: /ws`);
    console.log(`🔑 Agora App ID: ${appId}`);
});
