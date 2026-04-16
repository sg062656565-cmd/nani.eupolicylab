# 歐盟政策實驗室：難民協議篇 (EU Policy Lab: Refugee Protocol)

這是一個基於 React 與 Gemini AI 的外交談判模擬遊戲。

## 如何開始

1. **取得 Gemini API Key**：
   - 前往 [Google AI Studio](https://aistudio.google.com/)。
   - 登入您的 Google 帳號並點擊 「Get API key」。
   - 複製產生的金鑰。

2. **輸入 API Key**：
   - 在網頁啟動後的初始介面中，直接輸入您的 Gemini API Key。
   - 系統會將金鑰安全地儲存在您的瀏覽器本地儲存空間 (localStorage) 中。

## 部署規範說明

本專案遵循 Cloudflare Pages 部署規範：
- HTML 啟動腳本位於 `index.html` 底部。
- API Key 透過網頁 UI 輸入，不硬編碼於程式碼中。
- 專案架構採用標準 Vite 結構。
