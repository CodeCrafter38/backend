import express from "express";
import { findUserByName, addPost, getPostsWithComments } from "../helpers.js";
import multer from "multer";
import path from "path";
import * as queries from "../database.js";

const ALLOWED_EXTENSIONS = [".doc", ".docx", ".xls", ".xlsx"];
const MAX_TOTAL_SIZE_MB = 100;
const MAX_TOTAL_SIZE_BYTES = MAX_TOTAL_SIZE_MB * 1024 * 1024;

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const __dirname = path.resolve();
    cb(null, path.join(__dirname, "uploads"));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const mimetype = file.mimetype || "";
  const isImage = mimetype.startsWith("image/");

  const ext = path.extname(file.originalname || "").toLowerCase();
  const isAllowedDoc = ALLOWED_EXTENSIONS.includes(ext);

  if (isImage || isAllowedDoc) {
    return cb(null, true);
  }

  return cb(new Error("Nem engedélyezett fájltípus!"), false);
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
});

router.get("/", async (req, res) => {
  if (req.isAuthenticated()) {
    const { username } = req.query;
    const posts = await getPostsWithComments(username);
    res.json(posts);
  } else {
    return res.status(401).send({ msg: "Sikertelen azonosítás!" });
  }
});

router.post(
  "/",
  (req, res, next) => {
    upload.array("files")(req, res, function (err) {
      if (err) {
        if (err.message === "Nem engedélyezett fájltípus!") {
          return res.status(400).json({ msg: err.message });
        }
        return res
          .status(400)
          .json({ msg: "Fájlfeltöltési hiba történt!", error: err.message });
      }
      next();
    });
  },

  async (req, res) => {
    if (req.isAuthenticated()) {
      const {
        title,
        content,
        labels,
        userName,
        isPublic,
        selectedGroupIds,
        videoLink,
        groupType,
      } = req.body;

      const uploadedFiles = req.files || [];

      // Összméret ellenőrzése
      const totalSize = uploadedFiles.reduce(
        (sum, file) => sum + (file.size || 0),
        0
      );

      if (totalSize > MAX_TOTAL_SIZE_BYTES) {
        // a már feltöltött fájlok törlése
        for (const file of uploadedFiles) {
          if (file && file.path) {
            try {
              fs.unlinkSync(file.path);
            } catch (e) {
              console.error("Nem sikerült törölni a fájlt:", file.path, e);
            }
          }
        }

        return res.status(400).json({
          msg: `A csatolt fájlok összmérete meghaladja a megengedett ${MAX_TOTAL_SIZE_MB} MB-ot.`,
        });
      }

      const fileInfos = uploadedFiles
        .filter((file) => file && file.filename)
        .map((file) => ({
          filename: file.filename,
          path: file.path,
          size: file.size,
          mimetype: file.mimetype,
        }));

      let groupIds = [];
      if (Array.isArray(selectedGroupIds)) {
        groupIds = selectedGroupIds.map((id) => parseInt(id));
      } else if (selectedGroupIds) {
        groupIds = [parseInt(selectedGroupIds)];
      }

      const user = await findUserByName(userName);
      const userId = user.id;
      if (userId) {
        const teachersOnly = groupType === "TEACHER_ONLY";
        await addPost(
          title,
          content,
          isPublic === "true",
          labels,
          userId,
          groupIds,
          fileInfos.length ? fileInfos : null,
          videoLink,
          teachersOnly === true ? 1 : 0
        );
        res.json({ msg: "Poszt létrehozás sikeres!" });
      } else {
        return res
          .status(400)
          .json({ msg: "A megadott felhasználó nem létezik!" });
      }
    } else {
      return res.status(401).json({ msg: "Sikertelen azonosítás!" });
    }
  }
);

router.delete("/", async (req, res) => {
  if (req.isAuthenticated()) {
    const { id } = req.query;
    const success = await queries.deletePost(id);
    if (success) {
      res.status(204).send();
    } else {
      res.status(500).send("Adatbázis hiba történt a poszt törlésekor!");
    }
  } else {
    return res.status(401).send({ msg: "Sikertelen azonosítás!" });
  }
});

export default router;
