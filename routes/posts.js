// Posts router: posztok listázása, poszt létrehozás fájlfeltöltéssel, poszt törlés admin joggal.
// Fontos elemek:
// - req.isAuthenticated() védelem
// - multer diskStorage upload mappába
// - fileFilter: képek + (doc/docx/xls/xlsx) engedélyezése
// - összméret limit: 100 MB összesen

import express from "express";
import {
  findUserByName,
  findUserByEmail,
  addPost,
  getPostsWithComments,
} from "../helpers.js";
import multer from "multer";
import path from "path";
import * as queries from "../database.js";

const ALLOWED_EXTENSIONS = [".doc", ".docx", ".xls", ".xlsx"];
const MAX_TOTAL_SIZE_MB = 100;
const MAX_TOTAL_SIZE_BYTES = MAX_TOTAL_SIZE_MB * 1024 * 1024;

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Feltöltési célmappa: projekt root /uploads
    // (path.resolve() ESM környezetben jó módszer a "projekt root" elérésére, ha onnan fut a node)
    const __dirname = path.resolve();
    cb(null, path.join(__dirname, "uploads"));
  },
  filename: function (req, file, cb) {
    // Egyedi fájlnév: timestamp + random + eredeti kiterjesztés.
    // Ez segít elkerülni az ütközést és a path traversal jellegű problémákat (mert nem használod az eredeti nevet).
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const mimetype = file.mimetype || "";
  const isImage = mimetype.startsWith("image/");

  const ext = path.extname(file.originalname || "").toLowerCase();
  const isAllowedDoc = ALLOWED_EXTENSIONS.includes(ext);

  // Engedélyezés: bármilyen image/* vagy a felsorolt dokumentumtípusok.
  // Megjegyzés: mimetype-et kliens is tud hamisítani, ezért a kiterjesztés ellenőrzés jó kiegészítés.
  // Ha nagyon szigorú akarsz lenni, akkor file signature (magic bytes) ellenőrzés kellene.
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
    // Username query paraméterből jön. (Backend oldalon érdemes validálni, hogy létező user.)
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
    // Multer middleware kézi becsomagolása:
    // így a hibákat te formázod (400 + saját üzenet), nem a default express error handler.
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

      // Összméret ellenőrzése: az összes csatolt fájl mérete együtt max 100 MB.
      // Ez segít a tárhely és DoS jellegű problémák ellen.
      const totalSize = uploadedFiles.reduce(
        (sum, file) => sum + (file.size || 0),
        0,
      );

      if (totalSize > MAX_TOTAL_SIZE_BYTES) {
        // Ha túllépi, akkor törlöd a már feltöltött fájlokat.
        // FONTOS MEGJEGYZÉS: ebben a fájlban fs nincs importálva, miközben fs.unlinkSync-et hívsz.
        // Ez futásidőben ReferenceError-t fog okozni. (Most nem javítom, csak jelzem.)
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

      // "Normalizált" fájl meta lista, amit adatbázisba tudsz menteni.
      // filename: a szerveren tárolt név, path: fizikai útvonal, mimetype/size: gyors megjelenítéshez/validáláshoz.
      const fileInfos = uploadedFiles
        .filter((file) => file && file.filename)
        .map((file) => ({
          filename: file.filename,
          path: file.path,
          size: file.size,
          mimetype: file.mimetype,
        }));

      // selectedGroupIds bejöhet stringként vagy tömbként (form-data eset).
      // Itt lekezeled mindkét formátumot.
      let groupIds = [];
      if (Array.isArray(selectedGroupIds)) {
        groupIds = selectedGroupIds.map((id) => parseInt(id));
      } else if (selectedGroupIds) {
        groupIds = [parseInt(selectedGroupIds)];
      }

      // userName alapján user lookup.
      // Megjegyzés: biztonságosabb, ha a userId-t a sessionből veszed, nem a request bodyból.
      // Most meghagyom a meglévő logikát.
      const user = await findUserByName(userName);
      const userId = user.id;
      if (userId) {
        // teachersOnly flag: a poszt tartalma csak tanároknak jelenjen meg a csoporton belül.
        const teachersOnly = groupType === "TEACHER_ONLY";
        await addPost(
          title,
          content,
          isPublic === "true",
          labels,
          userId,
          groupIds,
          videoLink,
          fileInfos.length ? fileInfos : null,
          teachersOnly === true ? 1 : 0,
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
  },
);

router.delete("/:id", async (req, res) => {
  if (req.isAuthenticated()) {
    // Paraméter validálás: poszt id pozitív egész legyen.
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: "Érvénytelen poszt id!" });
    }

    // Jelenlegi user a sessionből (email).
    const user = await findUserByEmail(req.session.passport.user);
    if (!user) {
      return res.status(401).json({ msg: "Sikertelen azonosítás!" });
    }

    // Admin user lekérése: csak admin törölhet posztot.
    const adminUser = await queries.getAdminUser();
    if (!adminUser) {
      return res.status(500).send("Nem található admin felhasználó!");
    }

    if (user.id === adminUser.id) {
      const success = await queries.deletePost(userId);
      if (success) {
        res.status(204).send();
      } else {
        res.status(500).send("Adatbázis hiba történt a poszt törlésekor!");
      }
    } else {
      return res
        .status(403)
        .send({ msg: "Nincs jogosultsága a poszt törléséhez!" });
    }
  } else {
    return res.status(401).send({ msg: "Sikertelen azonosítás!" });
  }
});

export default router;
