import { defineConfig } from 'vite'
// BASE diisi workflow GitHub Pages (/nama-repo/); lokal cukup '/'
export default defineConfig({ base: process.env.BASE || '/' })
