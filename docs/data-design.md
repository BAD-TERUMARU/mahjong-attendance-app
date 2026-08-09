# Attendance Data Design

## Concept

出欠管理は、最初はExcelまたはCSVで運用し、後からDBに移行しやすい形にします。

基本は以下の3種類です。

- 開催日・対戦相手データ
- メンバーデータ
- 出欠回答データ

## Source File: match-days

外部ファイルから取得する想定の開催日リストです。

```text
match_id,date,weekday,start_time,opponent_team,current_points,required_players,note
```

| column | description |
| --- | --- |
| `match_id` | 開催日の一意ID。例: `M20260516` |
| `date` | 対象日 |
| `weekday` | 曜日 |
| `start_time` | 開始時間 |
| `opponent_team` | 対戦相手 |
| `current_points` | 対戦相手または対象リーグ上の現状ポイント |
| `required_players` | 必要人数 |
| `note` | 補足 |

## Source File: members

Discordユーザーと表示名の対応です。

```text
user_id,display_name,discord_user_id,role,note
```

## Response Values

ユーザーが入力する値は、以下の3つに絞ります。

| value | meaning |
| --- | --- |
| `〇` | 参加可能 |
| `△` | 未定・条件付き |
| `×` | 不参加 |

空欄は未回答として扱います。

## DB Migration Shape

ExcelからDBへ移行する場合は以下のテーブルに対応できます。

```text
match_days
- match_id
- date
- start_time
- opponent_team
- current_points
- required_players
- note

members
- user_id
- display_name
- discord_user_id
- role
- note

attendance_responses
- match_id
- user_id
- status
- comment
- updated_at
```

## Discord Display

Discordでは日別に以下をEmbed表示します。

```text
5/16 Sat 21:00 vs Sample Team A
相手ポイント: 125.4
必要人数: 4

〇 3人: A, B, C
△ 1人: D
× 2人: E, F
未回答 4人: G, H, I, J
```

