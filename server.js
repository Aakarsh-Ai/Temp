const path = require("path");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

app.use(cors());
app.use(express.json());

app.get(["/", "/index.htm"], (_req, res) => {
  res.sendFile(path.join(__dirname, "index.htm"));
});

app.get("/dashboard.htm", (_req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.htm"));
});

app.get(["/styles.css", "/script.js"], (req, res) => {
  res.sendFile(path.join(__dirname, req.path));
});

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Login required" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Session expired" });
  }
}

function calculateTargets(profile, goalType) {
  const weight = Number(profile.weightKg);
  const height = Number(profile.heightCm);
  const age = Number(profile.age);
  const genderOffset = profile.gender === "female" ? -161 : 5;
  const bmr = 10 * weight + 6.25 * height - 5 * age + genderOffset;
  const activityFactors = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    athlete: 1.9
  };
  const goalOffsets = {
    cutting: -450,
    maintenance: 0,
    bulking: 350
  };

  const calories = Math.max(1200, Math.round(bmr * activityFactors[profile.activityLevel] + goalOffsets[goalType]));
  const protein = Math.round(weight * (goalType === "bulking" ? 2.0 : 1.7));
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);

  return {
    targetCalories: calories,
    targetProteinG: protein,
    targetCarbsG: carbs,
    targetFatG: fat
  };
}

function buildRecommendations(goal, conditions, foods) {
  const items = [];
  if (goal) {
    if (goal.goal_type === "bulking") {
      items.push({
        level: "good",
        title: "Bulking focus",
        message: "Prioritize calorie-dense whole foods, lean protein, rice, oats, dairy, nuts, and post-workout meals."
      });
    }
    if (goal.goal_type === "cutting") {
      items.push({
        level: "good",
        title: "Cutting focus",
        message: "Choose high-protein, high-fiber meals and keep snacks measured so the calorie deficit stays controlled."
      });
    }
  }

  const names = conditions.map((condition) => condition.name.toLowerCase());
  if (names.includes("diabetes")) {
    items.push({
      level: "warn",
      title: "Diabetes guidance",
      message: "Prefer lower-glycemic carbs and pair carbohydrates with protein or fiber. Limit sugary foods and drinks."
    });
  }
  if (names.includes("high blood pressure")) {
    items.push({
      level: "warn",
      title: "Blood pressure guidance",
      message: "Keep sodium lower by choosing fresh foods, curd, fruits, and home-cooked meals over packaged foods."
    });
  }
  if (names.includes("heart condition")) {
    items.push({
      level: "danger",
      title: "Heart health guidance",
      message: "Favor unsaturated fats, lean proteins, vegetables, and whole grains. Keep saturated fat and fried food limited."
    });
  }

  const suggestedFoods = foods
    .filter((food) => !names.includes("diabetes") || Number(food.sugar_g) <= 8)
    .filter((food) => !names.includes("high blood pressure") || Number(food.sodium_mg) <= 250)
    .slice(0, 4)
    .map((food) => food.name)
    .join(", ");

  if (suggestedFoods) {
    items.push({
      level: "good",
      title: "Good food matches",
      message: `Based on your profile, try adding: ${suggestedFoods}.`
    });
  }

  return items;
}

app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6) {
    return res.status(400).json({ message: "Name, email, and a 6 character password are required" });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
      [name, email.toLowerCase(), passwordHash]
    );
    const user = { id: result.insertId, email };
    res.status(201).json({ token: signToken(user) });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "Email already registered" });
    res.status(500).json({ message: "Registration failed" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [String(email || "").toLowerCase()]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password || "", user.password_hash))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }
  res.json({ token: signToken(user) });
});

app.post("/api/auth/demo", async (_req, res) => {
  const email = "demo@nutritrack.local";
  const passwordHash = await bcrypt.hash("demo123", 10);
  await db.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ('Demo User', ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    [email, passwordHash]
  );
  const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
  const user = rows[0];
  await db.query(
    `INSERT INTO user_profiles (user_id, age, gender, height_cm, weight_kg, activity_level)
     VALUES (?, 22, 'male', 176, 72, 'moderate')
     ON DUPLICATE KEY UPDATE age = VALUES(age)`,
    [user.id]
  );
  const targets = calculateTargets({
    age: 22,
    gender: "male",
    heightCm: 176,
    weightKg: 72,
    activityLevel: "moderate"
  }, "maintenance");
  await db.query(
    `INSERT INTO goals (user_id, goal_type, target_calories, target_protein_g, target_carbs_g, target_fat_g)
     VALUES (?, 'maintenance', ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE target_calories = VALUES(target_calories)`,
    [user.id, targets.targetCalories, targets.targetProteinG, targets.targetCarbsG, targets.targetFatG]
  );
  res.json({ token: signToken(user) });
});

app.get("/api/foods", requireAuth, async (_req, res) => {
  const [rows] = await db.query("SELECT * FROM foods ORDER BY name");
  res.json(rows);
});

app.get("/api/medical-conditions", requireAuth, async (_req, res) => {
  const [rows] = await db.query("SELECT * FROM medical_conditions ORDER BY name");
  res.json(rows);
});

app.get("/api/subscription-plans", requireAuth, async (_req, res) => {
  const [rows] = await db.query("SELECT * FROM subscription_plans ORDER BY price_monthly");
  res.json(rows);
});

app.put("/api/profile", requireAuth, async (req, res) => {
  const { age, gender, heightCm, weightKg, activityLevel, goalType } = req.body;
  if (!age || !heightCm || !weightKg || !goalType) {
    return res.status(400).json({ message: "Complete profile and goal details are required" });
  }

  const targets = calculateTargets({ age, gender, heightCm, weightKg, activityLevel }, goalType);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `INSERT INTO user_profiles (user_id, age, gender, height_cm, weight_kg, activity_level)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE age = VALUES(age), gender = VALUES(gender),
       height_cm = VALUES(height_cm), weight_kg = VALUES(weight_kg), activity_level = VALUES(activity_level)`,
      [req.user.id, age, gender, heightCm, weightKg, activityLevel]
    );
    await connection.query(
      `INSERT INTO goals (user_id, goal_type, target_calories, target_protein_g, target_carbs_g, target_fat_g)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE goal_type = VALUES(goal_type), target_calories = VALUES(target_calories),
       target_protein_g = VALUES(target_protein_g), target_carbs_g = VALUES(target_carbs_g),
       target_fat_g = VALUES(target_fat_g)`,
      [req.user.id, goalType, targets.targetCalories, targets.targetProteinG, targets.targetCarbsG, targets.targetFatG]
    );
    await connection.commit();
    res.json({ message: "Profile saved", targets });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ message: "Could not save profile" });
  } finally {
    connection.release();
  }
});

app.put("/api/medical-profile", requireAuth, async (req, res) => {
  const conditionIds = Array.isArray(req.body.conditionIds) ? req.body.conditionIds : [];
  const notes = req.body.notes || "";
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query("DELETE FROM user_medical_conditions WHERE user_id = ?", [req.user.id]);
    for (const conditionId of conditionIds) {
      await connection.query(
        "INSERT INTO user_medical_conditions (user_id, condition_id, notes) VALUES (?, ?, ?)",
        [req.user.id, conditionId, notes]
      );
    }
    await connection.commit();
    res.json({ message: "Medical profile saved" });
  } catch {
    await connection.rollback();
    res.status(500).json({ message: "Could not save medical profile" });
  } finally {
    connection.release();
  }
});

app.post("/api/meal-entries", requireAuth, async (req, res) => {
  const { foodId, mealType, servings, entryDate } = req.body;
  if (!foodId || !mealType || !servings) return res.status(400).json({ message: "Food, meal, and servings are required" });
  const [result] = await db.query(
    "INSERT INTO meal_entries (user_id, food_id, meal_type, servings, entry_date) VALUES (?, ?, ?, ?, ?)",
    [req.user.id, foodId, mealType, servings, entryDate || new Date()]
  );
  res.status(201).json({ id: result.insertId });
});

app.delete("/api/meal-entries/:id", requireAuth, async (req, res) => {
  await db.query("DELETE FROM meal_entries WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
  res.json({ message: "Meal entry removed" });
});

app.post("/api/subscriptions", requireAuth, async (req, res) => {
  const { planId } = req.body;
  await db.query("UPDATE subscriptions SET status = 'cancelled' WHERE user_id = ? AND status = 'active'", [req.user.id]);
  await db.query(
    `INSERT INTO subscriptions (user_id, plan_id, status, start_date, renewal_date)
     VALUES (?, ?, 'active', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 MONTH))`,
    [req.user.id, planId]
  );
  res.status(201).json({ message: "Subscription activated" });
});

app.get("/api/dashboard", requireAuth, async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const [[userRows], [profileRows], [goalRows], [entryRows], [conditionRows], [foodRows], [subscriptionRows]] = await Promise.all([
    db.query("SELECT id, name, email FROM users WHERE id = ?", [req.user.id]),
    db.query("SELECT * FROM user_profiles WHERE user_id = ?", [req.user.id]),
    db.query("SELECT * FROM goals WHERE user_id = ?", [req.user.id]),
    db.query(
      `SELECT me.id, me.meal_type, me.servings, f.name AS food_name,
       f.calories * me.servings AS calories,
       f.protein_g * me.servings AS protein_g,
       f.carbs_g * me.servings AS carbs_g,
       f.fat_g * me.servings AS fat_g
       FROM meal_entries me
       JOIN foods f ON f.id = me.food_id
       WHERE me.user_id = ? AND me.entry_date = ?
       ORDER BY FIELD(me.meal_type, 'breakfast', 'lunch', 'dinner', 'snack'), me.created_at`,
      [req.user.id, date]
    ),
    db.query(
      `SELECT umc.condition_id, umc.notes, mc.name, mc.guidance
       FROM user_medical_conditions umc
       JOIN medical_conditions mc ON mc.id = umc.condition_id
       WHERE umc.user_id = ?`,
      [req.user.id]
    ),
    db.query("SELECT * FROM foods ORDER BY calories DESC"),
    db.query(
      `SELECT s.*, sp.name AS plan_name
       FROM subscriptions s
       JOIN subscription_plans sp ON sp.id = s.plan_id
       WHERE s.user_id = ? AND s.status = 'active'
       ORDER BY s.created_at DESC LIMIT 1`,
      [req.user.id]
    )
  ]);

  const totals = entryRows.reduce((sum, row) => ({
    calories: sum.calories + Number(row.calories),
    protein_g: sum.protein_g + Number(row.protein_g),
    carbs_g: sum.carbs_g + Number(row.carbs_g),
    fat_g: sum.fat_g + Number(row.fat_g)
  }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });

  res.json({
    user: userRows[0],
    profile: profileRows[0] || null,
    goal: goalRows[0] || null,
    entries: entryRows,
    totals,
    userConditions: conditionRows,
    subscription: subscriptionRows[0] || null,
    recommendations: buildRecommendations(goalRows[0], conditionRows, foodRows)
  });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.htm"));
});

app.listen(PORT, () => {
  console.log(`NutriTrack running at http://localhost:${PORT}`);
});
