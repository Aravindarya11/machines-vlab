function initMain() {
    // Sidebar Toggle
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('toggleSidebar');
    const toggleBtnTopbar = document.getElementById('toggleSidebarTopbar');
    
    const toggleSidebar = () => {
        sidebar.classList.toggle('collapsed');
        // Trigger resize event to update plotly graphs
        window.dispatchEvent(new Event('resize'));
    };
    
    if (toggleBtn) toggleBtn.addEventListener('click', toggleSidebar);
    if (toggleBtnTopbar) toggleBtnTopbar.addEventListener('click', toggleSidebar);

    // Theme Toggle
    const themeToggle = document.getElementById('themeToggle');
    const html = document.documentElement;
    const themeIcon = themeToggle.querySelector('i');
    
    // Check local storage for theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    html.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    themeToggle.addEventListener('click', () => {
        const currentTheme = html.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
        
        // Trigger resize event to update plotly graphs
        window.dispatchEvent(new Event('resize'));
    });

    function updateThemeIcon(theme) {
        if (theme === 'dark') {
            themeIcon.className = 'fa-solid fa-sun';
            themeToggle.querySelector('span').textContent = 'Light Mode';
        } else {
            themeIcon.className = 'fa-solid fa-moon';
            themeToggle.querySelector('span').textContent = 'Dark Mode';
        }
    }

    // Datetime Update
    const datetimeElement = document.getElementById('currentDatetime');
    function updateDatetime() {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        datetimeElement.textContent = now.toLocaleDateString('en-US', options);
    }
    updateDatetime();
    setInterval(updateDatetime, 60000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMain);
} else {
    initMain();
}

// Toast Notification System
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Download Report Utility
function downloadCSV(filename, text) {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

// Global helper to update machine simulation LED status
function updateStatusLED(state) {
    const led = document.getElementById('statusLed');
    const text = document.getElementById('statusText');
    if (!led || !text) return;
    
    led.className = 'led-light';
    
    if (state === 'ready') {
        led.classList.add('ready');
        text.textContent = 'READY';
        text.style.color = '#10b981';
    } else if (state === 'running') {
        led.classList.add('running');
        text.textContent = 'RUNNING';
        text.style.color = '#10b981';
    } else if (state === 'paused') {
        led.classList.add('paused', 'pulsing');
        text.textContent = 'PAUSED';
        text.style.color = '#3b82f6';
    } else if (state === 'error') {
        led.classList.add('error');
        text.textContent = 'ERROR';
        text.style.color = '#ef4444';
    }
}
