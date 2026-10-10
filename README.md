# 鋼琴五線譜

在 iPad 上按琴鍵，就會在上方的大譜表依序寫出四分音符。
長按譜上的音符，它會變藍並跟著手指移動；往上拉到變紅再放開，就能刪掉那個音符。
右上角的「清除」會刪掉所有音符：按一下變成「確定清除？」，3 秒內再按一下才會清除。

網址：https://max8568.github.io/piano/

## 本機開發

不需要建置工具。因為使用 ES modules，需要透過網頁伺服器開啟：

```sh
npm run serve   # http://localhost:8000
npm test        # 單元測試（Node 內建 test runner）
```

## 安裝到 iPad（PWA）

用 Safari 開啟網址 → 分享 →「加入主畫面」。開過一次之後就能離線使用（含聲音）。

更新：開啟 App 時會檢查有沒有新版，新版下載並核對完就接手；譜上還沒有音符會自動重新載入成新版，否則下次開啟就是新版。
新增檔案時要加進 `sw.js` 的 `PRECACHE`（`npm test` 會檢查有沒有漏）。
每次發佈前執行 `npm run release`：`version.js` 與 `sw.js` 的 `VERSION` 一起加一，並重算 `sw.js` 裡每個程式檔的指紋（`npm test` 會檢查版本一致、指紋最新）。
新版的 Service Worker 會核對下載到的每個檔案都是這一版的才接手，不會出現新舊檔案混雜；畫面左上角顯示的版本號就是實際在跑的版本。

## 第三方資源

- [VexFlow](https://github.com/0xfe/vexflow) 4.2.5（MIT）— 樂譜繪製，`vendor/vexflow.js`
- [Tone.js](https://github.com/Tonejs/Tone.js) 14.7.77（MIT）— 音訊，`vendor/tone.js`
- [Salamander Grand Piano](https://archive.org/details/SalamanderGrandPianoV3) by Alexander Holm（CC BY 3.0）— 鋼琴取樣，`audio/salamander/`，取自 [Tone.js audio](https://github.com/Tonejs/audio)
