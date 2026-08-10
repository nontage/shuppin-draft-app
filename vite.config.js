import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // GitHub Pagesの「プロジェクトページ」として公開する場合は
  // base を '/リポジトリ名/' に変更してください。
  // (例: base: '/shuppin-draft-app/')
  base: './',
})
