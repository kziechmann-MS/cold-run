const form = document.querySelector("#run-form");
const personaContainer = document.querySelector("#personas");
const customFields = document.querySelector("#custom-fields");
const status = document.querySelector("#status");
const reportSection = document.querySelector("#report");

const personas = await fetch("/api/personas").then((response) => response.json());
for (const [index, persona] of [...personas, { id: "custom", name: "Define your own", description: "Create a persona for your audience." }].entries()) {
  const label = document.createElement("label");
  label.className = "persona";
  label.innerHTML = `<input type="radio" name="persona" value="${persona.id}" ${index === 0 ? "checked" : ""}><strong>${escape(persona.name)}</strong><span>${escape(persona.description)}</span>`;
  personaContainer.append(label);
}

personaContainer.addEventListener("change", (event) => {
  customFields.hidden = event.target.value !== "custom";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button");
  button.disabled = true;
  status.textContent = "The agent is exploring. This usually takes one to three minutes…";
  reportSection.hidden = true;
  try {
    const response = await fetch("/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: document.querySelector("#url").value,
        personaId: new FormData(form).get("persona"),
        maxSteps: document.querySelector("#max-steps").value,
        customPersona: {
          name: document.querySelector("#custom-name").value,
          description: document.querySelector("#custom-description").value,
          goals: document.querySelector("#custom-goals").value,
        },
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    renderReport(result);
    status.textContent = "Run complete.";
  } catch (error) {
    status.textContent = error.message || "The run could not be completed.";
  } finally {
    button.disabled = false;
  }
});

function renderReport(report) {
  document.querySelector("#report-title").textContent = `${report.persona.name} on ${new URL(report.url).hostname}`;
  document.querySelector("#sentiment").textContent = report.analysis.sentiment;
  document.querySelector("#summary").textContent = report.analysis.summary;
  document.querySelector("#findings").replaceChildren(...report.analysis.findings.map((finding) => {
    const article = document.createElement("article");
    article.innerHTML = `<span class="severity ${finding.severity}">${escape(finding.severity)}</span><h4>${escape(finding.title)}</h4><p>${escape(finding.evidence)}</p><strong>Try this</strong><p>${escape(finding.recommendation)}</p>`;
    return article;
  }));
  document.querySelector("#evidence").replaceChildren(...report.evidence.map((entry) => {
    const article = document.createElement("article");
    article.innerHTML = `<a href="${entry.screenshot}" target="_blank" rel="noopener"><img src="${entry.screenshot}" alt="Page at step ${entry.step}"></a><div><span>Step ${entry.step} · ${escape(entry.action)}</span><h4>${escape(entry.observation)}</h4><p>${escape(entry.reason)}</p></div>`;
    return article;
  }));
  reportSection.hidden = false;
  reportSection.scrollIntoView({ behavior: "smooth" });
}

function escape(value) {
  const node = document.createElement("span");
  node.textContent = value || "";
  return node.innerHTML;
}
