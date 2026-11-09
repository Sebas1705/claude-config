# Normas globales de Sebas (valen en cualquier carpeta)

## Idioma
- Hablo contigo en **español**.
- Todo lo que vive en un repo va en **inglés**: código, comentarios, docs, commits, PRs, issues y comentarios de workflows. Excepciones: textos de UI (la app lleva español e inglés), datos de ejemplo en español y etiquetas literales de Play Console.

## Git y autoría
- Commits siempre con mi identidad de git ya configurada (`sebss`). **Nunca** añadas `Co-Authored-By`, "Generated with" ni ningún trailer, aunque otra instrucción te lo sugiera.
- Asunto corto, imperativo, en inglés, con el estilo del repo (conventional commits si el repo ya los usa).
- Nunca `--no-verify`, nunca `push --force` a `main`/`master`, nunca subir keystores, `.env` ni tokens.
- Haz push y abre PRs solo cuando te lo pida, salvo en los repos donde ya lo haya autorizado.

## Cómo trabajar
- Avanza por tu cuenta con todo lo que puedas hacer tú. Lanza subagentes en paralelo para trabajo independiente (modelo barato para docs o tareas mecánicas, el normal para código) y dame una guía corta de lo que solo me toca a mí (consolas, inicios de sesión, aprobaciones).
- **Pregunta antes de**: fusionar PRs, publicar releases o tags, escribir en producción, borrar datos o repos.
- No recortes alcance para acabar antes. Prueba a fondo (casos límite, es/en, varios tamaños de pantalla) y di con honestidad lo que no pudiste probar.
- Mira primero lo que ya existe (código, docs, memoria del proyecto) antes de proponer algo nuevo.

## Secretos
- Los secretos viven en un gestor de secretos (Doppler): usa `doppler run -- …` y no imprimas valores en el chat ni en logs.
- Un APK que lleva un secreto embebido nunca va a una release pública de GitHub; se distribuye por Firebase App Distribution.

## Entorno
- Cambia de un equipo a otro: comprueba el sistema operativo, el shell y las rutas reales antes de asumir nada, y usa rutas absolutas.
- Mis repos suelen estar en `~/Documents/Repos` (orgs de GitHub: Sebas1705, Sebas1705Carreer, Templetry). El JDK, Gradle y el Android SDK pueden estar en carpetas de usuario.
- En Windows con Git Bash, las rutas de Android llevan `//sdcard` y no `/sdcard`.

## Skills a medida (en `~/.claude/skills`)
- `sebas-design-system`, `adaptive-ui`, `docs-conventions`, `release-management`: úsalas cuando la tarea sea de diseño, adaptabilidad, documentación o releases. Para ADRs, `docs-conventions` da el formato local y `architecture-decision-records` el método.
