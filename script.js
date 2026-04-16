// ======================= script.js =======================

// Toggle tabs (Sign In / Register)
const tabs = document.querySelectorAll(".tabs button");

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
  });
});

// Demo button action
const demoBtn = document.querySelector(".demo");

if (demoBtn) {
  demoBtn.addEventListener("click", () => {
    alert("Logged in as Demo User!");
  });
}

// Login button (basic frontend only)
const loginBtn = document.querySelector(".login-btn");

if (loginBtn) {
  loginBtn.addEventListener("click", () => {
    const email = document.querySelector("input[type='email']").value;
    const password = document.querySelector("input[type='password']").value;

    if (!email || !password) {
      alert("Please enter email and password");
      return;
    }

    alert("Login successful (frontend demo)");
  });
}