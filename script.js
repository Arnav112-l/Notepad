// Get DOM elements
const textArea = document.getElementById('textArea');
const docTitle = document.getElementById('docTitle');
const charCount = document.getElementById('charCount');
const wordCount = document.getElementById('wordCount');
const lastSaved = document.getElementById('lastSaved');
const saveText = document.getElementById('saveText');
const collabStatus = document.getElementById('collabStatus');
const activeUsersSpan = document.getElementById('activeUsers');
const newBtn = document.getElementById('newBtn');
const saveBtn = document.getElementById('saveBtn');
const clearBtn = document.getElementById('clearBtn');
const copyBtn = document.getElementById('copyBtn');
const shareBtn = document.getElementById('shareBtn');
const fontSize = document.getElementById('fontSize');
const fontFamily = document.getElementById('fontFamily');
const themeToggle = document.getElementById('themeToggle');
const tabsWrapper = document.getElementById('tabsWrapper');
const addTabBtn = document.getElementById('addTabBtn');
const shareModal = document.getElementById('shareModal');
const closeModal = document.getElementById('closeModal');
const shareLinkInput = document.getElementById('shareLinkInput');
const copyLinkBtn = document.getElementById('copyLinkBtn');

// Auto-save timer
let autoSaveTimer = null;

// Check if server is available
let serverAvailable = false;
let currentDocName = 'untitled';

// Tabs management
let tabs = [];
let activeTabId = 1;
let nextTabId = 2;

// Collaboration
let socket = null;
let isCollaborating = false;
let currentSessionId = null;
let isReceivingUpdate = false;

// Check server connectivity
async function checkServer() {
    try {
        const response = await fetch('/api/documents');
        serverAvailable = response.ok;
        if (serverAvailable) {
            console.log('✅ Server auto-save enabled');
            initializeSocket();
        }
    } catch (error) {
        serverAvailable = false;
        console.log('📱 Using local storage (server not available)');
    }
    return serverAvailable;
}

// Initialize Socket.IO for collaboration
function initializeSocket() {
    if (typeof io !== 'undefined') {
        try {
            socket = io({
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionAttempts: 5
            });
            
            socket.on('connect', () => {
                console.log('🔗 Connected to collaboration server');
                
                // If we detected a collaborative session before socket was ready, join now
                if (currentSessionId && !isCollaborating) {
                    joinCollaborativeSession(currentSessionId);
                } else if (currentSessionId && isCollaborating) {
                    // Rejoin if we got disconnected and reconnected
                    socket.emit('join-session', currentSessionId);
                    console.log('🔄 Rejoined collaborative session');
                }
            });
            
            socket.on('disconnect', () => {
                console.log('❌ Disconnected from collaboration server');
                if (isCollaborating) {
                    saveText.textContent = 'Reconnecting...';
                }
            });
            
            socket.on('connect_error', (error) => {
                console.error('Socket connection error:', error);
            });
            
            socket.on('load-content', ({ title, content }) => {
                isReceivingUpdate = true;
                docTitle.value = title;
                textArea.value = content;
                updateCounts();
                isReceivingUpdate = false;
            });
            
            socket.on('content-update', ({ content, userId }) => {
                if (!isReceivingUpdate) {
                    isReceivingUpdate = true;
                    const cursorPos = textArea.selectionStart;
                    textArea.value = content;
                    textArea.selectionStart = textArea.selectionEnd = cursorPos;
                    updateCounts();
                    isReceivingUpdate = false;
                }
            });
            
            socket.on('title-update', ({ title }) => {
                isReceivingUpdate = true;
                docTitle.value = title;
                isReceivingUpdate = false;
            });
            
            socket.on('user-joined', ({ activeUsers }) => {
                activeUsersSpan.textContent = `${activeUsers} ${activeUsers === 1 ? 'user' : 'users'}`;
            });
            
            socket.on('user-left', ({ activeUsers }) => {
                activeUsersSpan.textContent = `${activeUsers} ${activeUsers === 1 ? 'user' : 'users'}`;
            });
        } catch (error) {
            console.error('Failed to initialize Socket.io:', error);
        }
    } else {
        console.warn('Socket.io not loaded. Collaboration features disabled.');
    }
}

// Check if we're in a collaborative session (from URL)
function checkCollaborativeSession() {
    const path = window.location.pathname;
    const match = path.match(/\/collaborate\/([a-f0-9-]+)/);
    
    if (match) {
        currentSessionId = match[1];
        // Socket will handle joining when it connects
        return true;
    }
    return false;
}

// Join collaborative session
async function joinCollaborativeSession(sessionId) {
    try {
        console.log('Attempting to join session:', sessionId);
        const response = await fetch(`/api/collaborate/${sessionId}`);
        const data = await response.json();
        
        if (data.success) {
            isCollaborating = true;
            currentSessionId = sessionId;
            
            if (socket && socket.connected) {
                socket.emit('join-session', sessionId);
                console.log('✅ Joined collaborative session');
            } else {
                console.warn('Socket not connected yet, will join when ready');
            }
            
            collabStatus.style.display = 'flex';
            activeUsersSpan.textContent = `${data.session.activeUsers} ${data.session.activeUsers === 1 ? 'user' : 'users'}`;
            saveText.textContent = 'Collaborating';
            
            // Load initial content
            docTitle.value = data.session.title;
            textArea.value = data.session.content;
            updateCounts();
        } else {
            console.error('Session not found');
            alert('This collaborative session does not exist or has expired.');
        }
    } catch (error) {
        console.error('Failed to join session:', error);
        alert('Failed to connect to collaborative session. Please check your connection.');
    }
}

// Initialize tabs
function initializeTabs() {
    tabs = [{
        id: 1,
        title: 'Untitled Document',
        content: '',
        docName: 'untitled'
    }];
    
    // Load saved tabs
    const savedTabs = localStorage.getItem('notepadTabs');
    const savedActiveId = localStorage.getItem('notepadActiveTabId');
    
    if (savedTabs) {
        tabs = JSON.parse(savedTabs);
        activeTabId = savedActiveId ? parseInt(savedActiveId) : tabs[0].id;
        nextTabId = Math.max(...tabs.map(t => t.id)) + 1;
        renderTabs();
        switchToTab(activeTabId);
    } else {
        renderTabs();
    }
}

// Render tabs
function renderTabs() {
    tabsWrapper.innerHTML = '';
    
    tabs.forEach(tab => {
        const tabElement = document.createElement('div');
        tabElement.className = `tab ${tab.id === activeTabId ? 'active' : ''}`;
        tabElement.dataset.tabId = tab.id;
        
        tabElement.innerHTML = `
            <span class="tab-title">${tab.title}</span>
            <button class="tab-close" title="Close tab">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;
        
        // Tab click handler
        tabElement.addEventListener('click', (e) => {
            if (!e.target.closest('.tab-close')) {
                switchToTab(tab.id);
            }
        });
        
        // Close button handler
        tabElement.querySelector('.tab-close').addEventListener('click', (e) => {
            e.stopPropagation();
            closeTab(tab.id);
        });
        
        tabsWrapper.appendChild(tabElement);
    });
}

// Switch to tab
function switchToTab(tabId) {
    // Save current tab content
    const currentTab = tabs.find(t => t.id === activeTabId);
    if (currentTab) {
        currentTab.content = textArea.value;
        currentTab.title = docTitle.value;
        currentTab.docName = currentDocName;
    }
    
    // Switch to new tab
    activeTabId = tabId;
    const tab = tabs.find(t => t.id === tabId);
    
    if (tab) {
        textArea.value = tab.content;
        docTitle.value = tab.title;
        currentDocName = tab.docName;
        updateCounts();
        renderTabs();
        saveTabs();
    }
}

// Add new tab
function addTab() {
    const newTab = {
        id: nextTabId++,
        title: 'Untitled Document',
        content: '',
        docName: 'untitled_' + Date.now()
    };
    
    tabs.push(newTab);
    switchToTab(newTab.id);
}

// Close tab
function closeTab(tabId) {
    if (tabs.length === 1) {
        alert('Cannot close the last tab!');
        return;
    }
    
    const tabIndex = tabs.findIndex(t => t.id === tabId);
    
    if (tabIndex === -1) return;
    
    tabs.splice(tabIndex, 1);
    
    // Switch to adjacent tab
    if (tabId === activeTabId) {
        const newActiveTab = tabs[Math.min(tabIndex, tabs.length - 1)];
        switchToTab(newActiveTab.id);
    } else {
        renderTabs();
        saveTabs();
    }
}

// Save tabs to localStorage
function saveTabs() {
    localStorage.setItem('notepadTabs', JSON.stringify(tabs));
    localStorage.setItem('notepadActiveTabId', activeTabId.toString());
}

// Load saved content from localStorage
window.addEventListener('load', async () => {
    // Check server availability
    await checkServer();
    
    // Check if accessing collaborative session
    const isCollab = checkCollaborativeSession();
    
    // Initialize tabs only if not in collaborative mode
    if (!isCollab) {
        initializeTabs();
    } else {
        // Hide tabs in collaborative mode
        const tabsContainer = document.querySelector('.tabs-container');
        if (tabsContainer) {
            tabsContainer.style.display = 'none';
        }
    }
    
    const savedFontSize = localStorage.getItem('notepadFontSize');
    const savedFontFamily = localStorage.getItem('notepadFontFamily');
    const savedTheme = localStorage.getItem('notepadTheme');
    
    if (savedFontSize) {
        fontSize.value = savedFontSize;
        textArea.style.fontSize = savedFontSize + 'px';
    }
    
    if (savedFontFamily) {
        fontFamily.value = savedFontFamily;
        textArea.style.fontFamily = savedFontFamily;
    }
    
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
    }
    
    const savedTime = localStorage.getItem('notepadLastSaved');
    if (savedTime) {
        saveText.textContent = 'Saved ' + formatTime(savedTime);
    }
    
    // Update save time periodically
    setInterval(() => {
        const time = localStorage.getItem('notepadLastSaved');
        if (time) {
            saveText.textContent = 'Saved ' + formatTime(time);
        }
    }, 10000); // Update every 10 seconds
});

// Format time helper
function formatTime(timestamp) {
    const now = new Date();
    const saved = new Date(timestamp);
    const diff = Math.floor((now - saved) / 1000); // seconds
    
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
    if (diff < 86400) return Math.floor(diff / 3600) + ' hr ago';
    return saved.toLocaleDateString();
}

// Update character and word count
function updateCounts() {
    const text = textArea.value;
    const chars = text.length;
    const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
    
    charCount.textContent = `${chars} chars`;
    wordCount.textContent = `${words} words`;
}

// Auto-save to localStorage and server
async function autoSave() {
    // Show saving indicator
    lastSaved.classList.add('saving');
    saveText.textContent = 'Saving...';
    
    // Clear existing timer
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
    }
    
    // Save after 500ms delay (debounce)
    autoSaveTimer = setTimeout(async () => {
        const currentTime = new Date().toISOString();
        
        // Always save to localStorage
        localStorage.setItem('notepadText', textArea.value);
        localStorage.setItem('notepadLastSaved', currentTime);
        
        // Try to save to server if available
        if (serverAvailable) {
            try {
                const response = await fetch('/api/save', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        content: textArea.value,
                        filename: currentDocName
                    })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    saveText.textContent = 'Saved to server ' + formatTime(data.timestamp);
                } else {
                    saveText.textContent = 'Saved locally ' + formatTime(currentTime);
                }
            } catch (error) {
                console.error('Server save failed:', error);
                saveText.textContent = 'Saved locally ' + formatTime(currentTime);
                serverAvailable = false;
            }
        } else {
            saveText.textContent = 'Saved locally ' + formatTime(currentTime);
        }
        
        lastSaved.classList.remove('saving');
    }, 500);
}

// Event listener for text changes
textArea.addEventListener('input', () => {
    updateCounts();
    
    // Send to collaborative session
    if (isCollaborating && socket && !isReceivingUpdate) {
        socket.emit('content-change', {
            sessionId: currentSessionId,
            content: textArea.value,
            cursorPosition: textArea.selectionStart
        });
    }
    
    // Update current tab content
    if (!isCollaborating) {
        const currentTab = tabs.find(t => t.id === activeTabId);
        if (currentTab) {
            currentTab.content = textArea.value;
            saveTabs();
        }
    }
    
    autoSave();
});

// Event listener for document title changes
docTitle.addEventListener('input', () => {
    const title = docTitle.value.trim() || 'Untitled Document';
    currentDocName = title.toLowerCase().replace(/\s+/g, '_');
    
    // Send to collaborative session
    if (isCollaborating && socket && !isReceivingUpdate) {
        socket.emit('title-change', {
            sessionId: currentSessionId,
            title: docTitle.value
        });
    }
    
    // Update current tab title
    if (!isCollaborating) {
        const currentTab = tabs.find(t => t.id === activeTabId);
        if (currentTab) {
            currentTab.title = docTitle.value;
            currentTab.docName = currentDocName;
            renderTabs();
            saveTabs();
        }
    }
    
    autoSave();
});

// Add tab button
addTabBtn.addEventListener('click', () => {
    addTab();
    showSuccess(addTabBtn);
});

// Share button
shareBtn.addEventListener('click', async () => {
    if (!serverAvailable) {
        alert('Collaboration requires a server connection. Please run the server with "npm start".');
        return;
    }
    
    try {
        const response = await fetch('/api/collaborate/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: docTitle.value,
                content: textArea.value
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            shareLinkInput.value = data.shareUrl;
            shareModal.style.display = 'flex';
        }
    } catch (error) {
        console.error('Failed to create share link:', error);
        alert('Failed to create share link');
    }
});

// Close modal
closeModal.addEventListener('click', () => {
    shareModal.style.display = 'none';
});

shareModal.addEventListener('click', (e) => {
    if (e.target === shareModal) {
        shareModal.style.display = 'none';
    }
});

// Copy share link
copyLinkBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(shareLinkInput.value);
        copyLinkBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>Copied!';
        setTimeout(() => {
            copyLinkBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy';
        }, 2000);
    } catch (error) {
        alert('Failed to copy link');
    }
});

// New document (adds new tab)
newBtn.addEventListener('click', () => {
    addTab();
    showSuccess(newBtn);
});

// Save as text file
saveBtn.addEventListener('click', () => {
    const text = textArea.value;
    if (text.trim() === '') {
        alert('Nothing to save! Please write something first.');
        return;
    }
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = docTitle.value.trim() || 'Untitled';
    a.download = filename + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    const currentTime = new Date().toISOString();
    localStorage.setItem('notepadLastSaved', currentTime);
    saveText.textContent = 'Downloaded ' + formatTime(currentTime);
    showSuccess(saveBtn);
});

// Clear all text
clearBtn.addEventListener('click', () => {
    if (textArea.value.trim() !== '') {
        if (confirm('Clear all text? This cannot be undone.')) {
            textArea.value = '';
            updateCounts();
            autoSave();
            showSuccess(clearBtn);
        }
    } else {
        alert('Nothing to clear!');
    }
});

// Copy to clipboard
copyBtn.addEventListener('click', async () => {
    if (textArea.value.trim() === '') {
        alert('Nothing to copy! Please write something first.');
        return;
    }
    
    try {
        await navigator.clipboard.writeText(textArea.value);
        const originalText = copyBtn.querySelector('span').textContent;
        copyBtn.querySelector('span').textContent = 'Copied!';
        showSuccess(copyBtn);
        
        setTimeout(() => {
            copyBtn.querySelector('span').textContent = originalText;
        }, 2000);
    } catch (err) {
        alert('Failed to copy text to clipboard');
    }
});

// Font size change
fontSize.addEventListener('change', (e) => {
    textArea.style.fontSize = e.target.value + 'px';
    localStorage.setItem('notepadFontSize', e.target.value);
});

// Font family change
fontFamily.addEventListener('change', (e) => {
    textArea.style.fontFamily = e.target.value;
    localStorage.setItem('notepadFontFamily', e.target.value);
});

// Dark mode toggle
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('notepadTheme', isDarkMode ? 'dark' : 'light');
});

// Show success feedback
function showSuccess(button) {
    button.classList.add('success');
    setTimeout(() => {
        button.classList.remove('success');
    }, 500);
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl+S to save
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveBtn.click();
    }
    
    // Ctrl+N for new document
    if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        newBtn.click();
    }
    
    // Ctrl+Shift+C to copy
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        copyBtn.click();
    }
    
    // Ctrl+T to new tab
    if (e.ctrlKey && e.key === 't') {
        e.preventDefault();
        addTab();
    }
    
    // Ctrl+W to close tab
    if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        closeTab(activeTabId);
    }
});

// Tab support in textarea
textArea.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        e.preventDefault();
        const start = textArea.selectionStart;
        const end = textArea.selectionEnd;
        textArea.value = textArea.value.substring(0, start) + '    ' + textArea.value.substring(end);
        textArea.selectionStart = textArea.selectionEnd = start + 4;
    }
});

// Auto-focus textarea on load
textArea.focus();

// Initialize counts
updateCounts();

// Update active nav button
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});
