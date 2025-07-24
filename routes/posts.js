import express from "express";
import { findUserByName, addPost, getPostsWithComments } from "../helpers.js";
import multer from "multer";
import path from "path";

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
const upload = multer({ storage: storage });

router.get("/", async (req, res) => {
  // console.log("Session a posts-ban:\n", req.session);
  // console.log("Session id a posts-ban:\n", req.session.id);
  if (req.isAuthenticated()) {
    const { username } = req.query;
    const posts = await getPostsWithComments(username);
    res.json(posts);
  } else {
    return res.status(401).send({ msg: "Sikertelen azonosítás!" });
  }
});

router.post("/", upload.array("files"), async (req, res) => {
  if (req.isAuthenticated()) {
    const {
      title,
      content,
      labels,
      userName,
      isPublic,
      selectedGroupIds,
      videoLink,
    } = req.body;

    const uploadedFiles = req.files;
    const fileInfos = (uploadedFiles || [])
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
      await addPost(
        title,
        content,
        isPublic === "true",
        labels,
        userId,
        groupIds,
        fileInfos.length ? fileInfos : null,
        videoLink
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
});

export default router;
