// Upewnij się, że ten URL wskazuje na Twój backend.
const BASE_URL = 'https://moja-apka-4grosze-frontend.vercel.app/'; // Zmień na swój URL z Render.com!


// Elementy DOM
const container = document.querySelector('.container');
const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const authUsernameInput = document.getElementById('auth-username');
const authPasswordInput = document.getElementById('auth-password');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const authMessage = document.getElementById('auth-message');
const currentUserDisplay = document.getElementById('current-user-display');
const receivedTab = document.getElementById('received-tab');
const sendTab = document.getElementById('send-tab');
const receivedPanel = document.getElementById('received-panel');
const sendPanel = document.getElementById('send-panel');
const messagesList = document.getElementById('messages-list');
const refreshMessagesBtn = document.getElementById('refresh-messages');
const receiverSelect = document.getElementById('receiver-select');
const messageContentInput = document.getElementById('message-content');
const sendMessageBtn = document.getElementById('send-message-btn');
const sendMessageStatus = document.getElementById('send-message-status');
const logoutBtn = document.getElementById('logout-btn');

let currentUserId = null;
let currentUsername = null;
let publicVapidKey = null; // Do przechowywania klucza publicznego VAPID

// ----- Funkcje pomocnicze -----

function showPanel(panelId) {
    const panels = document.querySelectorAll('.panel');
    panels.forEach(panel => {
        panel.classList.remove('active-panel');
    });
    document.getElementById(panelId).classList.add('active-panel');

    const tabs = document.querySelectorAll('.tabs button');
    tabs.forEach(tab => tab.classList.remove('active'));
    if (panelId === 'received-panel') {
        receivedTab.classList.add('active');
    } else if (panelId === 'send-panel') {
        sendTab.classList.add('active');
    }
}

function showAuthSection() {
    container.classList.add('hidden');
    setTimeout(() => {
        authSection.style.display = 'block';
        appSection.style.display = 'none';
        authMessage.textContent = '';
        authUsernameInput.value = '';
        authPasswordInput.value = '';
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        currentUserId = null;
        currentUsername = null;
        container.classList.remove('hidden');
    }, 600);
}

function showAppSection(userId, username) {
    container.classList.add('hidden');
    setTimeout(() => {
        authSection.style.display = 'none';
        appSection.style.display = 'block';
        currentUserDisplay.textContent = username;
        currentUserId = userId;
        currentUsername = username;
        localStorage.setItem('userId', userId);
        localStorage.setItem('username', username);
        showPanel('received-panel');
        fetchMessages(); // Od razu pobierz wiadomości
        fetchAllUsers(); // Pobierz użytkowników do listy rozwijanej
        container.classList.remove('hidden');
        // NOWOŚĆ: Po zalogowaniu, spróbuj zarejestrować subskrypcję push
        subscribeUserToPush();
    }, 600);
}

function displayStatusMessage(element, message, isError = false) {
    element.textContent = message;
    element.className = isError ? 'error' : 'success';
    setTimeout(() => { element.textContent = ''; element.className = ''; }, 3000);
}

function formatDate(dateString) {
    const options = {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('pl-PL', options);
}

// ----- Obsługa Autoryzacji -----

loginBtn.addEventListener('click', async () => {
    const username = authUsernameInput.value.trim();
    const password = authPasswordInput.value.trim();
    if (!username || !password) {
        displayStatusMessage(authMessage, 'Wszystkie pola są wymagane.', true);
        return;
    }

    loginBtn.disabled = true;
    try {
        const response = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (response.ok) {
            displayStatusMessage(authMessage, data.message);
            showAppSection(data.userId, data.username);
        } else {
            displayStatusMessage(authMessage, data.message, true);
        }
    } catch (error) {
        displayStatusMessage(authMessage, 'Błąd połączenia z serwerem.', true);
        console.error('Login error:', error);
    } finally {
        loginBtn.disabled = false;
    }
});

registerBtn.addEventListener('click', async () => {
    const username = authUsernameInput.value.trim();
    const password = authPasswordInput.value.trim();
    if (!username || !password) {
        displayStatusMessage(authMessage, 'Wszystkie pola są wymagane.', true);
        return;
    }

    registerBtn.disabled = true;
    try {
        const response = await fetch(`${BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (response.ok) {
            displayStatusMessage(authMessage, data.message);
            setTimeout(() => loginBtn.click(), 1500);
        } else {
            displayStatusMessage(authMessage, data.message, true);
        }
    } catch (error) {
        displayStatusMessage(authMessage, 'Błąd połączenia z serwerem.', true);
        console.error('Register error:', error);
    } finally {
        registerBtn.disabled = false;
    }
});

logoutBtn.addEventListener('click', () => {
    showAuthSection();
});

// ----- Obsługa wiadomości (Polling usunięty, bo będą push notifications) -----

async function fetchMessages() { // Usunięto argumenty initialLoad i showNotification
    if (!currentUserId) return;

    messagesList.innerHTML = '<li>Ładowanie wiadomości... <span class="loading-spinner"></span></li>';

    try {
        // Zawsze pobieramy wszystkie wiadomości, bo nowe przyjdą jako push notifications
        const response = await fetch(`${BASE_URL}/messages/${currentUserId}`);
        const messages = await response.json();

        messagesList.innerHTML = '';

        if (messages.length === 0) {
            messagesList.innerHTML = '<li>Brak odebranych wiadomości.</li>';
            return;
        }

        messages.forEach(msg => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>Od: ${msg.sender.username}</strong><br>${msg.content}<span class="timestamp">${formatDate(msg.timestamp)}</span>`;
            messagesList.prepend(li); // Dodaj na początek listy (najnowsze na górze)
        });

    } catch (error) {
        messagesList.innerHTML = '<li>Błąd ładowania wiadomości. Spróbuj odświeżyć.</li>';
        console.error('Error fetching messages:', error);
    }
}

async function fetchAllUsers() {
    receiverSelect.innerHTML = '<option value="">Wybierz odbiorcę</option>';
    try {
        const response = await fetch(`${BASE_URL}/users`);
        const users = await response.json();

        users.forEach(user => {
            if (user.username !== currentUsername) {
                const option = document.createElement('option');
                option.value = user.username;
                option.textContent = user.username;
                receiverSelect.appendChild(option);
            }
        });
    } catch (error) {
        console.error('Error fetching users:', error);
    }
}

sendMessageBtn.addEventListener('click', async () => {
    const receiverUsername = receiverSelect.value;
    const content = messageContentInput.value.trim();

    if (!receiverUsername) {
        displayStatusMessage(sendMessageStatus, 'Wybierz odbiorcę.', true);
        return;
    }
    if (!content) {
        displayStatusMessage(sendMessageStatus, 'Wiadomość nie może być pusta.', true);
        return;
    }

    sendMessageBtn.disabled = true;
    try {
        const response = await fetch(`${BASE_URL}/send-message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                senderId: currentUserId,
                receiverUsername: receiverUsername,
                content: content
            })
        });
        const data = await response.json();
        if (response.ok) {
            displayStatusMessage(sendMessageStatus, data.message);
            messageContentInput.value = '';
            // Po wysłaniu wiadomości, odbiorca powinien otrzymać powiadomienie push
        } else {
            displayStatusMessage(sendMessageStatus, data.message, true);
        }
    } catch (error) {
        displayStatusMessage(sendMessageStatus, 'Błąd wysyłania wiadomości. Spróbuj ponownie.', true);
        console.error('Send message error:', error);
    } finally {
        sendMessageBtn.disabled = false;
    }
});


// ----- Obsługa Przełączania Paneli -----

receivedTab.addEventListener('click', () => {
    showPanel('received-panel');
    fetchMessages(); // Odśwież wiadomości po wejściu w zakładkę
});

sendTab.addEventListener('click', () => {
    showPanel('send-panel');
    fetchAllUsers();
});

refreshMessagesBtn.addEventListener('click', fetchMessages);


// ----- Funkcje do obsługi powiadomień push (NOWOŚĆ) -----

// Konwertuje ciąg znaków Base64 URL na Uint8Array (potrzebne dla subskrypcji)
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

async function getVapidPublicKey() {
    try {
        const response = await fetch(`${BASE_URL}/vapidPublicKey`);
        const data = await response.json();
        publicVapidKey = data.publicKey;
        console.log('Publiczny klucz VAPID pobrany:', publicVapidKey);
    } catch (error) {
        console.error('Błąd pobierania publicznego klucza VAPID:', error);
    }
}

async function subscribeUserToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Powiadomienia push nie są obsługiwane w tej przeglądarce/urządzeniu.');
        return;
    }
    if (!publicVapidKey) {
        console.warn('Brak publicznego klucza VAPID. Nie można zasubskrybować.');
        return;
    }
    if (!currentUserId) {
        console.warn('Brak ID użytkownika. Nie można zasubskrybować.');
        return;
    }

    try {
        const registration = await navigator.serviceWorker.ready; // Czekaj na rejestrację SW
        const existingSubscription = await registration.pushManager.getSubscription();

        if (existingSubscription) {
            console.log('Istniejąca subskrypcja push:', existingSubscription);
            // Możesz wysłać istniejącą subskrypcję ponownie do backendu, aby upewnić się, że jest aktualna
            await sendSubscriptionToBackend(existingSubscription);
            return;
        }

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.warn('Odmowa zgody na powiadomienia push.');
            return;
        }

        const subscribeOptions = {
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
        };

        const pushSubscription = await registration.pushManager.subscribe(subscribeOptions);
        console.log('Nowa subskrypcja push:', pushSubscription);

        await sendSubscriptionToBackend(pushSubscription);
        console.log('Subskrypcja push wysłana do backendu.');

    } catch (error) {
        console.error('Błąd subskrypcji push:', error);
    }
}

async function sendSubscriptionToBackend(subscription) {
    if (!currentUserId) {
        console.warn('Brak ID użytkownika, nie można wysłać subskrypcji do backendu.');
        return;
    }
    try {
        const response = await fetch(`${BASE_URL}/subscribe-push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: subscription, userId: currentUserId })
        });
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Błąd wysyłania subskrypcji do backendu:', errorData.message);
        } else {
            console.log('Subskrypcja push pomyślnie zapisana w backendzie.');
        }
    } catch (error) {
        console.error('Błąd sieciowy podczas wysyłania subskrypcji do backendu:', error);
    }
}


// ----- Inicjalizacja Aplikacji -----
document.addEventListener('DOMContentLoaded', async () => {
    container.classList.remove('hidden'); // Animate container on load

    // Pobierz publiczny klucz VAPID zaraz po załadowaniu DOM
    await getVapidPublicKey();

    // Rejestracja Service Workera
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/service-worker.js');
            console.log('Service Worker zarejestrowany!', registration);
        } catch (error) {
            console.error('Błąd rejestracji Service Workera:', error);
        }
    }

    const storedUserId = localStorage.getItem('userId');
    const storedUsername = localStorage.getItem('username');

    if (storedUserId && storedUsername) {
        showAppSection(storedUserId, storedUsername);
    } else {
        showAuthSection();
    }
});