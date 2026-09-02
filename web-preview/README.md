# EqualPath Iteration 1 Web Preview

This is a static, interactive assessment preview of the frozen Iteration 1 product journey. It uses deterministic local fixtures and has no authentication, backend mutation, messaging or booking capability.

## Local verification

```sh
npm ci
npm run check
python3 -m http.server 8080 --directory dist
```

Open `http://localhost:8080`. The GitHub Pages workflow publishes the same `dist` directory.
