Teszt adatbázis létrehozása:

Az SQL_queries mappából futtasuk le a query-ket a MySQL felületen a következő sorrendben:

- 01_create_tables.sql (ha még nem voltak korábban létrehozva a táblák)

- 02_data_reset.sql (ha volt már más adatokkal feltöltve az adatbázis)

  Ha ennek a futtatásakor jönne egy ilyen hiba a MySQL felületen:

  You are using safe update mode and you tried to update a table without a WHERE that uses a KEY column To disable safe mode, toggle the option ...

  Akkor ez az SQL query megoldja a problémát:

  SET SQL_SAFE_UPDATES = 0;

- 03_reset_auto_increment_sql (ha volt már más adatokkal feltöltve az adatbázis)

- 04_extend_posts.sql

- 05_extend_groups_nexus.sql

- 06_add_profile_pictures_to_users.sql

- 07_seed.sql

Teszt felhasználók bejelentkezési adatai:

admin:

felhasználónév: admin@example.com

jelszó: hashed_1

student:

felhasználónév: student@example.com

jelszó: hashed_2

teacher:

felhasználónév: teacher@example.com

jelszó: hashed_3
