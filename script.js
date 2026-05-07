const API = "/api";
const state = {
  mode: "login",
  token: localStorage.getItem("nutritrack_token"),
  foods: [],
  conditions: [],
  plans: [],
  dashboard: null
};

const $ = (selector) => document.querySelector(selector);

function setMessage(id, message) {
  const el = $(id);
  if (el) el.textContent = message || "";
}

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const response = await fetch(`${API}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data;
}

function switchMode(mode) {
  state.mode = mode;
  $("#login-tab").classList.toggle("active", mode === "login");
  $("#register-tab").classList.toggle("active", mode === "register");
  $("#name-field").classList.toggle("hidden", mode !== "register");
  $("#auth-submit").textContent = mode === "login" ? "Sign in" : "Create account";
  $("#auth-copy").textContent = mode === "login"
    ? "Sign in to your dashboard."
    : "Create an account to start tracking.";
  setMessage("#auth-message", "");
}

function showDashboard(show) {
  $("#auth-view").classList.toggle("hidden", show);
  $("#dashboard-view").classList.toggle("hidden", !show);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function round(value) {
  return Math.round(Number(value || 0));
}

function macroLine(item) {
  return `${round(item.calories)} kcal | P ${round(item.protein_g)}g | C ${round(item.carbs_g)}g | F ${round(item.fat_g)}g`;
}

async function loadReferenceData() {
  const [foods, conditions, plans] = await Promise.all([
    request("/foods"),
    request("/medical-conditions"),
    request("/subscription-plans")
  ]);
  state.foods = foods;
  state.conditions = conditions;
  state.plans = plans;
  renderFoodOptions();
  renderConditionOptions([]);
  renderPlans();
}

async function loadDashboard() {
  const data = await request(`/dashboard?date=${todayISO()}`);
  state.dashboard = data;
  renderDashboard(data);
}

function renderDashboard(data) {
  $("#user-name").textContent = data.user.name;
  $("#goal-title").textContent = data.goal
    ? `${data.goal.goal_type[0].toUpperCase()}${data.goal.goal_type.slice(1)} target`
    : "Build your plan";
  $("#today-date").textContent = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });

  const totals = data.totals || {};
  const goal = data.goal || {};
  $("#calories-total").textContent = round(totals.calories);
  $("#protein-total").textContent = `${round(totals.protein_g)}g`;
  $("#carbs-total").textContent = `${round(totals.carbs_g)}g`;
  $("#fat-total").textContent = `${round(totals.fat_g)}g`;
  $("#calories-target").textContent = `Target ${round(goal.target_calories)}`;
  $("#protein-target").textContent = `Target ${round(goal.target_protein_g)}g`;
  $("#carbs-target").textContent = `Target ${round(goal.target_carbs_g)}g`;
  $("#fat-target").textContent = `Target ${round(goal.target_fat_g)}g`;

  if (data.profile) {
    $("#age").value = data.profile.age || "";
    $("#gender").value = data.profile.gender || "male";
    $("#height").value = data.profile.height_cm || "";
    $("#weight").value = data.profile.weight_kg || "";
    $("#activity").value = data.profile.activity_level || "moderate";
  }
  if (data.goal) $("#goal").value = data.goal.goal_type || "maintenance";

  renderMeals(data.entries || []);
  renderConditionOptions(data.userConditions || []);
  renderRecommendations(data.recommendations || []);
  renderPlans(data.subscription);
}

function renderFoodOptions() {
  $("#food-select").innerHTML = state.foods.map((food) => (
    `<option value="${food.id}">${food.name} (${food.serving_label}, ${round(food.calories)} kcal)</option>`
  )).join("");
}

function renderMeals(entries) {
  const container = $("#meal-list");
  if (!entries.length) {
    container.innerHTML = `<div class="meal-item"><span>No meals logged today.</span></div>`;
    return;
  }

  container.innerHTML = entries.map((entry) => `
    <div class="meal-item">
      <div>
        <strong>${entry.meal_type}: ${entry.food_name}</strong>
        <small>${entry.servings} serving(s) | ${macroLine(entry)}</small>
      </div>
      <button class="delete-btn" data-entry-id="${entry.id}" type="button">Remove</button>
    </div>
  `).join("");

  container.querySelectorAll("[data-entry-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      await request(`/meal-entries/${button.dataset.entryId}`, { method: "DELETE" });
      await loadDashboard();
    });
  });
}

function renderConditionOptions(selectedRows) {
  const selected = new Map(selectedRows.map((row) => [Number(row.condition_id), row.notes || ""]));
  $("#condition-list").innerHTML = state.conditions.map((condition) => `
    <label class="condition-item">
      <input type="checkbox" value="${condition.id}" ${selected.has(condition.id) ? "checked" : ""}>
      <span><strong>${condition.name}</strong><br>${condition.guidance}</span>
    </label>
  `).join("");
  $("#medical-notes").value = selectedRows[0]?.notes || "";
}

function renderRecommendations(items) {
  const container = $("#recommendations");
  if (!items.length) {
    container.innerHTML = `<div class="recommendation-item good">Save your profile and medical conditions to receive recommendations.</div>`;
    return;
  }
  container.innerHTML = items.map((item) => `
    <div class="recommendation-item ${item.level}">
      <strong>${item.title}</strong>
      <p>${item.message}</p>
    </div>
  `).join("");
}

function renderPlans(subscription = null) {
  const activePlanId = subscription?.plan_id;
  $("#plans-list").innerHTML = state.plans.map((plan) => `
    <article class="plan-card ${activePlanId === plan.id ? "active-plan" : ""}">
      <div>
        <strong>${plan.name}</strong>
        <small>${plan.description}</small>
      </div>
      <div class="price">Rs ${Number(plan.price_monthly).toFixed(0)}/mo</div>
      <button class="primary-btn" data-plan-id="${plan.id}" type="button">
        ${activePlanId === plan.id ? "Current plan" : "Choose plan"}
      </button>
    </article>
  `).join("");

  $("#plans-list").querySelectorAll("[data-plan-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      await request("/subscriptions", {
        method: "POST",
        body: JSON.stringify({ planId: Number(button.dataset.planId) })
      });
      await loadDashboard();
    });
  });
}

async function authenticate(event) {
  event.preventDefault();
  setMessage("#auth-message", "Working...");
  try {
    const payload = {
      email: $("#email").value.trim(),
      password: $("#password").value
    };
    if (state.mode === "register") payload.name = $("#name").value.trim();
    const data = await request(state.mode === "register" ? "/auth/register" : "/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    state.token = data.token;
    localStorage.setItem("nutritrack_token", state.token);
    showDashboard(true);
    await loadReferenceData();
    await loadDashboard();
  } catch (error) {
    setMessage("#auth-message", error.message);
  }
}

async function useDemoAccount() {
  setMessage("#auth-message", "Creating demo session...");
  try {
    const data = await request("/auth/demo", { method: "POST" });
    state.token = data.token;
    localStorage.setItem("nutritrack_token", state.token);
    showDashboard(true);
    await loadReferenceData();
    await loadDashboard();
  } catch (error) {
    setMessage("#auth-message", error.message);
  }
}

async function saveProfile(event) {
  event.preventDefault();
  setMessage("#profile-message", "Saving...");
  try {
    await request("/profile", {
      method: "PUT",
      body: JSON.stringify({
        age: Number($("#age").value),
        gender: $("#gender").value,
        heightCm: Number($("#height").value),
        weightKg: Number($("#weight").value),
        activityLevel: $("#activity").value,
        goalType: $("#goal").value
      })
    });
    setMessage("#profile-message", "Profile and targets saved.");
    await loadDashboard();
  } catch (error) {
    setMessage("#profile-message", error.message);
  }
}

async function addFood(event) {
  event.preventDefault();
  await request("/meal-entries", {
    method: "POST",
    body: JSON.stringify({
      foodId: Number($("#food-select").value),
      mealType: $("#meal-type").value,
      servings: Number($("#servings").value),
      entryDate: todayISO()
    })
  });
  $("#servings").value = "1";
  await loadDashboard();
}

async function saveMedical(event) {
  event.preventDefault();
  setMessage("#medical-message", "Saving...");
  const conditionIds = [...$("#condition-list").querySelectorAll("input:checked")]
    .map((input) => Number(input.value));
  try {
    await request("/medical-profile", {
      method: "PUT",
      body: JSON.stringify({ conditionIds, notes: $("#medical-notes").value.trim() })
    });
    setMessage("#medical-message", "Medical profile saved.");
    await loadDashboard();
  } catch (error) {
    setMessage("#medical-message", error.message);
  }
}

function bindEvents() {
  $("#login-tab").addEventListener("click", () => switchMode("login"));
  $("#register-tab").addEventListener("click", () => switchMode("register"));
  $("#auth-form").addEventListener("submit", authenticate);
  $("#demo-btn").addEventListener("click", useDemoAccount);
  $("#logout-btn").addEventListener("click", () => {
    localStorage.removeItem("nutritrack_token");
    state.token = null;
    showDashboard(false);
  });
  $("#profile-form").addEventListener("submit", saveProfile);
  $("#food-form").addEventListener("submit", addFood);
  $("#medical-form").addEventListener("submit", saveMedical);
}

async function init() {
  bindEvents();
  if (!state.token) return;
  try {
    showDashboard(true);
    await loadReferenceData();
    await loadDashboard();
  } catch {
    localStorage.removeItem("nutritrack_token");
    state.token = null;
    showDashboard(false);
  }
}

init();
