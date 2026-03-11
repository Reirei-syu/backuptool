
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from "vite-plugin-singlefile";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    viteSingleFile() // 启用单文件打包插件
  ],
  server: {
    open: true,
    host: true,
  },
  // 确保打包后资源引用使用相对路径
  base: './',
  build: {
    // 禁用 CSS 代码分割，确保 CSS 内联
    cssCodeSplit: false,
    // 提高内联资源的大小限制，确保所有图片/脚本都内联
    assetsInlineLimit: 100000000,
  },
  define: {
    // 离线版不需要 API Key，设置为空字符串以防报错
    'process.env.API_KEY': JSON.stringify("") 
  }
});
