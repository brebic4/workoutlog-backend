# WorkoutLog API dokumentacija (Backend)

Base URL (lokalno): `http://localhost:3000`\
Svi endpointi vraćaju JSON (osim `204 No Content`).

## Autentifikacija (JWT)

Za zaštićene rute koristi se HTTP header:

`Authorization: Bearer <TOKEN>`

JWT sadrži minimalne podatke: - `sub` = userId - `role` = USER ili ADMIN

------------------------------------------------------------------------

# 1) Health

## GET /api/health

Provjera rada backend-a.

**Response 200**

``` json
{ "status": "ok" }
```

------------------------------------------------------------------------

# 2) Auth

## POST /api/auth/register

Registracija korisnika.

**Body**

``` json
{
  "email": "user@test.com",
  "password": "Test12345"
}
```

**Response 201**

``` json
{
  "message": "Korisnik uspješno registriran. Molimo prijavite se.",
  "user": {
    "id": "65d...",
    "email": "user@test.com"
  }
}
```

**Response 409** - ako email već postoji

------------------------------------------------------------------------

## POST /api/auth/login

Prijava korisnika i generiranje JWT tokena.

**Body**

``` json
{
  "email": "user@test.com",
  "password": "Test12345"
}
```

**Response 200**

``` json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "65d...",
    "email": "user@test.com",
    "role": "USER"
  }
}
```

------------------------------------------------------------------------

## GET /api/auth/me

Dohvat podataka trenutno prijavljenog korisnika.

**Headers** - `Authorization: Bearer <TOKEN>`

------------------------------------------------------------------------

# 3) Workouts (USER -- owner pravilo)

## POST /api/workouts

Kreiranje workouta (owner = prijavljeni korisnik).

## GET /api/workouts

Lista workoutova prijavljenog korisnika.

## GET /api/workouts/:id

Dohvat jednog workouta -- samo ako pripada korisniku.

## PATCH /api/workouts/:id

Djelomična izmjena workouta.

## DELETE /api/workouts/:id

Brisanje workouta (samo owner).

------------------------------------------------------------------------

# 4) Admin (ADMIN -- nadzor sustava)

## GET /api/admin/workouts

Admin dohvaća sve workoutove.

## DELETE /api/admin/workouts/:id

Admin može obrisati bilo koji workout.

## GET /api/admin/stats

Agregirane statistike sustava (Mongo aggregation pipeline).

------------------------------------------------------------------------

# Standardni error format

``` json
{
  "error": {
    "message": "Opis greške",
    "status": 400
  }
}
```
