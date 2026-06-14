const state = {
  user: null,
  orders: [],
  selectedOrderId: null,
};

const jumpButtons = Array.from(document.querySelectorAll("[data-jump]"));
const navButtons = Array.from(document.querySelectorAll(".bottom-nav .nav-item"));
const screens = Array.from(document.querySelectorAll("[data-screen]"));
const appMessage = document.getElementById("app-message");
const orderList = document.getElementById("order-list");
const totalOrders = document.getElementById("total-orders");
const mineOrders = document.getElementById("mine-orders");
const mineNickname = document.getElementById("mine-nickname");
const mineAvatar = document.getElementById("mine-avatar");
const mineSummary = document.getElementById("mine-summary");
const publishForm = document.getElementById("publish-form");
const publishSubmit = document.getElementById("publish-submit");
const fillDemoButton = document.getElementById("fill-demo");
const logoutButton = document.getElementById("logout-button");
const detailType = document.getElementById("detail-type");
const detailBuilding = document.getElementById("detail-building");
const detailPrice = document.getElementById("detail-price");
const detailTitle = document.getElementById("detail-title");
const detailDescription = document.getElementById("detail-description");
const detailOwner = document.getElementById("detail-owner");
const detailStatus = document.getElementById("detail-status");
const chatTitle = document.getElementById("chat-title");
const chatNotice = document.getElementById("chat-notice");

function setMessage(message, isError) {
  if (!appMessage) return;
  appMessage.textContent = message || "";
  appMessage.classList.toggle("error-text", !!isError);
}

function switchView(view) {
  screens.forEach(function (screen) {
    screen.classList.toggle("active", screen.dataset.screen === view);
  });

  navButtons.forEach(function (button) {
    button.classList.toggle("active", button.dataset.jump === view);
  });
}

function formatPrice(price) {
  return "\u00A5" + Number(price || 0).toFixed(2);
}

function getSelectedOrder() {
  return state.orders.find(function (order) { return order.id === state.selectedOrderId; }) || state.orders[0] || null;
}

function updateSwitchLabel(wrapper, checked) {
  if (!wrapper) return;
  wrapper.classList.toggle("active", checked);
}

function bindSwitches() {
  Array.from(document.querySelectorAll(".switch input")).forEach(function (input) {
    updateSwitchLabel(input.parentElement, input.checked);
    input.addEventListener("change", function () {
      updateSwitchLabel(input.parentElement, input.checked);
    });
  });
}

function renderDetail(order) {
  if (!order) return;
  if (detailType) detailType.textContent = order.type;
  if (detailBuilding) detailBuilding.textContent = order.building;
  if (detailPrice) detailPrice.textContent = formatPrice(order.price);
  if (detailTitle) detailTitle.textContent = order.title;
  if (detailDescription) detailDescription.textContent = order.description;
  if (detailOwner) detailOwner.textContent = "\u53D1\u5E03\u8005\uFF1A" + order.creator;
  if (detailStatus) detailStatus.textContent = (order.isAnonymous ? "\u533F\u540D\u00B7" : "") + (order.status === "open" ? "\u5F85\u63A5\u5355" : "\u5DF2\u9501\u5B9A");
  if (chatTitle) chatTitle.textContent = order.type;
  if (chatNotice) chatNotice.textContent = "\u300C" + order.title + "\u300D\uFF0C\u540E\u7EED\u4F1A\u5728\u8FD9\u91CC\u63A5\u5165\u771F\u5B9E\u804A\u5929\u548C\u7559\u8BC1\u3002";
}

function createMetaTag(label) {
  var span = document.createElement("span");
  span.textContent = label;
  return span;
}

function createOrderCard(order) {
  var card = document.createElement("article");
  card.className = "order-card";
  if (order.status === "open") {
    if (order.mine) card.classList.add("featured");
  } else {
    card.classList.add("dimmed");
  }

  var top = document.createElement("div");
  top.className = "card-top";
  var type = document.createElement("span");
  type.className = "order-type";
  type.textContent = order.type;
  var price = document.createElement("span");
  price.className = order.status === "open" ? "price" : "locked";
  price.textContent = order.status === "open" ? formatPrice(order.price) : "\u5DF2\u88AB\u62A2";
  top.append(type, price);

  var title = document.createElement("h4");
  title.textContent = order.title;
  var description = document.createElement("p");
  description.textContent = order.description;

  var meta = document.createElement("div");
  meta.className = "meta-row";
  meta.append(
    createMetaTag(order.sameBuilding ? "\u540C\u697C\u4F18\u5148" : "\u8DE8\u697C\u53EF\u63A5"),
    createMetaTag(order.isAnonymous ? "\u533F\u540D" : "\u975E\u533F\u540D"),
    createMetaTag(order.mine ? "\u6211\u53D1\u5E03\u7684" : "\u53D1\u5E03\u8005 " + order.creator)
  );

  var actions = document.createElement("div");
  actions.className = "card-actions";

  var detailButton = document.createElement("button");
  detailButton.className = "secondary-button";
  detailButton.textContent = "\u67E5\u770B\u8BE6\u60C5";
  detailButton.addEventListener("click", function () {
    state.selectedOrderId = order.id;
    renderDetail(order);
    switchView("detail");
  });

  var chatButton = document.createElement("button");
  chatButton.className = "primary-button";
  chatButton.textContent = order.status === "open" ? "\u7ACB\u5373\u62A2\u5355" : "\u67E5\u770B\u4F1A\u8BDD";
  chatButton.addEventListener("click", function () {
    state.selectedOrderId = order.id;
    renderDetail(order);
    switchView(order.status === "open" ? "detail" : "chat");
  });

  actions.append(detailButton, chatButton);
  card.append(top, title, description, meta, actions);
  return card;
}

function renderOrders() {
  if (!orderList) return;
  orderList.innerHTML = "";

  if (!state.orders.length) {
    var empty = document.createElement("article");
    empty.className = "order-card";
    empty.innerHTML = "<h4>\u6682\u65E0\u8BA2\u5355</h4><p>\u4F60\u53EF\u4EE5\u5148\u53BB\u53D1\u5E03\u9875\u521B\u5EFA\u7B2C\u4E00\u6761\u8BD5\u7528\u8BA2\u5355\u3002</p>";
    orderList.append(empty);
    return;
  }

  state.orders.forEach(function (order) {
    orderList.append(createOrderCard(order));
  });

  var mineCount = state.orders.filter(function (order) { return order.mine; }).length;
  if (totalOrders) totalOrders.textContent = String(state.orders.length);
  if (mineOrders) mineOrders.textContent = String(mineCount);
  if (mineSummary) mineSummary.textContent = "\u4F60\u5F53\u524D\u5171\u53D1\u5E03 " + mineCount + " \u6761\u8BA2\u5355\uFF0C\u5927\u5385\u603B\u5171 " + state.orders.length + " \u6761\u3002";

  var selected = getSelectedOrder();
  if (selected) {
    state.selectedOrderId = selected.id;
    renderDetail(selected);
  }
}

function requestJson(url, options) {
  return fetch(url, options).then(function (response) {
    return response.json().then(function (data) {
      if (!response.ok) throw new Error(data.error || "\u8BF7\u6C42\u5931\u8D25");
      return data;
    });
  });
}

function loadCurrentUser() {
  return requestJson("/api/auth/me").then(function (data) {
    state.user = data.user;
    if (mineNickname) mineNickname.textContent = data.user.nickname;
    if (mineAvatar) mineAvatar.textContent = data.user.nickname.slice(0, 2);
  });
}

function loadOrders() {
  setMessage("\u6B63\u5728\u540C\u6B65\u8BA2\u5355\u5217\u8868...");
  return requestJson("/api/orders").then(function (data) {
    state.orders = data.orders;
    renderOrders();
    setMessage("\u8BA2\u5355\u540C\u6B65\u5B8C\u6210\uFF0C\u5171 " + data.orders.length + " \u6761\u3002");
  });
}

function bindNavigation() {
  jumpButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      var jump = button.dataset.jump;
      if (!jump) return;
      if (jump === "hall") loadOrders().then(function () { switchView(jump); });
      else switchView(jump);
    });
  });
}

function bindPublishForm() {
  if (!fillDemoButton || !publishForm || !publishSubmit) return;

  fillDemoButton.addEventListener("click", function () {
    document.getElementById("publish-title").value = "\u5317 7 \u697C\u5FEB\u9012\u67DC\u53D6\u4EF6\u9001\u5230 431";
    document.getElementById("publish-building").value = "\u5317\u533A 7 \u53F7\u697C";
    document.getElementById("publish-description").value = "\u5305\u88F9\u4E0D\u5927\uFF0C\u62FF\u51FA\u67DC\u5B50\u540E\u62CD\u4E00\u5F20\u7167\u7247\uFF0C\u5230\u5BDD\u5BA4\u95E8\u53E3\u518D\u62CD\u4E00\u5F20\uFF0C\u6211\u6536\u5230\u540E\u4E5F\u4F1A\u8865\u62CD\u786E\u8BA4\u3002";
    document.getElementById("publish-price").value = "6";
  });

  publishForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var formData = new FormData(publishForm);
    publishSubmit.disabled = true;
    publishSubmit.textContent = "\u53D1\u5E03\u4E2D...";
    setMessage("\u6B63\u5728\u63D0\u4EA4\u8BA2\u5355...");

    requestJson("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: formData.get("type"),
        title: formData.get("title"),
        building: formData.get("building"),
        description: formData.get("description"),
        price: formData.get("price"),
        isAnonymous: document.getElementById("publish-anonymous").checked,
        sameBuilding: document.getElementById("publish-same-building").checked,
      }),
    }).then(function () {
      publishForm.reset();
      bindSwitches();
      return loadOrders();
    }).then(function () {
      switchView("hall");
      setMessage("\u8BA2\u5355\u53D1\u5E03\u6210\u529F\uFF0C\u5DF2\u56DE\u5230\u5927\u5385\u3002");
    }).catch(function (error) {
      setMessage(error.message, true);
    }).finally(function () {
      publishSubmit.disabled = false;
      publishSubmit.textContent = "\u786E\u8BA4\u53D1\u5E03";
    });
  });
}

function bindLogout() {
  if (!logoutButton) return;
  logoutButton.addEventListener("click", function () {
    logoutButton.disabled = true;
    logoutButton.textContent = "\u9000\u51FA\u4E2D...";
    requestJson("/api/auth/logout", { method: "POST" }).then(function () {
      window.location.href = "/login";
    }).catch(function (error) {
      setMessage(error.message, true);
      logoutButton.disabled = false;
      logoutButton.textContent = "\u9000\u51FA\u767B\u5F55";
    });
  });
}

function bootstrap() {
  bindNavigation();
  bindPublishForm();
  bindLogout();
  bindSwitches();

  loadCurrentUser().then(function () {
    return loadOrders();
  }).catch(function (error) {
    setMessage(error.message, true);
    if (error.message === "\u672A\u767B\u5F55") {
      window.location.href = "/login";
    }
  });
}

bootstrap();
