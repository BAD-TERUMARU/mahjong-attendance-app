# Attendance MVP Flow

## Excel First Flow

1. `data/match-days.sample.csv` の形式で開催日と対戦相手リストを用意する。
2. `data/members.sample.csv` の形式でメンバー一覧を用意する。
3. `templates/attendance-template.xlsx` に転記またはインポートする。
4. メンバーは `Responses` シートに `〇` / `△` / `×` を入力する。
5. `Summary` シートで日別の参加可能人数、未定、不参加、未回答を確認する。

## Discord Bot Flow

1. 管理者が外部ファイルを取り込む。
2. Botが開催日ごとの募集メッセージを作る。
3. ユーザーはDiscordのボタンで `〇` / `△` / `×` を選ぶ。
4. Botが回答を保存する。
5. Botが集計Embedを更新する。
6. 管理者は不足日だけリマインドする。

## First Implementation Scope

最初のDiscord実装では、以下に絞ります。

- 外部CSVから開催日を読み込む。
- 開催日ごとに募集メッセージを作成する。
- ボタンで出欠回答を保存する。
- 日別集計を表示する。
- 未回答者を表示する。

