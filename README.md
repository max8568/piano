# 鋼琴五線譜

在 iPad 上按琴鍵，就會在上方的大譜表依序寫出四分音符。

網址：https://max8568.github.io/piano/

## 本機開發

不需要建置工具。因為使用 ES modules，需要透過網頁伺服器開啟：

```sh
npm run serve   # http://localhost:8000
npm test        # 單元測試（Node 內建 test runner）
```

## 安裝到 iPad（PWA）

用 Safari 開啟網址 → 分享 →「加入主畫面」。開過一次之後就能離線使用（含聲音）。

更新：`sw.js` 會先用快取開啟、背景下載新版，所以推上新版後「下次開啟」就是新版。
新增檔案時要加進 `sw.js` 的 `PRECACHE`（`npm test` 會檢查有沒有漏）。
每次發佈都把 `version.js` 與 `sw.js` 的 `VERSION` 一起加一（`npm test` 會檢查兩者一致）：新版會立刻接手，畫面左上角也會顯示新的版本號。

## 第三方資源

- [VexFlow](https://github.com/0xfe/vexflow) 4.2.5（MIT）— 樂譜繪製，`vendor/vexflow.js`
- [Tone.js](https://github.com/Tonejs/Tone.js) 14.7.77（MIT）— 音訊，`vendor/tone.js`
- [Salamander Grand Piano](https://archive.org/details/SalamanderGrandPianoV3) by Alexander Holm（CC BY 3.0）— 鋼琴取樣，`audio/salamander/`，取自 [Tone.js audio](https://github.com/Tonejs/audio)
