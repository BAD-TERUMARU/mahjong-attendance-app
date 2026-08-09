# GCP Cloud Run Deploy

Cloud Run + Firestoreで、24時間アクセスできるURLを作る構成です。

## Architecture

```text
Cloud Run
- Node.js Web app
- min instances = 0
- public URL

Firestore
- 出欠回答
- 登板確定メンバー

Google Sheets
- 対戦相手ポイント
```

## Free Tier Notes

この規模なら無料枠に収まりやすいです。

- Cloud Runは `min instances = 0` にします。
- Firestoreは回答数が少ないため、無料枠に収まりやすいです。
- ただし、GCPでは念のため予算アラートを必ず設定してください。

## Prepare

GCPで以下を有効化します。

- Cloud Run
- Cloud Build
- Artifact Registry
- Firestore

FirestoreはNative modeで作成します。

## Environment Variables

Cloud Runに設定します。

```text
PORT=8080
STORAGE_DRIVER=firestore
FIRESTORE_PROJECT_ID=<your-gcp-project-id>
FIRESTORE_COLLECTION=attendanceStores
STORE_ID=default
POINTS_CSV_URL=<Google Sheets CSV URL>
```

`POINTS_CSV_URL` は後からでも設定できます。

## Deploy With gcloud

`attendance-app` ディレクトリで実行します。

```powershell
gcloud run deploy mahjong-attendance `
  --source . `
  --region asia-northeast1 `
  --allow-unauthenticated `
  --set-env-vars "STORAGE_DRIVER=firestore,FIRESTORE_PROJECT_ID=<your-gcp-project-id>,FIRESTORE_COLLECTION=attendanceStores,STORE_ID=default,PORT=8080"
```

Google SheetsのポイントCSV URLも同時に設定する場合:

```powershell
gcloud run deploy mahjong-attendance `
  --source . `
  --region asia-northeast1 `
  --allow-unauthenticated `
  --set-env-vars "STORAGE_DRIVER=firestore,FIRESTORE_PROJECT_ID=<your-gcp-project-id>,FIRESTORE_COLLECTION=attendanceStores,STORE_ID=default,PORT=8080,POINTS_CSV_URL=<csv-url>"
```

## Pages

公開URLが `https://example.run.app` の場合:

```text
https://example.run.app/
https://example.run.app/summary
https://example.run.app/lineup
https://example.run.app/admin/lineup
```

## Important

現時点の `/admin/lineup` は認証なしです。
Discord内の限られたメンバーだけにURLを共有する運用なら試せますが、公開運用では次に簡易パスコードかGoogleログインを追加するのが安全です。

