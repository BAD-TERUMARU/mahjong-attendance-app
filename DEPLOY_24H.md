# 24時間公開する方法

`localhost` は自分のPCからしか見えません。チーム全員が24時間使えるようにするには、Webアプリをクラウドに置きます。

## Recommended

最初は Render か Railway が扱いやすいです。

重要:

- 回答データは `data/store.json` に保存しています。
- クラウドの通常ファイルシステムは再起動や再デプロイで消えることがあります。
- そのため、Persistent Disk / Volume が必要です。

## Option A: Render

RenderではWebサービスは公開URLを持てます。Renderのドキュメント上、Webサービスは公開インターネットから受けるために `0.0.0.0` のポートで待ち受ける必要があります。また、通常のファイルシステムは一時的なので、回答データを残すにはPersistent Diskが必要です。

このプロジェクトには `render.yaml` を追加済みです。

設定方針:

```text
Build Command: npm install
Start Command: npm start
Disk mount path: /var/data
ATTENDANCE_STORE=/var/data/store.json
```

手順:

1. GitHubに `attendance-app` を含むリポジトリを作る。
2. RenderでNew Web Serviceを作成。
3. GitHubリポジトリを接続。
4. Root Directoryに以下を指定。

```text
attendance-app
```

5. Build Command:

```text
npm install
```

6. Start Command:

```text
npm start
```

7. Environment Variables:

```text
ATTENDANCE_STORE=/var/data/store.json
POINTS_CSV_URL=Google SheetsのCSV公開URL
```

8. Persistent Diskを追加。

```text
Mount Path: /var/data
Size: 1GB
```

## Option B: Railway

RailwayでもWebサービスとVolumeで運用できます。RailwayのVolumeは指定したマウントパスをアプリが読み書きできるディレクトリとして使えます。

設定方針:

```text
Start Command: npm start
Volume mount path: /app/data
ATTENDANCE_STORE=/app/data/store.json
```

手順:

1. RailwayでNew Projectを作成。
2. GitHubリポジトリを接続。
3. Root Directoryに以下を指定。

```text
attendance-app
```

4. Start Command:

```text
npm start
```

5. Volumeを追加。

```text
Mount Path: /app/data
```

6. Environment Variables:

```text
ATTENDANCE_STORE=/app/data/store.json
POINTS_CSV_URL=Google SheetsのCSV公開URL
```

## Google Sheets Points

ポイント表はGoogle SheetsからCSVとして公開します。

列名:

```text
team_name,current_points,rank,updated_at
```

`.env` またはクラウドの環境変数:

```text
POINTS_CSV_URL=https://docs.google.com/spreadsheets/d/.../export?format=csv&gid=...
```

## Current Scripts

Webアプリ:

```powershell
npm start
```

Discord Bot:

```powershell
npm run bot
```

Slash command登録:

```powershell
npm run deploy
```

