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
    gameDuration: 300,
    totalRounds: 1,
    currentRoundNum: 1,
    scores: {} // { username: points }
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
const secretWordInput = document.getElementById('secretWordInput');
const setSecretBtn = document.getElementById('setSecretBtn');
const secretWordDisplay = document.getElementById('secretWordDisplay');

const gameDuration = document.getElementById('gameDuration');
const roundsCount = document.getElementById('roundsCount');
const openJoinBtn = document.getElementById('openJoinBtn');
const startGameBtn = document.getElementById('startGameBtn');
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const previewCount = document.getElementById('previewCount');
const previewList = document.getElementById('previewList');

const activeGameCard = document.getElementById('activeGameCard');
const gameTimer = document.getElementById('gameTimer');
const currentRound = document.getElementById('currentRound');
const totalRounds = document.getElementById('totalRounds');
const leaderboardList = document.getElementById('leaderboardList');
const secretDisplay = document.getElementById('secretDisplay');
const questionCard = document.getElementById('questionCard');
const currentAsker = document.getElementById('currentAsker');
const currentQuestion = document.getElementById('currentQuestion');
const answerSection = document.getElementById('answerSection');
const answerInput = document.getElementById('answerInput');
const quickYes = document.getElementById('quickYes');
const quickNo = document.getElementById('quickNo');
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

// Set Secret Word from Float
setSecretBtn.addEventListener('click', () => {
    const word = secretWordInput.value.trim();
    if (!word) {
        alert('الرجاء كتابة الكلمة السرية');
        return;
    }
    
    gameState.secretWord = word;
    secretWordInput.classList.add('hidden');
    setSecretBtn.classList.add('hidden');
    secretWordDisplay.classList.remove('hidden');
    secretWordDisplay.textContent = word;
});

// Quick Answer Buttons
quickYes.addEventListener('click', () => {
    sendAnswer('نعم');
});

quickNo.addEventListener('click', () => {
    sendAnswer('لا');
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
    if (gameState.participants.length === 0) {
        alert('لا يوجد مشاركون! انتظر حتى ينضم أحد');
        return;
    }
    
    gameState.isJoining = false;
    gameState.isGameActive = true;
    gameState.currentAskerIndex = -1;
    gameState.qanda = [];
    gameState.gameDuration = parseInt(gameDuration.value);
    gameState.totalRounds = parseInt(roundsCount.value);
    gameState.currentRoundNum = 1;
    gameState.scores = {};
    gameState.startTime = Date.now();
    
    // Initialize scores
    gameState.participants.forEach(p => {
        gameState.scores[p] = 0;
    });
    
    currentRound.textContent = gameState.currentRoundNum;
    totalRounds.textContent = gameState.totalRounds;
    
    secretWordFloat.style.display = 'block';
    activeGameCard.classList.remove('hidden');
    resultsCard.classList.add('hidden');
    questionCard.style.display = 'block';
    historyList.innerHTML = '<div class="empty-state">لا توجد أسئلة بعد</div>';
    
    step2.classList.add('hidden');
    updateParticipantsQueue();
    updateLeaderboard();
    
    gameState.client.say(gameState.channel, `🎮 بدأت اللعبة! الجولة 1/${gameState.totalRounds}`);
    
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
    
    // زيادة الـ index بواحد
    gameState.currentAskerIndex++;
    
    // إذا وصلنا لآخر شخص، نرجع للأول
    if (gameState.currentAskerIndex >= gameState.participants.length) {
        gameState.currentAskerIndex = 0;
    }
    
    const asker = gameState.participants[gameState.currentAskerIndex];
    
    currentAsker.textContent = asker;
    currentQuestion.textContent = 'في انتظار السؤال...';
    answerInput.value = '';
    answerSection.style.display = 'none';
    gameState.currentQuestion = null;
    
    gameState.client.say(gameState.channel, `❓ ${asker} اكتب السؤال عندك`);
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
        // Direct guess check - compare with secret word
        if (gameState.secretWord && msg.toLowerCase().trim() === gameState.secretWord.toLowerCase().trim()) {
            endGame(true, username);
            return;
        }
        
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
    }
}

function sendAnswer(answer) {
    if (!gameState.currentQuestion) return;
    
    gameState.currentQuestion.answer = answer;
    gameState.qanda.push(gameState.currentQuestion);
    
    gameState.client.say(gameState.channel, `${gameState.currentQuestion.asker}: ${gameState.currentQuestion.question} → ${answer}`);
    
    addToHistory(gameState.currentQuestion.asker, gameState.currentQuestion.question, answer);
    
    answerInput.value = '';
    selectNextAsker();
}

// Submit Answer
submitAnswerBtn.addEventListener('click', () => {
    const answer = answerInput.value.trim();
    
    if (!answer) {
        alert('الرجاء كتابة إجابة');
        return;
    }
    
    sendAnswer(answer);
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
    gameState.isGameActive = false;
    
    if (hasWinner && winner) {
        // Add point
        if (gameState.scores[winner] !== undefined) {
            gameState.scores[winner]++;
        }
        updateLeaderboard();
        gameState.client.say(gameState.channel, `🎉 ${winner} فاز!`);
        
        // Check if more rounds
        if (gameState.currentRoundNum < gameState.totalRounds) {
            setTimeout(() => {
                startNextRound();
            }, 3000);
        } else {
            showFinalResults();
        }
    } else {
        gameState.client.say(gameState.channel, `⏱️ انتهى الوقت`);
        
        if (gameState.currentRoundNum < gameState.totalRounds) {
            setTimeout(() => {
                startNextRound();
            }, 3000);
        } else {
            showFinalResults();
        }
    }
}
    function startNextRound() {
    gameState.currentRoundNum++;
    gameState.secretWord = '';
    gameState.currentAskerIndex = -1;
    gameState.qanda = [];
    gameState.currentQuestion = null;
    gameState.startTime = Date.now();
    
    currentRound.textContent = gameState.currentRoundNum;
    
    // Reset secret word input
    secretWordInput.value = '';
    secretWordInput.classList.remove('hidden');
    setSecretBtn.classList.remove('hidden');
    secretWordDisplay.classList.add('hidden');
    
    historyList.innerHTML = '<div class="empty-state">لا توجد أسئلة بعد</div>';
    
    gameState.isGameActive = true;
    gameState.client.say(gameState.channel, `🎮 الجولة ${gameState.currentRoundNum}/${gameState.totalRounds}`);
    
    startGameTimer();
    selectNextAsker();
}
    function showFinalResults() {
    activeGameCard.classList.add('hidden');
    resultsCard.classList.remove('hidden');
    
    // Find winner
    let maxScore = 0;
    let finalWinner = null;
    for (let player in gameState.scores) {
        if (gameState.scores[player] > maxScore) {
            maxScore = gameState.scores[player];
            finalWinner = player;
        }
    }
    
    revealedSecret.textContent = gameState.secretWord || 'غير محددة';
    
    if (finalWinner && maxScore > 0) {
        winnerSection.style.display = 'block';
        winnerName.textContent = `${finalWinner} (${maxScore} نقطة)`;
        gameState.client.say(gameState.channel, `👑 البطل: ${finalWinner} بـ ${maxScore} نقطة!`);
    } else {
        winnerSection.style.display = 'none';
    }
    
    totalQuestions.textContent = gameState.qanda.length;
    totalParticipants.textContent = gameState.participants.length;
    const duration = Math.floor((Date.now() - gameState.startTime) / 1000 / 60);
    gameDurationStat.textContent = `${duration} دقيقة`;
}
    function updateLeaderboard() {
    if (Object.keys(gameState.scores).length === 0) {
        leaderboardList.innerHTML = '<div class="empty-state">لا توجد نقاط بعد</div>';
        return;
    }
    
    const sorted = Object.entries(gameState.scores).sort((a, b) => b[1] - a[1]);
    
    leaderboardList.innerHTML = '';
    sorted.forEach(([player, score], index) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        
        let medal = '';
        if (index === 0) medal = '🥇';
        else if (index === 1) medal = '🥈';
        else if (index === 2) medal = '🥉';
        
        item.innerHTML = `
            <span class="rank">${medal || (index + 1)}</span>
            <span class="player-name">${player}</span>
            <span class="score">${score}</span>
        `;
        
        leaderboardList.appendChild(item);
    });
}

// New Game
newGameBtn.addEventListener('click', () => {
    resultsCard.classList.add('hidden');
    gameState.participants = [];
    gameState.isJoining = false;
    gameState.isGameActive = false;
    gameState.secretWord = '';
    
    secretWordFloat.style.display = 'none';
    secretWordInput.value = '';
    secretWordInput.classList.remove('hidden');
    setSecretBtn.classList.remove('hidden');
    secretWordDisplay.classList.add('hidden');
    
    step1.classList.remove('hidden');
    step2.classList.add('hidden');
    
    updatePreview();
    updateParticipantsQueue();
});

});
