# 出品ドラフト工房

古着・ブランド古着の出品用タイトル・詳細文を自動生成するツールです。
（Claudeで作成したアプリを、GitHub / 一般的なWebサーバーで動くように変換したものです）

データはブラウザの localStorage に保存されます（自分のPCのブラウザ内のみ・他の人とは共有されません）。

## 1. 事前準備

- [Node.js](https://nodejs.org/) （18以上）をインストールしておく
- [Git](https://git-scm.com/) をインストールしておく
- GitHubアカウントを持っている

## 2. ローカルで動作確認

ターミナル（Macならターミナル.app、WindowsならPowerShellなど）でこのフォルダに移動して：

```bash
npm install
npm run dev
```

表示されるURL（例: http://localhost:5173）をブラウザで開くと動作確認できます。

## 3. GitHubにアップロード

GitHub上で先に空のリポジトリを作成してから：

```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/【あなたのユーザー名】/【リポジトリ名】.git
git push -u origin main
```

## 4. Webアプリとして公開する

一番簡単なのは **Vercel** か **Netlify** です（どちらも無料枠あり）。

### Vercel / Netlifyの場合（おすすめ・一番簡単）
1. [vercel.com](https://vercel.com) または [netlify.com](https://netlify.com) にGitHubアカウントでログイン
2. 「New Project」からこのリポジトリを選択
3. フレームワークは自動で「Vite」と認識されるので、そのまま「Deploy」
4. 数十秒でURLが発行され、そこにアクセスすれば公開したWebアプリとして使えます

### GitHub Pagesの場合
1. `vite.config.js` の `base` を `'/リポジトリ名/'` に変更する
2. 以下を実行してビルド・公開用ブランチを作成
   ```bash
   npm install -D gh-pages
   npm run build
   npx gh-pages -d dist
   ```
3. GitHubリポジトリの Settings → Pages で、公開ブランチを `gh-pages` に設定

## 補足

- このアプリはあなたのブラウザ内にデータを保存するだけの仕組みです。複数の端末やスタッフ間でデータを共有したい場合は、別途データベース（Supabase・Firebaseなど）と連携する改修が必要です。必要であれば教えてください。
