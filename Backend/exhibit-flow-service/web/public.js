const code = location.pathname.split("/").filter(Boolean).pop();
const state = { screens: [], index: 0, exhibit: null };
const $ = (id) => document.getElementById(id);

load();
$("previous").addEventListener("click", () => move(-1));
$("nextStory").addEventListener("click", () => move(1));
document.addEventListener("keydown", (event) => { if (event.key === "ArrowLeft") move(-1); if (event.key === "ArrowRight" || event.key === " ") move(1); });

async function load() {
  try {
    const response = await fetch(`/api/v1/public/exhibits/${code}`);
    if (!response.ok) throw new Error();
    state.exhibit = await response.json();
    state.screens = state.exhibit.screens || [];
    $("exhibitName").textContent = state.exhibit.title || "Экспонат";
    document.title = state.exhibit.title || "Экспонат";
    if (!state.screens.length) { $("emptyStory").classList.remove("hidden"); return; }
    render();
  } catch { $("emptyStory").classList.remove("hidden"); $("emptyStory").textContent = "Экспонат недоступен или ещё не опубликован."; }
}
function move(delta) { if (!state.screens.length) return; state.index = Math.min(state.screens.length - 1, Math.max(0, state.index + delta)); render(); }
function render() {
  const screen = state.screens[state.index];
  $("storyTitle").textContent = screen.title || state.exhibit.title;
  $("storyText").textContent = screen.text || state.exhibit.short_description || "";
  const image = $("storyImage");
  if (screen.image?.base64) { image.src = `data:${screen.image.mime};base64,${screen.image.base64}`; image.classList.remove("hidden"); } else { image.removeAttribute("src"); image.classList.add("hidden"); }
  $("progress").innerHTML = state.screens.map((_, index) => `<span class="${index === state.index ? "current" : ""}"></span>`).join("");
}
