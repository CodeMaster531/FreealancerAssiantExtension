document.addEventListener("DOMContentLoaded", () => {
  // Load profile & app preferences
  chrome.storage.local.get(["profile", "preferences"], (data) => {
    const profile = data.profile || {};
    document.getElementById("name").value = profile.name || "";
    document.getElementById("title").value = profile.title || "";
    document.getElementById("summary").value = profile.summary || "";
    document.getElementById("skills").value = profile.skills || "";

    const prefs = data.preferences || {};
    document.getElementById("bidTemplate").value = prefs.bidTemplate || "";
    document.getElementById("BidCondition").value = prefs.BidCondition || "";
    document.getElementById("interval").value = prefs.interval || "";
    document.getElementById("apiKey").value = prefs.apiKey || "";
    document.getElementById("autoFill").checked = prefs.autoFill || false;
    document.getElementById("notifications").checked =
      prefs.notifications || false;
    document.getElementById("notifications_show_mode").checked =
      prefs.notifications_show_mode || false;
    document.getElementById("gptModel").value =
      prefs.gptModel || "gpt-3.5-turbo";
  });

  // Save button
  document.getElementById("save").addEventListener("click", () => {
    // Save profile
    const profile = {
      name: document.getElementById("name").value.trim(),
      title: document.getElementById("title").value.trim(),
      summary: document.getElementById("summary").value.trim(),
      skills: document.getElementById("skills").value.trim(),
    };

    // Save preferences
    const preferences = {
      bidTemplate: document.getElementById("bidTemplate").value.trim(),
      gptModel: document.getElementById("gptModel").value.trim(),
      BidCondition: document.getElementById("BidCondition").value.trim(),
      interval: parseInt(document.getElementById("interval").value) || 30,
      apiKey: document.getElementById("apiKey").value.trim(),
      autoFill: document.getElementById("autoFill").checked,
      notifications: document.getElementById("notifications").checked,
      notifications_show_mode: document.getElementById(
        "notifications_show_mode"
      ).checked,
    };

    chrome.storage.local.set({ profile, preferences }, () => {
      const modal = document.getElementById("reloadModal");
      modal.style.display = "flex"; // Show modal

      setTimeout(() => {
        modal.style.display = "none";
        chrome.runtime.sendMessage({ action: "reloadExtension" });
      }, 3000);

      // Update background fetch interval
      chrome.alarms.clear("checkProjects", () => {
        chrome.alarms.create("checkProjects", {
          periodInMinutes: preferences.interval,
        });
      });
    });
  });


  document
    .getElementById("apiKeyValidate")
    .addEventListener("click", async () => {
      const apiKey = document.getElementById("apiKey").value.trim();
      const resultMessage = document.getElementById("apiKeyResult");

      if (apiKey === "") {
        resultMessage.textContent = "Please enter an API key.";
        resultMessage.style.color = "red";
        return;
      }

      const isValid = await validateApiKey(apiKey);
      
      if (isValid) {
        resultMessage.textContent = "API Key is valid!";
        resultMessage.style.backgroundColor="#54e75c7a"
        resultMessage.style.color = "green";
      } else {
        resultMessage.textContent = "Invalid API Key. Please try again.";
        resultMessage.style.backgroundColor="#ddf12d65"
        resultMessage.style.color = "red";
      }

      resultMessage.style.display='block';
      setTimeout(() => {
        resultMessage.style.display='none';
      }, 3000);
    });

  // Function to validate API key
  async function validateApiKey(apiKey) {
    try {
      // Replace with the actual API URL you're validating the key against
      const response = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (response.ok) {
        // API key is valid
        return true;
      } else {
        // API key is invalid
        return false;
      }
    } catch (error) {
      console.error("Error validating API key:", error);
      return false;
    }
  }
});
