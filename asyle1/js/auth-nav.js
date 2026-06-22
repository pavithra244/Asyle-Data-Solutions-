// auth-nav.js — Asyle Data Solutions
// Dynamically shows the logged-in user's name + Logout button in the topbar.
// If no one is logged in, shows the regular Login / Registration links.

(function () {
    'use strict';

    /* ── Styles ─────────────────────────────────────────────────── */
    var css = `
        /* User greeting chip */
        .nav-user-chip {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: linear-gradient(135deg, rgba(253,101,13,0.15), rgba(253,101,13,0.05));
            border: 1px solid rgba(253,101,13,0.4);
            border-radius: 50px;
            padding: 5px 14px 5px 10px;
            font-size: 13px;
            font-weight: 600;
            color: #fd650d;
            letter-spacing: 0.3px;
            white-space: nowrap;
            animation: navUserFadeIn 0.5s ease;
        }
        .nav-user-chip .nav-user-avatar {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: linear-gradient(135deg, #fd650d, #e85900);
            color: #fff;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 700;
            flex-shrink: 0;
        }
        .nav-logout-btn {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            background: linear-gradient(135deg, #e74c3c, #c0392b);
            color: #fff !important;
            border: none;
            border-radius: 50px;
            padding: 5px 14px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none !important;
            transition: all 0.3s ease;
            white-space: nowrap;
            margin-left: 8px;
            animation: navUserFadeIn 0.5s ease;
        }
        .nav-logout-btn:hover {
            background: linear-gradient(135deg, #ff6b6b, #e74c3c);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(231,76,60,0.4);
            color: #fff !important;
        }
        @keyframes navUserFadeIn {
            from { opacity: 0; transform: translateY(-6px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        /* Hide login/reg list when logged in */
        .topbar-login-btn.auth-hidden {
            display: none !important;
        }
        /* Wrapper for user area to match topbar-login-btn spacing */
        .nav-user-area {
            display: inline-flex;
            align-items: center;
            gap: 12px;
            margin-right: 30px;
            padding-right: 30px;
            border-right: 1px solid rgba(255, 255, 255, 0.2);
        }
    `;

    var styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    /* ── Helpers ─────────────────────────────────────────────────── */
    function getInitials(name) {
        return name.trim().split(/\s+/).map(function (w) { return w[0].toUpperCase(); }).join('').slice(0, 2);
    }

    function logout() {
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }

    /* ── Main logic (runs after DOM ready) ───────────────────────── */
    function init() {
        var rawUser;
        try {
            rawUser = localStorage.getItem('currentUser');
        } catch (e) {
            console.error('LocalStorage access blocked:', e);
            return;
        }

        if (!rawUser) return; // Not logged in — show normal Login / Register links

        var user;
        try {
            user = JSON.parse(rawUser);
        } catch (e) {
            console.error('Failed to parse currentUser from localStorage:', e);
            return;
        }

        if (!user || (!user.username && !user.name)) return;
        var displayName = user.username || user.name;

        var loginBtnContainer = document.querySelector('.topbar-login-btn');
        if (!loginBtnContainer) return;

        // Hide Login / Registration links
        loginBtnContainer.classList.add('auth-hidden');

        // Check if user area already exists to avoid duplicates
        if (document.querySelector('.nav-user-area')) return;

        // Build the user chip + logout button
        var chip = document.createElement('div');
        chip.className = 'nav-user-area';
        chip.innerHTML =
            '<span class="nav-user-chip">' +
            '<span class="nav-user-avatar">' + getInitials(displayName) + '</span>' +
            '<span>' + escapeHtml(displayName) + '</span>' +
            '</span>' +
            '<a href="#" class="nav-logout-btn" id="navLogoutBtn">' +
            '<i class="fa-solid fa-right-from-bracket"></i> Logout' +
            '</a>';

        loginBtnContainer.parentNode.insertBefore(chip, loginBtnContainer);

        var logoutBtn = document.getElementById('navLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function (e) {
                e.preventDefault();
                logout();
            });
        }
    }

    function escapeHtml(text) {
        return text.replace(/[&<>"']/g, function (m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
