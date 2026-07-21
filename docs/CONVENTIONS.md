# Convenciones del Equipo

- Usar TypeScript en todos los proyectos nuevos.
- Los commits deben seguir Conventional Commits (feat:, fix:, chore:, docs:, refactor:).
- Toda funcion publica debe tener JSDoc.
- Las pruebas unitarias son obligatorias para modulos de logica de negocio.
- No usar `any` en TypeScript; preferir tipos explicitos o `unknown`.
- Las variables de entorno se definen en `.env` y se acceden via `process.env`.
