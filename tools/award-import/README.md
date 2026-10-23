# Award records import

One-off move of the POM text data (Raw Data + Awarded Data sheets) into
`public.award_records`. Images stay in Google Drive; each row keeps its Drive link.

1. Run `sql/award-records-setup.sql` in the Supabase SQL editor.
2. `node build.cjs "Raw Data.xlsx" "Awarded Data.xlsx" out.json` - builds the rows and prints a report. Sends nothing.
3. `node upload.cjs out.json` - sends them. Refuses if the table already has rows.

`out.json` holds names and mobile numbers. Keep it out of the repository.
