let lastProjectIds = [];
let preferences = {
  interval: 30,
  apiKey: "", // default empty, load from storage
  autoFill: false,
  notifications: false,
  notifications_show_mode: false,
  bidTemplate: "",
  gptModel: "gpt-3.5-turbo",
  BidCondition: `Please write a winning bid that is attentive, flawless, courteous, engaging, and technical.
Provide a winning bid that would make the client eager to hire me, ensuring all aspects are covered.\n\n`,
};

let profile = {
  name: "",
  title: "",
  summary: "",
};

let TempBid = `Hello, I hope you're doing well.\n
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
    chrome.storage.local.get(["preferences", "profile", "projects"], (data) => {
      if (data.preferences) {
        preferences.interval = Math.max(
          30,
          data.preferences.interval ?? preferences.interval
        );
        preferences.autoFill =
          data.preferences.autoFill ?? preferences.autoFill;
        preferences.apiKey = data.preferences.apiKey || preferences.apiKey;
        preferences.notifications =
          data.preferences.notifications ?? preferences.notifications;
        preferences.notifications_show_mode =
          data.preferences.notifications_show_mode ??
          preferences.notifications_show_mode;
        preferences.bidTemplate = data.preferences.bidTemplate ?? TempBid;
        preferences.BidCondition =
          data.preferences.BidCondition ?? preferences.BidCondition;
        preferences.gptModel =
          data.preferences.gptModel ?? preferences.gptModel;
      }
      if (data.profile) {
        profile.name = data.profile.name ?? profile.name;
        profile.title = data.profile.title ?? profile.title;
        profile.summary = data.profile.summary ?? profile.summary;
      }
      if (data.projects) lastProjectIds = data.projects.map((p) => p.id);
      console.log(preferences);
      console.log(profile);
      resolve();
    });
  });
}

// ---------------------------
// Setup periodic fetch method 1 using chrome alarm
// ---------------------------

// function setupAlarm() {
//   chrome.alarms.clear("checkProjects", () => {
//     chrome.alarms.create("checkProjects", {
//       periodInMinutes: preferences.interval,
//     });
//   });
// }
// ---------------------------
// Setup periodic fetch method 2 using setinterval
// ---------------------------
function setupAlarm() {
  setInterval(() => {
    console.log("Checking projects every 30 seconds");
    fetchProjects();
  }, preferences.interval * 1000); // 30000 ms = 30 seconds
}
//-------------------------------
// Listen for a popup connection
// Send a message to the popup
//--------------------------------
let connectedPorts = []; // Track the connections
function sendMessageToPopup(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      console.log("Received response from popup:", response, message);
      if (response.status == true) {
        resolve();
      }
      if (response == undefined || response.status == false || !response)
        reject();
    });
  });
}
// ---------------------------
// Fetch projects from Freelancer
// ---------------------------
// This port for traffic from backend to popup
//
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
      // -------------------------------------------------------------

      sendMessageToPopup({
        action: "updatePopup",
      })
        .then(() => {
          console.log('notification');
          // display notification on desktop
          if (preferences.notifications) {
            newOnes.forEach((p, i) => {
              const notifId = String(p.id);
              notificationMap[notifId] = p.url;
              setTimeout(() => {
                chrome.notifications.create(notifId, {
                  type: "basic",
                  iconUrl: "icon.png",
                  title: p.title,
                  message: `Budget: ${p.currency?.sign || "$"}${
                    p.budget.minimum
                  }-${p.budget.maximum} ${p.currency.code} [ ${
                    p.type[0].toUpperCase() + p.type.slice(1)
                  } ]
                    \nClick to view`,
                  priority: 2,
                  requireInteraction: preferences.notifications_show_mode,
                });
              }, i * 459);
            });
          }
        })
        .catch(() => {
          console.log("Not found new Projects");
        });

      // --------------------------------------------------------------
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
  if (!preferences.apiKey) {
    console.warn("apikey is missing");
    return preferences.bidTemplate ? preferences.bidTemplate : TempBid;
  }
  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${preferences.apiKey}`,
      },
      body: JSON.stringify({
        model: `${preferences.gptModel}`,
        messages: [
          {
            role: "system",
            content:
              "You are a professional freelancer. Write a polite, concise, convincing bid for a client. End each sentence with a line break.",
          },
          {
            role: "user",
            content:
              `This is project description.(main):\n\n ${description}\n\n` +
                profile.name &&
              `Also, reference this:This is my name:${profile.name}\n\n` +
                profile.title &&
              `This is my title/role : \n\n ${profile.title}\n\n` +
                profile.summary &&
              `This is my summary(not essential):\n\n ${profile.summary}` +
                `${preferences.BidCondition}\n\n
                Characters must be no longer than 1500.
              `,
          },
        ],
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });

    const data = await resp.json();
    console.log(data);
    return (
      data?.choices?.[0]?.message?.content ||
      (preferences.bidTemplate ? preferences.bidTemplate : TempBid)
    );
  } catch (err) {
    console.error("AI generation error:", err);
    return preferences.bidTemplate ? preferences.bidTemplate : TempBid;
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
    if (msg.action === "reloadExtension") {
      chrome.runtime.reload();
    }

    if (msg.action === "openProject") {
      const { url } = msg;
      chrome.tabs.create({ url }, (tab) => {
        const listener = async (tabId, changeInfo) => {
          if (tabId === tab.id && changeInfo.status === "complete") {
            // Step 1: get full description from project page
            // const [{ result: fullDescription }] =
            //   await chrome.scripting.executeScript({
            //     target: { tabId: tab.id },
            //     func: () => {
            //       function getProjectDescription() {
            //         const el = document.querySelector(
            //           "span.font-normal.text-foreground.text-xsmall.whitespace-pre-line"
            //         );
            //         return (
            //           el?.innerText?.trim() ||
            //           document.body.innerText.slice(0, 3000)
            //         );
            //       }
            //       return getProjectDescription();
            //     },
            //   });
            // console.log(fullDescription);
            // // Step 2: send full description to AI (generate bid)
            // const bidText =
            //   (await generateAIBid(fullDescription)) ||
            //   "Hello, I hope you're doing well...\n\nBest regards,\n[Your Name]";
            // // Step 3: fill textarea
            // await chrome.scripting.executeScript({
            //   target: { tabId: tab.id },
            //   func: (bid) => {
            //     const textarea = document.querySelector("#descriptionTextArea");
            //     if (textarea) {
            //       textarea.value = bid;
            //       textarea.dispatchEvent(new Event("input", { bubbles: true }));
            //     }
            //   },
            //   args: [bidText],
            // });
            // chrome.tabs.onUpdated.removeListener(listener);
          }
        };

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
