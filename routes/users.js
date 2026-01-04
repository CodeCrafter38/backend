import express from "express";
import { findUserByName, getUsersOfGroup } from "../helpers.js";
import { addProfilePicture } from "../database.js";
import multer from "multer";
import path from "path";

const MAX_TOTAL_SIZE_MB = 100;
const MAX_TOTAL_SIZE_BYTES = MAX_TOTAL_SIZE_MB * 1024 * 1024;

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const __dirname = path.resolve();
    cb(null, path.join(__dirname, "profilePictures"));
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

  if (isImage) {
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
    const username = req.query;
    const user = await findUserByName(username);
    res.json(user);
  } else {
    return res.status(401).send({ msg: "Sikertelen azonosítás!" });
  }
});

router.get("/ofGroup", async (req, res) => {
  if (req.isAuthenticated()) {
    const { groupId } = req.query;
    console.log("groupId az ofGroup endpoint-on: ", groupId);
    const users = await getUsersOfGroup(groupId);
    res.json(users);
  } else {
    return res.status(401).send({ msg: "Sikertelen azonosítás!" });
  }
});

router.post(
  "/upload-profile-picture",
  (req, res, next) => {
    upload.single("file")(req, res, function (err) {
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
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ msg: "Sikertelen azonosítás!" });
      }

      const { userName } = req.body;

      const uploadedFile = req.file || null;

      if (uploadedFile !== null) {
        if (uploadedFile.size > MAX_TOTAL_SIZE_BYTES) {
          // a már feltöltött fájl törlése
          if (uploadedFile.path) {
            try {
              fs.unlinkSync(uploadedFile.path);
            } catch (e) {
              console.error(
                "Nem sikerült törölni a fájlt:",
                uploadedFile.path,
                e
              );
            }
          }

          return res.status(400).json({
            msg: `A csatolt fájl mérete meghaladja a megengedett ${MAX_TOTAL_SIZE_MB} MB-ot.`,
          });
        }
      }

      let fileInfo = null;
      if (uploadedFile !== null) {
        fileInfo = uploadedFile.filename
          ? {
              filename: uploadedFile.filename,
              path: uploadedFile.path,
              size: uploadedFile.size,
              mimetype: uploadedFile.mimetype,
            }
          : null;
      }

      const user = await findUserByName(userName);
      const userId = user.id;
      if (!userId) {
        // ha nincs user, töröljük a már feltöltött fájlt
        if (uploadedFile.path) {
          try {
            fs.unlinkSync(uploadedFile.path);
          } catch (e) {
            console.error(
              "Nem sikerült törölni a fájlt:",
              uploadedFile.path,
              e
            );
          }
        }
        return res
          .status(400)
          .json({ msg: "A megadott felhasználó nem létezik!" });
      }

      await addProfilePicture(userId, fileInfo ?? null);

      return res.json({ msg: "Profilkép feltöltés sikeres!" });
    } catch (e) {
      return res.status(500).json({ msg: "Szerver hiba!", error: e?.message });
    }
  }
);

router.delete("/remove-profile-picture", async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ msg: "Sikertelen azonosítás!" });
    }
    const { userName } = req.body;

    const user = await findUserByName(userName);
    const userId = user.id;
    if (!userId) {
      return res
        .status(400)
        .json({ msg: "A megadott felhasználó nem létezik!" });
    }
    await addProfilePicture(userId, null);

    return res.json({ msg: "Profilkép törlése sikeres!" });
  } catch (e) {
    return res.status(500).json({ msg: "Szerver hiba!", error: e?.message });
  }
});

export default router;
