import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// If you deploy to https://<username>.github.io/<repo-name>/ (the default),
// set base to "/<repo-name>/" below — replace with your actual repo name.
// If you deploy to a custom domain instead, set base to "/".
export default defineConfig({
  plugins: [react()],
  base: "/scale-up-nano/",
});
