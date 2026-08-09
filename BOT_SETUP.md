# Discord Bot Setup

出欠管理Botの最小実装です。

## What It Does

- `data/match-days.csv` または `data/match-days.sample.csv` から開催日を読み込みます。
- `data/members.csv` または `data/members.sample.csv` からメンバーを読み込みます。
- `/attendance sync` で開催日ごとの募集メッセージを作成します。
- ユーザーはボタンで `〇 参加` / `△ 未定` / `× 不参加` を登録できます。
- 回答後、募集メッセージのEmbed集計が自動更新されます。
- `/attendance summary` で集計を確認できます。
- `/attendance remind match_id:...` で未回答者を確認できます。

## Files

```text
attendance-app/
- package.json
- .env.example
- src/
  - index.js
  - deploy-commands.js
  - config.js
  - lib/
    - csv.js
    - storage.js
- data/
  - match-days.sample.csv
  - members.sample.csv
  - store.json
```

`store.json` はBotが初回回答時に自動作成します。

## Setup

1. Discord Developer PortalでApplicationを作成します。
2. Botを作成し、Tokenを取得します。
3. OAuth2 URL GeneratorでBotをサーバーに招待します。
4. `.env.example` を `.env` にコピーして、以下を設定します。

```text
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
```

5. 依存関係を入れます。

```bash
npm install
```

6. Slash commandを登録します。

```bash
npm run deploy
```

7. Botを起動します。

```bash
npm start
```

8. Discordで以下を実行します。

```text
/attendance sync
```

別チャンネルに投稿したい場合:

```text
/attendance sync channel:#試合予定
```

## CSV Format

開催日:

```text
match_id,date,weekday,start_time,opponent_team,current_points,required_players,note
M20260516,2026-05-16,Sat,21:00,Sample Team A,125.4,4,通常リーグ戦
```

メンバー:

```text
user_id,display_name,discord_user_id,role,note
U001,Sample Player 1,DISCORD_USER_ID_1,member,
```

## Notes

- 本番運用では `data/match-days.csv` と `data/members.csv` を作るのがおすすめです。
- sampleファイルは動作確認用です。
- 回答データは `data/store.json` に保存されます。
- 今はDBなしのJSON保存です。運用が固まったらSQLiteまたはPostgreSQLに移行できます。
