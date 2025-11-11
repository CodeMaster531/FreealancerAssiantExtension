document.addEventListener("DOMContentLoaded", () => {
  // Load profile & app preferences
  chrome.storage.local.get(["profile", "preferences"], (data) => {
    const profile = data.profile || {};
    document.getElementById("name").value = profile.name || "";
    document.getElementById("title").value = profile.title || "";
    document.getElementById("summary").value = profile.summary || "";
    document.getElementById("skills").value = profile.skills || "";

    const prefs = data.preferences || {};
    document.getElementById("interval").value = prefs.interval || "";
    document.getElementById("apiKey").value = prefs.apiKey || "";
    document.getElementById("autoFill").checked = prefs.autoFill || false;
    document.getElementById("notifications").checked = prefs.notifications || false;
    document.getElementById("notifications_show_mode").checked = prefs.notifications_show_mode || false;
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
      interval: parseInt(document.getElementById("interval").value) || 1,
      apiKey: document.getElementById("apiKey").value.trim(),
      autoFill: document.getElementById("autoFill").checked,
      notifications: document.getElementById("notifications").checked,
      notifications_show_mode: document.getElementById("notifications_show_mode").checked,
    };

    chrome.storage.local.set({ profile, preferences }, () => {
      alert("Settings saved successfully!");

      // Update background fetch interval
      chrome.alarms.clear("checkProjects", () => {
        chrome.alarms.create("checkProjects", { periodInMinutes: preferences.interval });
      });
    });
  });
});
