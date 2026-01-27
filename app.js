// Twitch OAuth Configuration
const TWITCH_CONFIG = {
    clientId: '4yn6hmhiphc2is85h9dhphmfw0xswc',
    redirectUri: window.location.origin + window.location.pathname,
    scopes: ['chat:read', 'chat:edit']
};

// Game State
const gameState = {
    isConnected: false,
    client: null,
    channel: '',
    isJoining: false,
    isGameActive: false,
    secretWord: '',
    participants: [],
    currentAskerIndex: -1,
    currentQuestion: null,
    qanda: [],
    startTime: null,
    gameTimer: null,
    joinTimer: null,
    gameDuration: 300
};

document.addEventListener('DOMContentLoaded', function() {

// DOM Elements
const setupSection = document.getElementById('setupSection');
const gameSection = document.getElementById('gameSection');
const twitchLoginBtn = document.getElementById('twitchLoginBtn');
const connectedChannel = document.getElementById('connectedChannel');
const disconnectBtn = document.getElementById('disconnectBtn');

const secretWordFloat = document.getElementById('secretWordFloat');
const secretToggle = document.getElementById('secretToggle');
const secretFloatContent = document.getElementById('secretFloatContent');
const secretWordDisplay = document.getElementById('secretWordDisplay');

const secretWord = document.getElementById('secretWord');
const gameDuration = document.getElementById('gameDuration');
const openJoinBtn = document.getElementById('openJoinBtn');
const startGameBtn = document.getElementById('startGameBtn');
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const previewCount = document.getElementById('previewCount');
const previewList = document.getElementById('previewList');

const activeGameCard = document.getElementById('activeGameCard');
const gameTimer = document.getElementById('gameTimer');
const secretDisplay = document.getElementById('secretDisplay');
const questionCard = document.getElementById('questionCard');
const currentAsker = document.getElementById('currentAsker');
const currentQuestion = document.getElementById('currentQuestion');
const answerSection = document.getElementById('answerSection');
const answerInput = document.getElementById('answerInput');
const submitAnswerBtn = document.getElementById('submitAnswerBtn');
const participantsQueue = document.getElementById('participantsQueue');
const queueCount = document.getElementById('queueCount');
const historyList = document.getElementById('historyList');
const endGameBtn = document.getElementById('endGameBtn');

const resultsCard = document.getElementById('resultsCard');
const revealedSecret = document.getElementById('revealedSecret');
const winnerSection = document.getElementById('winnerSection');
const winnerName = document.getElementById('winnerName');
const totalQuestions = document.getElementById('totalQuestions');
const totalParticipants = document.getElementById('totalParticipants');
const gameDurationStat = document.getElementById('gameDurationStat');
const newGameBtn = document.getElementById('newGameBtn');

// OAuth Login
twitchLoginBtn.addEventListener('click', () => {
    if (!TWITCH_CONFIG.clientId || TWITCH_CONFIG.clientId === 'ضع_Client_ID_هنا') {
        alert('⚠️ خطأ: Client ID غير مُعرّف!\n\nالرجاء:\n1. افتح ملف app-who.js\n2. في السطر 3 استبدل "ضع_Client_ID_هنا" بـ Client ID الخاص بك');
        return;
    }
    
    const authUrl = `https://id.twitch.tv/oauth2/authorize?` +
        `client_id=${TWITCH_CONFIG.clientId}&` +
        `redirect_uri=${encodeURIComponent(TWITCH_CONFIG.redirectUri)}&` +
        `response_type=token&` +
        `scope=${TWITCH_CONFIG.scopes.join('+')}`;
    
    window.location.href = authUrl;
});

// Handle OAuth Callback
function handleOAuthCallback() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    
    if (accessToken) {
        fetch('https://api.twitch.tv/helix/users', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Client-Id': TWITCH_CONFIG.clientId
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.data && data.data[0]) {
                const username = data.data[0].login;
                connectWithOAuth(username, accessToken);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('حدث خطأ في تسجيل الدخول');
        });
        
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

async function connectWithOAuth(username, token) {
    try {
        const client = new tmi.Client({
            options: { debug: false },
            identity: {
                username: username,
                password: `oauth:${token}`
            },
            channels: [username]
        });
        
        client.on('message', handleMessage);
        client.on('connected', () => {
            gameState.isConnected = true;
            gameState.channel = username;
            gameState.client = client;
            
            setupSection.classList.add('hidden');
            gameSection.classList.remove('hidden');
            connectedChannel.textContent = username;
        });
        
        client.on('disconnected', () => {
            gameState.isConnected = false;
            handleDisconnect();
        });
        
        await client.connect();
    } catch (error) {
        console.error('Connection error:', error);
        alert('فشل الاتصال');
    }
}

if (window.location.hash.includes('access_token')) {
    handleOAuthCallback();
}

// Toggle Secret Word Float
secretToggle.addEventListener('click', () => {
    secretWordFloat.classList.toggle('collapsed');
    secretToggle.textContent = secretWordFloat.classList.contains('collapsed') ? '+' : '−';
});

// Disconnect
disconnectBtn.addEventListener('click', () => {
    if (gameState.client) {
        gameState.client.disconnect();
    }
    handleDisconnect();
});

function handleDisconnect() {
    gameState.isConnected = false;
    gameState.client = null;
    gameState.channel = '';
    
    setupSection.classList.remove('hidden');
    gameSection.classList.add('hidden');
    activeGameCard.classList.add('hidden');
    resultsCard.classList.add('hidden');
}

// Step 1: Open Join
openJoinBtn.addEventListener('click', () => {
    gameState.isJoining = true;
    gameState.participants = [];
    
    step1.classList.add('hidden');
    step2.classList.remove('hidden');
    
    gameState.client.say(gameState.channel, `📝 اكتب "دخول" للمشاركة`);
    
    updatePreview();
});

function updatePreview() {
    previewCount.textContent = gameState.participants.length;
    
    if (gameState.participants.length === 0) {
        previewList.innerHTML = '<div class="empty-state">في انتظار المشاركين...</div>';
        return;
    }
    
    previewList.innerHTML = '';
    gameState.participants.forEach(p => {
        const badge = document.createElement('span');
        badge.className = 'participant-badge';
        badge.textContent = p;
        previewList.appendChild(badge);
    });
}

// Step 2: Start Game
startGameBtn.addEventListener('click', () => {
    const word = secretWord.value.trim();
    
    if (!word) {
        alert('الرجاء إدخال الكلمة السرية');
        return;
    }
    
    if (gameState.participants.length === 0) {
        alert('لا يوجد مشاركون! انتظر حتى ينضم أحد');
        return;
    }
    
    gameState.secretWord = word;
    gameState.isJoining = false;
    gameState.isGameActive = true;
    gameState.currentAskerIndex = -1;
    gameState.qanda = [];
    gameState.gameDuration = parseInt(gameDuration.value);
    gameState.startTime = Date.now();
    
    secretWordDisplay.textContent = word;
    secretWordFloat.style.display = 'block';
    activeGameCard.classList.remove('hidden');
    resultsCard.classList.add('hidden');
    questionCard.style.display = 'block';
    historyList.innerHTML = '<div class="empty-state">لا توجد أسئلة بعد</div>';
    
    step2.classList.add('hidden');
    updateParticipantsQueue();
    
    gameState.client.say(gameState.channel, `🎮 بدأت اللعبة!`);
    
    startGameTimer();
    selectNextAsker();
});

function startGameTimer() {
    const updateTimer = () => {
        const elapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
        const remaining = gameState.gameDuration - elapsed;
        
        if (remaining <= 0) {
            endGame(false);
            return;
        }
        
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        gameTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };
    
    updateTimer();
    gameState.gameTimer = setInterval(updateTimer, 1000);
}

function selectNextAsker() {
    if (gameState.participants.length === 0) {
        endGame(false);
        return;
    }
    
    gameState.currentAskerIndex = (gameState.currentAskerIndex + 1) % gameState.participants.length;
    const asker = gameState.participants[gameState.currentAskerIndex];
    
    currentAsker.textContent = asker;
    currentQuestion.textContent = 'في انتظار السؤال...';
    answerInput.value = '';
    answerSection.style.display = 'none';
    gameState.currentQuestion = null;
    
    gameState.client.say(gameState.channel, `❓ ${asker}`);
}

// Handle Messages
function handleMessage(channel, tags, message, self) {
    if (self) return;
    
    const username = tags['display-name'] || tags.username;
    const msg = message.trim();
    
    // Join phase
    if (gameState.isJoining && !gameState.isGameActive && (msg === 'دخول' || msg.toLowerCase() === 'join')) {
        if (!gameState.participants.includes(username)) {
            gameState.participants.push(username);
            updatePreview(); // Update preview in step2
        }
        return;
    }
    
    // Question phase
    if (gameState.isGameActive) {
        const currentAskerName = gameState.participants[gameState.currentAskerIndex];
        
        // Question from current asker
        if (username === currentAskerName && !gameState.currentQuestion) {
            gameState.currentQuestion = {
                asker: username,
                question: msg,
                answer: null
            };
            currentQuestion.textContent = msg;
            answerSection.style.display = 'flex';
            return;
        }
        
        // Guess attempt
        if (msg.startsWith('تخمين:') || msg.startsWith('خمن:')) {
            const guess = msg.replace(/^(تخمين:|خمن:)\s*/i, '').trim();
            if (guess.toLowerCase() === gameState.secretWord.toLowerCase()) {
                endGame(true, username);
            }
        }
    }
}

// Submit Answer
submitAnswerBtn.addEventListener('click', () => {
    const answer = answerInput.value.trim();
    
    if (!answer) {
        alert('الرجاء كتابة إجابة');
        return;
    }
    
    if (!gameState.currentQuestion) return;
    
    gameState.currentQuestion.answer = answer;
    gameState.qanda.push(gameState.currentQuestion);
    
    gameState.client.say(gameState.channel, `${gameState.currentQuestion.asker}: ${gameState.currentQuestion.question} → ${answer}`);
    
    addToHistory(gameState.currentQuestion.asker, gameState.currentQuestion.question, answer);
    
    selectNextAsker();
});

function addToHistory(asker, question, answer) {
    if (historyList.querySelector('.empty-state')) {
        historyList.innerHTML = '';
    }
    
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
        <div class="history-asker">👤 ${asker}</div>
        <div class="history-question">❓ ${question}</div>
        <div class="history-answer">✅ ${answer}</div>
    `;
    historyList.appendChild(item);
    historyList.scrollTop = historyList.scrollHeight;
}

function updateParticipantsQueue() {
    queueCount.textContent = gameState.participants.length;
    
    if (gameState.participants.length === 0) {
        participantsQueue.innerHTML = '<div class="empty-state">لا يوجد مشاركون</div>';
        return;
    }
    
    participantsQueue.innerHTML = '';
    gameState.participants.forEach((p, i) => {
        const badge = document.createElement('div');
        badge.className = 'participant-badge';
        if (i === gameState.currentAskerIndex) {
            badge.classList.add('active');
        }
        badge.textContent = p;
        participantsQueue.appendChild(badge);
    });
}

// End Game
endGameBtn.addEventListener('click', () => {
    if (confirm('هل تريد إنهاء اللعبة؟')) {
        endGame(false);
    }
});

function endGame(hasWinner, winner = null) {
    clearInterval(gameState.gameTimer);
    clearInterval(gameState.joinTimer);
    gameState.isGameActive = false;
    gameState.isJoining = false;
    
    const duration = Math.floor((Date.now() - (gameState.startTime || Date.now())) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    
    activeGameCard.classList.add('hidden');
    resultsCard.classList.remove('hidden');
    
    revealedSecret.textContent = gameState.secretWord;
    totalQuestions.textContent = gameState.qanda.length;
    totalParticipants.textContent = gameState.participants.length;
    gameDurationStat.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    if (hasWinner && winner) {
        winnerSection.style.display = 'block';
        winnerName.textContent = winner;
        gameState.client.say(gameState.channel, `🎉 ${winner} فاز!`);
    } else {
        winnerSection.style.display = 'none';
        gameState.client.say(gameState.channel, `⏱️ انتهى الوقت`);
    }
}

// New Game
newGameBtn.addEventListener('click', () => {
    resultsCard.classList.add('hidden');
    secretWord.value = '';
    gameState.participants = [];
    gameState.isJoining = false;
    gameState.isGameActive = false;
    secretWordFloat.style.display = 'none';
    
    step1.classList.remove('hidden');
    step2.classList.add('hidden');
    
    updatePreview();
    updateParticipantsQueue();
});

});
