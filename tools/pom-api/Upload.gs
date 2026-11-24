/* =============================================================================
   Upload.gs — award image upload, made safe against lost replies (Nov 2026)

   Add this as a NEW file in the "POM API" Apps Script project (the one bound to
   the "Dashboard V2" sheet), next to Code.gs. Then make two one-line edits in
   Code.gs (see README.md in this folder) and deploy a new version.

   Why: the script stores a photo in Drive in a few seconds, but on some
   browsers the reply never gets back to the page, so the row hangs on
   "Uploading…" and the user uploads again, leaving extra copies in Drive.
   The page now (1) asks "did my file arrive?" when a reply is late, and (2) may
   send the same upload a second time. These functions make both safe:

   • uploadImageV2  — an upload whose file name is already in the folder returns
                      that file instead of storing a second copy (safe to resend).
                    — stores the new picture FIRST, then trashes the old one, so
                      a failed upload never leaves a record pointing at a
                      deleted file.
                    — no per-file setSharing: files take the folder's sharing.
                    — remembers each MONTH/DISTRICT folder id (6 h cache) instead
                      of searching Drive on every upload.
   • findUpload     — GET ?action=findUpload&month=&district=&name=
                      answers { success, found, id, url }.

   Uses FOLDER_ID and jsonOut() from Code.gs. Nothing in Code.gs is removed;
   the old uploadImage / getOrCreateFolder simply stop being called.
   ============================================================================= */

function uploadImageV2(body) {
  try {
    if (!body.data) return jsonOut({ success: false, error: "No image data" });

    const fileName = String(body.fileName || ("img_" + Date.now()));
    const distDir  = getAwardFolder_(body.month, body.district, false);

    // Already here? Then this is a re-send of an upload whose reply got lost.
    let file = null;
    const same = distDir.getFilesByName(fileName);
    if (same.hasNext()) file = same.next();
    const reused = !!file;

    if (!file) {
      const bytes = Utilities.base64Decode(body.data);
      const blob  = Utilities.newBlob(bytes, body.mimeType || "image/jpeg", fileName);
      file = distDir.createFile(blob);
    }
    const id = file.getId();

    // Only now, with the new picture safely stored, remove the one it replaces.
    let deletedOld = false;
    let deleteError = "";
    if (body.replaceId && body.replaceId !== id) {
      try {
        DriveApp.getFileById(body.replaceId).setTrashed(true);
        deletedOld = true;
      } catch (delErr) {
        deleteError = String(delErr);
      }
    }

    return jsonOut({
      success: true,
      id: id,
      url: "https://drive.google.com/uc?export=view&id=" + id,
      deletedOld: deletedOld,
      deleteError: deleteError,
      reused: reused
    });
  } catch (err) {
    return jsonOut({ success: false, error: String(err) });
  }
}

// GET ?action=findUpload&month=NOV%202026&district=Ahilyanagar&name=<fileName>
// Read-only: never creates a folder or file.
function findUpload(e) {
  try {
    const p = (e && e.parameter) || {};
    const name = String(p.name || "");
    if (!name) return jsonOut({ success: false, error: "No name" });

    const dir = getAwardFolder_(p.month, p.district, true);
    if (!dir) return jsonOut({ success: true, found: false });

    const it = dir.getFilesByName(name);
    if (!it.hasNext()) return jsonOut({ success: true, found: false });

    const id = it.next().getId();
    return jsonOut({
      success: true,
      found: true,
      id: id,
      url: "https://drive.google.com/uc?export=view&id=" + id
    });
  } catch (err) {
    return jsonOut({ success: false, error: String(err) });
  }
}

// <FOLDER_ID>/<MONTH>/<DISTRICT>, the same layout as before.
// noCreate = true → return null when a folder is missing (used by findUpload).
function getAwardFolder_(month, district, noCreate) {
  const m = String(month || "UNSORTED");
  const d = String(district || "UNSORTED");
  const cache = CacheService.getScriptCache();
  const key = "awfold|" + m + "|" + d;

  const cachedId = cache.get(key);
  if (cachedId) {
    try {
      const f = DriveApp.getFolderById(cachedId);
      if (!f.isTrashed()) return f;
    } catch (ignore) { /* folder gone - look it up again below */ }
  }

  const root     = DriveApp.getFolderById(FOLDER_ID);
  const monthDir = awardChildFolder_(root, m, noCreate);
  if (!monthDir) return null;
  const distDir  = awardChildFolder_(monthDir, d, noCreate);
  if (!distDir) return null;

  cache.put(key, distDir.getId(), 21600);   // 6 hours
  return distDir;
}

// Find a sub-folder by name; create it only if missing. Creation is done under a
// short lock and re-checked inside it, so two first uploads for a new month or
// district at the same moment can't make two folders with the same name.
function awardChildFolder_(parent, name, noCreate) {
  const it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  if (noCreate) return null;

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error("Busy creating folder " + name + " - please try again");
  try {
    const again = parent.getFoldersByName(name);
    return again.hasNext() ? again.next() : parent.createFolder(name);
  } finally {
    lock.releaseLock();
  }
}
