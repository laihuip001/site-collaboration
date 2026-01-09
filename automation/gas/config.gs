/**
 * ========================================
 * 設定ファイル (config.gs)
 * ========================================
 * このファイルに各種IDとトークンを設定してください。
 * ⚠️ 注意: トークンは絶対にGitHubにPushしないこと！
 */

const CONFIG = {
  // ========================================
  // Google Drive 設定
  // ========================================
  // 「Release」フォルダのID（URLの末尾部分）
  // 例: https://drive.google.com/drive/folders/XXXXXXX の XXXXXXX 部分
  RELEASE_FOLDER_ID: '1RT8ITIJqt1nPDYGGlJwhaM0McHW0-Ex7',

  // ========================================
  // Google スプレッドシート 設定
  // ========================================
  // 図面台帳用スプレッドシートのID
  SPREADSHEET_ID: '1OhqKohZr9XB7m_O05-ramV0LdaljyjhwknZG0qRmYXQ',
  // シート名（デフォルト: '図面台帳'）
  SHEET_NAME: '図面台帳',

  // ========================================
  // GitHub 設定
  // ========================================
  // リポジトリのオーナー名（ユーザー名 or 組織名）
  GITHUB_OWNER: 'laihuip001',
  // リポジトリ名
  GITHUB_REPO: 'site-collaboration',
  // 更新対象のファイルパス（リポジトリルートからの相対パス）
  GITHUB_FILE_PATH: 'docs/current_blueprints.md',
  // ブランチ名
  GITHUB_BRANCH: 'main',
  // Personal Access Token (PAT) - repo権限が必要
  // ⚠️ このトークンは秘密情報です！共有しないでください。
  GITHUB_TOKEN: 'YOUR_GITHUB_TOKEN_HERE',

  // ========================================
  // LINE Notify 設定 (オプション)
  // ========================================
  // 使用しない場合は空文字 '' のままにする
  LINE_NOTIFY_TOKEN: '',

  // ========================================
  // 動作設定
  // ========================================
  // スキャン間隔（分）- トリガー設定時に使用
  SCAN_INTERVAL_MINUTES: 5,
};
