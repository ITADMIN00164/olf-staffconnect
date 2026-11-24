# POM API — image upload fix (Nov 2026)

The "POM API" Apps Script project is bound to the **Dashboard V2** sheet in the
award Drive folder. Award Management only uses it to store images in Drive.

## Install

1. Open **Dashboard V2 → Extensions → Apps Script**.
2. Click **+ → Script**, name it `Upload`, paste in `Upload.gs` from this folder.
3. In **Code.gs**, make two one-line edits:

   In `doPost`, change

   ```js
   return uploadImage(body);
   ```

   to

   ```js
   return uploadImageV2(body);
   ```

   In `doGet`, right after `const action = e.parameter.action;`, add

   ```js
   if (action === "findUpload") return findUpload(e);
   ```

4. **Save**, then **Deploy → Manage deployments → ✏ (edit) → Version: New version → Deploy**.
   Editing the existing deployment keeps the same /exec URL, so the app needs no change.
   (Do NOT use "New deployment" — that gives a new URL.)

## Check it worked

Open this in a browser (should answer `{"success":true,"found":false}`):

```
https://script.google.com/macros/s/AKfycbxTITLCE-CwfLLW9p5nwf7Tziy2xNj7oQtsctbVmG8C4toadIGq5x63qR4w17ZluZXt/exec?action=findUpload&month=NOV%202026&district=Ahilyanagar&name=test.png
```

Before the new version is deployed it answers "POM API Running" instead — the
page treats that as "no check available" and simply waits for the normal reply.

## Order

Either side can go first. The page only re-sends an upload when the script has
answered a findUpload check, so the old script can never receive a duplicate.
