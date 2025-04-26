import express from "express";
import passport from "passport";
import session from "express-session";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";

import initializePassport from "./strategies/local-strategy.js";
import authRoutes from "./routes/auth.js";
import postRoutes from "./routes/posts.js";

dotenv.config();
const PORT = process.env.EXPRESS_PORT;
const cookieSecret = process.env.COOKIE_SECRET;

const app = express();

// Use session middleware
app.use(
  session({
    secret: cookieSecret,
    saveUninitialized: false, // do not save unnecessary sessions in session store (e.g. when user just signs in and does nothing)
    resave: false, // disable to force the session saved back to the session store, even if the session was never modified during the request
    cookie: {
      maxAge: 60000 * 60, // 1 hour (in milliseconds)
    },
  })
);

app.use(express.json());
app.use(bodyParser.json());
app.use(cookieParser(cookieSecret));

initializePassport(passport);
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

app.use("/api", authRoutes);
app.use("/api/posts", postRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

app.post("/logout", ensureLogin, (req, res) => {
  if (req.user) {
    req.logOut();
    res.json({ message: "Logged out succesfully" });
  } else {
    res.json({ message: "No user to logout" });
  }
});

function ensureLogin(req, res, next) {
  if (!req.isAuthenticated()) {
    res.status(401).send({ message: "You cannot access this page" });
    res.redirect("/login");
  }
  next();
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
