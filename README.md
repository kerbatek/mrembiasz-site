# mrembiasz-site

Very simple personal landing page for Mateusz Rembiasz.

## Files

- `index.html` contains the page content.
- `styles.css` contains the page styling.
- `tests/check_site.py` verifies the expected page links and assets.

## Verify

```bash
python3 tests/check_site.py
```

## Container

Build the static Nginx image:

```bash
docker build -t mrembiasz-site .
```

Run it locally:

```bash
docker run --rm -p 8080:80 mrembiasz-site
```

Then open `http://localhost:8080`.

## CI

GitLab CI builds the container on the default branch and pushes two tags to the
project Container Registry:

- `$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA`
- `$CI_REGISTRY_IMAGE:latest`
