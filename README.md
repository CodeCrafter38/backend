Teszt adatbázis létrehozása:

Az SQL_queries mappából futtasuk le a query-ket a MySQL felületen a következő sorrendben:

- create_tables.sql (ha még nem voltak korábban létrehozva a táblák)

- data_reset.sql (ha volt már más adatokkal feltöltve az adatbázis)

- reset_auto_increment_sql (ha volt már más adatokkal feltöltve az adatbázis)

- seed.sql

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
