/**
 * AnonChat - Anonymous Random Video Chat Application
 * Production-ready implementation using Supabase and WebRTC
 */

// ============================================
// Configuration
// ============================================
const CONFIG = {
    // Supabase Configuration - Replace with your credentials
    SUPABASE_URL: 'https://qsdjxukdjugbgzonptyh.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzZGp4dWtkanVnYmd6b25wdHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MjMyNDAsImV4cCI6MjA4ODI5OTI0MH0.vGpA9iji8X0jAqhq0ufRljvNgnDLPWvir_B6OkJTdbo',
    
    // WebRTC Configuration
    RTC_CONFIG: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' }
        ]
    },
    
    // App Settings
    MATCHMAKING_TIMEOUT: 30000, // 30 seconds
    INACTIVE_TIMEOUT: 300000, // 5 minutes
    TYPING_TIMEOUT: 3000, // 3 seconds
    MESSAGE_RATE_LIMIT: 10, // messages per 10 seconds
    MAX_MESSAGE_LENGTH: 1000,
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    RECONNECT_DELAY: 2000,
    MAX_RECONNECT_ATTEMPTS: 5,
    
    // Profanity Filter (basic words)
    PROFANITY_WORDS: [
        'fuck', 'shit', 'asshole', 'bastard', 'bitch', 'damn',
        'crap', 'dick', 'piss', 'whore', 'slut', 'cock'
    ]
};

// ============================================
// State Management
// ============================================
const state = {
    // User
    userId: null,
    sessionId: null,
    
    // Room
    roomId: null,
    partnerId: null,
    isVideoMode: false,
    isActive: false,
    
    // WebRTC
    peerConnection: null,
    localStream: null,
    remoteStream: null,
    isCameraOn: true,
    isMicOn: true,
    facingMode: 'user',
    
    // Matchmaking
    matchmakingSubscription: null,
    isMatchmaking: false,
    
    // Chat
    messages: [],
    isTyping: false,
    typingTimeout: null,
    lastTypingSent: 0,
    
    // Rate Limiting
    messageCount: 0,
    messageCountReset: null,
    spamWarnings: 0,
    
    // Activity
    lastActivity: Date.now(),
    inactivityTimer: null,
    
    // Subscriptions
    subscriptions: {
        messages: null,
        signals: null,
        presence: null
    },
    
    // UI State
    isFullscreen: false,
    isReportModalOpen: false
};

// ============================================
// Supabase Client
// ============================================
let supabase = null;

// ============================================
// DOM Elements
// ============================================
const elements = {
    // Screens
    loadingScreen: document.getElementById('loading-screen'),
    app: document.getElementById('app'),
    welcomeScreen: document.getElementById('welcome-screen'),
    matchingScreen: document.getElementById('matching-screen'),
    chatScreen: document.getElementById('chat-screen'),
    
    // Header
    onlineCount: document.getElementById('online-count'),
    connectionStatus: document.getElementById('connection-status'),
    
    // Welcome
    startVideoBtn: document.getElementById('start-video-btn'),
    startTextBtn: document.getElementById('start-text-btn'),
    
    // Matching
    cancelMatchingBtn: document.getElementById('cancel-matching-btn'),
    
    // Video
    videoSection: document.getElementById('video-section'),
    strangerVideo: document.getElementById('stranger-video'),
    selfVideo: document.getElementById('self-video'),
    selfVideoWrapper: document.getElementById('self-video-wrapper'),
    fullscreenBtn: document.getElementById('fullscreen-btn'),
    toggleCameraBtn: document.getElementById('toggle-camera-btn'),
    toggleMicBtn: document.getElementById('toggle-mic-btn'),
    switchCameraBtn: document.getElementById('switch-camera-btn'),
    strangerStatus: document.getElementById('stranger-status'),
    
    // Chat
    messagesContainer: document.getElementById('messages-container'),
    messagesList: document.getElementById('messages-list'),
    typingIndicator: document.getElementById('typing-indicator'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),
    emojiBtn: document.getElementById('emoji-btn'),
    emojiPickerContainer: document.getElementById('emoji-picker-container'),
    attachBtn: document.getElementById('attach-btn'),
    fileInput: document.getElementById('file-input'),
    
    // Actions
    nextBtn: document.getElementById('next-btn'),
    stopBtn: document.getElementById('stop-btn'),
    reportBtn: document.getElementById('report-btn'),
    
    // Report Modal
    reportModal: document.getElementById('report-modal'),
    closeReportModal: document.getElementById('close-report-modal'),
    cancelReportBtn: document.getElementById('cancel-report-btn'),
    submitReportBtn: document.getElementById('submit-report-btn'),
    reportDetails: document.getElementById('report-details'),
    
    // Toast
    toastContainer: document.getElementById('toast-container')
};

// ============================================
// Utility Functions
// ============================================

/**
 * Generate unique ID
 */
function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Format timestamp
 */
function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format file size
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Sanitize HTML
 */
function sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Filter profanity
 */
function filterProfanity(text) {
    let filtered = text;
    CONFIG.PROFANITY_WORDS.forEach(word => {
        const regex = new RegExp(word, 'gi');
        filtered = filtered.replace(regex, '*'.repeat(word.length));
    });
    return filtered;
}

/**
 * Check if text contains profanity
 */
function containsProfanity(text) {
    const lowerText = text.toLowerCase();
    return CONFIG.PROFANITY_WORDS.some(word => lowerText.includes(word));
}

/**
 * Debounce function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function
 */
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ============================================
// Toast Notifications
// ============================================

function showToast(message, type = 'info', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span class="toast-message">${sanitizeHTML(message)}</span>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ============================================
// Connection Status
// ============================================

function updateConnectionStatus(status) {
    const statusEl = elements.connectionStatus;
    statusEl.className = `connection-status ${status}`;
    
    const labels = {
        connected: 'Connected',
        connecting: 'Connecting',
        disconnected: 'Disconnected'
    };
    
    statusEl.querySelector('.status-text').textContent = labels[status] || status;
}

// ============================================
// Screen Management
// ============================================

function showScreen(screenName) {
    // Hide all screens
    elements.welcomeScreen.classList.add('hidden');
    elements.matchingScreen.classList.add('hidden');
    elements.chatScreen.classList.add('hidden');
    
    // Show requested screen
    switch (screenName) {
        case 'welcome':
            elements.welcomeScreen.classList.remove('hidden');
            break;
        case 'matching':
            elements.matchingScreen.classList.remove('hidden');
            break;
        case 'chat':
            elements.chatScreen.classList.remove('hidden');
            if (!state.isVideoMode) {
                elements.chatScreen.classList.add('text-mode');
            } else {
                elements.chatScreen.classList.remove('text-mode');
            }
            break;
    }
}

// ============================================
// Supabase Initialization
// ============================================

async function initializeSupabase() {
    try {
        supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
        
        // Generate user ID if not exists
        state.userId = localStorage.getItem('anonchat_user_id');
        if (!state.userId) {
            state.userId = generateId();
            localStorage.setItem('anonchat_user_id', state.userId);
        }
        
        // Generate session ID
        state.sessionId = generateId();
        
        // Test connection
        const { error } = await supabase.from('rooms').select('id').limit(1);
        if (error && error.code !== 'PGRST116') {
            throw error;
        }
        
        // Setup presence
        await setupPresence();
        
        // Hide loading, show app
        elements.loadingScreen.classList.add('hidden');
        elements.app.classList.remove('hidden');
        
        updateConnectionStatus('connected');
        showToast('Connected to server', 'success');
        
        return true;
    } catch (error) {
        console.error('Supabase initialization error:', error);
        updateConnectionStatus('disconnected');
        showToast('Failed to connect to server. Please check your configuration.', 'error', 10000);
        
        // Still show the app but with error state
        elements.loadingScreen.classList.add('hidden');
        elements.app.classList.remove('hidden');
        
        return false;
    }
}

// ============================================
// Presence System
// ============================================

async function setupPresence() {
    // Subscribe to presence channel
    const channel = supabase.channel('online-users', {
        config: {
            presence: {
                key: state.userId
            }
        }
    });
    
    channel
        .on('presence', { event: 'sync' }, () => {
            const newState = channel.presenceState();
            const count = Object.keys(newState).length;
            elements.onlineCount.textContent = count;
        })
        .on('presence', { event: 'join' }, ({ newPresences }) => {
            // Someone joined
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
            // Someone left
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await channel.track({
                    user: state.userId,
                    online_at: new Date().toISOString()
                });
            }
        });
    
    // Update presence periodically
    setInterval(async () => {
        await channel.track({
            user: state.userId,
            online_at: new Date().toISOString()
        });
    }, 30000);
}

// ============================================
// Matchmaking System
// ============================================

async function startMatchmaking(isVideoMode) {
    if (state.isMatchmaking) return;
    
    state.isMatchmaking = true;
    state.isVideoMode = isVideoMode;
    
    showScreen('matching');
    updateConnectionStatus('connecting');
    
    try {
        // Clean up any existing rooms
        await cleanupUserRooms();
        
        // Try to find an existing room to join
        const { data: existingRooms, error: findError } = await supabase
            .from('rooms')
            .select('*')
            .is('partner_id', null)
            .neq('creator_id', state.userId)
            .eq('is_video', isVideoMode)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: true })
            .limit(1);
        
        if (findError) throw findError;
        
        if (existingRooms && existingRooms.length > 0) {
            // Join existing room
            await joinRoom(existingRooms[0]);
        } else {
            // Create new room and wait for partner
            await createRoom();
        }
    } catch (error) {
        console.error('Matchmaking error:', error);
        showToast('Failed to find a match. Please try again.', 'error');
        cancelMatchmaking();
    }
}

async function createRoom() {
    const roomId = generateId();
    const expiresAt = new Date(Date.now() + CONFIG.MATCHMAKING_TIMEOUT);
    
    const { error } = await supabase
        .from('rooms')
        .insert({
            id: roomId,
            creator_id: state.userId,
            partner_id: null,
            is_video: state.isVideoMode,
            status: 'waiting',
            created_at: new Date().toISOString(),
            expires_at: expiresAt.toISOString()
        });
    
    if (error) throw error;
    
    state.roomId = roomId;
    
    // Subscribe to room changes
    state.matchmakingSubscription = supabase
        .channel(`room-${roomId}`)
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'rooms',
            filter: `id=eq.${roomId}`
        }, (payload) => {
            if (payload.new.partner_id && payload.new.partner_id !== state.userId) {
                // Someone joined our room
                onPartnerFound(payload.new);
            }
        })
        .subscribe();
    
    // Set timeout for matchmaking
    setTimeout(() => {
        if (state.isMatchmaking && !state.partnerId) {
            showToast('No match found. Please try again.', 'warning');
            cancelMatchmaking();
        }
    }, CONFIG.MATCHMAKING_TIMEOUT);
}

async function joinRoom(room) {
    state.roomId = room.id;
    state.partnerId = room.creator_id;
    
    // Update room with our ID
    const { error } = await supabase
        .from('rooms')
        .update({
            partner_id: state.userId,
            status: 'active',
            expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour
        })
        .eq('id', room.id);
    
    if (error) throw error;
    
    // Start the chat
    await startChat();
}

function onPartnerFound(room) {
    state.partnerId = room.partner_id;
    state.isMatchmaking = false;
    
    if (state.matchmakingSubscription) {
        state.matchmakingSubscription.unsubscribe();
    }
    
    startChat();
}

async function cancelMatchmaking() {
    state.isMatchmaking = false;
    
    if (state.matchmakingSubscription) {
        await state.matchmakingSubscription.unsubscribe();
        state.matchmakingSubscription = null;
    }
    
    if (state.roomId) {
        await supabase
            .from('rooms')
            .delete()
            .eq('id', state.roomId);
        state.roomId = null;
    }
    
    showScreen('welcome');
    updateConnectionStatus('connected');
}

async function cleanupUserRooms() {
    // Delete any rooms where user is creator or partner
    await supabase
        .from('rooms')
        .delete()
        .or(`creator_id.eq.${state.userId},partner_id.eq.${state.userId}`);
    
    // Delete any signals
    await supabase
        .from('signals')
        .delete()
        .or(`sender_id.eq.${state.userId},receiver_id.eq.${state.userId}`);
}

// ============================================
// Chat System
// ============================================

async function startChat() {
    state.isActive = true;
    showScreen('chat');
    updateConnectionStatus('connected');
    
    // Clear previous messages
    elements.messagesList.innerHTML = `
        <div class="message system-message">
            <span>You're now connected with a stranger. Say hello!</span>
        </div>
    `;
    state.messages = [];
    
    // Setup message subscription
    await setupMessageSubscription();
    
    // Setup signaling subscription for WebRTC
    if (state.isVideoMode) {
        await setupSignalingSubscription();
        await initializeWebRTC();
    }
    
    // Start inactivity timer
    startInactivityTimer();
    
    // Focus message input
    elements.messageInput.focus();
}

async function setupMessageSubscription() {
    if (state.subscriptions.messages) {
        await state.subscriptions.messages.unsubscribe();
    }
    
    state.subscriptions.messages = supabase
        .channel(`messages-${state.roomId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `room_id=eq.${state.roomId}`
        }, (payload) => {
            const message = payload.new;
            if (message.sender_id !== state.userId) {
                displayMessage(message, 'stranger');
                
                // Handle typing indicator off
                if (message.type === 'typing' && message.content === 'stop') {
                    elements.typingIndicator.classList.add('hidden');
                } else if (message.type === 'typing' && message.content === 'start') {
                    elements.typingIndicator.classList.remove('hidden');
                }
            }
        })
        .subscribe();
}

async function sendMessage(content, type = 'text', metadata = null) {
    if (!state.isActive || !state.partnerId) return;
    
    // Rate limiting
    if (!checkRateLimit()) {
        state.spamWarnings++;
        if (state.spamWarnings >= 3) {
            showToast('You are sending messages too fast. Please slow down.', 'warning');
            // Temporary mute
            return;
        }
        showToast('Please wait before sending another message.', 'warning');
        return;
    }
    
    // Validate message
    if (type === 'text' && (!content || content.trim().length === 0)) return;
    if (content && content.length > CONFIG.MAX_MESSAGE_LENGTH) {
        showToast('Message is too long.', 'warning');
        return;
    }
    
    // Filter profanity
    const filteredContent = type === 'text' ? filterProfanity(content) : content;
    
    const message = {
        id: generateId(),
        room_id: state.roomId,
        sender_id: state.userId,
        receiver_id: state.partnerId,
        type: type,
        content: filteredContent,
        metadata: metadata,
        created_at: new Date().toISOString()
    };
    
    // Insert message
    const { error } = await supabase
        .from('messages')
        .insert(message);
    
    if (error) {
        console.error('Error sending message:', error);
        showToast('Failed to send message.', 'error');
        return;
    }
    
    // Display our own message
    displayMessage(message, 'self');
    
    // Clear input
    elements.messageInput.value = '';
    
    // Send typing stop
    sendTypingIndicator(false);
    
    // Update activity
    updateActivity();
}

function displayMessage(message, sender) {
    // Skip typing messages
    if (message.type === 'typing') return;
    
    const messageEl = document.createElement('div');
    messageEl.className = `message ${sender}`;
    
    let content = '';
    
    switch (message.type) {
        case 'text':
            content = `<p>${sanitizeHTML(message.content)}</p>`;
            break;
            
        case 'image':
            content = `
                <p>📷 Image</p>
                <img src="${message.content}" alt="Shared image" class="message-image" 
                     onclick="openImagePreview('${message.content}')">
            `;
            break;
            
        case 'file':
            const fileName = message.metadata?.fileName || 'File';
            const fileSize = message.metadata?.fileSize ? formatFileSize(message.metadata.fileSize) : '';
            content = `
                <a href="${message.content}" download="${sanitizeHTML(fileName)}" class="message-file" target="_blank">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    <div class="message-file-info">
                        <span class="message-file-name">${sanitizeHTML(fileName)}</span>
                        <span class="message-file-size">${fileSize}</span>
                    </div>
                </a>
            `;
            break;
    }
    
    messageEl.innerHTML = `
        ${content}
        <span class="message-time">${formatTime(message.created_at)}</span>
    `;
    
    elements.messagesList.appendChild(messageEl);
    scrollToBottom();
}

function scrollToBottom() {
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

// ============================================
// Typing Indicator
// ============================================

function sendTypingIndicator(isTyping) {
    if (!state.isActive || !state.partnerId) return;
    
    const now = Date.now();
    if (isTyping && now - state.lastTypingSent < 1000) return; // Throttle
    
    state.lastTypingSent = now;
    
    supabase
        .from('messages')
        .insert({
            id: generateId(),
            room_id: state.roomId,
            sender_id: state.userId,
            receiver_id: state.partnerId,
            type: 'typing',
            content: isTyping ? 'start' : 'stop',
            created_at: new Date().toISOString()
        })
        .then(({ error }) => {
            if (error) console.error('Error sending typing indicator:', error);
        });
}

function handleTyping() {
    if (!state.isTyping) {
        state.isTyping = true;
        sendTypingIndicator(true);
    }
    
    clearTimeout(state.typingTimeout);
    state.typingTimeout = setTimeout(() => {
        state.isTyping = false;
        sendTypingIndicator(false);
    }, CONFIG.TYPING_TIMEOUT);
}

// ============================================
// File Sharing
// ============================================

async function handleFileSelect(file) {
    if (!file) return;
    
    // Check file size
    if (file.size > CONFIG.MAX_FILE_SIZE) {
        showToast('File is too large. Maximum size is 10MB.', 'warning');
        return;
    }
    
    // Check if image
    if (file.type.startsWith('image/')) {
        await sendImage(file);
    } else {
        await sendFile(file);
    }
}

async function sendImage(file) {
    try {
        showToast('Uploading image...', 'info');
        
        // Convert to base64 for simplicity (in production, use Supabase Storage)
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target.result;
            
            // Compress if too large
            let compressedImage = base64;
            if (base64.length > 500000) {
                compressedImage = await compressImage(base64, 0.7);
            }
            
            await sendMessage(compressedImage, 'image', {
                fileName: file.name,
                fileSize: file.size
            });
        };
        reader.readAsDataURL(file);
    } catch (error) {
        console.error('Error sending image:', error);
        showToast('Failed to send image.', 'error');
    }
}

async function compressImage(dataUrl, quality) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxWidth = 800;
            const maxHeight = 600;
            
            let width = img.width;
            let height = img.height;
            
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
            if (height > maxHeight) {
                width = (width * maxHeight) / height;
                height = maxHeight;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = dataUrl;
    });
}

async function sendFile(file) {
    try {
        showToast('Uploading file...', 'info');
        
        // For simplicity, convert to base64
        // In production, use Supabase Storage
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target.result;
            
            await sendMessage(base64, 'file', {
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type
            });
        };
        reader.readAsDataURL(file);
    } catch (error) {
        console.error('Error sending file:', error);
        showToast('Failed to send file.', 'error');
    }
}

// ============================================
// Image Preview
// ============================================

function openImagePreview(src) {
    const modal = document.createElement('div');
    modal.className = 'image-preview-modal';
    modal.innerHTML = `
        <button class="image-preview-close" onclick="this.parentElement.remove()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
        </button>
        <img src="${src}" alt="Preview">
    `;
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
    document.body.appendChild(modal);
}

// Make it globally accessible
window.openImagePreview = openImagePreview;

// ============================================
// WebRTC Implementation
// ============================================

async function initializeWebRTC() {
    try {
        // Get local media stream
        const constraints = {
            video: {
                facingMode: state.facingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: true
        };
        
        state.localStream = await navigator.mediaDevices.getUserMedia(constraints);
        elements.selfVideo.srcObject = state.localStream;
        
        // Show video, hide placeholder
        elements.selfVideo.style.display = 'block';
        elements.selfVideoWrapper.querySelector('.video-placeholder').style.display = 'none';
        
        // Create peer connection
        state.peerConnection = new RTCPeerConnection(CONFIG.RTC_CONFIG);
        
        // Add local tracks
        state.localStream.getTracks().forEach(track => {
            state.peerConnection.addTrack(track, state.localStream);
        });
        
        // Handle remote stream
        state.peerConnection.ontrack = (event) => {
            state.remoteStream = event.streams[0];
            elements.strangerVideo.srcObject = state.remoteStream;
            elements.strangerVideo.style.display = 'block';
            elements.strangerVideo.parentElement.querySelector('.video-placeholder').style.display = 'none';
        };
        
        // Handle ICE candidates
        state.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignal('ice-candidate', event.candidate);
            }
        };
        
        // Handle connection state changes
        state.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', state.peerConnection.connectionState);
            switch (state.peerConnection.connectionState) {
                case 'connected':
                    updateStrangerStatus('Connected', true);
                    break;
                case 'disconnected':
                case 'failed':
                    updateStrangerStatus('Disconnected', false);
                    handleConnectionLost();
                    break;
            }
        };
        
        // If we joined an existing room, we create the offer
        // Otherwise, we wait for the offer
        const { data: room } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', state.roomId)
            .single();
        
        if (room && room.partner_id === state.userId) {
            // We joined, create offer
            await createOffer();
        }
        
    } catch (error) {
        console.error('WebRTC initialization error:', error);
        showToast('Failed to access camera/microphone.', 'error');
    }
}

async function createOffer() {
    try {
        const offer = await state.peerConnection.createOffer();
        await state.peerConnection.setLocalDescription(offer);
        sendSignal('offer', offer);
    } catch (error) {
        console.error('Error creating offer:', error);
    }
}

async function handleOffer(offer) {
    try {
        await state.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await state.peerConnection.createAnswer();
        await state.peerConnection.setLocalDescription(answer);
        sendSignal('answer', answer);
    } catch (error) {
        console.error('Error handling offer:', error);
    }
}

async function handleAnswer(answer) {
    try {
        await state.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
        console.error('Error handling answer:', error);
    }
}

async function handleIceCandidate(candidate) {
    try {
        await state.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
        console.error('Error handling ICE candidate:', error);
    }
}

// ============================================
// WebRTC Signaling
// ============================================

async function setupSignalingSubscription() {
    if (state.subscriptions.signals) {
        await state.subscriptions.signals.unsubscribe();
    }
    
    state.subscriptions.signals = supabase
        .channel(`signals-${state.userId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'signals',
            filter: `receiver_id=eq.${state.userId}`
        }, async (payload) => {
            const signal = payload.new;
            
            switch (signal.type) {
                case 'offer':
                    await handleOffer(signal.data);
                    break;
                case 'answer':
                    await handleAnswer(signal.data);
                    break;
                case 'ice-candidate':
                    await handleIceCandidate(signal.data);
                    break;
            }
            
            // Delete processed signal
            await supabase
                .from('signals')
                .delete()
                .eq('id', signal.id);
        })
        .subscribe();
}

async function sendSignal(type, data) {
    const { error } = await supabase
        .from('signals')
        .insert({
            id: generateId(),
            sender_id: state.userId,
            receiver_id: state.partnerId,
            type: type,
            data: data,
            created_at: new Date().toISOString()
        });
    
    if (error) {
        console.error('Error sending signal:', error);
    }
}

// ============================================
// Video Controls
// ============================================

function toggleCamera() {
    if (!state.localStream) return;
    
    const videoTrack = state.localStream.getVideoTracks()[0];
    if (videoTrack) {
        state.isCameraOn = !state.isCameraOn;
        videoTrack.enabled = state.isCameraOn;
        
        const btn = elements.toggleCameraBtn;
        btn.classList.toggle('active', state.isCameraOn);
        btn.querySelector('.icon-on').classList.toggle('hidden', !state.isCameraOn);
        btn.querySelector('.icon-off').classList.toggle('hidden', state.isCameraOn);
        
        // Show/hide self video
        elements.selfVideo.style.display = state.isCameraOn ? 'block' : 'none';
        elements.selfVideoWrapper.querySelector('.video-placeholder').style.display = 
            state.isCameraOn ? 'none' : 'flex';
    }
}

function toggleMicrophone() {
    if (!state.localStream) return;
    
    const audioTrack = state.localStream.getAudioTracks()[0];
    if (audioTrack) {
        state.isMicOn = !state.isMicOn;
        audioTrack.enabled = state.isMicOn;
        
        const btn = elements.toggleMicBtn;
        btn.classList.toggle('active', state.isMicOn);
        btn.querySelector('.icon-on').classList.toggle('hidden', !state.isMicOn);
        btn.querySelector('.icon-off').classList.toggle('hidden', state.isMicOn);
    }
}

async function switchCamera() {
    if (!state.localStream) return;
    
    state.facingMode = state.facingMode === 'user' ? 'environment' : 'user';
    
    const videoTrack = state.localStream.getVideoTracks()[0];
    if (videoTrack) {
        try {
            await videoTrack.applyConstraints({
                facingMode: state.facingMode
            });
        } catch (error) {
            // Some devices don't support camera switching
            console.log('Camera switch not supported');
        }
    }
}

function toggleFullscreen() {
    const videoWrapper = elements.strangerVideo.parentElement;
    
    if (!state.isFullscreen) {
        if (videoWrapper.requestFullscreen) {
            videoWrapper.requestFullscreen();
        } else if (videoWrapper.webkitRequestFullscreen) {
            videoWrapper.webkitRequestFullscreen();
        } else if (videoWrapper.msRequestFullscreen) {
            videoWrapper.msRequestFullscreen();
        }
        state.isFullscreen = true;
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
        state.isFullscreen = false;
    }
}

function updateStrangerStatus(status, isConnected) {
    const statusEl = elements.strangerStatus;
    const indicator = statusEl.querySelector('.status-indicator');
    const label = statusEl.querySelector('.status-label');
    
    label.textContent = status;
    indicator.style.background = isConnected ? 'var(--success)' : 'var(--danger)';
}

async function handleConnectionLost() {
    showToast('Connection lost. Attempting to reconnect...', 'warning');
    
    // Try to reconnect WebRTC
    if (state.isVideoMode && state.peerConnection) {
        try {
            // Restart ICE
            const offer = await state.peerConnection.createOffer({ iceRestart: true });
            await state.peerConnection.setLocalDescription(offer);
            sendSignal('offer', offer);
        } catch (error) {
            console.error('Error restarting ICE:', error);
        }
    }
}

// ============================================
// Rate Limiting
// ============================================

function checkRateLimit() {
    const now = Date.now();
    
    if (!state.messageCountReset || now - state.messageCountReset > 10000) {
        state.messageCount = 0;
        state.messageCountReset = now;
    }
    
    state.messageCount++;
    
    return state.messageCount <= CONFIG.MESSAGE_RATE_LIMIT;
}

// ============================================
// Inactivity Detection
// ============================================

function startInactivityTimer() {
    clearTimeout(state.inactivityTimer);
    
    state.inactivityTimer = setTimeout(() => {
        if (state.isActive) {
            showToast('Disconnected due to inactivity.', 'warning');
            endChat();
        }
    }, CONFIG.INACTIVE_TIMEOUT);
}

function updateActivity() {
    state.lastActivity = Date.now();
    startInactivityTimer();
}

// ============================================
// End Chat / Next
// ============================================

async function endChat() {
    state.isActive = false;
    
    // Clean up subscriptions
    if (state.subscriptions.messages) {
        await state.subscriptions.messages.unsubscribe();
        state.subscriptions.messages = null;
    }
    
    if (state.subscriptions.signals) {
        await state.subscriptions.signals.unsubscribe();
        state.subscriptions.signals = null;
    }
    
    // Clean up WebRTC
    if (state.peerConnection) {
        state.peerConnection.close();
        state.peerConnection = null;
    }
    
    if (state.localStream) {
        state.localStream.getTracks().forEach(track => track.stop());
        state.localStream = null;
    }
    
    // Clean up room
    await cleanupUserRooms();
    
    state.roomId = null;
    state.partnerId = null;
    
    showScreen('welcome');
    updateConnectionStatus('connected');
}

async function nextStranger() {
    // End current chat
    await endChat();
    
    // Start new matchmaking
    await startMatchmaking(state.isVideoMode);
}

// ============================================
// Report System
// ============================================

function openReportModal() {
    state.isReportModalOpen = true;
    elements.reportModal.classList.remove('hidden');
}

function closeReportModal() {
    state.isReportModalOpen = false;
    elements.reportModal.classList.add('hidden');
    
    // Reset form
    document.querySelectorAll('input[name="report-reason"]').forEach(radio => {
        radio.checked = false;
    });
    elements.reportDetails.value = '';
}

async function submitReport() {
    const selectedReason = document.querySelector('input[name="report-reason"]:checked');
    
    if (!selectedReason) {
        showToast('Please select a reason for reporting.', 'warning');
        return;
    }
    
    const reason = selectedReason.value;
    const details = elements.reportDetails.value.trim();
    
    const { error } = await supabase
        .from('reports')
        .insert({
            id: generateId(),
            reporter_id: state.userId,
            reported_id: state.partnerId,
            room_id: state.roomId,
            reason: reason,
            details: details,
            created_at: new Date().toISOString()
        });
    
    if (error) {
        console.error('Error submitting report:', error);
        showToast('Failed to submit report.', 'error');
        return;
    }
    
    showToast('Report submitted successfully. Thank you for helping keep our community safe.', 'success');
    closeReportModal();
    
    // End chat after reporting
    await endChat();
}

// ============================================
// Emoji Picker
// ============================================

function setupEmojiPicker() {
    const picker = document.querySelector('emoji-picker');
    
    picker.addEventListener('emoji-click', (event) => {
        const emoji = event.detail.unicode;
        const input = elements.messageInput;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        
        input.value = input.value.substring(0, start) + emoji + input.value.substring(end);
        input.selectionStart = input.selectionEnd = start + emoji.length;
        input.focus();
    });
}

function toggleEmojiPicker() {
    elements.emojiPickerContainer.classList.toggle('hidden');
}

// ============================================
// Event Listeners
// ============================================

function setupEventListeners() {
    // Welcome screen
    elements.startVideoBtn.addEventListener('click', () => startMatchmaking(true));
    elements.startTextBtn.addEventListener('click', () => startMatchmaking(false));
    
    // Matching screen
    elements.cancelMatchingBtn.addEventListener('click', cancelMatchmaking);
    
    // Chat actions
    elements.nextBtn.addEventListener('click', nextStranger);
    elements.stopBtn.addEventListener('click', endChat);
    elements.reportBtn.addEventListener('click', openReportModal);
    
    // Message input
    elements.messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(elements.messageInput.value);
        }
    });
    
    elements.messageInput.addEventListener('input', handleTyping);
    
    elements.sendBtn.addEventListener('click', () => {
        sendMessage(elements.messageInput.value);
    });
    
    // Emoji
    elements.emojiBtn.addEventListener('click', toggleEmojiPicker);
    
    // File attachment
    elements.attachBtn.addEventListener('click', () => {
        elements.fileInput.click();
    });
    
    elements.fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            handleFileSelect(e.target.files[0]);
            e.target.value = '';
        }
    });
    
    // Drag and drop
    const chatInputWrapper = elements.messageInput.closest('.chat-input-wrapper');
    
    chatInputWrapper.addEventListener('dragover', (e) => {
        e.preventDefault();
        chatInputWrapper.classList.add('drag-over');
    });
    
    chatInputWrapper.addEventListener('dragleave', () => {
        chatInputWrapper.classList.remove('drag-over');
    });
    
    chatInputWrapper.addEventListener('drop', (e) => {
        e.preventDefault();
        chatInputWrapper.classList.remove('drag-over');
        
        if (e.dataTransfer.files[0]) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });
    
    // Video controls
    elements.toggleCameraBtn.addEventListener('click', toggleCamera);
    elements.toggleMicBtn.addEventListener('click', toggleMicrophone);
    elements.switchCameraBtn.addEventListener('click', switchCamera);
    elements.fullscreenBtn.addEventListener('click', toggleFullscreen);
    
    // Report modal
    elements.closeReportModal.addEventListener('click', closeReportModal);
    elements.cancelReportBtn.addEventListener('click', closeReportModal);
    elements.submitReportBtn.addEventListener('click', submitReport);
    
    elements.reportModal.querySelector('.modal-overlay').addEventListener('click', closeReportModal);
    
    // Activity tracking
    document.addEventListener('mousemove', updateActivity);
    document.addEventListener('keypress', updateActivity);
    document.addEventListener('click', updateActivity);
    
    // Handle page unload
    window.addEventListener('beforeunload', () => {
        cleanupUserRooms();
    });
    
    // Handle visibility change
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            updateActivity();
        }
    });
    
    // Close emoji picker when clicking outside
    document.addEventListener('click', (e) => {
        if (!elements.emojiBtn.contains(e.target) && 
            !elements.emojiPickerContainer.contains(e.target)) {
            elements.emojiPickerContainer.classList.add('hidden');
        }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // ESC to close modals
        if (e.key === 'Escape') {
            if (state.isReportModalOpen) {
                closeReportModal();
            }
            if (!elements.emojiPickerContainer.classList.contains('hidden')) {
                elements.emojiPickerContainer.classList.add('hidden');
            }
        }
        
        // F for fullscreen
        if (e.key === 'f' && state.isVideoMode && state.isActive) {
            toggleFullscreen();
        }
        
        // M for mute
        if (e.key === 'm' && state.isVideoMode && state.isActive) {
            toggleMicrophone();
        }
        
        // C for camera
        if (e.key === 'c' && state.isVideoMode && state.isActive) {
            toggleCamera();
        }
    });
}

// ============================================
// Cleanup Inactive Rooms (Server-side would be better)
// ============================================

async function cleanupInactiveRooms() {
    try {
        await supabase
            .from('rooms')
            .delete()
            .lt('expires_at', new Date().toISOString());
        
        await supabase
            .from('signals')
            .delete()
            .lt('created_at', new Date(Date.now() - 300000).toISOString()); // 5 minutes old
    } catch (error) {
        console.error('Cleanup error:', error);
    }
}

// ============================================
// Initialize App
// ============================================

async function init() {
    console.log('AnonChat initializing...');
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup emoji picker
    setupEmojiPicker();
    
    // Initialize Supabase
    await initializeSupabase();
    
    // Run cleanup periodically
    setInterval(cleanupInactiveRooms, 60000); // Every minute
    
    console.log('AnonChat initialized successfully');
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}