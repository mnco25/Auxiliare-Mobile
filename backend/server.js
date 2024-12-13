const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcrypt");
const db = require("./db"); // Import the database connection
const jwt = require("jsonwebtoken"); // Add JWT package
const secretKey = "your_secret_key"; // Replace with a secure key

const app = express();
const port = 8081;

app.use(
  cors({
    origin: "*", // Temporarily allow all origins
    credentials: true,
  })
);
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send("API is running...");
});

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  console.log("Auth Header:", authHeader);
  console.log("Token:", token);

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Access token missing" });
  }

  jwt.verify(token, secretKey, (err, user) => {
    if (err) {
      console.error("Token verification error:", err);
      return res.status(403).json({ success: false, message: "Invalid token" });
    }
    console.log("Decoded user from token:", user);
    req.user = user;
    next();
  });
}

app.post("/register", async (req, res) => {
  const { username, email, password, first_name, last_name, user_type } =
    req.body;

  // Log the received data
  console.log("Received registration data:", {
    username,
    email,
    first_name,
    last_name,
    user_type,
  });

  // Basic validation
  if (
    !username ||
    !email ||
    !password ||
    !first_name ||
    !last_name ||
    !user_type
  ) {
    console.log("Validation failed:", {
      username,
      email,
      first_name,
      last_name,
      user_type,
    });
    return res.status(400).json({
      success: false,
      message: "All fields are required",
    });
  }

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    const account_status = "active"; // Default account status
    const created_at = new Date();
    const updated_at = new Date();

    const sql =
      "INSERT INTO users (username, email, password, first_name, last_name, user_type, account_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";

    // Log the SQL query
    console.log("Executing SQL:", sql);

    db.query(
      sql,
      [
        username,
        email,
        hashedPassword,
        first_name,
        last_name,
        user_type,
        account_status,
        created_at,
        updated_at,
      ],
      (err, result) => {
        if (err) {
          console.error("Detailed Database error:", {
            code: err.code,
            errno: err.errno,
            sqlMessage: err.sqlMessage,
            sqlState: err.sqlState,
          });

          if (err.code === "ER_DUP_ENTRY") {
            return res.status(400).json({
              success: false,
              message: "Username or email already exists",
            });
          }
          return res.status(500).json({
            success: false,
            message: "Database error occurred: " + err.sqlMessage,
          });
        }
        console.log("Registration successful:", result);
        res.status(200).json({
          success: true,
          message: "User registered successfully",
        });
      }
    );
  } catch (error) {
    console.error("Error hashing password:", error);
    res.status(500).json({
      success: false,
      message: "Server error occurred while hashing password",
    });
  }
});

app.post("/login", async (req, res) => {
  console.log("Received login request:", req.body);

  const { identifier, password } = req.body;

  // Log the extracted fields
  console.log("Identifier:", identifier);
  console.log("Password:", password);

  // Detailed validation logging
  if (!identifier || !password) {
    console.log("Missing fields:", {
      hasIdentifier: !!identifier,
      hasPassword: !!password,
    });
    return res.status(400).json({
      success: false,
      message: "Email/Username and password are required",
    });
  }

  try {
    const sql = "SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1";
    console.log("Executing query with identifier:", identifier);

    db.query(sql, [identifier, identifier], async (err, results) => {
      if (err) {
        console.error("Login query error:", err);
        return res.status(500).json({
          success: false,
          message: "Database error occurred",
        });
      }

      if (results.length === 0) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      const user = results[0];
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      const userPayload = {
        id: user.user_id,
        username: user.username,
        user_type: user.user_type,
      };
      const accessToken = jwt.sign(userPayload, secretKey, { expiresIn: "1h" }); // Generate token

      res.status(200).json({
        success: true,
        message: "Login successful",
        userType: user.user_type,
        userData: userPayload,
        token: accessToken, // Send token to client
      });
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error occurred",
    });
  }
});

app.post("/create-project", authenticateToken, async (req, res) => {
  console.log("User from token:", req.user);
  const user_id = req.user.id;

  if (!user_id) {
    console.error("User ID missing in token payload");
    return res.status(400).json({
      success: false,
      message: "User ID not found in token",
    });
  }

  const { title, description, funding_goal, category, start_date, end_date } =
    req.body;

  // Log the received data
  console.log("Received project data:", {
    user_id,
    title,
    description,
    funding_goal,
    category,
    start_date,
    end_date,
  });

  // Basic validation
  if (
    !title ||
    !description ||
    !funding_goal ||
    !category ||
    !start_date ||
    !end_date
  ) {
    console.log("Validation failed:", {
      title,
      description,
      funding_goal,
      category,
      start_date,
      end_date,
    });
    return res.status(400).json({
      success: false,
      message: "All fields are required",
    });
  }

  try {
    const sql =
      "INSERT INTO projects (user_id, title, description, funding_goal, category, start_date, end_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
    const created_at = new Date();
    const updated_at = new Date();

    // Log the SQL query
    console.log("Executing SQL:", sql);

    db.query(
      sql,
      [
        user_id,
        title,
        description,
        funding_goal,
        category,
        start_date,
        end_date,
        created_at,
        updated_at,
      ],
      (err, result) => {
        if (err) {
          console.error("Detailed Database error:", {
            code: err.code,
            errno: err.errno,
            sqlMessage: err.sqlMessage,
            sqlState: err.sqlState,
          });
          return res.status(500).json({
            success: false,
            message: "Database error occurred: " + err.sqlMessage,
          });
        }
        console.log("Project creation successful:", result);
        res.status(200).json({
          success: true,
          message: "Project created successfully",
        });
      }
    );
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({
      success: false,
      message: "Server error occurred while creating project",
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Something broke on the server!",
  });
});

// Update the listen call at the bottom of the file
app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
  console.log(`Server accessible at http://192.168.1.46:${port}`);
  console.log(
    `For mobile devices, use your computer's IP address: http://192.168.1.46:${port}`
  );
});