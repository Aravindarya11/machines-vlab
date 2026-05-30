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

    // Theme Settings (Forced Dark Mode)
    const html = document.documentElement;
    html.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');


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
// Download Report Utility (Generates PDF using jsPDF)
function downloadPDF(filename, text) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Page margins and vertical position tracking
    const marginX = 20;
    let posY = 20;
    
    // Split the CSV format string into lines
    const lines = text.split('\n');
    
    // Add decorative top bar (cyan primary color)
    doc.setFillColor(6, 182, 212); // #06b6d4
    doc.rect(0, 0, 220, 10, 'F');
    
    // Date/Time
    const now = new Date();
    const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
    
    // Header title
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text("ELECTRICAL MACHINE VIRTUAL LABORATORY", marginX, posY + 5);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`Report Generated: ${dateStr}`, marginX, posY + 11);
    
    posY += 20;
    
    lines.forEach(line => {
        line = line.trim();
        if (!line) {
            posY += 4;
            return;
        }
        
        if (line.startsWith("===") || line.includes("Lab Report") || line.includes("Results:") || line.includes("Inputs:") || line.startsWith("=== ")) {
            // It's a Section Header
            posY += 6;
            
            // Clean section title
            const sectionTitle = line.replace(/===/g, '').trim().toUpperCase();
            
            doc.setFont("Helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(6, 182, 212); // Cyan Primary
            doc.text(sectionTitle, marginX, posY);
            posY += 3;
            
            // Underline
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.5);
            doc.line(marginX, posY, 190, posY);
            posY += 6;
        } else if (line.includes(",")) {
            // Key-Value pair row
            const parts = line.split(',');
            const label = parts[0].trim();
            const value = parts[1].trim();
            
            doc.setFont("Helvetica", "normal");
            doc.setFontSize(9.5);
            doc.setTextColor(51, 65, 85); // slate-700
            doc.text(label, marginX, posY);
            
            doc.setFont("Helvetica", "bold");
            doc.setTextColor(15, 23, 42); // slate-900
            doc.text(value, 130, posY);
            posY += 6.5;
        } else {
            // Regular line
            doc.setFont("Helvetica", "normal");
            doc.setFontSize(9.5);
            doc.setTextColor(15, 23, 42);
            doc.text(line, marginX, posY);
            posY += 6.5;
        }
        
        // Page boundary check
        if (posY > 270) {
            doc.addPage();
            // Top bar on new page
            doc.setFillColor(6, 182, 212);
            doc.rect(0, 0, 220, 10, 'F');
            posY = 25;
        }
    });
    
    // Footer signature / credits
    posY += 10;
    if (posY > 260) {
        doc.addPage();
        doc.setFillColor(6, 182, 212);
        doc.rect(0, 0, 220, 10, 'F');
        posY = 25;
    }
    
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(marginX, posY, 190, posY);
    posY += 8;
    
    doc.setFont("Helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Virtual Laboratory Simulation Deck", marginX, posY);
    
    doc.setFont("Helvetica", "normal");
    doc.text("Developed by Aravind S and Balqis Ahmed", 125, posY);
    
    // Save generated PDF
    doc.save(filename);
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
