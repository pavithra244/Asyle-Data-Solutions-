// SECURITY FIX: Disable console in production
(function () { if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') { console.log = console.warn = console.error = console.info = console.debug = console.table = console.dir = function () { } } })();
// toast.js
document.addEventListener('DOMContentLoaded', () => {
    // Create container if not exists
    if (!document.getElementById('toast-container')) {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
});

function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';

    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-in forwards';
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, duration);
}
