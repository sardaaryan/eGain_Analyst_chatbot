// ─── Mock database ────────────────────────────────────────────────────────────

const mockOrders = {
  EG12345: {
    status: "in_transit",
    carrier: "FedEx",
    trackingNumber: "FX-7829341-US",
    lastLocation: "Dallas, TX",
    eta: "Tomorrow by 8 PM",
    description: "Wireless Headphones (Black)",
    origin: "Los Angeles, CA",
  },
  EG22222: {
    status: "delivered",
    carrier: "UPS",
    trackingNumber: "UPS-4410029-CA",
    deliveredAt: "Today at 2:34 PM",
    deliveredTo: "Front door",
    description: "Smart Watch Bundle",
    photoAvailable: true,
  },
  EG33333: {
    status: "delayed",
    carrier: "USPS",
    trackingNumber: "USPS-EG33333XX",
    lastLocation: "Memphis, TN",
    originalEta: "Yesterday",
    updatedEta: "Day after tomorrow",
    reason: "Severe weather at distribution center",
    description: "Office Chair",
  },
  EG44444: {
    status: "out_for_delivery",
    carrier: "Amazon Logistics",
    trackingNumber: "TBA-44444-US",
    lastLocation: "Local facility",
    eta: "Today by 9 PM",
    description: "Kindle Paperwhite",
  },
};

// ─── Conversation state ───────────────────────────────────────────────────────

const conversationState = {
  step: "ask_order_id",
  currentOrder: null,
  currentOrderId: null,
  claimDetails: {},
};

// ─── Mock tools ───────────────────────────────────────────────────────────────

function lookupOrder(orderId) {
  return mockOrders[orderId.toUpperCase()] || null;
}

function fileClaim(orderId, reason) {
  const claimId = "CLM-" + Math.random().toString(36).substr(2, 6).toUpperCase();
  return { claimId, orderId, reason, status: "submitted", timestamp: new Date().toLocaleString() };
}

function isValidOrderFormat(input) {
  return /^[A-Za-z]{2}\d{5}$/i.test(input.trim());
}

// ─── DOM helpers ──────────────────────────────────────────────────────────────

function addMessage(text, sender, extraHTML) {
  const area = document.getElementById("chat-area");

  const row = document.createElement("div");
  row.className = "msg-row " + sender;

  if (sender === "bot") {
    const icon = document.createElement("div");
    icon.className = "bot-icon";
    icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
    </svg>`;
    row.appendChild(icon);
  }

  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.maxWidth = "80%";
  if (sender === "user") wrapper.style.alignItems = "flex-end";

  const bubble = document.createElement("div");
  bubble.className = "bubble " + sender;
  bubble.innerHTML = text;
  wrapper.appendChild(bubble);

  if (extraHTML) {
    const extra = document.createElement("div");
    extra.innerHTML = extraHTML;
    wrapper.appendChild(extra);
  }

  row.appendChild(wrapper);
  area.appendChild(row);
  area.scrollTop = area.scrollHeight;
  return row;
}

function addDivider(text) {
  const area = document.getElementById("chat-area");
  const div = document.createElement("div");
  div.className = "chat-divider";
  div.innerHTML = `<span>${text}</span>`;
  area.appendChild(div);
}

function showTyping() {
  const area = document.getElementById("chat-area");
  const row = document.createElement("div");
  row.className = "msg-row bot";
  row.id = "typing-indicator";

  const icon = document.createElement("div");
  icon.className = "bot-icon";
  icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2"/>
    <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
  </svg>`;

  const typing = document.createElement("div");
  typing.className = "typing-bubble";
  typing.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';

  row.appendChild(icon);
  row.appendChild(typing);
  area.appendChild(row);
  area.scrollTop = area.scrollHeight;
}

function hideTyping() {
  const t = document.getElementById("typing-indicator");
  if (t) t.remove();
}

function showQuickReplies(options) {
  const area = document.getElementById("chat-area");
  const existing = area.querySelector(".quick-replies");
  if (existing) existing.remove();

  const container = document.createElement("div");
  container.className = "quick-replies";
  container.id = "quick-replies";

  options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.className = "qr-btn";
    btn.textContent = opt;
    btn.onclick = () => handleQuickReply(opt);
    container.appendChild(btn);
  });

  area.appendChild(container);
  area.scrollTop = area.scrollHeight;
}

function removeQuickReplies() {
  const el = document.getElementById("quick-replies");
  if (el) el.remove();
}

function botReply(text, extraHTML, delay, qrOptions) {
  return new Promise((resolve) => {
    showTyping();
    setTimeout(() => {
      hideTyping();
      addMessage(text, "bot", extraHTML);
      if (qrOptions) setTimeout(() => showQuickReplies(qrOptions), 150);
      resolve();
    }, delay || 900);
  });
}

// ─── Card builders ────────────────────────────────────────────────────────────

function buildOrderCard(order, orderId) {
  let statusClass = "status-transit";
  let statusLabel = "In Transit";
  if (order.status === "delivered") {
    statusClass = "status-delivered";
    statusLabel = "Delivered";
  }
  if (order.status === "delayed") {
    statusClass = "status-delayed";
    statusLabel = "Delayed";
  }
  if (order.status === "out_for_delivery") {
    statusClass = "status-transit";
    statusLabel = "Out for Delivery";
  }

  let rows = `
    <div class="info-card-row">
      <span class="info-label">Order ID</span>
      <span class="info-value">${orderId}</span>
    </div>
    <div class="info-card-row">
      <span class="info-label">Item</span>
      <span class="info-value">${order.description}</span>
    </div>
    <div class="info-card-row">
      <span class="info-label">Status</span>
      <span class="info-value"><span class="status-badge ${statusClass}">${statusLabel}</span></span>
    </div>
    <div class="info-card-row">
      <span class="info-label">Carrier</span>
      <span class="info-value">${order.carrier}</span>
    </div>
    <div class="info-card-row">
      <span class="info-label">Tracking #</span>
      <span class="info-value">${order.trackingNumber}</span>
    </div>`;

  if (order.status === "in_transit" || order.status === "out_for_delivery") {
    rows += `
      <div class="info-card-row">
        <span class="info-label">Last seen</span>
        <span class="info-value">${order.lastLocation}</span>
      </div>
      <div class="info-card-row">
        <span class="info-label">Estimated arrival</span>
        <span class="info-value">${order.eta}</span>
      </div>`;
  }

  if (order.status === "delivered") {
    rows += `
      <div class="info-card-row">
        <span class="info-label">Delivered</span>
        <span class="info-value">${order.deliveredAt}</span>
      </div>
      <div class="info-card-row">
        <span class="info-label">Left at</span>
        <span class="info-value">${order.deliveredTo}</span>
      </div>`;
    if (order.photoAvailable) {
      rows += `
      <div class="info-card-row">
        <span class="info-label">Delivery photo</span>
        <span class="info-value" style="color:#1a56db">📷 Available</span>
      </div>`;
    }
  }

  if (order.status === "delayed") {
    rows += `
      <div class="info-card-row">
        <span class="info-label">Last seen</span>
        <span class="info-value">${order.lastLocation}</span>
      </div>
      <div class="info-card-row">
        <span class="info-label">New ETA</span>
        <span class="info-value">${order.updatedEta}</span>
      </div>
      <div class="info-card-row">
        <span class="info-label">Reason</span>
        <span class="info-value">${order.reason}</span>
      </div>`;
  }

  return `<div class="info-card">${rows}</div>`;
}

function buildClaimCard(claim) {
  return `<div class="claim-card">
    <div class="claim-title">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      Claim submitted successfully
    </div>
    <div class="info-card-row" style="border:none;padding:2px 0">
      <span class="info-label">Claim ID</span>
      <span class="claim-id">${claim.claimId}</span>
    </div>
    <div class="info-card-row" style="border:none;padding:2px 0">
      <span class="info-label">Submitted</span>
      <span class="info-value">${claim.timestamp}</span>
    </div>
  </div>`;
}

// ─── Shared intent helpers ────────────────────────────────────────────────────

// Returns true only for clearly affirmative input
function isYes(lower) {
  return /\b(yes|yeah|yep|yup|sure|ok|okay|got it|received|i got|i did|found it|correct|right|affirmative|please|go ahead|do it|file it|sounds good)\b/.test(lower);
}

// Returns true only for clearly negative input
function isNo(lower) {
  return /\b(no|nope|nah|not|never|didn't|did not|haven't|i haven't|no one|nobody|nothing|cancel|skip|nevermind|never mind|that's okay|thats okay|i'm good|im good|all good|that's all|thats all|thanks|thank you|no thanks|don't|dont)\b/.test(lower);
}

// ─── Conversation logic ───────────────────────────────────────────────────────

async function processUserInput(userText) {
  const input = userText.trim();
  const lower = input.toLowerCase();

  removeQuickReplies();

  // Global: escalate to human agent
  if (/\b(agent|human|representative|speak to agent|real person|live person)\b/.test(lower)) {
    conversationState.step = "done";
    await botReply("I'll connect you with a human agent right away. Your chat transcript will be shared with them so you don't have to repeat yourself.<br><br>Average wait time: <strong>2 minutes</strong>. Thank you for your patience! 🙏");
    showQuickReplies(["Track another order"]);
    return;
  }

  // Global: restart
  if (/\b(start over|restart|new order|track another order|track another)\b/.test(lower)) {
    conversationState.step = "ask_order_id";
    conversationState.currentOrder = null;
    conversationState.currentOrderId = null;
    conversationState.claimDetails = {};
    addDivider("New conversation");
    await botReply("Sure! What's the order ID you'd like to look up? It should look like <code style='background:#e8f0fd;padding:1px 5px;border-radius:4px;font-size:13px'>EG12345</code>.");
    return;
  }

  switch (conversationState.step) {
    // ── Ask for order ID ────────────────────────────────────────────────────
    case "ask_order_id": {
      const orderIdMatch = input.match(/[A-Za-z]{2}\d{5}/i);
      if (!orderIdMatch) {
        await botReply(`That doesn't look like a valid order ID. Please use a format like <code style='background:#e8f0fd;padding:1px 5px;border-radius:4px;font-size:13px'>EG12345</code> — two letters followed by five digits.`);
        return;
      }

      const orderId = orderIdMatch[0].toUpperCase();
      const order = lookupOrder(orderId);

      if (!order) {
        await botReply(`I couldn't find any order matching <strong>${orderId}</strong>. Double-check the ID in your confirmation email, or type "agent" to get help from our team.`, null, 800, ["Try again", "Contact agent"]);
        return;
      }

      conversationState.currentOrder = order;
      conversationState.currentOrderId = orderId;

      if (order.status === "in_transit") {
        conversationState.step = "post_transit";
        await botReply(`Found it! Here's the latest on your shipment:`, buildOrderCard(order, orderId));
        setTimeout(() => botReply(`Your package is on its way and currently in <strong>${order.lastLocation}</strong>. Estimated arrival is <strong>${order.eta}</strong>. Is there anything else I can help you with?`, null, 700, ["Yes, more help", "No, I'm good", "Track another order"]), 500);
      } else if (order.status === "out_for_delivery") {
        conversationState.step = "post_transit";
        await botReply(`Great news! Your order is <strong>out for delivery today</strong>:`, buildOrderCard(order, orderId));
        setTimeout(() => botReply(`Keep an eye out — delivery is expected <strong>${order.eta}</strong>. Anything else I can help with?`, null, 700, ["Yes, more help", "No, I'm good", "Track another order"]), 500);
      } else if (order.status === "delivered") {
        conversationState.step = "ask_received";
        await botReply(`Here's your order info:`, buildOrderCard(order, orderId));
        setTimeout(() => botReply(`According to our records, this package was delivered <strong>${order.deliveredAt}</strong>. Did you receive it?`, null, 800, ["Yes, got it!", "No, I didn't"]), 400);
      } else if (order.status === "delayed") {
        conversationState.step = "post_delayed";
        await botReply(`I found your order — but unfortunately there's a delay:`, buildOrderCard(order, orderId));
        setTimeout(
          () =>
            botReply(`We're sorry about this! The delay is due to <strong>${order.reason}</strong>. Your package is at <strong>${order.lastLocation}</strong> and should arrive by <strong>${order.updatedEta}</strong>.<br><br>What would you like to do?`, null, 800, [
              "File a claim",
              "That's okay",
              "Contact agent",
            ]),
          400,
        );
      }
      break;
    }

    // ── Did you receive the package? ────────────────────────────────────────
    case "ask_received": {
      if (isYes(lower)) {
        conversationState.step = "done";
        await botReply("That's great to hear! Enjoy your order. 😊 Is there anything else I can help you with?", null, 700, ["Track another order", "No, all good!"]);
      } else if (isNo(lower)) {
        conversationState.step = "check_photo";
        await botReply("I'm sorry to hear that! Let's figure this out. First — did you check the delivery photo? Sometimes packages are left in a spot that's hard to spot at first glance.", null, 900, ["Yes, checked already", "Let me check now"]);
      } else {
        await botReply("Sorry, I didn't catch that. Could you let me know — did you receive the package?", null, 600, ["Yes, got it!", "No, I didn't receive it"]);
      }
      break;
    }

    // ── Did you check the delivery photo? ───────────────────────────────────
    case "check_photo": {
      if (isYes(lower) || isNo(lower)) {
        // Either answer moves us forward — we just want to acknowledge before asking about neighbours
        conversationState.step = "check_neighbor";
        await botReply("Got it. One more thing — could a neighbor, the building front desk, or a mail room have accepted the package on your behalf?", null, 900, ["Yes, I'll check", "I checked — no one has it"]);
      } else {
        await botReply("Did you get a chance to check the delivery photo or look around the drop-off area?", null, 600, ["Yes, checked already", "Let me check now"]);
      }
      break;
    }

    // ── Could a neighbour have it? ──────────────────────────────────────────
    case "check_neighbor": {
      if (isYes(lower)) {
        conversationState.step = "ask_received_final";
        await botReply("No problem, take your time. Let me know what you find!", null, 700, ["Found it!", "Still can't find it"]);
      } else if (isNo(lower)) {
        conversationState.step = "offer_claim";
        await botReply(`I understand — this sounds like a missing package situation. I'd recommend filing a claim so our team can investigate and arrange a replacement or refund. Would you like me to file a claim for order <strong>${conversationState.currentOrderId}</strong>?`, null, 1000, [
          "Yes, file a claim",
          "Not right now",
          "Contact agent",
        ]);
      } else {
        await botReply("Could a neighbor, the front desk, or a mail room have accepted the package on your behalf?", null, 600, ["Yes, I'll check", "I checked — no one has it"]);
      }
      break;
    }

    // ── Final check after neighbour follow-up ───────────────────────────────
    case "ask_received_final": {
      if (isYes(lower)) {
        conversationState.step = "done";
        await botReply("Wonderful! Glad we sorted that out. Enjoy your delivery! 🎉", null, 700, ["Track another order", "All done!"]);
      } else if (isNo(lower)) {
        conversationState.step = "offer_claim";
        await botReply("Sorry to hear it's still missing. Let me file a claim for you — our team will investigate and get back to you within 24–48 hours. Shall I go ahead?", null, 1000, ["Yes, file a claim", "Contact agent"]);
      } else {
        await botReply("Were you able to track it down? Let me know if you found it or if it's still missing.", null, 600, ["Found it!", "Still can't find it"]);
      }
      break;
    }

    // ── Offer / confirm claim (also handles delayed flow) ───────────────────
    case "offer_claim":
    case "post_delayed": {
      const wantsClaim = isYes(lower) || /\b(claim|file)\b/.test(lower);
      const contactAgent = /\b(agent|contact|human|representative)\b/.test(lower);
      const declines = isNo(lower) && !wantsClaim;

      if (contactAgent) {
        conversationState.step = "done";
        await botReply("Connecting you now to a live agent. They'll have full access to your order details. Hang tight!", null, 700, ["Track another order"]);
      } else if (declines) {
        conversationState.step = "done";
        await botReply("Understood. If you change your mind, just come back and I'll be here. Is there anything else I can help with?", null, 700, ["Track another order", "All done"]);
      } else if (wantsClaim) {
        conversationState.step = "claim_filed";
        const reason = conversationState.currentOrder.status === "delayed" ? "Shipment delay" : "Package not received after delivery confirmation";
        const claim = fileClaim(conversationState.currentOrderId, reason);
        await botReply(`Done! Your claim has been filed:`, buildClaimCard(claim));
        setTimeout(
          () =>
            botReply(`Our team will review the case and contact you within <strong>24–48 hours</strong> with next steps. If we confirm the package is lost, we'll arrange a <strong>free replacement or full refund</strong>. Is there anything else you need?`, null, 800, [
              "Track another order",
              "All done!",
            ]),
          400,
        );
      } else {
        await botReply("Sorry, I didn't catch that. Would you like me to file a claim, or would you prefer to speak to an agent?", null, 600, ["Yes, file a claim", "No thanks", "Contact agent"]);
      }
      break;
    }

    // ── Post transit / out-for-delivery wrap-up ─────────────────────────────
    case "post_transit": {
      const moreHelp = isYes(lower) || /\b(more|help|another|track)\b/.test(lower);
      const noMoreHelp = isNo(lower) && !moreHelp;

      if (moreHelp) {
        conversationState.step = "ask_order_id";
        await botReply("Of course! Do you have another order ID you'd like to look up, or is there something specific about this shipment I can help with?");
      } else if (noMoreHelp) {
        conversationState.step = "done";
        await botReply("Perfect! Hope your delivery arrives on time. Come back anytime if you need help. 👋", null, 700, ["Track another order"]);
      } else {
        await botReply("Sorry, I didn't quite catch that. Is there anything else I can help you with?", null, 600, ["Yes, more help", "No, I'm good", "Track another order"]);
      }
      break;
    }

    // ── Conversation complete ───────────────────────────────────────────────
    case "claim_filed":
    case "done": {
      if (/\b(track|order)\b/.test(lower) || isValidOrderFormat(input)) {
        conversationState.step = "ask_order_id";
        if (isValidOrderFormat(input)) {
          handleUserInput(input);
          return;
        }
        await botReply("Sure! What order ID would you like to look up?");
      } else if (isYes(lower)) {
        conversationState.step = "ask_order_id";
        await botReply("Great! What order ID would you like to look up?");
      } else if (isNo(lower)) {
        await botReply("No problem! Come back anytime. Have a great day! 👋", null, 600);
      } else {
        await botReply("I'm here if you need anything else! You can enter another order ID anytime to track a shipment.", null, 700, ["Track another order"]);
      }
      break;
    }

    default: {
      await botReply("I'm not sure I understood that. Could you try entering your order ID? It looks like <code style='background:#e8f0fd;padding:1px 5px;border-radius:4px;font-size:13px'>EG12345</code>.");
    }
  }
}

// ─── Input handlers ───────────────────────────────────────────────────────────

function handleQuickReply(text) {
  removeQuickReplies();
  addMessage(text, "user");
  processUserInput(text);
}

function handleUserInput(override) {
  const inputEl = document.getElementById("user-input");
  const text = override || inputEl.value.trim();
  if (!text) return;
  if (!override) inputEl.value = "";
  removeQuickReplies();
  addMessage(text, "user");
  processUserInput(text);
}

document.getElementById("send-btn").addEventListener("click", () => handleUserInput());
document.getElementById("user-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleUserInput();
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

(async function init() {
  await new Promise((r) => setTimeout(r, 400));
  addDivider("Today");
  await botReply("👋 Hi there! I'm PackageAssist, your automated delivery support agent.", null, 700);
  setTimeout(() => {
    botReply("I can help you <strong>track your shipment</strong>, check delivery status, or file a claim if something went wrong. To get started, what's your <strong>order ID</strong>?", null, 600);
  }, 300);
})();
