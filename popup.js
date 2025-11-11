let allProjects = [];
let darkMode = false;

// Helper: Send message to background
function sendMessageAsync(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (resp) => resolve(resp));
  });
}

// Load theme preference from local storage
chrome.storage.local.get("darkMode", (data) => {
  darkMode = !!data.darkMode;
  document.body.classList.toggle("dark", darkMode);
  document.getElementById("themeToggle").innerHTML = darkMode
    ? '<i class="fa-solid fa-sun"></i>'
    : '<i class="fa-solid fa-moon"></i>';
});

// Render projects in the popup
function renderProjects(projects) {
  const container = document.getElementById("projects");
  container.innerHTML = ""; // Clear existing projects

  if (!projects.length) {
    container.innerHTML = `<p style="text-align:center;color:#888;">No new projects found.</p>`;
    return;
  }

  projects.forEach((p) => {
    const div = document.createElement("div");
    div.className = "project";

    const snippet = p.preview_description
      ? p.preview_description.slice(0, 80) + "..."
      : "";
    const summary = p.ai_summary || "Fetching summary...";

    const flag = p.country?.code
      ? String.fromCodePoint(
          ...[...p.country.code.toUpperCase()].map(
            (c) => 127397 + c.charCodeAt()
          )
        )
      : "";

    div.innerHTML = `
      <div class="title"><i class="fa-solid fa-briefcase"></i> ${p.title}</div>
      <div class="price">
        <span style="font-weight:bold;">${p.currency.sign} ${
      p.budget.minimum
    }-${p.budget.maximum} ${
      p.currency.code
    } [ ${p.type[0].toUpperCase()}${p.type.slice(1)} ]</span> 
        <span style="float:right;font-weight:bold;">bid: ${
          p.bid_stats.bid_count
        } avg: $${Math.floor(p.bid_stats.bid_avg)}</span>
      </div>
      <div class="snippet">${snippet}</div>
      <div class="summary"><i class="fa-solid fa-wand-magic-sparkles"></i> ${summary}</div>
    `;

    // Click title → open project + auto-fill bid
    div.querySelector(".title").addEventListener("click", () => {
      if (!p.url) return; // Ensure URL exists
      sendMessageAsync({ action: "openProject", url: p.url });
    });

    // Show project preview on hover
    div.addEventListener("mouseenter", () => {
      div.classList.add("show-preview");
    });

    div.addEventListener("mouseleave", () => {
      div.classList.remove("show-preview");
    });

    container.appendChild(div);
  });
}

// Load projects from local storage
chrome.storage.local.get("projects", (data) => {
  if (data.projects) {
    allProjects = data.projects.map((p) => ({
      ...p,
      ai_summary: `AI Summary: ${p.title.split(" ").slice(0, 5).join(" ")}...`,
    }));
    renderProjects(allProjects);
  }
});

// Search for projects based on the input
document.getElementById("search").addEventListener("input", (e) => {
  const keyword = e.target.value.toLowerCase();
  const filtered = allProjects.filter(
    (p) =>
      p.title.toLowerCase().includes(keyword) ||
      (p.preview_description || "").toLowerCase().includes(keyword)
  );
  renderProjects(filtered);
});

// Refresh projects
document.getElementById("refresh").addEventListener("click", async () => {

   document.getElementById("loadingSpinner").style.display = "block";

  // Hide the projects list while refreshing
  document.getElementById("projects").style.display = "none";

  await sendMessageAsync({ action: "refreshProjects" });
  chrome.storage.local.get("projects", (data) => {
    if (data.projects) {
      allProjects = data.projects.map((p) => ({
        ...p,
        ai_summary: `AI Summary: ${p.title
          .split(" ")
          .slice(0, 5)
          .join(" ")}...`,
      }));
      renderProjects(allProjects); // Re-render the projects with updated data

      document.getElementById("loadingSpinner").style.display = "none";
      document.getElementById("projects").style.display = "block";
    }
  });
});

// Toggle theme
document.getElementById("themeToggle").addEventListener("click", () => {
  darkMode = !darkMode;
  document.body.classList.toggle("dark", darkMode);
  document.getElementById("themeToggle").innerHTML = darkMode
    ? '<i class="fa-solid fa-sun"></i>'
    : '<i class="fa-solid fa-moon"></i>';
  chrome.storage.local.set({ darkMode });
});

// Open the options page when the settings button is clicked
document.getElementById("settingsBtn").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
document.getElementById("guideBtn").addEventListener("click", () => {
  window.open(chrome.runtime.getURL("guide.html"), "_blank");
});
