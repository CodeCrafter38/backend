import express from "express";
import passport from "passport";
import session from "express-session";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import expressMySQLSession from "express-mysql-session";
import path from "path";

import initializePassport from "./strategies/local-strategy.js";
import authRoutes from "./routes/auth.js";
import postRoutes from "./routes/posts.js";
import userRoutes from "./routes/users.js";
import groupRoutes from "./routes/groups.js";
import commentRoutes from "./routes/comments.js";
import fileRoutes from "./routes/files.js";

dotenv.config();

// az env fájlban tárolt SESSION_SECRET változó értéke, a munkamenetek titkosításához
const cookieSecret = process.env.SESSION_SECRET;

const options = {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
};

// session store beállítása, a beállított adatbázisban tárolja a munkameneteket, amikor a backend service elindul
const MySQLStore = expressMySQLSession(session);
const sessionStore = new MySQLStore(options);

const app = express();
const __dirname = path.resolve();

// session middleware használata
app.use(
  session({
    secret: cookieSecret,
    saveUninitialized: false, // ne mentsük el a szükségtelen munkameneteket a session store-ba (pl. amikor a felhasználó csak bejelentkezik és nem csinál semmit)
    resave: false, // Ne engedjük a session újra elmentését a session store-ba, még akkor sem, ha a session nem módosult a kérés során
    cookie: {
      maxAge: 60000 * 60, // 1 óra (miliszekumndumban)
    },
    store: sessionStore, // a bekonfigolt session store-t használjuk a cookie-k tárolására, még akkor is, ha a backend leáll (nem működik még)
  })
);

sessionStore
  .onReady()
  .then(() => {
    // MySQL session store készen áll
    console.log("A MySQL session store készen áll");
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

// Passport inicializálása
app.use(passport.initialize());
app.use(passport.session());

// Route-ok inicializálása
app.use("/api", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/users", userRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/files", fileRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Ismeretlen hiba történt a backenden!");
});

app.listen(process.env.EXPRESS_PORT, () => {
  console.log(`A szerver fut a következő porton: ${process.env.EXPRESS_PORT}`);
});
