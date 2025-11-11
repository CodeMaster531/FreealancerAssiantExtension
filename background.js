let lastProjectIds = [];
let preferences = {
  interval: 1,
  apiKey:
    "", // default empty, load from storage
  autoFill: false,
  notifications: false,
  notification_show_mode: false,
};

let bidTemplate = `Hello, I hope you're doing well.\n
I believe I am the best candidate for this project because I bring combination of proven experience, technical expertise, and strong attention to detail.\n
I have successfully completed similar projects in the past, which means I understand the challenges and how to solve them efficiently.\n
My focus is always delivering high-quality result, meeting deadlines, and ensuring smooth communication throughout the project.\n
I am committed to not only meeting your requirements but also adding value by suggesting improvements when possible.\n
Looking forward to working with you for the long term.\n
Best regards,\n
[Your Name]`;

const notificationMap = {};

// ---------------------------
// Load preferences and projects
// ---------------------------
async function loadPreferences() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["preferences", "projects"], (data) => {
      if (data.preferences) {
        preferences.interval = Math.max(
          1,
          data.preferences.interval ?? preferences.interval
        );
        preferences.autoFill =
          data.preferences.autoFill ?? preferences.autoFill;
        preferences.apiKey = data.preferences.apiKey || preferences.apiKey;
        preferences.notifications =
          data.preferences.notifications ?? preferences.notifications;
        preferences.notification_show_mode =
          data.preferences.notification_show_mode ??
          preferences.notification_show_mode;
      }
      if (data.projects) lastProjectIds = data.projects.map((p) => p.id);
      console.log(preferences);
      resolve();
    });
  });
}

// ---------------------------
// Setup periodic fetch
// ---------------------------
function setupAlarm() {
  chrome.alarms.clear("checkProjects", () => {
    chrome.alarms.create("checkProjects", {
      periodInMinutes: preferences.interval,
    });
  });
}

// ---------------------------
// Fetch projects from Freelancer
// ---------------------------
async function fetchProjects() {
  try {
    const res = await fetch(
      "https://www.freelancer.com/api/projects/0.1/projects/active/?limit=30"
    );
    const data = await res.json();
    const projects = data.result.projects || [];

    const projectsWithUrl = projects
      .filter((p) => p.currency?.code !== "INR")
      .map((p) => ({
        id: p.id,
        type: p.type,
        currency: p.currency,
        title: p.title,
        budget: p.budget,
        country: p.country,
        bid_stats: p.bid_stats,
        preview_description: p.preview_description || p.description,
        url: `https://www.freelancer.com/projects/${p.seo_url || p.id}`,
      }));

    const newOnes = projectsWithUrl.filter(
      (p) => !lastProjectIds.includes(p.id)
    );

    if (newOnes.length > 0) {
      lastProjectIds = projectsWithUrl.map((p) => p.id);
      chrome.storage.local.set({ projects: projectsWithUrl });

      if (preferences.notifications) {
        newOnes.forEach((p, i) => {
          const notifId = String(p.id);
          notificationMap[notifId] = p.url;
          setTimeout(() => {
            chrome.notifications.create(notifId, {
              type: "basic",
              iconUrl: "icon.png",
              title: p.title,
              message: `Budget: ${p.currency?.sign || "$"}${p.budget.minimum}-${
                p.budget.maximum
              } ${p.currency.code} [ ${p.type[0].toUpperCase()+p.type.slice(1)} ]
              \nClick to view`,
              priority: 2,
              requireInteraction: preferences.notification_show_mode,
            });
          }, i * 500);
        });
      }
    }
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

// ---------------------------
// Notification click handler
// ---------------------------
chrome.notifications.onClicked.addListener((notifId) => {
  const url = notificationMap[notifId];
  if (url) {
    chrome.tabs.create({ url });
    chrome.notifications.clear(notifId);
  }
});

// ---------------------------
// Alarm listener
// ---------------------------
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "checkProjects") fetchProjects();
});

// ---------------------------
// Generate AI bid
// ---------------------------
async function generateAIBid(description) {
  console.log('apikey:' + preferences.apiKey);
  if (!preferences.apiKey) {
    console.warn("apikey is missing");
    return bidTemplate;
  }

  try {
    console.log("Sending OpenAI request for bid...");
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${preferences.apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are a professional freelancer. Write a polite, concise, convincing bid for a client. End each sentence with a line break.",
          },
          {
            role: "user",
            content: `Write a winning bid that’s attentive, perfect, kind, interested, and technical:\n\n${description}`,
          },
        ],
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    const data = await resp.json();
    console.log(data);
    return data?.choices?.[0]?.message?.content || bidTemplate;
  } catch (err) {
    console.error("AI generation error:", err);
    return bidTemplate;
  }
}

// ---------------------------
// Message listener
// ---------------------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.action === "refreshProjects") {
      await fetchProjects();
      sendResponse({ success: true });
    }

    if (msg.action === "generateBid") {
      const bid = await generateAIBid(msg.description);
      sendResponse({ bid });
    }

    if (msg.action === "openProject") {
      const { url } = msg;
      chrome.tabs.create({ url }, (tab) => {
        const listener = async (tabId, changeInfo) => {
          if (tabId === tab.id && changeInfo.status === "complete") {
            // Step 1: get full description from project page
            const [{ result: fullDescription }] =
              await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                  function getProjectDescription() {
                    const el = document.querySelector(
                      "span.font-normal.text-foreground.text-xsmall.whitespace-pre-line"
                    );
                    return (
                      el?.innerText?.trim() ||
                      document.body.innerText.slice(0, 3000)
                    );
                  }
                  return getProjectDescription();
                },
              });
              console.log(fullDescription);
            // Step 2: send full description to AI (generate bid)
            const bidText =
              (await generateAIBid(fullDescription)) ||
              "Hello, I hope you're doing well...\n\nBest regards,\nMilos Markovic";

            // Step 3: fill textarea
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: (bid) => {
                const textarea = document.querySelector("#descriptionTextArea");
                if (textarea) {
                  textarea.value = bid;
                  textarea.dispatchEvent(new Event("input", { bubbles: true }));
                }
              },
              args: [bidText],
            });

            chrome.tabs.onUpdated.removeListener(listener);
          }
        }

        chrome.tabs.onUpdated.addListener(listener);
      });

      sendResponse({ success: true });
    }
  })();
  return true; // keep async response open
});

// ---------------------------
// Initialize extension
// ---------------------------
(async () => {
  await loadPreferences();
  setupAlarm();
  fetchProjects();
})();
