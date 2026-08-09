# Web Attendance Setup

Discord Botを使わず、Webページで出欠回答を集める運用です。

## What It Does

- `data/match-days.csv` または `data/match-days.sample.csv` から開催日を読み込みます。
- `data/members.csv` または `data/members.sample.csv` からメンバーを読み込みます。
- `data/opponent-points.csv`、または `POINTS_CSV_URL` のGoogle Sheets CSVから対戦相手ポイントを読み込みます。
- 各メンバーはWebページで名前を選び、日別に `〇` / `△` / `×` を回答します。
- 集計ページで日別の参加・未定・不参加・未回答・不足人数を確認できます。
- 回答データは `data/store.json` に保存されます。

## Start

```powershell
cd "C:\Users\rannk\OneDrive\Desktop\作業用\CodeX\20260509_mahjong\attendance-app"
npm run web
```

起動後、ブラウザで開きます。

```text
http://localhost:3000
```

集計ページ:

```text
http://localhost:3000/summary
```

登板確定:

```text
http://localhost:3000/lineup
```

登板編集:

```text
http://localhost:3000/admin/lineup
```

## Discordでの使い方

Discordの試合予定チャンネルに以下のように投稿します。

```text
出欠回答はこちら
http://localhost:3000

集計はこちら
http://localhost:3000/summary
```

ただし、`localhost` は自分のPCからしか見えません。
チーム全員に使ってもらうには、次のどれかが必要です。

- 自宅PCで起動し、Cloudflare Tunnelなどで外部公開する。
- GCP Cloud Run + Firestoreにデプロイする。
- Render、Railway、Fly.ioなどにデプロイする。
- Google SheetsやNotionなど、外部公開しやすいサービスに寄せる。

## Data Files

本番用にはsampleではなく、以下のファイルを作るのがおすすめです。

```text
data/match-days.csv
data/members.csv
```

### match-days.csv

```text
match_id,date,weekday,start_time,opponent_team_1,opponent_team_2,opponent_team_3,required_players,note
M20260516,2026-05-16,Sat,21:00,Sample Team A,Sample Team B,Sample Team C,4,通常リーグ戦
```

### members.csv

```text
user_id,display_name,discord_user_id,role,note
U001,Sample Player 1,DISCORD_USER_ID_1,member,
```

Web版では `discord_user_id` は必須ではありませんが、後からDiscord連携に戻す場合に使えます。

### opponent-points.csv

```text
team_name,current_points,rank,updated_at
Sample Team A,125.4,3,2026-05-09
```

Google Sheetsから取得する場合は、シートをCSV公開して `.env` に設定します。

```text
POINTS_CSV_URL=https://docs.google.com/spreadsheets/d/.../export?format=csv&gid=...
```

列名は以下のどれかに対応しています。

- チーム名: `team_name`, `opponent_team`, `team`, `name`
- ポイント: `current_points`, `points`, `point`
- 順位: `rank`
- 更新日: `updated_at`, `updatedAt`

## Bot版との違い

Web版:

- Discord Bot権限がほぼ不要。
- 回答画面を見やすく作れる。
- Discord外からも使える。
- 公開URLの準備が必要。

Bot版:

- Discord内で完結する。
- ボタン回答が楽。
- 日程が増えるとメッセージが多くなりやすい。
