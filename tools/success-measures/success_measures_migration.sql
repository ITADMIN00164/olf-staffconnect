-- Staff Connect V3 - SMART Goal Success Measures (v2, 26 Oct 2026)
-- 1) Adds the goals.success_measures column (run this BEFORE deploying the new smartgoal.js / sg-supabase.js).
-- 2) Pre-fills Success Measures + grading schema from OLF_OrgChart_13Oct2026 (incl. the IT Operations sub-chart) for 125 SMART Goals.
--    A row is only filled when it is still empty or still holds the v1 text from the first script,
--    so anything typed in the app is never overwritten. Safe to run more than once.
--    (v1 text is matched ignoring Windows line endings, which the SQL editor adds.)

alter table public.goals add column if not exists success_measures text default '';

begin;
-- Omkar Sinare · Data Insights  ←  Org Chart: Ensure reports are accurate, relevant, and regularly used for decision-making [High]
update public.goals set success_measures = $sm$> 95% LAR (Light and Right) score for internal and external monitoring reports.
Annexure A: A/B/C/D classification of reports reviewed monthly; spot-check 5% of critical report data with findings documented; track and rectify data issues per agreed SLA; management spot checks throw zero data issues.

Grading Schema — Annexure A — Light and Right Reports
Internal: Program Dashboards, Vinoba Disha, District Report, etc. External: Leaderboards, Teacher Feed, POM, Exams, Post score, etc.

# | Objective | Weightage
• 1 | A/B/C/D classification of reports completed and reviewed monthly. Unused or low-value reports identified and rationalised. | 10%
• 2 | Spot-check 5% of data for all critical reports with findings documented. | 10%
• 3 | Track data issues and get them rectified as per agreed SLA. | 5%
• 4 | Spot check by management — does not throw any data issues. | 5%$sm$
 where year = 'June 2026 - May 2027' and member = 'Omkar Sinare' and goal = 'Data Insights'
   and coalesce(success_measures,'') = '';
-- Omkar Sinare · Data Monitoring & Reporting  ←  Org Chart: Strengthen platform data quality and reliability [High]
update public.goals set success_measures = $sm$Periodic checks for data quality, reported quarterly.
Annexure B: Critical data (leaderboards, teacher feed, program dashboard, POM) tested at 5%; monthly/quarterly validation completed for all critical reports; data issues tracked and resolved within defined timelines.

Grading Schema — Annexure B — Platform Data Quality
# | Objective | Weightage
• 1 | Critical data (leaderboards, teacher feed, program dashboard, POM) tested at 5%. | 20%
• 2 | Monthly/quarterly validation completed for all critical reports. | 5%
• 3 | Data issues tracked and resolved within defined timelines. | 5%$sm$
 where year = 'June 2026 - May 2027' and member = 'Omkar Sinare' and goal = 'Data Monitoring & Reporting'
   and coalesce(success_measures,'') = '';
-- Omkar Sinare · Academic Reports  ←  Org Chart: Design and validate effective reporting and assessment systems [High]
update public.goals set success_measures = $sm$> 95% LAR (Light and Right) score for academic reports and forms.
Annexure C: Manage repository for academic and form reports; implement 2 small improvements monthly and 2 major changes quarterly; spot-check all reports before field distribution; design analysis structure for all new forms and OMRs before implementation.

Grading Schema — Annexure C — Light and Right Academic Reports and Forms
# | Objective | Weightage
• 1 | Manage repository for different types of academic and form reports in one place. Verify and implement 2 small improvements each month and 2 major changes each quarter. | 10%
• 2 | Spot-check all reports generated for new cycles before sending to field. | 5%
• 3 | Design reports and analysis structure for all new forms, OMRs, and reporting structures before implementation. | 10%$sm$
 where year = 'June 2026 - May 2027' and member = 'Omkar Sinare' and goal = 'Academic Reports'
   and coalesce(success_measures,'') = '';
-- Omkar Sinare · Team Work  ←  Org Chart: Self Development [High]
update public.goals set success_measures = $sm$Improve on 2 identified competencies.
Demonstrate application of learning in role execution.
Annexure D: Monthly plan finalised by 28th; weekly plan and actual by Friday EOD; review PPT with zero errors by 2nd EOD; 100% follow-up on action items.
Zero obvious mistakes and zero commitments missed each month.
One case study per month.

Grading Schema — Annexure D — Self Development
# | Objective | Target 26-27 | Weightage
▸ 1. Planning and Tracking
• a | Finalisation of monthly plan (next month) and actual (previous month) by 28th | 29th of every month (VP) | 5%
• b | Finalisation of weekly plan and actual — by Friday of week | Weekly, Friday EOD
• c | Review meeting by 3rd — updated HO PPT with zero errors | By 2nd EOD
• d | Follow-up on action items | 100%
▸ 2. No Ball Dropped
•  | Company policy followed | 100% compliance | 2.5%
•  | No obvious mistakes / high accuracy | Zero obvious mistakes each month
•  | No commitments missed | Zero commitments missed each month
• 3 | One case study each month | Per month | 2.5%
• 4 | Achieve Learning and Development goals | 1. Improve on 2 identified competencies. 2. Demonstrate application of learning in role execution. | 5%$sm$
 where year = 'June 2026 - May 2027' and member = 'Omkar Sinare' and goal = 'Team Work'
   and (coalesce(success_measures,'') = '' or replace(success_measures, chr(13), '') = $old$Improve on 2 identified competencies.
Demonstrate application of learning in role execution.
Annexure D: Monthly plan finalised by 28th; weekly plan and actual by Friday EOD; review PPT with zero errors by 2nd EOD; 100% follow-up on action items.
Zero obvious mistakes and zero commitments missed each month.
One case study per month.

Grading Schema — Annexure D — Self Development
# | Objective | Target 26-27 | Weightage
▸ 1. Planning and Tracking
• a | Finalisation of monthly plan (next month) and actual (previous month) by 28th | 29th of every month (VP) | 5%
• b | Finalisation of weekly plan and actual — by Friday of week | Weekly, Friday EOD
• c | Review meeting by 3rd — updated HO PPT with zero errors | By 2nd EOD
• d | Follow-up on action items | 100%
▸ 2. No Ball Dropped
• – | Company policy followed | 100% compliance | 2.5%
• – | No obvious mistakes / high accuracy | Zero obvious mistakes each month
• – | No commitments missed | Zero commitments missed each month
• 3 | One case study each month | Per month | 2.5%
• 4 | Achieve Learning and Development goals | 1. Improve on 2 identified competencies. 2. Demonstrate application of learning in role execution. | 5%$old$);
-- Akash Ghule · Data Insight  ←  Org Chart: Ensure reports are accurate, relevant, and regularly used for decision-making [Medium]
update public.goals set success_measures = $sm$> 95% LAR (Light and Right) score for internal and external monitoring reports.
Annexure A: A/B/C/D classification of reports reviewed monthly; spot-check 5% of critical report data with findings documented; track and rectify data issues per agreed SLA; management spot checks throw zero data issues.

Grading Schema — Annexure A — Light and Right Reports
Internal: Grading Tracker, Program Dashboards, Vinoba Disha, District Report, etc. External: Leaderboards, Teacher Feed, POM, Exams, Post score, etc.

# | Objective | Weightage
• 1 | A/B/C/D classification of reports completed and reviewed monthly. Unused or low-value reports identified and rationalised. | 10%
• 2 | Spot-check 5% of data for all critical reports with findings documented. | 10%
• 3 | Track data issues and get them rectified as per agreed SLA. | 5%
• 4 | Spot check by management — does not throw any data issues. | 5%$sm$
 where year = 'June 2026 - May 2027' and member = 'Akash Ghule' and goal = 'Data Insight'
   and coalesce(success_measures,'') = '';
-- Akash Ghule · Data Monitoring & Reporting  ←  Org Chart: Strengthen platform data quality and reliability [Medium]
update public.goals set success_measures = $sm$Periodic checks for data quality, reported quarterly.
Annexure B: Critical data (leaderboards, teacher feed, program dashboard, POM) tested at 5%; monthly/quarterly validation completed for all critical reports; data issues tracked and resolved within defined timelines.

Grading Schema — Annexure B — Platform Data Quality
# | Objective | Weightage
• 1 | Critical data (leaderboards, teacher feed, program dashboard, POM) tested at 5%. | 10%
• 2 | Monthly/quarterly validation completed for all critical reports. | 10%
• 3 | Data issues tracked and resolved within defined timelines. | 10%$sm$
 where year = 'June 2026 - May 2027' and member = 'Akash Ghule' and goal = 'Data Monitoring & Reporting'
   and coalesce(success_measures,'') = '';
-- Akash Ghule · Academic Reports  ←  Org Chart: Design and validate effective reporting and assessment systems [Medium]
update public.goals set success_measures = $sm$> 95% LAR (Light and Right) score for academic reports and forms.
Annexure C: Manage repository for academic and form reports; implement 2 small improvements monthly and 2 major changes quarterly; spot-check all reports before field distribution; design analysis structure for all new forms and OMRs before implementation.

Grading Schema — Annexure C — Light and Right Academic Reports and Forms
# | Objective | Weightage
• 1 | Manage repository for different types of academic and form reports in one place. Verify and implement 2 small improvements each month and 2 major changes each quarter. | 10%
• 2 | Spot-check all reports generated for new cycles before sending to field. | 10%
• 3 | Design reports and analysis structure for all new forms, OMRs, and reporting structures before implementation. | 5%$sm$
 where year = 'June 2026 - May 2027' and member = 'Akash Ghule' and goal = 'Academic Reports'
   and coalesce(success_measures,'') = '';
-- Akash Ghule · Team Work  ←  Org Chart: Self Development [Medium]
update public.goals set success_measures = $sm$Improve on 2 identified competencies.
Demonstrate application of learning in role execution.
Annexure D: Monthly plan finalised by 28th; weekly plan and actual by Friday EOD; review PPT with zero errors by 2nd EOD; 100% follow-up on action items.
Zero obvious mistakes and zero commitments missed each month.
One case study per month.

Grading Schema — Annexure D — Self Development
# | Objective | Target 26-27 | Weightage
▸ 1. Planning and Tracking
• a | Finalisation of monthly plan (next month) and actual (previous month) by 28th | 29th of every month (VP) | 5%
• b | Finalisation of weekly plan and actual — by Friday of week | Weekly, Friday EOD
• c | Review meeting by 3rd — updated HO PPT with zero errors | By 2nd EOD
• d | Follow-up on action items | 100%
▸ 2. No Ball Dropped
•  | Company policy followed | 100% compliance | 2.5%
•  | No obvious mistakes / high accuracy | Zero obvious mistakes each month
•  | No commitments missed | Zero commitments missed each month
• 3 | One case study each month | Per month | 2.5%
• 4 | Achieve Learning and Development goals | 1. Improve on 2 identified competencies. 2. Demonstrate application of learning in role execution. | 5%$sm$
 where year = 'June 2026 - May 2027' and member = 'Akash Ghule' and goal = 'Team Work'
   and (coalesce(success_measures,'') = '' or replace(success_measures, chr(13), '') = $old$Improve on 2 identified competencies.
Demonstrate application of learning in role execution.
Annexure D: Monthly plan finalised by 28th; weekly plan and actual by Friday EOD; review PPT with zero errors by 2nd EOD; 100% follow-up on action items.
Zero obvious mistakes and zero commitments missed each month.
One case study per month.

Grading Schema — Annexure D — Self Development
# | Objective | Target 26-27 | Weightage
▸ 1. Planning and Tracking
• a | Finalisation of monthly plan (next month) and actual (previous month) by 28th | 29th of every month (VP) | 5%
• b | Finalisation of weekly plan and actual — by Friday of week | Weekly, Friday EOD
• c | Review meeting by 3rd — updated HO PPT with zero errors | By 2nd EOD
• d | Follow-up on action items | 100%
▸ 2. No Ball Dropped
• – | Company policy followed | 100% compliance | 2.5%
• – | No obvious mistakes / high accuracy | Zero obvious mistakes each month
• – | No commitments missed | Zero commitments missed each month
• 3 | One case study each month | Per month | 2.5%
• 4 | Achieve Learning and Development goals | 1. Improve on 2 identified competencies. 2. Demonstrate application of learning in role execution. | 5%$old$);
-- Prashant Bhondve · Data Insight  ←  Org Chart: Ensure reports are accurate, relevant, and regularly used for decision-making [High]
update public.goals set success_measures = $sm$> 95% LAR (Light and Right) score for internal and external monitoring reports.
Annexure A: A/B/C/D classification of reports completed and reviewed monthly.
Spot-check 5% of data for all critical reports with findings documented.
Track data issues and rectify as per agreed SLA.
Spot check by management throws zero data issues.

Grading Schema — Annexure A — Light and Right Reports
Internal: Program Dashboards, Vinoba Disha, District Report, etc. External: Leaderboards, Teacher Feed, POM, Exams, Post score, etc.

# | Objective | Weightage
• 1 | A/B/C/D classification of reports completed and reviewed monthly. Unused or low-value reports identified and rationalised. | 10%
• 2 | Spot-check 5% of data for all critical reports with findings documented. | 10%
• 3 | Track data issues and get them rectified as per agreed SLA. | 10%
• 4 | Spot check by management — does not throw any data issues. | 10%$sm$
 where year = 'June 2026 - May 2027' and member = 'Prashant Bhondve' and goal = 'Data Insight'
   and coalesce(success_measures,'') = '';
-- Prashant Bhondve · Academic Reports Monitoring  ←  Org Chart: Design and validate effective reporting and assessment systems for academic programs [High]
update public.goals set success_measures = $sm$> 95% LAR (Light and Right) score for academic reports and forms.
Annexure B: Manage repository for academic and form reports; implement 2 small improvements monthly and 2 major changes quarterly.
Spot-check all reports generated for new cycles before sending to field.
Design reports and analysis structure for all new forms, OMRs, and reporting structures before implementation.

Grading Schema — Annexure B — Light and Right Academic Reports and Forms
# | Objective | Weightage
• 1 | Manage repository for different types of academic and form reports in one place. Verify and implement 2 small improvements each month and 2 major changes each quarter. | 10%
• 2 | Spot-check all reports generated for new cycles before sending to field. | 10%
• 3 | Design reports and analysis structure for all new forms, OMRs, and reporting structures before implementation — ensuring useful, accurate data analysis and usability. | 5%$sm$
 where year = 'June 2026 - May 2027' and member = 'Prashant Bhondve' and goal = 'Academic Reports Monitoring'
   and coalesce(success_measures,'') = '';
-- Prashant Bhondve · OLF Compliance  ←  Org Chart: Improve support function effectiveness and resource utilisation [Medium]
update public.goals set success_measures = $sm$> 90% score on HO Team Excellence.
Annexure C: Weekly/Monthly plan for HO teams; monthly efficiency reports; monthly review as per timelines; dashboard updated monthly.

Grading Schema — Annexure C — HO Team Excellence
# | Objective | Weightage
• 1 | Weekly/Monthly Plan for HO Teams | 10%
• 2 | Monthly Efficiency Reports | 5%
• 3 | Monthly Review as per Timelines | 5%
• 4 | Dashboard (Monthly) | 5%$sm$
 where year = 'June 2026 - May 2027' and member = 'Prashant Bhondve' and goal = 'OLF Compliance'
   and coalesce(success_measures,'') = '';
-- Prashant Bhondve · Team Management  ←  Org Chart: Self Development & Team Development [High]
update public.goals set success_measures = $sm$Improve on 2 identified competencies.
Demonstrate application of learning in role execution.
Annexure D: Finalise monthly plan and actual by 28th; weekly plan and actual by Friday EOD; review meeting PPT with zero errors by 2nd EOD; 100% follow-up on action items.
Zero obvious mistakes and zero commitments missed each month.
One case study per month.

Grading Schema — Annexure D — Self Development
# | Objective | Target 26-27 | Weightage
▸ 1. Planning and Tracking
• a | Finalisation of monthly plan (next month) and actual (previous month) by 28th | 29th of every month (VP) | 2.5%
• b | Finalisation of weekly plan and actual — by Friday of week | Weekly, Friday EOD
• c | Review meeting by 3rd — updated HO PPT with zero errors | By 2nd EOD
• d | Follow-up on action items | 100%
▸ 2. No Ball Dropped
•  | Company policy followed | 100% compliance | 2.5%
•  | No obvious mistakes / high accuracy | Zero obvious mistakes each month
•  | No commitments missed | Zero commitments missed each month
• 3 | One case study each month | Per month | 2.5%
• 4 | Achieve Learning and Development goals | 1. Improve on 2 identified competencies. 2. Demonstrate application of learning in role execution. | 2.5%$sm$
 where year = 'June 2026 - May 2027' and member = 'Prashant Bhondve' and goal = 'Team Management'
   and (coalesce(success_measures,'') = '' or replace(success_measures, chr(13), '') = $old$Improve on 2 identified competencies.
Demonstrate application of learning in role execution.
Annexure D: Finalise monthly plan and actual by 28th; weekly plan and actual by Friday EOD; review meeting PPT with zero errors by 2nd EOD; 100% follow-up on action items.
Zero obvious mistakes and zero commitments missed each month.
One case study per month.

Grading Schema — Annexure D — Self Development
# | Objective | Target 26-27 | Weightage
▸ 1. Planning and Tracking
• a | Finalisation of monthly plan (next month) and actual (previous month) by 28th | 29th of every month (VP) | 2.5%
• b | Finalisation of weekly plan and actual — by Friday of week | Weekly, Friday EOD
• c | Review meeting by 3rd — updated HO PPT with zero errors | By 2nd EOD
• d | Follow-up on action items | 100%
▸ 2. No Ball Dropped
• – | Company policy followed | 100% compliance | 2.5%
• – | No obvious mistakes / high accuracy | Zero obvious mistakes each month
• – | No commitments missed | Zero commitments missed each month
• 3 | One case study each month | Per month | 2.5%
• 4 | Achieve Learning and Development goals | 1. Improve on 2 identified competencies. 2. Demonstrate application of learning in role execution. | 2.5%$old$);
-- Rameshwar Walkikar · Curate Quality Content  ←  Org Chart: Curate Quality Content [High]
update public.goals set success_measures = $sm$Deliver high-quality, child-friendly content on time while ensuring accuracy and relevance.
95%+ on-time content delivery
Less than 2% quality errors in published content
Less than 5% content rework due to quality issues
100% review and approval process compliance

Grading Schema — Annexure 1 — SLA for High Quality Content
# | Category | Parameter | A | B | C | Measurement Method
• 1 | Content | Content Quality | 0 errors | 1–5 errors | More than 5 errors | Errors reported through audits and stakeholder feedback
• 2 | Stakeholder | Stakeholder Satisfaction Score | ≥ 7.5 | 6.0–7.4 | < 6.0 | Quarterly stakeholder survey

# | Category | Parameter | Fatal | Critical | Medium | Measurement Method
• 1 | Field | System Generated - Question Paper (Scholarship, JNV, NMMSE, Sainik School) | 2 Working Days | 3 Working Days | 5 Working Days | Request Date to Delivery Date
• 2 | Field | New Question Paper - (FLN, Pradnya Shodh) | 2 Working Days | 8 Working Days | 15 Working Days | Request Date to Delivery Date
• 3 | Field | Upload Question Paper After Examination | Same Day | 1 Working Day | 2 Working Days | Exam Date to Upload Date
• 4 | Field | Content Error Rectification | Same Day | 1 Working Day | 3 Working Days | Issue Report Date to Closure Date
• 5 | Life Skills | AI Pragati Morning Assembly Content | 3 Working Days | 5 Working Days | As per Monthly Plan | Request Date to Upload Date
• 6 | Life Skills | TLMs | 1 Working Day | 3 Working Days | As per Monthly Plan | Request Date to Upload Date
• 7 | Life Skills | Awareness Poster Creation | Same Day | 1 Working Day | 2 Working Days | Request Date to Delivery Date
• 8 | Life Skills | Subject / Chapter Creation for TLM | Same Day | 1 Working Day | 2 Working Days | Request Date to Delivery Date
• 9 | HO | Content Catalogue Update | Same Day | 1 Working Day | 2 Working Days | Request Date to Closure Date

Classification | Definition
• Fatal | Immediate district requirement, live event, exam, CEO/DC request, implementation at risk if delayed
• Critical | Required for implementation within current week
• Medium | Planned requirement with agreed timeline
• Minor | Can be included in monthly content plan and roadmap

Grading Schema — Annexure 2 — Monthly Activity Plan
# | Category / Goals | Particulars
• 2 | Curate Quality Content | Plan, Review and upload question papers on Vinoba App (JNV, Scholarship, NMMSE, FLN, Pradnya Shodh, Sainik School etc)
• 3 | Curate Quality Content | Curate and Upload TLM (Club Activities, Spelling Bee, Spoken English, Rachnatmak Lekhan etc)
• 4 | Curate Quality Content | Poster creation
• 5 | Curate Quality Content | Content Catalogue
• 6 | Curate Quality Content | Knowledge repository – Question Bank
• 7 | Curate Quality Content | Knowledge repository – Spelling Bee$sm$
 where year = 'June 2026 - May 2027' and member = 'Rameshwar Walkikar' and goal = 'Curate Quality Content'
   and coalesce(success_measures,'') = '';
-- Rameshwar Walkikar · Content Oragnisation  ←  Org Chart: Pragati AI Content Ecosystem [Medium]
update public.goals set success_measures = $sm$Build, organize, validate, and maintain content within Pragati AI to ensure discoverability, accessibility, and operational effectiveness.
100% newly published content catalogued and available through the defined Pragati AI structure
Monthly content audits completed
90%+ identified issues resolved within defined timelines

Grading Schema — Annexure 2 — Monthly Activity Plan
# | Category / Goals | Particulars
• 1 | Pragati AI Content Ecosystem | Plan, Review and upload of AI Pragati Morning Assembly Content
• 8 | Content Organisation | Subject / Chapter Creation for TLM
• 9 | Content Organisation | Conduct content audit
• 10 | Content Organisation | Rectify identified content issues$sm$
 where year = 'June 2026 - May 2027' and member = 'Rameshwar Walkikar' and goal = 'Content Oragnisation'
   and coalesce(success_measures,'') = '';
-- Rameshwar Walkikar · Increase Content Adoption  ←  Org Chart: Increase Content Adoption [High]
update public.goals set success_measures = $sm$Increase engagement and adoption of content across all categories on the Vinoba App.
30% increase in content adoption compared to baseline
Minimum 5 improvement actions implemented based on content usage insights, with at least one resulting in a measurable increase in adoption
At least 3 stakeholder-driven content enhancements resulting in measurable improvements

Grading Schema — Annexure 2 — Monthly Activity Plan
# | Category / Goals | Particulars
• 11 | Increase Content Adoption | Track and report monthly adoption numbers per content type
• 12 | Increase Content Adoption | Teacher Awareness of Vinoba App, AI Features, and Morning Assembly Content
• 13 | Increase Content Adoption | Achieve quarterly adoption growth milestones$sm$
 where year = 'June 2026 - May 2027' and member = 'Rameshwar Walkikar' and goal = 'Increase Content Adoption'
   and coalesce(success_measures,'') = '';
-- Rameshwar Walkikar · Team Management  ←  Org Chart: Team Management [High]
update public.goals set success_measures = $sm$Build a high-performing content team with strong ownership, continuous learning, collaboration, and process compliance.
Achievement of agreed team deliverables
Monthly team review and feedback sessions conducted
Minimum 1 learning and development initiative conducted per month$sm$
 where year = 'June 2026 - May 2027' and member = 'Rameshwar Walkikar' and goal = 'Team Management'
   and coalesce(success_measures,'') = '';
-- Bhimrao Suralkar · Curate Quality Content  ←  Org Chart: Curate Quality Content [High]
update public.goals set success_measures = $sm$Create, review, and upload high-quality, child-friendly content within defined timelines.
Deliver at least 95% of content within defined timelines
Maintain less than 2% quality errors in published content
Keep content rework due to quality issues below 5%
Ensure 100% compliance with review and approval processes

Grading Schema — Annexure 1 — SLA for High Quality Content
# | Category | Parameter | A | B | C | Measurement Method
• 1 | Content | Content Quality | 0 errors | 1–5 errors | More than 5 errors | Errors reported through audits and stakeholder feedback
• 2 | Stakeholder | Stakeholder Satisfaction Score | ≥ 7.5 | 6.0–7.4 | < 6.0 | Quarterly stakeholder survey

# | Category | Parameter | Fatal | Critical | Medium | Measurement Method
• 1 | Field | System Generated - Question Paper (Scholarship, JNV, NMMSE, Sainik School) | 2 Working Days | 3 Working Days | 5 Working Days | Request Date to Delivery Date
• 2 | Field | New Question Paper - (FLN, Pradnya Shodh) | 2 Working Days | 8 Working Days | 15 Working Days | Request Date to Delivery Date
• 3 | Field | Upload Question Paper After Examination | Same Day | 1 Working Day | 2 Working Days | Exam Date to Upload Date
• 4 | Field | Content Error Rectification | Same Day | 1 Working Day | 3 Working Days | Issue Report Date to Closure Date
• 5 | Life Skills | AI Pragati Morning Assembly Content | 3 Working Days | 5 Working Days | As per Monthly Plan | Request Date to Upload Date
• 6 | Life Skills | TLMs | 1 Working Day | 3 Working Days | As per Monthly Plan | Request Date to Upload Date
• 7 | Life Skills | Awareness Poster Creation | Same Day | 1 Working Day | 2 Working Days | Request Date to Delivery Date
• 8 | Life Skills | Subject / Chapter Creation for TLM | Same Day | 1 Working Day | 2 Working Days | Request Date to Delivery Date
• 9 | HO | Content Catalogue Update | Same Day | 1 Working Day | 2 Working Days | Request Date to Closure Date

Classification | Definition
• Fatal | Immediate district requirement, live event, exam, CEO/DC request, implementation at risk if delayed
• Critical | Required for implementation within current week
• Medium | Planned requirement with agreed timeline
• Minor | Can be included in monthly content plan and roadmap

Grading Schema — Annexure 2 — Monthly Activity Plan
# | Category / Goals | Particulars
• 2 | Curate Quality Content | Plan, Review and upload question papers on Vinoba App (JNV, Scholarship, NMMSE, FLN, Pradnya Shodh, Sainik School etc)
• 3 | Curate Quality Content | Curate and Upload TLM (Club Activities, Spelling Bee, Spoken English, Rachnatmak Lekhan etc)
• 4 | Curate Quality Content | Poster creation
• 5 | Curate Quality Content | Content Catalogue
• 6 | Curate Quality Content | Knowledge repository – Question Bank
• 7 | Curate Quality Content | Knowledge repository – Spelling Bee$sm$
 where year = 'June 2026 - May 2027' and member = 'Bhimrao Suralkar' and goal = 'Curate Quality Content'
   and coalesce(success_measures,'') = '';
-- Bhimrao Suralkar · Content Oragnisation  ←  Org Chart: Pragati AI Content Ecosystem [Medium]
update public.goals set success_measures = $sm$Curate, review, organize, and maintain high-quality content within Pragati AI while adhering to defined timelines.
Ensure 100% of newly published content is catalogued and accessible through the Pragati AI content structure
Complete monthly content audits as per schedule
Resolve 90%+ identified content issues within defined timelines

Grading Schema — Annexure 2 — Monthly Activity Plan
# | Category / Goals | Particulars
• 1 | Pragati AI Content Ecosystem | Plan, Review and upload of AI Pragati Morning Assembly Content
• 8 | Content Organisation | Subject / Chapter Creation for TLM
• 9 | Content Organisation | Conduct content audit
• 10 | Content Organisation | Rectify identified content issues$sm$
 where year = 'June 2026 - May 2027' and member = 'Bhimrao Suralkar' and goal = 'Content Oragnisation'
   and coalesce(success_measures,'') = '';
-- Bhimrao Suralkar · Increase Content Adoption  ←  Org Chart: Increase Content Adoption [High]
update public.goals set success_measures = $sm$Increase the usage and adoption of Question Papers content on the Vinoba App.
Achieve 30% growth in Question Papers content usage/adoption compared to the previous year
Implement at least 2 content improvements based on usage insights and feedback

Grading Schema — Annexure 2 — Monthly Activity Plan
# | Category / Goals | Particulars
• 11 | Increase Content Adoption | Track and report monthly adoption numbers per content type
• 12 | Increase Content Adoption | Teacher Awareness of Vinoba App, AI Features, and Morning Assembly Content
• 13 | Increase Content Adoption | Achieve quarterly adoption growth milestones$sm$
 where year = 'June 2026 - May 2027' and member = 'Bhimrao Suralkar' and goal = 'Increase Content Adoption'
   and coalesce(success_measures,'') = '';
-- Bhimrao Suralkar · Team  ←  Org Chart: Team Management [High]
update public.goals set success_measures = $sm$Display of high level of ownership; continuous learning ensuring 100% compliance on Processes and Timelines.
Monthly team review and feedback sessions conducted to provide better support to the manager
Minimum 1 learning and development initiative conducted per month to support the team's growth$sm$
 where year = 'June 2026 - May 2027' and member = 'Bhimrao Suralkar' and goal = 'Team'
   and coalesce(success_measures,'') = '';
-- Bhushan Rathod · Curate Quality Content  ←  Org Chart: Curate Quality Content [High]
update public.goals set success_measures = $sm$Create, review, and upload high-quality, child-friendly content within defined timelines.
100% SLA adherence
Less than 2% quality errors
100% alignment with content quality standards

Grading Schema — Annexure 1 — SLA for High Quality Content
# | Category | Parameter | A | B | C | Measurement Method
• 1 | Content | Content Quality | 0 errors | 1–5 errors | More than 5 errors | Errors reported through audits and stakeholder feedback
• 2 | Stakeholder | Stakeholder Satisfaction Score | ≥ 7.5 | 6.0–7.4 | < 6.0 | Quarterly stakeholder survey

# | Category | Parameter | Fatal | Critical | Medium | Measurement Method
• 1 | Field | System Generated - Question Paper (Scholarship, JNV, NMMSE, Sainik School) | 2 Working Days | 3 Working Days | 5 Working Days | Request Date to Delivery Date
• 2 | Field | New Question Paper - (FLN, Pradnya Shodh) | 2 Working Days | 8 Working Days | 15 Working Days | Request Date to Delivery Date
• 3 | Field | Upload Question Paper After Examination | Same Day | 1 Working Day | 2 Working Days | Exam Date to Upload Date
• 4 | Field | Content Error Rectification | Same Day | 1 Working Day | 3 Working Days | Issue Report Date to Closure Date
• 5 | Life Skills | AI Pragati Morning Assembly Content | 3 Working Days | 5 Working Days | As per Monthly Plan | Request Date to Upload Date
• 6 | Life Skills | TLMs | 1 Working Day | 3 Working Days | As per Monthly Plan | Request Date to Upload Date
• 7 | Life Skills | Awareness Poster Creation | Same Day | 1 Working Day | 2 Working Days | Request Date to Delivery Date
• 8 | Life Skills | Subject / Chapter Creation for TLM | Same Day | 1 Working Day | 2 Working Days | Request Date to Delivery Date
• 9 | HO | Content Catalogue Update | Same Day | 1 Working Day | 2 Working Days | Request Date to Closure Date

Classification | Definition
• Fatal | Immediate district requirement, live event, exam, CEO/DC request, implementation at risk if delayed
• Critical | Required for implementation within current week
• Medium | Planned requirement with agreed timeline
• Minor | Can be included in monthly content plan and roadmap

Grading Schema — Annexure 2 — Monthly Activity Plan
# | Category / Goals | Particulars
• 2 | Curate Quality Content | Plan, Review and upload question papers on Vinoba App (JNV, Scholarship, NMMSE, FLN, Pradnya Shodh, Sainik School etc)
• 3 | Curate Quality Content | Curate and Upload TLM (Club Activities, Spelling Bee, Spoken English, Rachnatmak Lekhan etc)
• 4 | Curate Quality Content | Poster creation
• 5 | Curate Quality Content | Content Catalogue
• 6 | Curate Quality Content | Knowledge repository – Question Bank
• 7 | Curate Quality Content | Knowledge repository – Spelling Bee$sm$
 where year = 'June 2026 - May 2027' and member = 'Bhushan Rathod' and goal = 'Curate Quality Content'
   and coalesce(success_measures,'') = '';
-- Bhushan Rathod · Content Oragnisation  ←  Org Chart: Pragati AI Content Ecosystem [Medium]
update public.goals set success_measures = $sm$Curate, review, organize, and maintain high-quality content within Pragati AI while adhering to defined timelines.
100% SLA adherence
Less than 2% quality errors
100% alignment with content quality standards

Grading Schema — Annexure 2 — Monthly Activity Plan
# | Category / Goals | Particulars
• 1 | Pragati AI Content Ecosystem | Plan, Review and upload of AI Pragati Morning Assembly Content
• 8 | Content Organisation | Subject / Chapter Creation for TLM
• 9 | Content Organisation | Conduct content audit
• 10 | Content Organisation | Rectify identified content issues$sm$
 where year = 'June 2026 - May 2027' and member = 'Bhushan Rathod' and goal = 'Content Oragnisation'
   and coalesce(success_measures,'') = '';
-- Bhushan Rathod · Increase Content Adoption  ←  Org Chart: Increase Content Adoption [High]
update public.goals set success_measures = $sm$Increase the usage and adoption of TLM content on the Vinoba App.
Achieve 30% growth in TLM content usage/adoption compared to the previous year
Implement at least 2 content improvements based on usage insights and feedback

Grading Schema — Annexure 2 — Monthly Activity Plan
# | Category / Goals | Particulars
• 11 | Increase Content Adoption | Track and report monthly adoption numbers per content type
• 12 | Increase Content Adoption | Teacher Awareness of Vinoba App, AI Features, and Morning Assembly Content
• 13 | Increase Content Adoption | Achieve quarterly adoption growth milestones$sm$
 where year = 'June 2026 - May 2027' and member = 'Bhushan Rathod' and goal = 'Increase Content Adoption'
   and coalesce(success_measures,'') = '';
-- Bhushan Rathod · Team Work  ←  Org Chart: Team [High]
update public.goals set success_measures = $sm$Demonstrate ownership, continuous learning, and adherence to organizational processes and timelines.
High ownership and 100% adherence to organizational processes and timelines$sm$
 where year = 'June 2026 - May 2027' and member = 'Bhushan Rathod' and goal = 'Team Work'
   and coalesce(success_measures,'') = '';
-- Nikita Patre · Curate Quality Content  ←  Org Chart: Curate Quality Content [High]
update public.goals set success_measures = $sm$Create, review, and upload high-quality, child-friendly content within defined timelines.
100% SLA adherence
Less than 2% quality errors
100% alignment with content quality standards

Grading Schema — Annexure 1 — SLA for High Quality Content
# | Category | Parameter | A | B | C | Measurement Method
• 1 | Content | Content Quality | 0 errors | 1–5 errors | More than 5 errors | Errors reported through audits and stakeholder feedback
• 2 | Stakeholder | Stakeholder Satisfaction Score | ≥ 7.5 | 6.0–7.4 | < 6.0 | Quarterly stakeholder survey

# | Category | Parameter | Fatal | Critical | Medium | Measurement Method
• 1 | Field | System Generated - Question Paper (Scholarship, JNV, NMMSE, Sainik School) | 2 Working Days | 3 Working Days | 5 Working Days | Request Date to Delivery Date
• 2 | Field | New Question Paper - (FLN, Pradnya Shodh) | 2 Working Days | 8 Working Days | 15 Working Days | Request Date to Delivery Date
• 3 | Field | Upload Question Paper After Examination | Same Day | 1 Working Day | 2 Working Days | Exam Date to Upload Date
• 4 | Field | Content Error Rectification | Same Day | 1 Working Day | 3 Working Days | Issue Report Date to Closure Date
• 5 | Life Skills | AI Pragati Morning Assembly Content | 3 Working Days | 5 Working Days | As per Monthly Plan | Request Date to Upload Date
• 6 | Life Skills | TLMs | 1 Working Day | 3 Working Days | As per Monthly Plan | Request Date to Upload Date
• 7 | Life Skills | Awareness Poster Creation | Same Day | 1 Working Day | 2 Working Days | Request Date to Delivery Date
• 8 | Life Skills | Subject / Chapter Creation for TLM | Same Day | 1 Working Day | 2 Working Days | Request Date to Delivery Date
• 9 | HO | Content Catalogue Update | Same Day | 1 Working Day | 2 Working Days | Request Date to Closure Date

Classification | Definition
• Fatal | Immediate district requirement, live event, exam, CEO/DC request, implementation at risk if delayed
• Critical | Required for implementation within current week
• Medium | Planned requirement with agreed timeline
• Minor | Can be included in monthly content plan and roadmap

Grading Schema — Annexure 2 — Monthly Activity Plan
# | Category / Goals | Particulars
• 2 | Curate Quality Content | Plan, Review and upload question papers on Vinoba App (JNV, Scholarship, NMMSE, FLN, Pradnya Shodh, Sainik School etc)
• 3 | Curate Quality Content | Curate and Upload TLM (Club Activities, Spelling Bee, Spoken English, Rachnatmak Lekhan etc)
• 4 | Curate Quality Content | Poster creation
• 5 | Curate Quality Content | Content Catalogue
• 6 | Curate Quality Content | Knowledge repository – Question Bank
• 7 | Curate Quality Content | Knowledge repository – Spelling Bee$sm$
 where year = 'June 2026 - May 2027' and member = 'Nikita Patre' and goal = 'Curate Quality Content'
   and coalesce(success_measures,'') = '';
-- Nikita Patre · Content Organisation  ←  Org Chart: Pragati AI Content Ecosystem [Medium]
update public.goals set success_measures = $sm$Curate, review, organize, and maintain high-quality content within Pragati AI while adhering to defined timelines.
100% SLA adherence
Less than 2% quality errors
100% alignment with content quality standards

Grading Schema — Annexure 2 — Monthly Activity Plan
# | Category / Goals | Particulars
• 1 | Pragati AI Content Ecosystem | Plan, Review and upload of AI Pragati Morning Assembly Content
• 8 | Content Organisation | Subject / Chapter Creation for TLM
• 9 | Content Organisation | Conduct content audit
• 10 | Content Organisation | Rectify identified content issues$sm$
 where year = 'June 2026 - May 2027' and member = 'Nikita Patre' and goal = 'Content Organisation'
   and coalesce(success_measures,'') = '';
-- Nikita Patre · Increase Content Adoption  ←  Org Chart: Increase Content Adoption [High]
update public.goals set success_measures = $sm$Increase the usage and adoption of Morning Assembly content on the Vinoba App.
Achieve 30% growth in Morning Assembly content usage/adoption compared to the previous year
Implement at least 2 content improvements based on usage insights and feedback

Grading Schema — Annexure 2 — Monthly Activity Plan
# | Category / Goals | Particulars
• 11 | Increase Content Adoption | Track and report monthly adoption numbers per content type
• 12 | Increase Content Adoption | Teacher Awareness of Vinoba App, AI Features, and Morning Assembly Content
• 13 | Increase Content Adoption | Achieve quarterly adoption growth milestones$sm$
 where year = 'June 2026 - May 2027' and member = 'Nikita Patre' and goal = 'Increase Content Adoption'
   and coalesce(success_measures,'') = '';
-- Nikita Patre · Team Work  ←  Org Chart: Team [High]
update public.goals set success_measures = $sm$Demonstrate ownership, continuous learning, and adherence to organizational processes and timelines.
High ownership and 100% adherence to organizational processes and timelines$sm$
 where year = 'June 2026 - May 2027' and member = 'Nikita Patre' and goal = 'Team Work'
   and coalesce(success_measures,'') = '';
-- Sakshi Latale · Curate Quality Content  ←  Org Chart: Curate Quality Content [High]
update public.goals set success_measures = $sm$Create, review, and upload high-quality, child-friendly content within defined timelines.
100% SLA adherence
Less than 2% quality errors
100% alignment with content quality standards

Grading Schema — Annexure 1 — SLA for High Quality Content
# | Category | Parameter | A | B | C | Measurement Method
• 1 | Content | Content Quality | 0 errors | 1–5 errors | More than 5 errors | Errors reported through audits and stakeholder feedback
• 2 | Stakeholder | Stakeholder Satisfaction Score | ≥ 7.5 | 6.0–7.4 | < 6.0 | Quarterly stakeholder survey

# | Category | Parameter | Fatal | Critical | Medium | Measurement Method
• 1 | Field | System Generated - Question Paper (Scholarship, JNV, NMMSE, Sainik School) | 2 Working Days | 3 Working Days | 5 Working Days | Request Date to Delivery Date
• 2 | Field | New Question Paper - (FLN, Pradnya Shodh) | 2 Working Days | 8 Working Days | 15 Working Days | Request Date to Delivery Date
• 3 | Field | Upload Question Paper After Examination | Same Day | 1 Working Day | 2 Working Days | Exam Date to Upload Date
• 4 | Field | Content Error Rectification | Same Day | 1 Working Day | 3 Working Days | Issue Report Date to Closure Date
• 5 | Life Skills | AI Pragati Morning Assembly Content | 3 Working Days | 5 Working Days | As per Monthly Plan | Request Date to Upload Date
• 6 | Life Skills | TLMs | 1 Working Day | 3 Working Days | As per Monthly Plan | Request Date to Upload Date
• 7 | Life Skills | Awareness Poster Creation | Same Day | 1 Working Day | 2 Working Days | Request Date to Delivery Date
• 8 | Life Skills | Subject / Chapter Creation for TLM | Same Day | 1 Working Day | 2 Working Days | Request Date to Delivery Date
• 9 | HO | Content Catalogue Update | Same Day | 1 Working Day | 2 Working Days | Request Date to Closure Date

Classification | Definition
• Fatal | Immediate district requirement, live event, exam, CEO/DC request, implementation at risk if delayed
• Critical | Required for implementation within current week
• Medium | Planned requirement with agreed timeline
• Minor | Can be included in monthly content plan and roadmap

Grading Schema — Annexure 2 — Monthly Activity Plan
# | Category / Goals | Particulars
• 2 | Curate Quality Content | Plan, Review and upload question papers on Vinoba App (JNV, Scholarship, NMMSE, FLN, Pradnya Shodh, Sainik School etc)
• 3 | Curate Quality Content | Curate and Upload TLM (Club Activities, Spelling Bee, Spoken English, Rachnatmak Lekhan etc)
• 4 | Curate Quality Content | Poster creation
• 5 | Curate Quality Content | Content Catalogue
• 6 | Curate Quality Content | Knowledge repository – Question Bank
• 7 | Curate Quality Content | Knowledge repository – Spelling Bee$sm$
 where year = 'June 2026 - May 2027' and member = 'Sakshi Latale' and goal = 'Curate Quality Content'
   and coalesce(success_measures,'') = '';
-- Sakshi Latale · Content Organisation  ←  Org Chart: Pragati AI Content Ecosystem [Medium]
update public.goals set success_measures = $sm$Curate, review, organize, and maintain high-quality content within Pragati AI while adhering to defined timelines.
100% SLA adherence
Less than 2% quality errors
100% alignment with content quality standards

Grading Schema — Annexure 2 — Monthly Activity Plan
# | Category / Goals | Particulars
• 1 | Pragati AI Content Ecosystem | Plan, Review and upload of AI Pragati Morning Assembly Content
• 8 | Content Organisation | Subject / Chapter Creation for TLM
• 9 | Content Organisation | Conduct content audit
• 10 | Content Organisation | Rectify identified content issues$sm$
 where year = 'June 2026 - May 2027' and member = 'Sakshi Latale' and goal = 'Content Organisation'
   and coalesce(success_measures,'') = '';
-- Sakshi Latale · Increase Content Adoption  ←  Org Chart: Increase Content Adoption [High]
update public.goals set success_measures = $sm$Increase the usage and adoption of Morning Assembly content on the Vinoba App.
Achieve 30% growth in Morning Assembly content usage/adoption compared to the previous year
Implement at least 2 content improvements based on usage insights and feedback

Grading Schema — Annexure 2 — Monthly Activity Plan
# | Category / Goals | Particulars
• 11 | Increase Content Adoption | Track and report monthly adoption numbers per content type
• 12 | Increase Content Adoption | Teacher Awareness of Vinoba App, AI Features, and Morning Assembly Content
• 13 | Increase Content Adoption | Achieve quarterly adoption growth milestones$sm$
 where year = 'June 2026 - May 2027' and member = 'Sakshi Latale' and goal = 'Increase Content Adoption'
   and coalesce(success_measures,'') = '';
-- Sakshi Latale · Team Work  ←  Org Chart: Team [High]
update public.goals set success_measures = $sm$Demonstrate ownership, continuous learning, and adherence to organizational processes and timelines.
High ownership and 100% adherence to organizational processes and timelines$sm$
 where year = 'June 2026 - May 2027' and member = 'Sakshi Latale' and goal = 'Team Work'
   and coalesce(success_measures,'') = '';
-- Vaidehi Shhalu · Post Curation  ←  Org Chart: Curation & Teacher Recognition — recognize and amplify effective teaching practices through high-quality content curation. [Medium]
update public.goals set success_measures = $sm$Teacher recognition and curation framework institutionalized across relevant programs.
≥95% quality compliance in evaluation, validation, and recognition processes.
High-quality teaching practices consistently identified, recognized, and amplified across districts to promote peer learning.
Increase teacher participation by raising expert coupon usage to 40%.
12 AI feedback reviews completed and improvement recommendations acted upon.

Grading Schema — Annexure 1 — Curation
# | Activity | Standard
• 1 | Posts evaluated as per set guidelines | Evaluate last week's posts by Friday
• 2 | Ensure best posts are curated and marked as Featured Posts | 5% or 50 per district per month, whichever is lower
• 3 | Ensure Post of the Month and Spardha awards are released on time | Spardha Awards — 2nd working day of month (for last month); PoM Awards — 3rd working day of month (for last month)
• 4 | Timely release of posters | Posters for all districts by the 5th working day of the month$sm$
 where year = 'June 2026 - May 2027' and member = 'Vaidehi Shhalu' and goal = 'Post Curation'
   and coalesce(success_measures,'') = '';
-- Vaidehi Shhalu · Acharyakul  ←  Org Chart: Acharyakul & Teacher Community — strengthen Vinoba Acharyakul as a high-value teacher learning and leadership community. [High]
update public.goals set success_measures = $sm$Acharyakul established as an active teacher learning and leadership community across participating districts.
Teacher insights regularly captured and contributing to at least 10 program, product, or teacher-support improvements.
Teacher engagement and participation in community-led initiatives show sustained growth during the year.
180+ teacher interactions conducted annually and insights shared monthly.

Grading Schema — Annexure 3 — Vinoba Acharyakul
▸ Rollout plan

# | Activity | Timeline
• 1 | Make a plan on activities and how "Vinoba Acharyakul" will work and benefit teachers | Q1
• 2 | Pilot in 2 districts | Q2–Q3
• 3 | Learning and working paper | Q4

▸ Broad design of Vinoba Acharyakul

• 1 | Have 50 clubs at block, cluster, and district level in a district/block
• 2 | Have 3 meetings in each of the clubs
• 3 | Have teachers contribute to local & central initiatives (paper setting, managing Sikshan Utsav, etc.)
• 4 | Define what teachers can do at the cluster level
• 5 | Define what teachers can do at the block level
• 6 | Define what teachers can do at the district level$sm$
 where year = 'June 2026 - May 2027' and member = 'Vaidehi Shhalu' and goal = 'Acharyakul'
   and (coalesce(success_measures,'') = '' or replace(success_measures, chr(13), '') = $old$Acharyakul established as an active teacher learning and leadership community across participating districts.
Teacher insights regularly captured and contributing to at least 10 program, product, or teacher-support improvements.
Teacher engagement and participation in community-led initiatives show sustained growth during the year.
180+ teacher interactions conducted annually and insights shared monthly.

Grading Schema — Annexure 3 — Vinoba Acharyakul
Rollout plan

# | Activity | Timeline
• 1 | Make a plan on activities and how "Vinoba Acharyakul" will work and benefit teachers | Q1
• 2 | Pilot in 2 districts | Q2–Q3
• 3 | Learning and working paper | Q4
Broad design of Vinoba Acharyakul
• 1 | Have 50 clubs at block, cluster, and district level in a district/block
• 2 | Have 3 meetings in each of the clubs
• 3 | Have teachers contribute to local & central initiatives (paper setting, managing Sikshan Utsav, etc.)
• 4 | Define what teachers can do at the cluster level
• 5 | Define what teachers can do at the block level
• 6 | Define what teachers can do at the district level$old$);
-- Vaidehi Shhalu · Curation Hygiene  ←  Org Chart: Curation Hygiene — ensure accurate documentation and curation hygiene. [High]
update public.goals set success_measures = $sm$Circulars, GRs, and educational resources consistently organized, updated, and accessible.
Repository accuracy maintained at ≥98%.
Knowledge resources remain searchable, relevant, and actively utilized by teachers and field teams.

Grading Schema — Annexure 2 — Maintaining Curation Hygiene
# | Activity | Standard
• 1 | GR uploads and tagging | Within 2 days of receipt
• 2 | Newspaper article tracking | Within 2 days of receipt
• 3 | Felicitation records | Within a week
• 4 | Award declaration rules followed properly | —$sm$
 where year = 'June 2026 - May 2027' and member = 'Vaidehi Shhalu' and goal = 'Curation Hygiene'
   and coalesce(success_measures,'') = '';
-- Vaidehi Shhalu · Team management  ←  Org Chart: Team Development & Self Development — build a high-performing and independent team. [High]
update public.goals set success_measures = $sm$Team operates at approved capacity with clear ownership and accountability.
≥90% of team members achieve role proficiency and independent operation.
Team consistently meets agreed quality and service standards.
Stakeholders report high levels of responsiveness, collaboration, and ownership from the team.$sm$
 where year = 'June 2026 - May 2027' and member = 'Vaidehi Shhalu' and goal = 'Team management'
   and coalesce(success_measures,'') = '';
-- Sadhna Ladiya · Post Curation  ←  Org Chart: Curation & Teacher Recognition — complete curation and teacher recognition work with good quality. [Medium]
update public.goals set success_measures = $sm$Complete evaluations and validations on time while maintaining high-quality standards.
Identify and submit deserving teacher practices for recognition and continuously improve work based on feedback.

Grading Schema — Annexure 1 — Curation
# | Activity | Standard
• 1 | Posts evaluated as per set guidelines | Evaluate last week's posts by Friday
• 2 | Ensure best posts are curated and marked as Featured Posts | 5% or 50 per district per month, whichever is lower
• 3 | Ensure Post of the Month and Spardha awards are released on time | Spardha Awards — 2nd working day of month (for last month); PoM Awards — 3rd working day of month (for last month)
• 4 | Timely release of posters | Posters for all districts by the 5th working day of the month$sm$
 where year = 'June 2026 - May 2027' and member = 'Sadhna Ladiya' and goal = 'Post Curation'
   and coalesce(success_measures,'') = '';
-- Sadhna Ladiya · Acharyakul  ←  Org Chart: Teacher Engagement — increase teacher participation in curation and expert coupons. [Medium]
update public.goals set success_measures = $sm$Connect and regularly communicate with at least 50 teachers during the year.
Support teachers in submitting their practices and encourage them to use expert coupons.

Grading Schema — Annexure 2 — Teacher Engagement
# | Activity | Standard
• 1 | Expert Teachers vote — promote in each district | 40% of the coupons used per district$sm$
 where year = 'June 2026 - May 2027' and member = 'Sadhna Ladiya' and goal = 'Acharyakul'
   and coalesce(success_measures,'') = '';
-- Sadhna Ladiya · Curation Hygiene  ←  Org Chart: Documentation Management — keep all records and documents updated and organized. [Medium]
update public.goals set success_measures = $sm$Update circulars, records, and resources on time.
Keep all documents accurate, organized, and easy to access.

Grading Schema — Annexure 3 — Maintaining Curation Hygiene
# | Activity | Standard
• 1 | GR uploads and tagging | Within 2 days of receipt
• 2 | Newspaper article tracking | Within 2 days of receipt
• 3 | Felicitation records | Within a week
• 4 | Award declaration rules followed properly | —
• 5 | Create explanatory Post / Video for key GRs / Prapatras | 1 GR / Prapatra per quarter
• 6 | Share insights of key GRs that can convert into programs | 1 GR / Prapatra per quarter$sm$
 where year = 'June 2026 - May 2027' and member = 'Sadhna Ladiya' and goal = 'Curation Hygiene'
   and coalesce(success_measures,'') = '';
-- Sadhna Ladiya · Team  ←  Org Chart: Self Development & Ownership — improve skills and handle responsibilities independently. [Medium]
update public.goals set success_measures = $sm$Learn all required processes and complete assigned work on time.
Work independently and suggest at least 2 ideas to improve work quality or processes.$sm$
 where year = 'June 2026 - May 2027' and member = 'Sadhna Ladiya' and goal = 'Team'
   and coalesce(success_measures,'') = '';
-- Yuvraj Mane · Post Curation  ←  Org Chart: Curation & Teacher Recognition — complete curation and teacher recognition work with good quality. [Medium]
update public.goals set success_measures = $sm$Complete evaluations and validations on time while maintaining high-quality standards.
Identify and submit deserving teacher practices for recognition and continuously improve work based on feedback.

Grading Schema — Annexure 1 — Curation
# | Activity | Standard
• 1 | Posts evaluated as per set guidelines | Evaluate last week's posts by Friday
• 2 | Ensure best posts are curated and marked as Featured Posts | 5% or 50 per district per month, whichever is lower
• 3 | Ensure Post of the Month and Spardha awards are released on time | Spardha Awards — 2nd working day of month (for last month); PoM Awards — 3rd working day of month (for last month)
• 4 | Timely release of posters | Posters for all districts by the 5th working day of the month$sm$
 where year = 'June 2026 - May 2027' and member = 'Yuvraj Mane' and goal = 'Post Curation'
   and coalesce(success_measures,'') = '';
-- Yuvraj Mane · Acharyakul  ←  Org Chart: Teacher Engagement — increase teacher participation in curation and expert coupons. [Medium]
update public.goals set success_measures = $sm$Connect and regularly communicate with at least 50 teachers during the year.
Support teachers in submitting their practices and encourage them to use expert coupons.

Grading Schema — Annexure 2 — Teacher Engagement
# | Activity | Standard
• 1 | Expert Teachers vote — promote in each district | 40% of the coupons used per district$sm$
 where year = 'June 2026 - May 2027' and member = 'Yuvraj Mane' and goal = 'Acharyakul'
   and coalesce(success_measures,'') = '';
-- Yuvraj Mane · Curation Hygiene  ←  Org Chart: Documentation Management — keep all records and documents updated and organized. [Medium]
update public.goals set success_measures = $sm$Update circulars, records, and resources on time.
Keep all documents accurate, organized, and easy to access.

Grading Schema — Annexure 3 — Maintaining Curation Hygiene
# | Activity | Standard
• 1 | GR uploads and tagging | Within 2 days of receipt
• 2 | Newspaper article tracking | Within 2 days of receipt
• 3 | Felicitation records | Within a week
• 4 | Award declaration rules followed properly | —
• 5 | Create explanatory Post / Video for key GRs / Prapatras | 1 GR / Prapatra per quarter
• 6 | Share insights of key GRs that can convert into programs | 1 GR / Prapatra per quarter$sm$
 where year = 'June 2026 - May 2027' and member = 'Yuvraj Mane' and goal = 'Curation Hygiene'
   and coalesce(success_measures,'') = '';
-- Yuvraj Mane · Team  ←  Org Chart: Self Development & Ownership — improve skills and handle responsibilities independently. [Medium]
update public.goals set success_measures = $sm$Learn all required processes and complete assigned work on time.
Work independently and suggest at least 2 ideas to improve work quality or processes.$sm$
 where year = 'June 2026 - May 2027' and member = 'Yuvraj Mane' and goal = 'Team'
   and coalesce(success_measures,'') = '';
-- Rushikesh Shelar · Post Curation  ←  Org Chart: Curation & Teacher Recognition — complete curation and teacher recognition work with good quality. [Medium]
update public.goals set success_measures = $sm$Complete evaluations and validations on time while maintaining high-quality standards.
Identify and submit deserving teacher practices for recognition and continuously improve work based on feedback.

Grading Schema — Annexure 1 — Curation
# | Activity | Standard
• 1 | Posts evaluated as per set guidelines | Evaluate last week's posts by Friday
• 2 | Ensure best posts are curated and marked as Featured Posts | 5% or 50 per district per month, whichever is lower
• 3 | Ensure Post of the Month and Spardha awards are released on time | Spardha Awards — 2nd working day of month (for last month); PoM Awards — 3rd working day of month (for last month)
• 4 | Timely release of posters | Posters for all districts by the 5th working day of the month$sm$
 where year = 'June 2026 - May 2027' and member = 'Rushikesh Shelar' and goal = 'Post Curation'
   and coalesce(success_measures,'') = '';
-- Rushikesh Shelar · Acharyakul  ←  Org Chart: Teacher Engagement — increase teacher participation in curation and expert coupons. [Medium]
update public.goals set success_measures = $sm$Connect and regularly communicate with at least 50 teachers during the year.
Support teachers in submitting their practices and encourage them to use expert coupons.

Grading Schema — Annexure 2 — Teacher Engagement
# | Activity | Standard
• 1 | Expert Teachers vote — promote in each district | 40% of the coupons used per district$sm$
 where year = 'June 2026 - May 2027' and member = 'Rushikesh Shelar' and goal = 'Acharyakul'
   and coalesce(success_measures,'') = '';
-- Rushikesh Shelar · Curation Hygiene  ←  Org Chart: Documentation Management — keep all records and documents updated and organized. [Medium]
update public.goals set success_measures = $sm$Update circulars, records, and resources on time.
Keep all documents accurate, organized, and easy to access.

Grading Schema — Annexure 3 — Maintaining Curation Hygiene
# | Activity | Standard
• 1 | GR uploads and tagging | Within 2 days of receipt
• 2 | Newspaper article tracking | Within 2 days of receipt
• 3 | Felicitation records | Within a week
• 4 | Award declaration rules followed properly | —
• 5 | Create explanatory Post / Video for key GRs / Prapatras | 1 GR / Prapatra per quarter
• 6 | Share insights of key GRs that can convert into programs | 1 GR / Prapatra per quarter$sm$
 where year = 'June 2026 - May 2027' and member = 'Rushikesh Shelar' and goal = 'Curation Hygiene'
   and coalesce(success_measures,'') = '';
-- Rushikesh Shelar · Team  ←  Org Chart: Self Development & Ownership — improve skills and handle responsibilities independently. [Medium]
update public.goals set success_measures = $sm$Learn all required processes and complete assigned work on time.
Work independently and suggest at least 2 ideas to improve work quality or processes.$sm$
 where year = 'June 2026 - May 2027' and member = 'Rushikesh Shelar' and goal = 'Team'
   and coalesce(success_measures,'') = '';
-- Gitanjali Tekale · Post Curation  ←  Org Chart: Curation & Teacher Recognition — complete curation and teacher recognition work with good quality. [Medium]
update public.goals set success_measures = $sm$Complete evaluations and validations on time while maintaining high-quality standards.
Identify and submit deserving teacher practices for recognition and continuously improve work based on feedback.

Grading Schema — Annexure 1 — Curation
# | Activity | Standard
• 1 | Posts evaluated as per set guidelines | Evaluate last week's posts by Friday
• 2 | Ensure best posts are curated and marked as Featured Posts | 5% or 50 per district per month, whichever is lower
• 3 | Ensure Post of the Month and Spardha awards are released on time | Spardha Awards — 2nd working day of month (for last month); PoM Awards — 3rd working day of month (for last month)
• 4 | Timely release of posters | Posters for all districts by the 5th working day of the month$sm$
 where year = 'June 2026 - May 2027' and member = 'Gitanjali Tekale' and goal = 'Post Curation'
   and coalesce(success_measures,'') = '';
-- Gitanjali Tekale · Acharyakul  ←  Org Chart: Teacher Engagement — increase teacher participation in curation and expert coupons. [Medium]
update public.goals set success_measures = $sm$Connect and regularly communicate with at least 50 teachers during the year.
Support teachers in submitting their practices and encourage them to use expert coupons.

Grading Schema — Annexure 2 — Teacher Engagement
# | Activity | Standard
• 1 | Expert Teachers vote — promote in each district | 40% of the coupons used per district$sm$
 where year = 'June 2026 - May 2027' and member = 'Gitanjali Tekale' and goal = 'Acharyakul'
   and coalesce(success_measures,'') = '';
-- Gitanjali Tekale · Curation Hygiene  ←  Org Chart: Documentation Management — keep all records and documents updated and organized. [Medium]
update public.goals set success_measures = $sm$Update circulars, records, and resources on time.
Keep all documents accurate, organized, and easy to access.

Grading Schema — Annexure 3 — Maintaining Curation Hygiene
# | Activity | Standard
• 1 | GR uploads and tagging | Within 2 days of receipt
• 2 | Newspaper article tracking | Within 2 days of receipt
• 3 | Felicitation records | Within a week
• 4 | Award declaration rules followed properly | —
• 5 | Create explanatory Post / Video for key GRs / Prapatras | 1 GR / Prapatra per quarter
• 6 | Share insights of key GRs that can convert into programs | 1 GR / Prapatra per quarter$sm$
 where year = 'June 2026 - May 2027' and member = 'Gitanjali Tekale' and goal = 'Curation Hygiene'
   and coalesce(success_measures,'') = '';
-- Gitanjali Tekale · Team  ←  Org Chart: Self Development & Ownership — improve skills and handle responsibilities independently. [Medium]
update public.goals set success_measures = $sm$Learn all required processes and complete assigned work on time.
Work independently and suggest at least 2 ideas to improve work quality or processes.$sm$
 where year = 'June 2026 - May 2027' and member = 'Gitanjali Tekale' and goal = 'Team'
   and coalesce(success_measures,'') = '';
-- Mahadevi R · Post Curation  ←  Org Chart: Curation & Teacher Recognition — complete curation and teacher recognition work with good quality. [Low]
update public.goals set success_measures = $sm$Complete evaluations and validations on time while maintaining high-quality standards.
Identify and submit deserving teacher practices for recognition and continuously improve work based on feedback.

Grading Schema — Annexure 1 — Curation
# | Activity | Standard
• 1 | Posts evaluated as per set guidelines | Evaluate last week's posts by Friday
• 2 | Ensure best posts are curated and marked as Featured Posts | 5% or 50 per district per month, whichever is lower
• 3 | Ensure Post of the Month and Spardha awards are released on time | Spardha Awards — 2nd working day of month (for last month); PoM Awards — 3rd working day of month (for last month)
• 4 | Timely release of posters | Posters for all districts by the 5th working day of the month$sm$
 where year = 'June 2026 - May 2027' and member = 'Mahadevi R' and goal = 'Post Curation'
   and coalesce(success_measures,'') = '';
-- Mahadevi R · Acharyakul  ←  Org Chart: Teacher Engagement — increase teacher participation in curation and expert coupons. [Low]
update public.goals set success_measures = $sm$Connect and regularly communicate with at least 50 teachers during the year.
Support teachers in submitting their practices and encourage them to use expert coupons.

Grading Schema — Annexure 2 — Teacher Engagement
# | Activity | Standard
• 1 | Expert Teachers vote — promote in each district | 40% of the coupons used per district$sm$
 where year = 'June 2026 - May 2027' and member = 'Mahadevi R' and goal = 'Acharyakul'
   and coalesce(success_measures,'') = '';
-- Mahadevi R · Curation Hygiene  ←  Org Chart: Documentation Management — keep all records and documents updated and organized. [Low]
update public.goals set success_measures = $sm$Update circulars, records, and resources on time.
Keep all documents accurate, organized, and easy to access.

Grading Schema — Annexure 3 — Maintaining Curation Hygiene
# | Activity | Standard
• 1 | GR uploads and tagging | Within 2 days of receipt
• 2 | Newspaper article tracking | Within 2 days of receipt
• 3 | Felicitation records | Within a week
• 4 | Award declaration rules followed properly | —
• 5 | Create explanatory Post / Video for key GRs / Prapatras | 1 GR / Prapatra per quarter
• 6 | Share insights of key GRs that can convert into programs | 1 GR / Prapatra per quarter$sm$
 where year = 'June 2026 - May 2027' and member = 'Mahadevi R' and goal = 'Curation Hygiene'
   and coalesce(success_measures,'') = '';
-- Mahadevi R · Team  ←  Org Chart: Self Development & Ownership — improve skills and handle responsibilities independently. [Low]
update public.goals set success_measures = $sm$Learn all required processes and complete assigned work on time.
Work independently and suggest at least 2 ideas to improve work quality or processes.$sm$
 where year = 'June 2026 - May 2027' and member = 'Mahadevi R' and goal = 'Team'
   and coalesce(success_measures,'') = '';
-- Sagar Dayma · Post Curation  ←  Org Chart: Curation & Teacher Recognition — complete curation and teacher recognition work with good quality. [Low]
update public.goals set success_measures = $sm$Complete evaluations and validations on time while maintaining high-quality standards.
Identify and submit deserving teacher practices for recognition and continuously improve work based on feedback.

Grading Schema — Annexure 1 — Curation
# | Activity | Standard
• 1 | Posts evaluated as per set guidelines | Evaluate last week's posts by Friday
• 2 | Ensure best posts are curated and marked as Featured Posts | 5% or 50 per district per month, whichever is lower
• 3 | Ensure Post of the Month and Spardha awards are released on time | Spardha Awards — 2nd working day of month (for last month); PoM Awards — 3rd working day of month (for last month)
• 4 | Timely release of posters | Posters for all districts by the 5th working day of the month$sm$
 where year = 'June 2026 - May 2027' and member = 'Sagar Dayma' and goal = 'Post Curation'
   and coalesce(success_measures,'') = '';
-- Sagar Dayma · Acharyakul  ←  Org Chart: Teacher Engagement — increase teacher participation in curation and expert coupons. [Low]
update public.goals set success_measures = $sm$Connect and regularly communicate with at least 50 teachers during the year.
Support teachers in submitting their practices and encourage them to use expert coupons.

Grading Schema — Annexure 2 — Teacher Engagement
# | Activity | Standard
• 1 | Expert Teachers vote — promote in each district | 40% of the coupons used per district$sm$
 where year = 'June 2026 - May 2027' and member = 'Sagar Dayma' and goal = 'Acharyakul'
   and coalesce(success_measures,'') = '';
-- Sagar Dayma · Curation Hygiene  ←  Org Chart: Documentation Management — keep all records and documents updated and organized. [Low]
update public.goals set success_measures = $sm$Update circulars, records, and resources on time.
Keep all documents accurate, organized, and easy to access.

Grading Schema — Annexure 3 — Maintaining Curation Hygiene
# | Activity | Standard
• 1 | GR uploads and tagging | Within 2 days of receipt
• 2 | Newspaper article tracking | Within 2 days of receipt
• 3 | Felicitation records | Within a week
• 4 | Award declaration rules followed properly | —
• 5 | Create explanatory Post / Video for key GRs / Prapatras | 1 GR / Prapatra per quarter
• 6 | Share insights of key GRs that can convert into programs | 1 GR / Prapatra per quarter$sm$
 where year = 'June 2026 - May 2027' and member = 'Sagar Dayma' and goal = 'Curation Hygiene'
   and coalesce(success_measures,'') = '';
-- Sagar Dayma · Team  ←  Org Chart: Self Development & Ownership — improve skills and handle responsibilities independently. [Low]
update public.goals set success_measures = $sm$Learn all required processes and complete assigned work on time.
Work independently and suggest at least 2 ideas to improve work quality or processes.$sm$
 where year = 'June 2026 - May 2027' and member = 'Sagar Dayma' and goal = 'Team'
   and coalesce(success_measures,'') = '';
-- Bharat Sinha · Product Improvement and Development  ←  Org Chart: Product Improvement and Development [High]
update public.goals set success_measures = $sm$Develop and implement major product enhancements to achieve:
- Adoption: 15% QoQ increase in Life Skills & Morning Assembly adoption
- Reduce OMR reading errors for FLN to 2% for multiple lots and sections
- Ensure reports for all exams are available within 7 days of exam in high quality
- Improve efficiency and effectiveness of Polestar program
- Increase confidence in FLN exams
Develop and implement minor product enhancements as required (expected about 3 per quarter).
Strengthen the post-exam review and improvement mechanism for FLN. Pilot and rollout in 5 districts.$sm$
 where year = 'June 2026 - May 2027' and member = 'Bharat Sinha' and goal = 'Product Improvement and Development'
   and coalesce(success_measures,'') = '';
-- Bharat Sinha · Product Adoption and Growth Marketing  ←  Org Chart: Product Adoption and Growth Marketing [High]
update public.goals set success_measures = $sm$Run growth marketing campaigns each quarter:
- 4 for Life Skills programs (increase adoption 15% QoQ)
- 4 for academic programs (increased adoption for JEE/NEET, Board Toppers, FLN)
Develop 5 product champions across regions/programs each quarter who demonstrate independent usage and solutioning capability.
Provide good-quality product documentation to improve sales, onboarding and solutioning capacity of the PO team.
Please see Annexure A for more details.

Grading Schema — Annexure A — Product Marketing
# | Product Marketing | Weight
• 1 | Growth Marketing Run 1 growth marketing campaign each quarter as per focus area and agreed targets. | 0.2
• 2 | Product Champions Coach and develop 10 product champions in each region/program each quarter — demonstrate independent usage and solutioning capability. | 0.2
• 3 | Product Documentation Improve sales, onboarding and solutioning capacity of the PO team by providing good-quality and adequate product documentation for key product offerings: a. Product presentations, flyers, videos, product FAQ b. Case studies — with impact stories, testimonials and use cases c. Rubrics for measurement and impact d. Onboarding and supporting teachers Develop, maintain and drive usage of product documentation for key product offerings. Categorize (A/B/C/D) based on usage/impact and provide usage and impact statistics each quarter. | 0.1$sm$
 where year = 'June 2026 - May 2027' and member = 'Bharat Sinha' and goal = 'Product Adoption and Growth Marketing'
   and coalesce(success_measures,'') = '';
-- Bharat Sinha · Self Development and High Performance Team  ←  Org Chart: Self Development and High Performance Team [High]
update public.goals set success_measures = $sm$Ensure disciplined execution for self and team.
Demonstrate consistent improvement in competency in day-to-day work related to:
- Client Relationship: L3 (PY L2)
- Work Management: L3 (PY L2)
For more details see Annexure B.

Grading Schema — Annexure B — Self Development Objectives
# | Objective | Target 25-26 | Weight
• 1 | Proper planning and tracking and no ball dropped. | — | 0.05
• 2 | Achieve Learning and Development goals. | — | 0.05$sm$
 where year = 'June 2026 - May 2027' and member = 'Bharat Sinha' and goal = 'Self Development and High Performance Team'
   and coalesce(success_measures,'') = '';
-- Kumari Priya · Polestar Mentoring and Motivation Program  ←  Org Chart: Polestar-supported student outcomes [Medium]
update public.goals set success_measures = $sm$500+ Govt. students supported by 60+ Polestars with consistency & discipline, so that 80 students qualify for JEE Mains and NEET.

Grading Schema — Annexure A — Program Targets
# | Target
• 1 | 500+ Govt. students supported by 60+ Polestars; 80 students qualify for JEE Mains / NEET
• 2 | 12 CBT-based practice tests for 5,000+ students (with Avanti Foundation); avg attendance >50% per test
• 3 | 800 virtual Polestar sessions (70%+ mentee participation) + 25 in-person sessions (85%+ participation)
• 4 | CBT exams coordinated across 13 districts with 5,000 students; reports shared within 2 days
• 5 | 5 university exposure visits to IIT Bhilai & NIT Raipur, 50+ students each$sm$
 where year = 'June 2026 - May 2027' and member = 'Kumari Priya' and goal = 'Polestar Mentoring and Motivation Program'
   and coalesce(success_measures,'') = '';
-- Kumari Priya · Computer-Based Test  ←  Org Chart: CBT practice-test execution [Medium]
update public.goals set success_measures = $sm$12 CBT-based practice tests for 5,000+ students with Avanti Foundation; average attendance over 50% per test; timely analysis for feedback & improvement across all districts.

Grading Schema — Annexure C — Program Calendar 26-27 (planned activities)
Activity | Planned
• Polestar selection | 1
• Govt. student baseline test | 1
• Orientations (students / Polestars / teachers / POs) | 2
• Avanti CBT tests | 9
• CBT test results | 8
• Polestar workshops | 3
• Govt. student workshops | 3
• Reviews with district administration | 9
• Govt. student visits to IIT / NIT campus | 2
• Recognition events | 9$sm$
 where year = 'June 2026 - May 2027' and member = 'Kumari Priya' and goal = 'Computer-Based Test'
   and coalesce(success_measures,'') = '';
-- Kumari Priya · Vibrant Teacher & Student Community  ←  Org Chart: Vibrant Polestar & student community [Medium]
update public.goals set success_measures = $sm$Build a vibrant community of Polestars and students so they encourage other students to join the program.

Grading Schema — Annexure B — Polestar Engagement (2025-26 plan)
Institution / Item | Count
• NIT (Raipur) | 31
• IIT (Bhilai) | 24
• Program coordinators | 5
• Total Polestars engaged with students | ~49
• Govt. students for Polestar engagement | 289 (211 + 78)$sm$
 where year = 'June 2026 - May 2027' and member = 'Kumari Priya' and goal = 'Vibrant Teacher & Student Community'
   and coalesce(success_measures,'') = '';
-- Kumari Priya · High Ownership (Self-Development)  ←  Org Chart: Ownership & compliance [Medium]
update public.goals set success_measures = $sm$Display high ownership and continuous learning, ensuring 100% compliance on processes and timelines.$sm$
 where year = 'June 2026 - May 2027' and member = 'Kumari Priya' and goal = 'High Ownership (Self-Development)'
   and coalesce(success_measures,'') = '';
-- Moin Mansuri · Polestar Mentoring and Motivation Program  ←  Org Chart: Polestar-supported student outcomes [Medium]
update public.goals set success_measures = $sm$500+ Govt. students supported by 60+ Polestars with consistency & discipline, so that 80 students qualify for JEE Mains and NEET.

Grading Schema — Annexure A — Program Targets
# | Target
• 1 | 500+ Govt. students supported by 60+ Polestars; 80 students qualify for JEE Mains / NEET
• 2 | 12 CBT-based practice tests for 5,000+ students (with Avanti Foundation); avg attendance >50% per test
• 3 | 800 virtual Polestar sessions (70%+ mentee participation) + 25 in-person sessions (85%+ participation)
• 4 | CBT exams coordinated across 13 districts with 5,000 students; reports shared within 2 days
• 5 | 5 university exposure visits to IIT Bhilai & NIT Raipur, 50+ students each$sm$
 where year = 'June 2026 - May 2027' and member = 'Moin Mansuri' and goal = 'Polestar Mentoring and Motivation Program'
   and coalesce(success_measures,'') = '';
-- Moin Mansuri · Computer-Based Test  ←  Org Chart: CBT practice-test execution [Medium]
update public.goals set success_measures = $sm$12 CBT-based practice tests for 5,000+ students with Avanti Foundation; average attendance over 50% per test; timely analysis for feedback & improvement across all districts.

Grading Schema — Annexure C — Program Calendar 26-27 (planned activities)
Activity | Planned
• Polestar selection | 1
• Govt. student baseline test | 1
• Orientations (students / Polestars / teachers / POs) | 2
• Avanti CBT tests | 9
• CBT test results | 8
• Polestar workshops | 3
• Govt. student workshops | 3
• Reviews with district administration | 9
• Govt. student visits to IIT / NIT campus | 2
• Recognition events | 9$sm$
 where year = 'June 2026 - May 2027' and member = 'Moin Mansuri' and goal = 'Computer-Based Test'
   and coalesce(success_measures,'') = '';
-- Moin Mansuri · Vibrant Teacher & Student Community  ←  Org Chart: Vibrant Polestar & student community [Medium]
update public.goals set success_measures = $sm$Build a vibrant community of Polestars and students so they encourage other students to join the program.

Grading Schema — Annexure B — Polestar Engagement (2025-26 plan)
Institution / Item | Count
• NIT (Raipur) | 31
• IIT (Bhilai) | 24
• Program coordinators | 5
• Total Polestars engaged with students | ~49
• Govt. students for Polestar engagement | 289 (211 + 78)$sm$
 where year = 'June 2026 - May 2027' and member = 'Moin Mansuri' and goal = 'Vibrant Teacher & Student Community'
   and coalesce(success_measures,'') = '';
-- Moin Mansuri · High Ownership (Self-Development)  ←  Org Chart: Ownership & compliance [Medium]
update public.goals set success_measures = $sm$Display high ownership and continuous learning, ensuring 100% compliance on processes and timelines.$sm$
 where year = 'June 2026 - May 2027' and member = 'Moin Mansuri' and goal = 'High Ownership (Self-Development)'
   and coalesce(success_measures,'') = '';
-- Suman Maji · Polestar Mentoring and Motivation Program  ←  Org Chart: Polestar-supported student outcomes [Low]
update public.goals set success_measures = $sm$500+ Govt. students supported by 60+ Polestars with consistency & discipline, so that 80 students qualify for JEE Mains and NEET.

Grading Schema — Annexure A — Program Targets
# | Target
• 1 | 500+ Govt. students supported by 60+ Polestars; 80 students qualify for JEE Mains / NEET
• 2 | 12 CBT-based practice tests for 5,000+ students (with Avanti Foundation); avg attendance >50% per test
• 3 | 800 virtual Polestar sessions (70%+ mentee participation) + 25 in-person sessions (85%+ participation)
• 4 | CBT exams coordinated across 13 districts with 5,000 students; reports shared within 2 days
• 5 | 5 university exposure visits to IIT Bhilai & NIT Raipur, 50+ students each$sm$
 where year = 'June 2026 - May 2027' and member = 'Suman Maji' and goal = 'Polestar Mentoring and Motivation Program'
   and coalesce(success_measures,'') = '';
-- Suman Maji · Computer-Based Test  ←  Org Chart: CBT practice-test execution [Low]
update public.goals set success_measures = $sm$12 CBT-based practice tests for 5,000+ students with Avanti Foundation; average attendance over 50% per test; timely analysis for feedback & improvement across all districts.

Grading Schema — Annexure C — Program Calendar 26-27 (planned activities)
Activity | Planned
• Polestar selection | 1
• Govt. student baseline test | 1
• Orientations (students / Polestars / teachers / POs) | 2
• Avanti CBT tests | 9
• CBT test results | 8
• Polestar workshops | 3
• Govt. student workshops | 3
• Reviews with district administration | 9
• Govt. student visits to IIT / NIT campus | 2
• Recognition events | 9$sm$
 where year = 'June 2026 - May 2027' and member = 'Suman Maji' and goal = 'Computer-Based Test'
   and coalesce(success_measures,'') = '';
-- Suman Maji · Vibrant Teacher & Student Community  ←  Org Chart: Vibrant Polestar & student community [Low]
update public.goals set success_measures = $sm$Build a vibrant community of Polestars and students so they encourage other students to join the program.

Grading Schema — Annexure B — Polestar Engagement (2025-26 plan)
Institution / Item | Count
• NIT (Raipur) | 31
• IIT (Bhilai) | 24
• Program coordinators | 5
• Total Polestars engaged with students | ~49
• Govt. students for Polestar engagement | 289 (211 + 78)$sm$
 where year = 'June 2026 - May 2027' and member = 'Suman Maji' and goal = 'Vibrant Teacher & Student Community'
   and coalesce(success_measures,'') = '';
-- Suman Maji · High Ownership (Self-Development)  ←  Org Chart: Ownership & compliance [Low]
update public.goals set success_measures = $sm$Display high ownership and continuous learning, ensuring 100% compliance on processes and timelines.$sm$
 where year = 'June 2026 - May 2027' and member = 'Suman Maji' and goal = 'High Ownership (Self-Development)'
   and coalesce(success_measures,'') = '';
-- Rahul Pawar · Strengthen the teacher recognition program towards Vibrant Teacher Community  ←  Org Chart: Strengthen the teacher recognition program towards Vibrant Teacher Community [High]
update public.goals set success_measures = $sm$Improve the Vibrancy score for teacher community from 4 to 5.
Hold 20 "प्रेरणा संवाद" webinar sessions with CEO/DM, and 5 "Bolega Bachpan" with Sonali Kulkarni.
(Details in Annexure A.)

Grading Schema — Annexure A — Vibrant Teacher Community (Online + Physical)
Vibrancy score split: Online Community 0.6 · Physical Community 0.4.

▸ Online Community (Actual vs Target)
# | Measure | Actual count | Density | Target density | Weightage
▸ Breadth
• 1 | % of unique teachers posting each month | 230 | 4.8% | 20% | 0.2
• 2 | % of unique schools posting each month | 180 | 11.9% | 20% | 0.2
▸ Depth
• 3 | Weekly Active Users | 480 | 10.0% | 15% | 0.2
• 4 | Posts per month / per teacher | 635 | 13.2% | 20% | 0.1
• 5 | Star Teachers with 3-month consistency | 46 | 1.0% | 2% | 0.1
▸ Impact
• 6 | % of teachers using their expert coupon | 8 | 40% | 75% | 0.1
• 7 | POM Transformed clusters | 5 | 2.8% | 5% | 0.1

▸ Physical Community (Actual vs Target)
Measure | Actual | Target | Weightage | 
• % of Blocks with recognition events each month | 6 (75%) | 8 (100%) | 0.1
• District recognition event held | 1 (100%) | 1 (100%) | 0.1
• % of Teachers Recognized vs estimate | 24 (62%) | 39 (100%) | 0.1
• % of Cluster Heads recognized vs estimate | 18 (75%) | 24 (100%) | 0.1
• Sikshan Utsav held with DM/CEO present | 1 | 1 | 0.1
• 360° Feedback on Recognition Program | 8.2 | 10 | 0.2
• 360° Feedback on Sikshan Utsav | 7.4 | 10 | 0.2
• 360° Feedback on Nanhe Sitare | 8.2 | 10 | 0.1

Conceptualize and run the following recognition programs with high quality | 25-26 | 26-27
• Webinar — Coffee with CEO / Collector (5 districts) | 0 | 20
• Story Telling with Sonali Kulkarni | 3 | 5

A. 360° Inputs for Teacher Recognition events (monthly): all planning, procurement and availability of goods done timely and in good quality (CT); teachers show high excitement for the gifts (CT); maintain stock register for gifts and audit it monthly (CT); CEO/BEO participation in the event (FT).

B. 360° Inputs for Sikshan Utsav / Nanhe Sitare (for each event): all planning and procurement done timely; participation of CEO/Collector, expected teachers and expected donors; teachers come on time; graffiti and games are very engaging; high engagement during event; everything as per schedule; high rating of the event by participants; good-quality articles and videos from the event; 100 videos and reels for teachers, students and schools per event (figure out a process for this); maintain stock register for gifts and audit it monthly.$sm$
 where year = 'June 2026 - May 2027' and member = 'Rahul Pawar' and goal = 'Strengthen the teacher recognition program towards Vibrant Teacher Community'
   and (coalesce(success_measures,'') = '' or replace(success_measures, chr(13), '') = $old$Improve the Vibrancy score for teacher community from 4 to 5.
Hold 20 "प्रेरणा संवाद" webinar sessions with CEO/DM, and 5 "Bolega Bachpan" with Sonali Kulkarni.
(Details in Annexure A.)

Grading Schema — Annexure A — Vibrant Teacher Community (Online + Physical)
Vibrancy score split: Online Community 0.6 · Physical Community 0.4.

Online Community (Actual vs Target)

# | Measure | Actual count | Density | Target density | Weightage
▸ Breadth
• 1 | % of unique teachers posting each month | 230 | 4.8% | 20% | 0.2
• 2 | % of unique schools posting each month | 180 | 11.9% | 20% | 0.2
▸ Depth
• 3 | Weekly Active Users | 480 | 10.0% | 15% | 0.2
• 4 | Posts per month / per teacher | 635 | 13.2% | 20% | 0.1
• 5 | Star Teachers with 3-month consistency | 46 | 1.0% | 2% | 0.1
▸ Impact
• 6 | % of teachers using their expert coupon | 8 | 40% | 75% | 0.1
• 7 | POM Transformed clusters | 5 | 2.8% | 5% | 0.1

Physical Community (Actual vs Target)

Measure | Actual | Target | Weightage
• % of Blocks with recognition events each month | 6 (75%) | 8 (100%) | 0.1
• District recognition event held | 1 (100%) | 1 (100%) | 0.1
• % of Teachers Recognized vs estimate | 24 (62%) | 39 (100%) | 0.1
• % of Cluster Heads recognized vs estimate | 18 (75%) | 24 (100%) | 0.1
• Sikshan Utsav held with DM/CEO present | 1 | 1 | 0.1
• 360° Feedback on Recognition Program | 8.2 | 10 | 0.2
• 360° Feedback on Sikshan Utsav | 7.4 | 10 | 0.2
• 360° Feedback on Nanhe Sitare | 8.2 | 10 | 0.1

Conceptualize and run the following recognition programs with high quality | 25-26 | 26-27
• Webinar — Coffee with CEO / Collector (5 districts) | 0 | 20
• Story Telling with Sonali Kulkarni | 3 | 5
A. 360° Inputs for Teacher Recognition events (monthly): all planning, procurement and availability of goods done timely and in good quality (CT); teachers show high excitement for the gifts (CT); maintain stock register for gifts and audit it monthly (CT); CEO/BEO participation in the event (FT).
B. 360° Inputs for Sikshan Utsav / Nanhe Sitare (for each event): all planning and procurement done timely; participation of CEO/Collector, expected teachers and expected donors; teachers come on time; graffiti and games are very engaging; high engagement during event; everything as per schedule; high rating of the event by participants; good-quality articles and videos from the event; 100 videos and reels for teachers, students and schools per event (figure out a process for this); maintain stock register for gifts and audit it monthly.$old$);
-- Rahul Pawar · Develop narrative of government schools as "Marathi Bhi, English Bhi"  ←  Org Chart: Develop narrative of government schools as "Marathi Bhi, English Bhi" [High]
update public.goals set success_measures = $sm$Nukkad Natak competitions in 5 districts with at least 30 schools in each district participating.
Market the achievements of teachers, schools and administrators (Annexure B) and increase engagement by 5% each quarter.

Grading Schema — Annexure B — Narrative & Social Media
Content (per month) | Videos | References
• Feature reels of impactful stories aligned to mission (teachers, schools, alumni, IAS officers) | 2 | —
• Blogs | 2 | —
• Kathavali — published monthly | 1 | —
• IAS officers | 1 | 1
• Education officers / DIET | 1 | 1
• Teachers | 2 | 2
• Chakmak — after each Sonali Kulkarni event | — | 0.5
• Collector ki Slate — newsletter after every CEO/Collector interaction | — | 1

Social Media Engagement | Target
• Vinoba Kathavali marketed with unique teacher engagement each month | 2000
• Teacher posts on social media with hashtag #Vinoba or #Acharyakul | 200 / month
• Number of Followers | Detailed metrics by end Aug
• Number of Views | Detailed metrics by end Aug
• Number of Likes | Detailed metrics by end Aug
• Number of Newspaper articles | 2 / month
• Number of TV appearances | 2 / month$sm$
 where year = 'June 2026 - May 2027' and member = 'Rahul Pawar' and goal = 'Develop narrative of government schools as "Marathi Bhi, English Bhi"'
   and coalesce(success_measures,'') = '';
-- Rahul Pawar · Improve employee motivation and ownership  ←  Org Chart: Improve employee motivation and ownership [High]
update public.goals set success_measures = $sm$360° Employee Culture Survey (ECS) shows 5% improvement each quarter (Annexure C).

Grading Schema — Annexure C — Employee Motivation & Ownership (ECS)
4 checkpoints during the year — 2 with external support and 2 internal.

# | Measure
• 1 | 360° ECS survey shows 5% improvement each quarter — Engagement, Wellbeing and Culture survey (Q1, Q2, Q3, Q4).

# | Things to be done to achieve the above
• 1 | Manager review and planning alignment sessions — quarterly.
• 2 | Moments that Matter — weekly.
• 3 | Vinoba Team — quarterly rolling trophy.
• 4 | Monthly employee post on LinkedIn with inspiring story.
• 5 | Monthly employee magazine with 80% unique employee engagement.
• 6 | Bi-annual retreat — Darpan.$sm$
 where year = 'June 2026 - May 2027' and member = 'Rahul Pawar' and goal = 'Improve employee motivation and ownership'
   and coalesce(success_measures,'') = '';
-- Rahul Pawar · Develop community of motivated Education officers and teachers as changemakers  ←  Org Chart: Develop community of motivated Education officers and teachers as changemakers [High]
update public.goals set success_measures = $sm$Make a proof of concept for "Acharyakul" through experimentation and pilot in 2 districts.
Make a proof of concept for "Caring Officers" with 25 members.$sm$
 where year = 'June 2026 - May 2027' and member = 'Rahul Pawar' and goal = 'Develop community of motivated Education officers and teachers as changemakers'
   and coalesce(success_measures,'') = '';
-- Rahul Pawar · Build and support a dedicated team that believes in OLF's mission and works with purpose  ←  Org Chart: Build and support a dedicated team that believes in OLF's mission and works with purpose [High]
update public.goals set success_measures = $sm$Hire team members as per requirement so the entire team is in place by Sep 26.
Half-yearly Employee Satisfaction Score (ESC) ≥ 8; Manager Feedback Score (MFS) ≥ 8; attrition < 20%.
(Details in Annexure E.)

Grading Schema — Annexure E — Team Building & Disciplined Execution
Hiring as per Exhibit 1 (weightage 5%).

# | Role | Person | Team size with Manager
• 1 | Manager — Marketing | Vaibhavi Ratishkumar | 2
• 2 | Manager — Events | Neha Upasani | 2
• 3 | Manager — Aspirational School Program | Vacant — to hire | 0
• 4 | Manager — Volunteering Engagement | Vacant — to hire | 0
• 5 | Manager — Employee Engagement | Vacant — to hire | 0

# | Disciplined Execution by team | Target 25-26
• a | Finalisation of monthly Plan (next month) and Actual (previous month) by 28th of month. Review meeting by 3rd.
• d | Follow-up action on items — 100%.
• 2 | No Ball Dropped — company policy followed | 100% compliance
•  | No Ball Dropped — no obvious mistakes / high accuracy | ZERO obvious mistakes each month
•  | No Ball Dropped — no commitments missed | ZERO commitments missed each month
• 3 | Two Case Studies each month | Per month
• 4 | Achieve Learning and Development goals$sm$
 where year = 'June 2026 - May 2027' and member = 'Rahul Pawar' and goal = 'Build and support a dedicated team that believes in OLF''s mission and works with purpose'
   and (coalesce(success_measures,'') = '' or replace(success_measures, chr(13), '') = $old$Hire team members as per requirement so the entire team is in place by Sep 26.
Half-yearly Employee Satisfaction Score (ESC) ≥ 8; Manager Feedback Score (MFS) ≥ 8; attrition < 20%.
(Details in Annexure E.)

Grading Schema — Annexure E — Team Building & Disciplined Execution
Hiring as per Exhibit 1 (weightage 5%).

# | Role | Person | Team size with Manager
• 1 | Manager — Marketing | Vaibhavi Ratishkumar | 2
• 2 | Manager — Events | Neha Upasani | 2
• 3 | Manager — Aspirational School Program | Vacant — to hire | 0
• 4 | Manager — Volunteering Engagement | Vacant — to hire | 0
• 5 | Manager — Employee Engagement | Vacant — to hire | 0

# | Disciplined Execution by team | Target 25-26
• a | Finalisation of monthly Plan (next month) and Actual (previous month) by 28th of month. Review meeting by 3rd. | –
• d | Follow-up action on items — 100%. | –
• 2 | No Ball Dropped — company policy followed | 100% compliance
• – | No Ball Dropped — no obvious mistakes / high accuracy | ZERO obvious mistakes each month
• – | No Ball Dropped — no commitments missed | ZERO commitments missed each month
• 3 | Two Case Studies each month | Per month
• 4 | Achieve Learning and Development goals | –$old$);
-- Neha Upasani · TRE  ←  Org Chart: Improve TRE Score each quarter [High]
update public.goals set success_measures = $sm$TRE Score — ≥10% improvement each quarter (gift quality, teacher excitement, CEO/BEO participation, stock audit). Annexure A.

Grading Schema — Annexure A — Teacher Recognition Excitement Score (TRE)
# | Measure | Weightage
• 1 | TRE score improves by ≥10% each quarter — tracked across gift quality, teacher excitement, CEO/BEO participation, and stock-audit compliance. | 30%

# | Inputs for TRE score | Weightage
• 1 | All gifts and materials procured and available two weeks prior to need; district stock logged in register and actively maintained; no urgency to procure, no excess held over a month. | 5%
• 2 | Stock register maintained and audited every month. | 5%
• 3 | Publish monthly ABCD categorisation of TRE (incl. participation of relevant officials, timeliness). | 5%
• 4 | Teachers show high excitement for the gifts. | 15%$sm$
 where year = 'June 2026 - May 2027' and member = 'Neha Upasani' and goal = 'TRE'
   and coalesce(success_measures,'') = '';
-- Neha Upasani · SUNS  ←  Org Chart: Improve SUN Score for every event [High]
update public.goals set success_measures = $sm$SUN Score — ≥4% improvement vs model event per Sikshan Utsav & Nanhe Sitare (participation, IAS/CEO presence, post-event content). Annexure B.

Grading Schema — Annexure B — Sikshan Utsav & Nanhe Sitare Score (SUNs)
# | Measure | Weightage
• 1 | SUNs score improves by 4% (versus model event) for each event. | 50%

# | Inputs for SUNs score | Owner | Weightage
• 1 | All planning and procurement done timely. | CT&FT | 10%
• 2 | Participation: CEO/Collector, expected teachers, expected donors. | FT | —
• 3 | Teachers come on time. | FT | —
• 4 | Graffiti and games are very engaging. | CT | 10%
• 5 | High engagement during event. | CT | 10%
• 6 | Everything as per schedule. | CT&FT | —
• 7 | High rating of the event by participants. | CT | 10%
• 8 | Good-quality articles and videos from the event. | CT | 5%
• 9 | Videos and reels for teachers, students and schools — 100 per event (establish a process). | CT | 5%$sm$
 where year = 'June 2026 - May 2027' and member = 'Neha Upasani' and goal = 'SUNS'
   and coalesce(success_measures,'') = '';
-- Vaibhavi Kumar · Teacher Engagement and Vinoba Adoption  ←  Org Chart: Drive teacher engagement and Vinoba adoption through inspiring programme-aligned communication [High]
update public.goals set success_measures = $sm$Achieve at least 80% TEN score (Teacher Engagement) as per Annexure A. Grow app adoption by 5% each month.

Grading Schema — Annexure A — Teacher Engagement Score (TEN)
# | Measure | Weightage
• 1 | Improve teacher engagement through Kathavali, social media, and field communication. | 30%
• 2 | Strengthen teacher stories, programme updates, and Vinoba adoption campaigns. | 10%
• 3 | 5% growth in unique weekly active users and monthly active users each month. | 10%

# | Exhibit — Activity / Engagement | Monthly Target | Weightage
• 1 | Feature reels of impactful stories (teachers, schools, alumni, IAS officers, students) | 5/month | 10%
• 2 | Vinoba Kathavali newsletter | 1/month | 5%
• 3 | Market Vinoba Kathavali among teachers | 2,000+ engagements/month | 5%
• 4 | Track social media engagement (views, likes, shares, followers) | Monthly report | 5%
• 5 | Track teacher posts using #Vinoba / #Acharyakul | 200+/month | 3%
• 6 | Create engagement analytics report | 1/month | 2%
• 7 | Post-event content for TRE / SUN events | 50 reels/videos/stories per event | 5%
• 8 | Growth marketing communication | 2/month | 2%
• 9 | Other marketing comms (Sikshan Utsav, Nanhe Sitare, Chakmak, Collector ki Slate) | 3/month | 3%$sm$
 where year = 'June 2026 - May 2027' and member = 'Vaibhavi Kumar' and goal = 'Teacher Engagement and Vinoba Adoption'
   and coalesce(success_measures,'') = '';
-- Vaibhavi Kumar · Create communication that builds staff commitment, culture, and pride in OLF.  ←  Org Chart: Create communication that builds staff commitment, culture, and pride in OLF [High]
update public.goals set success_measures = $sm$Engage OLF team as per Annexure C.

Grading Schema — Annexure C — OLF Team Engagement
# | Measure | Weightage
• 1 | Strengthen employee engagement through internal newsletters, leadership communication, culture initiatives, and event communications. | 10%

# | Activity / Engagement | Target | Weightage
• 1 | Internal newsletter / employee magazine | 1/month | 3%
• 2 | Office Graffiti / Desktop Graffiti | 1/quarter | 2%
• 3 | Employee LinkedIn story | 1/month | 1%
• 4 | Communication for internal events (Darpan, MoM, etc.) | As required | 1%
• 5 | Open house | 1/quarter | 0.25%
• 6 | Track internal newsletter engagement | 50/month | 3%$sm$
 where year = 'June 2026 - May 2027' and member = 'Vaibhavi Kumar' and goal = 'Create communication that builds staff commitment, culture, and pride in OLF.'
   and coalesce(success_measures,'') = '';
-- Vaibhavi Kumar · Position OLF as a credible thought leader in education transformation.  ←  Org Chart: Position OLF as a credible thought leader in education transformation [High]
update public.goals set success_measures = $sm$Achieve score as per Annexure D in reach, engagement, or stakeholder response on thought leadership content.

Grading Schema — Annexure D — OLF Thought Leadership
# | Measure | Weightage
• 1 | Build external narratives around OLF's work, impact, and learnings. | 5%
• 2 | Strengthen LinkedIn, media, and leadership visibility. | 5%

# | Activity | Measure | Weightage
• 1 | Thought leadership articles / blogs | 2 blogs/month | 5%
• 2 | Views, followers, likes, comments and forwards | Numbers by end of Aug | 2.5%
• 3 | Media stories and press / TV communication | 2/month | 2.5%$sm$
 where year = 'June 2026 - May 2027' and member = 'Vaibhavi Kumar' and goal = 'Position OLF as a credible thought leader in education transformation.'
   and coalesce(success_measures,'') = '';
-- Vaibhavi Kumar · Self Development and High Performance Team  ←  Org Chart: Self Development and High Performance Team [High]
update public.goals set success_measures = $sm$Ensure disciplined execution and learning as per Annexure E.

Grading Schema — Annexure E — Self Development & High Performance
# | Objective | Target | Weightage
• 1 | Planning and Tracking |  | 2.5%
• a | Finalisation of monthly Plan (next month) and Actual (previous month) by 28th | 29th of every month | —
• b | Finalisation of weekly Plan and Actual by Friday of week | Weekly, Friday EOD | —
• c | Review meeting by 3rd | Updated HO PPT with ZERO errors by 2nd EOD | —
• d | Follow-up action on items — 100% |  | —
• 2 | No Ball Dropped (company policy, accuracy, commitments) | 100% compliance; ZERO mistakes / missed commitments monthly | 2.5%
• 3 | Two case studies each month | Per month | 2.5%
• 4 | Achieve Learning and Development goals |  | 2.5%$sm$
 where year = 'June 2026 - May 2027' and member = 'Vaibhavi Kumar' and goal = 'Self Development and High Performance Team'
   and (coalesce(success_measures,'') = '' or replace(success_measures, chr(13), '') = $old$Ensure disciplined execution and learning as per Annexure E.

Grading Schema — Annexure E — Self Development & High Performance
# | Objective | Target | Weightage
• 1 | Planning and Tracking | – | 2.5%
• a | Finalisation of monthly Plan (next month) and Actual (previous month) by 28th | 29th of every month | —
• b | Finalisation of weekly Plan and Actual by Friday of week | Weekly, Friday EOD | —
• c | Review meeting by 3rd | Updated HO PPT with ZERO errors by 2nd EOD | —
• d | Follow-up action on items — 100% | – | —
• 2 | No Ball Dropped (company policy, accuracy, commitments) | 100% compliance; ZERO mistakes / missed commitments monthly | 2.5%
• 3 | Two case studies each month | Per month | 2.5%
• 4 | Achieve Learning and Development goals | – | 2.5%$old$);
-- Craig Dsouza · Team Success  ←  Org Chart: Acceptance of the Team [Medium]
update public.goals set success_measures = $sm$the team must succeed on existing goals and measures.
thumbs up from Omkar, Viswajit and Shrikant$sm$
 where year = 'June 2026 - May 2027' and member = 'Craig Dsouza' and goal = 'Team Success'
   and coalesce(success_measures,'') = '';
-- Craig Dsouza · Increase Organic Product Usage of Vinoba  ←  Org Chart: Increase Organic Product Usage of Vinoba [High]
update public.goals set success_measures = $sm$(usage) increase MAU to 8% of registered teachers within 6 months (usage = any non-mandatory feature)$sm$
 where year = 'June 2026 - May 2027' and member = 'Craig Dsouza' and goal = 'Increase Organic Product Usage of Vinoba'
   and coalesce(success_measures,'') = '';
-- Craig Dsouza · Gain Traction (0 -> 1) with Jijau  ←  Org Chart: Gain Traction (0 -> 1) with Jijau [High]
update public.goals set success_measures = $sm$(usage) achieve product usage by at least 50% of teachers in 16 registered schools within 3 months .
(usage) achieve product usage by at least 20% of parents in 16 registered schools within 3 months .$sm$
 where year = 'June 2026 - May 2027' and member = 'Craig Dsouza' and goal = 'Gain Traction (0 -> 1) with Jijau'
   and coalesce(success_measures,'') = '';
-- Omkar Yelgandalkar · Program Implementation and Support  ←  Org Chart: Program Implementation & Support [High]
update public.goals set success_measures = $sm$a. % of SLAs achieved.
b. No. of FATAL or CRITICAL issues unsolved, or solved and then reopened.
c. <2% failure cases in critical screens (Main User Feed, Leaderboard, Exams Section, AI, Awards, Certificate & User Portfolio points).
For more details see Annexure A.

Grading Schema — Annexure A — Program Implementation & Support
▸ Measures & Grading

# | Measure | Weight | Threshold | Score
• a | % of SLAs achieved (see SLA table below) | 30% | 100% | 30%
•  |  |  | 90–99% | 25%
•  |  |  | 76–89% | 20%
•  |  |  | 51–75% | 10%
•  |  |  | 50% or below | 0%
• b | No. of FATAL or CRITICAL issues unsolved, or solved and then reopened | 5% | None | 5%
•  |  |  | 1 issue | 3%
•  |  |  | 2 issues | 1%
•  |  |  | 3 or more | 0%
• c | Failure cases in critical screens (Main User Feed, Leaderboard, Exams Section, AI, Awards, Certificate & User Portfolio points) | 5% | Less than 2% | 5%
•  |  |  | 2–3% | 3%
•  |  |  | More than 3% up to 5% | 1%
•  |  |  | More than 5% | 0%

▸ SLA Turnaround Times (Measure a)

Area | # | Task | Details | Fatal | Critical | Moderate | Minor
• Support | 1 | Issues and rectification | Resolve within one day | 4 hr | 1 day | 4 days | 7 days
• Impl | 2 | Requirements for forms & reports from field | Finalise within 2 days of receipt; lead correct design | 1 day | 2 days | 4 days | 7 days
• Impl | 3 | Forms and notifications | After form is finalised | 4 hr | 1 day | 2 days | 7 days
• Impl | 4 | OMR sheet creation | Finalise requirements with teams | 1 day | 3 days | 5 days | 7 days
• Impl | 5 | OMR reading within 1 day of exam | Exam ID — 1 day | 1 day | 1 day | 1 day | 1 day
• Impl | 5.1 | OMR analysis within 3 days of first collection | Timely analysis & rectification | 2 days | 3 days | 4 days | 7 days
• Impl | 6 | Release testing (reports) | After reports released by development | 4 hr | 1 day | 2 days | 3 days
• Others | 7 | Preload setup | As per requirements | 6 hr | 1 day | 2 days | 3 days
• Others | 8 | District setup | After appropriate data is received | 1 day | 2 days | 4 days | 6 days
• Others | 9 | User registration & confirmation | — | 4 hr | 1 day | 2 days | 7 days
• Others | 10 | Adhoc data requirements | — | 3 days | 5 days | 7 days | 10 days
• Others | 11 | WhatsApp responses | Respond to queries on WhatsApp groups for assigned districts | 4 hr | 1 day | 2 days | 4 days

▸ Critical Screens to Monitor (Measure c)

# | Screen | Frequency
• 1 | Main User Feed | Weekly and Monthly
• 2 | Leaderboard | Weekly and Monthly
• 3 | Exams Section | Weekly and Monthly
• 4 | AI | Monthly
• 5 | Awards | Monthly
• 6 | Certificates and User Portfolio Points | Weekly and Monthly$sm$
 where year = 'June 2026 - May 2027' and member = 'Omkar Yelgandalkar' and goal = 'Program Implementation and Support'
   and (coalesce(success_measures,'') = '' or replace(success_measures, chr(13), '') = $old$Service Level Agreements as per Annexure A.

Grading Schema — Annexure A — Service Level Agreements (SLAs)
Cat. | # | Task | Fatal | Critical | Moderate | Minor
▸ Support
• Support | 1 | Issues & Rectification | 4 hr | 1 day | 4 days | 7 days
▸ Implementation
• Impl | 2 | Forms/Reports requirement finalisation | 1 day | 2 days | 4 days | 7 days
• Impl | 3 | Forms and Notifications (after finalisation) | 4 hr | 1 day | 2 days | 7 days
• Impl | 4 | OMR Sheet Creation | 1 day | 3 days | 5 days | 7 days
• Impl | 5 | OMR Sheet Reading (within 1 day of exam) | 1 day | 1 day | 1 day | 1 day
• Impl | 5.1 | OMR Analysis (within 3 days of first collection) | 2 days | 3 days | 4 days | 7 days
• Impl | 6 | Release Testing (Reports) | 4 hr | 1 day | 2 days | 3 days
▸ Others
• Others | 7 | Preload Setup | 6 hr | 1 day | 2 days | 3 days
• Others | 8 | District Setup | 1 day | 2 days | 4 days | 6 days
• Others | 9 | User Registration & Confirmation | 4 hr | 1 day | 2 days | 7 days
• Others | 10 | Adhoc data requirements | 3 days | 5 days | 7 days | 10 days
▸ Scoring Measures
• – | SLAs met | A: 100% | B: 90-99% | C: 76-89% | D: <76%
• – | 99% app uptime (weekly & monthly monitor) | –$old$);
-- Omkar Yelgandalkar · Team Success  ←  Org Chart: Team Success [High]
update public.goals set success_measures = $sm$a. Direct reportees achieve 90% score.
b. No balls dropped (Company policy followed, including weekly planning and review in Staff Connect).
c. No attrition of direct reportees.
For more details see Annexure B.

Grading Schema — Annexure B — Team Success
▸ Measures & Grading

# | Measure | Weight | Threshold | Score
• a | Direct reportees achieve 90% score | 10% | Average score of 90% or more | 10%
•  |  |  | 80–89% | 7%
•  |  |  | 70–79% | 4%
•  |  |  | Below 70% | 0%
• b | No balls dropped (Company policy followed, including weekly planning and review in Staff Connect) — monthly count of policy lapses, obvious mistakes or missed commitments | 15% | None | 15%
•  |  |  | 1 ball dropped | 9%
•  |  |  | 2 or more | 0%
• c | No attrition in team | 5% | No attrition | 5%
•  |  |  | 1 exit | 2%
•  |  |  | 2 or more exits | 0%

▸ Weekly Planning & Review in Staff Connect (Measure b)

Item | Target
• Weekly plan | Monday EOD
• Weekly review | Friday / Saturday EOD$sm$
 where year = 'June 2026 - May 2027' and member = 'Omkar Yelgandalkar' and goal = 'Team Success'
   and (coalesce(success_measures,'') = '' or replace(success_measures, chr(13), '') = $old$Timely planning and review with timely corrective action as per Annexure B.

Grading Schema — Annexure B — Planning, Tracking & Team Development
# | Objective | Target | Weight
• 1 | Planning and Tracking | Monthly plan (next) and actual (previous) finalised by 28th. Weekly plan & actual by Friday EOD. Review by 3rd. 100% follow-up on actions. | 15%
• 2 | No Ball Dropped | 100% company policy compliance. Zero obvious mistakes/month. Zero commitments missed/month. | 15%
• 3 | Two Case Studies Each Month | Per month | 5%$old$);
-- Omkar Yelgandalkar · Product Awareness  ←  Org Chart: Product Awareness [High]
update public.goals set success_measures = $sm$a. 100 OLF Staff and 1000 Teachers will visit the FAQ self-help each month by end of December.
For more details see Annexure C.

Grading Schema — Annexure C — Product Awareness
▸ Measure a — Monthly Milestones & Scoring

Measure a: OLF Staff and Teachers visiting the FAQ self-help. Weight: 15% (up to 15 points each month).

Review month (staff / teachers) | 100% 15 points | 80–99% 11 points | 60–79% 7 points | 40–59% 3 points | Below 40% 0 points
• October 2026 | 50 / 500 | 40–49 / 400–499 | 30–39 / 300–399 | 20–29 / 200–299 | Under 20 / under 200
• November 2026 | 75 / 750 | 60–74 / 600–749 | 45–59 / 450–599 | 30–44 / 300–449 | Under 30 / under 300
• December 2026 | 100 / 1,000 | 80–99 / 800–999 | 60–79 / 600–799 | 40–59 / 400–599 | Under 40 / under 400

Each month is scored out of 15 points on the lower of the staff and teacher achievements against that month's milestone.$sm$
 where year = 'June 2026 - May 2027' and member = 'Omkar Yelgandalkar' and goal = 'Product Awareness'
   and (coalesce(success_measures,'') = '' or replace(success_measures, chr(13), '') = $old$2 user awareness trainings each month.
User forum and self-help resources maintained.

Grading Schema — Annexure C — User Awareness & Self-Help
# | Objective | Target | Weight
• 1 | User Awareness Trainings for OLF Staff (2nd & 4th Saturday each month) | 2 trainings/month. Video + knowledge verification form circulated 2 weeks prior. High user feedback within 2 days post-training. | 5%
• 2 | Set up a web-based user forum for FAQs — easily searchable and kept updated | Live by end of Sep 25. Kept updated with latest FAQs. | 5%
• 3 | Complete and upload 4 self-help topics (PDF + Video) each month on the app. Ensure self-help is well organised and easy to use. | 4 self-help topics (PDF + Video) per month. | 5%$old$);
-- Omkar Yelgandalkar · Ship Product  ←  Org Chart: Ship Product [High]
update public.goals set success_measures = $sm$a. Timely release (Friday, 6 pm) - 5%
b. No fatal and critical defects on go-live - 10%
Grading as per Annexure D.

Grading Schema — Annexure D — Ship Product
# | Objective | Weight | Outcome | Score
• 1 | Timely release (Friday, 6 pm) | 5% | Released by Friday, 6 pm | 5%
•  |  |  | Friday, after 6 pm | 4%
•  |  |  | Saturday | 3%
•  |  |  | Sunday | 1%
•  |  |  | Monday or later | 0%
• 2 | No fatal or critical defects on go-live | 10% | No fatal or critical defects | 10%
•  |  |  | 1 defect | 8%
•  |  |  | 2 defects | 6%
•  |  |  | 3 defects | 4%
•  |  |  | 4 or more defects | 0%$sm$
 where year = 'June 2026 - May 2027' and member = 'Omkar Yelgandalkar' and goal = 'Ship Product'
   and (coalesce(success_measures,'') = '' or replace(success_measures, chr(13), '') = $old$Roadmap document and requirement documents maintained.
Testing of app efficiency.

Grading Schema — Annexure D — Release Quality & Timeliness
# | Objective | Weight | Outcome | Score
• 1 | Timely release (Friday, 6 pm) | 5% | Released by Friday, 6 pm | 5%
• Friday, after 6 pm | 4%
• Saturday | 3%
• Sunday | 1%
• Monday or later | 0%
• 2 | No fatal or critical defects on go-live | 10% | No fatal or critical defects | 10%
• 1 defect | 8%
• 2 defects | 6%
• 3 defects | 4%
• 4 or more defects | 0%$old$);
-- Omkar Yelgandalkar · Self Development  ←  Org Chart: Self Development [High]
update public.goals set success_measures = $sm$Grading Schema — Annexure E — Self Development
$sm$
 where year = 'June 2026 - May 2027' and member = 'Omkar Yelgandalkar' and goal = 'Self Development'
   and coalesce(success_measures,'') = '';
-- Hritik Takawale · Program Implementation and Support  ←  Org Chart: Program Implementation & Support [High]
update public.goals set success_measures = $sm$a. % of SLAs achieved.
b. No. of FATAL or CRITICAL issues unsolved, or solved and then reopened.
c. <2% failure cases in critical screens.
For more details and list of districts supported see Annexure A.

Grading Schema — Annexure A — Program Implementation & Support
▸ Measures & Grading

# | Measure | Weight | Threshold | Score
• a | % of SLAs achieved (see SLA table below) | 30% | 100% | 30%
•  |  |  | 90–99% | 25%
•  |  |  | 76–89% | 20%
•  |  |  | 51–75% | 10%
•  |  |  | 50% or below | 0%
• b | No. of FATAL or CRITICAL issues unsolved, or solved and then reopened | 5% | None | 5%
•  |  |  | 1 issue | 3%
•  |  |  | 2 issues | 1%
•  |  |  | 3 or more | 0%
• c | Failure cases in critical screens (Feed, Leaderboard, Exams) | 5% | Less than 2% | 5%
•  |  |  | 2–3% | 3%
•  |  |  | More than 3% up to 5% | 1%
•  |  |  | More than 5% | 0%

▸ SLA Turnaround Times (Measure a)

Area | # | Task | Details | Fatal | Critical | Moderate | Minor
• Support | 1 | Issues and rectification | Resolve within one day | 4 hr | 1 day | 4 days | 7 days
• Impl | 2 | Requirements for forms & reports from field | Finalise within 2 days of receipt; lead correct design | 1 day | 2 days | 4 days | 7 days
• Impl | 3 | Forms and notifications | After form is finalised | 4 hr | 1 day | 2 days | 7 days
• Impl | 4 | OMR sheet creation | Finalise requirements with teams | 1 day | 3 days | 5 days | 7 days
• Impl | 5 | OMR reading within 1 day of exam | Exam ID — 1 day | 1 day | 1 day | 1 day | 1 day
• Impl | 5.1 | OMR analysis within 3 days of first collection | Timely analysis & rectification | 2 days | 3 days | 4 days | 7 days
• Impl | 6 | Release testing (reports) | After reports released by development | 4 hr | 1 day | 2 days | 3 days
• Others | 7 | Preload setup | As per requirements | 6 hr | 1 day | 2 days | 3 days
• Others | 8 | District setup | After appropriate data is received | 1 day | 2 days | 4 days | 6 days
• Others | 9 | User registration & confirmation | — | 4 hr | 1 day | 2 days | 7 days
• Others | 10 | Adhoc data requirements | — | 3 days | 5 days | 7 days | 10 days
• Others | 11 | WhatsApp responses | Respond to queries on WhatsApp groups for assigned districts | 4 hr | 1 day | 2 days | 4 days

▸ Critical Screens to Monitor (Measure c)

# | Screen | Frequency
• 1 | Feed | Weekly and Monthly
• 2 | Leaderboard | Weekly and Monthly
• 3 | Exams | Weekly and Monthly

▸ Districts Supported

Districts: Amravati, Washim, Yavatmal, Buldhana, Akola (Self); supervises Nagpur div, MP, CG, Bihar

# | State | Division | District
• 1 | Mh | Amravati | Amravati
• 2 | Mh | Amravati | Washim
• 3 | Mh | Amravati | Yavatmal
• 4 | Mh | Amravati | Buldhana
• 5 | Mh | Amravati | Akola
• 6 | Mh | Nagpur | Nagpur Supervise
• 7 | Mh | Nagpur | Bhandara Supervise
• 8 | Mh | Nagpur | Chandrapur Supervise
• 9 | Mh | Nagpur | Wardha Supervise
• 10 | Mh | Nagpur | Gadchiroli Supervise
• 11 | Mh | Nagpur | Gondia Supervise
• 12 | MP | Jabalpur | Seoni Supervise
• 13 | MP | Jabalpur | Balaghat Supervise

# | State | Division | District
• 14 | Bihar | Munger | Begusarai Supervise
• 15 | CG | Raipur | Raipur Supervise
• 16 | CG | Raipur | Gariaband Supervise
• 17 | CG | Raipur | Dhamtari Supervise
• 18 | CG | Bilaspur | Raigarh Supervise
• 19 | CG | Bilaspur | Janjgir Champa Supervise
• 20 | CG | Durg | Durg Supervise
• 21 | CG | Durg | Rajnandgaon Supervise
• 22 | CG | Durg | Kabirdham Supervise
• 23 | CG | Jagdalpur | Bastar Supervise
• 24 | CG | Jagdalpur | Dantewada Supervise
• 25 | CG | Jagdalpur | Sukma Supervise
• 26 | CG | Ambikapur | Jashpur Supervise$sm$
 where year = 'June 2026 - May 2027' and member = 'Hritik Takawale' and goal = 'Program Implementation and Support'
   and coalesce(success_measures,'') = '';
-- Hritik Takawale · Product Awareness  ←  Org Chart: Product Awareness [High]
update public.goals set success_measures = $sm$a. 100 OLF Staff and 1000 Teachers will visit the FAQ self-help each month by end of December.
For more details see Annexure B.

Grading Schema — Annexure B — Product Awareness
▸ Measure a — Monthly Milestones & Scoring

Measure a: OLF Staff and Teachers visiting the FAQ self-help. Weight: 30% (up to 30 points each month).

Review month (staff / teachers) | 100% 30 points | 80–99% 22 points | 60–79% 14 points | 40–59% 6 points | Below 40% 0 points
• October 2026 | 50 / 500 | 40–49 / 400–499 | 30–39 / 300–399 | 20–29 / 200–299 | Under 20 / under 200
• November 2026 | 75 / 750 | 60–74 / 600–749 | 45–59 / 450–599 | 30–44 / 300–449 | Under 30 / under 300
• December 2026 | 100 / 1,000 | 80–99 / 800–999 | 60–79 / 600–799 | 40–59 / 400–599 | Under 40 / under 400

Each month is scored out of 30 points on the lower of the staff and teacher achievements against that month's milestone.$sm$
 where year = 'June 2026 - May 2027' and member = 'Hritik Takawale' and goal = 'Product Awareness'
   and coalesce(success_measures,'') = '';
-- Hritik Takawale · Team Success  ←  Org Chart: Team Success [High]
update public.goals set success_measures = $sm$a. Direct reportees achieve 90% score.
b. No balls dropped (Company policy followed, including weekly planning and review in Staff Connect).
c. No attrition in the team.
For more details see Annexure C.

Grading Schema — Annexure C — Team Success
▸ Measures & Grading

# | Measure | Weight | Threshold | Score
• a | Direct reportees achieve 90% score | 10% | Average score of 90% or more | 10%
•  |  |  | 80–89% | 7%
•  |  |  | 70–79% | 4%
•  |  |  | Below 70% | 0%
• b | No balls dropped (Company policy followed, including weekly planning and review in Staff Connect) — monthly count of policy lapses, obvious mistakes or missed commitments | 5% | None | 5%
•  |  |  | 1 ball dropped | 3%
•  |  |  | 2 or more | 0%
• c | No attrition in the team | 5% | No attrition | 5%
•  |  |  | 1 exit | 2%
•  |  |  | 2 or more exits | 0%

▸ Weekly Planning & Review in Staff Connect (Measure b)

Item | Target
• Weekly plan | Monday EOD
• Weekly review | Friday / Saturday EOD$sm$
 where year = 'June 2026 - May 2027' and member = 'Hritik Takawale' and goal = 'Team Success'
   and coalesce(success_measures,'') = '';
-- Hritik Takawale · Self Development  ←  Org Chart: Self Development [High]
update public.goals set success_measures = $sm$a. 100% achievement of learning activities in the quarter.
b. For more details see Annexure D.

Grading Schema — Annexure D — Self Development
$sm$
 where year = 'June 2026 - May 2027' and member = 'Hritik Takawale' and goal = 'Self Development'
   and coalesce(success_measures,'') = '';
-- Hritik Takawale · Ship Product  ←  Org Chart: Ship Product [High]
update public.goals set success_measures = $sm$a. Timely release (Friday, 6 pm) - 5%
b. No fatal and critical defects on go-live - 10%
Grading as per Annexure E.

Grading Schema — Annexure E — Ship Product
# | Objective | Weight | Outcome | Score
• 1 | Timely release (Friday, 6 pm) | 5% | Released by Friday, 6 pm | 5%
•  |  |  | Friday, after 6 pm | 4%
•  |  |  | Saturday | 3%
•  |  |  | Sunday | 1%
•  |  |  | Monday or later | 0%
• 2 | No fatal or critical defects on go-live | 10% | No fatal or critical defects | 10%
•  |  |  | 1 defect | 8%
•  |  |  | 2 defects | 6%
•  |  |  | 3 defects | 4%
•  |  |  | 4 or more defects | 0%$sm$
 where year = 'June 2026 - May 2027' and member = 'Hritik Takawale' and goal = 'Ship Product'
   and coalesce(success_measures,'') = '';
-- Ishwari Potekar · Program Implementation and Support  ←  Org Chart: Program Implementation & Support [High]
update public.goals set success_measures = $sm$a. % of SLAs achieved.
b. No. of FATAL or CRITICAL issues unsolved, or solved and then reopened.
c. <2% failure cases in critical screens.
For more details and list of districts see Annexure A.

Grading Schema — Annexure A — Program Implementation & Support
▸ Measures & Grading

# | Measure | Weight | Threshold | Score
• a | % of SLAs achieved (see SLA table below) | 30% | 100% | 30%
•  |  |  | 90–99% | 25%
•  |  |  | 76–89% | 20%
•  |  |  | 51–75% | 10%
•  |  |  | 50% or below | 0%
• b | No. of FATAL or CRITICAL issues unsolved, or solved and then reopened | 5% | None | 5%
•  |  |  | 1 issue | 3%
•  |  |  | 2 issues | 1%
•  |  |  | 3 or more | 0%
• c | Failure cases in critical screens (Program Dashboard, AI, Awards, Certificates, User Profile Points) | 5% | Less than 2% | 5%
•  |  |  | 2–3% | 3%
•  |  |  | More than 3% up to 5% | 1%
•  |  |  | More than 5% | 0%

▸ SLA Turnaround Times (Measure a)

Area | # | Task | Details | Fatal | Critical | Moderate | Minor
• Support | 1 | Issues and rectification | Resolve within one day | 4 hr | 1 day | 4 days | 7 days
• Impl | 2 | Requirements for forms & reports from field | Finalise within 2 days of receipt; lead correct design | 1 day | 2 days | 4 days | 7 days
• Impl | 3 | Forms and notifications | After form is finalised | 4 hr | 1 day | 2 days | 7 days
• Impl | 4 | OMR sheet creation | Finalise requirements with teams | 1 day | 3 days | 5 days | 7 days
• Impl | 5 | OMR reading within 1 day of exam | Exam ID — 1 day | 1 day | 1 day | 1 day | 1 day
• Impl | 5.1 | OMR analysis within 3 days of first collection | Timely analysis & rectification | 2 days | 3 days | 4 days | 7 days
• Impl | 6 | Release testing (reports) | After reports released by development | 4 hr | 1 day | 2 days | 3 days
• Others | 7 | Preload setup | As per requirements | 6 hr | 1 day | 2 days | 3 days
• Others | 8 | District setup | After appropriate data is received | 1 day | 2 days | 4 days | 6 days
• Others | 9 | User registration & confirmation | — | 4 hr | 1 day | 2 days | 7 days
• Others | 10 | Adhoc data requirements | — | 3 days | 5 days | 7 days | 10 days
• Others | 11 | WhatsApp responses | Respond to queries on WhatsApp groups for assigned districts | 4 hr | 1 day | 2 days | 4 days

▸ Critical Screens to Monitor (Measure c)

# | Screen | Frequency
• 1 | Program Dashboard | Weekly and Monthly
• 2 | AI | Weekly and Monthly
• 3 | Awards | Weekly and Monthly
• 4 | Certificates | Monthly
• 5 | User Profile Points | Weekly and Monthly

▸ Districts Supported

Districts: Pune, Solapur (Self); Nandurbar, Dhule (Interim); supervises Konkan, Nashik, Ch. Sambhajinagar, Pune divisions

# | State | Division | District
• 1 | Maharashtra | Pune | Pune
• 2 | Maharashtra | Pune | Solapur
• 3 | Maharashtra | Nashik | Nandurbar Interim
• 4 | Maharashtra | Nashik | Dhule Interim
• 5 | Maharashtra | Konkan | Palghar Supervise
• 6 | Maharashtra | Konkan | Thane Supervise
• 7 | Maharashtra | Konkan | BMC Supervise
• 8 | Maharashtra | Nashik | Nashik Supervise
• 9 | Maharashtra | Nashik | Ahilyanagar Supervise
• 10 | Maharashtra | Nashik | Jalgaon Supervise
• 11 | Maharashtra | Konkan | Raigarh MH Supervise
• 12 | Maharashtra | Konkan | Ratnagiri Supervise

# | State | Division | District
• 13 | Maharashtra | Konkan | Sindhudurg Supervise
• 14 | Maharashtra | Ch. Sambhajinagar | Beed Supervise
• 15 | Maharashtra | Ch. Sambhajinagar | Jalna Supervise
• 16 | Maharashtra | Ch. Sambhajinagar | Ch. Sambhajinagar Dist Supervise
• 17 | Maharashtra | Ch. Sambhajinagar | Nanded Supervise
• 18 | Maharashtra | Ch. Sambhajinagar | Hingoli Supervise
• 19 | Maharashtra | Ch. Sambhajinagar | Parbhani Supervise
• 20 | Maharashtra | Ch. Sambhajinagar | Dharashiv Supervise
• 21 | Maharashtra | Ch. Sambhajinagar | Latur Supervise
• 22 | Maharashtra | Pune | Satara Supervise
• 23 | Maharashtra | Pune | Sangli Supervise
• 24 | Maharashtra | Pune | Kolhapur Supervise$sm$
 where year = 'June 2026 - May 2027' and member = 'Ishwari Potekar' and goal = 'Program Implementation and Support'
   and coalesce(success_measures,'') = '';
-- Ishwari Potekar · Ship Product  ←  Org Chart: Ship Product [High]
update public.goals set success_measures = $sm$a. Timely release (Friday, 6 pm) - 10%
b. No fatal and critical defects on go-live - 20%
Grading as per Annexure B.

Grading Schema — Annexure B — Ship Product
# | Measure / Objective | A | B | C | D | Weight
• 1 | No fatal and critical defects on go-live (critical cases missed) | 0 | 1 | 2 | ≥3 | 20%
• 2 | Generate and track implementation of 9 small requirements each quarter | 9 | 6 | 3 | <3 | —
▸ 3. Roadmap — 10%
• a | All status for people and programs are 100% accurate on Monday review meetings | —
• b | Zero re-work because of mistakes in requirements (specs well-designed, clear, sound from systems & adoption angle) | —$sm$
 where year = 'June 2026 - May 2027' and member = 'Ishwari Potekar' and goal = 'Ship Product'
   and coalesce(success_measures,'') = '';
-- Ishwari Potekar · Team Success  ←  Org Chart: Team Success [High]
update public.goals set success_measures = $sm$a. Direct reportees achieve 90% score.
b. No balls dropped (Company policy followed, including weekly planning and review in Staff Connect).
c. No attrition in the team.
For more details see Annexure C.

Grading Schema — Annexure C — Team Success
▸ Measures & Grading

# | Measure | Weight | Threshold | Score
• a | Direct reportees achieve 90% score | 10% | Average score of 90% or more | 10%
•  |  |  | 80–89% | 7%
•  |  |  | 70–79% | 4%
•  |  |  | Below 70% | 0%
• b | No balls dropped (Company policy followed, including weekly planning and review in Staff Connect) — monthly count of policy lapses, obvious mistakes or missed commitments | 5% | None | 5%
•  |  |  | 1 ball dropped | 3%
•  |  |  | 2 or more | 0%
• c | No attrition in the team | 5% | No attrition | 5%
•  |  |  | 1 exit | 2%
•  |  |  | 2 or more exits | 0%

▸ Weekly Planning & Review in Staff Connect (Measure b)

Item | Target
• Weekly plan | Monday EOD
• Weekly review | Friday / Saturday EOD$sm$
 where year = 'June 2026 - May 2027' and member = 'Ishwari Potekar' and goal = 'Team Success'
   and coalesce(success_measures,'') = '';
-- Ishwari Potekar · Self Development  ←  Org Chart: Self Development [High]
update public.goals set success_measures = $sm$100% achievement of learning activities in the quarter. For more details see Annexure D.

Grading Schema — Annexure D — Self Development
$sm$
 where year = 'June 2026 - May 2027' and member = 'Ishwari Potekar' and goal = 'Self Development'
   and coalesce(success_measures,'') = '';
-- Vaishnavi Patil · Program Implementation and Support  ←  Org Chart: Program Implementation & Support [High]
update public.goals set success_measures = $sm$a. % of SLAs achieved.
b. No. of FATAL or CRITICAL issues unsolved, or solved and then reopened.
c. <2% failure cases in critical screens.
For more details and list of districts see Annexure A.

Grading Schema — Annexure A — Program Implementation & Support
▸ Measures & Grading

# | Measure | Weight | Threshold | Score
• a | % of SLAs achieved (see SLA table below) | 30% | 100% | 30%
•  |  |  | 90–99% | 25%
•  |  |  | 76–89% | 20%
•  |  |  | 51–75% | 10%
•  |  |  | 50% or below | 0%
• b | No. of FATAL or CRITICAL issues unsolved, or solved and then reopened | 10% | None | 10%
•  |  |  | 1 issue | 6%
•  |  |  | 2 issues | 2%
•  |  |  | 3 or more | 0%
• c | Failure cases in critical screens (Leaderboard) | 10% | Less than 2% | 10%
•  |  |  | 2–3% | 6%
•  |  |  | More than 3% up to 5% | 2%
•  |  |  | More than 5% | 0%

▸ SLA Turnaround Times (Measure a)

Area | # | Task | Details | Fatal | Critical | Moderate | Minor
• Support | 1 | Issues and rectification | Resolve within one day | 4 hr | 1 day | 4 days | 7 days
• Impl | 2 | Requirements for forms & reports from field | Finalise within 2 days of receipt; lead correct design | 1 day | 2 days | 4 days | 7 days
• Impl | 3 | Forms and notifications | After form is finalised | 4 hr | 1 day | 2 days | 7 days
• Impl | 4 | OMR sheet creation | Finalise requirements with teams | 1 day | 3 days | 5 days | 7 days
• Impl | 5 | OMR reading within 1 day of exam | Exam ID — 1 day | 1 day | 1 day | 1 day | 1 day
• Impl | 5.1 | OMR analysis within 3 days of first collection | Timely analysis & rectification | 2 days | 3 days | 4 days | 7 days
• Impl | 6 | Release testing (reports) | After reports released by development | 4 hr | 1 day | 2 days | 3 days
• Others | 7 | Preload setup | As per requirements | 6 hr | 1 day | 2 days | 3 days
• Others | 8 | District setup | After appropriate data is received | 1 day | 2 days | 4 days | 6 days
• Others | 9 | User registration & confirmation | — | 4 hr | 1 day | 2 days | 7 days
• Others | 10 | Adhoc data requirements | — | 3 days | 5 days | 7 days | 10 days
• Others | 11 | WhatsApp responses | Respond to queries on WhatsApp groups for assigned districts | 4 hr | 1 day | 2 days | 4 days

▸ Critical Screens to Monitor (Measure c)

# | Screen | Frequency
• 1 | Leaderboard | Weekly and Monthly

▸ Districts Supported

▸ Districts: Gariaband, Dhamtari, Raipur, Rajnandgaon, Durg, Kabirdham

# | State | Division | District
• 1 | CG | Raipur | Gariaband
• 2 | CG | Raipur | Dhamtari
• 3 | CG | Raipur | Raipur
• 4 | CG | Durg | Rajnandgaon
• 5 | CG | Durg | Durg
• 6 | CG | Durg | Kabirdham$sm$
 where year = 'June 2026 - May 2027' and member = 'Vaishnavi Patil' and goal = 'Program Implementation and Support'
   and coalesce(success_measures,'') = '';
-- Vaishnavi Patil · Data Quality/ Testing  ←  Org Chart: Ship Product [Medium]
update public.goals set success_measures = $sm$a. Timely release (Friday, 6 pm), by syncing with the dev team to ensure no delays - 15%
b. No fatal and critical defects on go-live - 25%
Grading as per Annexure B.

Grading Schema — Annexure B — Ship Product
# | Objective | Weight | Outcome | Score
• 1 | Timely release (Friday, 6 pm), by syncing with the dev team to ensure no delays | 15% | Released by Friday, 6 pm | 15%
•  |  |  | Friday, after 6 pm | 12%
•  |  |  | Saturday | 9%
•  |  |  | Sunday | 3%
•  |  |  | Monday or later | 0%
• 2 | No fatal or critical defects on go-live | 25% | No fatal or critical defects | 25%
•  |  |  | 1 defect | 20%
•  |  |  | 2 defects | 15%
•  |  |  | 3 defects | 10%
•  |  |  | 4 or more defects | 0%$sm$
 where year = 'June 2026 - May 2027' and member = 'Vaishnavi Patil' and goal = 'Data Quality/ Testing'
   and coalesce(success_measures,'') = '';
-- Vaishnavi Patil · Team Work and Self Develpoment  ←  Org Chart: Self Development [Medium]
update public.goals set success_measures = $sm$Grading Schema — Annexure C — Self Development
$sm$
 where year = 'June 2026 - May 2027' and member = 'Vaishnavi Patil' and goal = 'Team Work and Self Develpoment'
   and coalesce(success_measures,'') = '';
-- Vaishnavi Patil · Growth & Learning  ←  Org Chart: Self Development [Medium]
update public.goals set success_measures = $sm$Grading Schema — Annexure C — Self Development
$sm$
 where year = 'June 2026 - May 2027' and member = 'Vaishnavi Patil' and goal = 'Growth & Learning'
   and coalesce(success_measures,'') = '';
-- Vishal Tupkar · Program Implementation and Support  ←  Org Chart: Program Implementation & Support [High]
update public.goals set success_measures = $sm$a. % of SLAs achieved.
b. No. of FATAL or CRITICAL issues unsolved, or solved and then reopened.
c. <2% failure cases in critical screens.
For more details and list of districts see Annexure A.

Grading Schema — Annexure A — Program Implementation & Support
▸ Measures & Grading

# | Measure | Weight | Threshold | Score
• a | % of SLAs achieved (see SLA table below) | 30% | 100% | 30%
•  |  |  | 90–99% | 25%
•  |  |  | 76–89% | 20%
•  |  |  | 51–75% | 10%
•  |  |  | 50% or below | 0%
• b | No. of FATAL or CRITICAL issues unsolved, or solved and then reopened | 10% | None | 10%
•  |  |  | 1 issue | 6%
•  |  |  | 2 issues | 2%
•  |  |  | 3 or more | 0%
• c | Failure cases in critical screens (Main User Feed) | 10% | Less than 2% | 10%
•  |  |  | 2–3% | 6%
•  |  |  | More than 3% up to 5% | 2%
•  |  |  | More than 5% | 0%

▸ SLA Turnaround Times (Measure a)

Area | # | Task | Details | Fatal | Critical | Moderate | Minor
• Support | 1 | Issues and rectification | Resolve within one day | 4 hr | 1 day | 4 days | 7 days
• Impl | 2 | Requirements for forms & reports from field | Finalise within 2 days of receipt; lead correct design | 1 day | 2 days | 4 days | 7 days
• Impl | 3 | Forms and notifications | After form is finalised | 4 hr | 1 day | 2 days | 7 days
• Impl | 4 | OMR sheet creation | Finalise requirements with teams | 1 day | 3 days | 5 days | 7 days
• Impl | 5 | OMR reading within 1 day of exam | Exam ID — 1 day | 1 day | 1 day | 1 day | 1 day
• Impl | 5.1 | OMR analysis within 3 days of first collection | Timely analysis & rectification | 2 days | 3 days | 4 days | 7 days
• Impl | 6 | Release testing (reports) | After reports released by development | 4 hr | 1 day | 2 days | 3 days
• Others | 7 | Preload setup | As per requirements | 6 hr | 1 day | 2 days | 3 days
• Others | 8 | District setup | After appropriate data is received | 1 day | 2 days | 4 days | 6 days
• Others | 9 | User registration & confirmation | — | 4 hr | 1 day | 2 days | 7 days
• Others | 10 | Adhoc data requirements | — | 3 days | 5 days | 7 days | 10 days
• Others | 11 | WhatsApp responses | Respond to queries on WhatsApp groups for assigned districts | 4 hr | 1 day | 2 days | 4 days

▸ Critical Screens to Monitor (Measure c)

# | Screen | Frequency
• 1 | Main User Feed | Weekly and Monthly

▸ Districts Supported

Districts: Nagpur, Bhandara, Chandrapur, Wardha, Gadchiroli, Gondia, Seoni, Balaghat

# | State | Division | District
• 2 | Maharashtra | Nagpur | Nagpur
• 3 | Maharashtra | Nagpur | Bhandara
• 4 | Maharashtra | Nagpur | Chandrapur
• 5 | Maharashtra | Nagpur | Wardha

# | State | Division | District
• 6 | Maharashtra | Nagpur | Gadchiroli Interim
• 7 | Maharashtra | Nagpur | GondiaInterim
• 8 | Madhya Pradesh | Jabalpur | SeoniInterim
• 9 | Madhya Pradesh | Jabalpur | BalaghatInterim$sm$
 where year = 'June 2026 - May 2027' and member = 'Vishal Tupkar' and goal = 'Program Implementation and Support'
   and coalesce(success_measures,'') = '';
-- Vishal Tupkar · Data Quality/ Testing  ←  Org Chart: Ship Product [Medium]
update public.goals set success_measures = $sm$a. Timely release (Friday, 6 pm), by syncing with the dev team to ensure no delays - 15%
b. No fatal and critical defects on go-live - 25%
Grading as per Annexure B.

Grading Schema — Annexure B — Ship Product
# | Objective | Weight | Outcome | Score
• 1 | Timely release (Friday, 6 pm), by syncing with the dev team to ensure no delays | 15% | Released by Friday, 6 pm | 15%
•  |  |  | Friday, after 6 pm | 12%
•  |  |  | Saturday | 9%
•  |  |  | Sunday | 3%
•  |  |  | Monday or later | 0%
• 2 | No fatal or critical defects on go-live | 25% | No fatal or critical defects | 25%
•  |  |  | 1 defect | 20%
•  |  |  | 2 defects | 15%
•  |  |  | 3 defects | 10%
•  |  |  | 4 or more defects | 0%$sm$
 where year = 'June 2026 - May 2027' and member = 'Vishal Tupkar' and goal = 'Data Quality/ Testing'
   and coalesce(success_measures,'') = '';
-- Vishal Tupkar · Team Work and Self Develpoment  ←  Org Chart: Self Development [Medium]
update public.goals set success_measures = $sm$Grading Schema — Annexure C — Self Development
$sm$
 where year = 'June 2026 - May 2027' and member = 'Vishal Tupkar' and goal = 'Team Work and Self Develpoment'
   and coalesce(success_measures,'') = '';
-- Sanket Sapkal · Program Implementation and Support  ←  Org Chart: Program Implementation & Support [High]
update public.goals set success_measures = $sm$a. % of SLAs achieved.
b. No. of FATAL or CRITICAL issues unsolved, or solved and then reopened.
c. <2% failure cases in critical screens.
For more details and list of districts see Annexure A.

Grading Schema — Annexure A — Program Implementation & Support
▸ Measures & Grading

# | Measure | Weight | Threshold | Score
• a | % of SLAs achieved (see SLA table below) | 30% | 100% | 30%
•  |  |  | 90–99% | 25%
•  |  |  | 76–89% | 20%
•  |  |  | 51–75% | 10%
•  |  |  | 50% or below | 0%
• b | No. of FATAL or CRITICAL issues unsolved, or solved and then reopened | 10% | None | 10%
•  |  |  | 1 issue | 6%
•  |  |  | 2 issues | 2%
•  |  |  | 3 or more | 0%
• c | Failure cases in critical screens (Exams Section) | 10% | Less than 2% | 10%
•  |  |  | 2–3% | 6%
•  |  |  | More than 3% up to 5% | 2%
•  |  |  | More than 5% | 0%

▸ SLA Turnaround Times (Measure a)

Area | # | Task | Details | Fatal | Critical | Moderate | Minor
• Support | 1 | Issues and rectification | Resolve within one day | 4 hr | 1 day | 4 days | 7 days
• Impl | 2 | Requirements for forms & reports from field | Finalise within 2 days of receipt; lead correct design | 1 day | 2 days | 4 days | 7 days
• Impl | 3 | Forms and notifications | After form is finalised | 4 hr | 1 day | 2 days | 7 days
• Impl | 4 | OMR sheet creation | Finalise requirements with teams | 1 day | 3 days | 5 days | 7 days
• Impl | 5 | OMR reading within 1 day of exam | Exam ID — 1 day | 1 day | 1 day | 1 day | 1 day
• Impl | 5.1 | OMR analysis within 3 days of first collection | Timely analysis & rectification | 2 days | 3 days | 4 days | 7 days
• Impl | 6 | Release testing (reports) | After reports released by development | 4 hr | 1 day | 2 days | 3 days
• Others | 7 | Preload setup | As per requirements | 6 hr | 1 day | 2 days | 3 days
• Others | 8 | District setup | After appropriate data is received | 1 day | 2 days | 4 days | 6 days
• Others | 9 | User registration & confirmation | — | 4 hr | 1 day | 2 days | 7 days
• Others | 10 | Adhoc data requirements | — | 3 days | 5 days | 7 days | 10 days
• Others | 11 | WhatsApp responses | Respond to queries on WhatsApp groups for assigned districts | 4 hr | 1 day | 2 days | 4 days

▸ Critical Screens to Monitor (Measure c)

# | Screen | Frequency
• 1 | Exams Section | Weekly and Monthly

▸ Districts Supported

Districts: Raigarh, Jashpur, Janjgir Champa, Bastar, Sukma, Dantewada, Begusarai

# | State | Division | District
• 1 | CG | Bilaspur | Raigarh
• 2 | CG | Ambikapur | Jashpur
• 3 | CG | Bilaspur | Janjgir Champa
• 4 | CG | Jagdalpur | Bastar
• 5 | CG | Jagdalpur | Sukma
• 6 | CG | Jagdalpur | Dantewada
• 7 | Bihar | Munger | Begusarai$sm$
 where year = 'June 2026 - May 2027' and member = 'Sanket Sapkal' and goal = 'Program Implementation and Support'
   and coalesce(success_measures,'') = '';
-- Sanket Sapkal · Ensure high quality data in the system  ←  Org Chart: Ship Product [Medium]
update public.goals set success_measures = $sm$a. Timely release (Friday, 6 pm), by syncing with the dev team to ensure no delays - 15%
b. No fatal and critical defects on go-live - 25%
Grading as per Annexure B.

Grading Schema — Annexure B — Ship Product
# | Objective | Weight | Outcome | Score
• 1 | Timely release (Friday, 6 pm), by syncing with the dev team to ensure no delays | 15% | Released by Friday, 6 pm | 15%
•  |  |  | Friday, after 6 pm | 12%
•  |  |  | Saturday | 9%
•  |  |  | Sunday | 3%
•  |  |  | Monday or later | 0%
• 2 | No fatal or critical defects on go-live | 25% | No fatal or critical defects | 25%
•  |  |  | 1 defect | 20%
•  |  |  | 2 defects | 15%
•  |  |  | 3 defects | 10%
•  |  |  | 4 or more defects | 0%$sm$
 where year = 'June 2026 - May 2027' and member = 'Sanket Sapkal' and goal = 'Ensure high quality data in the system'
   and coalesce(success_measures,'') = '';
-- Sanket Sapkal · Team Work and Self Develpoment  ←  Org Chart: Self Development [Medium]
update public.goals set success_measures = $sm$Grading Schema — Annexure C — Self Development
$sm$
 where year = 'June 2026 - May 2027' and member = 'Sanket Sapkal' and goal = 'Team Work and Self Develpoment'
   and coalesce(success_measures,'') = '';
-- Riya Demapure · Program Implementation and Support  ←  Org Chart: Program Implementation & Support [High]
update public.goals set success_measures = $sm$a. % of SLAs achieved.
b. No. of FATAL or CRITICAL issues unsolved, or solved and then reopened.
c. <2% failure cases in critical screens.
For more details and list of districts see Annexure A.

Grading Schema — Annexure A — Program Implementation & Support
▸ Measures & Grading

# | Measure | Weight | Threshold | Score
• a | % of SLAs achieved (see SLA table below) | 30% | 100% | 30%
•  |  |  | 90–99% | 25%
•  |  |  | 76–89% | 20%
•  |  |  | 51–75% | 10%
•  |  |  | 50% or below | 0%
• b | No. of FATAL or CRITICAL issues unsolved, or solved and then reopened | 10% | None | 10%
•  |  |  | 1 issue | 6%
•  |  |  | 2 issues | 2%
•  |  |  | 3 or more | 0%
• c | Failure cases in critical screens (Certificates and User Points) | 10% | Less than 2% | 10%
•  |  |  | 2–3% | 6%
•  |  |  | More than 3% up to 5% | 2%
•  |  |  | More than 5% | 0%

▸ SLA Turnaround Times (Measure a)

Area | # | Task | Details | Fatal | Critical | Moderate | Minor
• Support | 1 | Issues and rectification | Resolve within one day | 4 hr | 1 day | 4 days | 7 days
• Impl | 2 | Requirements for forms & reports from field | Finalise within 2 days of receipt; lead correct design | 1 day | 2 days | 4 days | 7 days
• Impl | 3 | Forms and notifications | After form is finalised | 4 hr | 1 day | 2 days | 7 days
• Impl | 4 | OMR sheet creation | Finalise requirements with teams | 1 day | 3 days | 5 days | 7 days
• Impl | 5 | OMR reading within 1 day of exam | Exam ID — 1 day | 1 day | 1 day | 1 day | 1 day
• Impl | 5.1 | OMR analysis within 3 days of first collection | Timely analysis & rectification | 2 days | 3 days | 4 days | 7 days
• Impl | 6 | Release testing (reports) | After reports released by development | 4 hr | 1 day | 2 days | 3 days
• Others | 7 | Preload setup | As per requirements | 6 hr | 1 day | 2 days | 3 days
• Others | 8 | District setup | After appropriate data is received | 1 day | 2 days | 4 days | 6 days
• Others | 9 | User registration & confirmation | — | 4 hr | 1 day | 2 days | 7 days
• Others | 10 | Adhoc data requirements | — | 3 days | 5 days | 7 days | 10 days
• Others | 11 | WhatsApp responses | Respond to queries on WhatsApp groups for assigned districts | 4 hr | 1 day | 2 days | 4 days

▸ Critical Screens to Monitor (Measure c)

# | Screen | Frequency
• 1 | Certificates | Weekly and Monthly
• 2 | User Points | Weekly and Monthly

▸ Districts Supported

Districts: Palghar, Thane, BMC, Raigarh MH, Ratnagiri, Sindhudurg (Interim: Nashik, Ahilyanagar, Jalgaon)

# | State | Division | District
• 2 | Maharashtra | Konkan | Palghar
• 3 | Maharashtra | Konkan | Thane
• 4 | Maharashtra | Konkan | BMC
• 5 | Maharashtra | Konkan | Raigarh MH

# | State | Division | District
• 6 | Maharashtra | Konkan | Ratnagiri
• 7 | Maharashtra | Konkan | Sindhudurg
• 8 | Maharashtra | Nashik | Nashik Interim
• 9 | Maharashtra | Nashik | Ahilyanagar Interim
• 10 | Maharashtra | Nashik | Jalgaon Interim$sm$
 where year = 'June 2026 - May 2027' and member = 'Riya Demapure' and goal = 'Program Implementation and Support'
   and coalesce(success_measures,'') = '';
-- Riya Demapure · Data Quality/ Testing  ←  Org Chart: Ship Product [Medium]
update public.goals set success_measures = $sm$a. Timely release (Friday, 6 pm), by syncing with the dev team to ensure no delays - 15%
b. No fatal and critical defects on go-live - 25%
Grading as per Annexure B.

Grading Schema — Annexure B — Ship Product
# | Objective | Weight | Outcome | Score
• 1 | Timely release (Friday, 6 pm), by syncing with the dev team to ensure no delays | 15% | Released by Friday, 6 pm | 15%
•  |  |  | Friday, after 6 pm | 12%
•  |  |  | Saturday | 9%
•  |  |  | Sunday | 3%
•  |  |  | Monday or later | 0%
• 2 | No fatal or critical defects on go-live | 25% | No fatal or critical defects | 25%
•  |  |  | 1 defect | 20%
•  |  |  | 2 defects | 15%
•  |  |  | 3 defects | 10%
•  |  |  | 4 or more defects | 0%$sm$
 where year = 'June 2026 - May 2027' and member = 'Riya Demapure' and goal = 'Data Quality/ Testing'
   and coalesce(success_measures,'') = '';
-- Riya Demapure · Team Work and Self Develpoment  ←  Org Chart: Self Development [Medium]
update public.goals set success_measures = $sm$Grading Schema — Annexure C — Self Development
$sm$
 where year = 'June 2026 - May 2027' and member = 'Riya Demapure' and goal = 'Team Work and Self Develpoment'
   and coalesce(success_measures,'') = '';
-- Prajakta Nakade · Program Implementation and Support  ←  Org Chart: Program Implementation & Support [High]
update public.goals set success_measures = $sm$a. % of SLAs achieved.
b. No. of FATAL or CRITICAL issues unsolved, or solved and then reopened.
c. <2% failure cases in critical screens.
For more details and list of districts see Annexure A.

Grading Schema — Annexure A — Program Implementation & Support
▸ Measures & Grading

# | Measure | Weight | Threshold | Score
• a | % of SLAs achieved (see SLA table below) | 30% | 100% | 30%
•  |  |  | 90–99% | 25%
•  |  |  | 76–89% | 20%
•  |  |  | 51–75% | 10%
•  |  |  | 50% or below | 0%
• b | No. of FATAL or CRITICAL issues unsolved, or solved and then reopened | 10% | None | 10%
•  |  |  | 1 issue | 6%
•  |  |  | 2 issues | 2%
•  |  |  | 3 or more | 0%
• c | Failure cases in critical screens (Pragati and Learno AI) | 10% | Less than 2% | 10%
•  |  |  | 2–3% | 6%
•  |  |  | More than 3% up to 5% | 2%
•  |  |  | More than 5% | 0%

▸ SLA Turnaround Times (Measure a)

Area | # | Task | Details | Fatal | Critical | Moderate | Minor
• Support | 1 | Issues and rectification | Resolve within one day | 4 hr | 1 day | 4 days | 7 days
• Impl | 2 | Requirements for forms & reports from field | Finalise within 2 days of receipt; lead correct design | 1 day | 2 days | 4 days | 7 days
• Impl | 3 | Forms and notifications | After form is finalised | 4 hr | 1 day | 2 days | 7 days
• Impl | 4 | OMR sheet creation | Finalise requirements with teams | 1 day | 3 days | 5 days | 7 days
• Impl | 5 | OMR reading within 1 day of exam | Exam ID — 1 day | 1 day | 1 day | 1 day | 1 day
• Impl | 5.1 | OMR analysis within 3 days of first collection | Timely analysis & rectification | 2 days | 3 days | 4 days | 7 days
• Impl | 6 | Release testing (reports) | After reports released by development | 4 hr | 1 day | 2 days | 3 days
• Others | 7 | Preload setup | As per requirements | 6 hr | 1 day | 2 days | 3 days
• Others | 8 | District setup | After appropriate data is received | 1 day | 2 days | 4 days | 6 days
• Others | 9 | User registration & confirmation | — | 4 hr | 1 day | 2 days | 7 days
• Others | 10 | Adhoc data requirements | — | 3 days | 5 days | 7 days | 10 days
• Others | 11 | WhatsApp responses | Respond to queries on WhatsApp groups for assigned districts | 4 hr | 1 day | 2 days | 4 days

▸ Critical Screens to Monitor (Measure c)

# | Screen | Frequency
• 1 | Pragati | Weekly and Monthly
• 2 | Learno AI | Weekly and Monthly

▸ Districts Supported

Districts: Beed, Jalna, Ch. Sambhajinagar, Nanded, Hingoli, Parbhani, Dharashiv, Latur

# | State | Division | District
• 2 | Maharashtra | Ch. Sambhajinagar | Beed
• 3 | Maharashtra | Ch. Sambhajinagar | Jalna
• 4 | Maharashtra | Ch. Sambhajinagar | Ch. Sambhajinagar Dist
• 5 | Maharashtra | Ch. Sambhajinagar | Nanded

# | State | Division | District
• 6 | Maharashtra | Ch. Sambhajinagar | Hingoli
• 7 | Maharashtra | Ch. Sambhajinagar | Parbhani
• 8 | Maharashtra | Ch. Sambhajinagar | Dharashiv
• 9 | Maharashtra | Ch. Sambhajinagar | Latur$sm$
 where year = 'June 2026 - May 2027' and member = 'Prajakta Nakade' and goal = 'Program Implementation and Support'
   and coalesce(success_measures,'') = '';
-- Prajakta Nakade · App Testing, New Releases & Data Monitoring  ←  Org Chart: Ship Product [Medium]
update public.goals set success_measures = $sm$a. Timely release (Friday, 6 pm), by syncing with the dev team to ensure no delays - 15%
b. No fatal and critical defects on go-live - 25%
Grading as per Annexure B.

Grading Schema — Annexure B — Ship Product
# | Objective | Weight | Outcome | Score
• 1 | Timely release (Friday, 6 pm), by syncing with the dev team to ensure no delays | 15% | Released by Friday, 6 pm | 15%
•  |  |  | Friday, after 6 pm | 12%
•  |  |  | Saturday | 9%
•  |  |  | Sunday | 3%
•  |  |  | Monday or later | 0%
• 2 | No fatal or critical defects on go-live | 25% | No fatal or critical defects | 25%
•  |  |  | 1 defect | 20%
•  |  |  | 2 defects | 15%
•  |  |  | 3 defects | 10%
•  |  |  | 4 or more defects | 0%$sm$
 where year = 'June 2026 - May 2027' and member = 'Prajakta Nakade' and goal = 'App Testing, New Releases & Data Monitoring'
   and coalesce(success_measures,'') = '';
-- Prajakta Nakade · Self Development and Team Work  ←  Org Chart: Self Development [Medium]
update public.goals set success_measures = $sm$Grading Schema — Annexure C — Self Development
$sm$
 where year = 'June 2026 - May 2027' and member = 'Prajakta Nakade' and goal = 'Self Development and Team Work'
   and coalesce(success_measures,'') = '';
-- Ishwari Gaikwad · Program Implementation and Support  ←  Org Chart: Program Implementation & Support [High]
update public.goals set success_measures = $sm$a. % of SLAs achieved.
b. No. of FATAL or CRITICAL issues unsolved, or solved and then reopened.
c. <2% failure cases in critical screens.
For more details and list of districts see Annexure A.

Grading Schema — Annexure A — Program Implementation & Support
▸ Measures & Grading

# | Measure | Weight | Threshold | Score
• a | % of SLAs achieved (see SLA table below) | 30% | 100% | 30%
•  |  |  | 90–99% | 25%
•  |  |  | 76–89% | 20%
•  |  |  | 51–75% | 10%
•  |  |  | 50% or below | 0%
• b | No. of FATAL or CRITICAL issues unsolved, or solved and then reopened | 10% | None | 10%
•  |  |  | 1 issue | 6%
•  |  |  | 2 issues | 2%
•  |  |  | 3 or more | 0%
• c | Failure cases in critical screens (Certificates and User Portfolio Points) | 10% | Less than 2% | 10%
•  |  |  | 2–3% | 6%
•  |  |  | More than 3% up to 5% | 2%
•  |  |  | More than 5% | 0%

▸ SLA Turnaround Times (Measure a)

Area | # | Task | Details | Fatal | Critical | Moderate | Minor
• Support | 1 | Issues and rectification | Resolve within one day | 4 hr | 1 day | 4 days | 7 days
• Impl | 2 | Requirements for forms & reports from field | Finalise within 2 days of receipt; lead correct design | 1 day | 2 days | 4 days | 7 days
• Impl | 3 | Forms and notifications | After form is finalised | 4 hr | 1 day | 2 days | 7 days
• Impl | 4 | OMR sheet creation | Finalise requirements with teams | 1 day | 3 days | 5 days | 7 days
• Impl | 5 | OMR reading within 1 day of exam | Exam ID — 1 day | 1 day | 1 day | 1 day | 1 day
• Impl | 5.1 | OMR analysis within 3 days of first collection | Timely analysis & rectification | 2 days | 3 days | 4 days | 7 days
• Impl | 6 | Release testing (reports) | After reports released by development | 4 hr | 1 day | 2 days | 3 days
• Others | 7 | Preload setup | As per requirements | 6 hr | 1 day | 2 days | 3 days
• Others | 8 | District setup | After appropriate data is received | 1 day | 2 days | 4 days | 6 days
• Others | 9 | User registration & confirmation | — | 4 hr | 1 day | 2 days | 7 days
• Others | 10 | Adhoc data requirements | — | 3 days | 5 days | 7 days | 10 days
• Others | 11 | WhatsApp responses | Respond to queries on WhatsApp groups for assigned districts | 4 hr | 1 day | 2 days | 4 days

▸ Critical Screens to Monitor (Measure c)

# | Screen | Frequency
• 1 | Certificates | Weekly and Monthly
• 2 | User Portfolio Points | Weekly and Monthly

▸ Districts Supported

▸ Districts: Nandurbar, Dhule, Nashik, Ahilyanagar, Jalgaon

# | State | Division | District
• 1 | Maharashtra | Nashik | Nandurbar
• 2 | Maharashtra | Nashik | Dhule
• 3 | Maharashtra | Nashik | Nashik
• 4 | Maharashtra | Nashik | Ahilyanagar
• 5 | Maharashtra | Nashik | Jalgaon$sm$
 where year = 'June 2026 - May 2027' and member = 'Ishwari Gaikwad' and goal = 'Program Implementation and Support'
   and coalesce(success_measures,'') = '';
-- Ishwari Gaikwad · Data Monitoring  ←  Org Chart: Ship Product [Medium]
update public.goals set success_measures = $sm$a. Timely release (Friday, 6 pm), by syncing with the dev team to ensure no delays - 15%
b. No fatal and critical defects on go-live - 25%
Grading as per Annexure B.

Grading Schema — Annexure B — Ship Product
# | Objective | Weight | Outcome | Score
• 1 | Timely release (Friday, 6 pm), by syncing with the dev team to ensure no delays | 15% | Released by Friday, 6 pm | 15%
•  |  |  | Friday, after 6 pm | 12%
•  |  |  | Saturday | 9%
•  |  |  | Sunday | 3%
•  |  |  | Monday or later | 0%
• 2 | No fatal or critical defects on go-live | 25% | No fatal or critical defects | 25%
•  |  |  | 1 defect | 20%
•  |  |  | 2 defects | 15%
•  |  |  | 3 defects | 10%
•  |  |  | 4 or more defects | 0%$sm$
 where year = 'June 2026 - May 2027' and member = 'Ishwari Gaikwad' and goal = 'Data Monitoring'
   and coalesce(success_measures,'') = '';
-- Ishwari Gaikwad · Team work  ←  Org Chart: Self Development [Medium]
update public.goals set success_measures = $sm$Grading Schema — Annexure C — Self Development
$sm$
 where year = 'June 2026 - May 2027' and member = 'Ishwari Gaikwad' and goal = 'Team work'
   and coalesce(success_measures,'') = '';
-- Truppti Salve · Program Implementation and Support  ←  Org Chart: Program Implementation & Support [High]
update public.goals set success_measures = $sm$a. % of SLAs achieved.
b. No. of FATAL or CRITICAL issues unsolved, or solved and then reopened.
c. <2% failure cases in critical screens.
For more details and list of districts see Annexure A.

Grading Schema — Annexure A — Program Implementation & Support
▸ Measures & Grading

# | Measure | Weight | Threshold | Score
• a | % of SLAs achieved (see SLA table below) | 30% | 100% | 30%
•  |  |  | 90–99% | 25%
•  |  |  | 76–89% | 20%
•  |  |  | 51–75% | 10%
•  |  |  | 50% or below | 0%
• b | No. of FATAL or CRITICAL issues unsolved, or solved and then reopened | 10% | None | 10%
•  |  |  | 1 issue | 6%
•  |  |  | 2 issues | 2%
•  |  |  | 3 or more | 0%
• c | Failure cases in critical screens (Awards Uploads) | 10% | Less than 2% | 10%
•  |  |  | 2–3% | 6%
•  |  |  | More than 3% up to 5% | 2%
•  |  |  | More than 5% | 0%

▸ SLA Turnaround Times (Measure a)

Area | # | Task | Details | Fatal | Critical | Moderate | Minor
• Support | 1 | Issues and rectification | Resolve within one day | 4 hr | 1 day | 4 days | 7 days
• Impl | 2 | Requirements for forms & reports from field | Finalise within 2 days of receipt; lead correct design | 1 day | 2 days | 4 days | 7 days
• Impl | 3 | Forms and notifications | After form is finalised | 4 hr | 1 day | 2 days | 7 days
• Impl | 4 | OMR sheet creation | Finalise requirements with teams | 1 day | 3 days | 5 days | 7 days
• Impl | 5 | OMR reading within 1 day of exam | Exam ID — 1 day | 1 day | 1 day | 1 day | 1 day
• Impl | 5.1 | OMR analysis within 3 days of first collection | Timely analysis & rectification | 2 days | 3 days | 4 days | 7 days
• Impl | 6 | Release testing (reports) | After reports released by development | 4 hr | 1 day | 2 days | 3 days
• Others | 7 | Preload setup | As per requirements | 6 hr | 1 day | 2 days | 3 days
• Others | 8 | District setup | After appropriate data is received | 1 day | 2 days | 4 days | 6 days
• Others | 9 | User registration & confirmation | — | 4 hr | 1 day | 2 days | 7 days
• Others | 10 | Adhoc data requirements | — | 3 days | 5 days | 7 days | 10 days
• Others | 11 | WhatsApp responses | Respond to queries on WhatsApp groups for assigned districts | 4 hr | 1 day | 2 days | 4 days

▸ Critical Screens to Monitor (Measure c)

# | Screen | Frequency
• 1 | Awards Uploads | Weekly and Monthly

▸ Districts Supported

▸ Districts: Satara, Sangli, Kohlapur

# | State | Division | District
• 1 | Maharashtra | Pune | Satara
• 2 | Maharashtra | Pune | Sangli
• 3 | Maharashtra | Pune | Kohlapur$sm$
 where year = 'June 2026 - May 2027' and member = 'Truppti Salve' and goal = 'Program Implementation and Support'
   and coalesce(success_measures,'') = '';
-- Truppti Salve · Data monitoring, App testing  ←  Org Chart: Ship Product [Medium]
update public.goals set success_measures = $sm$a. Timely release (Friday, 6 pm), by syncing with the dev team to ensure no delays - 15%
b. No fatal and critical defects on go-live - 25%
Grading as per Annexure B.

Grading Schema — Annexure B — Ship Product
# | Objective | Weight | Outcome | Score
• 1 | Timely release (Friday, 6 pm), by syncing with the dev team to ensure no delays | 15% | Released by Friday, 6 pm | 15%
•  |  |  | Friday, after 6 pm | 12%
•  |  |  | Saturday | 9%
•  |  |  | Sunday | 3%
•  |  |  | Monday or later | 0%
• 2 | No fatal or critical defects on go-live | 25% | No fatal or critical defects | 25%
•  |  |  | 1 defect | 20%
•  |  |  | 2 defects | 15%
•  |  |  | 3 defects | 10%
•  |  |  | 4 or more defects | 0%$sm$
 where year = 'June 2026 - May 2027' and member = 'Truppti Salve' and goal = 'Data monitoring, App testing'
   and coalesce(success_measures,'') = '';
-- Truppti Salve · Self Development and Team Work  ←  Org Chart: Self Development [Medium]
update public.goals set success_measures = $sm$Grading Schema — Annexure C — Self Development
$sm$
 where year = 'June 2026 - May 2027' and member = 'Truppti Salve' and goal = 'Self Development and Team Work'
   and coalesce(success_measures,'') = '';
commit;

notify pgrst, 'reload schema';
