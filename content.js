(async function() {
  // Wait until textarea exists
  function waitForTextarea(timeout = 5000, interval = 300) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        const textarea = document.querySelector("#descriptionTextArea");
        if (textarea) return resolve(textarea);
        if (Date.now() - start > timeout) return reject("Textarea not found in time.");
        setTimeout(check, interval);
      };
      check();
    });
  }

  let textarea;
  try {
    textarea = await waitForTextarea(60000, 300);
  } catch (err) {
    console.warn(err);
    return;
  }

  // Extract project description
  function getProjectDescription() {
    const selectors = ["span.font-normal.text-foreground.text-xsmall.whitespace-pre-line"];
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el?.innerText?.trim().length > 20) return el.innerText.trim();
    }
    return document.body.innerText.slice(0, 2000);
  }

  const projectDescription = getProjectDescription();

  // Promise wrapper for sendMessage
  function sendMessageAsync(msg) {
    return new Promise(resolve => chrome.runtime.sendMessage(msg, resolve));
  }

  // Request AI bid
  let resp;
  try {
    resp = await sendMessageAsync({ action: "generateBid", description: projectDescription });
  } catch (err) {
    console.warn("AI generation failed:", err);
  }

  const bidText = resp?.bid || `Hello, I hope you're doing well.\n\nI believe I am the best candidate for this project...`;
  const normalized = bidText.replace(/([.!?])\s+(?=[A-Z0-9"“‘])/g, "$1\n\n");

  textarea.value = normalized;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  console.log("Bid textarea auto-filled successfully.");
})();
