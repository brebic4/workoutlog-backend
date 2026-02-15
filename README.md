# WorkoutLog -- Backend

Backend dio aplikacije WorkoutLog implementiran je koristeći:

- Node.js
- Express
- MongoDB Atlas (MongoDB driver)
- JWT autentifikaciju
- Role-based autorizaciju (USER / ADMIN)

Detaljna API dokumentacija nalazi se ovdje:

👉 **[API dokumentacija](./docs/API.md)**

---

## ⚙️ Pokretanje projekta lokalno

### 1️⃣ Kloniraj repozitorij

```bash
git clone <repo-url>
cd workoutlog-backend
```

### 2️⃣ Instaliraj ovisnosti

```bash
npm install
```

### 3️⃣ Kreiraj `.env` datoteku

Na temelju `.env_example`, kreiraj `.env` datoteku u root direktoriju:

```env
MONGO_URI=your_mongodb_connection_string
DB_NAME=workoutlog
PORT=3000
JWT_SECRET=neki_jako_siguran_secret
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

> ⚠️ `.env` datoteka se ne commita u repozitorij.

---

### 4️⃣ Pokretanje servera

Development (s nodemon):

```bash
npm run dev
```

ili

```bash
nodemon index.js
```

Production:

```bash
npm start
```

Server će biti dostupan na:

    http://localhost:3000

Provjera rada:

    GET /api/health

---

## 🔐 Autentifikacija

Backend koristi JWT token za zaštitu ruta.

Za sve zaštićene rute potrebno je poslati header:

    Authorization: Bearer <TOKEN>

Role sustav: - USER -- upravlja samo svojim workoutovima - ADMIN -- ima
pristup svim workoutovima i statistici

---

## 📬 Postman kolekcija

Preporučeni koraci Postman kolekcije za testiranje
svih endpointa.

Koraci:

1.  Otvori Postman\
2.  Postavi `baseUrl` environment varijablu na: http://localhost:3000

Preporučeni test flow:

1.  Register korisnika\
2.  Login\
3.  Kreiranje workouta\
4.  Test owner pravila\
5.  Admin testiranje

---

## 📊 Admin funkcionalnosti

ADMIN korisnik može:

- dohvatiti sve workoutove
- obrisati bilo koji workout
- dohvatiti agregirane statistike (`/api/admin/stats`)

---

## 📁 Struktura projekta

    config/
    middleware/
    routes/
    docs/
    index.js

---

## 👨‍💻 Autor

Projekt izrađen u sklopu kolegija Web aplikacije.
