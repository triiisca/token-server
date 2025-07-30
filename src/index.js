const express = require('express');
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');
require('dotenv').config();

// Firebase Admin SDK
const admin = require('firebase-admin');

// Inizializza Firebase Admin usando le environment variables
if (!admin.apps.length) {
    const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
        universe_domain: "googleapis.com"
    };

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID
    });
    
    console.log('✅ Firebase Admin SDK inizializzato');
}

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
        status: "Server Render attivo",
        timestamp: new Date().toISOString(),
        appId: appId,
        environment: "production",
        platform: "render",
        fcm: "enabled"
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

// ENDPOINT FCM NOTIFICHE
app.post('/api/send-fcm-notification', async (req, res) => {
    try {
        const { targetUserId, title, body, data = {} } = req.body;
        
        if (!targetUserId || !title || !body) {
            return res.status(400).json({ 
                error: 'targetUserId, title e body sono obbligatori' 
            });
        }

        // Trova il token FCM dell'utente target
        const db = admin.firestore();
        const userDoc = await db.collection('users').doc(targetUserId).get();
        
        if (!userDoc.exists) {
            return res.status(404).json({ 
                error: 'Utente non trovato' 
            });
        }
        
        const userData = userDoc.data();
        const fcmToken = userData.fcm_token;
        
        if (!fcmToken) {
            return res.status(404).json({ 
                error: 'Token FCM non trovato per questo utente' 
            });
        }

        const message = {
            token: fcmToken,
            notification: {
                title: title,
                body: body,
                icon: '🎧'
            },
            data: {
                ...data,
                timestamp: Date.now().toString()
            },
            webpush: {
                headers: {
                    'Urgency': 'high'
                },
                notification: {
                    title: title,
                    body: body,
                    icon: '🎧',
                    badge: '🎧',
                    requireInteraction: true,
                    vibrate: [200, 100, 200],
                    actions: getNotificationActions(data.type)
                }
            }
        };

        const response = await admin.messaging().send(message);
        console.log('📱 Notifica FCM inviata:', response);
        
        res.json({ 
            success: true, 
            messageId: response,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Errore invio notifica FCM:', error);
        res.status(500).json({ 
            error: 'Errore interno del server',
            details: error.message 
        });
    }
});

// Test endpoint per verificare FCM
app.post('/api/test-fcm', async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({ error: 'Token FCM richiesto per test' });
        }

        const message = {
            token: token,
            notification: {
                title: '🧪 Test Phonly You',
                body: 'Le notifiche FCM funzionano correttamente!',
                icon: '🎧'
            },
            data: {
                type: 'test',
                timestamp: Date.now().toString()
            },
            webpush: {
                notification: {
                    title: '🧪 Test Phonly You',
                    body: 'Le notifiche FCM funzionano correttamente!',
                    icon: '🎧',
                    badge: '🎧',
                    requireInteraction: true
                }
            }
        };

        const response = await admin.messaging().send(message);
        console.log('✅ Test FCM inviato:', response);
        
        res.json({ 
            success: true, 
            messageId: response,
            message: 'Notifica di test inviata con successo!' 
        });

    } catch (error) {
        console.error('❌ Errore test FCM:', error);
        res.status(500).json({ 
            error: 'Errore interno del server',
            details: error.message 
        });
    }
});

// Endpoint per notificare richiesta estensione
app.post('/api/notify-extension', async (req, res) => {
    try {
        const { targetUserId, fromNickname, channelName } = req.body;
        
        const result = await sendFCMToUser(targetUserId, {
            title: '⏰ Richiesta di estensione!',
            body: `${fromNickname || 'Un utente'} vuole continuare la chiamata`,
            data: {
                type: 'extension_request',
                channel: channelName,
                from: targetUserId
            }
        });
        
        if (result.success) {
            res.json({ success: true, messageId: result.messageId });
        } else {
            res.status(500).json({ error: result.error });
        }

    } catch (error) {
        console.error('❌ Errore notifica estensione:', error);
        res.status(500).json({ error: error.message });
    }
});

// Funzione helper per inviare FCM
async function sendFCMToUser(userId, { title, body, data = {} }) {
    try {
        const db = admin.firestore();
        const userDoc = await db.collection('users').doc(userId).get();
        
        if (!userDoc.exists) {
            return { success: false, error: 'Utente non trovato' };
        }
        
        const userData = userDoc.data();
        const fcmToken = userData.fcm_token;
        
        if (!fcmToken) {
            return { success: false, error: 'Token FCM non trovato' };
        }

        const message = {
            token: fcmToken,
            notification: { title, body, icon: '🎧' },
            data: { ...data, timestamp: Date.now().toString() },
            webpush: {
                notification: {
                    title, body, icon: '🎧', badge: '🎧',
                    requireInteraction: true,
                    vibrate: [200, 100, 200],
                    actions: getNotificationActions(data.type)
                }
            }
        };

        const response = await admin.messaging().send(message);
        return { success: true, messageId: response };

    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Helper per azioni notifiche
function getNotificationActions(type) {
    switch (type) {
        case 'extension_request':
            return [
                { action: 'accept_extension', title: '✅ Accetta' },
                { action: 'deny_extension', title: '❌ Rifiuta' }
            ];
        case 'match_found':
            return [
                { action: 'join_call', title: '🎧 Unisciti' },
                { action: 'ignore', title: '🚫 Ignora' }
            ];
        default:
            return [];
    }
}

// WEBSOCKET SIGNALING (ESISTENTE)
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
    console.log(`🚀 Server Render attivo su porta ${PORT}`);
    console.log(`📡 WebSocket endpoint: /ws`);
    console.log(`🔑 Agora App ID: ${appId}`);
    console.log(`📱 FCM enabled: ${admin.apps.length > 0}`);
    console.log(`🌐 Platform: Render`);
});
