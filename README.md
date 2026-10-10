# 鋼琴五線譜

在 iPad 上按琴鍵，就會在上方的大譜表依序寫出四分音符。

網址：https://max8568.github.io/piano/

## 本機開發

不需要建置工具。因為使用 ES modules，需要透過網頁伺服器開啟：

```sh
npm run serve   # http://localhost:8000
npm test        # 單元測試（Node 內建 test runner）
```

## 第三方資源

- [VexFlow](https://github.com/0xfe/vexflow) 4.2.5（MIT）— 樂譜繪製，`vendor/vexflow.js`
- [Tone.js](https://github.com/Tonejs/Tone.js) 14.7.77（MIT）— 音訊，`vendor/tone.js`
- [Salamander Grand Piano](https://archive.org/details/SalamanderGrandPianoV3) by Alexander Holm（CC BY 3.0）— 鋼琴取樣，`audio/salamander/`，取自 [Tone.js audio](https://github.com/Tonejs/audio)
