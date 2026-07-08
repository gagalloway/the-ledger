import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// If your repo is named "the-ledger", GitHub Pages serves it at
//   https://<user>.github.io/the-ledger/
// so we need base to match that repo name. Change this string if you rename the repo.
export default defineConfig({
  base: '/the-ledger/',
  plugins: [react()],
});
