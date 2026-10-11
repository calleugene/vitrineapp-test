const ids = {
  artifactId: () => document.getElementById("artifactId").value.trim(),
  screenId: () => document.getElementById("screenId").value.trim(),
  draftId: () => document.getElementById("draftId").value.trim(),
  mediaId: () => document.getElementById("mediaId").value.trim(),
  modelId: () => document.getElementById("modelId").value.trim(),
};

const responseLog = document.getElementById("responseLog");

document.getElementById("artifactForm").addEventListener("submit", (event) => {
  event.preventDefault();
  submitForm("/artifacts", event.currentTarget);
});

document.getElementById("screenForm").addEventListener("submit", (event) => {
  event.preventDefault();
  submitForm(`/artifacts/${ids.artifactId()}/screens`, event.currentTarget);
});

document.getElementById("draftForm").addEventListener("submit", (event) => {
  event.preventDefault();
  submitForm(`/artifacts/${ids.artifactId()}/drafts`, event.currentTarget);
});

document.getElementById("mediaForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = formToJSON(event.currentTarget);
  data.artifact_id = ids.artifactId();
  api("/media/upload", "POST", data);
});

document.getElementById("modelForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = formToJSON(event.currentTarget);
  data.artifact_id = ids.artifactId();
  api("/models/upload", "POST", data);
});

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", async () => {
    const path = resolvePath(button.dataset.path);
    const body = button.dataset.body ? JSON.parse(button.dataset.body) : undefined;
    await api(path, button.dataset.action, body);
  });
});

document.getElementById("clearLogButton").addEventListener("click", () => {
  responseLog.textContent = "No requests yet.";
});

function resolvePath(path) {
  return path
    .replaceAll("{artifactId}", ids.artifactId())
    .replaceAll("{screenId}", ids.screenId())
    .replaceAll("{draftId}", ids.draftId())
    .replaceAll("{mediaId}", ids.mediaId())
    .replaceAll("{modelId}", ids.modelId());
}

function formToJSON(form) {
  return Object.fromEntries(new FormData(form).entries());
}

async function submitForm(path, form) {
  await api(path, "POST", formToJSON(form));
}

async function api(endpoint, method, body) {
  try {
    const response = await fetch(endpoint, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    responseLog.textContent = JSON.stringify({
      at: new Date().toISOString(),
      request: `${method} ${endpoint}`,
      status: response.status,
      response: data,
    }, null, 2);
  } catch (error) {
    responseLog.textContent = JSON.stringify({
      at: new Date().toISOString(),
      request: `${method} ${endpoint}`,
      status: "NETWORK_ERROR",
      response: { message: error.message },
    }, null, 2);
  }
}
