// Upewnij się, że ten URL wskazuje na Twój backend.
// Podczas developmentu lokalnego:
const BASE_URL = 'http://localhost:3000';
// Gdy hostujesz w chmurze, zmień na URL Twojego serwera backendowego (np. https://twoj-backend.render.com)


// Elementy DOM
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

// ----- Funkcje pomocnicze -----

function showPanel(panelId) {
    const panels = document.querySelectorAll('.panel');
    panels.forEach(panel => panel.classList.remove('active-panel'));
    document.getElementById(panelId).classList.add('active-panel');

    // Aktualizuj aktywne zakładki
    const tabs = document.querySelectorAll('.tabs button');
    tabs.forEach(tab => tab.classList.remove('active'));
    if (panelId === 'received-panel') {
        receivedTab.classList.add('active');
    } else if (panelId === 'send-panel') {
        sendTab.classList.add('active');
    }
}

function showAuthSection() {
    authSection.style.display = 'block';
    appSection.style.display = 'none';
    authMessage.textContent = '';
    authUsernameInput.value = '';
    authPasswordInput.value = '';
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    currentUserId = null;
    currentUsername = null;
}

function showAppSection(userId, username) {
    authSection.style.display = 'none';
    appSection.style.display = 'block';
    currentUserDisplay.textContent = username;
    currentUserId = userId;
    currentUsername = username;
    localStorage.setItem('userId', userId);
    localStorage.setItem('username', username);
    showPanel('received-panel'); // Domyślnie pokazujemy panel odebranych
    fetchMessages(); // Od razu pobierz wiadomości
    fetchAllUsers(); // Pobierz użytkowników do listy rozwijanej
}

function displayMessage(element, message, isError = false) {
    element.textContent = message;
    element.style.color = isError ? 'red' : 'green';
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
        displayMessage(authMessage, 'Wszystkie pola są wymagane.', true);
        return;
    }

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
        } else {
            displayMessage(authMessage, data.message, true);
        }
    } catch (error) {
        displayMessage(authMessage, 'Błąd połączenia z serwerem.', true);
        console.error('Login error:', error);
    }
});

registerBtn.addEventListener('click', async () => {
    const username = authUsernameInput.value.trim();
    const password = authPasswordInput.value.trim();
    if (!username || !password) {
        displayMessage(authMessage, 'Wszystkie pola są wymagane.', true);
        return;
    }

    try {
        const response = await fetch(`${BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (response.ok) {
            displayMessage(authMessage, data.message);
            // Po rejestracji automatycznie zaloguj
            setTimeout(() => loginBtn.click(), 1000);
        } else {
            displayMessage(authMessage, data.message, true);
        }
    } catch (error) {
        displayMessage(authMessage, 'Błąd połączenia z serwerem.', true);
        console.error('Register error:', error);
    }
});

logoutBtn.addEventListener('click', () => {
    showAuthSection();
});

// ----- Obsługa wiadomości -----

async function fetchMessages() {
    if (!currentUserId) return;
    messagesList.innerHTML = '<li>Ładowanie wiadomości...</li>';
    try {
        const response = await fetch(`${BASE_URL}/messages/${currentUserId}`);
        const messages = await response.json();

        messagesList.innerHTML = ''; // Wyczyść listę

        if (messages.length === 0) {
            messagesList.innerHTML = '<li>Brak odebranych wiadomości.</li>';
            return;
        }

        messages.forEach(msg => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>Od: ${msg.sender.username}</strong><br>${msg.content}<span class="timestamp">${formatDate(msg.timestamp)}</span>`;
            messagesList.appendChild(li);
        });
    } catch (error) {
        messagesList.innerHTML = '<li>Błąd ładowania wiadomości. Spróbuj odświeżyć.</li>';
        console.error('Error fetching messages:', error);
    }
}

async function fetchAllUsers() {
    receiverSelect.innerHTML = '<option value="">Wybierz odbiorcę</option>'; // Wyczyść i dodaj domyślną opcję
    try {
        const response = await fetch(`${BASE_URL}/users`);
        const users = await response.json();

        users.forEach(user => {
            // Nie dodawaj siebie do listy odbiorców
            if (user.username !== currentUsername) {
                const option = document.createElement('option');
                option.value = user.username; // Wysyłamy username do backendu
                option.textContent = user.username;
                receiverSelect.appendChild(option);
            }
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        // Możesz dodać wiadomość dla użytkownika, jeśli lista się nie załadowała
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

    sendMessageBtn.disabled = true; // Zablokuj przycisk, aby uniknąć podwójnego wysłania
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
            messageContentInput.value = ''; // Wyczyść pole wiadomości
            // Opcjonalnie: odśwież odebrane wiadomości po wysłaniu, jeśli chcesz zobaczyć je w 'wysłanych' (ale w tej apce tylko odebrane)
        } else {
            displayMessage(sendMessageStatus, data.message, true);
        }
    } catch (error) {
        displayMessage(sendMessageStatus, 'Błąd wysyłania wiadomości. Spróbuj ponownie.', true);
        console.error('Send message error:', error);
    } finally {
        sendMessageBtn.disabled = false; // Odblokuj przycisk
    }
});


// ----- Obsługa Przełączania Paneli -----

receivedTab.addEventListener('click', () => {
    showPanel('received-panel');
    fetchMessages(); // Odśwież wiadomości przy przełączeniu na panel
});

sendTab.addEventListener('click', () => {
    showPanel('send-panel');
    fetchAllUsers(); // Odśwież listę użytkowników przy przełączeniu na panel
});

refreshMessagesBtn.addEventListener('click', fetchMessages);


// ----- Inicjalizacja Aplikacji -----
// Sprawdź, czy użytkownik jest już zalogowany (dzięki localStorage)
const storedUserId = localStorage.getItem('userId');
const storedUsername = localStorage.getItem('username');

if (storedUserId && storedUsername) {
    showAppSection(storedUserId, storedUsername);
} else {
    showAuthSection();
}