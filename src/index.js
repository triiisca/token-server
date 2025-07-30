// SOSTITUISCI QUESTE FUNZIONI NEL TUO script.js

// --- FUNZIONI FCM CON DEBUG COMPLETO ---
async function initializeFCM() {
    try {
        console.log("🔔 Inizializzazione FCM - Step 1: Controllo supporto browser");
        
        // Verifica supporto browser
        if (!('serviceWorker' in navigator)) {
            console.error("❌ Service Worker non supportato");
            showFCMStatus("Service Worker non supportato", "error");
            return null;
        }
        
        if (!('Notification' in window)) {
            console.error("❌ Notifiche non supportate");
            showFCMStatus("Notifiche non supportate", "error");
            return null;
        }
        
        console.log("✅ Browser supporta FCM");
        console.log("🔔 Step 2: Registrazione Service Worker");
        
        // Registra Service Worker
        try {
            const registration = await navigator.serviceWorker.register('/mem/firebase-messaging-sw.js', {
                scope: '/mem/'
            });
            console.log("✅ Service Worker registrato:", registration);
            
            // Aspetta che il service worker sia attivo
            await navigator.serviceWorker.ready;
            console.log("✅ Service Worker pronto");
            
        } catch (swError) {
            console.error("❌ Errore registrazione Service Worker:", swError);
            showFCMStatus("Service Worker fallito", "error");
            
            // Prova percorso alternativo
            try {
                console.log("🔄 Tentativo percorso alternativo...");
                const altRegistration = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
                console.log("✅ Service Worker registrato (percorso alternativo):", altRegistration);
            } catch (altError) {
                console.error("❌ Anche percorso alternativo fallito:", altError);
                return null;
            }
        }
        
        console.log("🔔 Step 3: Richiesta permessi notifiche");
        
        // Verifica e richiedi permessi
        let permission = Notification.permission;
        console.log("📱 Permesso notifiche attuale:", permission);
        
        if (permission === 'default') {
            console.log("🔔 Richiesta permessi...");
            permission = await Notification.requestPermission();
            console.log("📱 Nuovo permesso:", permission);
        }
        
        if (permission !== 'granted') {
            console.error("❌ Permessi notifiche negati");
            showFCMStatus("Permessi negati", "error");
            return null;
        }
        
        console.log("✅ Permessi notifiche concessi");
        console.log("🔔 Step 4: Richiesta token FCM");
        console.log("🔑 VAPID Key:", VAPID_KEY.substring(0, 20) + "...");
        
        // Richiedi token FCM
        try {
            fcmToken = await getToken(messaging, {
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: await navigator.serviceWorker.ready
            });
            
            if (fcmToken) {
                console.log("✅ Token FCM ottenuto!");
                console.log("🔑 Token (primi 50 caratteri):", fcmToken.substring(0, 50) + "...");
                console.log("📏 Lunghezza token:", fcmToken.length);
                
                if (currentUser) {
                    console.log("💾 Salvataggio token nel profilo...");
                    await saveFCMTokenToProfile(fcmToken);
                }
                
                showFCMStatus("FCM Attivo ✅", "success");
                
                // Test di connessione
                console.log("🧪 Test connessione FCM...");
                testFCMConnection(fcmToken);
                
                return fcmToken;
            } else {
                console.error("❌ Token FCM è null o undefined");
                showFCMStatus("Token FCM vuoto", "error");
                return null;
            }
            
        } catch (tokenError) {
            console.error("❌ Errore dettagliato richiesta token:", tokenError);
            console.error("📋 Error code:", tokenError.code);
            console.error("📋 Error message:", tokenError.message);
            console.error("📋 Error stack:", tokenError.stack);
            
            // Errori specifici
            if (tokenError.code === 'messaging/failed-service-worker-registration') {
                showFCMStatus("Service Worker non trovato", "error");
                console.error("💡 Verifica che firebase-messaging-sw.js sia in: https://bussolaweb.it/mem/firebase-messaging-sw.js");
            } else if (tokenError.code === 'messaging/vapid-key-required') {
                showFCMStatus("VAPID key non valida", "error");
                console.error("💡 Verifica VAPID key in Firebase Console");
            } else if (tokenError.code === 'messaging/permission-blocked') {
                showFCMStatus("Permessi bloccati", "error");
                console.error("💡 Sblocca notifiche nelle impostazioni browser");
            } else {
                showFCMStatus(`FCM Error: ${tokenError.code}`, "error");
            }
            
            return null;
        }
        
    } catch (err) {
        console.error("❌ Errore generale FCM:", err);
        console.error("📋 Error details:", {
            name: err.name,
            message: err.message,
            code: err.code,
            stack: err.stack
        });
        showFCMStatus("FCM Error generale", "error");
        return null;
    }
}

// Test di connessione FCM
async function testFCMConnection(token) {
    try {
        console.log("🧪 Invio test FCM al server...");
        const response = await fetch(`${TOKEN_SERVER_URL}/api/test-fcm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log("✅ Test FCM server riuscito:", result);
            showInAppNotification("✅ FCM Test", "Notifiche configurate correttamente!", "success");
        } else {
            const error = await response.text();
            console.error("❌ Test FCM server fallito:", error);
        }
    } catch (error) {
        console.error("❌ Errore test FCM:", error);
    }
}

// Versione migliorata di showFCMStatus
function showFCMStatus(message, type = "success") {
    console.log(`📱 FCM Status: ${message} (${type})`);
    
    const existing = document.getElementById('fcmStatus');
    if (existing) existing.remove();
    
    const indicator = document.createElement('div');
    indicator.id = 'fcmStatus';
    indicator.className = `fcm-status ${type}`;
    indicator.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <span>📱</span>
            <span>${message}</span>
            ${type === 'error' ? '<span style="cursor: pointer;" onclick="showFCMDebug()">🔍</span>' : ''}
        </div>
    `;
    indicator.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        background: ${type === 'error' ? 'rgba(244, 67, 54, 0.9)' : 'rgba(76, 175, 80, 0.9)'};
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 1000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    document.body.appendChild(indicator);
    
    // Auto-rimuovi dopo più tempo se è un errore
    const timeout = type === 'error' ? 15000 : 5000;
    setTimeout(() => {
        if (indicator.parentNode) {
            indicator.remove();
        }
    }, timeout);
}

// Debug info per FCM
window.showFCMDebug = function() {
    const debugInfo = `
🔍 FCM DEBUG INFO:
• URL: ${window.location.href}
• User Agent: ${navigator.userAgent}
• Service Worker supportato: ${'serviceWorker' in navigator}
• Notifiche supportate: ${'Notification' in window}
• Permesso notifiche: ${Notification.permission}
• VAPID Key: ${VAPID_KEY.substring(0, 20)}...
• Token FCM: ${fcmToken ? 'Presente' : 'Assente'}
• Firebase messaging: ${messaging ? 'Inizializzato' : 'Non inizializzato'}

📂 Controlla:
1. https://bussolaweb.it/mem/firebase-messaging-sw.js
2. Permessi browser
3. Console errori
    `;
    
    alert(debugInfo);
    console.log(debugInfo);
};

// Versione aggiornata requestNotificationPermission
async function requestNotificationPermission() {
    console.log("🔔 INIZIO richiesta permessi notifiche FCM...");
    
    // Prima richiedi permessi Notification API base
    if ('Notification' in window && Notification.permission === 'default') {
        console.log("🔔 Richiesta permessi Notification API base...");
        const permission = await Notification.requestPermission();
        console.log("📱 Risultato permessi base:", permission);
    }
    
    // Poi inizializza FCM
    console.log("🔔 Inizializzazione FCM...");
    const token = await initializeFCM();
    
    const result = token ? 'granted' : 'denied';
    console.log("🔔 FINE richiesta permessi. Risultato:", result);
    
    return result;
}
