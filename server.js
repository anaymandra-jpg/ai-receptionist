require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const OpenAI = require("openai");
const clients = require("./clients.json");

const app = express();

if (!process.env.OPENAI_API_KEY) {
  console.error("ERROR: OPENAI_API_KEY environment variable is not set.");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Middleware ──────────────────────────────────────────────────────────────

app.use(cors()); // allow requests from any website
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

function buildSystemPrompt(client) {
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

  return `You are a friendly and professional AI receptionist for ${client.businessName}.

Today is ${dateStr} and the current time is ${timeStr}.

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

// ── Chat endpoint ──────────────────────────────────────────────────────────

app.post("/chat", async (req, res) => {
  const { message, clientId, history } = req.body;

  // Validate input
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({ error: "Message is required." });
  }

  if (message.length > 500) {
    return res.status(400).json({ error: "Message is too long." });
  }

  // Look up the client
  const client = clients[clientId];
  if (!client) {
    return res.status(404).json({ error: "Client not found." });
  }

  // Build conversation history (last 10 messages max to save cost)
  const recentHistory = Array.isArray(history) ? history.slice(-10) : [];
  const messages = [
    { role: "system", content: buildSystemPrompt(client) },
    ...recentHistory,
    { role: "user", content: message.trim() },
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // fast and cheap, perfect for a receptionist
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

// ── Health check ───────────────────────────────────────────────────────────

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ── Start server ───────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AI Receptionist server running on port ${PORT}`);
});
