// Upewnij się, że ten URL wskazuje na Twój backend.
const BASE_URL = 'https://moja-apka-4grosze-backend.onrender.com'; // ZMIANA: Potwierdź swój URL z Render.com!


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
let publicVapidKey = null;
// ... (istniejące zmienne) ...
let searchUsersTimeout = null; // NOWOŚĆ: do opóźniania wyszukiwania użytkowników

// NOWOŚĆ: Funkcja do pobierania tokenu JWT
function getToken() {
    return localStorage.getItem('jwtToken');
}

// NOWOŚĆ: Funkcja do dodawania tokenu do nagłówków
function getAuthHeaders() {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` // Dodajemy nagłówek autoryzacji
    };
}

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

// NOWOŚĆ: Funkcja do tworzenia elementu input dla wyszukiwania użytkowników
function createSearchInput() {
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.id = 'receiver-search-input';
    searchInput.placeholder = 'Szukaj odbiorcy...';
    return searchInput;
}

// NOWOŚĆ: Funkcja do filtrowania listy odbiorców
async function filterReceivers(searchTerm = '') {
    receiverSelect.innerHTML = '<option value="">Wybierz odbiorcę</option>'; // Wyczyść i dodaj domyślną opcję
    try {
        const response = await fetch(`${BASE_URL}/users`, {
            headers: getAuthHeaders()
        });
        if (response.status === 401 || response.status === 403) {
            displayStatusMessage(authMessage, 'Sesja wygasła. Zaloguj się ponownie.', true);
            showAuthSection();
            return;
        }

        const users = await response.json();
        const lowerCaseSearchTerm = searchTerm.toLowerCase();

        users.forEach(user => {
            if (user.username !== currentUsername && user.username.toLowerCase().includes(lowerCaseSearchTerm)) {
                const option = document.createElement('option');
                option.value = user.username;
                option.textContent = user.username;
                receiverSelect.appendChild(option);
            }
        });

        if (receiverSelect.options.length === 1 && searchTerm !== '') { // Jeśli tylko "Wybierz odbiorcę" i coś szukano
             const noResultsOption = document.createElement('option');
             noResultsOption.value = '';
             noResultsOption.textContent = 'Brak pasujących użytkowników.';
             noResultsOption.disabled = true; // Zrób ją nieaktywną
             receiverSelect.appendChild(noResultsOption);
        }

    } catch (error) {
        console.error('Error fetching users:', error);
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
        localStorage.removeItem('jwtToken'); // ZMIANA: Usuwamy też token
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
        fetchMessages();
        fetchAllUsers();
        subscribeUserToPush(); // Upewnij się, że subskrybujemy powiadomienia po zalogowaniu
        container.classList.remove('hidden');
    }, 600);
}

function displayStatusMessage(element, message, isError = false) {
    element.textContent = message;
    element.className = isError ? 'error' : 'success';
    setTimeout(() => { element.textContent = ''; element.className = ''; }, 3000);
}

function formatDate(dateString) {
    const messageDate = new Date(dateString);
    const now = new Date();

    const diffSeconds = Math.floor((now.getTime() - messageDate.getTime()) / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) {
        return "teraz";
    } else if (diffMinutes < 60) {
        return `${diffMinutes} min temu`;
    } else if (diffHours < 24) {
        return `${diffHours} godz. temu`;
    } else if (diffDays === 1) {
        return `Wczoraj o ${messageDate.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
        // Nazwa dnia tygodnia
        const dayOfWeek = messageDate.toLocaleDateString('pl-PL', { weekday: 'long' });
        return `${dayOfWeek} o ${messageDate.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
        // Pełna data dla starszych wiadomości
        const options = { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return messageDate.toLocaleDateString('pl-PL', options);
    }
}

// ----- Powiadomienia push (bez zmian, ale teraz wymagają tokena do subskrypcji) -----

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
        const registration = await navigator.serviceWorker.ready;
        const existingSubscription = await registration.pushManager.getSubscription();

        if (existingSubscription) {
            console.log('Istniejąca subskrypcja push:', existingSubscription);
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
            headers: getAuthHeaders(), // ZMIANA: Używamy nagłówka autoryzacji
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


// ----- Obsługa Autoryzacji (ZMIANA: Zapis i użycie tokenu) -----

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
            // ZMIANA: Zapisujemy token JWT
            localStorage.setItem('jwtToken', data.token);
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

// ----- Obsługa wiadomości (ZMIANA: Użycie tokenu w żądaniach) -----

async function fetchMessages() {
    if (!currentUserId) return;

    messagesList.innerHTML = '<li>Ładowanie wiadomości... <span class="loading-spinner"></span></li>';

    try {
        const response = await fetch(`${BASE_URL}/messages/${currentUserId}`, {
            headers: getAuthHeaders()
        });
        if (response.status === 401 || response.status === 403) {
            displayStatusMessage(authMessage, 'Sesja wygasła. Zaloguj się ponownie.', true);
            showAuthSection();
            return;
        }

        const messages = await response.json();

        messagesList.innerHTML = ''; // Wyczyść listę przed dodaniem

        if (messages.length === 0) {
            messagesList.innerHTML = '<li class="empty-list-message">Brak odebranych wiadomości.</li>'; // NOWOŚĆ: Komunikat o pustej liście
            return;
        }

        messages.forEach(msg => {
            const li = document.createElement('li');
            li.classList.add('message-bubble'); // Dodaj podstawową klasę dymka

            // Sprawdź, czy wiadomość została wysłana przez bieżącego użytkownika
            const isSentByCurrentUser = String(msg.sender._id) === String(currentUserId);

            if (isSentByCurrentUser) {
                li.classList.add('sent');
                // Jeśli to moja wiadomość, nie wyświetlaj "Od: Ja", tylko samą treść
                li.innerHTML = `${msg.content}<span class="timestamp">${formatDate(msg.timestamp)}</span>`;
            } else {
                li.classList.add('received');
                // Jeśli to wiadomość od kogoś innego, wyświetl nadawcę
                li.innerHTML = `<strong>${msg.sender.username}</strong><br>${msg.content}<span class="timestamp">${formatDate(msg.timestamp)}</span>`;
            }

            messagesList.appendChild(li); // Dodaj na koniec listy (domyślny przepływ)
        });

        // NOWOŚĆ: Przewiń listę wiadomości do samego dołu po załadowaniu
        messagesList.scrollTop = messagesList.scrollHeight;

    } catch (error) {
        messagesList.innerHTML = '<li class="error-message">Błąd ładowania wiadomości. Spróbuj odświeżyć.</li>'; // NOWOŚĆ: Komunikat o błędzie
        console.error('Error fetching messages:', error);
    }
}

async function fetchAllUsers() {
    // Sprawdź, czy pole wyszukiwania już istnieje. Jeśli nie, stwórz je i dodaj przed selectem.
    let receiverSearchInput = document.getElementById('receiver-search-input');
    if (!receiverSearchInput) {
        receiverSearchInput = createSearchInput();
        receiverSelect.parentNode.insertBefore(receiverSearchInput, receiverSelect);

        // Dodaj event listener do wyszukiwania
        receiverSearchInput.addEventListener('input', (event) => {
            clearTimeout(searchUsersTimeout);
            searchUsersTimeout = setTimeout(() => {
                filterReceivers(event.target.value);
            }, 300); // Opóźnienie 300ms przed rozpoczęciem wyszukiwania
        });
    }

    // Wywołaj filtrowanie bez terminu, aby załadować wszystkich użytkowników na start
    await filterReceivers();
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
        // ZMIANA: Używamy nagłówka autoryzacji
        const response = await fetch(`${BASE_URL}/send-message`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                // ZMIANA: senderId nie jest już wysyłany z frontendu, bo jest pobierany z tokenu
                receiverUsername: receiverUsername,
                content: content
            })
        });
        // ZMIANA: Obsługa błędu 401/403
        if (response.status === 401 || response.status === 403) {
            displayStatusMessage(authMessage, 'Sesja wygasła. Zaloguj się ponownie.', true);
            showAuthSection();
            return;
        }

        const data = await response.json();
        if (response.ok) {
            displayStatusMessage(sendMessageStatus, data.message);
            messageContentInput.value = '';
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
    fetchMessages();
});

sendTab.addEventListener('click', () => {
    showPanel('send-panel');
    fetchAllUsers();
});

refreshMessagesBtn.addEventListener('click', fetchMessages);


// ----- Inicjalizacja Aplikacji -----
document.addEventListener('DOMContentLoaded', async () => {
    container.classList.remove('hidden');

    await getVapidPublicKey(); // Pobierz publiczny klucz VAPID przed rejestracją SW

    // Rejestracja Service Workera
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/service-worker.js');
            console.log('Service Worker zarejestrowany!', registration);
        } catch (error) {
            console.error('Błąd rejestracji Service Workera:', error);
        }
    }

    // ZMIANA: Sprawdź token JWT zamiast tylko userId
    const storedToken = getToken();
    const storedUserId = localStorage.getItem('userId');
    const storedUsername = localStorage.getItem('username');

    // Uproszczona walidacja: Sprawdź, czy token istnieje i czy są podstawowe dane
    if (storedToken && storedUserId && storedUsername) {
        // Można dodać tutaj bardziej zaawansowaną walidację tokenu, np. wysyłając go do backendu
        // lub dekodując (bez weryfikacji podpisu) po stronie klienta, aby sprawdzić datę ważności.
        // Na razie zakładamy, że jeśli token istnieje, jest w miarę aktualny.
        showAppSection(storedUserId, storedUsername);
    } else {
        showAuthSection();
    }
// NOWOŚĆ: Wysyłanie wiadomości po naciśnięciu Enter w polu textarea
messageContentInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) { // Shift+Enter dla nowej linii, sam Enter do wysyłania
        event.preventDefault(); // Zapobiegaj domyślnej akcji (np. nowa linia)
        sendMessageBtn.click(); // Symuluj kliknięcie przycisku wysyłania
    }
});

// NOWOŚĆ: Automatyczne rozszerzanie textarea
messageContentInput.addEventListener('input', function() {
    this.style.height = 'auto'; // Resetuj wysokość
    this.style.height = (this.scrollHeight) + 'px'; // Ustaw wysokość na podstawie scrollHeight
});
});