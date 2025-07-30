// SOSTITUISCI LE FUNZIONI FCM NEL TUO script.js CON QUESTE

// --- RILEVAMENTO BROWSER ---
function isSafari() {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// --- FUNZIONI FCM CON FALLBACK SAFARI ---
async function initializeFCM() {
    console.log("🔔 Inizializzazione notifiche - Step 1: Rilevamento browser");
    console.log("📱 User Agent:", navigator.userAgent);
    console.log("🌐 Browser rilevato:", isSafari() ? 'Safari' : 'Altri');
    console.log("📱 Mobile:", isMobile());
    
    if (isSafari()) {
        console.log("🍎 Safari rilevato - usando notifiche native");
        return await initializeSafariNotifications();
    } else {
        console.log("🔥 Browser compatibile FCM - usando Firebase");
        return await initializeFirebaseFCM();
    }
}

// Notifiche native per Safari
async function initializeSafariNotifications() {
    try {
        console.log("🍎 Inizializzazione notifiche Safari...");
        
        if (!('Notification' in window)) {
            console.error("❌ Notifiche non supportate su questo browser");
            showFCMStatus("Notifiche non supportate", "error");
            return null;
        }
        
        let permission = Notification.permission;
        console.log("📱 Permesso notifiche:", permission);
        
        if (permission === 'default') {
            console.log("🔔 Richiesta permessi notifiche native...");
            permission = await Notification.requestPermission();
            console.log("📱 Nuovo permesso:", permission);
        }
        
        if (permission === 'granted') {
            console.log("✅ Notifiche Safari abilitate");
            showFCMStatus("Notifiche Safari attive", "success");
            
            // Test notifica
            setTimeout(() => {
                sendSafariNotification("🧪 Test Safari", "Notifiche native funzionanti!");
            }, 2000);
            
            return 'safari-native';
        } else {
            console.error("❌ Permessi notifiche negati");
            showFCMStatus("Permessi negati", "error");
            return null;
        }
    } catch (error) {
        console.error("❌ Errore notifiche Safari:", error);
        showFCMStatus("Safari Error", "error");
        return null;
    }
}

// FCM completo per browser compatibili
async function initializeFirebaseFCM() {
    try {
        console.log("🔔 Inizializzazione FCM - Step 1: Controllo supporto browser");
        
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
        
        try {
            const registration = await navigator.serviceWorker.register('/mem/firebase-messaging-sw.js', {
                scope: '/mem/'
            });
            console.log("✅ Service Worker registrato:", registration);
            await navigator.serviceWorker.ready;
            console.log("✅ Service Worker pronto");
        } catch (swError) {
            console.error("❌ Errore Service Worker:", swError);
            showFCMStatus("Service Worker fallito", "error");
            return null;
        }
        
        console.log("🔔 Step 3: Richiesta permessi notifiche");
        let permission = Notification.permission;
        if (permission === 'default') {
            permission = await Notification.requestPermission();
        }
        
        if (permission !== 'granted') {
            console.error("❌ Permessi FCM negati");
            showFCMStatus("Permessi negati", "error");
            return null;
        }
        
        console.log("🔔 Step 4: Richiesta token FCM");
        try {
            fcmToken = await getToken(messaging, {
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: await navigator.serviceWorker.ready
            });
            
            if (fcmToken) {
                console.log("✅ Token FCM ottenuto:", fcmToken.substring(0, 50) + "...");
                
                if (currentUser) {
                    await saveFCMTokenToProfile(fcmToken);
                }
                
                showFCMStatus("FCM Attivo ✅", "success");
                testFCMConnection(fcmToken);
                return fcmToken;
            } else {
                console.error("❌ Token FCM vuoto");
                showFCMStatus("Token FCM vuoto", "error");
                return null;
            }
        } catch (tokenError) {
            console.error("❌ Errore token FCM:", tokenError);
            showFCMStatus(`FCM Error: ${tokenError.code}`, "error");
            return null;
        }
    } catch (err) {
        console.error("❌ Errore generale FCM:", err);
        showFCMStatus("FCM Error generale", "error");
        return null;
    }
}

// Invio notifiche Safari native
function sendSafariNotification(title, body, options = {}) {
    if (Notification.permission !== 'granted') {
        console.log("❌ Permessi notifiche non concessi");
        return;
    }
    
    console.log("🍎 Invio notifica Safari:", title);
    
    try {
        const notification = new Notification(title, {
            body: body,
            icon: '🎧',
            tag: 'phonly-you-safari',
            requireInteraction: true,
            ...options
        });
        
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
        
        // Auto-close dopo 10 secondi
        setTimeout(() => {
            notification.close();
        }, 10000);
        
    } catch (error) {
        console.error("❌ Errore notifica Safari:", error);
    }
}

// Test connessione FCM (solo per browser non-Safari)
async function testFCMConnection(token) {
    if (isSafari()) {
        console.log("🍎 Skip test FCM server per Safari");
        return;
    }
    
    try {
        console.log("🧪 Test FCM server...");
        const response = await fetch(`${TOKEN_SERVER_URL}/api/test-fcm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log("✅ Test FCM server riuscito:", result);
            showInAppNotification("✅ FCM Test", "Notifiche FCM funzionanti!", "success");
        } else {
            console.error("❌ Test FCM server fallito");
        }
    } catch (error) {
        console.error("❌ Errore test FCM:", error);
    }
}

// Invio notifiche FCM (con fallback Safari)
async function sendFCMNotification(targetUserId, title, body, data = {}) {
    console.log("📱 Invio notifica:", title, "- Browser:", isSafari() ? 'Safari' : 'FCM');
    
    if (isSafari()) {
        // Su Safari usa notifiche native immediate
        sendSafariNotification(title, body);
        return true;
    } else {
        // Su altri browser usa FCM server
        try {
            const response = await fetch(`${TOKEN_SERVER_URL}/api/send-fcm-notification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetUserId: targetUserId,
                    title: title,
                    body: body,
                    data: data
                })
            });
            
            if (response.ok) {
                console.log("📱 Notifica FCM inviata");
                return true;
            } else {
                console.error("❌ Errore FCM server");
                return false;
            }
        } catch (error) {
            console.error("❌ Errore richiesta FCM:", error);
            return false;
        }
    }
}

// Versione aggiornata showFCMStatus
function showFCMStatus(message, type = "success") {
    console.log(`📱 Status: ${message} (${type})`);
    
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
    
    setTimeout(() => {
        if (indicator.parentNode) {
            indicator.remove();
        }
    }, 5000);
}

// Notifiche in-app (universali)
function showInAppNotification(title, body, type = "info") {
    console.log("💬 Notifica in-app:", title);
    
    const notification = document.createElement('div');
    notification.className = `in-app-notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <strong>${title}</strong>
            <p>${body}</p>
        </div>
        <button class="notification-close">×</button>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
    
    notification.querySelector('.notification-close').onclick = () => {
        notification.remove();
    };
}

// Debug FCM
window.showFCMDebug = function() {
    const debugInfo = `
🔍 DEBUG INFO:
• Browser: ${isSafari() ? 'Safari' : 'Altri'}
• Mobile: ${isMobile()}
• URL: ${window.location.href}
• Service Worker: ${'serviceWorker' in navigator}
• Notifiche: ${'Notification' in window}
• Permesso: ${Notification.permission}
• Token FCM: ${fcmToken ? 'Presente' : 'Assente'}

Safari ha limitazioni con FCM!
Usa Chrome/Firefox per FCM completo.
    `;
    
    alert(debugInfo);
    console.log(debugInfo);
};

// Gestione messaggi FCM in foreground (solo non-Safari)
if (!isSafari() && typeof messaging !== 'undefined') {
    onMessage(messaging, (payload) => {
        console.log("📨 Messaggio FCM ricevuto:", payload);
        
        const { title, body } = payload.notification || {};
        const { type } = payload.data || {};
        
        if (title && body) {
            showInAppNotification(title, body, type);
            
            if (document.hidden && Notification.permission === 'granted') {
                new Notification(title, {
                    body: body,
                    icon: '🎧',
                    tag: 'fcm-notification'
                });
            }
        }
        
        handleFCMAction(payload.data);
    });
}

// Gestione azioni FCM
function handleFCMAction(data) {
    if (!data || !data.type) return;
    
    switch (data.type) {
        case 'extension_request':
            console.log("📱 Notifica estensione ricevuta");
            break;
        case 'match_found':
            showInAppNotification(
                "🎧 Nuova conversazione!", 
                "Clicca 'Trova conversazione' per unirti",
                "success"
            );
            break;
    }
}

// Funzione requestNotificationPermission aggiornata
async function requestNotificationPermission() {
    console.log("🔔 INIZIO richiesta permessi notifiche...");
    console.log("🌐 Browser:", isSafari() ? 'Safari' : 'Altri');
    
    const result = await initializeFCM();
    const finalResult = result ? 'granted' : 'denied';
    
    console.log("🔔 FINE richiesta permessi. Risultato:", finalResult);
    return finalResult;
}
