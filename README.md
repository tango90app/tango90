# TANGO90 🏆

Plataforma para calificar jugadores, técnicos y árbitros después de cada partido.

---

## Cómo correrlo (paso a paso)

### Requisitos
- Node.js 18+ instalado ([descargar acá](https://nodejs.org))
- Una terminal (PowerShell, Terminal, iTerm, etc.)

### 1. Descomprimir el proyecto
Descomprimí el ZIP en la carpeta donde quieras trabajar. Ej: `~/Proyectos/tango90`

### 2. Abrir la terminal en esa carpeta
```bash
cd ~/Proyectos/tango90
```

### 3. Instalar dependencias
```bash
npm install
```
Esto descarga Next.js, Tailwind y todo lo necesario. Tarda ~1-2 minutos la primera vez.

### 4. Correr en modo desarrollo
```bash
npm run dev
```

### 5. Abrir en el navegador
Abrí tu navegador y entrá a:
```
http://localhost:3000
```

¡Listo! Vas a ver la app corriendo.

---

## Estructura del proyecto

```
tango90/
├── app/
│   ├── layout.tsx          → Header y estructura global
│   ├── page.tsx            → Lista de partidos (home)
│   ├── globals.css         → Estilos globales y fuentes
│   └── partido/[id]/
│       └── page.tsx        → Detalle del partido + calificaciones
├── components/
│   └── RatingRow.tsx       → Componente de calificación (0-10)
├── data/
│   └── matches.ts          → Datos mock de partidos
├── package.json
└── README.md
```

## Cómo agregar más partidos

Abrí `data/matches.ts` y agregá un nuevo objeto al array `matches` siguiendo el mismo formato.

## Cómo funciona el sistema de votos

Los votos se guardan en `localStorage` del navegador. Esto significa:
- Cada usuario puede votar una vez por jugador por partido
- Los datos persisten entre sesiones del mismo navegador
- No se comparten entre usuarios (para eso necesitarías un backend)

---

## Próximos pasos sugeridos

1. **Backend** → Supabase o Firebase para guardar votos reales
2. **Auth** → Login con Google para identificar usuarios
3. **API de fútbol** → Conectar con una API real de partidos (ej: football-data.org)
4. **Más estadísticas** → Historial de calificaciones por jugador
