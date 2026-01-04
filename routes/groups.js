import express from "express";
import {} from "../database.js";
import {
  getAllGroups,
  getGroupsOfUser,
  addGroup,
  findUserByEmail,
  addUsersToGroup,
} from "../helpers.js";
import * as queries from "../database.js";

const router = express.Router();

router.get("/all", async (req, res) => {
  if (req.isAuthenticated()) {
    const allGroups = await getAllGroups();
    res.json(allGroups);
  } else {
    return res.status(401).send({ msg: "Sikertelen azonosítás!" });
  }
});

router.get("/ofUser", async (req, res) => {
  if (req.isAuthenticated()) {
    const { username } = req.query;
    console.log("username az ofUser endpoint-on: ", username);
    const groups = await getGroupsOfUser(username);
    res.json(groups);
  } else {
    return res.status(401).send({ msg: "Sikertelen azonosítás!" });
  }
});

router.post("/create", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ msg: "Sikertelen azonosítás!" });
  }
  const { name, description, teachersOnly } = req.body;
  const user = await findUserByEmail(req.session.passport.user);

  if (!name || !name.trim()) {
    return res.status(400).json({ msg: "A csoport neve kötelező!" });
  }
  try {
    const group = await addGroup(
      name.trim(),
      description?.trim() || "",
      teachersOnly,
      user.id
    );
    res.status(201).json({ msg: "Csoport létrehozva!", group });
  } catch (e) {
    if (e.message.includes("foglal")) {
      res.status(409).json({ msg: e.message });
    } else {
      res.status(500).json({ msg: "Szerverhiba: " + e.message });
    }
  }
});

router.delete("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ msg: "Sikertelen azonosítás!" });
  }
  const { groupName } = req.query;
  try {
    const group = await queries.getGroupByName(groupName);
    if (!group) {
      return res.status(404).json({ msg: "A törlendő csoport nem található!" });
    }
    const success = await queries.deleteGroup(group.id);
    if (success) {
      res.status(204).send();
    } else {
      res
        .status(500)
        .json({ msg: "Adatbázis hiba történt a csoport törlésekor!" });
    }
  } catch (e) {
    res.status(500).json({ msg: "Csoport törlése sikertelen: " + e.message });
  }
});

router.post("/users-to-group", async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ msg: "Sikertelen azonosítás!" });
    }
    const { groupName, usersToAdd } = req.body;
    if (!groupName || usersToAdd.length === 0) {
      return res
        .status(400)
        .json({ msg: "A csoport neve és a felhasználók listája kötelező!" });
    }
    await addUsersToGroup(groupName, usersToAdd);
    res.status(200).json({ msg: "Felhasználók csoporthoz rendelése sikeres!" });
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
});

router.delete("/users-from-group", async (req, res) => {
  if (req.isAuthenticated()) {
    const { groupName, userId } = req.query;
    const group = await queries.getGroupByName(groupName);
    if (!group) {
      return res.status(404).send({ msg: "Csoport nem található!" });
    } else {
      const result = await queries.deleteUserFromGroup(userId, group.id);
      if (result) {
        res.status(204).send();
      } else {
        res
          .status(500)
          .send(
            "Adatbázis hiba történt a felhasználó csoportból való törlésekor!"
          );
      }
    }
  } else {
    return res.status(401).send({ msg: "Sikertelen azonosítás!" });
  }
});

export default router;
