/**
 * OLF StaffConnect - Whole Organization Architecture Data
 * Extracted from official OLF OrgChart 2026-27 (OLF_OrgChart_03Aug_update (1).html)
 * Includes Executive L0, 5 Pillars L1, Sub-Departments (IT-Ops, Product Enablement, Program Insights),
 * Annexures definitions, and complete 20-Role Scorecards.
 */

(function () {
  "use strict";

  // --- Executive & 5 Pillars Structure ---
  const ORG_TREE = {
    ceo: {
      id: "n-ceo",
      roleId: "ceo",
      title: "CEO",
      name: "Sanjay Dalmia",
      interim: false
    },
    strategy: {
      id: "n-strategy",
      roleId: "strategy",
      title: "Strategy & Network",
      name: "Rajeev Kumar",
      interim: false
    },
    pillars: [
      {
        id: "col-fundraising",
        title: "Partnerships & Fundraising",
        head: { id: "n-fundraising", roleId: "head-partnership", title: "Head — Partnerships", name: "Sanjay Dalmia", interim: true },
        nodes: [
          { id: "n-servicing", roleId: "partnership-mgr", title: "Partnerships Manager", name: "Sowmya Srinivasan", isSubDept: true, subDeptId: "partnerships", interim: false }
        ]
      },
      {
        id: "col-cos",
        title: "Chief of Staff & Finance",
        head: { id: "n-cos", roleId: "cos", title: "Chief of Staff", name: "Reena Dalmia", interim: false },
        nodes: [
          { id: "n-finance", roleId: "finance", title: "Accounts & Finance", name: "Anjali J Dandile", interim: false },
          { id: "n-admin", roleId: "office-admin", title: "Office Administration", name: "Vishal D Nagawade", interim: false }
        ]
      },
      {
        id: "col-coo",
        title: "Operations & Programs (COO)",
        head: { id: "n-coo", roleId: "coo", title: "COO", name: "Vishvajit G Pawar", interim: false },
        nodes: [
          // Departments (Hierarchies & Sub-Departments)
          { id: "n-state", roleId: "state-head", title: "Program Implementation", name: "Field Hierarchy", isProgramTree: true },
          { id: "n-curation", roleId: "curation-lead", title: "Content & Curations", name: "Vaidehi M Shhalu", isSubDept: true, subDeptId: "curations" },
          { id: "n-insights", roleId: "prog-insights", title: "Program Insights", name: "Prashant Bhondve", isSubDept: true, subDeptId: "prog-insights" },
          // Roles (Displayed below departments)
          { id: "n-gov", roleId: "prog-gov", title: "Program Governance", name: "Hemant Kumar Sahu", interim: false },
          { id: "n-prodadopt", roleId: "prod-enable", title: "Product Enablement", name: "Bharat Sinha", interim: false },
          { id: "n-talent", roleId: "talent-acquisition", title: "Talent Acquisition", name: "Raghav Duggal", interim: false },
          { id: "n-teamdev", roleId: "team-dev", title: "Team Development", name: "Aditee Wakalkar", interim: false }
        ]
      },
      {
        id: "col-platform",
        title: "Product & Platform",
        head: { id: "n-platform", roleId: "platform", title: "Head — Product & Platform", name: "Craig H Dsouza", interim: false },
        nodes: [
          { id: "n-itops", roleId: "itops", title: "IT-Ops", name: "Omkar Yelgandalkar", isSubDept: true, subDeptId: "itops" }
        ]
      },
      {
        id: "col-community",
        title: "Community Development",
        head: { id: "n-community", roleId: "community", title: "Community Development", name: "Tejal Hande", interim: false },
        nodes: [
          { id: "n-marketing", roleId: "marketing-mgr", title: "Community Marketing", name: "Vaibhavi Ratish Kumar", isSubDept: true, subDeptId: "community-marketing", interim: false },
          { id: "n-volunteering", roleId: "events-mgr", title: "Lifeskills", name: "Anjali Bisht", interim: false },
          { id: "n-george", roleId: "advisory-george", title: "Professor Emeritus — Community Building", name: "George Varghese", interim: false },
          { id: "n-shalini", roleId: "advisory-shalini", title: "Consultant — Strategic Advisory", name: "Shalini Agarwal", interim: false }
        ]
      }
    ]
  };

  // --- Sub-Department Trees ---
  const SUB_DEPTS = {
    "itops": {
      title: "IT Operations — Omkar Yelgandalkar",
      tree: {
            id: 'craig', title: 'Head - Product and Platform', name: 'Craig H Dsouza', kind: 'state-lead', dir: 'col', children: [
                {
                    id: 'omkar', title: 'IT Ops Manager', name: 'Omkar Yelgandalkar', email: 'omkar@openlinksfoundation.org', kind: 'manager', dir: 'row', children: [
                        {
                            id: 'hritik', title: 'Technical Lead', name: 'Hritik Takawale', email: 'hritik@openlinksfoundation.org', kind: 'lead', dir: 'col', children: [
                                { id: 'vaishnavi', title: 'IT Ops Associate', name: 'Vaishnavi Patil', email: 'vaishnavi@openlinksfoundation.org', kind: 'member' },
                                { id: 'vishal', title: 'IT Ops Associate', name: 'Vishal Tupkar', email: 'vishal.tupkar@openlinksfoundation.org', kind: 'member' },
                                { id: 'sanket', title: 'IT Ops Associate', name: 'Sanket Sapkal', email: 'sanket@openlinksfoundation.org', kind: 'member' },
                                { id: 'aryan', title: 'IT Operations Associate', name: 'Aryan J Kadhikhaye', email: 'aryan@openlinksfoundation.org', kind: 'member' }
                            ]
                        },
                        {
                            id: 'ishwari', title: 'Technical Lead', name: 'Ishwari Potekar', email: 'ishwari@openlinksfoundation.org', kind: 'lead', dir: 'col', children: [
                                { id: 'riya', title: 'IT Ops Associate', name: 'Riya Demapure', email: 'riya@openlinksfoundation.org', kind: 'member' },
                                { id: 'prajakta', title: 'IT Ops Associate', name: 'Prajakta Nakade', email: 'prajakta@openlinksfoundation.org', kind: 'member' },
                                { id: 'alisha', title: 'Associate - IT Ops', name: 'Alisha R Khandare', email: 'alisha@openlinksfoundation.org', kind: 'member' },
                                { id: 'ishwari-g', title: 'IT Ops Intern', name: 'Ishwari Gaikwad', email: 'ishwari.g@openlinksfoundation.org', kind: 'member' },
                                { id: 'trupti', title: 'IT Ops Intern', name: 'Trupti Salve', email: 'trupti@openlinksfoundation.org', kind: 'member' }
                            ]
                        }
                    ]
                }
            ]
        }
    },
    "prog-insights": {
      title: "Program Insights — Prashant Bhondve",
      manager: { id: "prashant", title: "Manager — Program Insights", name: "Prashant Bhondve", email: "prashant@openlinksfoundation.org" },
      analysts: [
        { id: "omkar-sinare", title: "Analyst — Program Insights", name: "Omkar Sinare", email: "omkarsinare@openlinksfoundation.org" },
        { id: "akash-ghule", title: "Analyst — Program Insights", name: "Akash Ghule", email: "akash.g@openlinksfoundation.org" },
        { id: "shrisai-bandal", title: "Analyst — Program Insights", name: "Shrisai Vijaykant Bandal", email: "shrisai.olf@gmail.com" },
        { id: "om-bhandwalkar", title: "Analyst — Program Insights", name: "Om S Bhandwalkar", email: "ombhandwalkar.olf@gmail.com" },
        { id: "amit-padhen", title: "Analyst — Program Insights", name: "Amit D Padhen", email: "amit@openlinksfoundation.org" }
      ]
    },
    "curations": {
      title: "Content & Curations — Vaidehi M Shhalu",
      lead: { id: "vaidehi", roleId: "curation-lead", title: "Curations Manager", name: "Vaidehi M Shhalu", email: "vaidehi@openlinksfoundation.org", reportingManager: "Vishvajit G Pawar" },
      contentTeam: [
        { id: "bhimrao", roleId: "content-associate", title: "Senior Content Associate", name: "Bhimrao Dhondu Suralkar", email: "bhimrao@openlinksfoundation.org", tag: "Senior", reportingManager: "Priyanshi Arora" },
        { id: "nikita", roleId: "content-associate", title: "Pune HO - Content", name: "Nikita Mahadev Patre", email: "nikita@openlinksfoundation.org", tag: "Associate", reportingManager: "Priyanshi Arora" },
        { id: "sakshi", roleId: "content-associate", title: "Program Associate - Content & Curations", name: "Sakshi V Latale", email: "sakshi@openlinksfoundation.org", tag: "Associate", reportingManager: "Vaidehi M Shhalu" }
      ],
      curationTeam: [
        { id: "bhushan", roleId: "curation-associate", title: "Program Associate - Content & Curations", name: "Bhushan G Rathod", email: "bhushan@openlinksfoundation.org", tag: "Associate", reportingManager: "Vaidehi M Shhalu" },
        { id: "sadhna", roleId: "curation-associate", title: "Program Associate - Content & Curations", name: "Sadhna Ladiya", email: "sadhna@openlinksfoundation.org", tag: "Associate", reportingManager: "Vaidehi M Shhalu" },
        { id: "rushikesh", roleId: "curation-associate", title: "Program Associate - Curation", name: "Rushikesh Kailas Shelar", email: "rushikesh.s@openlinksfoundation.org", tag: "Associate", reportingManager: "Vaidehi M Shhalu" },
        { id: "yuvraj", roleId: "curation-associate", title: "Program Associate - Curation", name: "Yuvraj Mane", email: "yuvraj@openlinksfoundation.org", tag: "Associate", reportingManager: "Vaidehi M Shhalu" },
        { id: "sagar", roleId: "curation-associate", title: "Program Associate Curation", name: "Sagar S Dayma", email: "sagar.d@openlinksfoundation.org", tag: "Associate", reportingManager: "Vaidehi M Shhalu" },
        { id: "mahadevi", roleId: "curation-associate", title: "Program Associate - Curation", name: "Mahadevi Rathod", email: "mahadevirathod.olf@gmail.com", tag: "Associate", reportingManager: "Vaidehi M Shhalu" }
      ]
    },
    "partnerships": {
      title: "Partnerships & Founder's Office — Sowmya Srinivasan",
      lead: { id: "sowmya", roleId: "partnership-mgr", title: "Partnerships Manager", name: "Sowmya Srinivasan", email: "sowmya@openlinksfoundation.org", reportingManager: "Sanjay Dalmia" },
      members: [
        { id: "prashant-g", roleId: "partnerships-team", title: "Partnerships Associate", name: "Prashant S Gajbhiye", email: "prashant.g@openlinksfoundation.org", tag: "Associate" },
        { id: "naveed", roleId: "partnerships-team", title: "Partnerships Associate", name: "Naveed M T", email: "naveed@openlinksfoundation.org", tag: "Associate" },
        { id: "neetika", roleId: "partnerships-team", title: "Associate Founder's Office", name: "Neetika S Verma", email: "neetika@openlinksfoundation.org", tag: "Associate" },
        { id: "priyanshi", roleId: "partnerships-team", title: "Associate Founder's Office", name: "Priyanshi Arora", email: "priyanshi@openlinksfoundation.org", tag: "Associate" }
      ]
    },
    "community-marketing": {
      title: "Community Marketing & Communications — Vaibhavi Ratish Kumar",
      lead: { id: "vaibhavi", roleId: "marketing-mgr", title: "Manager — Community Marketing", name: "Vaibhavi Ratish Kumar", email: "vaibhavi@openlinksfoundation.org", reportingManager: "Reena Dalmia" },
      members: [
        { id: "anushka", roleId: "marketing-team", title: "Program Associate — Communications", name: "Anushka Banerjee", email: "anushka@openlinksfoundation.org", tag: "Associate" },
        { id: "ashutosh", roleId: "marketing-team", title: "Research Associate", name: "Ashutosh Ghag", email: "ashutosh@openlinksfoundation.org", tag: "Associate" }
      ]
    }
  };

  // --- Official Annexures ---
  const ANN_A = `
  <p class="annex-note" style="margin-bottom:12px">
    Impact targets are set per district for <strong>Academic programs</strong>, <strong>Life Skills</strong>,
    <strong>Vibrant Teacher Community</strong> and <strong>Systemic Impact</strong>.
    Actual 25-26 baselines and 26-27 targets are to be filled in district-wise.
  </p>
  <table class="annex-table">
    <thead>
      <tr>
        <th>#</th><th>Program / Metric</th>
        <th class="center">Enrolled<br>25-26</th>
        <th class="center">Enrolled<br>26-27</th>
        <th class="center">Passed<br>25-26</th>
        <th class="center">Passed<br>26-27</th>
      </tr>
    </thead>
    <tbody>
      <tr class="cat-head"><td colspan="6">Academic</td></tr>
      <tr><td>1</td><td>Help students pass Class 10th board exams</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td class="center col-yr">—</td></tr>
      <tr><td>2</td><td>Help students pass Class 12th board exams</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td class="center col-yr">—</td></tr>
      <tr><td>3</td><td>Help students pass Scholarship exams</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td class="center col-yr">—</td></tr>
      <tr><td>4</td><td>Help students become Nipun</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td class="center col-yr">—</td></tr>
      <tr><td>5</td><td>Help students pass JEE / NEET</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td class="center col-yr">—</td></tr>
      <tr class="cat-head"><td colspan="6">Life Skill Programs</td></tr>
      <tr><td>1</td><td>Posts — Storytelling, Poetry Recitation, Spoken English, Creative Writing</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td class="center col-yr">—</td></tr>
      <tr><td>2</td><td>Students showing improvement in Life Skills</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td class="center col-yr">—</td></tr>
      <tr class="cat-head"><td colspan="6">Vibrant Teacher Community</td></tr>
      <tr><td>1</td><td>Unique teachers posting each month</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td colspan="2"></td></tr>
      <tr><td>2</td><td>Weekly Active Users (WAU)</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td colspan="2"></td></tr>
      <tr><td>3</td><td>Teacher Recognition events</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td colspan="2"></td></tr>
      <tr class="cat-head"><td colspan="6">Systemic Impact</td></tr>
      <tr><td>1</td><td>Category A</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td colspan="2"></td></tr>
      <tr><td>2</td><td>Category B</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td colspan="2"></td></tr>
      <tr><td>3</td><td>Category C</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td colspan="2"></td></tr>
      <tr><td>4</td><td>Category D</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td colspan="2"></td></tr>
    </tbody>
  </table>`;

const ANN_B = `
  <p class="annex-note" style="margin-bottom:12px">
    Targets for districts / management added <strong>after 31 Mar 2026</strong>.
    Systemic Impact weightage applies across categories below.
  </p>
  <table class="annex-table">
    <thead>
      <tr><th>#</th><th>Systemic Impact Category</th><th class="center">Weightage (26-27)</th></tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>Category A</td><td class="center"><span class="score-pill">20%</span></td></tr>
      <tr><td>2</td><td>Category B</td><td class="center"><span class="score-pill">20%</span></td></tr>
      <tr><td>3</td><td>Category C</td><td class="center"><span class="score-pill">30%</span></td></tr>
      <tr><td>4</td><td>Category D</td><td class="center"><span class="score-pill">30%</span></td></tr>
    </tbody>
  </table>`;

const ANN_C = `
  <p class="annex-note" style="margin-bottom:12px">
    Agreed span of control — maximum direct reports per manager type.
  </p>
  <table class="annex-table">
    <thead>
      <tr>
        <th>Role</th>
        <th class="center">Category A</th>
        <th class="center">Category B</th>
        <th class="center">Category C</th>
        <th class="center">Category D</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>POs per District</td>
        <td class="center"><span class="score-pill">4</span></td>
        <td class="center"><span class="score-pill">3</span></td>
        <td class="center"><span class="score-pill">2</span></td>
        <td class="center"><span class="score-pill">1</span></td>
      </tr>
      <tr class="cat-head"><td colspan="5">Maximum span of control</td></tr>
      <tr><td>PM / PO</td><td class="center"><span class="score-pill">4</span></td><td colspan="3" class="center">—</td></tr>
      <tr><td>Div Mgr / PO</td><td class="center"><span class="score-pill">12</span></td><td colspan="3" class="center">—</td></tr>
      <tr><td>Manager / Reportee</td><td class="center"><span class="score-pill">4</span></td><td colspan="3" class="center">—</td></tr>
    </tbody>
  </table>`;

const ANN_D = `
  <p class="annex-note" style="margin-bottom:12px">People development targets for the team:</p>
  <div class="annex-note"><span class="n-num">1</span>80% of the Field team will be able to present (a) Vinoba overview + Demo &amp; (b) Product offerings — effectively with grade A/B.</div>
  <div class="annex-note"><span class="n-num">2</span>80% of POs will be proficient with grade A/B in the skills expected of POs.</div>
  <div class="annex-note"><span class="n-num">3</span>XX POs will be ready for PM roles.</div>`;

/* ── COO-specific annexures (populated from SG Sheet 26-27) ── */
const COO_ANN_A = `
  <p class="annex-note" style="margin-bottom:12px">
    Drive District Transformation — Achieved in 25-26 vs Goal for 26-27 across
    <strong>Academic Programs</strong>, <strong>Life Skills</strong>,
    <strong>Recognition Events (Vibrant Teacher Community)</strong> and <strong>Systemic Impact</strong>.
  </p>
  <table class="annex-table">
    <thead>
      <tr>
        <th>#</th><th>Academic Program</th><th>Unit</th>
        <th class="center">Enrolled<br>25-26</th><th class="center">Enrolled<br>26-27</th>
        <th class="center">Passed<br>25-26</th><th class="center">Passed<br>26-27</th>
        <th class="center">Achieved<br>25-26</th><th class="center">Goal<br>26-27</th>
      </tr>
    </thead>
    <tbody>
      <tr class="cat-head"><td colspan="9">Academic</td></tr>
      <tr><td>1</td><td>FLN Program (Class 1-5)</td><td>% students Nipun</td><td class="center col-yr">10,21,722</td><td class="center col-yr">14,22,432</td><td class="center col-yr">4,79,638</td><td class="center col-yr">7,75,020</td><td class="center">46.9%</td><td class="center">54.5%</td></tr>
      <tr><td>2</td><td>FLN ++ (Class 6-8)</td><td>% students Nipun</td><td class="center col-yr">1,33,031</td><td class="center col-yr">1,35,666</td><td class="center col-yr">33,902</td><td class="center col-yr">47,928</td><td class="center">25.5%</td><td class="center">35.3%</td></tr>
      <tr><td>3</td><td>Class 10 Exam</td><td>District result %</td><td class="center col-yr">1,43,203</td><td class="center col-yr">1,79,276</td><td class="center col-yr">1,20,598</td><td class="center col-yr">1,67,973</td><td class="center">84.2%</td><td class="center">93.7%</td></tr>
      <tr><td>4</td><td>Class 12 Exam</td><td>District result %</td><td class="center col-yr">1,02,323</td><td class="center col-yr">1,34,409</td><td class="center col-yr">85,616</td><td class="center col-yr">1,19,036</td><td class="center">83.7%</td><td class="center">88.6%</td></tr>
      <tr><td>5</td><td>JNV</td><td>Students pass</td><td class="center col-yr">57,912</td><td class="center col-yr">1,77,020</td><td class="center col-yr">661</td><td class="center col-yr">1,421</td><td class="center">1.1%</td><td class="center">0.8%</td></tr>
      <tr><td>6</td><td>SE 05/04</td><td>Students pass</td><td class="center col-yr">2,87,891</td><td class="center col-yr">2,62,912</td><td class="center col-yr">67,627</td><td class="center col-yr">74,370</td><td class="center">23.5%</td><td class="center">28.3%</td></tr>
      <tr><td>7</td><td>SE 08/07</td><td>Students pass</td><td class="center col-yr">1,32,208</td><td class="center col-yr">1,45,876</td><td class="center col-yr">35,631</td><td class="center col-yr">41,065</td><td class="center">27.0%</td><td class="center">28.2%</td></tr>
      <tr><td>8</td><td>NMMSE</td><td>Students pass</td><td class="center col-yr">78,756</td><td class="center col-yr">98,673</td><td class="center col-yr">12,437</td><td class="center col-yr">18,427</td><td class="center">15.8%</td><td class="center">18.7%</td></tr>
      <tr><td>9</td><td>JEE / NEET (Polestar)</td><td>Students qualify</td><td class="center col-yr">8,736</td><td class="center col-yr">9,050</td><td class="center col-yr">92</td><td class="center col-yr">190</td><td class="center">1.1%</td><td class="center">2.1%</td></tr>
      <tr><td>10</td><td>ISRO/NASA/IUCAA/Research Station Visit</td><td>Students qualify</td><td class="center col-yr">13,581</td><td class="center col-yr">73,000</td><td class="center col-yr">1,400</td><td class="center col-yr">2,450</td><td class="center">10.3%</td><td class="center">3.4%</td></tr>
      <tr><td>11</td><td>Ajitdada Pawar Shishyavruti Pariksha (Pune ZP) (4-8)</td><td>Students pass</td><td class="center col-yr">0</td><td class="center col-yr">70,000</td><td class="center col-yr">0</td><td class="center col-yr">3,500</td><td class="center">—</td><td class="center">5.0%</td></tr>
      <tr style="font-weight:600"><td></td><td>Total</td><td></td><td class="center col-yr">19,79,363</td><td class="center col-yr">27,08,314</td><td class="center col-yr">8,37,602</td><td class="center col-yr">12,51,380</td><td class="center">42.3%</td><td class="center">46.2%</td></tr>
    </tbody>
  </table>

  <table class="annex-table" style="margin-top:16px">
    <thead>
      <tr><th>#</th><th>Life Skills Program</th><th>Unit</th><th class="center">Achieved 25-26</th><th class="center">Goal 26-27</th></tr>
    </thead>
    <tbody>
      <tr class="cat-head"><td colspan="5">Life Skill Programs</td></tr>
      <tr><td>1</td><td>Posts in LS Programs (ST, PR, CW, SE)</td><td>No. of posts</td><td class="center col-yr">2,29,822</td><td class="center col-yr">3,31,590</td></tr>
      <tr><td>2</td><td>Students improved in LS (Streak)</td><td>No. of students</td><td class="center col-yr">—</td><td class="center col-yr">62,893</td></tr>
      <tr style="font-weight:600"><td></td><td>Total</td><td></td><td class="center col-yr">2,29,822</td><td class="center col-yr">3,94,483</td></tr>
    </tbody>
  </table>

  <table class="annex-table" style="margin-top:16px">
    <thead>
      <tr><th>#</th><th>Recognition Program</th><th>Unit</th><th class="center">Achieved 25-26</th><th class="center">Goal 26-27</th></tr>
    </thead>
    <tbody>
      <tr class="cat-head"><td colspan="5">Recognition Events (Vibrant Teacher Community)</td></tr>
      <tr><td>1</td><td>Teachers' posting (monthly)</td><td>No. of teachers</td><td class="center col-yr">16,234</td><td class="center col-yr">21,168</td></tr>
      <tr><td>2</td><td>Weekly Active Users</td><td>No. of teachers</td><td class="center col-yr">10,393</td><td class="center col-yr">14,402</td></tr>
      <tr><td>3</td><td>Recognition Events (D, B, NS, SU)</td><td>No. of events</td><td class="center col-yr">2,770</td><td class="center col-yr">14,113</td></tr>
      <tr><td>4</td><td>Teachers recognised in events</td><td>No. of teachers</td><td class="center col-yr">8,962</td><td class="center col-yr">16,124</td></tr>
      <tr style="font-weight:600"><td></td><td>Total</td><td></td><td class="center col-yr">38,359</td><td class="center col-yr">65,807</td></tr>
    </tbody>
  </table>

  <table class="annex-table" style="margin-top:16px">
    <thead>
      <tr><th>#</th><th>Systemic Impact (Districts before 31 Mar 2026)</th><th class="center">Achieved 25-26</th><th class="center">Goal 26-27</th></tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>Category A</td><td class="center"><span class="score-pill">5</span></td><td class="center"><span class="score-pill">21</span></td></tr>
      <tr><td>2</td><td>Category B</td><td class="center"><span class="score-pill">15</span></td><td class="center"><span class="score-pill">13</span></td></tr>
      <tr><td>3</td><td>Category C</td><td class="center"><span class="score-pill">7</span></td><td class="center"><span class="score-pill">8</span></td></tr>
      <tr><td>4</td><td>Category D</td><td class="center"><span class="score-pill">15</span></td><td class="center"><span class="score-pill">0</span></td></tr>
      <tr style="font-weight:600"><td></td><td>Total</td><td class="center col-yr">42</td><td class="center col-yr">42</td></tr>
    </tbody>
  </table>
  <p class="annex-note" style="margin-top:8px">Target distribution: 50% districts in A, 20% B, 20% C, 10% D.</p>`;

const COO_ANN_B = `
  <p class="annex-note" style="margin-bottom:12px">
    Systemic Impact for districts / management added <strong>after 1 Apr 2026</strong>.
    Target distribution: 30% in A, 30% B, 20% C, 20% D.
  </p>
  <table class="annex-table">
    <thead>
      <tr><th>#</th><th>Systemic Impact Category</th><th class="center">Achieved 25-26</th><th class="center">Goal 26-27</th></tr>
    </thead>
    <tbody>
      <tr><td>1</td><td>Category A</td><td class="center"><span class="score-pill">0</span></td><td class="center"><span class="score-pill">0</span></td></tr>
      <tr><td>2</td><td>Category B</td><td class="center"><span class="score-pill">0</span></td><td class="center"><span class="score-pill">9</span></td></tr>
      <tr><td>3</td><td>Category C</td><td class="center"><span class="score-pill">0</span></td><td class="center"><span class="score-pill">3</span></td></tr>
      <tr><td>4</td><td>Category D</td><td class="center"><span class="score-pill">12</span></td><td class="center"><span class="score-pill">0</span></td></tr>
      <tr style="font-weight:600"><td></td><td>Total</td><td class="center col-yr">12</td><td class="center col-yr">12</td></tr>
    </tbody>
  </table>`;

const COO_ANN_C = `
  <p class="annex-note" style="margin-bottom:12px">
    Maintain staff per span of control. Span of control per PO by category — A: 5, B: 15, C: 7, D: 15.
  </p>
  <table class="annex-table">
    <thead>
      <tr><th>Role</th><th>Basis</th><th class="center">Required 25-26</th><th class="center">Required 26-27</th></tr>
    </thead>
    <tbody>
      <tr><td>POs</td><td>Required as per span of control</td><td class="center col-yr">48</td><td class="center col-yr">77</td></tr>
      <tr><td>PMs</td><td>Required as per span of control</td><td class="center col-yr">13</td><td class="center col-yr">21</td></tr>
      <tr><td>Div</td><td>Required as per span of control</td><td class="center col-yr">2</td><td class="center col-yr">5</td></tr>
      <tr><td>SL</td><td>Required as per span of control</td><td class="center col-yr">2</td><td class="center col-yr">5</td></tr>
      <tr><td>Manager Reportee</td><td>Required as per span of control</td><td class="center col-yr">4</td><td class="center col-yr">4</td></tr>
      <tr style="font-weight:600"><td>Total</td><td></td><td class="center col-yr">69</td><td class="center col-yr">112</td></tr>
    </tbody>
  </table>`;

const COO_ANN_D = `
  <p class="annex-note" style="margin-bottom:12px">Grow people — team development targets (38 POs, 07 PMs, 01 Sr PM, 01 ADM, 01 DM):</p>
  <table class="annex-table">
    <thead>
      <tr><th>#</th><th>Target</th><th>Basis</th><th class="center">Achieved 25-26</th><th class="center">Goal 26-27</th></tr>
    </thead>
    <tbody>
      <tr><td>1a</td><td>Field team able to present Vinoba overview + Demo</td><td>30 of 38</td><td class="center col-yr">20</td><td class="center col-yr">30</td></tr>
      <tr><td>1b</td><td>Present product offerings effectively with grade A/B</td><td>30 of 38</td><td class="center col-yr">20</td><td class="center col-yr">30</td></tr>
      <tr><td>2</td><td>POs proficient with grade A/B in expected PO skills</td><td>32 of 38</td><td class="center col-yr">—</td><td class="center col-yr">—</td></tr>
      <tr><td>3</td><td>POs ready for PM roles</td><td>Annual</td><td class="center col-yr">0</td><td class="center col-yr">5</td></tr>
      <tr><td>4</td><td>PMs ready for DM roles</td><td>Annual</td><td class="center col-yr">1</td><td class="center col-yr">2</td></tr>
    </tbody>
  </table>
  <div class="annex-note" style="margin-top:10px"><span class="n-num">3.A</span>Employee Satisfaction Score ≥ 8.</div>
  <div class="annex-note"><span class="n-num">3.B</span>Manager Feedback Score ≥ 8.</div>
  <div class="annex-note"><span class="n-num">4</span>Attrition &lt; 20% (half-yearly).</div>`;

const COO_ANNEXURES = [
  { title: 'Annexure A — Drive District Transformation (Districts on/before 31 Mar 2026)', content: COO_ANN_A },
  { title: 'Annexure B — Systemic Impact (Districts after 1 Apr 2026)', content: COO_ANN_B },
  { title: 'Annexure C — Span of Control', content: COO_ANN_C },
  { title: 'Annexure D — Grow People / Team Development', content: COO_ANN_D }
];

const ANNEXURES_ABCD = [
  { title: 'Annexure A — Impact Targets (Districts added on/before 31 Mar 2026)', content: ANN_A },
  { title: 'Annexure B — Impact Targets (Districts added after 31 Mar 2026)', content: ANN_B },
  { title: 'Annexure C — Span of Control', content: ANN_C },
  { title: 'Annexure D — People Development Targets', content: ANN_D }
];



  // --- Official 20-Role Scorecards & Details ---
  const ORG_ROLES = {
  ceo: {
    level: 'Leadership',
    title: 'CEO',
    person: 'Sanjay Dalmia',
    hasData: true,
    role: 'Provide overall leadership to Open Links Foundation and the Vinoba Program by defining vision, shaping strategy, building partnerships, and ensuring large-scale impact in improving the quality of education in government schools.',
    resp: [
      'Government and Ecosystem Partnerships — Build and sustain strong relationships with government stakeholders, donors, and strategic partners to enable program expansion and impact.',
      'Organisational Leadership — Build a high-performing, mission-driven organisation with strong values, ownership, and execution excellence.',
      'Program Impact at Scale — Ensure the Vinoba program delivers measurable improvements in academic outcomes, life skills, and system efficiency across geographies.',
      'Resource Mobilisation and Sustainability — Enable sustainable funding and resource mobilisation through donor engagement and strategic partnerships.',
      'Innovation and Thought Leadership — Drive innovation in program design, use of technology, and educational approaches; position Vinoba as a leading model in public education transformation.'
    ],
    goals: [
      { n:1, title:'Solidify Government and Ecosystem Partnerships in Maharashtra and Chhattisgarh', measure:'Five-year MoU with Maharashtra Government; SCERT approval in Chhattisgarh.\nVisit 4 CEOs / Collectors / Secretaries each month.', weight:'20%' },
      { n:2, title:"Build and support a dedicated team that believes in OLF's mission and works with purpose", measure:'Culture and ownership audits.\nInstitutionalise programs and develop team for desired culture.', weight:'20%' },
      { n:3, title:'Program Impact at Scale', measure:'Lead program implementation across districts with high impact. Have the impact measured. (Annexure A).', weight:'20%' },
      { n:4, title:'Resource Mobilisation and Sustainability', measure:'Raise INR 250 Mn for 26-27 and get commitments of INR 150 Mn for 27-28.', weight:'20%' },
      { n:5, title:'Innovation and Thought Leadership', measure:'Data Lakehouse, Single Sign-on, Chakmak, AI — launch and stabilisation. Performance improvement through technology.', weight:'20%' }
    ],
    annexures: [
      { title: 'Annexure A — Program Impact Targets', content: '<table class="annex-table">\n  <thead>\n    <tr>\n      <th rowspan="2">#</th><th rowspan="2">Program / Metric</th>\n      <th class="center" colspan="2">Enrolled</th>\n      <th class="center" colspan="2">Passed</th>\n    </tr>\n    <tr>\n      <th class="center">25-26</th><th class="center">26-27</th>\n      <th class="center">25-26</th><th class="center">26-27</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr class="cat-head"><td colspan="6">Academic</td></tr>\n    <tr><td>1</td><td>Help students pass Class 10th board exams</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td class="center col-yr">—</td></tr>\n    <tr><td>2</td><td>Help students pass Class 12th board exams</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td class="center col-yr">—</td></tr>\n    <tr><td>3</td><td>Help students pass Scholarship exams</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td class="center col-yr">—</td></tr>\n    <tr><td>4</td><td>Help students become Nipun</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td class="center col-yr">—</td></tr>\n    <tr><td>5</td><td>Help students pass JEE / NEET</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td class="center col-yr">—</td></tr>\n    <tr class="cat-head"><td colspan="6">Life Skill Programs</td></tr>\n    <tr><td>1</td><td>Posts — Storytelling, Poetry Recitation, Spoken English, Creative Writing</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td colspan="2"></td></tr>\n    <tr><td>2</td><td>Students showing improvement in Life Skills</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td colspan="2"></td></tr>\n    <tr class="cat-head"><td colspan="6">Vibrant Teacher Community</td></tr>\n    <tr><td>1</td><td>Unique teachers posting each month</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td colspan="2"></td></tr>\n    <tr><td>2</td><td>Weekly Active Users (WAU)</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td colspan="2"></td></tr>\n    <tr><td>3</td><td>Teacher Recognition events</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td colspan="2"></td></tr>\n    <tr class="cat-head"><td colspan="6">Systemic Impact</td></tr>\n    <tr><td>1</td><td>Category A</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td colspan="2"></td></tr>\n    <tr><td>2</td><td>Category B</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td colspan="2"></td></tr>\n    <tr><td>3</td><td>Category C</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td colspan="2"></td></tr>\n    <tr><td>4</td><td>Category D</td><td class="center col-yr">—</td><td class="center col-yr">—</td><td colspan="2"></td></tr>\n  </tbody>\n</table>' }
    ]
  },


  cos: {
    level: 'Head',
    title: 'Chief of Staff',
    person: 'Reena Dalmia',
    reportingManager: 'Sanjay Dalmia',
    hasData: true,
    role: 'To act as a force multiplier to leadership, driving execution, alignment, and organisational effectiveness by ensuring key priorities are delivered across the organisation.',
    resp: [
      'Finance and Reporting — ensure strong financial discipline, transparency, and compliance with donor and regulatory requirements in a timely manner.',
      'People and Culture — strengthen culture, leadership effectiveness, and cross-team alignment to improve execution quality across the organisation.',
      'Special Initiatives — drive high-priority cross-functional initiatives and build critical internal capabilities.'
    ],
    goals: [
      { n:1, title:'Finance and Reporting', measure:'Monthly accounts and reports completed by 10th.\nCompliance with donor and regulatory requirements.', weight:'35%' },
      { n:2, title:'People and Culture', measure:'100% completion of monthly reviews by 5th.\n3 cross-team bottlenecks identified and resolved quarterly. Showcase improvement in efficiency/effectiveness in a few key areas.\nKeep track of people performance — minimum 5 structured interactions/month to assess people issues and team sentiment; 2–3 key people/culture issues identified and resolved monthly.\nMaintain Team Health Score (periodic measurement) and Leadership Effectiveness Score.', weight:'35%' },
      { n:3, title:'Special Initiatives', measure:'Minimum 10 team members become strong presenters each quarter.\nSuccessful onboarding and effectiveness of key roles (e.g. Head – Community).\nWeekly and monthly oversight of Product, Fundraising and Content teams completed.', weight:'30%' }
    ],
    priority: [
      { n:1, goal:'Finance and Reporting', focus:'Clear RACI with Finsmart implemented by June end for Vihar.\nMonthly finance review cadence operational by June end.' },
      { n:2, goal:'People and Culture', focus:'Set up a system with Program Insights, Prog Governance, Head – Community, Vishvajit and Fundraising to ensure monthly reviews.\nSet up system to identify key cross-team bottlenecks.\nSet up system to identify people performance and Leader Effectiveness Score.' },
      { n:3, goal:'Special Initiatives', focus:'Launch presentation capability initiative with first cohort of 3 people.\nCreate presentation assessment rubrics.\nStart weekly cadence for all departments — Content, IT Ops, Lifeskills.\nSupport Rahul on teacher gifts initiative, role clarity, and team goals alignment.' }
    ]
  },


  coo: {
    level: 'COO',
    title: 'COO — Program Implementation',
    person: 'Vishvajit G Pawar',
    reportingManager: 'Sanjay Dalmia',
    hasData: true,
    role: 'Lead data-driven high impact programs. Increase the depth of impact of the program and also have the impact measured. Develop the team with strong values and ownership and focus on the mission.',
    resp: [
      'Lead program implementation across districts with high impact. Have the impact measured.',
      'Build a vibrant teacher community in the districts.',
      'Build and support a dedicated team that believes in OLF\'s mission and works with purpose.',
      'Develop strong and respectful relationships with administrators in districts to identify opportunities and mobilise support.',
      'Develop programs and provide program insights as per requirements.'
    ],
    goals: [
      { n:1, title:'Drive improvement in outcomes — academic programs, life skills & vibrant teacher community', measure:'~~Ensure districts are graded as under:\nDistricts added before 31 Mar 26:\n>>Grade A: 21 (PY 5)\n>>Grade B: 13 (PY 15)\n>>Grade C: 8 (PY 7)\n>>Grade D: 0 (PY 15)\nDistricts added after 01 Apr 26:\n>>Grade A: 0 (PY 0)\n>>Grade B: 9 (PY 0)\n>>Grade C: 3 (PY 0)\n>>Grade D: 0 (PY 12)\n~~For details see Annexures A & B.', weight:'30%' },
      { n:2, title:'Build and support a dedicated, mission-aligned team', measure:'Maintain staff as per agreed span of control (Annexure C).\nGrow people as per Annexure D.\nHalf-yearly ESC ≥ 8; MFS ≥ 8; attrition < 20%.', weight:'40%' },
      { n:3, title:'Develop new product to improve learning outcomes', measure:'Develop one offering to improve results after practice FLN test and implement at scale in ≥ 5 districts with 90% coverage.', weight:'20%' },
      { n:4, title:'Get impact assessment done by a third party', measure:'One assessment each for: academic program, life skill program, vibrant teacher community, and systemic impact.', weight:'10%' }
    ],
    annexures: COO_ANNEXURES,
    priority: [
      { n:1, goal:'Drive improvement in outcomes — academic programs, life skills & vibrant teacher community', focus:'Finalize district-wise outcome targets and baseline. Monthly review mechanism operational & Dashboard available.\nIdentify and implement key interventions required to achieve Annexure A & B targets.\nExpansion in 8 Districts.' },
      { n:2, goal:'Build and support a dedicated, mission-aligned team', focus:'100% successful Induction and Onboarding completion of all new hires as per 100 Days Cycle.' },
      { n:3, goal:'Develop new product to improve learning outcomes', focus:'Set up Product Team with Roles and Responsibilities and Measures of achievement.' },
      { n:4, goal:'Get impact assessment done by a third party', focus:'Onboard a Partner and finalize the research parameters.' }
    ],
  },

  'state-head': {
    level: 'Manager',
    title: 'State Head / Divisional Manager',
    person: '',
    hasData: true,
    role: 'Lead data-driven high impact programs at state level. Increase the depth of impact of the program and also have it measured. Develop the team with strong values, ownership and focus on the mission.',
    resp: [
      'Lead program implementation across districts with high impact.',
      'Build a vibrant teacher community in the districts.',
      'Build and support a dedicated team that believes in OLF\'s mission and works with purpose.',
      'Develop strong and respectful relationships with administrators in districts to identify opportunities and mobilise support.'
    ],
    goals: [
      { n:1, title:'Drive improvement in outcomes — academic, life skills & vibrant teacher community', measure:'Districts added before 31 Mar 26 per Annexure A; added after per Annexure B.', weight:'50%' },
      { n:2, title:'Build and support a dedicated, mission-aligned team', measure:'Maintain staff per span of control (Annexure C). Grow people per Annexure D. ESC ≥ 8; MFS ≥ 8; attrition < 20% (half-yearly).', weight:'30%' },
      { n:3, title:'Identify partnership opportunities', measure:'Detailed writeup on one opportunity each quarter. Launch 3 partnership programs in the year with measurable impact.', weight:'20%' }
    ],
    annexures: ANNEXURES_ABCD,
  },

  'prog-mgr': {
    level: 'Manager',
    title: 'Program Manager',
    person: '',
    hasData: true,
    role: 'Lead data-driven high impact programs at district level. Increase depth of impact and have it measured. Develop the team with strong values, ownership and focus on the mission.',
    resp: [
      'Lead program implementation across districts with high impact.',
      'Build a vibrant teacher community in the districts.',
      'Build and support a dedicated team that believes in OLF\'s mission and works with purpose.',
      'Develop strong and respectful relationships with administrators in districts to identify opportunities and mobilise support.'
    ],
    goals: [
      { n:1, title:'Drive improvement in outcomes — academic, life skills & vibrant teacher community', measure:'Districts added before 31 Mar 26 per Annexure A; added after per Annexure B.', weight:'55%' },
      { n:2, title:'Build and support a dedicated, mission-aligned team', measure:'Staff per span of control (Annexure C). Grow people per Annexure D. ESC ≥ 8; MFS ≥ 8; attrition < 20% (half-yearly).', weight:'15%' },
      { n:3, title:'Identify partnership opportunities', measure:'Detailed writeup each quarter. Launch 2 partnership programs in the year with measurable impact.', weight:'15%' },
      { n:4, title:'Self Development', measure:'Improve on 2 identified competencies.', weight:'15%' }
    ],
    annexures: ANNEXURES_ABCD,
  },


  'prog-gov': {
    level: 'Manager',
    title: 'Sr. Program Manager — Program Governance',
    person: 'Hemant Kumar Sahu',
    reportingManager: 'Vishvajit G Pawar',
    hasData: true,
    role: 'Drive disciplined and goal-oriented program execution through visibility, accountability, escalation, and closure and sharing of best practices.',
    resp: [
      'Drive weekly and monthly reviews, generate actionable insights, and ensure follow-up of action items till closure.',
      'Identify execution gaps, delays, bottlenecks, and implementation issues; escalate them appropriately and ensure timely corrective action.',
      'Ensure governance systems, dashboards, trackers, and review mechanisms provide clear visibility and support disciplined, result-oriented execution.',
      'Collect implementation feedback and share best practices to strengthen the product.'
    ],
    goals: [
      { n:1, title:'Ensure strong review discipline across teams', measure:'~~Drive visibility by ensuring:\n- 100% program reviews are done timely each month\n- Train report data is updated accurately each week for all programs\nFor more information see Annexure A.', weight:'20%' },
      { n:2, title:'Ensure timely escalation and corrective action', measure:'a. Identify early warnings for program bottlenecks. Escalations reviewed with owners till closure.\nb. Ensure visibility, escalation and follow-up leading to 80% of academic programs closing within \u00b12 weeks of planned timeline.\nc. Ensure 80% of planned monthly life-skill program targets achieved.\nFor more information see Annexure B.', weight:'50%' },
      { n:3, title:'Drive field excellence through longer-term improvements', measure:'a. Long-pending action items reviewed weekly with DM + SL + COO. Persistent employee support and review needs are discussed with DM + SL + COO.\nb. Provide root cause analysis of program delays; develop solutions and advocate implementation.\nc. Collect best practices for implementation, product and process improvements \u2014 each quarter \u2014 and help drive change.\nFor more information see Annexure C.', weight:'20%' },
      { n:4, title:'Self Development and High Performance Team', measure:'~~Ensure disciplined execution for self and team.\n~~Demonstrate consistent improvement in competency in day-to-day work related to:\n- Client Relationship: L3 (PY L2)\n- Work Management: L3 (PY L2)\nFor more details see Annexure D.', weight:'10%' }
    ],
    annexures: [
      { title: 'Annexure A — Governance Performance Matrix', content: `
        <table class="annex-table">
          <thead><tr><th>#</th><th>Measure</th><th class="center">Weightage</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>100% monthly reviews completed by 3rd.</td><td class="center"><span class="score-pill">10%</span></td></tr>
            <tr><td>2</td><td>Train Report (Academic, Life Skill) reviewed and accurately updated weekly.</td><td class="center"><span class="score-pill">10%</span></td></tr>
          </tbody>
        </table>
        <table class="annex-table" style="margin-top:16px">
          <thead><tr><th>#</th><th>Governance Performance Measure</th><th class="center">A</th><th class="center">B</th><th class="center">C</th><th class="center">D</th><th class="center">Weightage</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Monthly review discipline maintained</td><td class="center">98%+</td><td class="center">90–98%</td><td class="center">80–89%</td><td class="center">&lt;80%</td><td class="center"><span class="score-pill">10%</span></td></tr>
            <tr><td>2</td><td>Weekly error-free Train Report</td><td class="center">98%+</td><td class="center">90–98%</td><td class="center">80–89%</td><td class="center">&lt;80%</td><td class="center"><span class="score-pill">10%</span></td></tr>
          </tbody>
        </table>` },
      { title: 'Annexure B — Successful Program Execution', content: `
        <table class="annex-table">
          <thead><tr><th>#</th><th>Measure</th><th class="center">Weightage</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Identify early warnings for program bottlenecks. Top 5 action items tracked and completed for every district every month. Escalations reviewed with owners till closure.</td><td class="center"><span class="score-pill">10%</span></td></tr>
            <tr><td>2</td><td>Ensure 80% of academic programs are closed within ± two weeks of planned end date.</td><td class="center"><span class="score-pill">20%</span></td></tr>
            <tr><td>3</td><td>Ensure 80% of life skill programs are achieved monthly.</td><td class="center"><span class="score-pill">20%</span></td></tr>
          </tbody>
        </table>
        <table class="annex-table" style="margin-top:16px">
          <thead><tr><th>#</th><th>Performance Measure for Tracking</th><th class="center">A</th><th class="center">B</th><th class="center">C</th><th class="center">D</th><th class="center">Weightage</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Top 5 action items related to "execution issues" correctly identified for each district monthly. These are added in Nimble.</td><td class="center">98%+</td><td class="center">90–98%</td><td class="center">80–89%</td><td class="center">&lt;80%</td><td class="center"><span class="score-pill">5%</span></td></tr>
            <tr><td>2</td><td>Action items are tracked and completed monthly.</td><td class="center">98%+</td><td class="center">90–98%</td><td class="center">80–89%</td><td class="center">&lt;80%</td><td class="center"><span class="score-pill">5%</span></td></tr>
          </tbody>
        </table>` },
      { title: 'Annexure C — Senior Management Review', content: `
        <table class="annex-table">
          <thead><tr><th>#</th><th>Measure</th><th class="center">Weightage</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Critical / long-pending action items reviewed weekly with DM + SL + COO.</td><td class="center" rowspan="4"><span class="score-pill">20%</span></td></tr>
            <tr><td>2</td><td>Persistent employee support and review needs are discussed with DM + SL + COO.</td></tr>
            <tr><td>3</td><td>Provide root cause analysis of program delays.</td></tr>
            <tr><td>4</td><td>Collect and review implementation feedback from users each quarter and suggest product improvements.</td></tr>
          </tbody>
        </table>
        <table class="annex-table" style="margin-top:16px">
          <thead><tr><th>#</th><th>Senior Management Review Measure</th><th class="center">A</th><th class="center">B</th><th class="center">C</th><th class="center">D</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Weekly Dashboard enables identification and timely resolution of critical execution and people issues.</td><td class="center">98%+</td><td class="center">90–98%</td><td class="center">80–89%</td><td class="center">&lt;80%</td></tr>
            <tr><td>2</td><td>Execution and people issues are discussed and closed timely.</td><td class="center">98%+</td><td class="center">90–98%</td><td class="center">80–89%</td><td class="center">&lt;80%</td></tr>
          </tbody>
        </table>
        <table class="annex-table" style="margin-top:16px">
          <thead><tr><th>3 — Root Cause Analysis Categories</th></tr></thead>
          <tbody>
            <tr><td>Manpower shortage</td></tr>
            <tr><td>Unclear ownership</td></tr>
            <tr><td>Poor planning</td></tr>
            <tr><td>Software issue</td></tr>
            <tr><td>HO Team issue</td></tr>
            <tr><td>Government delay</td></tr>
            <tr><td>Vendor issue</td></tr>
          </tbody>
        </table>` },
      { title: 'Annexure D — Self Development & High Performance', content: `
        <table class="annex-table">
          <thead><tr><th>#</th><th>Objective</th><th class="center">Weightage</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Proper planning and tracking, and no ball dropped.</td><td class="center"><span class="score-pill">5%</span></td></tr>
            <tr><td>2</td><td>Achieve Learning and Development goals. Demonstrate consistent improvement — Client Relationship: L3 (PY L2); Work Management: L3 (PY L2).</td><td class="center"><span class="score-pill">5%</span></td></tr>
          </tbody>
        </table>` }
    ],
    priority: [
      { n:1, goal:'Ensure strong review discipline across teams', focus:'Establish weekly and monthly review system with teams and publish it.\nSet up the right trackers (simpler and easier).' },
      { n:2, goal:'Ensure timely escalation and corrective action', focus:'Compile most common escalations and create timeline-based categorization for Fatal / Critical / Moderate. Set these up in Nimble accordingly.\nCreate structured escalation and corrective action systems.\nGenerate agreement on this with team leads. Pilot it.' },
      { n:3, goal:'Improve management visibility and decision support', focus:'Create dashboard for improving visibility and follow-up of critical / long-pending execution and people issues.' },
      { n:4, goal:'Self Development', focus:'Identify development areas and start working on improvement plan.' }
    ],
  },

  'prod-enable': {
    level: 'Manager',
    title: 'Product Enablement',
    person: 'Bharat Sinha',
    reportingManager: 'Vishvajit G Pawar',
    hasData: true,
    role: 'Drive adoption, smooth implementation, and continuous improvement of Vinoba offerings (Academic and Lifeskills) to improve impact at scale.',
    resp: [
      'Continuously improve product offerings to enhance their effectiveness and efficiency, enabling high-impact implementation of Vinoba programs at scale.',
      'Drive product adoption through targeted growth marketing, development of product champions, and their effective enablement through documentation and training.',
      'Cross-functional Coordination with program, field excellence, technology, and field teams for smoother implementation and improvement.',
      'Build and mentor a high-performing team aligned with OLF\'s values, fostering strong ownership, continuous learning, user empathy, and disciplined execution.'
    ],
    goals: [
      { n:1, title:'Product Improvement and Development', measure:'Develop and implement major product enhancements to achieve:\n__Adoption\n>>15% QoQ increase in Life Skills & Morning Assembly adoption.\n__Quality and turnaround\n>>Reduce OMR reading errors for FLN to 2% for multiple lots and sections.\n>>Ensure reports for all exams are available within 7 days of exam in high quality.\n>>Improve efficiency and effectiveness of Polestar program.\n>>Increase confidence in FLN exams.\nDevelop and implement minor product enhancements as required (about 3 per quarter).\nStrengthen the post-exam review and improvement mechanism for FLN. Pilot and roll out in 5 districts.', weight:'40%' },
      { n:2, title:'Product Adoption and Growth Marketing', measure:'Run growth marketing campaign each quarter:\n>>4 for Life Skill programs (increase adoption 15% QoQ).\n>>4 for academic programs (increased adoption for JEE/NEET, Board Toppers, FLN).\nDevelop 5 product champions across regions/programs each quarter who demonstrate independent usage and solutioning capability.\nProvide good-quality product documentation to improve sales, onboarding and solutioning capacity of the PO team.\n(Details in Annexure A.)', weight:'50%' },
      { n:3, title:'Self Development and High Performance Team', measure:'Ensure disciplined execution for self and team. Demonstrate consistent improvement in competency — Client Relationship: L3 (PY L2); Work Management: L3 (PY L2).\n(Details in Annexure B.)', weight:'10%' }
    ],
    annexures: [
      { title: 'Annexure A — Product Marketing', content: `
        <table class="annex-table">
          <thead><tr><th>#</th><th>Measure</th><th class="center">Weightage</th></tr></thead>
          <tbody>
            <tr><td>1</td><td><strong>Growth Marketing</strong> — Run 1 growth marketing campaign each quarter as per focus area and agreed targets.</td><td class="center"><span class="score-pill">20%</span></td></tr>
            <tr><td>2</td><td><strong>Product Champions</strong> — Coach and develop 10 product champions in each region/program each quarter, who demonstrate independent usage and solutioning capability.</td><td class="center"><span class="score-pill">20%</span></td></tr>
            <tr><td>3</td><td><strong>Product Documentation</strong> — Improve sales, onboarding and solutioning capacity of the PO team by providing good-quality and adequate product documentation for key product offerings.</td><td class="center"><span class="score-pill">10%</span></td></tr>
          </tbody>
        </table>
        <table class="annex-table" style="margin-top:16px">
          <thead><tr><th>Product Documentation includes</th></tr></thead>
          <tbody>
            <tr><td>a. Product presentations, flyers, videos, product FAQ.</td></tr>
            <tr><td>b. Case studies — with impact stories, testimonials and use cases.</td></tr>
            <tr><td>c. Rubrics for measurement and impact.</td></tr>
            <tr><td>d. Onboarding and supporting teachers.</td></tr>
            <tr><td>Develop, maintain and drive usage of product documentation for key product offerings.</td></tr>
            <tr><td>Categorize (A/B/C/D) based on usage/impact and provide usage and impact statistics each quarter.</td></tr>
          </tbody>
        </table>` },
      { title: 'Annexure B — Self Development & High Performance', content: `
        <table class="annex-table">
          <thead><tr><th>#</th><th>Objective</th><th class="center">Weightage</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Proper planning and tracking, and no ball dropped.</td><td class="center"><span class="score-pill">5%</span></td></tr>
            <tr><td>2</td><td>Achieve Learning and Development goals. Demonstrate consistent improvement — Client Relationship: L3 (PY L2); Work Management: L3 (PY L2).</td><td class="center"><span class="score-pill">5%</span></td></tr>
          </tbody>
        </table>` }
    ],
    priority: [
      { n:1, goal:'Strengthen Product Development and Enhancement', focus:'For each product — document the key stakeholders and key steps in their user journeys, and identify the key areas for improvement.' },
      { n:2, goal:'Strengthen Product Marketing, Documentation, and Enablement', focus:'Compile a list of all existing product documentation and categorise these into A/B/C/D. Identify gaps and priorities.\nGrowth marketing for Morning Assembly.' },
      { n:3, goal:'Drive Product Adoption and Scale', focus:'Identify POs / PMs who need support and who can be champions.' },
      { n:4, goal:'Self Development', focus:'Identify development areas and begin a structured improvement plan.' }
    ],
  },

  'prog-insights': {
    level: 'Manager - Program Insights',
    title: 'Program Insights',
    person: 'Prashant B Bhondve',
    reportingManager: 'Vishvajit G Pawar',
    hasData: true,
    role: 'Drive Program Insights and Support Function Excellence — by providing actionable insights, enabling data-driven decision-making, and strengthening support systems.',
    resp: [
      'Insights and Analytics — own analysis and reporting for academic programs, life skills programs, teacher community activity, PO activity, and platform usage. Ensure critical data across Vinoba platforms is accurate, reliable and trusted.',
      'Assessment and Reporting Systems — design and maintain forms, OMRs, templates, dashboards, and reporting structures.',
      'Vinoba Disha — own the design, reporting, and data accuracy of Vinoba Disha.',
      'Support Function Excellence — improve efficiency and effectiveness of support functions through performance measures, workflows, checklists, and review systems.',
      'Build and mentor a high-performing team aligned with OLF\'s values, fostering strong ownership, continuous learning, user empathy, and disciplined execution.'
    ],
    goals: [
      { n:1, title:'Ensure reports are accurate, relevant, and regularly used for decision-making', measure:'> 95% LAR (Light and Right) score for internal and external monitoring reports (Annexure A).', weight:'40%' },
      { n:2, title:'Design and validate effective reporting and assessment systems for academic programs', measure:'> 95% LAR (Light and Right) score for academic reports and forms (Annexure B).', weight:'25%' },
      { n:3, title:'Improve support function effectiveness and resource utilisation', measure:'> 90% score on HO Team Excellence (Annexure C).', weight:'25%' },
      { n:4, title:'Self Development and High Performance Team', measure:'Ensure disciplined execution and learning as per Annexure D.', weight:'10%' }
    ],
    annexures: [
      { title: 'Annexure A — Light and Right Reports', content: `
        <table class="annex-table">
          <thead><tr><th>#</th><th>Measure</th><th class="center">Weightage</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>A/B/C/D classification of reports completed and reviewed monthly. Unused or low-value reports identified and rationalised.</td><td class="center"><span class="score-pill">10%</span></td></tr>
            <tr><td>2</td><td>Spot-check 5% of data for all critical reports with findings documented.</td><td class="center"><span class="score-pill">10%</span></td></tr>
            <tr><td>3</td><td>Track data issues and get them rectified as per agreed SLA.</td><td class="center"><span class="score-pill">10%</span></td></tr>
            <tr><td>4</td><td>Spot check by management does not throw any data issues.</td><td class="center"><span class="score-pill">10%</span></td></tr>
          </tbody>
        </table>
        <p class="annex-note" style="margin-top:8px"><strong>Internal:</strong> Program Dashboards, Vinoba Disha, District Report, etc.<br><strong>External:</strong> Leaderboards, Teacher Feed, POM, Exams, Post score, etc.</p>` },
      { title: 'Annexure B — Light and Right Academic Reports and Forms', content: `
        <table class="annex-table">
          <thead><tr><th>#</th><th>Measure</th><th class="center">Weightage</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Manage repository for different types of academic and form reports in one place. Verify these and implement 2 new small improvements each month and 2 major changes each quarter.</td><td class="center"><span class="score-pill">10%</span></td></tr>
            <tr><td>2</td><td>Spot check all reports generated for new cycles before sending them to field.</td><td class="center"><span class="score-pill">10%</span></td></tr>
            <tr><td>3</td><td>Design reports and analysis structure for all new forms, OMRs, and reporting structures before implementation — to ensure useful, accurate data analysis and usability.</td><td class="center"><span class="score-pill">5%</span></td></tr>
          </tbody>
        </table>` },
      { title: 'Annexure C — HO Team Excellence', content: `
        <table class="annex-table">
          <thead><tr><th>#</th><th>Objective</th><th class="center">Weightage</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Weekly / Monthly Plan for HO Teams</td><td class="center"><span class="score-pill">10%</span></td></tr>
            <tr><td>2</td><td>Monthly Efficiency Reports</td><td class="center"><span class="score-pill">5%</span></td></tr>
            <tr><td>3</td><td>Monthly Review as per Timelines</td><td class="center"><span class="score-pill">5%</span></td></tr>
            <tr><td>4</td><td>Dashboard (Monthly)</td><td class="center"><span class="score-pill">5%</span></td></tr>
          </tbody>
        </table>` },
      { title: 'Annexure D — Self Development & High Performance', content: `
        <table class="annex-table">
          <thead><tr><th>#</th><th>Objective</th><th>Target</th><th class="center">Weightage</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Planning and Tracking</td><td></td><td class="center"><span class="score-pill">2.5%</span></td></tr>
            <tr><td>a</td><td>Finalisation of monthly Plan (next month) and Actual (previous month) by 28th</td><td>29th of every month (VP)</td><td class="center">—</td></tr>
            <tr><td>b</td><td>Finalisation of weekly Plan and Actual by Friday of week</td><td>Weekly, Friday EOD</td><td class="center">—</td></tr>
            <tr><td>c</td><td>Review meeting by 3rd</td><td>Updated HO PPT with ZERO errors by 2nd EOD</td><td class="center">—</td></tr>
            <tr><td>d</td><td>Follow-up action on items — 100%</td><td></td><td class="center">—</td></tr>
            <tr><td>2</td><td>No Ball Dropped</td><td></td><td class="center"><span class="score-pill">2.5%</span></td></tr>
            <tr><td></td><td>Company policy followed</td><td>100% compliance</td><td class="center">—</td></tr>
            <tr><td></td><td>No obvious mistakes / high accuracy</td><td>ZERO obvious mistakes each month</td><td class="center">—</td></tr>
            <tr><td></td><td>No commitments missed</td><td>ZERO commitments missed each month</td><td class="center">—</td></tr>
            <tr><td>3</td><td>Two case studies each month</td><td>Per month</td><td class="center"><span class="score-pill">2.5%</span></td></tr>
            <tr><td>4</td><td>Achieve Learning and Development goals</td><td></td><td class="center"><span class="score-pill">2.5%</span></td></tr>
          </tbody>
        </table>` }
    ],
    priority: [
      { n:1, goal:'Ensure reports are accurate, relevant, and regularly used for decision-making', focus:'Compile a list of reports to be verified.\nSet up the sample criteria for checking.\nDo a pilot and confirm the sampling and data.\nRoll out the process.' },
      { n:2, goal:'Design and validate effective reporting and assessment systems for academic programs', focus:'Compile the various reports of various cycles in one place.\nIdentify the report types from this.' },
      { n:3, goal:'Data Alertness', focus:'Design course on Data Alertness.' }
    ],
  },

  'team-dev': {
    level: 'Manager',
    title: 'Team Development',
    person: 'Aditee Wakalkar',
    reportingManager: 'Vishvajit G Pawar',
    hasData: true,
    role: 'Build organisation capacity through hiring, training and team development — with a culture of ownership, disciplined execution and continuous learning.',
    resp: [
      'Hire resources as per requirements and ensure structured onboarding and smooth transition into roles and responsibilities.',
      'Develop and implement capability development / training programs and opportunities for various roles.',
      'Build practical learning systems and resources across roles and teams.',
      'Build a high-performing team with strong ownership, continuous learning, collaboration, and process compliance.'
    ],
    goals: [
      { n:1, title:'Strengthen hiring for program and operational roles', measure:'Ensure positions are filled in 3 months and in good quality as per Annexure A.', weight:'40%' },
      { n:2, title:'Strengthen onboarding and role transition systems', measure:'New joiners and transitioned team members independently handling core responsibilities as per Annexure B.', weight:'40%' },
      { n:3, title:'Build practical learning systems and resources across roles and teams', measure:'Develop and curate teaching-learning material for various roles as per Annexure C.', weight:'10%' },
      { n:4, title:'Build a high-performing HR Team', measure:'Achieve team goals and individual growth goals as per Annexure D.', weight:'10%' }
    ],
    annexures: [
      { title: 'Annexure A — Hiring Metrics', content: `
        <table class="annex-table">
          <thead><tr><th>#</th><th>Measure</th><th class="center">Weightage</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Complete hiring within 3 months of requisition. Hire Polestars, Interns and Vinoba Scholars as per plan. Maintain long-term and short-term hiring plans and monthly requisition pipeline.</td><td class="center"><span class="score-pill">30%</span></td></tr>
            <tr><td>2</td><td>90% of hires are confirmed after 6 months' probation.</td><td class="center"><span class="score-pill">10%</span></td></tr>
          </tbody>
        </table>` },
      { title: 'Annexure B — Onboarding and Role Transition', content: `
        <table class="annex-table">
          <thead><tr><th>#</th><th>Measure</th><th class="center">Weightage</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Onboarding of new joiners completed within defined timelines with good quality — for all hires including Polestars.</td><td class="center"><span class="score-pill">10%</span></td></tr>
            <tr><td>2</td><td>New joiners independently handling responsibilities within 3 / 6 / 12 months — for early-career team members (excluding Polestars).</td><td class="center"><span class="score-pill">25%</span></td></tr>
            <tr><td>3</td><td>Monthly tracking on progress of new hires with performance metrics versus skill and attitude, for early-career team members. Responsible for Polestar Ascend at IIM Ahmedabad. Identify and support people to be groomed for leadership positions.</td><td class="center"><span class="score-pill">5%</span></td></tr>
          </tbody>
        </table>` },
      { title: 'Annexure C — Developing Teaching-Learning Material', content: `
        <table class="annex-table">
          <thead><tr><th>#</th><th>Measure</th><th class="center">Weightage</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Maintain role-wise competencies. Curate, develop and maintain relevant, high-quality teaching-learning material for various requirements as per agreed timelines. Ensure relevant case studies and real OLF job experiences are included and properly integrated into the course material.</td><td class="center"><span class="score-pill">10%</span></td></tr>
          </tbody>
        </table>` },
      { title: 'Annexure D — Build a High-Performing HR Team', content: `
        <table class="annex-table">
          <thead><tr><th>#</th><th>Objective</th><th>Target</th><th class="center">Weight</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Planning and Tracking</td><td>Monthly Plan (next) and Actual (previous) finalised by 29th. Weekly Plan &amp; Actual by Friday EOD; 100% on-time compliance tracked monthly. Monthly review with Reporting Manager by 29th/30th; review with CEO by 1st–3rd of following month. 100% action items tracked and closed within agreed timelines; pending items escalated with reason.</td><td class="center"><span class="score-pill">10%</span></td></tr>
            <tr><td>2</td><td>No Ball Dropped</td><td>100% company policy compliance every month. Zero errors that could have been caught by self-review before submission (tracked via monthly self-audit). Zero commitments missed; at-risk commitments flagged at least 2 days in advance.</td><td class="center">—</td></tr>
            <tr><td>3</td><td>Share MTM Story</td><td>Identify and share 1 MTM story every month.</td><td class="center">—</td></tr>
            <tr><td>4</td><td>Achieve Self and Team Development Goals</td><td>Progress each agreed competency from current to target level (e.g. L2 → L3).</td><td class="center">—</td></tr>
          </tbody>
        </table>` }
    ],
    priority: [
      { n:1, goal:'Strengthen hiring for program and operational roles', focus:'Ensure positions are filled and appointed as per Span of Control (Hiring SD Tracker) — Field + HO.\nStrengthen recruitment dashboard and weekly hiring reviews.' },
      { n:2, goal:'Strengthen onboarding and role transition systems', focus:'Complete onboarding and 100-day process for Cohort 1 of 47 people.\nImplement 30-60-100 day onboarding review process.\nFinalise list of identified internal talent and complete leadership readiness assessment as per Annexure B.' },
      { n:3, goal:'Build practical learning systems and resources across roles and teams', focus:'Complete priority SOPs, manuals and role-wise learning resources (PO and PM).\nStandardise induction content for Level 1 roles in Field, IT Ops, Insights, Content, Curations.\nIntroduce learning completion and assessment tracking.\nComplete first round of Quarterly Reviews in September.' },
      { n:4, goal:'Build a high-performing HR Team', focus:'Implement weekly planning and monthly review system as per Annexure D.\nStandardise recruitment, onboarding and role transition SOPs.\nDevelop HR dashboards for hiring, onboarding and learning.\nImprove stakeholder responsiveness and service quality.' }
    ]
  },

  finance: {
    level: 'Officer',
    title: 'Accounts & Finance',
    person: 'Anjali J Dandile',
    reportingManager: 'Prashant B Bhondve',
    hasData: true,
    role: 'Ensure strong financial discipline, timely compliance, and reliable financial operations that support organisational credibility, smooth execution, and donor confidence.',
    resp: [
      'Financial Discipline and Controls — Ensure all expenses, invoices, books of accounts and financial records are accurate, verified and maintained with strong internal discipline.',
      'Payments and Financial Operations — Ensure timely and accurate payments to staff, consultants and vendors, and smooth day-to-day financial operations.',
      'Statutory and Regulatory Compliance — Ensure all statutory filings, audits and regulatory requirements are completed accurately and on time.',
      'Donor Compliance and Financial Reporting — Ensure timely and accurate compliance with donor requirements, utilisation reporting and grant-related financial documentation.'
    ],
    goals: [
      { n:1, title:'Financial Discipline and Controls', measure:'Monthly books closed and reviewed by 10th. Zero errors.', weight:'30%' },
      { n:2, title:'Payments and Financial Operations', measure:'Vendor payments within 3 working days of bill due date.\nStaff payments by 5th of each month.\nExpense reimbursements by 3rd of each month.\nAdvances paid by 10th of each month.\nAll statutory payments made timely.\nDeposits created on time to maximise interest benefit.', weight:'30%' },
      { n:3, title:'Statutory and Regulatory Compliance', measure:'Calendar maintained for all statutory compliances.\nAll statutory compliances done timely.', weight:'20%' },
      { n:4, title:'Donor Compliance and Financial Reporting', measure:'Expenses tracked for donor contributions accurately.\nDonor reporting, utilisation certificates and CA certificates provided on timely basis.', weight:'20%' }
    ]
  },

  platform: {
    level: 'Head',
    title: 'Head — Product & Platform',
    person: 'Craig H Dsouza',
    reportingManager: 'Sanjay Dalmia',
    hasData: true,
    role: 'Own the end-to-end product vision, platform effectiveness, and user adoption of the Vinoba ecosystem — ensuring that technology meaningfully improves program implementation, develops vibrant teacher community, and improves system outcomes at large scale.',
    resp: [
      'Own the long-term product vision and roadmap aligned with Vinoba\'s mission, by designing a user-centric experience driven by field impact, adoption, user satisfaction, and system constraints.',
      'Own and manage the end-to-end software development lifecycle, ensuring high quality, cost- and time-efficient delivery, strong partner accountability, and compliance with data privacy and security standards.',
      'Ensure high platform reliability, scalability, and performance, with robust configurations and responsive operational support for field workflows, data, reports, and peak usage events.',
      'Design and evolve data models and dashboards that deliver actionable insights for program, operations, and reporting, and enable field teams to use data effectively for decision-making and course correction.',
      'Build and mentor a high-performing team aligned with OLF\'s values, fostering strong ownership, continuous learning, user empathy, and disciplined execution.'
    ],
    goals: [
      { n:1, title:'Software Development Management', measure:'Planned and timely execution of: Migration to PostgreSQL and Google Cloud.\nData Lakehouse, Single Sign-on, Chakmak, AI — launch and stabilisation.\nOther enhancements.\nPerformance and cost optimisation.', weight:'50%' },
      { n:2, title:'Support user adoption and self-help', measure:'99% uptime and prompt user support with SLAs met.\nProduct documentation and user help for all major product offerings.\nUser forum well-populated with content and actively used by community.', weight:'30%' },
      { n:3, title:'Product Roadmap', measure:'Maintain an active product roadmap based on user requirements.', weight:'20%' }
    ]
  },

  itops: {
    level: 'Manager',
    title: 'Manager — IT Operations',
    person: 'Omkar Yelgandalkar',
    reportingManager: 'Craig H Dsouza',
    hasData: true,
    role: 'Ensure reliable day-to-day operation of the Vinoba platform by providing implementation support, supporting users, and coordinating testing and enhancements that improve execution efficiency and user experience.',
    resp: [
      'Program Implementation Support — Provide technology and operational support for smooth execution of program activities, including forms, OMRs, notifications, user requests, tickets and field support.',
      'Platform Operations and Data Preload — Manage critical platform operations, including preloads, registrations, leaderboard inputs, reports support and operational data readiness.',
      'Release Coordination, Testing and Continuous Improvement — Support development planning with the software team, coordinate testing of new features, and drive small enhancements and process improvements.',
      'Support Resources and Self-Help Enablement — Develop and maintain self-help resources, FAQs, guides and promote user forums.',
      'Build and mentor a high-performing team aligned with OLF\'s values, fostering strong ownership, continuous learning, user empathy, and disciplined execution.'
    ],
    goals: [
      { n:1, title:'Best in-app experience and support to teachers and OLF team', measure:'Service Level Agreements as per Annexure A.', weight:'35%' },
      { n:2, title:'Mentoring and developing a high-performance team as per OLF values', measure:'Timely planning and review with timely corrective action as per Annexure B.', weight:'35%' },
      { n:3, title:'Improve user adoption through self-help, training and user awareness', measure:'2 user awareness trainings each month.\nUser forum and self-help resources maintained.', weight:'15%' },
      { n:4, title:'Track requirements, develop solution docs, test releases and track roadmap', measure:'Roadmap document and requirement documents maintained.\nTesting of app efficiency.', weight:'15%' }
    ],
    annexures: [
      { title: 'Annexure A — Service Level Agreements (SLAs)', content: '<table class="annex-table">\n  <thead><tr><th>Cat.</th><th>#</th><th>Task</th><th class="center">Fatal</th><th class="center">Critical</th><th class="center">Moderate</th><th class="center">Minor</th></tr></thead>\n  <tbody>\n    <tr class="cat-head"><td colspan="7">Support</td></tr>\n    <tr><td>Support</td><td>1</td><td>Issues &amp; Rectification</td><td class="center">4 hr</td><td class="center">1 day</td><td class="center">4 days</td><td class="center">7 days</td></tr>\n    <tr class="cat-head"><td colspan="7">Implementation</td></tr>\n    <tr><td>Impl</td><td>2</td><td>Forms/Reports requirement finalisation</td><td class="center">1 day</td><td class="center">2 days</td><td class="center">4 days</td><td class="center">7 days</td></tr>\n    <tr><td>Impl</td><td>3</td><td>Forms and Notifications (after finalisation)</td><td class="center">4 hr</td><td class="center">1 day</td><td class="center">2 days</td><td class="center">7 days</td></tr>\n    <tr><td>Impl</td><td>4</td><td>OMR Sheet Creation</td><td class="center">1 day</td><td class="center">3 days</td><td class="center">5 days</td><td class="center">7 days</td></tr>\n    <tr><td>Impl</td><td>5</td><td>OMR Sheet Reading (within 1 day of exam)</td><td class="center">1 day</td><td class="center">1 day</td><td class="center">1 day</td><td class="center">1 day</td></tr>\n    <tr><td>Impl</td><td>5.1</td><td>OMR Analysis (within 3 days of first collection)</td><td class="center">2 days</td><td class="center">3 days</td><td class="center">4 days</td><td class="center">7 days</td></tr>\n    <tr><td>Impl</td><td>6</td><td>Release Testing (Reports)</td><td class="center">4 hr</td><td class="center">1 day</td><td class="center">2 days</td><td class="center">3 days</td></tr>\n    <tr class="cat-head"><td colspan="7">Others</td></tr>\n    <tr><td>Others</td><td>7</td><td>Preload Setup</td><td class="center">6 hr</td><td class="center">1 day</td><td class="center">2 days</td><td class="center">3 days</td></tr>\n    <tr><td>Others</td><td>8</td><td>District Setup</td><td class="center">1 day</td><td class="center">2 days</td><td class="center">4 days</td><td class="center">6 days</td></tr>\n    <tr><td>Others</td><td>9</td><td>User Registration &amp; Confirmation</td><td class="center">4 hr</td><td class="center">1 day</td><td class="center">2 days</td><td class="center">7 days</td></tr>\n    <tr><td>Others</td><td>10</td><td>Adhoc data requirements</td><td class="center">3 days</td><td class="center">5 days</td><td class="center">7 days</td><td class="center">10 days</td></tr>\n    <tr class="cat-head"><td colspan="7">Scoring Measures</td></tr>\n    <tr><td colspan="2"></td><td>SLAs met</td><td class="center"><span class="score-pill">A: 100%</span></td><td class="center"><span class="score-pill">B: 90-99%</span></td><td class="center"><span class="score-pill">C: 76-89%</span></td><td class="center"><span class="score-pill">D: &lt;76%</span></td></tr>\n    <tr><td colspan="2"></td><td>99% app uptime (weekly &amp; monthly monitor)</td><td colspan="4"></td></tr>\n  </tbody>\n</table>' },
      { title: 'Annexure B — Planning, Tracking & Team Development', content: '<table class="annex-table">\n  <thead><tr><th>#</th><th>Objective</th><th>Target</th><th class="center">Weight</th></tr></thead>\n  <tbody>\n    <tr><td>1</td><td>Planning and Tracking</td><td>Monthly plan (next) and actual (previous) finalised by 28th. Weekly plan &amp; actual by Friday EOD. Review by 3rd. 100% follow-up on actions.</td><td class="center"><span class="score-pill">15%</span></td></tr>\n    <tr><td>2</td><td>No Ball Dropped</td><td>100% company policy compliance. Zero obvious mistakes/month. Zero commitments missed/month.</td><td class="center"><span class="score-pill">15%</span></td></tr>\n    <tr><td>3</td><td>Two Case Studies Each Month</td><td>Per month</td><td class="center"><span class="score-pill">5%</span></td></tr>\n  </tbody>\n</table>' },
      { title: 'Annexure C — User Awareness & Self-Help', content: '<table class="annex-table">\n  <thead><tr><th>#</th><th>Objective</th><th>Target</th><th class="center">Weight</th></tr></thead>\n  <tbody>\n    <tr><td>1</td><td>User Awareness Trainings for OLF Staff (2nd &amp; 4th Saturday each month)</td><td>2 trainings/month. Video + knowledge verification form circulated 2 weeks prior. High user feedback within 2 days post-training.</td><td class="center"><span class="score-pill">5%</span></td></tr>\n    <tr><td>2</td><td>Set up a web-based user forum for FAQs — easily searchable and kept updated</td><td>Live by end of Sep 25. Kept updated with latest FAQs.</td><td class="center"><span class="score-pill">5%</span></td></tr>\n    <tr><td>3</td><td>Complete and upload 4 self-help topics (PDF + Video) each month on the app. Ensure self-help is well organised and easy to use.</td><td>4 self-help topics (PDF + Video) per month.</td><td class="center"><span class="score-pill">5%</span></td></tr>\n  </tbody>\n</table>' },
      { title: 'Annexure D — Release Testing & Roadmap', content: '<table class="annex-table">\n  <thead><tr><th>#</th><th>Measure</th><th class="center">A</th><th class="center">B</th><th class="center">C</th><th class="center">D</th><th class="center">Weight</th></tr></thead>\n  <tbody>\n    <tr><td>1</td><td>Major new release — number of re-iterations</td><td class="center">0</td><td class="center">1</td><td class="center">2</td><td class="center">&ge;3</td><td class="center"><span class="score-pill">5%</span></td></tr>\n    <tr><td>2</td><td>Test cases to be automated</td><td class="center">&gt;2</td><td class="center">2</td><td class="center">1</td><td class="center">0</td><td class="center">—</td></tr>\n    <tr class="cat-head"><td colspan="7">3. Roadmap</td></tr>\n    <tr><td>3a</td><td>Maintain Roadmap document for changes, requirement specs and design</td><td colspan="4"></td><td class="center"><span class="score-pill">10%</span></td></tr>\n    <tr><td>3b</td><td>Refinements &lt;1 man-day/month for COE/M&amp;E frequently used features</td><td class="center">3</td><td class="center">2</td><td class="center">1</td><td class="center">0</td><td class="center">—</td></tr>\n    <tr><td>3c</td><td>Refinements &lt;1 man-day/month for Teachers/Users</td><td class="center">—</td><td class="center">3</td><td class="center">2</td><td class="center">1</td><td class="center">—</td></tr>\n    <tr><td>3d</td><td>Requirement specs are well-designed, solution thought through from systems &amp; user-adoption angle</td><td colspan="5" class="center">Qualitative assessment</td></tr>\n  </tbody>\n</table>' }
    ]
  },
  'head-partnership': {
    level: 'Head',
    title: 'Head of Fundraising & Partnerships',
    person: 'Sanjay Dalmia',
    reportingManager: 'Board of Trustees',
    hasData: true,
    role: "Lead OLF's fundraising and partnership strategy to secure resources for growth, build trusted long-term donor relationships, and strengthen partnership stewardship through high-quality engagement, reporting and systems.",
    resp: [
      'Fundraising Strategy and Resource Mobilisation — Design and execute fundraising strategy to achieve annual and long-term funding goals aligned with organisational growth and mission.',
      'Donor Engagement, Relationship and Ecosystem Building — Build, cultivate and steward long-term relationships with donors, foundations, CSR partners and aligned ecosystem partners. Deepen donor engagement through communication, field visits, events, volunteering and thought partnership.',
      'Proposals, Compliance and Reporting — Build systems, processes and analytics that strengthen fundraising effectiveness, donor management and partnership decision-making.',
      'Impact and Learning — Run impact studies for evidence generation, what works/doesn\'t and external thought leadership.'
    ],
    goals: [
      { n:1, title:'Fundraising targets achieved for 26-27', measure:'Rs 24.7 crore funds received during FY 26-27.', weight:'30%' },
      { n:2, title:'Strong pipeline of new donors and deeper long-term donor relationships', measure:'Commitments of Rs 15 crore received for 27-28.\nPipeline of Rs 15 crore created for 27-28.\nIncrease visibility and position OLF as thought leader.', weight:'30%' },
      { n:3, title:'Donors are effectively engaged', measure:'Donors engaged regularly as per calendar in Annexure A.\nDonors mentioned Vinoba work on social media at least 20 times during the year.\nMaintain calendar for engagement for CSR, high value donors and mentors.', weight:'15%' },
      { n:4, title:'Proposals, Compliance and Reporting', measure:'Request for proposal, reports, UCs responded to in high quality as per SLA in Annexure B.', weight:'15%' },
      { n:5, title:'Impact and Learning', measure:'Two impact assessment studies conducted.', weight:'10%' }
    ],
    annexures: [
      { title: 'Annexure A — Donor Engagement Calendar', content: '<table class="annex-table">\n  <thead><tr><th colspan="2">Activity</th><th class="center">Target/Year</th><th class="center">Attendance</th></tr></thead>\n  <tbody>\n    <tr class="cat-head"><td colspan="4">1. Meets</td></tr>\n    <tr><td>a</td><td>Singapore meets</td><td class="center">2</td><td class="center">30</td></tr>\n    <tr><td>b</td><td>Mumbai meet</td><td class="center">2</td><td class="center">20</td></tr>\n    <tr><td>c</td><td>Delhi meet</td><td class="center">2</td><td class="center">20</td></tr>\n    <tr><td>d</td><td>Web meeting</td><td class="center">2</td><td class="center">20</td></tr>\n    <tr class="cat-head"><td colspan="4">2. Events and Visits</td></tr>\n    <tr><td>a</td><td>Visit by Donors to Sikshan Utsav / Recognition event / Nanhe Sitare</td><td class="center">10</td><td class="center">organisations</td></tr>\n    <tr><td>b</td><td>Visit by Donors to Darpan</td><td class="center">10</td><td class="center">organisations</td></tr>\n    <tr><td>c</td><td>Field Visit by Donors</td><td class="center">10</td><td class="center">—</td></tr>\n    <tr><td>d</td><td>Volunteering Opportunity for Donor employees/children</td><td class="center">5</td><td class="center">100</td></tr>\n    <tr><td>e</td><td>Presentation by OLF in annual meet of company</td><td class="center">3 companies</td><td class="center">—</td></tr>\n    <tr><td>f</td><td>Presentation by OLF in IIT/IIM Forums</td><td class="center">2</td><td class="center">—</td></tr>\n    <tr class="cat-head"><td colspan="4">Content for Donors</td></tr>\n    <tr><td>a</td><td>Newsletter</td><td class="center">12</td><td class="center">—</td></tr>\n    <tr><td>b</td><td>Reels (Social Media)</td><td class="center">12</td><td class="center">—</td></tr>\n    <tr><td>c</td><td>Posts (Social Media)</td><td class="center">24</td><td class="center">—</td></tr>\n  </tbody>\n</table>' },
      { title: 'Annexure B — Response SLAs', content: '<table class="annex-table">\n  <thead><tr><th>#</th><th>Task</th><th class="center">Urgent</th><th class="center">Normal</th><th class="center">Low</th></tr></thead>\n  <tbody>\n    <tr><td>1</td><td>Request for Proposal</td><td class="center">2 days</td><td class="center">1 week</td><td class="center">2 weeks</td></tr>\n    <tr><td>2</td><td>Utilisation Certificate from CA</td><td class="center">—</td><td class="center">1 week</td><td class="center">2 weeks</td></tr>\n    <tr><td>3</td><td>Quarterly Activity Report</td><td class="center">2 days</td><td class="center">1 week</td><td class="center">2 weeks</td></tr>\n    <tr><td>4</td><td>SCERT Report</td><td class="center">—</td><td class="center">2 weeks</td><td class="center">—</td></tr>\n    <tr><td>5</td><td>Response to donors (WhatsApp / Email / Phone)</td><td class="center">4 hours</td><td class="center">1 day</td><td class="center">2 days</td></tr>\n  </tbody>\n</table>' }
    ]
  },


  'lead-partnership': {
    level: 'Manager',
    title: 'Lead — Fundraising',
    person: 'Vacant · Interim',
    reportingManager: 'Sanjay Dalmia',
    hasData: true,
    role: "Lead OLF's fundraising efforts to secure new donors and build a strong pipeline, while cultivating long-term relationships and positioning OLF as a thought leader in education.",
    resp: [
      'Fundraising Strategy and Resource Mobilisation — Design and execute fundraising strategy to achieve annual and long-term funding goals aligned with organisational growth and mission.',
      'Donor Engagement, Relationship and Ecosystem Building — Build, cultivate and steward long-term relationships with donors, foundations, CSR partners and aligned ecosystem partners. Deepen donor engagement through communication, field visits, events, volunteering and thought partnership.',
      'Thought Leadership — Position OLF as a thought leader in the education space through conferences, forums and external engagements.'
    ],
    goals: [
      { n:1, title:'Fundraising targets achieved for 26-27', measure:'Rs 5 crore funds received during FY 26-27. 4 new names and 1 from existing donors.', weight:'30%' },
      { n:2, title:'Strong pipeline of new donors and deeper long-term donor relationships', measure:'Commitments of Rs 3 crore received for 27-28.\nPipeline of Rs 3 crore created for 27-28.\nOrganise meets as per Annexure A.', weight:'30%' },
      { n:3, title:'Thought Leadership', measure:'Speaking opportunity in one meaningful conference each quarter.', weight:'15%' }
    ],
    annexures: [
      { title: 'Annexure A — Prospect Meets', content: '<table class="annex-table">\n  <thead><tr><th>#</th><th>Activity</th></tr></thead>\n  <tbody>\n    <tr><td>1</td><td>Organise two Delhi meets with 10 hot prospects each</td></tr>\n    <tr><td>2</td><td>Organise two Mumbai meets with 10 hot prospects each</td></tr>\n    <tr><td>3</td><td>Organise one meet for Sanjay and Rajeev once every 2 months to meet at least 4 prospects</td></tr>\n  </tbody>\n</table>' }
    ]
  },

  'partnership-mgr': {
    level: 'Manager',
    title: 'Manager — Partnership Enablement',
    person: 'Sowmya Srinivasan',
    reportingManager: 'Sanjay Dalmia',
    hasData: true,
    role: 'Support the Head – Fundraising and Partnerships in achieving fundraising and partnership goals through strong proposal support, donor stewardship, engagement coordination, reporting, and partnership systems.',
    resp: [
      'Proposals, Compliance and Reporting — Build systems, processes and analytics that strengthen fundraising effectiveness, donor management and partnership decision-making.',
      'Donor and Mentor Mobilization — mobilize community voice and participation; create feedback loops that connect the movement to lived field realities.',
      'Impact and Learning — Run impact studies for evidence generation, what works/doesn\'t and external thought leadership.'
    ],
    goals: [
      { n:1, title:'Support fundraising for 26-27 and build pipeline for 2027-28 (₹15cr NN and renew existing ₹11cr)', measure:'Proactively identify opportunities for grants.\nDrive urgency and conversations as per regular rhythms to keep tempo.\nMaintain good relationship with HSBC, GE Shipping, Rustomjee, Persistent and ensure renewals.\n(Details in Annexure A.)', weight:'30%' },
      { n:2, title:'Proposals, Compliance and Reporting', measure:'Proposals, Reports, UCs, 10BE etc. submitted as per SLA in Annexure B.', weight:'10%' },
      { n:3, title:'Drive pride in donors and mentors', measure:'Improve the Donor Engagement Score.\nImprove the Mentor Engagement Score.\n(Details in Annexure C.)', weight:'50%' },
      { n:4, title:'Mentor and develop a high-performance team aligned with OLF core values and culture', measure:'Support hiring to build a team of 5 for the Founder\'s Office. Lead the team.', weight:'10%' },
      { n:5, title:'Mentor and develop a high-performance team aligned with OLF core values and culture', measure:'% Timely Reviews (Performance vs Actual); closure of action items for all teams; Best Practices / Core Values stories in action within OLF.\n(Details in Annexure D.)', weight:'10%' }
    ],
    annexures: [
      { title: 'Annexure A — Fundraising Pipeline Activities', content: `
        <table class="annex-table">
          <thead><tr><th>#</th><th>Activity</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Proactively identify opportunities for grants. 1 hot lead each quarter.</td></tr>
            <tr><td>2</td><td>2 fortnightly fundraising meetings each month.</td></tr>
            <tr><td>4</td><td>Engage donors / partners / influencers on behalf of Sanjay / Rajeev.</td></tr>
          </tbody>
        </table>
        <table class="annex-table" style="margin-top:16px">
          <thead><tr><th>3 — Engage key influencers on regular basis</th><th class="center">Frequency</th></tr></thead>
          <tbody>
            <tr><td>Shyam</td><td class="center">Monthly</td></tr>
            <tr><td>Sameen</td><td class="center">Monthly</td></tr>
            <tr><td>Kalpen</td><td class="center">Monthly</td></tr>
            <tr><td>Pankaj Goel</td><td class="center">Monthly</td></tr>
            <tr><td>Rajesh Raman</td><td class="center">Monthly</td></tr>
            <tr><td>Sheeba</td><td class="center">Weekly</td></tr>
          </tbody>
        </table>` },
      { title: 'Annexure B — Partnership Systems (Response SLAs)', content: `
        <table class="annex-table">
          <thead><tr><th>#</th><th>Partnership System</th><th class="center">Urgent</th><th class="center">Normal</th><th class="center">Low</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Request for Proposal</td><td class="center">2 days</td><td class="center">1 week</td><td class="center">2 weeks</td></tr>
            <tr><td>2</td><td>Utilization Certificate from CA</td><td class="center">—</td><td class="center">1 week</td><td class="center">2 weeks</td></tr>
            <tr><td>3</td><td>Quarterly activity report, 10BE, 80G receipts etc.</td><td class="center">2 days</td><td class="center">1 week</td><td class="center">2 weeks</td></tr>
            <tr><td>4</td><td>SCERT Report</td><td class="center">—</td><td class="center">2 weeks</td><td class="center">—</td></tr>
            <tr><td>5</td><td>Response to donors on WhatsApp / Email / Phone messages</td><td class="center">4 hours</td><td class="center">1 day</td><td class="center">2 days</td></tr>
          </tbody>
        </table>` },
      { title: 'Annexure C — Donor & Mentor Engagement', content: `
        <table class="annex-table">
          <thead><tr><th colspan="2">Engagement Activity</th><th class="center">Target / Year</th><th class="center">Attendance each</th></tr></thead>
          <tbody>
            <tr class="cat-head"><td colspan="4">1. Meets</td></tr>
            <tr><td>a</td><td>Singapore meets</td><td class="center">2</td><td class="center">30</td></tr>
            <tr><td>b</td><td>Mumbai meet</td><td class="center">2</td><td class="center">20</td></tr>
            <tr><td>c</td><td>Delhi meet</td><td class="center">2</td><td class="center">20</td></tr>
            <tr><td>d</td><td>Web meeting</td><td class="center">2</td><td class="center">20</td></tr>
            <tr class="cat-head"><td colspan="4">2. Events and Visits</td></tr>
            <tr><td>a</td><td>Visit by Donors to Sikshan Utsav / Recognition event / Nanhe Sitare</td><td class="center">10</td><td class="center">organizations</td></tr>
            <tr><td>b</td><td>Visit by Donors to Darpan</td><td class="center">10</td><td class="center">organizations</td></tr>
            <tr><td>c</td><td>Field Visit by Donors</td><td class="center">10</td><td class="center">—</td></tr>
            <tr><td>d</td><td>Volunteering Opportunity for Donor employees / children</td><td class="center">5</td><td class="center">100</td></tr>
            <tr><td>e</td><td>Presentation by OLF in annual meet of company</td><td class="center">3</td><td class="center">companies</td></tr>
            <tr><td>f</td><td>Presentation by OLF in IIT/IIM Forums</td><td class="center">2</td><td class="center">—</td></tr>
          </tbody>
        </table>
        <table class="annex-table" style="margin-top:16px">
          <thead><tr><th>A — Content for Donors</th><th class="center">Per month</th></tr></thead>
          <tbody>
            <tr><td>Newsletter</td><td class="center">1</td></tr>
            <tr><td>Reels (social media) for unique donors</td><td class="center">1</td></tr>
            <tr><td>Posts (social media) for unique donors</td><td class="center">2</td></tr>
            <tr><td>Special caselets on donor impact</td><td class="center">0.25</td></tr>
            <tr><td>Reels of Donor visit to field / events</td><td class="center">1</td></tr>
            <tr><td>Reels of Donor visit to Darpan</td><td class="center">0.5</td></tr>
          </tbody>
        </table>
        <table class="annex-table" style="margin-top:16px">
          <thead><tr><th>B — Social Media Engagement</th><th class="center">Per month</th></tr></thead>
          <tbody>
            <tr><td>Unique donor engagement each month on Newsletter</td><td class="center">20</td></tr>
            <tr><td>Donor posts on social media with hashtag #Vinoba or #OpenLinksFoundation</td><td class="center">1</td></tr>
            <tr><td>Number of Views</td><td class="center">50</td></tr>
            <tr><td>Number of Likes</td><td class="center">50</td></tr>
            <tr><td>Number of Newspaper articles</td><td class="center">0.5</td></tr>
            <tr><td>Number of TV appearances</td><td class="center">0.5</td></tr>
          </tbody>
        </table>
        <table class="annex-table" style="margin-top:16px">
          <thead><tr><th>Mentor Engagement</th><th class="center">Target</th></tr></thead>
          <tbody>
            <tr><td>Grow number of mentors</td><td class="center">15</td></tr>
            <tr><td>% of Mentors in Category A and B</td><td class="center">70%</td></tr>
            <tr><td>Mentor reels per month</td><td class="center">1</td></tr>
          </tbody>
        </table>
        <p class="annex-note" style="margin-top:10px"><strong>Mentor categories:</strong> A — actively involved with supporting OLF; B — moderately involved with supporting OLF; C — one-off participation; D — needs attention.</p>` },
      { title: 'Annexure D — Planning, Tracking & No Ball Dropped', content: `
        <table class="annex-table">
          <thead><tr><th>#</th><th>Objective</th><th>Target 25-26</th></tr></thead>
          <tbody>
            <tr class="cat-head"><td colspan="3">1. Planning and Tracking</td></tr>
            <tr><td>a</td><td>Finalisation of monthly Plan (next month) and Actual (previous month) by 28th of month.</td><td>29th of every month (VP)</td></tr>
            <tr><td>c</td><td>Review meeting by 3rd.</td><td>HO PPT by 2nd EOD</td></tr>
            <tr><td>d</td><td>Follow-up action on items — 100%.</td><td></td></tr>
            <tr class="cat-head"><td colspan="3">2. No Ball Dropped</td></tr>
            <tr><td></td><td>Company policy followed</td><td>100% compliance</td></tr>
            <tr><td></td><td>No obvious mistakes / high accuracy</td><td>ZERO obvious mistakes each month</td></tr>
            <tr><td></td><td>No commitments missed</td><td>ZERO commitments missed each month</td></tr>
          </tbody>
        </table>` }
    ]
  },

  'community': {
    level: 'Assistant Manager',
    title: 'Assistant Manager — Community Development',
    person: 'Tejal Hande',
    reportingManager: 'Vishvajit G Pawar',
    hasData: true,
    role: 'Lead the Vinoba movement by strengthening belief, ownership, and shared purpose within OLF and across the ecosystem — strengthening staff and teacher pride and ownership, shaping the narrative of government-school transformation, mobilising community voice, and amplifying stories of change.',
    resp: [
      'Strengthen teacher identity, pride, and motivation; build teacher champions and peer inspiration.',
      'Shape the narrative of aspirational government schools; amplify stories of change from the field; build public and ecosystem momentum around Vinoba\'s vision.',
      'Build belief, pride, and shared purpose within OLF; strengthen employee ownership of the Vinoba mission; create internal rituals, communication, and recognition that reinforce mission culture.',
      'Mobilize and strengthen the community of education officers.'
    ],
    goals: [
      { n:1, title:'Strengthen the teacher recognition program towards Vibrant Teacher Community', measure:'Improve the Vibrancy score for teacher community from 4 to 5.\nHold 20 "प्रेरणा संवाद" webinar sessions with CEO/DM, and 5 "Bolega Bachpan" with Sonali Kulkarni.\n(Details in Annexure A.)', weight:'40%' },
      { n:2, title:'Develop narrative of government schools as "Marathi Bhi, English Bhi"', measure:'Nukkad Natak competitions in 5 districts with at least 30 schools in each district participating.\nMarket the achievements of teachers, schools and administrators (Annexure B) and increase engagement by 5% each quarter.', weight:'20%' },
      { n:3, title:'Improve employee motivation and ownership', measure:'360° Employee Culture Survey (ECS) shows 5% improvement each quarter (Annexure C).', weight:'20%' },
      { n:4, title:'Develop community of motivated Education officers and teachers as changemakers', measure:'Make a proof of concept for "Acharyakul" through experimentation and pilot in 2 districts.\nMake a proof of concept for "Caring Officers" with 25 members.', weight:'10%' },
      { n:5, title:"Build and support a dedicated team that believes in OLF's mission and works with purpose", measure:'Hire team members as per requirement so the entire team is in place by Sep 26.\nHalf-yearly Employee Satisfaction Score (ESC) \u2265 8; Manager Feedback Score (MFS) \u2265 8; attrition < 20%.\n(Details in Annexure E.)', weight:'10%' }
    ],
    annexures: [
      { title: 'Annexure A — Vibrant Teacher Community (Online + Physical)', content: `
        <p class="annex-note" style="margin-bottom:10px"><strong>Vibrancy score split:</strong> Online Community 0.6 · Physical Community 0.4.</p>
        <table class="annex-table">
          <thead><tr><th colspan="6">Online Community (Actual vs Target)</th></tr>
          <tr><th>#</th><th>Measure</th><th class="center">Actual count</th><th class="center">Density</th><th class="center">Target density</th><th class="center">Weightage</th></tr></thead>
          <tbody>
            <tr class="cat-head"><td colspan="6">Breadth</td></tr>
            <tr><td>1</td><td>% of unique teachers posting each month</td><td class="center">230</td><td class="center">4.8%</td><td class="center">20%</td><td class="center">0.2</td></tr>
            <tr><td>2</td><td>% of unique schools posting each month</td><td class="center">180</td><td class="center">11.9%</td><td class="center">20%</td><td class="center">0.2</td></tr>
            <tr class="cat-head"><td colspan="6">Depth</td></tr>
            <tr><td>3</td><td>Weekly Active Users</td><td class="center">480</td><td class="center">10.0%</td><td class="center">15%</td><td class="center">0.2</td></tr>
            <tr><td>4</td><td>Posts per month / per teacher</td><td class="center">635</td><td class="center">13.2%</td><td class="center">20%</td><td class="center">0.1</td></tr>
            <tr><td>5</td><td>Star Teachers with 3-month consistency</td><td class="center">46</td><td class="center">1.0%</td><td class="center">2%</td><td class="center">0.1</td></tr>
            <tr class="cat-head"><td colspan="6">Impact</td></tr>
            <tr><td>6</td><td>% of teachers using their expert coupon</td><td class="center">8</td><td class="center">40%</td><td class="center">75%</td><td class="center">0.1</td></tr>
            <tr><td>7</td><td>POM Transformed clusters</td><td class="center">5</td><td class="center">2.8%</td><td class="center">5%</td><td class="center">0.1</td></tr>
          </tbody>
        </table>
        <table class="annex-table" style="margin-top:16px">
          <thead><tr><th colspan="5">Physical Community (Actual vs Target)</th></tr>
          <tr><th>Measure</th><th class="center">Actual</th><th class="center">Target</th><th class="center">Weightage</th></tr></thead>
          <tbody>
            <tr><td>% of Blocks with recognition events each month</td><td class="center">6 (75%)</td><td class="center">8 (100%)</td><td class="center">0.1</td></tr>
            <tr><td>District recognition event held</td><td class="center">1 (100%)</td><td class="center">1 (100%)</td><td class="center">0.1</td></tr>
            <tr><td>% of Teachers Recognized vs estimate</td><td class="center">24 (62%)</td><td class="center">39 (100%)</td><td class="center">0.1</td></tr>
            <tr><td>% of Cluster Heads recognized vs estimate</td><td class="center">18 (75%)</td><td class="center">24 (100%)</td><td class="center">0.1</td></tr>
            <tr><td>Sikshan Utsav held with DM/CEO present</td><td class="center">1</td><td class="center">1</td><td class="center">0.1</td></tr>
            <tr><td>360° Feedback on Recognition Program</td><td class="center">8.2</td><td class="center">10</td><td class="center">0.2</td></tr>
            <tr><td>360° Feedback on Sikshan Utsav</td><td class="center">7.4</td><td class="center">10</td><td class="center">0.2</td></tr>
            <tr><td>360° Feedback on Nanhe Sitare</td><td class="center">8.2</td><td class="center">10</td><td class="center">0.1</td></tr>
          </tbody>
        </table>
        <table class="annex-table" style="margin-top:16px">
          <thead><tr><th>Conceptualize and run the following recognition programs with high quality</th><th class="center">25-26</th><th class="center">26-27</th></tr></thead>
          <tbody>
            <tr><td>Webinar — Coffee with CEO / Collector (5 districts)</td><td class="center">0</td><td class="center">20</td></tr>
            <tr><td>Story Telling with Sonali Kulkarni</td><td class="center">3</td><td class="center">5</td></tr>
          </tbody>
        </table>
        <p class="annex-note" style="margin-top:10px"><strong>A. 360° Inputs for Teacher Recognition events (monthly):</strong> all planning, procurement and availability of goods done timely and in good quality (CT); teachers show high excitement for the gifts (CT); maintain stock register for gifts and audit it monthly (CT); CEO/BEO participation in the event (FT).</p>
        <p class="annex-note"><strong>B. 360° Inputs for Sikshan Utsav / Nanhe Sitare (for each event):</strong> all planning and procurement done timely; participation of CEO/Collector, expected teachers and expected donors; teachers come on time; graffiti and games are very engaging; high engagement during event; everything as per schedule; high rating of the event by participants; good-quality articles and videos from the event; 100 videos and reels for teachers, students and schools per event (figure out a process for this); maintain stock register for gifts and audit it monthly.</p>` },
      { title: 'Annexure B — Narrative & Social Media', content: `
        <table class="annex-table">
          <thead><tr><th>Content (per month)</th><th class="center">Videos</th><th class="center">References</th></tr></thead>
          <tbody>
            <tr><td>Feature reels of impactful stories aligned to mission (teachers, schools, alumni, IAS officers)</td><td class="center">2</td><td class="center">—</td></tr>
            <tr><td>Blogs</td><td class="center">2</td><td class="center">—</td></tr>
            <tr><td>Kathavali — published monthly</td><td class="center">1</td><td class="center">—</td></tr>
            <tr><td>IAS officers</td><td class="center">1</td><td class="center">1</td></tr>
            <tr><td>Education officers / DIET</td><td class="center">1</td><td class="center">1</td></tr>
            <tr><td>Teachers</td><td class="center">2</td><td class="center">2</td></tr>
            <tr><td>Chakmak — after each Sonali Kulkarni event</td><td class="center">—</td><td class="center">0.5</td></tr>
            <tr><td>Collector ki Slate — newsletter after every CEO/Collector interaction</td><td class="center">—</td><td class="center">1</td></tr>
          </tbody>
        </table>
        <table class="annex-table" style="margin-top:16px">
          <thead><tr><th>Social Media Engagement</th><th class="center">Target</th></tr></thead>
          <tbody>
            <tr><td>Vinoba Kathavali marketed with unique teacher engagement each month</td><td class="center">2000</td></tr>
            <tr><td>Teacher posts on social media with hashtag #Vinoba or #Acharyakul</td><td class="center">200 / month</td></tr>
            <tr><td>Number of Followers</td><td class="center">Detailed metrics by end Aug</td></tr>
            <tr><td>Number of Views</td><td class="center">Detailed metrics by end Aug</td></tr>
            <tr><td>Number of Likes</td><td class="center">Detailed metrics by end Aug</td></tr>
            <tr><td>Number of Newspaper articles</td><td class="center">2 / month</td></tr>
            <tr><td>Number of TV appearances</td><td class="center">2 / month</td></tr>
          </tbody>
        </table>` },
      { title: 'Annexure C — Employee Motivation & Ownership (ECS)', content: `
        <p class="annex-note" style="margin-bottom:12px">4 checkpoints during the year — 2 with external support and 2 internal.</p>
        <table class="annex-table">
          <thead><tr><th>#</th><th>Measure</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>360° ECS survey shows 5% improvement each quarter — Engagement, Wellbeing and Culture survey (Q1, Q2, Q3, Q4).</td></tr>
          </tbody>
        </table>
        <table class="annex-table" style="margin-top:16px">
          <thead><tr><th>#</th><th>Things to be done to achieve the above</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Manager review and planning alignment sessions — quarterly.</td></tr>
            <tr><td>2</td><td>Moments that Matter — weekly.</td></tr>
            <tr><td>3</td><td>Vinoba Team — quarterly rolling trophy.</td></tr>
            <tr><td>4</td><td>Monthly employee post on LinkedIn with inspiring story.</td></tr>
            <tr><td>5</td><td>Monthly employee magazine with 80% unique employee engagement.</td></tr>
            <tr><td>6</td><td>Bi-annual retreat — Darpan.</td></tr>
          </tbody>
        </table>` },
      { title: 'Annexure E — Team Building & Disciplined Execution', content: `
        <p class="annex-note" style="margin-bottom:12px">Hiring as per Exhibit 1 (weightage 5%).</p>
        <table class="annex-table">
          <thead><tr><th>#</th><th>Role</th><th>Person</th><th class="center">Team size with Manager</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Manager — Marketing</td><td>Vaibhavi Ratishkumar</td><td class="center">2</td></tr>
            <tr><td>2</td><td>Manager — Events</td><td>Neha Upasani</td><td class="center">2</td></tr>
            <tr><td>3</td><td>Manager — Aspirational School Program</td><td>Vacant — to hire</td><td class="center">0</td></tr>
            <tr><td>4</td><td>Manager — Volunteering Engagement</td><td>Vacant — to hire</td><td class="center">0</td></tr>
            <tr><td>5</td><td>Manager — Employee Engagement</td><td>Vacant — to hire</td><td class="center">0</td></tr>
          </tbody>
        </table>
        <table class="annex-table" style="margin-top:16px">
          <thead><tr><th>#</th><th>Disciplined Execution by team</th><th>Target 25-26</th></tr></thead>
          <tbody>
            <tr><td>a</td><td>Finalisation of monthly Plan (next month) and Actual (previous month) by 28th of month. Review meeting by 3rd.</td><td></td></tr>
            <tr><td>d</td><td>Follow-up action on items — 100%.</td><td></td></tr>
            <tr><td>2</td><td>No Ball Dropped — company policy followed</td><td>100% compliance</td></tr>
            <tr><td></td><td>No Ball Dropped — no obvious mistakes / high accuracy</td><td>ZERO obvious mistakes each month</td></tr>
            <tr><td></td><td>No Ball Dropped — no commitments missed</td><td>ZERO commitments missed each month</td></tr>
            <tr><td>3</td><td>Two Case Studies each month</td><td>Per month</td></tr>
            <tr><td>4</td><td>Achieve Learning and Development goals</td><td></td></tr>
          </tbody>
        </table>` }
    ],
    priority: [
      { n:1, goal:'Narrative — Nukkad Natak', focus:'Get Nukkad Natak going with 1 district. At least 30 posts uploaded.' },
      { n:2, goal:'Team Building', focus:'Hire 3 vacant manager positions.' },
      { n:3, goal:'Engagement Measurement', focus:'Set up engagement and measurement methodology for Vibrant Teacher Community, Donor Engagement, Employee Engagement and Event Engagement.' }
    ]
  },

  'events-mgr': {
    level: 'Lead',
    title: 'Lead — Lifeskills & Teacher Recognition',
    person: 'Anjali Bisht',
    reportingManager: 'Tejal Hande',
    hasData: true,
    role: 'Lead and manage Teacher Recognition Events (TRE) and Sikshan Utsav / Nanhe Sitare (SUN) events across districts. Ensure quality execution and high teacher engagement and satisfaction.',
    resp: [
      'Ensure high teacher satisfaction and engagement with gifts and rewards. Set up a layered and gamified reward mechanism so that teachers aspire for higher rewards — creating a more engaging community.',
      'Ensure that the stage events — Nanhe Sitare and Sikshan Utsav — are very engaging and meaningful.',
      'Drive high-impact recognition programs with celebrities and IAS officers.'
    ],
    goals: [
      { n:1, title:'Improve TRE Score each quarter', measure:'TRE Score — \u226510% improvement each quarter (gift quality, teacher excitement, CEO/BEO participation, stock audit). Annexure A.', weight:'30%' },
      { n:2, title:'Improve SUN Score for every event', measure:'SUN Score — \u22654% improvement vs model event per Sikshan Utsav & Nanhe Sitare (participation, IAS/CEO presence, post-event content). Annexure B.', weight:'50%' },
      { n:3, title:'Execute high-impact recognition programs with celebrities and IAS officers', measure:'Webinars & Storytelling — 20 Coffee-with-CEO/Collector webinars + 5 Sonali Kulkarni sessions annually with documented outcomes. Annexure C.', weight:'20%' }
    ],
    annexures: [
      { title: 'Annexure A — Teacher Recognition Excitement Score (TRE)', content: `
        <table class="annex-table">
          <thead><tr><th>#</th><th>Measure</th><th class="center">Weightage</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>TRE score improves by \u226510% each quarter — tracked across gift quality, teacher excitement, CEO/BEO participation, and stock-audit compliance.</td><td class="center"><span class="score-pill">30%</span></td></tr>
          </tbody>
        </table>
        <table class="annex-table" style="margin-top:16px">
          <thead><tr><th>#</th><th>Inputs for TRE score</th><th class="center">Weightage</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>All gifts and materials procured and available two weeks prior to need; district stock logged in register and actively maintained; no urgency to procure, no excess held over a month.</td><td class="center"><span class="score-pill">5%</span></td></tr>
            <tr><td>2</td><td>Stock register maintained and audited every month.</td><td class="center"><span class="score-pill">5%</span></td></tr>
            <tr><td>3</td><td>Publish monthly ABCD categorisation of TRE (incl. participation of relevant officials, timeliness).</td><td class="center"><span class="score-pill">5%</span></td></tr>
            <tr><td>4</td><td>Teachers show high excitement for the gifts.</td><td class="center"><span class="score-pill">15%</span></td></tr>
          </tbody>
        </table>` },
      { title: 'Annexure B — Sikshan Utsav & Nanhe Sitare Score (SUNs)', content: `
        <table class="annex-table">
          <thead><tr><th>#</th><th>Measure</th><th class="center">Weightage</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>SUNs score improves by 4% (versus model event) for each event.</td><td class="center"><span class="score-pill">50%</span></td></tr>
          </tbody>
        </table>
        <table class="annex-table" style="margin-top:16px">
          <thead><tr><th>#</th><th>Inputs for SUNs score</th><th class="center">Owner</th><th class="center">Weightage</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>All planning and procurement done timely.</td><td class="center">CT&amp;FT</td><td class="center"><span class="score-pill">10%</span></td></tr>
            <tr><td>2</td><td>Participation: CEO/Collector, expected teachers, expected donors.</td><td class="center">FT</td><td class="center">—</td></tr>
            <tr><td>3</td><td>Teachers come on time.</td><td class="center">FT</td><td class="center">—</td></tr>
            <tr><td>4</td><td>Graffiti and games are very engaging.</td><td class="center">CT</td><td class="center"><span class="score-pill">10%</span></td></tr>
            <tr><td>5</td><td>High engagement during event.</td><td class="center">CT</td><td class="center"><span class="score-pill">10%</span></td></tr>
            <tr><td>6</td><td>Everything as per schedule.</td><td class="center">CT&amp;FT</td><td class="center">—</td></tr>
            <tr><td>7</td><td>High rating of the event by participants.</td><td class="center">CT</td><td class="center"><span class="score-pill">10%</span></td></tr>
            <tr><td>8</td><td>Good-quality articles and videos from the event.</td><td class="center">CT</td><td class="center"><span class="score-pill">5%</span></td></tr>
            <tr><td>9</td><td>Videos and reels for teachers, students and schools — 100 per event (establish a process).</td><td class="center">CT</td><td class="center"><span class="score-pill">5%</span></td></tr>
          </tbody>
        </table>` },
      { title: 'Annexure C — High-Impact Recognition Programs', content: `
        <table class="annex-table">
          <thead><tr><th>#</th><th>Measure</th><th class="center">Weightage</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Run 20 Coffee-with-CEO/Collector webinars + 5 Sonali Kulkarni Storytelling sessions across the year with documented quality outcomes and participation records.</td><td class="center"><span class="score-pill">20%</span></td></tr>
          </tbody>
        </table>
        <table class="annex-table" style="margin-top:16px">
          <thead><tr><th>#</th><th>Recognition Program</th><th class="center">25-26</th><th class="center">26-27</th><th class="center">Weightage</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Webinar — Coffee with CEO / Collector (5 districts)</td><td class="center">0</td><td class="center">20</td><td class="center"><span class="score-pill">5%</span></td></tr>
            <tr><td></td><td>Feedback (per event)</td><td class="center">—</td><td class="center">—</td><td class="center"><span class="score-pill">5%</span></td></tr>
            <tr><td>2</td><td>Story Telling with Sonali Kulkarni</td><td class="center">3</td><td class="center">5</td><td class="center"><span class="score-pill">5%</span></td></tr>
            <tr><td></td><td>Feedback (per event)</td><td class="center">—</td><td class="center">—</td><td class="center"><span class="score-pill">5%</span></td></tr>
          </tbody>
        </table>` }
    ],
    priority: [
      { n:1, goal:'Creative Gifts & Rewards', focus:'Set up a committee and process for vetting and finalising creative gifts and rewards.' },
      { n:2, goal:'Innovation', focus:'Come up with innovative teacher rewards, games and graffiti (for events) — 2 each.' },
      { n:3, goal:'Math Bee', focus:'Conceptualise and execute 1 Math Bee event.' }
    ]
  },

  'marketing-mgr': {
    level: 'Manager',
    title: 'Manager — Community Marketing',
    person: 'Vaibhavi Ratish Kumar',
    reportingManager: 'Reena Dalmia',
    hasData: true,
    role: 'Showcase government-school transformation through teacher, school, and administrator achievements — via mission-aligned social media, newsletters, campaigns, and event/programme collaterals. Build awareness, trust, and adoption with growth in program adoption, teacher app engagement and newsletter reach.',
    resp: [
      'Drive teacher engagement and Vinoba adoption through clear and inspiring communication that is aligned with programs and consistently reinforces the vision and mission at OLF.',
      'Deliver impactful donor communication that strengthens existing partnerships and catalyses new donor relationships.',
      'Create communication that inspires commitment amongst staff and talent, builds a strong values-driven culture, and makes OLF the workplace people aspire to be part of.',
      'Position OLF as a thought leader.'
    ],
    goals: [
      { n:1, title:'Drive teacher engagement and Vinoba adoption through inspiring programme-aligned communication', measure:'Achieve at least 80% TEN score (Teacher Engagement) as per Annexure A. Grow app adoption by 5% each month.', weight:'50%' },
      { n:2, title:'Deliver impactful donor communication that strengthens partnerships and supports new donor engagement', measure:'Achieve 80% donor engagement as per Annexure B.', weight:'20%' },
      { n:3, title:'Create communication that builds staff commitment, culture, and pride in OLF', measure:'Engage OLF team as per Annexure C.', weight:'10%' },
      { n:4, title:'Position OLF as a credible thought leader in education transformation', measure:'Achieve score as per Annexure D in reach, engagement, or stakeholder response on thought leadership content.', weight:'10%' },
      { n:5, title:'Self Development and High Performance Team', measure:'Ensure disciplined execution and learning as per Annexure E.', weight:'10%' }
    ],
    annexures: [
      { title: 'Annexure A — Teacher Engagement Score (TEN)', content: `
        <table class="annex-table">
          <thead><tr><th>#</th><th>Measure</th><th class="center">Weightage</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Improve teacher engagement through Kathavali, social media, and field communication.</td><td class="center"><span class="score-pill">30%</span></td></tr>
            <tr><td>2</td><td>Strengthen teacher stories, programme updates, and Vinoba adoption campaigns.</td><td class="center"><span class="score-pill">10%</span></td></tr>
            <tr><td>3</td><td>5% growth in unique weekly active users and monthly active users each month.</td><td class="center"><span class="score-pill">10%</span></td></tr>
          </tbody>
        </table>
        <table class="annex-table" style="margin-top:16px">
          <thead><tr><th>#</th><th>Exhibit — Activity / Engagement</th><th class="center">Monthly Target</th><th class="center">Weightage</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Feature reels of impactful stories (teachers, schools, alumni, IAS officers, students)</td><td class="center">5/month</td><td class="center"><span class="score-pill">10%</span></td></tr>
            <tr><td>2</td><td>Vinoba Kathavali newsletter</td><td class="center">1/month</td><td class="center"><span class="score-pill">5%</span></td></tr>
            <tr><td>3</td><td>Market Vinoba Kathavali among teachers</td><td class="center">2,000+ engagements/month</td><td class="center"><span class="score-pill">5%</span></td></tr>
            <tr><td>4</td><td>Track social media engagement (views, likes, shares, followers)</td><td class="center">Monthly report</td><td class="center"><span class="score-pill">5%</span></td></tr>
            <tr><td>5</td><td>Track teacher posts using #Vinoba / #Acharyakul</td><td class="center">200+/month</td><td class="center"><span class="score-pill">3%</span></td></tr>
            <tr><td>6</td><td>Create engagement analytics report</td><td class="center">1/month</td><td class="center"><span class="score-pill">2%</span></td></tr>
            <tr><td>7</td><td>Post-event content for TRE / SUN events</td><td class="center">50 reels/videos/stories per event</td><td class="center"><span class="score-pill">5%</span></td></tr>
            <tr><td>8</td><td>Growth marketing communication</td><td class="center">2/month</td><td class="center"><span class="score-pill">2%</span></td></tr>
            <tr><td>9</td><td>Other marketing comms (Sikshan Utsav, Nanhe Sitare, Chakmak, Collector ki Slate)</td><td class="center">3/month</td><td class="center"><span class="score-pill">3%</span></td></tr>
          </tbody>
        </table>` },
      { title: 'Annexure B — Donor Engagement', content: `
        <table class="annex-table">
          <thead><tr><th>#</th><th>Measure</th><th class="center">Weightage</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Strengthen donor engagement through newsletters, social media, and field stories.</td><td class="center"><span class="score-pill">20%</span></td></tr>
          </tbody>
        </table>
        <table class="annex-table" style="margin-top:16px">
          <thead><tr><th>#</th><th>Exhibit — Activity / Engagement</th><th class="center">Monthly Target</th><th class="center">Weightage</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Donor newsletter</td><td class="center">1/month</td><td class="center"><span class="score-pill">2%</span></td></tr>
            <tr><td>2</td><td>Donor impact reels</td><td class="center">1/month</td><td class="center"><span class="score-pill">2%</span></td></tr>
            <tr><td>3</td><td>Donor social media posts</td><td class="center">2/month</td><td class="center"><span class="score-pill">2%</span></td></tr>
            <tr><td>4</td><td>Donor annual report</td><td class="center">1/year</td><td class="center"><span class="score-pill">2%</span></td></tr>
            <tr><td>5</td><td>Donor presentations and partnership collaterals</td><td class="center">As required</td><td class="center"><span class="score-pill">2%</span></td></tr>
            <tr><td>6</td><td>Track donor newsletter engagement</td><td class="center">20/month</td><td class="center"><span class="score-pill">2.5%</span></td></tr>
            <tr><td>7</td><td>Track donor social media engagement</td><td class="center">Monthly</td><td class="center"><span class="score-pill">2.5%</span></td></tr>
            <tr><td>8</td><td>Donor posts with #Vinoba / #OpenLinksFoundation</td><td class="center">1/month</td><td class="center"><span class="score-pill">2%</span></td></tr>
            <tr><td>9</td><td>Donor engagement analytics report</td><td class="center">1/month-quarter</td><td class="center"><span class="score-pill">2%</span></td></tr>
          </tbody>
        </table>` },
      { title: 'Annexure C — OLF Team Engagement', content: `
        <table class="annex-table">
          <thead><tr><th>#</th><th>Measure</th><th class="center">Weightage</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Strengthen employee engagement through internal newsletters, leadership communication, culture initiatives, and event communications.</td><td class="center"><span class="score-pill">10%</span></td></tr>
          </tbody>
        </table>
        <table class="annex-table" style="margin-top:16px">
          <thead><tr><th>#</th><th>Activity / Engagement</th><th class="center">Target</th><th class="center">Weightage</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Internal newsletter / employee magazine</td><td class="center">1/month</td><td class="center"><span class="score-pill">3%</span></td></tr>
            <tr><td>2</td><td>Office Graffiti / Desktop Graffiti</td><td class="center">1/quarter</td><td class="center"><span class="score-pill">2%</span></td></tr>
            <tr><td>3</td><td>Employee LinkedIn story</td><td class="center">1/month</td><td class="center"><span class="score-pill">1%</span></td></tr>
            <tr><td>4</td><td>Communication for internal events (Darpan, MoM, etc.)</td><td class="center">As required</td><td class="center"><span class="score-pill">1%</span></td></tr>
            <tr><td>5</td><td>Open house</td><td class="center">1/quarter</td><td class="center"><span class="score-pill">0.25%</span></td></tr>
            <tr><td>6</td><td>Track internal newsletter engagement</td><td class="center">50/month</td><td class="center"><span class="score-pill">3%</span></td></tr>
          </tbody>
        </table>` },
      { title: 'Annexure D — OLF Thought Leadership', content: `
        <table class="annex-table">
          <thead><tr><th>#</th><th>Measure</th><th class="center">Weightage</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Build external narratives around OLF's work, impact, and learnings.</td><td class="center"><span class="score-pill">5%</span></td></tr>
            <tr><td>2</td><td>Strengthen LinkedIn, media, and leadership visibility.</td><td class="center"><span class="score-pill">5%</span></td></tr>
          </tbody>
        </table>
        <table class="annex-table" style="margin-top:16px">
          <thead><tr><th>#</th><th>Activity</th><th class="center">Measure</th><th class="center">Weightage</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Thought leadership articles / blogs</td><td class="center">2 blogs/month</td><td class="center"><span class="score-pill">5%</span></td></tr>
            <tr><td>2</td><td>Views, followers, likes, comments and forwards</td><td class="center">Numbers by end of Aug</td><td class="center"><span class="score-pill">2.5%</span></td></tr>
            <tr><td>3</td><td>Media stories and press / TV communication</td><td class="center">2/month</td><td class="center"><span class="score-pill">2.5%</span></td></tr>
          </tbody>
        </table>` },
      { title: 'Annexure E — Self Development & High Performance', content: `
        <table class="annex-table">
          <thead><tr><th>#</th><th>Objective</th><th>Target</th><th class="center">Weightage</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>Planning and Tracking</td><td></td><td class="center"><span class="score-pill">2.5%</span></td></tr>
            <tr><td>a</td><td>Finalisation of monthly Plan (next month) and Actual (previous month) by 28th</td><td>29th of every month</td><td class="center">—</td></tr>
            <tr><td>b</td><td>Finalisation of weekly Plan and Actual by Friday of week</td><td>Weekly, Friday EOD</td><td class="center">—</td></tr>
            <tr><td>c</td><td>Review meeting by 3rd</td><td>Updated HO PPT with ZERO errors by 2nd EOD</td><td class="center">—</td></tr>
            <tr><td>d</td><td>Follow-up action on items — 100%</td><td></td><td class="center">—</td></tr>
            <tr><td>2</td><td>No Ball Dropped (company policy, accuracy, commitments)</td><td>100% compliance; ZERO mistakes / missed commitments monthly</td><td class="center"><span class="score-pill">2.5%</span></td></tr>
            <tr><td>3</td><td>Two case studies each month</td><td>Per month</td><td class="center"><span class="score-pill">2.5%</span></td></tr>
            <tr><td>4</td><td>Achieve Learning and Development goals</td><td></td><td class="center"><span class="score-pill">2.5%</span></td></tr>
          </tbody>
        </table>` }
    ],
    priority: [
      { n:1, goal:'Engagement Tracking', focus:'Set up engagement tracking for Kathavali, donor newsletters and employee newsletter.' },
      { n:2, goal:'Performance Metrics', focus:'Provide performance-matrix numbers for social media engagement — followers, views, likes, shares, etc. — for all target segments.' },
      { n:3, goal:'Office Graffiti', focus:'Complete graffiti for 1 office wall.' }
    ]
  },

  strategy: {
    level: 'Leadership',
    title: 'Strategy & Network',
    person: 'Rajeev Kumar',
    reportingManager: 'Sanjay Dalmia',
    hasData: true,
    role: 'Lead strategy and external network development for OLF — build and sustain key government, ecosystem and thought leadership relationships that enable OLF to grow its impact, influence and funding base.',
    resp: [
      'Strategic Partnerships — Identify, build and sustain high-value partnerships with government, corporates, foundations, and aligned ecosystem organisations.',
      'Network Development — Build and maintain OLF\'s external network with influencers, policymakers, and education ecosystem leaders.',
      'Fundraising Support — Support the Head of Fundraising with warm introductions, relationship cultivation and partner engagement.',
      'Thought Leadership — Represent OLF at key forums, conferences and platforms to strengthen its positioning as a thought leader in government school education.'
    ],
    goals: [
      { n:1, title:'Government and Ecosystem Partnerships', measure:'Support CEO in securing five-year MoU with Maharashtra Government and SCERT approval in Chhattisgarh.\nBuild active partnerships with 3 new ecosystem organisations.', weight:'30%' },
      { n:2, title:'Network Development and Donor Introduction', measure:'Introduce minimum 5 qualified new donor prospects to the Fundraising team per quarter.\nMaintain active engagement with 10 key network members monthly.', weight:'30%' },
      { n:3, title:'Thought Leadership and External Representation', measure:'Represent OLF at minimum 2 high-value forums or conferences per quarter.\nContribute to 1 thought leadership article or paper per half-year.', weight:'20%' },
      { n:4, title:'Strategic Planning Support', measure:'Quarterly strategic review with CEO completed and action items tracked.\nAnnual strategy document updated and shared with leadership team.', weight:'20%' }
    ]
  },

  'software-dev': {
    level: 'Manager',
    title: 'Manager — Software Development & Hosting',
    person: 'Vacant',
    reportingManager: 'Craig H Dsouza',
    hasData: true,
    role: 'Design, build, and operate a reliable, scalable, and secure technology platform that enables effective program delivery, user engagement, and data-driven decision-making for the Vinoba program.',
    resp: [
      'Software Development and Platform Build — Develop and maintain the Vinoba platform, including new features, enhancements, and integrations aligned with product requirements and technology upgrades. Manage structured release cycles, code quality, version control, and smooth deployment of new features and fixes.',
      'Reliability and Hosting — Ensure high availability, performance, scalability, and uptime of the platform through robust hosting infrastructure and monitoring.',
      'Performance Optimisation and Scalability — Continuously improve system performance, responsiveness, and ability to scale with increasing users and data.',
      'Technical Support to Product and IT-Ops — Collaborate with Product Management and IT-Ops teams to resolve bugs, implement improvements, and support operational needs.',
      'Data Management and Security — Ensure data integrity, backup, privacy, and security across all systems.'
    ],
    goals: [
      { n:1, title:'Software Development Management', measure:'Planned and timely execution of:\nMigration to PostgreSQL and Google Cloud.\nData Lakehouse, Single Sign-on, Chakmak, AI — launch and stabilisation, and other enhancements.\nEach dev team will make 1 release per week. No fatal or critical error in each release.', weight:'40%' },
      { n:2, title:'Performance Optimisation and Scalability', measure:'99% uptime and prompt user support with SLAs met.\nFine-tune performance issues proactively; ensure no session timeouts in short periods.\nProactively reduce cost of hosting servers by improving design.', weight:'30%' },
      { n:3, title:'Support to IT-Ops', measure:'Provide support to IT-Ops as per SLAs.', weight:'20%' },
      { n:4, title:'Data Management and Security', measure:'Run a penetration test and fix OWASP Top 10 issues.', weight:'10%' }
    ]
  },

  'prog-insights-analyst': {
    level: 'Analyst',
    title: 'Analyst — Program Insights',
    person: 'Data Analyst',
    hasData: true,
    role: 'Deliver timely, accurate data analysis, dashboard automation, and reporting for academic and platform operations.',
    resp: [
      'Data Verification & Validation — Ensure reporting accuracy and zero data discrepancies across state and district dashboards.',
      'Analysis & Dashboard Support — Prepare weekly performance digests, Disha analytics, and program operational charts.',
      'Stakeholder Support — Provide prompt data support to Program Managers, DMs, and State Leadership.'
    ],
    goals: [
      { n: 1, title: 'Data Accuracy & Timely Delivery', measure: '100% timely delivery of scheduled weekly and monthly program insight reports with zero critical errors.', weight: '40%' },
      { n: 2, title: 'Operational Analytics & Automation', measure: 'Maintain updated templates, automated forms, and error-free dashboards for Disha and academic tracking.', weight: '30%' },
      { n: 3, title: 'Cross-functional Collaboration', measure: 'Resolve incoming analytics requests and ad-hoc queries from field PMs within agreed turnaround times.', weight: '20%' },
      { n: 4, title: 'Continuous Improvement & Learning', measure: 'Implement at least 1 analytics process improvement or workflow automation per quarter.', weight: '10%' }
    ]
  },

  'it-ops-associate': {
    level: 'Associate',
    title: 'Associate — IT Operations',
    person: 'IT Operations Associate',
    hasData: true,
    role: 'Deliver high-quality technical support, device provisioning, system configuration, and operational tooling for staff across all state offices.',
    resp: [
      'IT Service & Device Management — Handle laptop provisioning, user access, Google Workspace administration, and hardware troubleshooting.',
      'System Uptime & Support SLAs — Ensure fast turnaround times on IT Helpdesk tickets and field operational requests.',
      'Security & Asset Tracking — Maintain accurate digital asset registries and ensure endpoint compliance with security standards.'
    ],
    goals: [
      { n: 1, title: 'IT Support SLA Adherence', measure: 'Resolve >=95% of standard user IT support tickets within 24 hours of ticket submission.', weight: '40%' },
      { n: 2, title: 'Asset & Identity Management', measure: 'Maintain 100% accurate device inventory and identity management records with zero unauthorized accesses.', weight: '30%' },
      { n: 3, title: 'Operational Infrastructure Support', measure: 'Ensure uninterrupted uptime for state office networks, video conferencing, and productivity tooling.', weight: '30%' }
    ]
  },

  'curation-lead': {
    level: 'Manager',
    title: 'Curations Manager',
    person: 'Vaidehi M Shhalu',
    reportingManager: 'Vishvajit G Pawar',
    hasData: true,
    role: 'Lead and manage the curation team, ensuring high pedagogical quality, accurate taxonomy, and continuous enrichment of educational and life skills content across the Vinoba platform.',
    resp: [
      'Lead and mentor the Curations Team across educational and life-skills streams.',
      'Ensure 100% adherence to quality standards and error-free metadata cataloging.',
      'Coordinate closely with Program Implementation leadership and State Teams on curriculum priorities.',
      'Maintain rigorous weekly review cadence and throughput benchmarks.'
    ],
    goals: [
      { n: 1, title: 'Curation Quality & Standards', measure: 'Maintain >=98% accuracy and quality compliance across all curated content lots.', weight: '40%' },
      { n: 2, title: 'Content Turnaround & Scale', measure: 'Meet weekly and monthly curation delivery targets to support state program rollout.', weight: '30%' },
      { n: 3, title: 'Team Leadership & Capacity Building', measure: 'Conduct regular training and weekly review sessions for all curation associates.', weight: '30%' }
    ]
  },

  'curation-associate': {
    level: 'Associate',
    title: 'Program Associate — Curation',
    person: 'Curation Associate',
    hasData: true,
    role: 'Review, evaluate, curate, and catalog high-quality educational and life-skills content across the Vinoba platform.',
    resp: [
      'Content Evaluation & Quality Assurance — Screen submitted educational materials against pedagogical benchmarks and quality criteria.',
      'Taxonomy & Categorisation — Ensure content is mapped accurately by grade, subject, medium, and chapter.',
      'Content Pool Growth — Actively expand high-engagement digital resources for teachers and students.'
    ],
    goals: [
      { n: 1, title: 'Curation Throughput & Quality', measure: 'Curate target volume of weekly content submissions with >=98% accuracy against review guidelines.', weight: '40%' },
      { n: 2, title: 'Platform Content Enrichment', measure: 'Meet curriculum coverage benchmarks across assigned grades and subjects on Vinoba.', weight: '35%' },
      { n: 3, title: 'Feedback & Collaboration', measure: 'Provide constructive pedagogical feedback to content creators and field teams within 48 hours.', weight: '25%' }
    ]
  },

  'content-associate': {
    level: 'Associate',
    title: 'Program Associate — Content',
    person: 'Content Associate',
    hasData: true,
    role: 'Develop, standardize, and produce engaging academic, teacher development, and life skills content for Vinoba programs.',
    resp: [
      'Content Production — Design engaging worksheets, assessment modules, lesson aids, and digital learning assets.',
      'Curriculum Alignment — Ensure content strictly matches state board curriculum guidelines (Maharashtra SCERT & Chhattisgarh).',
      'Continuous Iteration — Incorporate feedback from classroom trials and teacher reviews into iterative content updates.'
    ],
    goals: [
      { n: 1, title: 'Content Delivery Milestones', measure: 'Produce and deliver scheduled content packages on time adhering to instructional design standards.', weight: '40%' },
      { n: 2, title: 'Classroom Efficacy & Quality', measure: 'Achieve >=90% positive ratings from classroom pilot tests and teacher evaluations.', weight: '35%' },
      { n: 3, title: 'Team Collaboration & Innovation', measure: 'Contribute actively to content sprints, training workshops, and resource digitization.', weight: '25%' }
    ]
  },

  'partnerships-team': {
    level: 'Associate / Officer',
    title: "Partnerships & Founder's Office",
    person: 'Prashant G · Naveed · Neetika · Priyanshi',
    reportingManager: 'Sowmya Srinivasan',
    hasData: true,
    role: "Support donor engagement, grant servicing, proposal preparation, stakeholder communication, and strategic executive initiatives under the Founder's Office.",
    resp: [
      'Donor Servicing & Reporting — Prepare periodic grant utilization updates, milestone progress reports, and documentation for funding partners.',
      'Proposal & Collateral Development — Draft tailored grant proposals, presentations, concept notes, and fundraising materials.',
      'Executive & Founder Support — Coordinate strategic research, stakeholder correspondence, and executive priorities for leadership outreach.',
      'Cross-Team Alignment — Liaise with Field Operations and Finance teams to collate ground metrics and financial reporting for donors.'
    ],
    goals: [
      { n: 1, title: 'Timely Donor Reporting & Compliance', measure: '100% of donor utilization reports and milestone documentation delivered on schedule with zero errors.', weight: '35%' },
      { n: 2, title: 'Proposal & Pitch Collateral Turnaround', measure: 'Draft high-quality proposals and pitch decks within 5 business days of requirement.', weight: '25%' },
      { n: 3, title: 'Founder Office & Cross-Functional Alignment', measure: 'Execute executive research briefs and cross-departmental data collation with high accuracy.', weight: '20%' },
      { n: 4, title: 'Donor Relationship Management', measure: 'Maintain active communication cadence and satisfaction index >=85% across assigned partners.', weight: '20%' }
    ]
  },

  'office-admin': {
    level: 'Officer',
    title: 'Office Administration',
    person: 'Vishal D Nagawade',
    reportingManager: 'Prashant B Bhondve',
    hasData: true,
    role: 'Oversee seamless office operations, facility management, vendor procurement, asset tracking, and logistics support to enable productive working environments across all locations.',
    resp: [
      'Facility & Office Management — Ensure clean, safe, well-equipped, and smoothly functioning office spaces and infrastructure.',
      'Procurement & Vendor Management — Handle procurement of office supplies, IT accessories, housekeeping, and vendor contract negotiations.',
      'Asset Inventory Management — Maintain an up-to-date hardware, laptop, and asset register with periodic physical verifications.',
      'Logistics & Travel Support — Facilitate travel, accommodation, and event logistics for leadership and visiting field teams.'
    ],
    goals: [
      { n: 1, title: 'Facilities Uptime & Work Environment', measure: 'Zero critical downtime for essential utilities, internet, and office facilities across working days.', weight: '30%' },
      { n: 2, title: 'Asset Inventory & Verification', measure: '100% accurate asset register maintained with quarterly physical audit and reconciliation.', weight: '25%' },
      { n: 3, title: 'Procurement & Vendor SLAs', measure: 'Process procurement requests and verify vendor invoices within agreed turnaround times (<=3 days).', weight: '25%' },
      { n: 4, title: 'Logistics & Operational Support', measure: 'Deliver seamless travel, meeting, and event logistics with >=90% stakeholder satisfaction rating.', weight: '20%' }
    ]
  },

  'talent-acquisition': {
    level: 'Manager',
    title: 'Manager — Talent Acquisition & HR',
    person: 'Raghav Duggal',
    reportingManager: 'Vishvajit G Pawar',
    hasData: true,
    role: 'Drive full-lifecycle recruitment, talent sourcing, employee onboarding, and HR operations to attract, integrate, and support high-performing talent aligned with OLF\'s mission.',
    resp: [
      'Talent Sourcing & Recruitment — Source, screen, and interview candidates across technical, field leadership, and central office roles.',
      'Hiring Pipeline & SLA Management — Coordinate with hiring managers to ensure structured interviews, timely evaluation, and rapid offer rollout.',
      'Onboarding & Induction — Oversee structured 30-60-100 day onboarding journeys to drive role clarity, cultural immersion, and quick ramp-up.',
      'HR Operations & People Compliance — Manage employment documentation, background checks, policy compliance, and talent database maintenance.'
    ],
    goals: [
      { n: 1, title: 'Hiring Target Completion & Time-to-Fill', measure: 'Close >=90% of open requisitions within agreed SLAs across field and central roles.', weight: '40%' },
      { n: 2, title: 'Onboarding Quality & 100-Day Experience', measure: 'Achieve >=90% positive onboarding satisfaction rating from new hires during their first 90 days.', weight: '25%' },
      { n: 3, title: 'Sourcing Pipeline & Talent Brand', measure: 'Build robust talent pools for critical recurring positions (Project Officers, Tech, Analysts).', weight: '20%' },
      { n: 4, title: 'HR Compliance & Record Keeping', measure: '100% compliance on employee files, contracts, background verifications, and HR records.', weight: '15%' }
    ]
  },

  'prod-mgmt': {
    level: 'Manager',
    title: 'Product Management',
    person: 'Vacant · Interim',
    reportingManager: 'Craig H Dsouza',
    hasData: true,
    role: 'Define product strategy, feature roadmap, user journey specifications, and data-driven product enhancements for the Vinoba ecosystem.',
    resp: [
      'Product Strategy & Roadmap — Formulate product roadmaps addressing user needs, field feedback, and organizational goals.',
      'Requirement Specifications (PRDs) — Author detailed feature requirements, user stories, workflows, and acceptance criteria.',
      'Cross-Functional Execution — Collaborate closely with Software Dev, IT-Ops, and Field Enablement to ship impactful releases.',
      'Product Analytics & Adoption — Measure feature adoption, user retention, usability bottlenecks, and feedback loops.'
    ],
    goals: [
      { n: 1, title: 'Roadmap Execution & Release Delivery', measure: 'Deliver quarterly product roadmap commitments on time with minimal scope creep.', weight: '40%' },
      { n: 2, title: 'Feature Adoption & Usage Growth', measure: 'Increase active feature usage by 20% post-launch through intuitive design and user enablement.', weight: '30%' },
      { n: 3, title: 'High-Quality PRDs & Specs', measure: 'Deliver comprehensive PRDs and acceptance criteria prior to sprint planning for 100% of features.', weight: '20%' },
      { n: 4, title: 'User Feedback & Bug Triage SLAs', measure: 'Triage user feedback and critical product issues within 48 hours in coordination with tech leads.', weight: '10%' }
    ]
  },

  'marketing-team': {
    level: 'Associate',
    title: 'Communications & Research',
    person: 'Anushka Banerjee · Ashutosh Ghag',
    reportingManager: 'Vaibhavi Ratish Kumar',
    hasData: true,
    role: 'Produce engaging multimedia content, impact case studies, field research briefs, and digital campaigns that amplify the story of public school transformation.',
    resp: [
      'Impact Storytelling & Case Studies — Interview teachers, students, and officers in the field to write compelling success stories.',
      'Digital Content & Campaigns — Manage social media channels, newsletters, creative graphics, and video highlights of field events.',
      'Research & Field Synthesis — Collate classroom feedback, student progress metrics, and surveys into structured research briefs.',
      'Brand & Visual Identity — Maintain consistent organizational brand guidelines across all published collateral.'
    ],
    goals: [
      { n: 1, title: 'Impact Case Studies & Stories', measure: 'Research, produce, and publish 4 verified in-depth field impact stories and monthly newsletters.', weight: '35%' },
      { n: 2, title: 'Digital Channel Engagement Growth', measure: 'Achieve 25% growth in digital engagement, follower reach, and newsletter open rates.', weight: '25%' },
      { n: 3, title: 'Research Briefs & Documentation', measure: 'Synthesize quarterly field research briefs and survey findings for leadership and partners.', weight: '25%' },
      { n: 4, title: 'Brand Alignment & Turnaround', measure: '100% adherence to OLF design and voice standards with turnaround within 3 days for creative requests.', weight: '15%' }
    ]
  },

  'advisory-george': {
    level: 'Professor Emeritus',
    title: 'Professor Emeritus — Community Building',
    person: 'George Varghese',
    reportingManager: 'Sanjay Dalmia',
    hasData: true,
    role: 'Provide expert strategic advisory, community building guidance, pedagogy alignment, and ecosystem connections to expand Vinoba\'s transformative reach.',
    resp: [
      'Strategic Community Advisory — Guide leadership on grassroots community engagement models, teacher motivation, and volunteer structures.',
      'Pedagogy & Program Review — Review community initiatives, life-skills curricula, and recognition frameworks for sustained systemic impact.',
      'Ecosystem & Institutional Linkages — Foster institutional connections with academic bodies, educational thought leaders, and civil society.'
    ],
    goals: [
      { n: 1, title: 'Strategic Advisory & Leadership Reviews', measure: 'Participate in quarterly strategic advisory sessions and provide actionable recommendation briefs.', weight: '40%' },
      { n: 2, title: 'Program & Pedagogy Guidance', measure: 'Provide expert reviews on community programs, teacher engagement metrics, and movement building.', weight: '35%' },
      { n: 3, title: 'Ecosystem & Partner Linkages', measure: 'Facilitate strategic introductions and expert inputs to accelerate organizational reach and credibility.', weight: '25%' }
    ]
  },

  'advisory-shalini': {
    level: 'Consultant',
    title: 'Consultant — Strategic Advisory',
    person: 'Shalini Agarwal',
    reportingManager: 'Sanjay Dalmia',
    hasData: true,
    role: 'Provide strategic consultancy on organizational development, strategic partnerships, ecosystem alignment, and executive reviews for leadership.',
    resp: [
      'Strategic Consultancy — Provide executive-level guidance on partnership strategies and organizational alignment.',
      'Program Review & Evaluation — Review milestones, governance frameworks, and impact deliverables.',
      'Stakeholder Alignment — Facilitate connections and reviews with ecosystem leaders and institutional partners.'
    ],
    goals: [
      { n: 1, title: 'Strategic Advisory & Reviews', measure: 'Deliver quarterly consultancy briefs and strategic evaluation memos.', weight: '40%' },
      { n: 2, title: 'Program Milestone Review', measure: 'Conduct periodic program and milestone reviews with actionable feedback.', weight: '35%' },
      { n: 3, title: 'Ecosystem & Partnership Support', measure: 'Support strategic partner engagement and institutional alignment.', weight: '25%' }
    ]
  },

  'community-advisory': {
    level: 'Advisor',
    title: 'Community Advisory',
    person: 'George Varghese',
    reportingManager: 'Sanjay Dalmia',
    hasData: true,
    role: 'Provide expert strategic advisory, community building guidance, pedagogy alignment, and ecosystem connections to expand Vinoba\'s transformative reach.',
    resp: [
      'Strategic Community Advisory — Guide leadership on grassroots community engagement models, teacher motivation, and volunteer structures.',
      'Pedagogy & Program Review — Review community initiatives, life-skills curricula, and recognition frameworks for sustained systemic impact.',
      'Ecosystem & Institutional Linkages — Foster institutional connections with academic bodies, educational thought leaders, and civil society.'
    ],
    goals: [
      { n: 1, title: 'Strategic Advisory & Leadership Reviews', measure: 'Participate in quarterly strategic advisory sessions and provide actionable recommendation briefs.', weight: '40%' },
      { n: 2, title: 'Program & Pedagogy Guidance', measure: 'Provide expert reviews on community programs, teacher engagement metrics, and movement building.', weight: '35%' },
      { n: 3, title: 'Ecosystem & Partner Linkages', measure: 'Facilitate strategic introductions and expert inputs to accelerate organizational reach and credibility.', weight: '25%' }
    ]
  }
};

  window.OLF_ORGCHART_DATA = {
    tree: ORG_TREE,
    subDepts: SUB_DEPTS,
    roles: ORG_ROLES
  };

})();
