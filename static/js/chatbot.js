/* ═══════════════════════════════════════════════════════
   EMVL CHATBOT INTERACTIVE logic
   ═══════════════════════════════════════════════════════ */

(function() {
    // UI Elements
    const widget = document.getElementById('emvl-chatbot-widget');
    const toggleBtn = document.getElementById('chatbot-toggle-btn');
    const closeBtn = document.getElementById('chatbot-close-btn');
    const windowEl = document.getElementById('chatbot-window');
    const messagesEl = document.getElementById('chatbot-messages');
    const inputEl = document.getElementById('chatbot-input');
    const sendBtn = document.getElementById('chatbot-send-btn');
    const suggestionChips = document.querySelectorAll('.suggestion-chip');
    const notificationDot = document.querySelector('.chatbot-notification-dot');

    if (!toggleBtn || !windowEl || !messagesEl) return;

    let isBotTyping = false;
    let notificationActive = true;

    // Predefined AI Knowledge Base
    const knowledgeBase = [
        {
            keywords: [/hi/i, /hello/i, /hey/i, /greetings/i],
            answer: "Hi there! 👋 Welcome to the Virtual Lab. I am ARYA, your high-voltage digital assistant! ⚡ Ask me anything about **EMF**, **MMF**, or **ZPF** methods, or ask **how to use** the simulation deck!"
        },
        {
            keywords: [/emf/i, /synchronous impedance/i, /impedance method/i],
            answer: "The **EMF (Electromotive Force)** method, or **Synchronous Impedance Method**:<br><br>1. It is a <strong>pessimistic method</strong> because the calculated voltage regulation is higher than actual values.<br>2. It determines synchronous impedance ($Zs$) from OCC & SCC curves:<br><div class='chat-math'>Zs = Eoc / Isc &nbsp;(at rated If)</div>3. Armature leakage reactance ($Xs$) is computed by:<br><div class='chat-math'>Xs = sqrt(Zs^2 - Ra^2)</div>4. It is pessimistic because it ignores magnetic saturation, using a constant value of reactance."
        },
        {
            keywords: [/mmf/i, /ampere-turn/i, /ampere turn/i],
            answer: "The **MMF (Magnetomotive Force)** method, or **Ampere-Turn Method**:<br><br>1. It is an <strong>optimistic method</strong> because it yields a voltage regulation that is lower than actual values.<br>2. It vectorially adds the excitation field current required for open-circuit rated voltage ($If1$) and the excitation required to overcome short-circuit armature current ($If2$):<br><div class='chat-math'>If = sqrt(If1² + If2² + 2*If1*If2*cos(180-θ))</div>3. It is optimistic because it assumes leakage reactance can be compensated entirely by excitation, underestimating the internal impedance drop."
        },
        {
            keywords: [/zpf/i, /zero power factor/i, /potier/i, /triangle/i],
            answer: "The **ZPF (Zero Power Factor)** method, or **Potier Triangle Method**:<br><br>1. It is the <strong>gold standard</strong> because it yields highly accurate, realistic voltage regulation results.<br>2. It separates the armature leakage reactance drop ($I * Xl$) and the equivalent armature reaction MMF ($Far$).<br>3. It constructs the <strong>Potier Triangle</strong> using the Open Circuit Curve (OCC) and the Zero Power Factor Curve (ZPFC).<br>4. By separately treating reactance voltage drop and magnetic flux reaction, it accurately models saturation."
        },
        {
            keywords: [/regulation/i, /calculate/i, /percent/i, /formula/i],
            answer: "Voltage regulation represents the percentage rise in alternator terminal voltage when rated load is thrown off:<br><div class='chat-math'>Regulation % = ((E0 - V) / V) * 100%</div>where:<br>- <strong>E0</strong> is the no-load induced voltage.<br>- <strong>V</strong> is the rated terminal voltage.<br><br>⚡ <strong>Load Characteristics</strong>:<br>- <strong>Lagging PF (Inductive)</strong>: Positive regulation (voltage drops under load).<br>- <strong>Leading PF (Capacitive)</strong>: Negative regulation (voltage rises under load).<br>- <strong>Unity PF (Resistive)</strong>: Slightly positive regulation."
        },
        {
            keywords: [/how to use/i, /simulate/i, /how to run/i, /guide/i, /instructions/i, /help/i],
            answer: "To run a simulation on the EMVL:<br><br>1. Click on a method in the sidebar (**EMF**, **MMF**, or **ZPF**).<br>2. In the controls panel, input your machine configuration (resistance, rated voltage, current).<br>3. Click **Calculate Regulation** to compile the mathematical formulas.<br>4. Explore the interactive **Vector Phasor Diagram** and plots.<br>5. Generate a virtual laboratory **Report** to download your results!"
        },
        {
            keywords: [/developer/i, /creator/i, /author/i, /aravind/i, /balqis/i],
            answer: "This Electrical Machine Virtual Laboratory was developed by <strong>Aravind S and Balqis Ahmed</strong> as a graduation/coursework project. It aims to offer interactive, visual tools for studying alternator characteristics."
        }
    ];

    // Toggle Chat Window
    function toggleChat() {
        windowEl.classList.toggle('hidden');
        if (!windowEl.classList.contains('hidden')) {
            // Dismiss notification dot
            if (notificationActive && notificationDot) {
                notificationDot.style.opacity = '0';
                setTimeout(() => notificationDot.remove(), 300);
                notificationActive = false;
            }
            inputEl.focus();
            
            // If empty, append welcome message
            if (messagesEl.children.length === 0) {
                showBotResponse("Hi! I am ARYA, your high-voltage digital assistant! ⚡ Ask me anything about Synchronous Machine Regulation (EMF, MMF, or ZPF methods), or how to use the simulator!");
            }
        }
    }

    // Append Message to UI
    function appendMessage(sender, text) {
        const msg = document.createElement('div');
        msg.className = `chat-msg ${sender}`;
        
        // Convert basic markdown-like bold syntax (**text**) to <strong>
        let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        msg.innerHTML = formattedText;
        
        messagesEl.appendChild(msg);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    // Append Typing Indicator
    function showTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'chat-msg bot typing-indicator-container';
        indicator.id = 'bot-typing-indicator';
        indicator.innerHTML = `
            <div class="typing-indicator">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
            </div>
        `;
        messagesEl.appendChild(indicator);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        isBotTyping = true;
    }

    // Remove Typing Indicator
    function removeTypingIndicator() {
        const indicator = document.getElementById('bot-typing-indicator');
        if (indicator) indicator.remove();
        isBotTyping = false;
    }

    // Get Bot Response based on query
    function getBotResponse(query) {
        for (let item of knowledgeBase) {
            for (let rx of item.keywords) {
                if (rx.test(query)) {
                    return item.answer;
                }
            }
        }
        return "I'm not sure I understand. Try asking about: **EMF Method**, **MMF Method**, **ZPF Method**, **Voltage Regulation**, or **How to use** the simulator.";
    }

    // Handle User Input Submission
    function handleUserSubmit() {
        if (isBotTyping) return;
        
        const query = inputEl.value.trim();
        if (!query) return;

        // Add user message
        appendMessage('user', query);
        inputEl.value = '';

        // Trigger bot response
        showBotResponse(getBotResponse(query));
    }

    // Show bot response with artificial typing delay
    function showBotResponse(answer) {
        showTypingIndicator();
        
        // Calculate typing delay proportional to message length (min 600ms, max 1600ms)
        const delay = Math.min(Math.max(answer.length * 6, 600), 1600);
        
        setTimeout(() => {
            removeTypingIndicator();
            appendMessage('bot', answer);
            
            // Re-run MathJax to compile LaTeX if any equations exist
            if (window.MathJax && window.MathJax.typesetPromise) {
                window.MathJax.typesetPromise([messagesEl]).catch((err) => console.log(err));
            }
        }, delay);
    }

    // Event Listeners
    toggleBtn.addEventListener('click', toggleChat);
    closeBtn.addEventListener('click', toggleChat);
    
    sendBtn.addEventListener('click', handleUserSubmit);
    
    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handleUserSubmit();
        }
    });

    // Quick Suggestions click handlers
    suggestionChips.forEach(chip => {
        chip.addEventListener('click', () => {
            if (isBotTyping) return;
            const question = chip.getAttribute('data-question');
            if (question) {
                appendMessage('user', question);
                showBotResponse(getBotResponse(question));
            }
        });
    });

})();
