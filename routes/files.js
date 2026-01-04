import express from "express";
import path from "path";
import fs from "fs";

const router = express.Router();
const __dirname = path.resolve();
const __dirname2 = path.resolve();
const uploadsPath = path.join(__dirname, "uploads");
const profilePicturesPath = path.join(__dirname2, "profilePictures");

router.get("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ msg: "Sikertelen azonosítás!" });
  }

  const filename = req.query.filename;
  if (!filename || typeof filename !== "string") {
    return res.status(400).json({ msg: "Érvénytelen fájlnév!" });
  }

  const filePath = path.join(uploadsPath, filename);
  const resolvedPath = path.resolve(filePath); // teljes elérési út

  if (!resolvedPath.startsWith(uploadsPath)) {
    return res.status(403).json({ msg: "Érvénytelen fájlnév!" });
  }

  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ msg: "A fájl nem található!" });
  }

  res.sendFile(resolvedPath);
});

router.get("/profile-picture", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ msg: "Sikertelen azonosítás!" });
  }

  const filename = req.query.filename;
  if (!filename || typeof filename !== "string") {
    return res.status(400).json({ msg: "Érvénytelen fájlnév!" });
  }

  const filePath = path.join(profilePicturesPath, filename);
  const resolvedPath = path.resolve(filePath); // teljes elérési út

  if (!resolvedPath.startsWith(profilePicturesPath)) {
    return res.status(403).json({ msg: "Érvénytelen fájlnév!" });
  }

  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ msg: "A fájl nem található!" });
  }

  res.sendFile(resolvedPath);
});

export default router;
