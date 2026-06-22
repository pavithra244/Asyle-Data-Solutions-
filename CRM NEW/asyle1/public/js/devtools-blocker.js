// SECURITY FIX: Disable console in production
(function () { if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') { console.log = console.warn = console.error = console.info = console.debug = console.table = console.dir = function () { } } })();

// SECURITY FIX: DevTools Blocker
(function () {
    'use strict';

    // Block keyboard shortcuts
    document.addEventListener('keydown', function (e) {
        // F12
        if (e.keyCode === 123) {
            e.preventDefault();
            return false;
        }
        // Ctrl+Shift+I
        if (e.ctrlKey && e.shiftKey && e.keyCode === 73) {
            e.preventDefault();
            return false;
        }
        // Ctrl+Shift+J
        if (e.ctrlKey && e.shiftKey && e.keyCode === 74) {
            e.preventDefault();
            return false;
        }
        // Ctrl+Shift+C
        if (e.ctrlKey && e.shiftKey && e.keyCode === 67) {
            e.preventDefault();
            return false;
        }
        // Ctrl+U (View Source)
        if (e.ctrlKey && e.keyCode === 85) {
            e.preventDefault();
            return false;
        }
    });

    // Disable right-click
    document.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        return false;
    });

    // Detect DevTools open via window size
    let devtoolsOpen = false;
    const threshold = 160;

    function detectDevTools() {
        const widthThreshold = window.outerWidth - window.innerWidth > threshold;
        const heightThreshold = window.outerHeight - window.innerHeight > threshold;

        if (widthThreshold || heightThreshold) {
            if (!devtoolsOpen) {
                devtoolsOpen = true;
            }
        } else {
            devtoolsOpen = false;
        }
    }

    // Check every 500ms
    setInterval(detectDevTools, 500);

    // Clear console when DevTools detected
    setInterval(function () {
        if (devtoolsOpen) {
            console.clear();
        }
    }, 1000);

    // Additional detection method
    const element = new Image();
    Object.defineProperty(element, 'id', {
        get: function () {
            devtoolsOpen = true;
            return 'devtools-detector';
        }
    });

    setInterval(function () {
        devtoolsOpen = false;
        console.dir(element);
    }, 1000);

})();
