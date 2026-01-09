/**
 * ========================================
 * 図面同期スクリプト (sync_to_github.gs)
 * ========================================
 * Google Drive の Release フォルダを監視し、
 * 変更があれば GitHub の current_blueprints.md を自動更新します。
 */

/**
 * メイン処理: フォルダをスキャンし、GitHubを更新
 * この関数をトリガーに設定してください。
 */
function syncToGitHub() {
  try {
    Logger.log('===== 同期処理開始 =====');
    
    // 1. Releaseフォルダ内のファイル一覧を取得
    const files = scanReleaseFolder_();
    Logger.log(`検出されたファイル数: ${files.length}`);
    
    // 2. スプレッドシート（図面台帳）を更新
    updateSpreadsheet_(files);
    
    // 3. Markdown形式のコンテンツを生成
    const markdownContent = generateMarkdown_(files);
    
    // 4. GitHubにコミット
    const commitResult = commitToGitHub_(markdownContent);
    
    // 5. 変更があれば通知
    if (commitResult.updated) {
      sendNotification_(commitResult.message);
    }
    
    Logger.log('===== 同期処理完了 =====');
  } catch (error) {
    Logger.log(`エラー発生: ${error.message}`);
    // エラー時もLINE通知（設定があれば）
    if (CONFIG.LINE_NOTIFY_TOKEN) {
      sendLineNotify_(`[エラー] 図面同期に失敗しました: ${error.message}`);
    }
  }
}

/**
 * Releaseフォルダ内のファイルをスキャン
 * @returns {Array<Object>} ファイル情報の配列
 */
function scanReleaseFolder_() {
  const folder = DriveApp.getFolderById(CONFIG.RELEASE_FOLDER_ID);
  const files = folder.getFiles();
  const result = [];
  
  while (files.hasNext()) {
    const file = files.next();
    const fileName = file.getName();
    
    // ファイル名からカテゴリとIDを推測（例: A-01_平面詳細図_1F.pdf）
    const parsed = parseFileName_(fileName);
    
    result.push({
      id: file.getId(),
      name: fileName,
      category: parsed.category,
      docId: parsed.docId,
      title: parsed.title,
      url: file.getUrl(),
      lastUpdated: file.getLastUpdated(),
      version: detectVersion_(file),
    });
  }
  
  // IDでソート
  result.sort((a, b) => a.docId.localeCompare(b.docId));
  
  return result;
}

/**
 * ファイル名をパースしてカテゴリ・ID・タイトルを抽出
 * 命名規則: {カテゴリ}-{番号}_{タイトル}.pdf
 * 例: A-01_平面詳細図_1F.pdf -> { category: 'A', docId: 'A-01', title: '平面詳細図 1F' }
 */
function parseFileName_(fileName) {
  // 拡張子を除去
  const baseName = fileName.replace(/\.[^/.]+$/, '');
  
  // パターンマッチ
  const match = baseName.match(/^([A-Z])-(\d+)_(.+)$/);
  
  if (match) {
    const categoryCode = match[1];
    const number = match[2];
    const title = match[3].replace(/_/g, ' ');
    
    const categoryMap = {
      'A': '意匠図',
      'S': '構造図',
      'E': '電気設備図',
      'M': '機械設備図',
      'P': '給排水図',
    };
    
    return {
      category: categoryMap[categoryCode] || 'その他',
      docId: `${categoryCode}-${number}`,
      title: title,
    };
  }
  
  // パターンに合わない場合
  return {
    category: 'その他',
    docId: 'X-00',
    title: baseName,
  };
}

/**
 * ファイルのバージョンを検出
 * Driveのリビジョン数をバージョン番号として使用
 */
function detectVersion_(file) {
  try {
    const revisions = Drive.Revisions.list(file.getId());
    const count = revisions.items ? revisions.items.length : 1;
    return `v${count}.0`;
  } catch (e) {
    // リビジョンAPIが使えない場合はv1.0を返す
    return 'v1.0';
  }
}

/**
 * スプレッドシートを更新
 */
function updateSpreadsheet_(files) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  
  // シートがなければ作成
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow(['ファイルID', '図面ID', '図面名称', 'カテゴリ', 'バージョン', '最終更新', 'URL']);
  }
  
  // 既存データをクリア（ヘッダー以外）
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 7).clearContent();
  }
  
  // 新しいデータを書き込み
  files.forEach((file, index) => {
    sheet.getRange(index + 2, 1, 1, 7).setValues([[
      file.id,
      file.docId,
      file.title,
      file.category,
      file.version,
      Utilities.formatDate(file.lastUpdated, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm'),
      file.url,
    ]]);
  });
}

/**
 * Markdown形式のコンテンツを生成
 */
function generateMarkdown_(files) {
  const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
  
  let md = `# 📐 最新図面・仕様書一覧\n\n`;
  md += `**最終更新:** ${now} (自動更新)\n`;
  md += `**ステータス:** 🟢 最新\n\n`;
  md += `> ⚠️ このファイルは自動生成されます。手動で編集しないでください。\n\n`;
  
  // カテゴリごとにグループ化
  const grouped = {};
  files.forEach(file => {
    if (!grouped[file.category]) {
      grouped[file.category] = [];
    }
    grouped[file.category].push(file);
  });
  
  // カテゴリ順序
  const categoryOrder = ['意匠図', '構造図', '電気設備図', '機械設備図', '給排水図', 'その他'];
  
  categoryOrder.forEach(category => {
    if (grouped[category] && grouped[category].length > 0) {
      md += `## 🏗️ ${category}\n\n`;
      md += `| ID | 図面名称 | Ver | ドライブURL | 最終更新 |\n`;
      md += `| :--- | :--- | :--- | :--- | :--- |\n`;
      
      grouped[category].forEach(file => {
        const updated = Utilities.formatDate(file.lastUpdated, 'Asia/Tokyo', 'MM/dd HH:mm');
        md += `| ${file.docId} | ${file.title} | ${file.version} | [開く](${file.url}) | ${updated} |\n`;
      });
      
      md += `\n`;
    }
  });
  
  return md;
}

/**
 * GitHubにMarkdownをコミット
 */
function commitToGitHub_(content) {
  const apiUrl = `https://api.github.com/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/contents/${CONFIG.GITHUB_FILE_PATH}`;
  
  // 現在のファイル情報を取得（SHAが必要）
  let currentSha = null;
  let currentContent = null;
  
  try {
    const getResponse = UrlFetchApp.fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `token ${CONFIG.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
      },
      muteHttpExceptions: true,
    });
    
    if (getResponse.getResponseCode() === 200) {
      const data = JSON.parse(getResponse.getContentText());
      currentSha = data.sha;
      currentContent = Utilities.newBlob(Utilities.base64Decode(data.content)).getDataAsString();
    }
  } catch (e) {
    Logger.log('既存ファイルの取得に失敗（新規作成として処理）');
  }
  
  // 内容が同じなら更新しない
  if (currentContent === content) {
    Logger.log('変更なし - スキップ');
    return { updated: false, message: '' };
  }
  
  // コミットを実行
  const payload = {
    message: `[自動更新] 図面リスト更新 - ${Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm')}`,
    content: Utilities.base64Encode(content),
    branch: CONFIG.GITHUB_BRANCH,
  };
  
  if (currentSha) {
    payload.sha = currentSha;
  }
  
  const putResponse = UrlFetchApp.fetch(apiUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${CONFIG.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    payload: JSON.stringify(payload),
  });
  
  if (putResponse.getResponseCode() === 200 || putResponse.getResponseCode() === 201) {
    Logger.log('GitHubへのコミット成功');
    return { updated: true, message: '📐 図面リストが更新されました。GitHubで最新版をご確認ください。' };
  } else {
    throw new Error(`GitHub API エラー: ${putResponse.getContentText()}`);
  }
}

/**
 * 通知を送信
 */
function sendNotification_(message) {
  // LINE Notifyが設定されていれば送信
  if (CONFIG.LINE_NOTIFY_TOKEN) {
    sendLineNotify_(message);
  }
  
  // ログにも記録
  Logger.log(`通知送信: ${message}`);
}

/**
 * LINE Notifyでメッセージ送信
 */
function sendLineNotify_(message) {
  if (!CONFIG.LINE_NOTIFY_TOKEN) return;
  
  UrlFetchApp.fetch('https://notify-api.line.me/api/notify', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CONFIG.LINE_NOTIFY_TOKEN}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    payload: `message=${encodeURIComponent(message)}`,
  });
}

/**
 * 初期セットアップ: トリガーを設定
 * この関数を一度だけ手動実行してください。
 */
function setupTrigger() {
  // 既存のトリガーを削除
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'syncToGitHub') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // 新しいトリガーを作成（5分おきに実行）
  ScriptApp.newTrigger('syncToGitHub')
    .timeBased()
    .everyMinutes(CONFIG.SCAN_INTERVAL_MINUTES)
    .create();
  
  Logger.log(`トリガー設定完了: ${CONFIG.SCAN_INTERVAL_MINUTES}分ごとに syncToGitHub を実行`);
}