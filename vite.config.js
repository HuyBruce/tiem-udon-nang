import {defineConfig} from 'vite';
// Keep art as cacheable files instead of embedding SVG/data URLs in the UI bundle.
export default defineConfig({build:{assetsInlineLimit:0}});
