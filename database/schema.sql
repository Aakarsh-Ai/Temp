CREATE DATABASE IF NOT EXISTS nutritrack;
USE nutritrack;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  age INT NOT NULL,
  gender ENUM('male', 'female', 'other') NOT NULL,
  height_cm DECIMAL(5,2) NOT NULL,
  weight_kg DECIMAL(5,2) NOT NULL,
  activity_level ENUM('sedentary', 'light', 'moderate', 'active', 'athlete') NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS goals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  goal_type ENUM('bulking', 'cutting', 'maintenance') NOT NULL,
  target_calories INT NOT NULL,
  target_protein_g INT NOT NULL,
  target_carbs_g INT NOT NULL,
  target_fat_g INT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS medical_conditions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  guidance TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_medical_conditions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  condition_id INT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_condition (user_id, condition_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (condition_id) REFERENCES medical_conditions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS foods (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(140) NOT NULL UNIQUE,
  serving_label VARCHAR(80) NOT NULL,
  calories DECIMAL(8,2) NOT NULL,
  protein_g DECIMAL(8,2) NOT NULL,
  carbs_g DECIMAL(8,2) NOT NULL,
  fat_g DECIMAL(8,2) NOT NULL,
  fiber_g DECIMAL(8,2) DEFAULT 0,
  sugar_g DECIMAL(8,2) DEFAULT 0,
  sodium_mg DECIMAL(8,2) DEFAULT 0,
  category VARCHAR(80) NOT NULL
);

CREATE TABLE IF NOT EXISTS meal_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  food_id INT NOT NULL,
  meal_type ENUM('breakfast', 'lunch', 'dinner', 'snack') NOT NULL,
  servings DECIMAL(6,2) NOT NULL DEFAULT 1,
  entry_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE CASCADE,
  INDEX idx_meal_user_date (user_id, entry_date)
);

CREATE TABLE IF NOT EXISTS subscription_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  price_monthly DECIMAL(8,2) NOT NULL,
  description TEXT NOT NULL,
  features TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  plan_id INT NOT NULL,
  status ENUM('active', 'cancelled', 'expired') NOT NULL DEFAULT 'active',
  start_date DATE NOT NULL,
  renewal_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
);

CREATE TABLE IF NOT EXISTS water_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  log_date DATE NOT NULL,
  glasses INT NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_water_day (user_id, log_date)
);

INSERT INTO medical_conditions (name, guidance) VALUES
  ('Diabetes', 'Control added sugar, prefer high-fiber carbohydrates, and pair carbs with protein.'),
  ('High Blood Pressure', 'Reduce sodium-heavy packaged food and choose potassium-rich whole foods.'),
  ('Heart Condition', 'Prefer unsaturated fats, lean proteins, vegetables, and whole grains.'),
  ('High Cholesterol', 'Limit saturated fat and increase soluble fiber from oats, beans, fruits, and vegetables.'),
  ('Thyroid Disorder', 'Keep meals consistent and follow doctor guidance for medication timing.')
ON DUPLICATE KEY UPDATE guidance = VALUES(guidance);

INSERT INTO foods
  (name, serving_label, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, category)
VALUES
  ('Oats with milk', '1 bowl', 310, 14, 48, 8, 7, 9, 110, 'Breakfast'),
  ('Boiled eggs', '2 eggs', 156, 12, 1, 11, 0, 1, 124, 'Protein'),
  ('Grilled chicken breast', '100 g', 165, 31, 0, 4, 0, 0, 74, 'Protein'),
  ('Paneer bhurji', '1 cup', 330, 20, 10, 23, 2, 4, 390, 'Protein'),
  ('Brown rice', '1 cup cooked', 216, 5, 45, 2, 4, 1, 10, 'Carb'),
  ('Dal tadka', '1 cup', 220, 13, 30, 6, 8, 3, 280, 'Indian'),
  ('Chapati', '1 medium', 105, 3, 18, 3, 3, 1, 120, 'Indian'),
  ('Mixed vegetable salad', '1 bowl', 90, 4, 16, 2, 6, 7, 60, 'Vegetable'),
  ('Greek yogurt', '1 cup', 140, 20, 8, 3, 0, 6, 65, 'Snack'),
  ('Banana', '1 medium', 105, 1, 27, 0, 3, 14, 1, 'Fruit'),
  ('Apple', '1 medium', 95, 0, 25, 0, 4, 19, 2, 'Fruit'),
  ('Almonds', '28 g', 164, 6, 6, 14, 4, 1, 1, 'Snack'),
  ('Salmon', '100 g', 208, 20, 0, 13, 0, 0, 59, 'Protein'),
  ('Sprouts chaat', '1 bowl', 180, 12, 30, 2, 8, 5, 180, 'Snack'),
  ('Vegetable poha', '1 plate', 250, 6, 46, 6, 4, 3, 310, 'Breakfast')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO subscription_plans (name, price_monthly, description, features) VALUES
  ('Free', 0, 'Basic food logging and daily calorie summaries.', 'Meal log,Calorie summary,Profile goals'),
  ('Plus', 199, 'Advanced macro insights and medical food guidance.', 'Macro targets,Medical recommendations,Weekly review'),
  ('Pro', 399, 'Full plan for serious nutrition tracking.', 'Everything in Plus,Priority support,Export reports,Premium analytics')
ON DUPLICATE KEY UPDATE
  price_monthly = VALUES(price_monthly),
  description = VALUES(description),
  features = VALUES(features);
