// ui-utils.js - UI/UX utilities for buttons, forms, and animations

const UIUtils = (() => {
    // Track pending requests
    const pendingRequests = new Set();

    // Initialize button event handling with event delegation
    function initButtons() {
        // Use event delegation for all button clicks
        document.addEventListener('click', handleButtonClick, true);
        document.addEventListener('submit', handleFormSubmit, true);
    }

    // Handle button clicks with proper state management
    function handleButtonClick(event) {
        const btn = event.target.closest('button, .btn, [role="button"]');
        if (!btn) return;

        // Check if button is disabled or already loading
        if (btn.disabled || btn.classList.contains('loading')) {
            event.preventDefault();
            return;
        }

        // Add focus for accessibility
        btn.focus();
    }

    // Handle form submissions
    function handleFormSubmit(event) {
        const form = event.target;
        
        // Skip auth forms (signup-form, login-form) - these handle their own state management
        if (form.id === 'signup-form' || form.id === 'login-form') {
            return;
        }
        
        const submitBtn = form.querySelector('button[type="submit"], .btn[type="submit"]');

        if (!submitBtn) return;

        // Prevent double submission
        if (submitBtn.disabled || submitBtn.classList.contains('loading')) {
            event.preventDefault();
            return;
        }

        // Set loading state
        setButtonLoading(submitBtn, true);

        // Auto-reset after 3 seconds if no response
        setTimeout(() => {
            if (submitBtn.classList.contains('loading')) {
                setButtonLoading(submitBtn, false);
            }
        }, 3000);
    }

    // Set button loading state
    function setButtonLoading(btn, isLoading) {
        if (!btn) return;

        if (isLoading) {
            btn.classList.add('loading');
            btn.disabled = true;
            btn.setAttribute('aria-busy', 'true');
            const originalText = btn.textContent;
            btn.dataset.originalText = originalText;
        } else {
            btn.classList.remove('loading');
            btn.disabled = false;
            btn.setAttribute('aria-busy', 'false');
            if (btn.dataset.originalText) {
                btn.textContent = btn.dataset.originalText;
            }
        }
    }

    // Show message with fade transition
    function showMessage(elementId, message, type = 'info', duration = 4000) {
        const el = document.getElementById(elementId);
        if (!el) return;

        el.textContent = message;
        el.style.opacity = '1';
        el.style.transition = 'opacity 0.3s ease';

        if (duration > 0) {
            setTimeout(() => {
                el.style.opacity = '0';
                setTimeout(() => {
                    el.textContent = '';
                    el.style.opacity = '1';
                }, 300);
            }, duration);
        }
    }

    // Toggle sidebar with smooth animation
    function toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const toggle = document.getElementById('menu-toggle');

        if (!sidebar) return;

        const isCollapsed = sidebar.classList.contains('collapsed');

        if (isCollapsed) {
            sidebar.classList.remove('collapsed');
            toggle?.classList.remove('active');
            sidebar.setAttribute('aria-hidden', 'false');
        } else {
            sidebar.classList.add('collapsed');
            toggle?.classList.add('active');
            sidebar.setAttribute('aria-hidden', 'true');
        }
    }

    // Close sidebar when clicking outside (on mobile only)
    function initSidebarClickAway() {
        let isProcessing = false;
        
        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('sidebar');
            const toggle = document.getElementById('menu-toggle');
            const mainContent = document.querySelector('.main-content');

            if (!sidebar || !toggle || !mainContent) return;

            // Check if we're in mobile viewport
            const isMobileViewport = window.innerWidth < 768;
            if (!isMobileViewport) return; // Only apply on mobile

            const isClickInsideSidebar = sidebar.contains(e.target);
            const isClickOnToggle = toggle.contains(e.target);
            const isClickOnMainContent = mainContent.contains(e.target) && !isClickOnToggle;
            
            // If clicking toggle button, let toggle handle it
            if (isClickOnToggle) return;

            // If clicking inside sidebar, don't close
            if (isClickInsideSidebar) return;

            // If clicking on main content while sidebar is open, close it
            if (isClickOnMainContent && !sidebar.classList.contains('collapsed') && !isProcessing) {
                isProcessing = true;
                sidebar.classList.add('collapsed');
                toggle.classList.remove('active');
                sidebar.setAttribute('aria-hidden', 'true');
                setTimeout(() => { isProcessing = false; }, 300);
            }
        }, true);
    }

    // Debounce function for search and input handlers
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

    // Add smooth fade-in animation to elements
    function fadeIn(element, duration = 300) {
        element.style.opacity = '0';
        element.style.transition = `opacity ${duration}ms ease`;
        element.offsetHeight; // Trigger reflow
        element.style.opacity = '1';
    }

    // Add smooth fade-out animation
    function fadeOut(element, duration = 300) {
        return new Promise((resolve) => {
            element.style.transition = `opacity ${duration}ms ease`;
            element.style.opacity = '0';
            setTimeout(() => {
                element.style.display = 'none';
                resolve();
            }, duration);
        });
    }

    // Scroll to element smoothly
    function scrollToElement(element, offset = 100) {
        const elementPosition = element.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({
            top: elementPosition - offset,
            behavior: 'smooth'
        });
    }

    // Initialize on page load
    function init() {
        initButtons();
        
        // Only init clickaway on dashboard pages
        if (document.querySelector('.wrapper')) {
            initSidebarClickAway();
        }

        // Menu toggle
        const menuToggle = document.getElementById('menu-toggle');
        if (menuToggle) {
            menuToggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleSidebar();
            });
        }
    }

    return {
        init,
        setButtonLoading,
        showMessage,
        toggleSidebar,
        debounce,
        fadeIn,
        fadeOut,
        scrollToElement
    };
})();

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', UIUtils.init);
} else {
    UIUtils.init();
}

// Export for use in other modules
window.UIUtils = UIUtils;
