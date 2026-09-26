# Checklist de release v0.1

## Código y seguridad

- [x] Registro y login persistentes con bcrypt y JWT.
- [x] Healthcheck público y rutas de dominio protegidas.
- [x] JWT conservado en cookie `httpOnly`; secretos fuera del bundle del navegador.
- [x] DTOs y errores de autenticación controlados.
- [x] Fixtures exclusivamente sintéticos.
- [x] CI con lint, typecheck, tests, build y format check.

## Servicios reales

- [ ] Crear/configurar Neon y aplicar las migraciones con `prisma migrate deploy`.
- [ ] Crear/configurar MongoDB Atlas, usuario de aplicación y acceso de red.
- [ ] Crear API key de OpenRouter y elegir un modelo gratuito con structured outputs.
- [ ] Ejecutar `pnpm smoke:production` contra el backend desplegado.

## Deployment

- [ ] Publicar el repositorio Git requerido por Render y Vercel.
- [ ] Crear el Web Service de Render desde `render.yaml` y configurar secretos.
- [ ] Verificar `GET /api/health` en la URL de Render.
- [ ] Crear el proyecto Vercel con Root Directory `apps/web`.
- [ ] Configurar `API_URL` y `JWT_EXPIRES_IN_SECONDS` en Vercel.
- [ ] Asignar `evidencefit.felipehenriquez.dev` al frontend.
- [ ] Mantener el backend en su subdominio Render o asignarle `api.evidencefit.felipehenriquez.dev`.
- [ ] Verificar login, refresh, extracción, evaluación, comparación y ausencia de errores CORS.
- [ ] Revisar logs de producción y confirmar que no contienen passwords, JWTs, API keys ni CVs completos.

## Declaración de release

La versión del código es `0.1.0`, pero la release no debe marcarse terminada hasta completar todas
las casillas de servicios reales y deployment.
