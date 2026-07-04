import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages のプロジェクトページ配信のため base をリポジトリ名に合わせる。
// https://youkiti.github.io/medical-defense-2050/
export default defineConfig({
  base: '/medical-defense-2050/',
  plugins: [react(), tailwindcss()],
});
