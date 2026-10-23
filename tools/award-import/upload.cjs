/* Sends the rows from build.cjs to public.award_records.

     node upload.cjs out.json

   Refuses to run if the table already holds rows, so it cannot double a
   migration that has been done once. The key is the publishable one the page
   itself uses. */
const fs = require("fs");

const URL = "https://rpnxpkwcpsbxswnowuhx.supabase.co";
const KEY = "sb_publishable_60Ynb6EZ6Qc2GHrdqERwpw_dUdH3dKD";
const file = process.argv[2];
if (!file) { console.error("usage: node upload.cjs out.json"); process.exit(1); }

const rows = JSON.parse(fs.readFileSync(file, "utf8"));
const head = { apikey: KEY, Authorization: "Bearer " + KEY };

async function main() {
  const probe = await fetch(URL + "/rest/v1/award_records?select=id&limit=1", { headers: head });
  if (!probe.ok) {
    console.error("The table is not reachable (" + probe.status + "). Has sql/award-records-setup.sql been run?");
    console.error(await probe.text());
    process.exit(1);
  }
  if ((await probe.json()).length) {
    console.error("award_records already has rows. Not importing again.");
    process.exit(1);
  }

  const size = 400;
  let done = 0;
  for (let i = 0; i < rows.length; i += size) {
    const batch = rows.slice(i, i + size);
    const res = await fetch(URL + "/rest/v1/award_records", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json", Prefer: "return=minimal" }, head),
      body: JSON.stringify(batch)
    });
    if (!res.ok) {
      console.error("Batch starting at row " + i + " failed (" + res.status + "): " + await res.text());
      console.error(done + " rows were saved before it. Nothing is repeated on a rerun only if the table is cleared first.");
      process.exit(1);
    }
    done += batch.length;
    console.log(done + " / " + rows.length);
  }
  console.log("done");
}
main();
