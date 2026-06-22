// ============================================================
// public/js/chat-widget.js
// Floating Chat Toggle Widget — Asyle Data Solutions
// Only activates when user is logged in (window.CHAT_USER set)
// ============================================================

(function () {
    // ── Guard: only run if user is logged in ─────────────────
    // ── Guard: only run if CHAT_USER is present (guest or logged in) ──
    if (!window.CHAT_USER) return;

    const ADMIN_ID = 0;
    const USER_ID = window.CHAT_USER.id;
    const USER_NAME = window.CHAT_USER.username;

    let isOpen = false;
    let unreadCount = 0;
    let typingTimer = null;
    let adminOnline = false;

    // ── Inject HTML ───────────────────────────────────────────
    document.body.insertAdjacentHTML('beforeend', `
        <!-- Floating Chat FAB -->
        <button class="chat-fab" id="cwFab" aria-label="Open Support Chat">
            <i class="fas fa-comment-dots" id="cwFabIcon"></i>
            <span class="chat-fab-badge" id="cwBadge">0</span>
        </button>

        <!-- Chat Window -->
        <div class="chat-widget-window" id="cwWindow">

            <!-- Header -->
            <div class="cw-header">
                <div class="cw-user">
                    <div class="cw-avatar" id="cwAvatar">
                        AS
                        <div class="cw-dot" id="cwDot"></div>
                    </div>
                    <div class="cw-info">
                        <h4>Asyle Support</h4>
                        <p id="cwStatusText">Connecting...</p>
                    </div>
                </div>
                <div class="cw-header-actions">
                    <span class="cw-status-badge live" id="cwStatusBadge">LIVE</span>
                    <button class="cw-action-btn" id="cwClearBtn" title="Clear chat">
                        <i class="fas fa-eraser"></i>
                    </button>
                    <button class="cw-action-btn" id="cwCloseBtn" title="Close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>

            <!-- Messages -->
            <div class="cw-messages" id="cwMessages"></div>

            <!-- Emoji Picker -->
            <div class="cw-emoji-picker" id="cwEmojiPicker">
                <div class="cw-emoji-grid" id="cwEmojiGrid"></div>
            </div>

            <!-- Input Area -->
            <div class="cw-input-area">
                <button class="cw-btn" id="cwEmojiBtn" title="Emoji">😊</button>
                <div class="cw-input-wrap">
                    <button class="cw-btn" id="cwAttachBtn" title="Attach file">
                        <i class="fas fa-paperclip"></i>
                    </button>
                    <textarea class="cw-input" id="cwInput" placeholder="Type a message..." rows="1"></textarea>
                </div>
                <button class="cw-send-btn" id="cwSendBtn" title="Send">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        </div>

        <!-- Hidden file input -->
        <input type="file" id="cwFileInput" style="display:none"
               accept="image/*,.pdf,.doc,.docx,.txt">
    `);

    // ── Element refs ──────────────────────────────────────────
    const fab = document.getElementById('cwFab');
    const fabIcon = document.getElementById('cwFabIcon');
    const badge = document.getElementById('cwBadge');
    const win = document.getElementById('cwWindow');
    const msgs = document.getElementById('cwMessages');
    const input = document.getElementById('cwInput');
    const sendBtn = document.getElementById('cwSendBtn');
    const closeBtn = document.getElementById('cwCloseBtn');
    const clearBtn = document.getElementById('cwClearBtn');
    const attachBtn = document.getElementById('cwAttachBtn');
    const fileInput = document.getElementById('cwFileInput');
    const emojiBtn = document.getElementById('cwEmojiBtn');
    const emojiPicker = document.getElementById('cwEmojiPicker');
    const emojiGrid = document.getElementById('cwEmojiGrid');
    const statusText = document.getElementById('cwStatusText');
    const statusBadge = document.getElementById('cwStatusBadge');
    const dot = document.getElementById('cwDot');
    const avatar = document.getElementById('cwAvatar');

    // ── Socket.io ─────────────────────────────────────────────
    // Re-use existing socket if dashboard already created one,
    // otherwise create a new connection.
    const socket = window.socket || io();
    window.socket = socket; // share globally

    // ── Toggle open/close ─────────────────────────────────────
    function toggleWidget() {
        isOpen = !isOpen;
        win.classList.toggle('open', isOpen);
        fab.classList.toggle('open', isOpen);
        fabIcon.className = isOpen ? 'fas fa-times' : 'fas fa-comment-dots';

        if (isOpen) {
            clearBadge();
            scrollToBottom();
            input.focus();
        }
    }

    fab.addEventListener('click', toggleWidget);
    closeBtn.addEventListener('click', toggleWidget);

    // ── Badge ─────────────────────────────────────────────────
    function incrementBadge() {
        if (isOpen) return;
        unreadCount++;
        badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
        badge.classList.add('show');
    }

    function clearBadge() {
        unreadCount = 0;
        badge.classList.remove('show');
    }

    // ── Admin status UI ───────────────────────────────────────
    function setAdminStatus(online) {
        adminOnline = online;
        adminOnline = online;
        if (online) {
            statusText.textContent = '🟢 Support Online';
            // Reset styles for online
            statusText.style.color = '#10b981'; // Green
            statusBadge.textContent = 'LIVE';
            statusBadge.className = 'cw-status-badge live';
            dot.style.background = '#10b981';

            // Remove bot avatar if present
            if (avatar.classList.contains('bot-avatar')) {
                avatar.classList.remove('bot-avatar');
                avatar.innerHTML = 'AS<div class="cw-dot" id="cwDot" style="background: #10b981;"></div>';
                // Re-capture dot reference
                // dot = document.getElementById('cwDot'); // Not strictly needed if we don't use it immediately
            }
        } else {
            statusText.textContent = '🤖 AI Assistant Active';
            statusText.style.color = '#a78bfa';
            statusBadge.textContent = 'AI';
            statusBadge.className = 'cw-status-badge ai';
            dot.style.background = '#8b5cf6';
            avatar.classList.add('bot-avatar');
        }
    }

    socket.on('admin_status', (data) => setAdminStatus(data.online));

    // ── Load history ──────────────────────────────────────────
    function loadHistory() {
        fetch(`/chat/history/${ADMIN_ID}`)
            .then(r => r.json())
            .then(messages => {
                msgs.innerHTML = '';
                if (!messages || messages.length === 0) {
                    showEmpty();
                    return;
                }
                let lastDate = null;
                messages.forEach(msg => {
                    if (msg.is_deleted || msg.deleted_for_customer) return;
                    const d = new Date(msg.created_at).toDateString();
                    if (d !== lastDate) { lastDate = d; msgs.appendChild(makeDateDivider(msg.created_at)); }
                    msgs.appendChild(makeMsgEl(msg));
                });
                scrollToBottom();
            })
            .catch(() => showEmpty());
    }

    function showEmpty() {
        msgs.innerHTML = `
            <div class="cw-empty">
                <i class="fas fa-comment-dots"></i>
                <h4>Start a Conversation</h4>
                <p>Send a message to our support team or AI assistant</p>
            </div>`;
    }

    // ── Build message element ─────────────────────────────────
    function makeMsgEl(msg) {
        const isOut = msg.sender_role === 'customer';
        const isAI = !!msg.isAI;

        const div = document.createElement('div');
        div.className = `cw-msg ${isOut ? 'out' : 'in'}${isAI ? ' ai' : ''}`;
        div.id = `cwm-${msg.id}`;

        if (msg.is_deleted) {
            div.classList.add('deleted');
            div.innerHTML = `<div class="cw-bubble"><i class="fas fa-ban me-1"></i><em>This message was deleted</em></div>`;
            return div;
        }

        const time = new Date(msg.created_at || Date.now())
            .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        let inner = '';

        if (isAI) {
            inner += `<div class="cw-ai-pill"><i class="fas fa-robot"></i> AI</div>`;
        }

        if (msg.type === 'image' && msg.file_path) {
            inner += `<div class="cw-img-attach" onclick="window.open('${msg.file_path}','_blank')">
                        <img src="${msg.file_path}" alt="Image" loading="lazy">
                      </div>`;
        } else if (msg.type === 'file' && msg.file_path) {
            inner += `<div class="cw-file-attach">
                        <div class="cw-file-icon"><i class="fas fa-file-alt"></i></div>
                        <div class="cw-file-info">
                            <div class="cw-file-name">${esc(msg.file_name || 'File')}</div>
                            <div class="cw-file-size">${fmtSize(msg.file_size)}</div>
                        </div>
                        <a href="${msg.file_path}" download="${msg.file_name}" class="cw-file-dl">
                            <i class="fas fa-download"></i>
                        </a>
                      </div>`;
        }

        if (msg.message && msg.message.trim()) {
            inner += `<div style="font-size:0.875rem;line-height:1.5;">${esc(msg.message)}</div>`;
        }

        inner += `<div class="cw-time">${time}${isOut ? ' <i class="fas fa-check-double" style="color:#53bdeb;font-size:0.6rem;"></i>' : ''}</div>`;

        div.innerHTML = `<div class="cw-bubble">${inner}</div>`;
        return div;
    }

    function makeDateDivider(ts) {
        const d = new Date(ts);
        const today = new Date(); const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
        let label = d.toDateString() === today.toDateString() ? 'Today'
            : d.toDateString() === yesterday.toDateString() ? 'Yesterday'
                : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const div = document.createElement('div');
        div.className = 'cw-date-divider';
        div.innerHTML = `<span class="cw-date-label">${label}</span>`;
        return div;
    }

    // ── Send message ──────────────────────────────────────────
    function sendMsg() {
        const text = input.value.trim();
        if (!text) return;

        socket.emit('chat_message', { text, type: 'text' });

        removeEmpty();

        msgs.appendChild(makeMsgEl({
            id: 'tmp-' + Date.now(),
            sender_role: 'customer',
            message: text,
            created_at: new Date(),
            type: 'text'
        }));

        // Show AI thinking dots if admin offline
        if (!adminOnline) {
            setTimeout(() => {
                if (!document.getElementById('cwThinking')) {
                    const el = document.createElement('div');
                    el.id = 'cwThinking';
                    el.className = 'cw-typing ai-thinking';
                    el.innerHTML = '<span></span><span></span><span></span>';
                    msgs.appendChild(el);
                    scrollToBottom();
                }
            }, 700);
        }

        input.value = '';
        input.style.height = 'auto';
        scrollToBottom();
    }

    // ── Socket events ─────────────────────────────────────────
    socket.on('receive_message', (msg) => {
        if (msg.from === USER_ID) return; // own echo — ignore (we already rendered it)

        // Remove AI thinking dots
        if (msg.isAI) {
            const thinking = document.getElementById('cwThinking');
            if (thinking) thinking.remove();
        }

        removeEmpty();
        msgs.appendChild(makeMsgEl({
            id: msg.id,
            sender_role: 'admin',
            message: msg.text,
            created_at: new Date(),
            type: msg.type || 'text',
            file_path: msg.fileData?.filePath,
            file_name: msg.fileData?.fileName,
            file_size: msg.fileData?.fileSize,
            isAI: msg.isAI
        }));
        scrollToBottom();
        incrementBadge();
    });

    socket.on('display_typing', () => {
        if (!document.getElementById('cwTyping')) {
            const el = document.createElement('div');
            el.id = 'cwTyping';
            el.className = 'cw-typing';
            el.innerHTML = '<span></span><span></span><span></span>';
            msgs.appendChild(el);
            scrollToBottom();
        }
    });

    socket.on('hide_typing', () => {
        const el = document.getElementById('cwTyping');
        if (el) el.remove();
    });

    socket.on('message_deleted', (data) => {
        const el = document.getElementById(`cwm-${data.messageId}`);
        if (el) {
            el.classList.add('deleted');
            el.innerHTML = `<div class="cw-bubble"><i class="fas fa-ban me-1"></i><em>This message was deleted</em></div>`;
        }
    });

    // ── Clear chat ────────────────────────────────────────────
    clearBtn.addEventListener('click', () => {
        if (!confirm('Clear chat? Messages will be hidden for you only.')) return;
        fetch(`/chat/clear/${ADMIN_ID}`, { method: 'PUT' })
            .then(r => r.json())
            .then(d => { if (d.success) showEmpty(); });
    });

    // ── File upload ───────────────────────────────────────────
    attachBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        if (!file) return;

        const status = document.createElement('div');
        status.className = 'cw-upload-status';
        status.innerHTML = `<i class="fas fa-spinner fa-spin"></i><span>Uploading ${esc(file.name)}...</span>`;
        msgs.appendChild(status);
        scrollToBottom();

        const fd = new FormData();
        fd.append('file', file);

        try {
            const res = await fetch('/chat/upload', { method: 'POST', body: fd });
            const data = await res.json();
            status.remove();
            if (data.error) { alert(data.error); return; }

            socket.emit('chat_message', { text: '', type: data.type, fileData: data });

            removeEmpty();
            msgs.appendChild(makeMsgEl({
                id: 'tmp-' + Date.now(),
                sender_role: 'customer',
                message: '',
                created_at: new Date(),
                type: data.type,
                file_path: data.filePath,
                file_name: data.fileName,
                file_size: data.fileSize
            }));
            scrollToBottom();
        } catch {
            status.remove();
            alert('Upload failed. Please try again.');
        }
        fileInput.value = '';
    });

    // ── Input events ──────────────────────────────────────────
    sendBtn.addEventListener('click', sendMsg);

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
    });

    input.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 80) + 'px';
        socket.emit('typing');
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => socket.emit('stop_typing'), 1500);
    });

    // ── Emoji picker ──────────────────────────────────────────
    const EMOJIS = ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '🥺', '😢', '😭', '😤', '😠', '🤯', '😳', '😱', '🤗', '🤔', '👍', '👎', '👌', '✌️', '🤞', '👏', '🙌', '🙏', '💪', '❤️', '🧡', '💛', '💚', '💙', '💜', '🔥', '✨', '⭐', '💯', '✔️', '❌'];

    EMOJIS.forEach(e => {
        const item = document.createElement('div');
        item.className = 'cw-emoji-item';
        item.textContent = e;
        item.addEventListener('click', () => {
            input.value += e;
            input.focus();
            emojiPicker.classList.remove('show');
        });
        emojiGrid.appendChild(item);
    });

    emojiBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        emojiPicker.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
        if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) {
            emojiPicker.classList.remove('show');
        }
    });

    // ── Helpers ───────────────────────────────────────────────
    function scrollToBottom() {
        requestAnimationFrame(() => { msgs.scrollTop = msgs.scrollHeight; });
    }

    function removeEmpty() {
        const empty = msgs.querySelector('.cw-empty');
        if (empty) empty.remove();
    }

    function fmtSize(bytes) {
        if (!bytes) return '';
        const u = ['B', 'KB', 'MB', 'GB']; let s = bytes, i = 0;
        while (s >= 1024 && i < u.length - 1) { s /= 1024; i++; }
        return `${s.toFixed(1)} ${u[i]}`;
    }

    function esc(t) {
        const d = document.createElement('div');
        d.textContent = t;
        return d.innerHTML;
    }

    // ── Init ──────────────────────────────────────────────────
    loadHistory();

})();
