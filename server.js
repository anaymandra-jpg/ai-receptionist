require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const OpenAI = require("openai");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const clients = require("./clients.json");

const app = express();

if (!process.env.OPENAI_API_KEY) {
  console.error("ERROR: OPENAI_API_KEY environment variable is not set.");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Leads file helpers ─────────────────────────────────────────────────────

const LEADS_FILE = path.join(__dirname, "leads.json");

function readLeads() {
  if (!fs.existsSync(LEADS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(LEADS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveLead(lead) {
  const leads = readLeads();
  leads.push({ ...lead, createdAt: new Date().toISOString() });
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
}

// ── Email helper ───────────────────────────────────────────────────────────

async function sendLeadEmail(client, lead) {
  if (!client.smtp || !client.smtp.host || client.smtp.pass === "your-email-password") {
    console.log("SMTP not configured for client, skipping email notification.");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: client.smtp.host,
    port: client.smtp.port || 587,
    secure: (client.smtp.port || 587) === 465,
    auth: {
      user: client.smtp.user,
      pass: client.smtp.pass,
    },
  });

  const isAppointment = lead.type === "appointment";
  const subject = isAppointment
    ? `📅 New Appointment Request — ${lead.name}`
    : `👋 New Lead — ${lead.name}`;

  const html = `
    <h2>${isAppointment ? "New Appointment Request" : "New Lead"} from ${client.businessName} Chat</h2>
    <table style="border-collapse:collapse;width:100%;max-width:500px">
      <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600">Name</td><td style="padding:8px;border:1px solid #e2e8f0">${lead.name}</td></tr>
      <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600">Email</td><td style="padding:8px;border:1px solid #e2e8f0">${lead.email}</td></tr>
      ${lead.phone ? `<tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600">Phone</td><td style="padding:8px;border:1px solid #e2e8f0">${lead.phone}</td></tr>` : ""}
      ${lead.appointmentDate ? `<tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600">Requested Date</td><td style="padding:8px;border:1px solid #e2e8f0">${lead.appointmentDate}</td></tr>` : ""}
      ${lead.message ? `<tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600">Message</td><td style="padding:8px;border:1px solid #e2e8f0">${lead.message}</td></tr>` : ""}
      <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600">Time</td><td style="padding:8px;border:1px solid #e2e8f0">${new Date().toLocaleString()}</td></tr>
    </table>
    <p style="color:#64748b;font-size:13px;margin-top:16px">Sent by your AI Receptionist</p>
  `;

  try {
    await transporter.sendMail({
      from: `"AI Receptionist" <${client.smtp.user}>`,
      to: client.smtp.notifyEmail,
      subject,
      html,
    });
    console.log(`Lead email sent to ${client.smtp.notifyEmail}`);
  } catch (err) {
    console.error("Failed to send lead email:", err.message);
  }
}

// ── Middleware ──────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

// Rate limiting — max 30 messages per IP per minute
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Too many messages. Please wait a moment." },
});
app.use("/chat", limiter);

// Serve the widget JS file
app.use("/widget", express.static("../widget"));

// ── Helper: build the system prompt for a client ───────────────────────────

function buildSystemPrompt(client, language) {
  const today = new Date();
  const dayName = today.toLocaleDateString("en-US", { weekday: "long" });
  const dateStr = today.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = today.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const hoursText = Object.entries(client.hours)
    .map(([day, hours]) => `  ${day.charAt(0).toUpperCase() + day.slice(1)}: ${hours}`)
    .join("\n");

  const languageInstruction = language && language !== "en"
    ? `\nIMPORTANT: The visitor's browser language is "${language}". Always respond in that language unless the visitor writes in a different language, in which case match their language.\n`
    : "";

  return `You are a friendly and professional AI receptionist for ${client.businessName}.

Today is ${dateStr} and the current time is ${timeStr}.
${languageInstruction}
YOUR JOB:
- Greet visitors warmly
- Answer questions about the practice
- Help patients book appointments by directing them to the booking link
- Provide office hours, location, and contact info
- Let patients know which insurance plans are accepted
- Handle basic questions about services offered
- Be empathetic — dental visits can make people nervous

BUSINESS INFORMATION:
Name: ${client.businessName}
Address: ${client.address}
Phone: ${client.phone}
Email: ${client.email}
Book an appointment: ${client.bookingUrl}

OFFICE HOURS (today is ${dayName}):
${hoursText}

SERVICES OFFERED:
${client.services.map((s) => `- ${s}`).join("\n")}

ACCEPTED INSURANCE:
${client.insurance.join(", ")}

EMERGENCY INFO:
${client.emergencyNote}

RULES:
- Keep responses short and friendly — 2 to 4 sentences max
- Never make up information not listed above
- If you don't know something, say "I'm not sure about that — please call us at ${client.phone} and our team will help you."
- Never discuss other dental offices or competitors
- Do not give medical advice — always recommend they speak with the dentist
- If someone is in pain or has an emergency, give them the emergency contact immediately`;
}

// ── Save lead endpoint ─────────────────────────────────────────────────────

app.post("/save-lead", async (req, res) => {
  const { clientId, name, email, phone, type, appointmentDate, message } = req.body;

  if (!clientId || !clients[clientId]) {
    return res.status(404).json({ error: "Client not found." });
  }

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ error: "Name is required." });
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Valid email is required." });
  }

  const lead = {
    clientId,
    type: type || "contact",
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone ? phone.trim() : null,
    appointmentDate: appointmentDate || null,
    message: message ? message.trim() : null,
  };

  saveLead(lead);

  // Send email notification (non-blocking)
  sendLeadEmail(clients[clientId], lead);

  res.json({ success: true });
});

// ── Client config endpoint ─────────────────────────────────────────────────

app.get("/client-config/:clientId", (req, res) => {
  const client = clients[req.params.clientId];
  if (!client) return res.status(404).json({ error: "Client not found." });

  res.json({
    widgetName: client.widgetName || client.businessName,
    widgetAvatar: client.widgetAvatar || "💬",
    welcomeMessage: client.welcomeMessage || `Hi there! 👋 Welcome to ${client.businessName}. How can I help you today?`,
  });
});

// ── Chat endpoint ──────────────────────────────────────────────────────────

app.post("/chat", async (req, res) => {
  const { message, clientId, history, language } = req.body;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({ error: "Message is required." });
  }

  if (message.length > 500) {
    return res.status(400).json({ error: "Message is too long." });
  }

  const client = clients[clientId];
  if (!client) {
    return res.status(404).json({ error: "Client not found." });
  }

  const recentHistory = Array.isArray(history) ? history.slice(-10) : [];
  const messages = [
    { role: "system", content: buildSystemPrompt(client, language) },
    ...recentHistory,
    { role: "user", content: message.trim() },
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 200,
      temperature: 0.7,
    });

    const reply = completion.choices[0].message.content;
    res.json({ reply });
  } catch (err) {
    console.error("OpenAI error:", err.message);
    res.status(500).json({
      error: "Something went wrong. Please try again or call the office directly.",
    });
  }
});

// ── Admin page ─────────────────────────────────────────────────────────────

app.get("/admin", (req, res) => {
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const { password } = req.query;

  if (password !== adminPassword) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Admin Login</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; }
          .box { background: white; padding: 32px; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.1); width: 100%; max-width: 360px; }
          h2 { margin: 0 0 24px; font-size: 20px; }
          input { width: 100%; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 15px; box-sizing: border-box; margin-bottom: 12px; }
          button { width: 100%; padding: 10px; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 15px; cursor: pointer; }
          button:hover { background: #1d4ed8; }
          .error { color: #ef4444; font-size: 13px; margin-bottom: 12px; }
        </style>
      </head>
      <body>
        <div class="box">
          <h2>🔒 Admin Login</h2>
          ${req.query.password ? '<p class="error">Incorrect password.</p>' : ""}
          <form method="GET">
            <input type="password" name="password" placeholder="Enter admin password" autofocus />
            <button type="submit">Login</button>
          </form>
        </div>
      </body>
      </html>
    `);
  }

  const leads = readLeads();

  const rows = leads.length === 0
    ? `<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:32px">No leads yet.</td></tr>`
    : leads.slice().reverse().map((l) => `
        <tr>
          <td>${new Date(l.createdAt).toLocaleString()}</td>
          <td>${l.clientId}</td>
          <td><span class="badge ${l.type === "appointment" ? "appt" : "contact"}">${l.type}</span></td>
          <td>${l.name}</td>
          <td><a href="mailto:${l.email}">${l.email}</a></td>
          <td>${l.phone || "—"}</td>
          <td>${l.appointmentDate || l.message || "—"}</td>
        </tr>
      `).join("");

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>AI Receptionist — Admin</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; background: #f8fafc; color: #1e293b; }
        header { background: #2563eb; color: white; padding: 16px 32px; display: flex; align-items: center; gap: 12px; }
        header h1 { margin: 0; font-size: 20px; }
        .container { padding: 32px; }
        .stats { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
        .stat { background: white; border-radius: 10px; padding: 16px 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); min-width: 140px; }
        .stat .num { font-size: 28px; font-weight: 700; color: #2563eb; }
        .stat .label { font-size: 13px; color: #64748b; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.07); }
        th { background: #f1f5f9; padding: 12px 16px; text-align: left; font-size: 13px; color: #64748b; font-weight: 600; }
        td { padding: 12px 16px; border-top: 1px solid #f1f5f9; font-size: 14px; }
        tr:hover td { background: #f8fafc; }
        a { color: #2563eb; text-decoration: none; }
        .badge { padding: 3px 10px; border-radius: 99px; font-size: 12px; font-weight: 600; }
        .badge.appt { background: #dbeafe; color: #1d4ed8; }
        .badge.contact { background: #dcfce7; color: #15803d; }
        @media (max-width: 768px) { .container { padding: 16px; } table { font-size: 12px; } th, td { padding: 8px; } }
      </style>
    </head>
    <body>
      <header>
        <span style="font-size:24px">🤖</span>
        <h1>AI Receptionist — Leads</h1>
      </header>
      <div class="container">
        <div class="stats">
          <div class="stat">
            <div class="num">${leads.length}</div>
            <div class="label">Total Leads</div>
          </div>
          <div class="stat">
            <div class="num">${leads.filter(l => l.type === "appointment").length}</div>
            <div class="label">Appointments</div>
          </div>
          <div class="stat">
            <div class="num">${leads.filter(l => l.type === "contact").length}</div>
            <div class="label">Contacts</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Client</th>
              <th>Type</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </body>
    </html>
  `);
});

// ── Health check ───────────────────────────────────────────────────────────

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ── Start server ───────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AI Receptionist server running on port ${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
});
