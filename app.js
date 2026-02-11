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
    questionTimer: null,
    gameDuration: 300,
    totalRounds: 1,
    currentRoundNum: 1,
    scores: {},
    questionTimeLimit: 20, // 20 seconds per question
    
    // Team System
    gameMode: 'solo', // 'solo' or 'teams'
    teams: {
        blue: [],
        red: []
    },
    teamScores: {
        blue: 0,
        red: 0
    },
    currentTeam: 'blue',
    teamTurnIndex: {
        blue: 0,
        red: 0
    }
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
const gameMode = document.getElementById('gameMode');
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
const leaderboardToggle = document.getElementById('leaderboardToggle');
const leaderboardCard = document.getElementById('leaderboardCard');
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
const skipInactiveBtn = document.getElementById('skipInactiveBtn');
const toggleKickMode = document.getElementById('toggleKickMode');

let kickModeActive = false;
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

// Toggle Leaderboard
leaderboardToggle.addEventListener('click', () => {
    leaderboardCard.classList.toggle('hidden');
    questionCard.classList.toggle('hidden');
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
    gameState.currentAskerIndex = -1;
    gameState.qanda = [];
    gameState.gameDuration = parseInt(gameDuration.value);
    gameState.totalRounds = parseInt(roundsCount.value);
    gameState.currentRoundNum = 1;
    gameState.gameMode = gameMode.value; // Get selected game mode
    gameState.scores = {};
    
    // Initialize based on game mode
    if (gameState.gameMode === 'teams') {
        // Divide into teams
        divideIntoTeams();
        
        // Initialize team scores
        gameState.teamScores.blue = 0;
        gameState.teamScores.red = 0;
        
        // Show teams screen before secret word
        showTeamsScreen();
        return; // Will continue after teams screen
    } else {
        // Solo mode - Initialize individual scores
        gameState.participants.forEach(p => {
            gameState.scores[p] = 0;
        });
    }
    
    currentRound.textContent = gameState.currentRoundNum;
    totalRounds.textContent = gameState.totalRounds;
    
    step2.classList.add('hidden');
    updateParticipantsQueue();
    updateLeaderboard();
    
    // Show secret word input screen for first round
    const secretInputScreen = document.createElement('div');
    secretInputScreen.id = 'secretInputScreen';
    secretInputScreen.className = 'secret-input-screen';
    secretInputScreen.innerHTML = `
        <div class="secret-screen-card">
            <h2>🎮 الجولة 1/${gameState.totalRounds}</h2>
            <p>اكتب الكلمة السرية</p>
            <input type="password" id="roundSecretInput" class="secret-input" placeholder="الكلمة السرية...">
            <button class="btn-primary btn-large" id="startRoundBtn">بدء الجولة</button>
        </div>
    `;
    
    document.getElementById('gameSection').appendChild(secretInputScreen);
    
    document.getElementById('startRoundBtn').addEventListener('click', () => {
        const word = document.getElementById('roundSecretInput').value.trim();
        if (!word) {
            alert('الرجاء كتابة الكلمة السرية');
            return;
        }
        
        gameState.secretWord = word;
        
        // Show in floating box immediately (not in input)
        secretWordInput.classList.add('hidden');
        setSecretBtn.classList.add('hidden');
        secretWordDisplay.classList.remove('hidden');
        secretWordDisplay.textContent = word;
        
        // Start collapsed
        secretWordFloat.classList.add('collapsed');
        secretToggle.textContent = '+';
        
        secretWordFloat.style.display = 'block';
        secretInputScreen.remove();
        
        activeGameCard.classList.remove('hidden');
        resultsCard.classList.add('hidden');
        questionCard.style.display = 'block';
        historyList.innerHTML = '<div class="empty-state">لا توجد أسئلة بعد</div>';
        
        gameState.isGameActive = true;
        gameState.startTime = Date.now();
        
        // Countdown 3-2-1
        countdown321(() => {
            gameState.client.say(gameState.channel, `🎮 الجولة 1/${gameState.totalRounds}`);
            startGameTimer();
            selectNextAsker();
        });
    });
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

// Shuffle participants array for new round
function shuffleParticipants() {
    // Fisher-Yates shuffle algorithm
    const array = gameState.participants;
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    
    // Update the queue display
    updateParticipantsQueue();
    
    // Log the new order
    console.log('ترتيب جديد للجولة:', gameState.participants);
}

// Divide participants into two teams
function divideIntoTeams() {
    // Shuffle first for fairness
    const shuffled = [...gameState.participants];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    // Divide into two teams
    const mid = Math.ceil(shuffled.length / 2);
    gameState.teams.blue = shuffled.slice(0, mid);
    gameState.teams.red = shuffled.slice(mid);
    
    // Reset turn indices
    gameState.teamTurnIndex.blue = 0;
    gameState.teamTurnIndex.red = 0;
    gameState.currentTeam = 'blue';
    
    console.log('🔵 الفريق الأزرق:', gameState.teams.blue);
    console.log('🔴 الفريق الأحمر:', gameState.teams.red);
}

// Shuffle teams for new round
function shuffleTeams() {
    // Shuffle blue team
    const blueArray = gameState.teams.blue;
    for (let i = blueArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [blueArray[i], blueArray[j]] = [blueArray[j], blueArray[i]];
    }
    
    // Shuffle red team
    const redArray = gameState.teams.red;
    for (let i = redArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [redArray[i], redArray[j]] = [redArray[j], redArray[i]];
    }
    
    // Reset turn indices
    gameState.teamTurnIndex.blue = 0;
    gameState.teamTurnIndex.red = 0;
    
    console.log('🔵 ترتيب جديد - الأزرق:', gameState.teams.blue);
    console.log('🔴 ترتيب جديد - الأحمر:', gameState.teams.red);
}

function selectNextAsker() {
    if (gameState.participants.length === 0) {
        endGame(false);
        return;
    }
    
    let asker;
    let team = null;
    
    if (gameState.gameMode === 'teams') {
        // Teams mode
        // Switch team
        gameState.currentTeam = gameState.currentTeam === 'blue' ? 'red' : 'blue';
        
        const currentTeamArray = gameState.teams[gameState.currentTeam];
        const index = gameState.teamTurnIndex[gameState.currentTeam];
        
        asker = currentTeamArray[index];
        team = gameState.currentTeam;
        
        // Next turn for this team
        gameState.teamTurnIndex[gameState.currentTeam] = (index + 1) % currentTeamArray.length;
        
    } else {
        // Solo mode - original logic
        gameState.currentAskerIndex = (gameState.currentAskerIndex + 1) % gameState.participants.length;
        asker = gameState.participants[gameState.currentAskerIndex];
    }
    
    // Make sure questionCard is visible
    questionCard.style.display = 'block';
    
    // Update UI
    if (team) {
        const teamEmoji = team === 'blue' ? '🔵' : '🔴';
        currentAsker.innerHTML = `${asker} <span style="font-size: 1.2rem">${teamEmoji}</span>`;
    } else {
        currentAsker.textContent = asker;
    }
    
    currentQuestion.textContent = 'في انتظار السؤال...';
    answerInput.value = '';
    answerSection.style.display = 'none';
    gameState.currentQuestion = null;
    
    console.log('🎯 selectNextAsker - Starting timer for:', asker);
    
    // Start question timer
    startQuestionTimer();
    
    const teamMsg = team ? ` من الفريق ${team === 'blue' ? 'الأزرق 🔵' : 'الأحمر 🔴'}` : '';
    gameState.client.say(gameState.channel, `❓ ${asker}${teamMsg} اكتب السؤال عندك`);
}

function playSuccessSound() {
    // Create AudioContext
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Success melody: C-E-G (major chord)
    const notes = [
        { freq: 523.25, time: 0, duration: 0.15 },    // C5
        { freq: 659.25, time: 0.15, duration: 0.15 }, // E5
        { freq: 783.99, time: 0.3, duration: 0.3 }    // G5
    ];
    
    notes.forEach(note => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.value = note.freq;
        
        // Soft volume
        gainNode.gain.setValueAtTime(0.15, audioContext.currentTime + note.time);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + note.time + note.duration);
        
        oscillator.start(audioContext.currentTime + note.time);
        oscillator.stop(audioContext.currentTime + note.time + note.duration);
    });
}

function normalizeArabicText(text) {
    if (!text) return '';
    
    return text
        .toLowerCase()
        .trim()
        // إزالة "ال" التعريف
        .replace(/^ال/, '')
        // توحيد الهمزات
        .replace(/[أإآ]/g, 'ا')
        // توحيد التاء المربوطة والهاء
        .replace(/[ةه]$/g, 'ه')
        // توحيد الياء
        .replace(/[ىي]/g, 'ي')
        // إزالة التشكيل
        .replace(/[\u064B-\u0652]/g, '')
        // إزالة المسافات الزائدة
        .replace(/\s+/g, ' ')
        .trim();
}

function isSimilarText(text1, text2) {
    const normalized1 = normalizeArabicText(text1);
    const normalized2 = normalizeArabicText(text2);
    
    // مطابقة تامة
    if (normalized1 === normalized2) {
        return true;
    }
    
    // مراعاة اختلافات طفيفة (مثل ترامب/ترمب)
    // حساب Levenshtein distance
    const distance = levenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);
    const similarity = 1 - (distance / maxLength);
    
    // إذا التشابه أكثر من 85%
    return similarity >= 0.85;
}

function levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[str2.length][str1.length];
}

// Check Flexible Answer (Option B - Medium)
function checkFlexibleAnswer(userAnswer, secretWord) {
    if (!userAnswer || !secretWord) return false;
    
    // Normalize both
    const normalizedAnswer = normalizeArabicText(userAnswer);
    const normalizedSecret = normalizeArabicText(secretWord);
    
    // Method 1: Exact match
    if (normalizedAnswer === normalizedSecret) {
        return true;
    }
    
    // Method 2: Secret word is contained in answer
    // Example: "!هل هو محمد صلاح؟" contains "محمد صلاح"
    if (normalizedAnswer.includes(normalizedSecret)) {
        return true;
    }
    
    // Method 3: All words of secret are present (for multi-word secrets)
    const secretWords = normalizedSecret.split(/\s+/).filter(w => w.length > 0);
    if (secretWords.length > 1) {
        const allWordsPresent = secretWords.every(word => 
            normalizedAnswer.includes(word)
        );
        if (allWordsPresent) {
            return true;
        }
    }
    
    // Method 4: Fuzzy matching (for typos)
    if (isSimilarText(userAnswer, secretWord)) {
        return true;
    }
    
    return false;
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
        // Check if message starts with ! (command)
        if (!msg.startsWith('!')) {
            return; // Ignore messages without !
        }
        
        // Remove ! and get the actual message
        const command = msg.substring(1).trim();
        
        // Get current asker based on game mode
        let currentAskerName;
        if (gameState.gameMode === 'teams') {
            const currentTeamArray = gameState.teams[gameState.currentTeam];
            const index = (gameState.teamTurnIndex[gameState.currentTeam] - 1 + currentTeamArray.length) % currentTeamArray.length;
            currentAskerName = currentTeamArray[index];
        } else {
            currentAskerName = gameState.participants[gameState.currentAskerIndex];
        }
        
        // Direct guess check - only from current asker
        if (username === currentAskerName && gameState.secretWord && checkFlexibleAnswer(command, gameState.secretWord)) {
            clearInterval(gameState.questionTimer);
            
            // Play success sound
            playSuccessSound();
            
            endGame(true, username);
            return;
        }
        
        // Question from current asker
        if (username === currentAskerName && !gameState.currentQuestion) {
            clearInterval(gameState.questionTimer);
            skipInactiveBtn.style.display = 'none'; // Hide skip inactive button
            gameState.currentQuestion = {
                asker: username,
                question: command,
                answer: null
            };
            currentQuestion.textContent = command;
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

// Skip Button
const skipBtn = document.getElementById('skipBtn');
skipBtn.addEventListener('click', () => {
    if (confirm('هل تريد تخطي هذا السؤال؟')) {
        clearInterval(gameState.questionTimer);
        selectNextAsker();
    }
});

function startQuestionTimer() {
    clearInterval(gameState.questionTimer);
    let timeLeft = gameState.questionTimeLimit;
    
    const timerDisplay = document.getElementById('questionTimerDisplay');
    const timerCountdown = document.getElementById('timerCountdown');
    
    console.log('🎯 startQuestionTimer called');
    console.log('timerDisplay:', timerDisplay);
    console.log('timerCountdown:', timerCountdown);
    console.log('timeLeft:', timeLeft);
    
    if (!timerDisplay || !timerCountdown) {
        console.error('❌ Timer elements not found!');
        return;
    }
    
    // Make sure timer is visible
    timerDisplay.style.display = 'flex';
    timerDisplay.classList.remove('warning');
    timerCountdown.textContent = timeLeft;
    
    // Show skip inactive button
    skipInactiveBtn.style.display = 'block';
    
    console.log('✅ Timer started at', timeLeft);
    
    gameState.questionTimer = setInterval(() => {
        timeLeft--;
        timerCountdown.textContent = timeLeft;
        
        console.log('⏱️ Timer:', timeLeft);
        
        // Warning at 5 seconds
        if (timeLeft <= 5) {
            timerDisplay.classList.add('warning');
        }
        
        if (timeLeft <= 0) {
            clearInterval(gameState.questionTimer);
            timerDisplay.classList.remove('warning');
            skipInactiveBtn.style.display = 'none';
            console.log('⏰ Time up! Skipping to next player');
            // Skip to next player
            selectNextAsker();
        }
    }, 1000);
}

function countdown321(callback) {
    let count = 3;
    const countdownInterval = setInterval(() => {
        gameState.client.say(gameState.channel, `${count}`);
        count--;
        
        if (count < 1) {
            clearInterval(countdownInterval);
            if (callback) callback();
        }
    }, 1000);
}

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

// Kick Player Function
function kickPlayer(playerName) {
    if (!confirm(`هل تريد طرد ${playerName} من اللعبة؟`)) {
        return;
    }
    
    if (gameState.gameMode === 'teams') {
        // Remove from teams
        gameState.teams.blue = gameState.teams.blue.filter(p => p !== playerName);
        gameState.teams.red = gameState.teams.red.filter(p => p !== playerName);
        
        // Update participants list
        gameState.participants = gameState.participants.filter(p => p !== playerName);
        
        // Remove score
        delete gameState.scores[playerName];
    } else {
        // Solo mode
        const index = gameState.participants.indexOf(playerName);
        if (index > -1) {
            gameState.participants.splice(index, 1);
            
            // Adjust currentAskerIndex if needed
            if (gameState.currentAskerIndex >= index) {
                gameState.currentAskerIndex = Math.max(0, gameState.currentAskerIndex - 1);
            }
            
            // Remove score
            delete gameState.scores[playerName];
        }
    }
    
    // Update UI
    updateParticipantsQueue();
    updateLeaderboard();
    
    // Send message
    gameState.client.say(gameState.channel, `🚫 تم طرد ${playerName} من اللعبة`);
    
    // Check if game should continue
    if (gameState.participants.length === 0) {
        alert('لا يوجد مشاركون! اللعبة انتهت.');
        endGame(false);
    }
}

// Toggle Kick Mode
toggleKickMode.addEventListener('click', () => {
    kickModeActive = !kickModeActive;
    
    if (kickModeActive) {
        toggleKickMode.textContent = '✅ إلغاء';
        toggleKickMode.style.background = 'var(--success-color)';
    } else {
        toggleKickMode.textContent = '🚫 طرد';
        toggleKickMode.style.background = '';
    }
    
    updateParticipantsQueue();
});

// Skip Inactive Player (before question)
skipInactiveBtn.addEventListener('click', () => {
    if (confirm('هل تريد تخطي هذا اللاعب؟ (غير نشط)')) {
        clearInterval(gameState.questionTimer);
        skipInactiveBtn.style.display = 'none';
        selectNextAsker();
    }
});

function updateParticipantsQueue() {
    // Update count based on game mode
    if (gameState.gameMode === 'teams') {
        queueCount.textContent = gameState.teams.blue.length + gameState.teams.red.length;
    } else {
        queueCount.textContent = gameState.participants.length;
    }
    
    if (gameState.participants.length === 0) {
        participantsQueue.innerHTML = '<div class="empty-state">لا يوجد مشاركون</div>';
        return;
    }
    
    participantsQueue.innerHTML = '';
    
    if (gameState.gameMode === 'teams') {
        // Show teams
        gameState.teams.blue.forEach((p) => {
            const badge = document.createElement('div');
            badge.className = 'participant-badge team-blue';
            badge.innerHTML = `${p} 🔵`;
            
            if (kickModeActive) {
                const kickBtn = document.createElement('button');
                kickBtn.className = 'kick-btn';
                kickBtn.innerHTML = '❌';
                kickBtn.onclick = () => kickPlayer(p);
                badge.appendChild(kickBtn);
            }
            
            participantsQueue.appendChild(badge);
        });
        
        gameState.teams.red.forEach((p) => {
            const badge = document.createElement('div');
            badge.className = 'participant-badge team-red';
            badge.innerHTML = `${p} 🔴`;
            
            if (kickModeActive) {
                const kickBtn = document.createElement('button');
                kickBtn.className = 'kick-btn';
                kickBtn.innerHTML = '❌';
                kickBtn.onclick = () => kickPlayer(p);
                badge.appendChild(kickBtn);
            }
            
            participantsQueue.appendChild(badge);
        });
    } else {
        // Solo mode
        gameState.participants.forEach((p, i) => {
            const badge = document.createElement('div');
            badge.className = 'participant-badge';
            if (i === gameState.currentAskerIndex) {
                badge.classList.add('active');
            }
            badge.textContent = p;
            
            if (kickModeActive) {
                const kickBtn = document.createElement('button');
                kickBtn.className = 'kick-btn';
                kickBtn.innerHTML = '❌';
                kickBtn.onclick = () => kickPlayer(p);
                badge.appendChild(kickBtn);
            }
            
            participantsQueue.appendChild(badge);
        });
    }
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
    clearInterval(gameState.questionTimer);
    gameState.isGameActive = false;
    gameState.isJoining = false;
    
    // Don't remove timer - just reset it
    const existingTimer = document.getElementById('questionTimerDisplay');
    if (existingTimer) {
        existingTimer.classList.remove('warning');
        const timerCountdown = document.getElementById('timerCountdown');
        if (timerCountdown) timerCountdown.textContent = '20';
    }
    
    // Hide skip inactive button
    if (skipInactiveBtn) skipInactiveBtn.style.display = 'none';
    
    if (hasWinner && winner) {
        // Add point based on game mode
        if (gameState.gameMode === 'teams') {
            // Find winner's team
            const team = gameState.teams.blue.includes(winner) ? 'blue' : 'red';
            gameState.teamScores[team]++;
            
            const teamName = team === 'blue' ? 'الأزرق 🔵' : 'الأحمر 🔴';
            const scores = `🔵 ${gameState.teamScores.blue} - 🔴 ${gameState.teamScores.red}`;
            gameState.client.say(gameState.channel, `🎉 ${winner} من الفريق ${teamName} فاز! النقاط: ${scores}`);
        } else {
            // Solo mode
            if (gameState.scores[winner] !== undefined) {
                gameState.scores[winner]++;
            }
            gameState.client.say(gameState.channel, `🎉 ${winner} فاز!`);
        }
        
        updateLeaderboard();
        
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
    
    // Shuffle order for new round
    if (gameState.gameMode === 'teams') {
        shuffleTeams(); // Shuffle both teams
    } else {
        shuffleParticipants(); // Shuffle all participants
    }
    
    currentRound.textContent = gameState.currentRoundNum;
    
    // Show secret word input screen
    activeGameCard.classList.add('hidden');
    const secretInputScreen = document.createElement('div');
    secretInputScreen.id = 'secretInputScreen';
    secretInputScreen.className = 'secret-input-screen';
    secretInputScreen.innerHTML = `
        <div class="secret-screen-card">
            <h2>🎮 الجولة ${gameState.currentRoundNum}/${gameState.totalRounds}</h2>
            <p>اكتب الكلمة السرية للجولة الجديدة</p>
            <input type="password" id="roundSecretInput" class="secret-input" placeholder="الكلمة السرية...">
            <button class="btn-primary btn-large" id="startRoundBtn">بدء الجولة</button>
        </div>
    `;
    
    document.getElementById('gameSection').appendChild(secretInputScreen);
    
    document.getElementById('startRoundBtn').addEventListener('click', () => {
        const word = document.getElementById('roundSecretInput').value.trim();
        if (!word) {
            alert('الرجاء كتابة الكلمة السرية');
            return;
        }
        
        gameState.secretWord = word;
        
        // Show in floating box immediately
        secretWordDisplay.textContent = word;
        
        // Start collapsed
        secretWordFloat.classList.add('collapsed');
        secretToggle.textContent = '+';
        
        secretInputScreen.remove();
        
        // Reset UI
        historyList.innerHTML = '<div class="empty-state">لا توجد أسئلة بعد</div>';
        activeGameCard.classList.remove('hidden');
        questionCard.style.display = 'block';
        
        gameState.isGameActive = true;
        gameState.startTime = Date.now();
        
        // Countdown 3-2-1
        countdown321(() => {
            gameState.client.say(gameState.channel, `🎮 الجولة ${gameState.currentRoundNum}/${gameState.totalRounds}`);
            startGameTimer();
            selectNextAsker();
        });
    });
}

function showFinalResults() {
    activeGameCard.classList.add('hidden');
    resultsCard.classList.remove('hidden');
    
    const secretWordEl = document.getElementById('revealedSecret');
    
    if (gameState.gameMode === 'teams') {
        // Teams mode
        const blueScore = gameState.teamScores.blue;
        const redScore = gameState.teamScores.red;
        
        secretWordEl.textContent = gameState.secretWord || 'غير محددة';
        
        if (blueScore > redScore) {
            // Blue team wins
            winnerSection.style.display = 'block';
            winnerName.innerHTML = `
                <div style="font-size: 1.5rem; margin-bottom: 1rem">🔵 الفريق الأزرق</div>
                <div style="font-size: 1.2rem">${blueScore} - ${redScore}</div>
                <div style="margin-top: 1rem; font-size: 1rem">الأعضاء: ${gameState.teams.blue.join('، ')}</div>
            `;
            gameState.client.say(gameState.channel, `👑 الفريق الأزرق 🔵 فاز! النقاط: ${blueScore} - ${redScore}`);
        } else if (redScore > blueScore) {
            // Red team wins
            winnerSection.style.display = 'block';
            winnerName.innerHTML = `
                <div style="font-size: 1.5rem; margin-bottom: 1rem">🔴 الفريق الأحمر</div>
                <div style="font-size: 1.2rem">${blueScore} - ${redScore}</div>
                <div style="margin-top: 1rem; font-size: 1rem">الأعضاء: ${gameState.teams.red.join('، ')}</div>
            `;
            gameState.client.say(gameState.channel, `👑 الفريق الأحمر 🔴 فاز! النقاط: ${blueScore} - ${redScore}`);
        } else {
            // Tie
            winnerSection.style.display = 'block';
            winnerName.innerHTML = `
                <div style="font-size: 1.5rem; margin-bottom: 1rem">🤝 تعادل!</div>
                <div style="font-size: 1.2rem">${blueScore} - ${redScore}</div>
            `;
            gameState.client.say(gameState.channel, `🤝 تعادل! النقاط: ${blueScore} - ${redScore}`);
        }
        
    } else {
        // Solo mode - original logic
        let maxScore = 0;
        let finalWinner = null;
        for (let player in gameState.scores) {
            if (gameState.scores[player] > maxScore) {
                maxScore = gameState.scores[player];
                finalWinner = player;
            }
        }
        
        if (finalWinner && maxScore > 0) {
            // Someone won
            secretWordEl.textContent = gameState.secretWord || 'غير محددة';
            secretWordEl.style.color = '';
            secretWordEl.parentElement.style.background = '';
            winnerSection.style.display = 'block';
            winnerName.textContent = `${finalWinner} (${maxScore} نقطة)`;
            gameState.client.say(gameState.channel, `👑 البطل: ${finalWinner} بـ ${maxScore} نقطة!`);
        } else {
            // No one answered correctly
            secretWordEl.textContent = gameState.secretWord || 'غير محددة';
            secretWordEl.style.color = '#ff4444';
            secretWordEl.parentElement.style.background = 'linear-gradient(135deg, rgba(255, 68, 68, 0.2), rgba(239, 68, 68, 0.1))';
            secretWordEl.parentElement.style.border = '2px solid #ff4444';
            
            // Add "لم يجب أحد" message
            const noAnswerMsg = document.createElement('p');
            noAnswerMsg.style.color = '#ff4444';
            noAnswerMsg.style.fontSize = '1.5rem';
            noAnswerMsg.style.fontWeight = '700';
            noAnswerMsg.style.marginTop = '1rem';
            noAnswerMsg.textContent = '❌ لم يجب أحد بشكل صحيح';
            
            const existingMsg = secretWordEl.parentElement.querySelector('p');
            if (existingMsg && existingMsg.textContent.includes('لم يجب')) {
                existingMsg.remove();
            }
            secretWordEl.parentElement.appendChild(noAnswerMsg);
            
            winnerSection.style.display = 'none';
            gameState.client.say(gameState.channel, `❌ انتهت اللعبة - لم يجب أحد بشكل صحيح`);
        }
    }
    
    totalQuestions.textContent = gameState.qanda.length;
    totalParticipants.textContent = gameState.participants.length;
    const duration = Math.floor((Date.now() - gameState.startTime) / 1000 / 60);
    gameDurationStat.textContent = `${duration} دقيقة`;
}

function showTeamsScreen() {
    step2.classList.add('hidden');
    
    const teamsScreen = document.createElement('div');
    teamsScreen.id = 'teamsDisplayScreen';
    teamsScreen.className = 'secret-input-screen';
    teamsScreen.innerHTML = `
        <div class="secret-screen-card" style="max-width: 700px">
            <h2>🎮 توزيع الفرق</h2>
            <p style="margin-bottom: 2rem; color: var(--text-secondary)">تم توزيع اللاعبين بشكل عشوائي</p>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem">
                <div style="padding: 1.5rem; background: rgba(59, 130, 246, 0.1); border: 2px solid #3b82f6; border-radius: 12px">
                    <h3 style="color: #3b82f6; margin-bottom: 1rem; font-size: 1.5rem">🔵 الفريق الأزرق (${gameState.teams.blue.length})</h3>
                    <div style="display: flex; flex-direction: column; gap: 0.5rem">
                        ${gameState.teams.blue.map(player => `
                            <div style="padding: 0.75rem; background: rgba(59, 130, 246, 0.2); border-radius: 8px; font-weight: 600">
                                ${player}
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div style="padding: 1.5rem; background: rgba(239, 68, 68, 0.1); border: 2px solid #ef4444; border-radius: 12px">
                    <h3 style="color: #ef4444; margin-bottom: 1rem; font-size: 1.5rem">🔴 الفريق الأحمر (${gameState.teams.red.length})</h3>
                    <div style="display: flex; flex-direction: column; gap: 0.5rem">
                        ${gameState.teams.red.map(player => `
                            <div style="padding: 0.75rem; background: rgba(239, 68, 68, 0.2); border-radius: 8px; font-weight: 600">
                                ${player}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            
            <button class="btn-primary btn-large" id="continueToSecretBtn">متابعة</button>
        </div>
    `;
    
    document.getElementById('gameSection').appendChild(teamsScreen);
    
    // Announce teams in chat
    gameState.client.say(gameState.channel, `🔵 الفريق الأزرق: ${gameState.teams.blue.join('، ')}`);
    gameState.client.say(gameState.channel, `🔴 الفريق الأحمر: ${gameState.teams.red.join('، ')}`);
    
    document.getElementById('continueToSecretBtn').addEventListener('click', () => {
        teamsScreen.remove();
        
        currentRound.textContent = gameState.currentRoundNum;
        totalRounds.textContent = gameState.totalRounds;
        updateParticipantsQueue();
        updateLeaderboard();
        
        // Show secret word screen
        const secretInputScreen = document.createElement('div');
        secretInputScreen.id = 'secretInputScreen';
        secretInputScreen.className = 'secret-input-screen';
        secretInputScreen.innerHTML = `
            <div class="secret-screen-card">
                <h2>🎮 الجولة 1/${gameState.totalRounds}</h2>
                <p>اكتب الكلمة السرية</p>
                <input type="password" id="roundSecretInput" class="secret-input" placeholder="الكلمة السرية...">
                <button class="btn-primary btn-large" id="startRoundBtn">بدء الجولة</button>
            </div>
        `;
        
        document.getElementById('gameSection').appendChild(secretInputScreen);
        
        document.getElementById('startRoundBtn').addEventListener('click', () => {
            const word = document.getElementById('roundSecretInput').value.trim();
            if (!word) {
                alert('الرجاء كتابة الكلمة السرية');
                return;
            }
            
            gameState.secretWord = word;
            secretWordFloat.classList.remove('collapsed');
            secretToggle.textContent = '−';
            secretInputScreen.remove();
            historyList.innerHTML = '<div class="empty-state">لا توجد أسئلة بعد</div>';
            activeGameCard.classList.remove('hidden');
            questionCard.style.display = 'block';
            gameState.isGameActive = true;
            gameState.startTime = Date.now();
            
            countdown321(() => {
                gameState.client.say(gameState.channel, `🎮 الجولة ${gameState.currentRoundNum}/${gameState.totalRounds} - الفرق جاهزة!`);
                startGameTimer();
                selectNextAsker();
            });
        });
    });
}

function updateLeaderboard() {
    if (Object.keys(gameState.scores).length === 0) {
        leaderboardList.innerHTML = '<div class="empty-state">لا توجد نقاط بعد</div>';
        return;
    }
    
    // Sort by score
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
