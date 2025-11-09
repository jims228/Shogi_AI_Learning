# Docker: running the Shogi AI Learning stack

This repository includes Dockerfiles and a `docker-compose.yml` to run the FastAPI backend and Next.js web UI in containers. The setup is intentionally conservative: it mounts host engine assets (eval binaries and book files) as read-only volumes into the API container. This keeps engine binaries and large NNUE/book files out of the image and lets you use a local engine build.

Quick start

1. Copy the example env and edit values as needed:

   cp .env.example .env
   # edit .env and set ENGINE_EVAL_DIR / ENGINE_BOOK_DIR to host paths where you keep engine files

2. Build and start the stack:

   docker compose up --build

3. Open the services:

   - API: http://localhost:8787 (FastAPI)
   - Web UI: http://localhost:3000 (Next.js)

Dev mode (hot reload)

If you want automatic reload (uvicorn --reload and Next dev server) enable the dev flags in `.env`:

  BACKEND_DEV=1
  NEXT_DEV=1

Then run the same `docker compose up --build`. The compose mounts `./backend` and `./apps/web` into the containers so edits on your host are reflected in the running containers.

Engine files and volumes

- The compose file mounts two host directories into the API container:
  - `${ENGINE_EVAL_DIR}` -> `/engines/eval` (read-only)
  - `${ENGINE_BOOK_DIR}` -> `/engines/book` (read-only)

  By default these expand to `${HOME}/engines/yaneuraou/eval` and `${HOME}/engines/yaneuraou/book` if you don't set them in `.env`.

- We intentionally do not run a game engine inside the API container by default. The API expects to find engine binaries and book files under `/engines/eval` and `/engines/book`. If you prefer to run an engine container, replace the `engine-volumes` helper with an `engine` service in the compose file and update `ENGINE_CMD`/`ENGINE_URL` accordingly.

Healthchecks

- The `api` service includes a healthcheck that probes `/health`. The `web` service waits for the web server path `/annotate`.

Notes and troubleshooting

- If you don't have engine assets available, set `USE_DUMMY_ENGINE=1` in `.env` to use the built-in dummy engine for local testing. This avoids needing a native engine binary.
- If the API cannot find a book file, some engines print an error on startup; the app's `engine_check` scripts and the server are tolerant to this and will still run (the book will simply not be available to the engine).
- If ports 8787 or 3000 are already used on the host, stop the processes or change the compose port mappings.

- If your build fails with Next.js error "Couldn't find any `pages` or `app` directory", check your `.dockerignore`. An overly aggressive `.dockerignore` can exclude `apps/web/src` (or `apps/web/app`) from the build context and make the Next build fail. Ensure `.dockerignore` does not ignore `apps/**` or `apps/web/**`. The repository includes a minimal safe `.dockerignore` that explicitly un-ignores `apps/**` and `apps/web/**`.

Advanced: running a containerized engine

If you want the engine in a container, add a service like this (example only):

```yaml
  engine:
    build: ./engine
    volumes:
      - ${ENGINE_EVAL_DIR}:/usr/local/bin/eval:ro
      - ${ENGINE_BOOK_DIR}:/usr/local/bin/book:ro
    ports:
      - "8081:8081"
```

Then update `.env` so the API points to that engine (or set `ENGINE_CMD` inside the API container to the engine path). Be aware that some engine binaries need specific kernel-level permissions; running them in containers may require extra care.

Cleaning up

  docker compose down --volumes --remove-orphans

Questions or problems?

Open an issue or ask in the repository README for guidance. If you want, I can also add a pre-built engine container and an alternate compose profile that runs the engine in-container.
