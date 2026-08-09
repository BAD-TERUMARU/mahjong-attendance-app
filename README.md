# Attendance App

その日の対戦予定と参加可否をDiscord上で管理するアプリです。

## Goal

チームメンバーが「今日はどこと対戦するのか」「自分は出るのか」「誰が足りないのか」を一目で確認できる状態にします。

## Current Build Direction

まずはExcel/CSVベースで出欠管理の型を作り、その後Discord Botに置き換えます。

用意する外部ファイル:

- `data/match-days.sample.csv`
  - 開催日、開始時間、対戦相手、現状ポイント、必要人数を管理。
- `data/members.sample.csv`
  - メンバー名とDiscordユーザーIDを管理。

入力:

- `〇`: 参加可能
- `△`: 未定・条件付き
- `×`: 不参加
- 空欄: 未回答

集計:

- 日別の `〇` / `△` / `×` / 未回答人数
- 必要人数に対する不足人数
- 対戦相手と現状ポイント

Excelテンプレート:

- `templates/attendance-template.xlsx`

Web版:

- `npm run web` で回答ページを起動。
- 回答ページ: `http://localhost:3000`
- 集計ページ: `http://localhost:3000/summary`
- 詳細: `WEB_SETUP.md`

## Core UI

DiscordのEmbed + ボタンを基本にします。

表示項目:

- 日付
- 集合時間
- 対戦チーム
- ルール・会場・URL
- 必要人数
- 参加者
- 未定
- 不参加
- 未回答
- 管理者メモ

ボタン:

- 参加
- 未定
- 不参加
- コメント追加

## Slash Commands

- `/match create`
  - 試合予定を作成。
- `/match list`
  - 直近の試合一覧を表示。
- `/match close`
  - 回答を締め切る。
- `/match remind`
  - 未回答者へリマインド。
- `/match update`
  - 対戦相手、時間、必要人数などを更新。

## Data Model

```text
match_days
- id
- guild_id
- channel_id
- message_id
- match_date
- start_time
- opponent_name
- opponent_points
- required_players
- rule_note
- location_note
- admin_note
- status
- created_by
- created_at
- updated_at

attendance_responses
- id
- match_id
- user_id
- status
- comment
- responded_at
```

`status` values:

- `available` = `〇`
- `tentative` = `△`
- `unavailable` = `×`

## MVP

### Excel MVP

- 外部CSV形式で開催日・対戦相手リストを用意できる。
- Excelで各メンバーが日別に `〇` / `△` / `×` を入力できる。
- Summaryで日別集計を確認できる。
- 必要人数に対する不足人数を確認できる。

### Discord MVP

- 管理者が試合予定をCSVまたは管理コマンドで登録できる。
- メンバーがボタンで参加可否を回答できる。
- 回答後にEmbedが自動更新される。
- 未回答者を一覧表示できる。
- 不足日だけリマインドできる。

## Later

- Google Calendar連携。
- 参加者が足りない時の自動通知。
- よく同卓するメンバーの組み合わせ提案。
- 過去の参加率集計。
