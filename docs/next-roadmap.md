# Attendance Next Roadmap

## 1. 1日3チーム対応

`match-days.csv` は以下の形式にします。

```text
match_id,date,weekday,start_time,opponent_team_1,opponent_team_2,opponent_team_3,required_players,note
M20260516,2026-05-16,Sat,21:00,Team A,Team B,Team C,4,通常リーグ戦
```

Web画面では、各開催日カード内に3チームを並べて表示します。

## 2. 対戦相手ポイントの取得

ポイントは日程CSVに直接持たせず、別ソースから取得します。

ローカルCSV:

```text
data/opponent-points.csv
```

Google Sheets CSV:

```text
POINTS_CSV_URL=https://docs.google.com/spreadsheets/d/.../export?format=csv&gid=...
```

対応列:

- `team_name`
- `current_points`
- `rank`
- `updated_at`

Google Sheets側は「チーム名」をキーにして、日程CSVの `opponent_team_1` などと一致させます。

## 3. UI

今のWeb版は、試合カードごとに以下を表示します。

- 開催日
- 開始時間
- match_id
- 3チーム分の対戦相手
- 順位
- 現状ポイント
- 必要人数
- 出欠入力
- メモ

次に足すなら:

- 不足日だけ目立たせるフィルタ
- 自分の未回答だけ表示
- スマホ向けの固定保存ボタン
- 回答締切表示
- 管理者向けのCSV再読み込みボタン

## 4. Discord Botとの役割分担

Webを主役にし、Discord Botは「見る・通知する」役にします。

将来のSlash command:

```text
/schedule upcoming
/schedule summary
/schedule missing
/schedule post
```

役割:

- `/schedule upcoming`
  - 直近の対戦予定をDiscordに表示。
- `/schedule summary`
  - 出欠集計をDiscordに表示。
- `/schedule missing`
  - 未回答者を表示。
- `/schedule post`
  - Web回答URLと集計URLをチャンネルに投稿。

