Teszt adatbázis létrehozása:

Az SQL_queries mappából futtasuk le a query-ket a MySQL felületen a következő sorrendben:

- create_tables.sql (ha még nem voltak korábban létrehozva a táblák)

- data_reset.sql (ha volt már más adatokkal feltöltve az adatbázis)
  Ha ennek a futtatásakor jönne egy ilyen hiba a MySQL felületen:
  
  You are using safe update mode and you tried to update a table without a WHERE that uses a KEY column To disable safe mode, toggle the option ...
  
  Akkor ez az SQL query megoldja a problémát:
  
  SET SQL_SAFE_UPDATES = 0;

- reset_auto_increment_sql (ha volt már más adatokkal feltöltve az adatbázis)

- seed.sql

Teszt felhasználók bejelentkezési adatai:

alice:

felhasználónév: alice@example.com

jelszó: hashed_1

jay:

felhasználónév: jay@example.com

jelszó: hashed_2

bob:

felhasználónév: bob@example.com

jelszó: hashed_3
