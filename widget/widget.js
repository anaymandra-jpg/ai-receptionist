(function () {
  // ── Config ────────────────────────────────────────────────────────────────
  const BACKEND_URL = "https://your-app.railway.app"; // ← update after deploying
  const script = document.currentScript;
  const CLIENT_ID = script ? script.getAttribute("data-client") : "dentist123";
  const LANGUAGE = navigator.language || "en"; // auto-detect browser language

  // ── Styles ────────────────────────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    #ai-receptionist-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: #2563eb;
      color: white;
      border: none;
      cursor: pointer;
      font-size: 26px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    #ai-receptionist-btn:hover { background: #1d4ed8; }

    #ai-receptionist-box {
      position: fixed;
      bottom: 96px;
      right: 24px;
      width: 360px;
      max-height: 560px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18);
      display: flex;
      flex-direction: column;
      z-index: 99999;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    #ai-receptionist-header {
      background: #2563eb;
      color: white;
      padding: 16px 18px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
    #ai-receptionist-header .avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(255,255,255,0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      flex-shrink: 0;
    }
    #ai-receptionist-header .info { flex: 1; }
    #ai-receptionist-header .name { font-weight: 600; font-size: 15px; }
    #ai-receptionist-header .status { font-size: 12px; opacity: 0.85; }
    #ai-receptionist-close {
      background: none;
      border: none;
      color: white;
      font-size: 20px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    }

    /* ── Lead capture form ── */
    #ai-lead-form {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #f8fafc;
      flex: 1;
      overflow-y: auto;
    }
    #ai-lead-form p {
      margin: 0 0 4px;
      font-size: 14px;
      color: #475569;
      line-height: 1.5;
    }
    .ai-form-input {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      outline: none;
      box-sizing: border-box;
      transition: border-color 0.2s;
    }
    .ai-form-input:focus { border-color: #2563eb; }
    .ai-form-btn {
      padding: 10px;
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    .ai-form-btn:hover { background: #1d4ed8; }
    .ai-form-btn:disabled { background: #94a3b8; cursor: not-allowed; }
    .ai-form-error { color: #ef4444; font-size: 13px; }
    .ai-form-skip {
      background: none;
      border: none;
      color: #94a3b8;
      font-size: 13px;
      cursor: pointer;
      text-align: center;
      padding: 0;
      text-decoration: underline;
    }
    .ai-form-skip:hover { color: #64748b; }

    /* ── Appointment form (inline in chat) ── */
    .ai-appt-form {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-self: flex-start;
      max-width: 90%;
      box-shadow: 0 1px 4px rgba(0,0,0,0.07);
    }
    .ai-appt-form p { margin: 0 0 4px; font-size: 13px; color: #475569; font-weight: 600; }
    .ai-appt-form .ai-form-input { font-size: 13px; padding: 8px 12px; }
    .ai-appt-form .ai-form-btn { font-size: 13px; padding: 8px; }

    /* ── Messages ── */
    #ai-receptionist-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: #f8fafc;
    }

    .ai-msg, .user-msg {
      max-width: 82%;
      padding: 10px 14px;
      border-radius: 14px;
      font-size: 14px;
      line-height: 1.5;
      word-wrap: break-word;
    }
    .ai-msg {
      background: white;
      color: #1e293b;
      align-self: flex-start;
      border-bottom-left-radius: 4px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.07);
    }
    .user-msg {
      background: #2563eb;
      color: white;
      align-self: flex-end;
      border-bottom-right-radius: 4px;
    }
    .ai-typing {
      background: white;
      color: #94a3b8;
      align-self: flex-start;
      padding: 10px 14px;
      border-radius: 14px;
      border-bottom-left-radius: 4px;
      font-size: 14px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.07);
    }

    #ai-receptionist-input-area {
      display: flex;
      padding: 12px;
      gap: 8px;
      border-top: 1px solid #e2e8f0;
      background: white;
      flex-shrink: 0;
    }
    #ai-receptionist-input {
      flex: 1;
      border: 1px solid #e2e8f0;
      border-radius: 24px;
      padding: 10px 16px;
      font-size: 14px;
      outline: none;
      resize: none;
      font-family: inherit;
    }
    #ai-receptionist-input:focus { border-color: #2563eb; }
    #ai-receptionist-send {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #2563eb;
      color: white;
      border: none;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.2s;
    }
    #ai-receptionist-send:hover { background: #1d4ed8; }
    #ai-receptionist-send:disabled { background: #94a3b8; cursor: not-allowed; }

    @media (max-width: 420px) {
      #ai-receptionist-box { width: calc(100vw - 24px); right: 12px; bottom: 88px; }
    }
  `;
  document.head.appendChild(style);

  // ── HTML ──────────────────────────────────────────────────────────────────
  const btn = document.createElement("button");
  btn.id = "ai-receptionist-btn";
  btn.setAttribute("aria-label", "Open chat");
  btn.innerHTML = "💬";

  const box = document.createElement("div");
  box.id = "ai-receptionist-box";
  box.style.display = "none";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", "AI Receptionist Chat");
  box.innerHTML = `
    <div id="ai-receptionist-header">
      <div class="avatar">💬</div>
      <div class="info">
        <div class="name">Assistant</div>
        <div class="status">● Online — here to help</div>
      </div>
      <button id="ai-receptionist-close" aria-label="Close chat">✕</button>
    </div>

    <!-- Lead capture form (shown first) -->
    <div id="ai-lead-form">
      <p>Before we chat, mind sharing your name and email? We'll only use it to follow up if needed.</p>
      <input class="ai-form-input" id="ai-lead-name" type="text" placeholder="Your name" maxlength="100" />
      <input class="ai-form-input" id="ai-lead-email" type="email" placeholder="Your email" maxlength="200" />
      <div class="ai-form-error" id="ai-lead-error"></div>
      <button class="ai-form-btn" id="ai-lead-submit">Start Chatting →</button>
      <button class="ai-form-skip" id="ai-lead-skip">Skip for now</button>
    </div>

    <!-- Chat area (hidden until lead form done) -->
    <div id="ai-chat-area" style="display:none;flex:1;flex-direction:column;overflow:hidden">
      <div id="ai-receptionist-messages" role="log" aria-live="polite"></div>
      <div id="ai-receptionist-input-area">
        <textarea
          id="ai-receptionist-input"
          placeholder="Type your message..."
          rows="1"
          aria-label="Type your message"
          maxlength="500"
        ></textarea>
        <button id="ai-receptionist-send" aria-label="Send message">➤</button>
      </div>
    </div>
  `;

  document.body.appendChild(btn);
  document.body.appendChild(box);

  // ── State ─────────────────────────────────────────────────────────────────
  let history = [];
  let isOpen = false;
  let isWaiting = false;
  let welcomeMessage = "Hi there! 👋 How can I help you today?";
  let leadCaptured = false;
  let visitorName = "";
  let visitorEmail = "";

  // ── Load branding from backend ────────────────────────────────────────────
  fetch(`${BACKEND_URL}/client-config/${CLIENT_ID}`)
    .then((r) => r.json())
    .then((config) => {
      if (config.widgetName) {
        document.querySelector("#ai-receptionist-header .name").textContent = config.widgetName;
      }
      if (config.widgetAvatar) {
        document.querySelector("#ai-receptionist-header .avatar").textContent = config.widgetAvatar;
      }
      if (config.welcomeMessage) {
        welcomeMessage = config.welcomeMessage;
      }
    })
    .catch(() => {});

  // ── Helpers ───────────────────────────────────────────────────────────────

  const messagesEl = () => document.getElementById("ai-receptionist-messages");
  const inputEl = () => document.getElementById("ai-receptionist-input");
  const sendBtn = () => document.getElementById("ai-receptionist-send");

  function addMessage(text, role) {
    const el = document.createElement("div");
    el.className = role === "user" ? "user-msg" : "ai-msg";
    el.textContent = text;
    messagesEl().appendChild(el);
    messagesEl().scrollTop = messagesEl().scrollHeight;
    return el;
  }

  function showTyping() {
    const el = document.createElement("div");
    el.className = "ai-typing";
    el.id = "ai-typing-indicator";
    el.textContent = "Typing…";
    messagesEl().appendChild(el);
    messagesEl().scrollTop = messagesEl().scrollHeight;
  }

  function removeTyping() {
    const el = document.getElementById("ai-typing-indicator");
    if (el) el.remove();
  }

  // ── Appointment form (injected into chat) ─────────────────────────────────

  function showAppointmentForm() {
    const form = document.createElement("div");
    form.className = "ai-appt-form";
    form.innerHTML = `
      <p>📅 Book an Appointment</p>
      <input class="ai-form-input" id="ai-appt-name" type="text" placeholder="Your name" maxlength="100" value="${visitorName}" />
      <input class="ai-form-input" id="ai-appt-email" type="email" placeholder="Your email" maxlength="200" value="${visitorEmail}" />
      <input class="ai-form-input" id="ai-appt-phone" type="tel" placeholder="Phone number (optional)" maxlength="30" />
      <input class="ai-form-input" id="ai-appt-date" type="date" />
      <div class="ai-form-error" id="ai-appt-error"></div>
      <button class="ai-form-btn" id="ai-appt-submit">Request Appointment</button>
    `;
    messagesEl().appendChild(form);
    messagesEl().scrollTop = messagesEl().scrollHeight;

    document.getElementById("ai-appt-submit").addEventListener("click", async () => {
      const name = document.getElementById("ai-appt-name").value.trim();
      const email = document.getElementById("ai-appt-email").value.trim();
      const phone = document.getElementById("ai-appt-phone").value.trim();
      const date = document.getElementById("ai-appt-date").value;
      const errEl = document.getElementById("ai-appt-error");

      if (!name) { errEl.textContent = "Please enter your name."; return; }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errEl.textContent = "Please enter a valid email."; return; }
      errEl.textContent = "";

      const submitBtn = document.getElementById("ai-appt-submit");
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending…";

      try {
        await fetch(`${BACKEND_URL}/save-lead`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: CLIENT_ID, type: "appointment", name, email, phone, appointmentDate: date }),
        });
        form.innerHTML = `<p style="color:#15803d;font-weight:600">✅ Appointment request sent! We'll be in touch soon.</p>`;
      } catch {
        errEl.textContent = "Something went wrong. Please call us directly.";
        submitBtn.disabled = false;
        submitBtn.textContent = "Request Appointment";
      }
    });
  }

  // ── Send message ──────────────────────────────────────────────────────────

  async function sendMessage() {
    const input = inputEl();
    const text = input.value.trim();
    if (!text || isWaiting) return;

    input.value = "";
    input.style.height = "auto";
    isWaiting = true;
    sendBtn().disabled = true;

    addMessage(text, "user");
    history.push({ role: "user", content: text });

    // Check if user wants to book — show appointment form
    const bookingKeywords = /\b(book|appointment|schedule|reserve|visit|come in|set up)\b/i;
    if (bookingKeywords.test(text)) {
      showAppointmentForm();
      isWaiting = false;
      sendBtn().disabled = false;
      input.focus();
      return;
    }

    showTyping();

    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, clientId: CLIENT_ID, history, language: LANGUAGE }),
      });

      const data = await res.json();
      removeTyping();

      const reply = data.reply || data.error || "Sorry, something went wrong. Please call us directly.";
      addMessage(reply, "ai");
      history.push({ role: "assistant", content: reply });

      if (history.length > 20) history = history.slice(-20);
    } catch {
      removeTyping();
      addMessage("Sorry, I'm having trouble connecting. Please call the office directly.", "ai");
    }

    isWaiting = false;
    sendBtn().disabled = false;
    input.focus();
  }

  // ── Lead form logic ───────────────────────────────────────────────────────

  function startChat() {
    document.getElementById("ai-lead-form").style.display = "none";
    const chatArea = document.getElementById("ai-chat-area");
    chatArea.style.display = "flex";

    if (messagesEl().children.length === 0) {
      addMessage(welcomeMessage, "ai");
    }
    inputEl().focus();
  }

  document.getElementById("ai-lead-submit").addEventListener("click", async () => {
    const name = document.getElementById("ai-lead-name").value.trim();
    const email = document.getElementById("ai-lead-email").value.trim();
    const errEl = document.getElementById("ai-lead-error");

    if (!name) { errEl.textContent = "Please enter your name."; return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errEl.textContent = "Please enter a valid email."; return; }
    errEl.textContent = "";

    const submitBtn = document.getElementById("ai-lead-submit");
    submitBtn.disabled = true;
    submitBtn.textContent = "Starting…";

    visitorName = name;
    visitorEmail = email;
    leadCaptured = true;

    // Save lead in background — don't block chat opening
    fetch(`${BACKEND_URL}/save-lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: CLIENT_ID, type: "contact", name, email }),
    }).catch(() => {});

    startChat();
  });

  document.getElementById("ai-lead-skip").addEventListener("click", () => {
    startChat();
  });

  // ── Open / close ──────────────────────────────────────────────────────────

  function openChat() {
    isOpen = true;
    box.style.display = "flex";
    btn.innerHTML = "✕";
    btn.setAttribute("aria-label", "Close chat");

    // If lead form already completed/skipped, go straight to chat
    if (leadCaptured || document.getElementById("ai-chat-area").style.display === "flex") {
      document.getElementById("ai-lead-form").style.display = "none";
      document.getElementById("ai-chat-area").style.display = "flex";
      if (messagesEl().children.length === 0) {
        addMessage(welcomeMessage, "ai");
      }
      inputEl().focus();
    } else {
      document.getElementById("ai-lead-name").focus();
    }
  }

  function closeChat() {
    isOpen = false;
    box.style.display = "none";
    btn.innerHTML = "💬";
    btn.setAttribute("aria-label", "Open chat");
  }

  // ── Events ────────────────────────────────────────────────────────────────

  btn.addEventListener("click", () => (isOpen ? closeChat() : openChat()));
  document.getElementById("ai-receptionist-close").addEventListener("click", closeChat);

  box.addEventListener("click", (e) => {
    if (e.target.id === "ai-receptionist-send") sendMessage();
  });

  box.addEventListener("keydown", (e) => {
    if (e.target.id === "ai-receptionist-input" && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  box.addEventListener("input", (e) => {
    if (e.target.id === "ai-receptionist-input") {
      e.target.style.height = "auto";
      e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
    }
  });
})();
