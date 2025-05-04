import express from "express";
import passport from "passport";
import session from "express-session";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import expressMySQLSession from "express-mysql-session";
import { v4 as uuidv4 } from "uuid";

import initializePassport from "./strategies/local-strategy.js";
import authRoutes from "./routes/auth.js";
import postRoutes from "./routes/posts.js";
import userRoutes from "./routes/users.js";
import groupRoutes from "./routes/groups.js";
import commentRoutes from "./routes/comments.js";

dotenv.config();

//generate random id for cookies
const cookieSecret = uuidv4();

const options = {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
};

// configure session store, it stores the sessions in the configured database when service is started
const MySQLStore = expressMySQLSession(session);
const sessionStore = new MySQLStore(options);

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
    store: sessionStore, // use configured session store to store cookies even if backend is down
  })
);

sessionStore
  .onReady()
  .then(() => {
    // MySQL session store is ready for use
    console.log("MySQL session store is ready");
  })
  .catch((e) => {
    console.error(e);
  });

app.use(express.json());
app.use(bodyParser.json());
app.use(cookieParser(cookieSecret));

initializePassport(passport);
app.use(
  cors({
    origin: `http://localhost:${process.env.FRONTEND_PORT}`,
    credentials: true,
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

app.use("/api", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/users", userRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/comments", commentRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

// app.post("/logout", ensureLogin, (req, res) => {
//   if (req.user) {
//     req.logOut();
//     res.json({ message: "Logged out succesfully" });
//   } else {
//     res.json({ message: "No user to logout" });
//   }
// });

function ensureLogin(req, res, next) {
  if (!req.isAuthenticated()) {
    res.status(401).send({ message: "You cannot access this page" });
    res.redirect("/login");
  }
  next();
}

app.listen(process.env.EXPRESS_PORT, () => {
  console.log(`Server is running on port ${process.env.EXPRESS_PORT}`);
});
