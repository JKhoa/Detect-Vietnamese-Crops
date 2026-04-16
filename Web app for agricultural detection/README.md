
  # Web app for agricultural detection

  This is a code bundle for Web app for agricultural detection. The original project is available at https://www.figma.com/design/POdkJ28grMbYpsjQR1wVMT/Web-app-for-agricultural-detection.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Backend mode

  - GitHub Pages: app will run in mock mode by default (no backend required).
  - Local real backend: set `.env.local` with `VITE_MOCK_MODE=false` and run backend at `http://localhost:8000`.
  - Public backend on production: set `VITE_API_BASE_URL=https://your-backend-domain` before build.
  - Optional WebSocket override: set `VITE_WS_BASE_URL=wss://your-backend-domain`.
  