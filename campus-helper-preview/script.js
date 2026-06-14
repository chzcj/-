const viewLabels = {
  hall: "大厅",
  publish: "发布",
  detail: "详情",
  chat: "私聊",
  profile: "我的",
};

const toolbarButtons = Array.from(document.querySelectorAll("[data-view]"));
const jumpButtons = Array.from(document.querySelectorAll("[data-jump]"));
const screens = Array.from(document.querySelectorAll("[data-screen]"));
const currentViewLabel = document.getElementById("current-view-label");

function switchView(view) {
  toolbarButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });

  screens.forEach((screen) => {
    screen.classList.toggle("active", screen.dataset.screen === view);
  });

  if (currentViewLabel) {
    currentViewLabel.textContent = viewLabels[view] || "大厅";
  }
}

toolbarButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const { view } = button.dataset;

    if (!view) {
      return;
    }

    switchView(view);
  });
});

jumpButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const { jump } = button.dataset;

    if (!jump) {
      return;
    }

    switchView(jump);
  });
});
