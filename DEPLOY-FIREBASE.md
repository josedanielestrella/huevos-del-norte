# Publicar en Firebase sin romper el sistema

## Resumen corto

Este proyecto **no esta listo para funcionar completo solo con Firebase Database**.

Hoy la arquitectura real es esta:

- `frontend/`: React + Vite
- `backend/`: Node.js + Express
- persistencia: `SQLite` local con `better-sqlite3`

Eso significa:

- El **frontend** si puede publicarse en **Firebase Hosting**
- El **backend** no debe quedarse con SQLite local en produccion
- Si quieres algo estable, el backend debe ir a **Cloud Run / Railway / Render / VPS**
- La base de datos debe migrarse a **PostgreSQL / MySQL / Firestore**

## La opcion recomendada

Para que funcione bien en produccion:

1. Publica el frontend en Firebase Hosting.
2. Publica el backend aparte.
3. Cambia SQLite por una base de datos persistente.

La opcion mas limpia para este codigo es:

- Firebase Hosting para `frontend`
- Cloud Run para `backend`
- PostgreSQL o Cloud SQL para datos

## Lo que NO conviene hacer

No conviene publicar este backend actual en Firebase Functions con SQLite local porque:

- el filesystem no es persistente de forma confiable
- puedes perder datos al reiniciar la instancia
- `better-sqlite3` no es la opcion correcta para ese entorno
- el codigo actual guarda todo el estado como un JSON grande dentro de SQLite

## Camino 1: publicar solo el frontend en Firebase

Esto deja la interfaz online, pero necesitas un backend ya publicado.

### 1. Instala Firebase CLI

```bash
npm install -g firebase-tools
firebase login
```

### 2. Crea tu proyecto en Firebase

En consola:

```bash
firebase use --add
```

Tambien puedes copiar `.firebaserc.example` a `.firebaserc` y poner tu `project id`.

### 3. Configura la URL real del backend

Crea `frontend/.env.production` con algo como esto:

```env
VITE_API_URL=https://TU-BACKEND/api
VITE_DEFAULT_LOGIN_EMAIL=josedanielestrella@outlook.com
VITE_DEFAULT_LOGIN_PASSWORD=1234
```

### 4. Compila el frontend

```bash
cd frontend
npm install
npm run build
```

### 5. Publica Hosting

Desde la raiz del proyecto:

```bash
firebase deploy --only hosting
```

## Camino 2: dejar frontend + backend bajo el mismo dominio

Si publicas el backend en Cloud Run, puedes hacer que Firebase Hosting envie `/api/**` al servicio backend.

La idea es esta:

- frontend en Firebase Hosting
- backend en Cloud Run
- rewrite de `/api/**` hacia Cloud Run

En ese caso el frontend ya queda compatible porque en produccion usa `/api`.

Pero debes agregar un rewrite real con el nombre de tu servicio y region. Ejemplo de estructura:

```json
{
  "hosting": {
    "public": "frontend/dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "/api/**",
        "run": {
          "serviceId": "TU_SERVICIO",
          "region": "us-central1"
        }
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

No lo deje fijo en `firebase.json` porque esos valores dependen de tu proyecto real.

## El punto critico: la base de datos

Si quieres que "funcione bien", aqui esta el trabajo real:

### Opcion A: migrar a PostgreSQL o MySQL

Es la opcion mas compatible con el backend actual.

Tendrias que:

1. Crear tablas reales para usuarios, clientes, compras, rutas, facturas, pagos, inventario y gastos.
2. Reemplazar la logica de `backend/src/config/persistence.js`.
3. Cambiar `backend/src/services/storeService.js` para leer y escribir en SQL en vez del objeto `store`.
4. Mover autenticacion y transacciones a consultas reales.

### Opcion B: migrar a Firestore

Se puede, pero requiere mas reescritura.

Tendrias que rehacer:

- consultas por reportes
- consistencia de inventario
- liquidaciones de rutas
- cuentas por cobrar y pagar
- operaciones atomicas

Firestore sirve, pero este sistema tiene bastante logica transaccional y relacional. Por eso no es la ruta mas simple.

## Variables importantes

### Frontend

- `VITE_API_URL`: URL publica del backend
- `VITE_DEFAULT_LOGIN_EMAIL`
- `VITE_DEFAULT_LOGIN_PASSWORD`

### Backend

- `PORT`
- `CLIENT_URL`
- `JWT_SECRET`
- `ADMIN_NAME`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `DATABASE_URL`

## Recomendacion final

Si quieres salir rapido y sin dañar la app:

1. Publica primero el frontend en Firebase Hosting.
2. Publica el backend en otro servicio.
3. Usa una base SQL real.

Si quieres, en el siguiente paso te lo puedo dejar preparado en una de estas rutas:

- `Firebase Hosting + backend aparte`
- `Firebase Hosting + Cloud Run`
- `Migracion del backend a Firestore`
- `Migracion del backend a PostgreSQL`
