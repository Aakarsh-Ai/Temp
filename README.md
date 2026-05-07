# NutriTrack

NutriTrack is a MyFitnessPal-style full-stack nutrition tracker. Users can register, sign in, save body details, choose bulking/cutting/maintenance goals, log meals, view calorie and macro totals, save medical conditions, receive food recommendations, and activate subscription plans.

## Tech Stack

- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Node.js, Express
- Database: MySQL
- Auth: bcrypt password hashing and JWT sessions

## MySQL Tables

The project uses 10 MySQL tables, which satisfies the minimum 7 table requirement:

1. `users`
2. `user_profiles`
3. `goals`
4. `medical_conditions`
5. `user_medical_conditions`
6. `foods`
7. `meal_entries`
8. `subscription_plans`
9. `subscriptions`
10. `water_logs`

## Setup

1. Install dependencies:

```bash
npm.cmd install
```

2. Create a `.env` file from `.env.example` and set your MySQL password:

```bash
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=nutritrack
JWT_SECRET=replace_this_with_a_long_random_secret
```

3. Create and seed the database:

```bash
mysql -u root -p < database/schema.sql
```

4. Start the server:

```bash
npm.cmd start
```

5. Open:

```text
http://localhost:3000
```

## Demo Login

Click `Use demo account` on the login page. The app creates a demo user and starter profile in MySQL automatically.

## Main Features

- User registration and login
- Body profile with age, gender, height, weight, and activity level
- Goal selection: bulking, cutting, or maintenance
- Automatic calorie, protein, carb, and fat target calculation
- Breakfast, lunch, dinner, and snack logging
- Daily nutrition dashboard
- Medical condition storage for diabetes, blood pressure, heart condition, cholesterol, and thyroid concerns
- Medical-aware food recommendations
- Subscription plan selection
