// Upewnij się, że ten URL wskazuje na Twój backend.
// Podczas developmentu lokalnego:
const BASE_URL = 'https://moja-apka-4grosze-backend.onrender.com';
// Gdy hostujesz w chmurze, zmień na URL Twojego serwera backendowego (np. https://twoj-backend.onrender.com)


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
let lastMessageTimestamp = 0; // Będzie przechowywać timestamp ostatniej wiadomości
let fetchMessagesInterval = null; // Do przechowywania interwału odświeżania

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
    container.classList.add('hidden'); // Add hidden class for exit animation
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
        if (fetchMessagesInterval) {
            clearInterval(fetchMessagesInterval); // Zatrzymaj odświeżanie wiadomości
            fetchMessagesInterval = null;
        }
        container.classList.remove('hidden'); // Remove hidden class for entry animation
    }, 500); // Wait for exit animation to complete
}

function showAppSection(userId, username) {
    container.classList.add('hidden'); // Add hidden class for exit animation
    setTimeout(() => {
        authSection.style.display = 'none';
        appSection.style.display = 'block';
        currentUserDisplay.textContent = username;
        currentUserId = userId;
        currentUsername = username;
        localStorage.setItem('userId', userId);
        localStorage.setItem('username', username);
        showPanel('received-panel'); // Domyślnie pokazujemy panel odebranych
        fetchMessages(true); // Od razu pobierz wiadomości i ustaw interwał
        fetchAllUsers(); // Pobierz użytkowników do listy rozwijanej
        container.classList.remove('hidden'); // Remove hidden class for entry animation
    }, 500); // Wait for exit animation to complete
}

function displayMessage(element, message, isError = false) {
    element.textContent = message;
    element.className = isError ? 'error' : 'success'; // Ustaw klasę dla CSS
    setTimeout(() => { element.textContent = ''; element.className = ''; }, 3000); // Wiadomość znika po 3s
}

function formatDate(dateString) {
    const options = {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('pl-PL', options);
}

// ----- Powiadomienia przeglądarki -----

function requestNotificationPermission() {
    if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                console.log('Zezwolono na powiadomienia.');
            } else if (permission === 'denied') {
                console.warn('Odmówiono zgody na powiadomienia.');
            }
        });
    } else {
        console.warn('Twoja przeglądarka nie obsługuje powiadomień.');
    }
}

function sendBrowserNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body: body, icon: 'icon.png' }); // Dodaj ścieżkę do ikony, jeśli masz
    }
}

// ----- Obsługa Autoryzacji -----

loginBtn.addEventListener('click', async () => {
    const username = authUsernameInput.value.trim();
    const password = authPasswordInput.value.trim();
    if (!username || !password) {
        displayMessage(authMessage, 'Wszystkie pola są wymagane.', true);
        return;
    }

    loginBtn.disabled = true; // Disable button to prevent multiple clicks
    try {
        const response = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (response.ok) {
            displayMessage(authMessage, data.message);
            showAppSection(data.userId, data.username);
            requestNotificationPermission(); // Poproś o zgodę po zalogowaniu
        } else {
            displayMessage(authMessage, data.message, true);
        }
    } catch (error) {
        displayMessage(authMessage, 'Błąd połączenia z serwerem.', true);
        console.error('Login error:', error);
    } finally {
        loginBtn.disabled = false;
    }
});

registerBtn.addEventListener('click', async () => {
    const username = authUsernameInput.value.trim();
    const password = authPasswordInput.value.trim();
    if (!username || !password) {
        displayMessage(authMessage, 'Wszystkie pola są wymagane.', true);
        return;
    }

    registerBtn.disabled = true; // Disable button
    try {
        const response = await fetch(`${BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (response.ok) {
            displayMessage(authMessage, data.message);
            setTimeout(() => loginBtn.click(), 1500); // Automatycznie zaloguj po chwili
        } else {
            displayMessage(authMessage, data.message, true);
        }
    } catch (error) {
        displayMessage(authMessage, 'Błąd połączenia z serwerem.', true);
        console.error('Register error:', error);
    } finally {
        registerBtn.disabled = false;
    }
});

logoutBtn.addEventListener('click', () => {
    showAuthSection();
});

// ----- Obsługa wiadomości i Polling -----

async function fetchMessages(initialLoad = false) {
    if (!currentUserId) return;

    if (initialLoad) { // Tylko przy pierwszym ładowaniu
        messagesList.innerHTML = '<li>Ładowanie wiadomości... <span class="loading-spinner"></span></li>';
        lastMessageTimestamp = 0; // Resetuj timestamp przy pierwszym ładowaniu
    }

    try {
        const response = await fetch(`${BASE_URL}/messages/${currentUserId}?since=${lastMessageTimestamp}`);
        const messages = await response.json();

        if (initialLoad) {
            messagesList.innerHTML = ''; // Wyczyść listę tylko przy pierwszym ładowaniu
        }

        if (messages.length === 0 && initialLoad) {
            messagesList.innerHTML = '<li>Brak odebranych wiadomości.</li>';
        } else if (messages.length === 0 && !initialLoad) {
            // Brak nowych wiadomości, nic nie rób
            return;
        }

        let newMessagesReceived = false;
        messages.forEach(msg => {
            const msgTimestamp = new Date(msg.timestamp).getTime();
            if (msgTimestamp > lastMessageTimestamp) { // Sprawdź, czy to nowa wiadomość
                const li = document.createElement('li');
                li.innerHTML = `<strong>Od: ${msg.sender.username}</strong><br>${msg.content}<span class="timestamp">${formatDate(msg.timestamp)}</span>`;
                messagesList.prepend(li); // Dodaj na początek listy (najnowsze na górze)
                newMessagesReceived = true;
            }
            if (msgTimestamp > lastMessageTimestamp) {
                lastMessageTimestamp = msgTimestamp; // Zaktualizuj timestamp
            }
        });

        if (newMessagesReceived && !initialLoad) {
            sendBrowserNotification('Nowa wiadomość!', 'Masz nową wiadomość w aplikacji 4 Grosze.');
            // Opcjonalnie: odtwórz krótki dźwięk
            // const audio = new Audio('notification.mp3'); // Musisz mieć plik audio
            // audio.play();
        }

        // Usuń stare "ładowanie wiadomości" jeśli były
        const loadingLi = messagesList.querySelector('li .loading-spinner');
        if (loadingLi && messagesList.childElementCount > 1) { // Sprawdź, czy są inne wiadomości
             loadingLi.parentElement.remove();
        }


    } catch (error) {
        if (initialLoad) {
            messagesList.innerHTML = '<li>Błąd ładowania wiadomości. Spróbuj odświeżyć.</li>';
        }
        console.error('Error fetching messages:', error);
    }

    // Uruchom interwał odświeżania po pierwszym załadowaniu
    if (initialLoad && !fetchMessagesInterval) {
        fetchMessagesInterval = setInterval(() => fetchMessages(false), 5000); // Odświeżaj co 5 sekund
    }
}

async function fetchAllUsers() {
    receiverSelect.innerHTML = '<option value="">Wybierz odbiorcę</option>'; // Wyczyść i dodaj domyślną opcję
    try {
        const response = await fetch(`${BASE_URL}/users`);
        const users = await response.json();

        users.forEach(user => {
            if (user.username !== currentUsername) { // Nie dodawaj siebie do listy odbiorców
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
        displayMessage(sendMessageStatus, 'Wybierz odbiorcę.', true);
        return;
    }
    if (!content) {
        displayMessage(sendMessageStatus, 'Wiadomość nie może być pusta.', true);
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
            displayMessage(sendMessageStatus, data.message);
            messageContentInput.value = '';
            // Opcjonalnie: fetchMessages() aby odświeżyć 'odebrane' jeśli coś wysłaliśmy (choć to wysłane)
        } else {
            displayMessage(sendMessageStatus, data.message, true);
        }
    } catch (error) {
        displayMessage(sendMessageStatus, 'Błąd wysyłania wiadomości. Spróbuj ponownie.', true);
        console.error('Send message error:', error);
    } finally {
        sendMessageBtn.disabled = false;
    }
});


// ----- Obsługa Przełączania Paneli -----

receivedTab.addEventListener('click', () => {
    showPanel('received-panel');
    fetchMessages(true); // Wymuś pełne odświeżenie i reset timestampa
});

sendTab.addEventListener('click', () => {
    showPanel('send-panel');
    fetchAllUsers();
});

refreshMessagesBtn.addEventListener('click', () => fetchMessages(true));


// ----- Inicjalizacja Aplikacji -----
// Animacja wejścia kontenera
document.addEventListener('DOMContentLoaded', () => {
    container.classList.remove('hidden');
});

const storedUserId = localStorage.getItem('userId');
const storedUsername = localStorage.getItem('username');

if (storedUserId && storedUsername) {
    showAppSection(storedUserId, storedUsername);
} else {
    showAuthSection();
}