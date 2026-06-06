# Huevos del Norte - Sistema de ventas, inventario, rutas y facturacion

Sistema full stack con React + Node.js/Express.

Estado actual de la app:

- `frontend/`: React + Vite
- `backend/`: Express
- persistencia: `SQLite` local con `better-sqlite3`

## Requisitos

- Node.js 18 o superior

## Instalacion rapida

Desde la raiz:

```bash
npm install
npm run install:all
npm run dev
```

Frontend:

```text
http://localhost:5173
```

Backend API:

```text
http://localhost:5000
```

## Estructura

```text
huevos-del-norte/
  backend/
    src/
      config/
      data/store.js
      routes/index.js
      services/storeService.js
      server.js
  frontend/
    src/
      components/
      layouts/
      utils/api.js
      main.jsx
```

## Modulos incluidos

- Dashboard
- Inventario
- Compras
- Ventas y facturacion
- Clientes
- Proveedores
- Rutas
- Camiones
- Gastos
- Cuentas por cobrar
- Cuentas por pagar
- Reportes
- Usuarios y login

## Reglas ya implementadas

- 1 carton equivale a 30 huevos
- las ventas descuentan inventario real
- no se puede vender mas de lo disponible
- las rutas consumen inventario cargado
- los gastos impactan utilidad
- las ventas a credito generan cuentas por cobrar
- las compras a credito generan cuentas por pagar

## Publicacion en Firebase

Si quieres subir este proyecto a Firebase sin romperlo, revisa [DEPLOY-FIREBASE.md](/c:/Users/eltig/Desktop/huevos-del-norte/DEPLOY-FIREBASE.md).

Resumen rapido:

- el frontend si puede publicarse en Firebase Hosting
- el backend actual no debe quedarse con SQLite local en produccion
- para que funcione bien necesitas backend publicado aparte o migrado, y base persistente real

## Persistencia actual

El backend persiste el estado desde:

- `backend/src/config/persistence.js`
- `backend/src/services/storeService.js`

Si vas a migrar a una base real, esos son los puntos clave a reemplazar.

## Endpoints principales

```text
GET    /api/health
POST   /api/auth/login
GET    /api/state
GET    /api/dashboard
GET    /api/reports
POST   /api/clients
POST   /api/routes
POST   /api/trucks
POST   /api/expenses
POST   /api/invoices
POST   /api/payments
```
