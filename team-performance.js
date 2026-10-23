/**
 * OLF StaffConnect - Team Performance Module
 * Flowchart Hierarchy & Full-Featured Multi-Tab Editor
 * Dynamically connected in 100% read-only mode to Employees collection
 */
(function () {
  "use strict";

  const STORAGE_KEY = "olf_team_performance_custom_data_v5";

  // Pre-cached live staff snapshot (112 active Program Implementation staff)
  const CACHED_PROGRAM_STAFF = [
  {
    "id": "OLF-23-010",
    "Dept": "Program Implementation COO",
    "State": "Maharashtra",
    "Name": "Vishvajit G Pawar",
    "Designation": "COO",
    "Block": "102001- MANSOORCHAK; 102002- BACHHWARA; 102003- CHERIYA BARIYARPUR; 102004- KHODAWANDPUR; 102005- SAHEBPUR KAMAL; 102006- MATIHANI; 102007- BIRPUR; 102008- BARAUNI; 102010- BEGUSARAI; 102011- BAKHRI; 102012- TEGHRA; 102013- DANDARI; 102014- SHAMHO AKHA KURHA; 102015- CHHAURAHI; 102016- BALIA; 102017- NAOKOTHI; 102018- BHAGWANPUR; 102019- GARHPURA; 220301-BAGICHA; 220304-DULDULA; 220305-FARSABAHAR; 220307-JASHPUR; 220308-KANSABEL; 220310-KUNKURI; 220312-MANORA; 220313-PATHALGAON; 220403- DHARAMJAIGARH; 220406- GHARGHODA; 220409- KHARSIA; 220411- LAILUNGA; 220414- PUSSORE; 220415- RAIGARH; 220417- TAMNAR; 220601-AKALTARA; 220602-BALODA; 220604-BAMHNINDIH; 220617-NAWAGARH; 220619-PAMGARH; 220801-BODLA; 220807-KAWARDHA; 220812-SAHASPUR LOHARA; 220813-PANDARIYA; 220904-CHURIA; 220905-DONGARGAON; 220906-DONGARGARH; 220911-RAJNANDGAON; 221006-DHAMDHA; 221007-DURG; 221011-PATAN; 221104-DHARSHIWA; 221106-ABHANPUR; 221108-TILDA; 221122-ARANG; 221303-KURUD; 221313-NAGRI; 221327-MAGARLOD; 221330-DHAMTARI; 221504-DARBHA; 221517-BASTAR; 221523-TOKAPAL; 221524-LOHANDIGUDA; 221529-BAKAWAND; 221530-BASTANAR; 221533-JAGDALPUR; 221608-GEEDAM; 221615-KATEKALYAN; 221619-KUAKONDA; 221622-DANTEWADA; 222102-SUKMA; 222134-KONTA; 222135-CHHINDGARH; 222505-CHHURA; 222514-DEOBHOG; 222519-GARIABAND; 222523-FINGESHWAR; 222526-MAINPUR; 234401-SEONI; 234402-BARGHAT; 234403-KEOLARI; 234404-KURAI; 234405-CHHAPARA; 234406-LAKHNADON; 234407-GHANSORE; 234408-DHANORA; 234501-BALAGHAT; 234502-KIRNAPUR; 234503-KATANGI; 234504-KHAIRLANJI; 234505-PARASWADA; 234506-LAL BURRA; 234507-WARA SEONI; 234508-LANJI; 234509-BAIHAR; 234510-BIRSA; 270101 - NANDURBAR; 270102 - NAVAPUR; 270103 - SHAHADA; 270104 - TALODA; 270105 - AKKALKUWA; 270106 - DHADGAON; 270301-AMALNER; 270302-BHADGAON; 270303-BHUSAWAL; 270304-BODWAD; 270305-CHALISGAON; 270306-CHOPDA; 270307-DHARANGAON; 270308-ERANDOL; 270309-JALGAON; 270310-JAMNER; 270311-MUKTAINAGAR; 270312-PACHORA; 270313-PAROLA; 270314-RAWER; 270315-YAWAL; 270401-BULDANA; 270402-CHIKHALI; 270403-KHAMGAON; 270404-DEULGAON RAJA; 270405-MOTALA; 270406-LOANR; 270407-MALAKAPUR; 270408-MEHAKAR; 270409-JALGAON JAMOD; 270410-NANDURA; 270411-SANGRAMPUR; 270412-SHEGAON; 270413-SINDKHED RAJA; 27060-KARANJA LAD; 27060-MALEGAON; 27060-MANGRULPIR; 27060-RISOD; 27060-WASHIM; 270604-MANORA; 270701 - ACHALPUR; 270702 - AMRAVATI; 270703 - ANJANGAON SURJI; 270704 - BHATKULI; 270705 - CHANDUR BZ; 270706 - CHIKHALDARA; 270707 - CHANDUR RLY; 270708 - DARYAPUR; 270709 - DHARNI; 270710 - DHAMANGAON RLY; 270711 - MORSHI; 270712 - NANDGAON KH; 270713 - TIOSA; 270714 - WARUD; 270715 - AMRAVATI MNP; 270801 - ARVI; 270802 - ASHTI; 270803 - DEOLI; 270804 - HINGANGHAT; 270805 - KARANJA; 270806 - SAMUDRAPUR; 270807 - SELOO; 270808 - WARDHA; 270901-NARKHED; 270902-KATOL; 270903-KALMESHWAR; 270904-SAONER; 270905-KAMPTEE; 270906-RAMTEK; 270907-MOUDA; 270908-PARSEONI; 270909-NAGPUR (GRAMIN); 270910-HINGNA; 270911-UMRED; 270912-KUHI; 270913-BHIWAPUR; 270915-URC 2; 271001-BHANDARA; 271002-MOHADI; 271003-TUMSAR; 271004-SAKOLI; 271005-LAKHANI; 271006-LAKHANDUR; 271007-PAUNI; 271201-GADCHIROLI; 271202-ARMORI; 271203-KURKHEDA; 271204-DHANORA; 271205-CHAMORSHI; 271206-AHERI; 271207-ETAPALLI; 271208-SIRONCHA; 271209-MULCHERA; 271210-KORCHI; 271211-BHAMRAGAD; 271212-DESAIGANJ; 271301-CHANDRAPUR; 271302-BHADRAWATI; 271303-WARORA; 271304-BALLARPUR; 271305-RAJURA; 271306-GONDPIPARI; 271307-KORPANA; 271308-MUL; 271309-SINDEWAHI; 271310-NAGBHID; 271311-BRAMHAPURI; 271312-CHIMUR; 271313-SAOLI; 271314-POMBURNA; 271315-JIWATI; 271401 - ARNI; 271402 - BABHULGAON; 271403 - DARWHA; 271404 - DIGRAS; 271405 - GHATANJI; 271406 - KALAMB; 271407 - MAHAGAON; 271408 - MAREGAON; 271409 - NER; 271410 - PANDHARKAWADA; 271411 - PUSAD; 271412 - RALEGAON; 271413 - UMARKHED; 271414 - WANI; 271415 - YAVATMAL; 271416 - ZARI; 271501 - NANDED; 271502 - ARDHAPUR; 271503 - MUDKHED; 271504 - LOHA; 271505 - KANDHAR; 271506 - MUKHED; 271507 - DEGLOOR; 271508 - BILOLI; 271509 - NAIGAON; 271510 - DHARMABAD; 271511 - BHOKAR; 271512 - UMRI; 271513 - HADGAON; 271514 - HIMAYAT NAGAR; 271515 - KINWAT; 271516 - MAHOOR; 271517 - NANDED M.C.; 271601 - HINGOLI; 271602 - SENGAON; 271603 - BASMATH; 271604 - KALAMNURI; 271605 - AUNDHA NAGNATH; 271801 - JALNA; 271802 - BADNAPUR; 271803 - AMBAD; 271804 - GHANSAWANGI; 271805 - PARTUR; 271806 - MANTHA; 271807 - BHOKARDAN; 271808 - JAFRABAD; 272001-BAGLAN; 272002-CHANDWAD; 272003-DEVLA; 272004-DINDORI; 272005-IGATPURI; 272006-KALWAN; 272007-MALEGAON; 272008-NANDGAON; 272009-NASHIK; 272010-NIPHAD; 272011-PEINT; 272012-SINNER; 272013-SURGANA; 272014-TRIMBAK; 272015-YEOLA; 272016-NASHIK URC-1; 272016-URC 1; 272018-URC 2; 272106-KALYAN DOMBIVLI-URC1; 272201-URC-1 BORIVALI; 272202-URC-2 KANDIVALI; 272203-URC-3 GOREGAON; 272204-URC-4 ANDHERI; 272205-URC-5 SANTACRUZ; 272206-URC-6 BHANDUP; 272207-URC-7 GHATKOPAR; 272208-URC-8 CHEMBUR; 272209-URC-9 KURLA; 272210-URC-10 PAREL; 272211-URC-11 DADAR; 272212-URC-12 BYCULLA; 272401 - ALIBAG; 272402 - KARJAT; 272403 - KHALAPUR; 272404 - MAHAD; 272405 - MANGAON; 272406 - MHASALA; 272407 - MURUD; 272408 - PANVEL; 272409 - PEN; 272410 - POLADPUR; 272411 - ROHA; 272412 - SUDHAGAD; 272413 - SHRIVARDHAN; 272414 - TALA; 272415 - URAN; 272501-AMBEGAON; 272502-BARAMATI; 272503-BHOR; 272504-DAUND; 272505-HAVELI; 272506-INDAPUR; 272507-JUNNAR; 272508-KHED; 272509-MAVAL; 272510-MULSHI; 272511-PURANDAR; 272512-SHIRUR; 272513-VELHE; 272514-Aundh; 272515-Yerawada; 272516-Bibwewadi; 272517-Hadpasar; 272518-Pune City; 272519-PIMPRI; 272520-AKURDI; 272601-AKOLE; 272602-JAMKHED; 272603-KOPARGAON; 272604-KARJAT; 272605-NAGAR; 272606-NEWASA; 272607-PARNER; 272608-PATHARDI; 272609-RAHURI; 272610-RAHATA; 272611-SHEVGAON; 272612-SANGAMNER; 272613-SHRIGONDA; 272614-SHRIRAMPOOR; 272615-MC AHMEDNAGAR; 272701-AMBAJOGAI; 272702-ASHTI; 272703-BEED; 272704-DHARUR; 272705-GEORAI; 272706-KAIJ; 272707-MAJALGAON; 272708-PARLI; 272709-PATODA; 272710-SHIRUR; 272711-WADWANI; 272712-URC BEED; 272801-LATUR; 272802-RENAPUR; 272803-AUSA; 272804-NILANGA; 272805-SHIRUR ANANTPAL; 272806-DEVANI; 272807-UDGIR; 272808-JALKOT; 272809-AHAMADPUR; 272810-CHAKUR; 272901-BHOOM; 272902-KALLAMB; 272903-LOHARA; 272904-OMERGA; 272905-OSMANABAD; 272906-PARANDA; 272907-TULJAPUR; 272908-WASHI; 273001-AKKALKOT; 273002-BARSHI; 273003-KARMALA; 273004-MADHA; 273005-MALSHIRAS; 273006-MANGALWEDHA; 273007-MOHOL; 273008-PANDHARPUR; 273009-SANGOLA; 273010-SOLAPUR NORTH; 273011-SOLAPUR SOUTH; 273101-JAOLI; 273102-KARAD; 273103-KOREGAON; 273104-KHATAV; 273105-KHANDALA; 273106-MAHABALESHWAR; 273107-MAN; 273108-PATAN; 273109-PHALTAN; 273110-SATARA; 273111-WAI; 273201-CHIPLUN; 273202-DAPOLI; 273203-GUHAGAR; 273204-KHED; 273205-LANJA; 273206-MANDANGAD; 273207-RAJAPUR; 273208-RATNAGIRI; 273209-SANGMESHWAR; 273401-SHAHUWADI; 273402-PANHALA; 273403-HATKALANGLE; 273404-SHIROL; 273405-KARVEER; 273406-GAGANBAWADA; 273407-RADHANAGARI; 273408-KAGAL; 273409-BHUDARGAD; 273410-AAJARA; 273411-GADHINGLAJ; 273412-CHANDGAD; 273510-SANGLIMNC; 273603 - DAHANU; 273604-JAWAHAR; 273608 - MOKHADA; 273611 - PALGHAR; 273613 - TALASARI; 273617 - VASAI; 273618 - VIKRAMGAD; 273619 - WADA; AHERI - Project 1; Ambernath; BHAMRAGAD - Project 2; BHANDARA - Project 3; Bhiwandi; CHANDRAPUR - Project 4; CHIMUR - Project 5; DEORI - Project 6; GADCHIROLI - Project 7; JALGAON M. CORP.; Kalyan; Murbad; NAGPUR - Project 8; Shahapur; URC - 3; URC - 4; URC - 5; WARDHA - Project 9",
    "District": "Ahilyanagar; Amravati; Amravati - MC; Balaghat; Bastar; Begusarai; Bhandara; Bid; Buldhana; Chandrapur; Dantewada; Dhamtari; Dharashiv; Durg; Gadchiroli; Gariaband; Hingoli; Jalgaon; Jalna; Janjgir - Champa; Jashpur; Kabirdham; Kolhapur; Latur; Mumbai Suburban; Nagpur; Nagpur - ATC; Nagpur - MC; Nanded; Nandurbar; Nashik; Nashik - MC; Palghar; Pimpri Chinchwad - MC; Pune; Pune - MC; Raigarh; Raigarh MH; Raipur; Rajnandgaon; Ratnagiri; Sangli - MC; Satara; Seoni; Solapur; Sukma; Thane - KDMC; Thane-ZP; Wardha; Washim; Yavatmal",
    "Location": "Pune HO",
    "Email": "vishvajit@openlinksfoundation.org",
    "Reporting manager": "sanjay@openlinksfoundation.org",
    "Mobile": "8378857788"
  },
  {
    "id": "OLF-23-012",
    "Location": "Pune",
    "Block": "272502-BARAMATI; 272503-BHOR; 272504-DAUND; 272505-HAVELI; 272506-INDAPUR; 272511-PURANDAR; 272513-VELHE; 272514-Aundh; 272515-Yerawada; 272516-Bibwewadi; 272517-Hadpasar; 272518-Pune City; 272519-PIMPRI; 272520-AKURDI",
    "State": "Maharashtra",
    "District": "Pimpri Chinchwad - MC; Pune; Pune - MC",
    "Division": "Pune",
    "Email": "bhairavnath.olf@gmail.com",
    "Mobile": "8793673807",
    "Dept": "Program Implementation",
    "Reporting manager": "rahul@openlinksfoundation.org",
    "Name": "Bhairavnath H Gaikwad",
    "Designation": "Sr. Project Officer"
  },
  {
    "id": "OLF-23-016",
    "Mobile": "9823788290",
    "Email": "vishal@openlinksfoundation.org",
    "Location": "Nagpur",
    "Division": "Nagpur",
    "District": "Balaghat; Bhandara; Gadchiroli; Nagpur; Nagpur - ATC; Nagpur - MC; Seoni",
    "Designation": "Sr. Program Manager",
    "Status": "Active",
    "Reporting manager": "Vishvajit@openlinksfoundation.org",
    "Block": "234401-SEONI; 234402-BARGHAT; 234403-KEOLARI; 234404-KURAI; 234405-CHHAPARA; 234406-LAKHNADON; 234407-GHANSORE; 234408-DHANORA; 234501-BALAGHAT; 234502-KIRNAPUR; 234503-KATANGI; 234504-KHAIRLANJI; 234505-PARASWADA; 234506-LAL BURRA; 234507-WARA SEONI; 234508-LANJI; 234509-BAIHAR; 234510-BIRSA; 270901-NARKHED; 270902-KATOL; 270903-KALMESHWAR; 270904-SAONER; 270905-KAMPTEE; 270906-RAMTEK; 270907-MOUDA; 270908-PARSEONI; 270909-NAGPUR (GRAMIN); 270910-HINGNA; 270911-UMRED; 270912-KUHI; 270913-BHIWAPUR; 270915-URC 2; 271001-BHANDARA; 271002-MOHADI; 271003-TUMSAR; 271004-SAKOLI; 271005-LAKHANI; 271006-LAKHANDUR; 271007-PAUNI; 271201-GADCHIROLI; 271202-ARMORI; 271203-KURKHEDA; 271204-DHANORA; 271205-CHAMORSHI; 271206-AHERI; 271207-ETAPALLI; 271208-SIRONCHA; 271209-MULCHERA; 271210-KORCHI; 271211-BHAMRAGAD; 271212-DESAIGANJ; AHERI - Project 1; BHAMRAGAD - Project 2; BHANDARA - Project 3; CHANDRAPUR - Project 4; CHIMUR - Project 5; DEORI - Project 6; GADCHIROLI - Project 7; NAGPUR - Project 8; URC - 3; URC - 4; URC - 5; WARDHA - Project 9",
    "State": "Maharashtra",
    "Dept": "Program Implementation Div",
    "Name": "Vishal J Dahat"
  },
  {
    "id": "OLF-23-024",
    "Dept": "Program Implementation",
    "Name": "Ganesh C Shende",
    "Location": "Gadchiroli",
    "Mobile": "9673887745",
    "Division": "Nagpur",
    "District": "Gadchiroli",
    "Email": "ganesh.olf@gmail.com",
    "Reporting manager": "vishal@openlinksfoundation.org",
    "State": "Maharashtra",
    "Designation": "Sr. Project Officer",
    "Block": "271201-GADCHIROLI; 271202-ARMORI; 271203-KURKHEDA; 271204-DHANORA; 271205-CHAMORSHI; 271210-KORCHI; 271212-DESAIGANJ"
  },
  {
    "id": "OLF-23-025",
    "Name": "Sachin P Sasane",
    "Designation": "Sr. Project Officer",
    "Dept": "Program Implementation",
    "State": "Maharashtra",
    "Block": "270303-BHUSAWAL; 270304-BODWAD; 270305-CHALISGAON; 270306-CHOPDA; 270307-DHARANGAON; 270311-MUKTAINAGAR; 270314-RAWER",
    "District": "Jalgaon",
    "Division": "Nashik",
    "Location": "Jalgaon",
    "Email": "sachinsasane.olf@gmail.com",
    "Reporting manager": "mohan@openlinksfoundation.org",
    "Mobile": "8237960787"
  },
  {
    "id": "OLF-24-035",
    "State": "Maharashtra",
    "District": "Nagpur - ATC; Nagpur - MC",
    "Division": "Nagpur",
    "Location": "Nagpur",
    "Reporting manager": "vishal@openlinksfoundation.org",
    "Dept": "Program Implementation",
    "Designation": "Sr. Project Officer",
    "Name": "Nikhil H Gajbhiye",
    "Block": "AHERI - Project 1; BHAMRAGAD - Project 2; BHANDARA - Project 3; CHANDRAPUR - Project 4; CHIMUR - Project 5; DEORI - Project 6; GADCHIROLI - Project 7; NAGPUR - Project 8; URC - 3; URC - 4; URC - 5; WARDHA - Project 9",
    "Mobile": "7218020688",
    "Email": "nikhilgajbhiye.olf@gmail.com"
  },
  {
    "id": "OLF-24-037",
    "District": "Gadchiroli",
    "Dept": "Program Implementation",
    "Division": "Nagpur",
    "State": "Maharashtra",
    "Name": "Chandan P Rapartiwar",
    "Block": "271206-AHERI; 271207-ETAPALLI; 271208-SIRONCHA; 271209-MULCHERA; 271211-BHAMRAGAD",
    "Location": "Gadchiroli",
    "Mobile": "7972863037",
    "Reporting manager": "vishal@openlinksfoundation.org",
    "Designation": "Project Officer",
    "Email": "chandanprabhakar.olf@gmail.com"
  },
  {
    "id": "OLF-24-038",
    "Email": "raghunath@openlinksfoundation.org",
    "Mobile": "9022841684",
    "Division": "Amravati",
    "Block": "27060-KARANJA LAD; 27060-MALEGAON; 27060-MANGRULPIR; 27060-RISOD; 27060-WASHIM; 270604-MANORA; 270701 - ACHALPUR; 270702 - AMRAVATI; 270703 - ANJANGAON SURJI; 270704 - BHATKULI; 270705 - CHANDUR BZ; 270706 - CHIKHALDARA; 270707 - CHANDUR RLY; 270708 - DARYAPUR; 270709 - DHARNI; 270710 - DHAMANGAON RLY; 270711 - MORSHI; 270712 - NANDGAON KH; 270713 - TIOSA; 270714 - WARUD; 270715 - AMRAVATI MNP; 271401 - ARNI; 271402 - BABHULGAON; 271403 - DARWHA; 271404 - DIGRAS; 271405 - GHATANJI; 271406 - KALAMB; 271407 - MAHAGAON; 271408 - MAREGAON; 271409 - NER; 271410 - PANDHARKAWADA; 271411 - PUSAD; 271412 - RALEGAON; 271413 - UMARKHED; 271414 - WANI; 271415 - YAVATMAL; 271416 - ZARI",
    "Name": "Raghunath R Wankhade",
    "District": "Amravati; Amravati - MC; Washim; Yavatmal",
    "Status": "Active",
    "Reporting manager": "amol.k@openlinksfoundation.org",
    "Dept": "Program Implementation PM",
    "Designation": "Program Manager",
    "State": "Maharashtra",
    "Location": "Washim"
  },
  {
    "id": "OLF-24-040",
    "Division": "Amravati",
    "District": "Amravati; Amravati - MC",
    "Designation": "Sr. Project Officer",
    "Dept": "Program Implementation",
    "Name": "Sagar G Gajbhiye",
    "Email": "sagargajbhiye1.olf@gmail.com",
    "Location": "Amravati",
    "State": "Maharashtra",
    "Mobile": "8668896822",
    "Reporting manager": "raghunath@openlinksfoundation.org",
    "Block": "270702 - AMRAVATI; 270704 - BHATKULI; 270708 - DARYAPUR; 270712 - NANDGAON KH; 270715 - AMRAVATI MNP"
  },
  {
    "id": "OLF-24-046",
    "Dept": "Program Implementation Div",
    "State": "Chhattisgarh",
    "Name": "Jeetendra Singh",
    "Location": "Raipur",
    "District": "Bastar; Dantewada; Dhamtari; Durg; Gariaband; Janjgir - Champa; Jashpur; Kabirdham; Raigarh; Raipur; Rajnandgaon; Sukma",
    "Reporting manager": "Vishvajit@openlinksfoundation.org",
    "Block": "220301-BAGICHA; 220304-DULDULA; 220305-FARSABAHAR; 220307-JASHPUR; 220308-KANSABEL; 220310-KUNKURI; 220312-MANORA; 220313-PATHALGAON; 220403- DHARAMJAIGARH; 220406- GHARGHODA; 220409- KHARSIA; 220411- LAILUNGA; 220414- PUSSORE; 220415- RAIGARH; 220417- TAMNAR; 220601-AKALTARA; 220602-BALODA; 220604-BAMHNINDIH; 220617-NAWAGARH; 220619-PAMGARH; 220801-BODLA; 220807-KAWARDHA; 220812-SAHASPUR LOHARA; 220813-PANDARIYA; 220904-CHURIA; 220905-DONGARGAON; 220906-DONGARGARH; 220911-RAJNANDGAON; 221006-DHAMDHA; 221007-DURG; 221011-PATAN; 221104-DHARSHIWA; 221106-ABHANPUR; 221108-TILDA; 221122-ARANG; 221303-KURUD; 221313-NAGRI; 221327-MAGARLOD; 221330-DHAMTARI; 221504-DARBHA; 221517-BASTAR; 221523-TOKAPAL; 221524-LOHANDIGUDA; 221529-BAKAWAND; 221530-BASTANAR; 221533-JAGDALPUR; 221608-GEEDAM; 221615-KATEKALYAN; 221619-KUAKONDA; 221622-DANTEWADA; 222102-SUKMA; 222134-KONTA; 222135-CHHINDGARH; 222505-CHHURA; 222514-DEOBHOG; 222519-GARIABAND; 222523-FINGESHWAR; 222526-MAINPUR",
    "Division": "Raipur",
    "Designation": "Division Manager",
    "Mobile": "9329961948",
    "Email": "jeetendra@openlinksfoundation.org"
  },
  {
    "id": "OLF-24-049",
    "Designation": "Sr. Project Officer",
    "Email": "rakeshm.olf@gmail.com",
    "Reporting manager": "raghunath@openlinksfoundation.org",
    "Mobile": "9049884369",
    "Location": "Yavatmal",
    "Block": "271402 - BABHULGAON; 271403 - DARWHA; 271405 - GHATANJI; 271406 - KALAMB; 271409 - NER; 271415 - YAVATMAL",
    "State": "Maharashtra",
    "Name": "Rakesh G Mahajan",
    "Dept": "Program Implementation",
    "Division": "Amravati",
    "District": "Yavatmal"
  },
  {
    "id": "OLF-24-050",
    "Name": "Somnath Sahu",
    "Dept": "Program Implementation PM",
    "State": "Chhattisgarh",
    "Block": "220301-BAGICHA; 220304-DULDULA; 220305-FARSABAHAR; 220307-JASHPUR; 220308-KANSABEL; 220310-KUNKURI; 220312-MANORA; 220313-PATHALGAON",
    "District": "Jashpur",
    "Designation": "Associate Program Manager",
    "Reporting manager": "azharuddin@openlinksfoundation.org",
    "Division": "Surguja",
    "Email": "somnath.olf@gmail.com",
    "Location": "Jashpur",
    "Mobile": "6264251168"
  },
  {
    "id": "OLF-24-052",
    "Mobile": "8600499883",
    "Dept": "Program Implementation",
    "Name": "Najir R Shaikh",
    "Email": "najirs.olf@gmail.com",
    "State": "Maharashtra",
    "Location": "Buldhana",
    "Reporting manager": "mohan@openlinksfoundation.org",
    "Division": "Amravati",
    "District": "Buldhana",
    "Designation": "Sr. Project Officer",
    "Block": "270403-KHAMGAON; 270405-MOTALA; 270407-MALAKAPUR; 270409-JALGAON JAMOD; 270410-NANDURA; 270411-SANGRAMPUR; 270412-SHEGAON"
  },
  {
    "id": "OLF-24-053",
    "Name": "Neelam Ahirwar",
    "Reporting manager": "abhijeet@openlinksfoundation.org",
    "District": "Balaghat",
    "Dept": "Program Implementation",
    "State": "Madhya Pradesh",
    "Division": "Jabalpur",
    "Block": "234501-BALAGHAT; 234502-KIRNAPUR; 234503-KATANGI; 234507-WARA SEONI",
    "Location": "Balaghat",
    "Status": "Active",
    "Email": "neelama.olf@gmail.com",
    "Designation": "Sr. Project Officer",
    "Mobile": "9685992415"
  },
  {
    "id": "OLF-24-054",
    "Designation": "Sr. Project Officer",
    "Block": "",
    "State": "Maharashtra",
    "Location": "Bhandara",
    "Email": "prachi.olf@gmail.com",
    "Mobile": "7083786494",
    "Dept": "Program Implementation",
    "District": "Bhandara",
    "Name": "Prachi R Tumsare",
    "Reporting manager": "vishal@openlinksfoundation.org",
    "Division": "Nagpur"
  },
  {
    "id": "OLF-24-057",
    "Block": "271301-CHANDRAPUR; 271302-BHADRAWATI; 271303-WARORA; 271304-BALLARPUR; 271305-RAJURA; 271306-GONDPIPARI; 271307-KORPANA; 271315-JIWATI",
    "Location": "Chandrapur",
    "Designation": "Associate Program Manager",
    "District": "Chandrapur; Wardha",
    "Division": "Nagpur",
    "State": "Maharashtra",
    "Email": "nitesh.olf@gmail.com",
    "Mobile": "9923456609",
    "Reporting manager": "vishal@openlinksfoundation.org",
    "Name": "Nitesh M Malekar",
    "Dept": "Program Implementation PM"
  },
  {
    "id": "OLF-24-061",
    "Email": "bhupendrakumar.olf@gmail.com",
    "District": "Janjgir - Champa",
    "Mobile": "9669495204",
    "Division": "Bilaspur",
    "Reporting manager": "azharuddin@openlinksfoundation.org",
    "Block": "",
    "Dept": "Program Implementation",
    "State": "Chhattisgarh",
    "Location": "Janjgir Champa",
    "Name": "Bhupendra Kumar",
    "Designation": "Sr. Project Officer"
  },
  {
    "id": "OLF-24-063",
    "Location": "Janjgir Champa",
    "Designation": "Sr. Program Manager",
    "State": "Chhattisgarh",
    "Name": "Azharuddin Sheikh",
    "District": "Jashpur; Sakti; Janjgir - Champa; Raigarh",
    "Block": "220403- DHARAMJAIGARH; 220406- GHARGHODA; 220409- KHARSIA; 220411- LAILUNGA; 220414- PUSSORE; 220415- RAIGARH; 220417- TAMNAR; 220601-AKALTARA; 220602-BALODA; 220604-BAMHNINDIH; 220617-NAWAGARH; 220619-PAMGARH; 221504-DARBHA; 221517-BASTAR; 221523-TOKAPAL; 221524-LOHANDIGUDA; 221529-BAKAWAND; 221530-BASTANAR; 221533-JAGDALPUR; 221608-GEEDAM; 221615-KATEKALYAN; 221619-KUAKONDA; 221622-DANTEWADA",
    "Status": "Active",
    "Division": "Bilaspur",
    "Dept": "Program Implementation PM",
    "Reporting manager": "jeetendra@openlinksfoundation.org",
    "Email": "azharuddin@openlinksfoundation.org",
    "Mobile": "9111777200"
  },
  {
    "id": "OLF-24-070",
    "Dept": "Program Implementation PM",
    "State": "Chhattisgarh",
    "Name": "Shubham Patel",
    "Designation": "Sr. Project Officer",
    "Block": "221303-KURUD; 221313-NAGRI; 221327-MAGARLOD; 221330-DHAMTARI; 222505-CHHURA; 222514-DEOBHOG; 222519-GARIABAND; 222523-FINGESHWAR; 222526-MAINPUR",
    "Reporting manager": "jeetendra@openlinksfoundation.org",
    "District": "Dhamtari; Gariaband",
    "Division": "Raipur",
    "Location": "Gariaband",
    "Email": "shubhampatel.olf@gmail.com",
    "Mobile": "7999788310"
  },
  {
    "id": "OLF-24-074",
    "Block": "272801-LATUR; 272802-RENAPUR; 272803-AUSA; 272804-NILANGA; 272805-SHIRUR ANANTPAL; 272806-DEVANI; 272807-UDGIR; 272808-JALKOT; 272809-AHAMADPUR; 272810-CHAKUR; 272901-BHOOM; 272902-KALLAMB; 272903-LOHARA; 272904-OMERGA; 272905-OSMANABAD; 272906-PARANDA; 272907-TULJAPUR; 272908-WASHI",
    "State": "Maharashtra",
    "Mobile": "9657376071",
    "Location": "Dharashiv",
    "Email": "somnathswami.olf@gmail.com",
    "District": "Dharashiv; Latur",
    "Division": "Chhatrapati Sambhajinagar",
    "Dept": "Program Implementation PM",
    "Designation": "Associate Program Manager",
    "Name": "Somnath R Swami",
    "Reporting manager": "manoj@openlinksfoundation.org"
  },
  {
    "id": "OLF-25-081",
    "Division": "Bilaspur",
    "District": "Raigarh",
    "Reporting manager": "azharuddin@openlinksfoundation.org",
    "Name": "Payal Sinha",
    "Designation": "Sr. Project Officer",
    "Email": "payalsinha.olf@gmail.com",
    "Dept": "Program Implementation",
    "Location": "Raigarh",
    "State": "Chhattisgarh",
    "Mobile": "8319811527",
    "Block": "220409- KHARSIA; 220414- PUSSORE; 220415- RAIGARH; 220417- TAMNAR"
  },
  {
    "id": "OLF-25-088",
    "Block": "102001- MANSOORCHAK; 102002- BACHHWARA; 102003- CHERIYA BARIYARPUR; 102004- KHODAWANDPUR; 102005- SAHEBPUR KAMAL; 102006- MATIHANI; 102007- BIRPUR; 102008- BARAUNI; 102010- BEGUSARAI; 102011- BAKHRI; 102012- TEGHRA; 102013- DANDARI; 102014- SHAMHO AKHA KURHA; 102015- CHHAURAHI; 102016- BALIA; 102017- NAOKOTHI; 102018- BHAGWANPUR; 102019- GARHPURA; 272501-AMBEGAON; 272502-BARAMATI; 272503-BHOR; 272504-DAUND; 272505-HAVELI; 272506-INDAPUR; 272507-JUNNAR; 272508-KHED; 272509-MAVAL; 272510-MULSHI; 272511-PURANDAR; 272512-SHIRUR; 272513-VELHE; 272514-Aundh; 272515-Yerawada; 272516-Bibwewadi; 272517-Hadpasar; 272518-Pune City; 272519-PIMPRI; 272520-AKURDI; 272801-LATUR; 272802-RENAPUR; 272803-AUSA; 272804-NILANGA; 272805-SHIRUR ANANTPAL; 272806-DEVANI; 272807-UDGIR; 272808-JALKOT; 272809-AHAMADPUR; 272810-CHAKUR; 272901-BHOOM; 272902-KALLAMB; 272903-LOHARA; 272904-OMERGA; 272905-OSMANABAD; 272906-PARANDA; 272907-TULJAPUR; 272908-WASHI; 273001-AKKALKOT; 273002-BARSHI; 273003-KARMALA; 273004-MADHA; 273005-MALSHIRAS; 273006-MANGALWEDHA; 273007-MOHOL; 273008-PANDHARPUR; 273009-SANGOLA; 273010-SOLAPUR NORTH; 273011-SOLAPUR SOUTH; 273101-JAOLI; 273102-KARAD; 273103-KOREGAON; 273104-KHATAV; 273105-KHANDALA; 273106-MAHABALESHWAR; 273107-MAN; 273108-PATAN; 273109-PHALTAN; 273110-SATARA; 273111-WAI; 273401-SHAHUWADI; 273402-PANHALA; 273403-HATKALANGLE; 273404-SHIROL; 273405-KARVEER; 273406-GAGANBAWADA; 273407-RADHANAGARI; 273408-KAGAL; 273409-BHUDARGAD; 273410-AAJARA; 273411-GADHINGLAJ; 273412-CHANDGAD; 273510-SANGLIMNC",
    "Location": "Pune",
    "District": "Begusarai; Dharashiv; Kolhapur; Latur; Pimpri Chinchwad - MC; Pune; Pune - MC; Sangli - MC; Satara; Solapur",
    "Mobile": "9767954100",
    "Division": "Pune",
    "State": "Maharashtra",
    "Email": "manoj@openlinksfoundation.org",
    "Dept": "Program Implementation Div",
    "Name": "Manoj C Girase",
    "Designation": "Associate Division Manager",
    "Reporting manager": "Vishvajit@openlinksfoundation.org"
  },
  {
    "id": "OLF-25-091",
    "Division": "Pune",
    "Dept": "Program Implementation",
    "District": "Solapur",
    "Name": "Vasim N Shaikh",
    "Mobile": "7038879639",
    "Email": "vasim.olf@gmail.com",
    "Designation": "Project Officer",
    "Location": "Solapur",
    "State": "Maharashtra",
    "Reporting manager": "rahul@openlinksfoundation.org",
    "Block": "273001-AKKALKOT; 273006-MANGALWEDHA; 273007-MOHOL; 273009-SANGOLA; 273010-SOLAPUR NORTH; 273011-SOLAPUR SOUTH"
  },
  {
    "id": "OLF-25-095",
    "Dept": "Program Implementation",
    "Name": "Hemant Kumar Chandra",
    "State": "Chhattisgarh",
    "Reporting manager": "amit.k@openlinksfoundation.org",
    "Block": "221517-BASTAR; 221524-LOHANDIGUDA; 221529-BAKAWAND; 221530-BASTANAR; 221533-JAGDALPUR; 221523-TOKAPAL; 221504-DARBHA",
    "Mobile": "9685726693",
    "Division": "Bastar",
    "District": "Bastar",
    "Email": "hemantchandra.olf@gmail.com",
    "Location": "Sukma",
    "Designation": "Project Officer"
  },
  {
    "id": "OLF-25-097",
    "Location": "Durg",
    "Email": "sonumali.olf@gmail.com",
    "Designation": "Project Officer",
    "Division": "Durg",
    "District": "Durg",
    "Reporting manager": "tusharsahu@openlinksfoundation.org",
    "Dept": "Program Implementation",
    "Mobile": "9929718531",
    "Block": "221007-DURG; 221011-PATAN",
    "Name": "Sonu Mali",
    "State": "Chhattisgarh"
  },
  {
    "id": "OLF-25-102",
    "Location": "Dhamtari",
    "Email": "harni.olf@gmail.com",
    "Designation": "Project Officer",
    "District": "Dhamtari",
    "Division": "Raipur",
    "Reporting manager": "tusharsahu@openlinksfoundation.org",
    "Mobile": "7049096438",
    "Block": "221303-KURUD; 221330-DHAMTARI",
    "State": "Chhattisgarh",
    "Name": "Harni Sinha",
    "Dept": "Program Implementation"
  },
  {
    "id": "OLF-25-103",
    "Dept": "Program Implementation",
    "Reporting manager": "mohan@openlinksfoundation.org",
    "Name": "Hitesh B Bhalerao",
    "Email": "hiteshbhalerao.olf@gmail.com",
    "Designation": "Project Officer",
    "State": "Maharashtra",
    "District": "Jalgaon",
    "Mobile": "7972250030",
    "Division": "Nashik",
    "Location": "Jalgaon",
    "Block": "270301-AMALNER; 270302-BHADGAON; 270308-ERANDOL; 270309-JALGAON; 270310-JAMNER; 270312-PACHORA; 270313-PAROLA; 270315-YAWAL; JALGAON M. CORP."
  },
  {
    "id": "OLF-25-105",
    "Mobile": "9669402944",
    "Email": "narendrasahu.olf@gmail.com",
    "Block": "220904-CHURIA; 220911-RAJNANDGAON",
    "Designation": "Project Officer",
    "Reporting manager": "tusharsahu@openlinksfoundation.org",
    "Location": "Rajnandgaon",
    "Name": "Narendra Sahu",
    "Division": "Durg",
    "District": "Rajnandgaon",
    "State": "Chhattisgarh",
    "Dept": "Program Implementation"
  },
  {
    "id": "OLF-25-109",
    "Email": "aashish.olf@gmail.com",
    "Mobile": "9589346781",
    "Location": "Raipur",
    "Division": "Raipur",
    "District": "Raipur",
    "Designation": "Project Officer",
    "Block": "221104-DHARSHIWA; 221108-TILDA",
    "Name": "Aashish Nirmalkar",
    "Dept": "Program Implementation",
    "Reporting manager": "tusharsahu@openlinksfoundation.org",
    "State": "Chhattisgarh"
  },
  {
    "id": "OLF-25-112",
    "Email": "ariyak.olf@gmail.com",
    "District": "Begusarai",
    "Mobile": "7004518924",
    "Division": "Munger",
    "Block": "102002- BACHHWARA; 102004- KHODAWANDPUR; 102005- SAHEBPUR KAMAL; 102007- BIRPUR; 102011- BAKHRI",
    "Designation": "Project Officer",
    "State": "Bihar",
    "Name": "Ariya Kumari",
    "Location": "Begusarai",
    "Dept": "Program Implementation",
    "Reporting manager": "manoj@openlinksfoundation.org"
  },
  {
    "id": "OLF-25-121",
    "Designation": "Sr. Project Officer",
    "Mobile": "9199225123",
    "Email": "paramjeet.olf@gmail.com",
    "Reporting manager": "manoj@openlinksfoundation.org",
    "Dept": "Program Implementation",
    "Division": "Munger",
    "Block": "102010- BEGUSARAI; 102012- TEGHRA; 102014- SHAMHO AKHA KURHA",
    "District": "Begusarai",
    "Name": "Paramjeet Kumar",
    "State": "Bihar",
    "Location": "Begusarai"
  },
  {
    "id": "OLF-25-128",
    "Block": "272702-ASHTI; 272703-BEED; 272705-GEORAI; 272709-PATODA; 272710-SHIRUR; 272711-WADWANI; 272712-URC BEED",
    "State": "Maharashtra",
    "Mobile": "9665219715",
    "District": "Bid",
    "Division": "Chhatrapati Sambhajinagar",
    "Email": "sagargaikwad.olf@gmail.com",
    "Location": "Beed",
    "Dept": "Program Implementation",
    "Reporting manager": "amol.r@openlinksfoundation.org",
    "Name": "Sagar T Gaikwad",
    "Designation": "Project Officer"
  },
  {
    "id": "OLF-25-131",
    "Email": "mohan@openlinksfoundation.org",
    "Mobile": "7057616459",
    "Division": "Amravati",
    "District": "Buldhana",
    "Location": "Buldhana",
    "Reporting manager": "amol.k@openlinksfoundation.org",
    "Dept": "Program Implementation PM",
    "Status": "Active",
    "Block": "270401-BULDANA; 270402-CHIKHALI; 270403-KHAMGAON; 270404-DEULGAON RAJA; 270405-MOTALA; 270406-LOANR; 270407-MALAKAPUR; 270408-MEHAKAR; 270409-JALGAON JAMOD; 270410-NANDURA; 270411-SANGRAMPUR; 270412-SHEGAON; 270413-SINDKHED RAJA",
    "Designation": "Program Manager",
    "Name": "Mohan G Suralkar",
    "State": "Maharashtra"
  },
  {
    "id": "OLF-25-132",
    "Location": "Nashik",
    "Reporting manager": "pruthviraj@openlinksfoundation.org",
    "Dept": "Program Implementation",
    "Name": "Rakesh D Mahajan",
    "Division": "Nashik",
    "Designation": "Project Officer",
    "Email": "rakeshdm.olf@gmail.com",
    "District": "Nashik",
    "State": "Maharashtra",
    "Mobile": "9860607739",
    "Block": "272005-IGATPURI; 272008-NANDGAON; 272009-NASHIK; 272010-NIPHAD; 272012-SINNER; 272015-YEOLA; 272016-NASHIK URC-1"
  },
  {
    "id": "OLF-25-134",
    "Name": "Sangharakshit V Thaware",
    "Dept": "Program Implementation",
    "State": "Maharashtra",
    "Block": "271601 - HINGOLI; 271602 - SENGAON; 271603 - BASMATH; 271604 - KALAMNURI; 271605 - AUNDHA NAGNATH",
    "Reporting manager": "ajay@openlinksfoundation.org",
    "Status": "Active",
    "Location": "Hingoli",
    "Designation": "Project Officer",
    "Division": "Chhatrapati Sambhajinagar",
    "Email": "sangharakshit.olf@gmail.com",
    "District": "Hingoli",
    "Mobile": "7773943493"
  },
  {
    "id": "OLF-25-136",
    "State": "Maharashtra",
    "Reporting manager": "Vishvajit@openlinksfoundation.org",
    "Dept": "Program Implementation Div",
    "Mobile": "8689945394",
    "Name": "Shrikant S Sawant",
    "Block": "270101 - NANDURBAR; 270102 - NAVAPUR; 270103 - SHAHADA; 270104 - TALODA; 270105 - AKKALKUWA; 270106 - DHADGAON; 270301-AMALNER; 270302-BHADGAON; 270303-BHUSAWAL; 270304-BODWAD; 270305-CHALISGAON; 270306-CHOPDA; 270307-DHARANGAON; 270308-ERANDOL; 270309-JALGAON; 270310-JAMNER; 270311-MUKTAINAGAR; 270312-PACHORA; 270313-PAROLA; 270314-RAWER; 270315-YAWAL; 272001-BAGLAN; 272002-CHANDWAD; 272003-DEVLA; 272004-DINDORI; 272005-IGATPURI; 272006-KALWAN; 272007-MALEGAON; 272008-NANDGAON; 272009-NASHIK; 272010-NIPHAD; 272011-PEINT; 272012-SINNER; 272013-SURGANA; 272014-TRIMBAK; 272015-YEOLA; 272016-NASHIK URC-1; 272016-URC 1; 272018-URC 2; 272106-KALYAN DOMBIVLI-URC1; 272201-URC-1 BORIVALI; 272202-URC-2 KANDIVALI; 272203-URC-3 GOREGAON; 272204-URC-4 ANDHERI; 272205-URC-5 SANTACRUZ; 272206-URC-6 BHANDUP; 272207-URC-7 GHATKOPAR; 272208-URC-8 CHEMBUR; 272209-URC-9 KURLA; 272210-URC-10 PAREL; 272211-URC-11 DADAR; 272212-URC-12 BYCULLA; 272401 - ALIBAG; 272402 - KARJAT; 272403 - KHALAPUR; 272404 - MAHAD; 272405 - MANGAON; 272406 - MHASALA; 272407 - MURUD; 272408 - PANVEL; 272409 - PEN; 272410 - POLADPUR; 272411 - ROHA; 272412 - SUDHAGAD; 272413 - SHRIVARDHAN; 272414 - TALA; 272415 - URAN; 272601-AKOLE; 272602-JAMKHED; 272603-KOPARGAON; 272604-KARJAT; 272605-NAGAR; 272606-NEWASA; 272607-PARNER; 272608-PATHARDI; 272609-RAHURI; 272610-RAHATA; 272611-SHEVGAON; 272612-SANGAMNER; 272613-SHRIGONDA; 272614-SHRIRAMPOOR; 272615-MC AHMEDNAGAR; 273201-CHIPLUN; 273202-DAPOLI; 273203-GUHAGAR; 273204-KHED; 273205-LANJA; 273206-MANDANGAD; 273207-RAJAPUR; 273208-RATNAGIRI; 273209-SANGMESHWAR; 273603 - DAHANU; 273604-JAWAHAR; 273608 - MOKHADA; 273611 - PALGHAR; 273613 - TALASARI; 273617 - VASAI; 273618 - VIKRAMGAD; 273619 - WADA; Ambernath; Bhiwandi; JALGAON M. CORP.; Kalyan; Murbad; Shahapur",
    "Designation": "Division Manager",
    "Location": "MH",
    "District": "Ahilyanagar; Jalgaon; Mumbai Suburban; Nandurbar; Nashik; Nashik - MC; Palghar; Raigarh MH; Ratnagiri; Thane - KDMC; Thane-ZP",
    "Division": "",
    "Status": "Active",
    "Email": "shrikant@openlinksfoundation.org"
  },
  {
    "id": "OLF-25-139",
    "Division": "Pune",
    "Mobile": "6360179874",
    "District": "Solapur",
    "Email": "aapparao.olf@gmail.com",
    "Location": "Solapur",
    "Reporting manager": "rahul@openlinksfoundation.org",
    "Block": "273002-BARSHI; 273003-KARMALA; 273004-MADHA; 273005-MALSHIRAS; 273008-PANDHARPUR",
    "State": "Maharashtra",
    "Dept": "Program Implementation",
    "Name": "Aapparao S Rajle",
    "Designation": "Project Officer"
  },
  {
    "id": "OLF-25-140",
    "Name": "Dhammdeep S Bhadarge",
    "Dept": "Program Implementation",
    "State": "Maharashtra",
    "Block": "",
    "Mobile": "8788163573",
    "Location": "Nanded",
    "District": "Nanded",
    "Email": "dhammdeep.olf@gmail.com",
    "Division": "Chhatrapati Sambhajinagar",
    "Reporting manager": "ajay@openlinksfoundation.org",
    "Designation": "Project Officer"
  },
  {
    "id": "OLF-25-144",
    "Dept": "Program Implementation",
    "Reporting manager": "bharat@openlinksfoundation.org",
    "State": "Chhattisgarh",
    "District": "Raipur",
    "Name": "Moin R Khan",
    "Division": "Raipur",
    "Location": "Raipur",
    "Block": "",
    "Designation": "Project Officer",
    "Email": "moin@openlinksfoundation.org",
    "Mobile": "9300799926"
  },
  {
    "id": "OLF-25-146",
    "Location": "Wardha",
    "State": "Maharashtra",
    "Name": "Akash P Kulkarni",
    "Block": "270802 - ASHTI; 270805 - KARANJA; 270806 - SAMUDRAPUR; 270807 - SELOO",
    "Status": "Active",
    "District": "Wardha",
    "Dept": "Program Implementation",
    "Division": "Nagpur",
    "Designation": "Project Officer",
    "Reporting manager": "nitesh.olf@gmail.com",
    "Email": "akashkulkarni.olf@gmail.com",
    "Mobile": "8830214274"
  },
  {
    "id": "OLF-25-148",
    "Division": "Durg",
    "Email": "tusharsahu@openlinksfoundation.org",
    "District": "Durg; Kabirdham; Raipur; Rajnandgaon",
    "Location": "Rajnandgaon",
    "Reporting manager": "jeetendra@openlinksfoundation.org",
    "Mobile": "8269493773",
    "Block": "220801-BODLA; 220807-KAWARDHA; 220812-SAHASPUR LOHARA; 220813-PANDARIYA; 220904-CHURIA; 220905-DONGARGAON; 220906-DONGARGARH; 220911-RAJNANDGAON; 221006-DHAMDHA; 221007-DURG; 221011-PATAN; 221104-DHARSHIWA; 221106-ABHANPUR; 221108-TILDA; 221122-ARANG",
    "State": "Chhattisgarh",
    "Dept": "Program Implementation PM",
    "Designation": "Program Manager",
    "Name": "Tushar Sahu"
  },
  {
    "id": "OLF-25-150",
    "Email": "merajshaikh.olf@gmail.com",
    "Designation": "Project Officer",
    "Mobile": "8329637393",
    "Division": "Nagpur",
    "Block": "270904-SAONER; 270906-RAMTEK; 270907-MOUDA; 270908-PARSEONI; 270901-NARKHED; 270912-KUHI",
    "District": "Nagpur",
    "Name": "Meraj R Shaikh",
    "Reporting manager": "vishal@openlinksfoundation.org",
    "State": "Maharashtra",
    "Location": "Nagpur",
    "Dept": "Program Implementation"
  },
  {
    "id": "OLF-25-154",
    "Reporting manager": "rahulp@openlinksfoundation.org",
    "Dept": "Program Implementation",
    "Email": "vaibhavi@openlinksfoundation.org",
    "Designation": "Communications Manager",
    "Name": "Vaibhavi Ratish Kumar",
    "Mobile": "9930549856",
    "State": "Maharashtra",
    "Location": "Pune HO"
  },
  {
    "id": "OLF-25-155",
    "Mobile": "9004041944",
    "Designation": "Project Officer",
    "Email": "vaibhavyerekar.olf@gmail.com",
    "Reporting manager": "ajay@openlinksfoundation.org",
    "Block": "271501 - NANDED; 271502 - ARDHAPUR; 271503 - MUDKHED; 271511 - BHOKAR; 271513 - HADGAON; 271514 - HIMAYAT NAGAR; 271515 - KINWAT; 271516 - MAHOOR",
    "Location": "Nanded",
    "State": "Maharashtra",
    "Dept": "Program Implementation",
    "Division": "Chhatrapati Sambhajinagar",
    "District": "Nanded",
    "Name": "Vaibhav S Yerekar"
  },
  {
    "id": "OLF-25-156",
    "Dept": "Program Implementation",
    "Name": "Vikas B More",
    "Mobile": "9764095109",
    "Reporting manager": "shrikant@openlinksfoundation.org",
    "Email": "vikasmore.olf@gmail.com",
    "State": "Maharashtra",
    "Location": "Nandurbar",
    "Division": "Nashik",
    "District": "Nandurbar",
    "Block": "270103 - SHAHADA; 270104 - TALODA; 270106 - DHADGAON",
    "Designation": "Project Officer"
  },
  {
    "id": "OLF-26-162",
    "District": "Sangli - MC",
    "Division": "Pune",
    "Email": "mohin.olf@gmail.com",
    "Reporting manager": "manoj@openlinksfoundation.org",
    "Location": "Sangli",
    "Mobile": "8459285797",
    "Block": "273510-SANGLIMNC",
    "Designation": "Project Officer",
    "State": "Maharashtra",
    "Name": "Mohin Jamadar",
    "Dept": "Program Implementation"
  },
  {
    "id": "OLF-26-167",
    "District": "Bid; Jalna",
    "Block": "271801 - JALNA; 271802 - BADNAPUR; 271803 - AMBAD; 271804 - GHANSAWANGI; 271805 - PARTUR; 271806 - MANTHA; 271807 - BHOKARDAN; 271808 - JAFRABAD; 272701-AMBAJOGAI; 272702-ASHTI; 272703-BEED; 272704-DHARUR; 272705-GEORAI; 272706-KAIJ; 272707-MAJALGAON; 272708-PARLI; 272709-PATODA; 272710-SHIRUR; 272711-WADWANI; 272712-URC BEED",
    "Division": "Chhatrapati Sambhajinagar",
    "Designation": "Program Manager",
    "Reporting manager": "Vishvajit@openlinksfoundation.org",
    "Status": "Active",
    "Location": "Beed",
    "State": "Maharashtra",
    "Dept": "Program Implementation PM",
    "Email": "amol.r@openlinksfoundation.org",
    "Name": "Amol S Rathod",
    "Mobile": "9604863031"
  },
  {
    "id": "OLF-26-168",
    "Dept": "Program Implementation",
    "Name": "Ganesh S Singare",
    "Division": "Nashik",
    "Designation": "Project Officer",
    "District": "Ahilyanagar",
    "Email": "ganeshsingare.olf@gmail.com",
    "Location": "Ahilyanagar",
    "State": "Maharashtra",
    "Mobile": "9730243447",
    "Reporting manager": "amol.r@openlinksfoundation.org",
    "Block": "272601-AKOLE; 272603-KOPARGAON; 272605-NAGAR; 272607-PARNER; 272610-RAHATA; 272612-SANGAMNER; 272613-SHRIGONDA; 272615-MC AHMEDNAGAR"
  },
  {
    "id": "OLF-26-171",
    "Name": "Rahul Are",
    "Dept": "Program Implementation PM",
    "State": "Maharashtra",
    "Location": "Pune",
    "Division": "Pune",
    "Reporting manager": "manoj@openlinksfoundation.org",
    "Block": "272501-AMBEGAON; 272502-BARAMATI; 272503-BHOR; 272504-DAUND; 272505-HAVELI; 272506-INDAPUR; 272507-JUNNAR; 272508-KHED; 272509-MAVAL; 272510-MULSHI; 272511-PURANDAR; 272512-SHIRUR; 272513-VELHE; 272514-Aundh; 272515-Yerawada; 272516-Bibwewadi; 272517-Hadpasar; 272518-Pune City; 272519-PIMPRI; 272520-AKURDI; 273001-AKKALKOT; 273002-BARSHI; 273003-KARMALA; 273004-MADHA; 273005-MALSHIRAS; 273006-MANGALWEDHA; 273007-MOHOL; 273008-PANDHARPUR; 273009-SANGOLA; 273010-SOLAPUR NORTH; 273011-SOLAPUR SOUTH",
    "District": "Pimpri Chinchwad - MC; Pune; Pune - MC; Solapur",
    "Designation": "Program Manager",
    "Email": "rahul@openlinksfoundation.org",
    "Mobile": "9665577704"
  },
  {
    "id": "OLF-26-174",
    "Designation": "Project Officer",
    "Email": "mayurtembe.olf@gmail.com",
    "Dept": "Program Implementation",
    "Reporting manager": "shrikant@openlinksfoundation.org",
    "Block": "272401 - ALIBAG; 272402 - KARJAT; 272403 - KHALAPUR; 272404 - MAHAD; 272405 - MANGAON; 272406 - MHASALA; 272407 - MURUD; 272408 - PANVEL; 272409 - PEN; 272410 - POLADPUR; 272411 - ROHA; 272412 - SUDHAGAD; 272413 - SHRIVARDHAN; 272414 - TALA; 272415 - URAN",
    "Mobile": "8600673043",
    "Location": "Raigad",
    "Name": "Mayur M Tembe",
    "Division": "Konkan",
    "State": "Maharashtra",
    "District": "Raigarh MH"
  },
  {
    "id": "OLF-26-175",
    "Designation": "Project Officer",
    "Mobile": "7559285799",
    "Name": "Prashant S Chitte",
    "Reporting manager": "pruthviraj@openlinksfoundation.org",
    "Email": "prashantchitte.olf@gmail.com",
    "Dept": "Program Implementation",
    "State": "Maharashtra",
    "Location": "Ahilyanagar",
    "Division": "Nashik",
    "District": "Ahilyanagar",
    "Block": "272602-JAMKHED; 272604-KARJAT; 272606-NEWASA; 272608-PATHARDI; 272609-RAHURI; 272611-SHEVGAON; 272614-SHRIRAMPOOR"
  },
  {
    "id": "OLF-26-176",
    "Email": "pruthviraj@openlinksfoundation.org",
    "Mobile": "7350435512",
    "Reporting manager": "shrikant@openlinksfoundation.org",
    "Dept": "Program Implementation PM",
    "Block": "270101 - NANDURBAR; 270102 - NAVAPUR; 270103 - SHAHADA; 270104 - TALODA; 270105 - AKKALKUWA; 270106 - DHADGAON; 270301-AMALNER; 270302-BHADGAON; 270303-BHUSAWAL; 270304-BODWAD; 270305-CHALISGAON; 270306-CHOPDA; 270307-DHARANGAON; 270308-ERANDOL; 270309-JALGAON; 270310-JAMNER; 270311-MUKTAINAGAR; 270312-PACHORA; 270313-PAROLA; 270314-RAWER; 270315-YAWAL; 272001-BAGLAN; 272002-CHANDWAD; 272003-DEVLA; 272004-DINDORI; 272005-IGATPURI; 272006-KALWAN; 272007-MALEGAON; 272008-NANDGAON; 272009-NASHIK; 272010-NIPHAD; 272011-PEINT; 272012-SINNER; 272013-SURGANA; 272014-TRIMBAK; 272015-YEOLA; 272016-NASHIK URC-1; 272016-URC 1; 272018-URC 2; 272601-AKOLE; 272602-JAMKHED; 272603-KOPARGAON; 272604-KARJAT; 272605-NAGAR; 272606-NEWASA; 272607-PARNER; 272608-PATHARDI; 272609-RAHURI; 272610-RAHATA; 272611-SHEVGAON; 272612-SANGAMNER; 272613-SHRIGONDA; 272614-SHRIRAMPOOR; 272615-MC AHMEDNAGAR; JALGAON M. CORP.",
    "Name": "Pruthviraj A Chavhan",
    "Location": "Nashik",
    "Division": "Nashik",
    "Designation": "Program Manager",
    "District": "Ahilyanagar; Jalgaon; Nandurbar; Nashik; Nashik - MC",
    "State": "Maharashtra"
  },
  {
    "id": "OLF-26-177",
    "Email": "manik@openlinksfoundation.org",
    "Location": "Thane",
    "Division": "Konkan",
    "District": "Mumbai Suburban; Palghar; Raigarh MH; Ratnagiri; Thane - KDMC; Thane-ZP",
    "Name": "Manik D Gaikwad",
    "Block": "272106-KALYAN DOMBIVLI-URC1; 272201-URC-1 BORIVALI; 272202-URC-2 KANDIVALI; 272203-URC-3 GOREGAON; 272204-URC-4 ANDHERI; 272205-URC-5 SANTACRUZ; 272206-URC-6 BHANDUP; 272207-URC-7 GHATKOPAR; 272208-URC-8 CHEMBUR; 272209-URC-9 KURLA; 272210-URC-10 PAREL; 272211-URC-11 DADAR; 272212-URC-12 BYCULLA; 272401 - ALIBAG; 272402 - KARJAT; 272403 - KHALAPUR; 272404 - MAHAD; 272405 - MANGAON; 272406 - MHASALA; 272407 - MURUD; 272408 - PANVEL; 272409 - PEN; 272410 - POLADPUR; 272411 - ROHA; 272412 - SUDHAGAD; 272413 - SHRIVARDHAN; 272414 - TALA; 272415 - URAN; 273201-CHIPLUN; 273202-DAPOLI; 273203-GUHAGAR; 273204-KHED; 273205-LANJA; 273206-MANDANGAD; 273207-RAJAPUR; 273208-RATNAGIRI; 273209-SANGMESHWAR; 273603 - DAHANU; 273604-JAWAHAR; 273608 - MOKHADA; 273611 - PALGHAR; 273613 - TALASARI; 273617 - VASAI; 273618 - VIKRAMGAD; 273619 - WADA; Ambernath; Bhiwandi; Kalyan; Murbad; Shahapur",
    "Mobile": "8793586895",
    "Dept": "Program Implementation PM",
    "Designation": "Program Manager",
    "Reporting manager": "shrikant@openlinksfoundation.org",
    "State": "Maharashtra"
  },
  {
    "id": "OLF-26-179",
    "Mobile": "9021120887",
    "Designation": "Project Officer",
    "Reporting manager": "vishal@openlinksfoundation.org",
    "Location": "Bhandara",
    "Email": "laxmikant.olf@gmail.com",
    "Division": "Nagpur",
    "District": "Bhandara",
    "Block": "271001-BHANDARA; 271002-MOHADI; 271003-TUMSAR; 271004-SAKOLI; 271005-LAKHANI; 271006-LAKHANDUR; 271007-PAUNI",
    "Dept": "Program Implementation",
    "State": "Maharashtra",
    "Name": "Laxmikant M Kodane"
  },
  {
    "id": "OLF-26-180",
    "Mobile": "9834500648",
    "Email": "sandip.olf@gmail.com",
    "District": "Jalna",
    "Block": "271801 - JALNA; 271802 - BADNAPUR; 271803 - AMBAD; 271804 - GHANSAWANGI; 271805 - PARTUR; 271806 - MANTHA; 271807 - BHOKARDAN; 271808 - JAFRABAD",
    "Division": "Chhatrapati Sambhajinagar",
    "Location": "Jalna",
    "Reporting manager": "amol.r@openlinksfoundation.org",
    "State": "Maharashtra",
    "Designation": "Sr. Project Officer",
    "Name": "Sandip M Sabale",
    "Dept": "Program Implementation"
  },
  {
    "id": "OLF-26-181",
    "Location": "Hingoli",
    "Dept": "Program Implementation PM",
    "Name": "Ajay U Ingale",
    "Status": "Active",
    "Email": "ajay@openlinksfoundation.org",
    "Reporting manager": "Vishvajit@openlinksfoundation.org",
    "Division": "Chhatrapati Sambhajinagar",
    "District": "Hingoli; Nanded",
    "State": "Maharashtra",
    "Mobile": "8459218288",
    "Block": "271501 - NANDED; 271502 - ARDHAPUR; 271503 - MUDKHED; 271504 - LOHA; 271505 - KANDHAR; 271506 - MUKHED; 271507 - DEGLOOR; 271508 - BILOLI; 271509 - NAIGAON; 271510 - DHARMABAD; 271511 - BHOKAR; 271512 - UMRI; 271513 - HADGAON; 271514 - HIMAYAT NAGAR; 271515 - KINWAT; 271516 - MAHOOR; 271517 - NANDED M.C.; 271601 - HINGOLI; 271602 - SENGAON; 271603 - BASMATH; 271604 - KALAMNURI; 271605 - AUNDHA NAGNATH",
    "Designation": "Program Manager"
  },
  {
    "id": "OLF-26-184",
    "Designation": "Project Officer",
    "Block": "272903-LOHARA; 272904-OMERGA; 272905-OSMANABAD; 272907-TULJAPUR",
    "State": "Maharashtra",
    "Mobile": "7768098834",
    "District": "Dharashiv",
    "Division": "Chhatrapati Sambhajinagar",
    "Email": "manojbiradar.olf@gmail.com",
    "Dept": "Program Implementation",
    "Location": "Dharashiv",
    "Reporting manager": "manoj@openlinksfoundation.org",
    "Name": "Manoj S Biradar"
  },
  {
    "id": "OLF-26-193",
    "Mobile": "8080016774",
    "Email": "balkrishna.olf@gmail.com",
    "Reporting manager": "manik@openlinksfoundation.org",
    "Division": "Konkan",
    "District": "Thane - KDMC",
    "Block": "272106-KALYAN DOMBIVLI-URC1",
    "Name": "Balkrishna V Panchal",
    "State": "Maharashtra",
    "Designation": "Project Officer",
    "Dept": "Program Implementation",
    "Location": "Thane"
  },
  {
    "id": "OLF-26-194",
    "District": "Buldhana",
    "Block": "270401-BULDANA; 270402-CHIKHALI; 270404-DEULGAON RAJA; 270406-LOANR; 270408-MEHAKAR; 270413-SINDKHED RAJA",
    "Division": "Amravati",
    "Location": "Buldhana",
    "State": "Maharashtra",
    "Designation": "Project Officer",
    "Email": "saurabhvarade.olf@gmail.com",
    "Reporting manager": "mohan@openlinksfoundation.org",
    "Mobile": "8850787503",
    "Name": "Saurabh A Varade",
    "Dept": "Program Implementation"
  },
  {
    "id": "OLF-26-197",
    "Block": "234504-KHAIRLANJI; 234505-PARASWADA; 234506-LAL BURRA; 234508-LANJI; 234509-BAIHAR; 234510-BIRSA",
    "Status": "Active",
    "State": "Madhya Pradesh",
    "Designation": "Project Officer",
    "District": "Balaghat",
    "Email": "bhupendradhuware.olf@gmail.com",
    "Division": "Jabalpur",
    "Location": "Balaghat",
    "Mobile": "9009741102",
    "Name": "Bhupendra Dhuware",
    "Reporting manager": "abhijeet@openlinksfoundation.org",
    "Dept": "Program Implementation"
  },
  {
    "id": "OLF-26-198",
    "Mobile": "7249831454",
    "Location": "Kolhapur",
    "Division": "Pune",
    "Name": "Tejas S Gaikwad",
    "District": "Kolhapur",
    "Dept": "Program Implementation",
    "Email": "tejas.olf@gmail.com",
    "Reporting manager": "manoj@openlinksfoundation.org",
    "State": "Maharashtra",
    "Block": "273401-SHAHUWADI; 273402-PANHALA; 273403-HATKALANGLE; 273404-SHIROL; 273405-KARVEER; 273406-GAGANBAWADA; 273407-RADHANAGARI; 273408-KAGAL; 273409-BHUDARGAD; 273410-AAJARA; 273411-GADHINGLAJ; 273412-CHANDGAD",
    "Designation": "Project Officer"
  },
  {
    "id": "OLF-26-202",
    "Location": "Yavatmal",
    "Dept": "Program Implementation",
    "Name": "Amardip B Wahule",
    "Division": "Amravati",
    "Email": "amardip.olf@gmail.com",
    "District": "Yavatmal",
    "State": "Maharashtra",
    "Reporting manager": "raghunath@openlinksfoundation.org",
    "Mobile": "9623376039",
    "Designation": "Project Officer (Maharashtra)",
    "Block": "271401 - ARNI; 271404 - DIGRAS; 271407 - MAHAGAON; 271411 - PUSAD; 271413 - UMARKHED"
  },
  {
    "id": "OLF-26-203",
    "Dept": "Program Implementation",
    "Location": "Dhule",
    "Mobile": "8600562352",
    "Name": "Sandesh S Pol",
    "Reporting manager": "shrikant@openlinksfoundation.org",
    "Division": "Nashik",
    "Email": "sandeshpol.olf@gmail.com",
    "State": "Maharashtra",
    "Designation": "Project Officer"
  },
  {
    "id": "OLF-26-204",
    "Reporting manager": "raghunath@openlinksfoundation.org",
    "Block": "270701 - ACHALPUR; 270703 - ANJANGAON SURJI; 270705 - CHANDUR BZ; 270706 - CHIKHALDARA; 270709 - DHARNI",
    "Mobile": "9131515783",
    "State": "Maharashtra",
    "Designation": "Project Officer",
    "Email": "abhishek.bansalolf@gmail.com",
    "Location": "Amravati",
    "District": "Amravati",
    "Division": "Amravati",
    "Name": "Abhishek Bansal",
    "Dept": "Program Implementation"
  },
  {
    "id": "OLF-26-206",
    "Block": "220301-BAGICHA; 220304-DULDULA; 220307-JASHPUR; 220312-MANORA",
    "District": "Jashpur",
    "Division": "Surguja",
    "Location": "Jashpur",
    "Status": "Active",
    "State": "Chhattisgarh",
    "Email": "biplab.olf@gmail.com",
    "Name": "Biplab Debsarma",
    "Dept": "Program Implementation",
    "Mobile": "9851707730",
    "Designation": "Project Officer",
    "Reporting manager": "somnath.olf@gmail.com"
  },
  {
    "id": "OLF-26-207",
    "Block": "270707 - CHANDUR RLY; 270710 - DHAMANGAON RLY; 270711 - MORSHI; 270713 - TIOSA; 270714 - WARUD",
    "Location": "Amravati",
    "District": "Amravati",
    "Division": "Amravati",
    "State": "Maharashtra",
    "Designation": "Project Officer",
    "Email": "deepakgayakwad.olf@gmail.com",
    "Reporting manager": "raghunath@openlinksfoundation.org",
    "Mobile": "6265738122",
    "Name": "Deepak Kumar",
    "Dept": "Program Implementation"
  },
  {
    "id": "OLF-26-208",
    "Email": "kanha.olf@gmail.com",
    "Designation": "Project Officer",
    "Block": "273604-JAWAHAR; 273608 - MOKHADA; 273611 - PALGHAR; 273618 - VIKRAMGAD",
    "Name": "Kanha Saini",
    "Mobile": "9636581315",
    "Location": "Palghar",
    "Dept": "Program Implementation",
    "Reporting manager": "manik@openlinksfoundation.org",
    "Division": "Konkan",
    "District": "Palghar",
    "State": "Maharashtra"
  },
  {
    "id": "OLF-26-209",
    "Name": "Kuldeep Kumar",
    "State": "Chhattisgarh",
    "Dept": "Program Implementation",
    "Block": "220601-AKALTARA; 220602-BALODA; 220604-BAMHNINDIH; 220617-NAWAGARH; 220619-PAMGARH",
    "Reporting manager": "jeetendra@openlinksfoundation.org",
    "Location": "Bastar",
    "Email": "kuldeepkumar.olf@gmail.com",
    "District": "Janjgir - Champa",
    "Division": "Bilaspur",
    "Mobile": "7518353196",
    "Designation": "Project Officer"
  },
  {
    "id": "OLF-26-210",
    "Dept": "Program Implementation",
    "State": "Chhattisgarh",
    "Name": "Kumari Priya",
    "Reporting manager": "bharat@openlinksfoundation.org",
    "Location": "Raipur",
    "Email": "kumari.priya.olf@gmail.com",
    "Designation": "Project Officer",
    "District": "Raipur",
    "Mobile": "6206386040",
    "Division": "Raipur"
  },
  {
    "id": "OLF-26-212",
    "Location": "Akola",
    "Name": "Sachin S Gawai",
    "Designation": "Project Officer",
    "State": "Maharashtra",
    "Dept": "Program Implementation",
    "District": "Akola",
    "Division": "Amravati",
    "Reporting manager": "mohan@openlinksfoundation.org",
    "Email": "sachingawai.olf@gmail.com",
    "Mobile": "9307801641"
  },
  {
    "id": "OLF-26-213",
    "Name": "Shalu N Bijewar",
    "Mobile": "8007572164",
    "Dept": "Program Implementation",
    "Reporting manager": "vishal@openlinksfoundation.org",
    "Email": "shalu.olf@gmail.com",
    "District": "Gondia",
    "Division": "Nagpur",
    "State": "Maharashtra",
    "Location": "Gondia",
    "Designation": "Project Officer"
  },
  {
    "id": "OLF-26-214",
    "Email": "shubhamkamble.olf@gmail.com",
    "Mobile": "9049661072",
    "Reporting manager": "manoj@openlinksfoundation.org",
    "Dept": "Program Implementation",
    "Block": "272801-LATUR; 272802-RENAPUR; 272803-AUSA; 272804-NILANGA; 272805-SHIRUR ANANTPAL",
    "Division": "Chhatrapati Sambhajinagar",
    "Name": "Shubham D Kamble",
    "District": "Latur",
    "Location": "Latur",
    "Designation": "Project Officer",
    "State": "Maharashtra"
  },
  {
    "id": "OLF-26-216",
    "Email": "tejpal.olf@gmail.com",
    "Designation": "Project Officer",
    "Reporting manager": "manik@openlinksfoundation.org",
    "Block": "273603 - DAHANU; 273613 - TALASARI; 273617 - VASAI; 273619 - WADA",
    "Name": "Tejpal Chopra",
    "Mobile": "9982009626",
    "Division": "Konkan",
    "Dept": "Program Implementation",
    "District": "Palghar",
    "Location": "Palghar",
    "State": "Maharashtra"
  },
  {
    "id": "OLF-26-217",
    "Dept": "Program Implementation",
    "State": "Maharashtra",
    "Name": "Vaibhav S Jadhav",
    "Block": "271408 - MAREGAON; 271410 - PANDHARKAWADA; 271412 - RALEGAON; 271414 - WANI; 271416 - ZARI",
    "Location": "Yavatmal",
    "Designation": "Project Officer",
    "Email": "vaibhavjadhav.olf@gmail.com",
    "Reporting manager": "raghunath@openlinksfoundation.org",
    "District": "Yavatmal",
    "Division": "Amravati",
    "Mobile": "9075380030"
  },
  {
    "id": "OLF-26-218",
    "Email": "yogmay.olf@gmail.com",
    "Designation": "Project Officer",
    "Dept": "Program Implementation",
    "Mobile": "8109815699",
    "Block": "222505-CHHURA; 222519-GARIABAND; 222523-FINGESHWAR",
    "Location": "Gariyaband",
    "Reporting manager": "shubhampatel.olf@gmail.com",
    "Name": "Yogmay Pradhan",
    "Division": "Raipur",
    "State": "Chhattisgarh",
    "District": "Gariaband"
  },
  {
    "id": "OLF-26-219",
    "Dept": "Program Implementation",
    "State": "Chhattisgarh",
    "Location": "Dhamtari",
    "Name": "Abhishek Kumar",
    "Designation": "Project Officer",
    "District": "Dhamtari",
    "Division": "Raipur",
    "Block": "221313-NAGRI; 221327-MAGARLOD",
    "Mobile": "6205852285",
    "Reporting manager": "tusharsahu@openlinksfoundation.org",
    "Email": "abhishek.kumar4olf@gmail.com"
  },
  {
    "id": "OLF-26-220",
    "Reporting manager": "jeetendra@openlinksfoundation.org",
    "Mobile": "6386516927",
    "Designation": "Project Officer",
    "Dept": "Program Implementation",
    "Name": "Abhishek Tripati",
    "Email": "abhishektripathi.olf@gmail.com",
    "State": "Chhattisgarh",
    "Location": "Dantewada",
    "Division": "Bastar",
    "District": "Dantewada",
    "Block": "221615-KATEKALYAN; 221619-KUAKONDA"
  },
  {
    "id": "OLF-26-221",
    "Dept": "Program Implementation",
    "Email": "amanpathak.olf@gmail.com",
    "Name": "Aman Pathak",
    "State": "Chhattisgarh",
    "Location": "Gariyaband",
    "Mobile": "7355045078",
    "Designation": "Project Officer",
    "Reporting manager": "shubhampatel.olf@gmail.com",
    "Division": "Raipur",
    "Block": "222514-DEOBHOG; 222526-MAINPUR",
    "District": "Gariaband"
  },
  {
    "id": "OLF-26-222",
    "Block": "220305-FARSABAHAR; 220308-KANSABEL; 220310-KUNKURI; 220313-PATHALGAON",
    "District": "Jashpur",
    "Division": "Surguja",
    "Reporting manager": "somnath.olf@gmail.com",
    "Mobile": "9835494387",
    "Location": "Jashpur",
    "State": "Chhattisgarh",
    "Email": "anandkumartoppo.olf@gmail.com",
    "Name": "Anand Kumar Toppo",
    "Dept": "Program Implementation",
    "Designation": "Project Officer",
    "Status": "Active"
  },
  {
    "id": "OLF-26-223",
    "Location": "Durg",
    "Dept": "Program Implementation",
    "Name": "Ananya Kumari",
    "State": "Chhattisgarh",
    "Block": "221006-DHAMDHA",
    "District": "Durg",
    "Division": "Durg",
    "Reporting manager": "tusharsahu@openlinksfoundation.org",
    "Designation": "Project Officer",
    "Email": "ananyakumari.olf@gmail.com",
    "Mobile": "9204221634"
  },
  {
    "id": "OLF-26-224",
    "Location": "Sukma",
    "Mobile": "8126657641",
    "Email": "angadsingh.olf@gmail.com",
    "District": "Bastar",
    "Reporting manager": "jeetendra@openlinksfoundation.org",
    "Division": "Bastar",
    "Block": "221504-DARBHA; 221523-TOKAPAL; 221530-BASTANAR; 221533-JAGDALPUR",
    "Dept": "Program Implementation",
    "State": "Chhattisgarh",
    "Designation": "Project Officer",
    "Name": "Angad Singh"
  },
  {
    "id": "OLF-26-225",
    "District": "Dharashiv",
    "Division": "Chhatrapati Sambhajinagar",
    "Reporting manager": "manoj@openlinksfoundation.org",
    "Block": "272901-BHOOM; 272902-KALLAMB; 272906-PARANDA; 272908-WASHI",
    "Mobile": "8769098159",
    "State": "Maharashtra",
    "Location": "Dharashiv",
    "Designation": "Project Officer",
    "Email": "ganeshsingh.olf@gmail.com",
    "Name": "Ganesh Singh",
    "Dept": "Program Implementation"
  },
  {
    "id": "OLF-26-226",
    "Mobile": "6232108995",
    "Dept": "Program Implementation",
    "Name": "Khushi Raghuwanshi",
    "Email": "khushiraghuwanshi.olf@gmail.com",
    "State": "Chhattisgarh",
    "Division": "Durg",
    "District": "Rajnandgaon",
    "Designation": "Project Officer",
    "Reporting manager": "tusharsahu@openlinksfoundation.org",
    "Block": "220905-DONGARGAON; 220906-DONGARGARH",
    "Location": "Rajnandgaon"
  },
  {
    "id": "OLF-26-227",
    "Dept": "Program Implementation",
    "State": "Madhya Pradesh",
    "Name": "Pratiksha Baghel",
    "Block": "234401-SEONI; 234402-BARGHAT; 234403-KEOLARI; 234405-CHHAPARA",
    "Status": "Active",
    "Reporting manager": "abhijeet@openlinksfoundation.org",
    "Designation": "Project Officer",
    "District": "Seoni",
    "Division": "Jabalpur",
    "Location": "Seoni",
    "Email": "pratikshabaghel.olf@gmail.com",
    "Mobile": "9131018466"
  },
  {
    "id": "OLF-26-228",
    "Reporting manager": "azharuddin@openlinksfoundation.org",
    "Block": "220403- DHARAMJAIGARH; 220406- GHARGHODA; 220411- LAILUNGA",
    "Location": "Raigarh",
    "Designation": "Project Officer",
    "District": "Raigarh",
    "Mobile": "6386482590",
    "Division": "Bilaspur",
    "State": "Chhattisgarh",
    "Email": "saurabhverma.olf@gmail.com",
    "Name": "Saurabh Verma",
    "Dept": "Program Implementation"
  },
  {
    "id": "OLF-26-229",
    "State": "Chhattisgarh",
    "Designation": "Project Officer",
    "District": "Kabirdham",
    "Division": "Durg",
    "Email": "sumanmaji.olf@gmail.com",
    "Mobile": "9064181044",
    "Location": "Kabirdham",
    "Dept": "Program Implementation",
    "Name": "Suman Maji",
    "Reporting manager": "jeetendra@openlinksfoundation.org"
  },
  {
    "id": "OLF-26-230",
    "Block": "270801 - ARVI; 270803 - DEOLI; 270804 - HINGANGHAT; 270808 - WARDHA",
    "District": "Wardha",
    "Division": "Nagpur",
    "Mobile": "8459073222",
    "Location": "Wardha",
    "State": "Maharashtra",
    "Email": "suvarna.olf@gmail.com",
    "Name": "Suvarna P Bhondve",
    "Designation": "Project Officer",
    "Dept": "Program Implementation",
    "Status": "Active",
    "Reporting manager": "nitesh.olf@gmail.com"
  },
  {
    "id": "OLF-26-231",
    "Block": "272003-DEVLA; 272007-MALEGAON; 272016-URC 1; 272018-URC 2",
    "Reporting manager": "pruthviraj@openlinksfoundation.org",
    "State": "Maharashtra",
    "Designation": "Project Officer",
    "Dept": "Program Implementation",
    "Email": "tawheed.olf@gmail.com",
    "Location": "Nashik",
    "Name": "Tawheed U Islam",
    "Mobile": "9149874963",
    "Division": "Nashik",
    "District": "Nashik; Nashik - MC"
  },
  {
    "id": "OLF-26-232",
    "Dept": "Program Implementation",
    "Name": "Tejal A Shinde",
    "Email": "tejal.olf@gmail.com",
    "Designation": "Project Officer",
    "Reporting manager": "shrikant@openlinksfoundation.org",
    "Location": "Ratnagiri",
    "State": "Maharashtra",
    "Mobile": "9673485732",
    "Block": "273201-CHIPLUN; 273202-DAPOLI; 273203-GUHAGAR; 273204-KHED; 273205-LANJA; 273206-MANDANGAD; 273207-RAJAPUR; 273208-RATNAGIRI; 273209-SANGMESHWAR",
    "Division": "Konkan",
    "District": "Ratnagiri"
  },
  {
    "id": "OLF-26-233",
    "State": "Bihar",
    "District": "Begusarai",
    "Division": "Munger",
    "Location": "Begusarai",
    "Dept": "Program Implementation",
    "Name": "Vishal Kumar",
    "Block": "102001- MANSOORCHAK; 102008- BARAUNI; 102013- DANDARI; 102015- CHHAURAHI; 102019- GARHPURA",
    "Reporting manager": "manoj@openlinksfoundation.org",
    "Designation": "Project Officer",
    "Mobile": "8051633500",
    "Email": "vishaljaiswal.olf@gmail.com"
  },
  {
    "id": "OLF-26-234",
    "State": "Maharashtra",
    "Location": "Nandurbar",
    "Designation": "Project Officer",
    "District": "Nandurbar",
    "Name": "Yash Pandey",
    "Division": "Nashik",
    "Mobile": "9131905967",
    "Dept": "Program Implementation",
    "Block": "270101 - NANDURBAR; 270102 - NAVAPUR; 270105 - AKKALKUWA",
    "Reporting manager": "shrikant@openlinksfoundation.org",
    "Email": "yashpandey.olf@gmail.com"
  },
  {
    "id": "OLF-26-235",
    "Block": "221106-ABHANPUR; 221122-ARANG",
    "District": "Raipur",
    "Division": "Raipur",
    "Designation": "Project Officer",
    "Mobile": "7417129792",
    "Location": "Raipur",
    "State": "Chhattisgarh",
    "Email": "ziaullah.olf@gmail.com",
    "Name": "Ziaullah",
    "Dept": "Program Implementation",
    "Reporting manager": "tusharsahu@openlinksfoundation.org"
  },
  {
    "id": "OLF-26-237",
    "State": "Maharashtra",
    "Reporting manager": "amol.r@openlinksfoundation.org",
    "Dept": "Program Implementation",
    "Name": "Ankit Kumar",
    "Mobile": "8105382544",
    "Block": "272001-BAGLAN; 272002-CHANDWAD; 272004-DINDORI; 272006-KALWAN; 272011-PEINT; 272013-SURGANA; 272014-TRIMBAK",
    "Designation": "Project Officer",
    "Location": "Beed",
    "District": "Nashik",
    "Division": "Nashik",
    "Email": "ankitkumar13.olf@gmail.com"
  },
  {
    "id": "OLF-26-238",
    "Reporting manager": "manoj@openlinksfoundation.org",
    "Location": "Begusarai",
    "State": "Bihar",
    "District": "Begusarai",
    "Division": "Munger",
    "Designation": "Project Officer",
    "Email": "sanskriti.olf@gmail.com",
    "Dept": "Program Implementation",
    "Mobile": "8409732134",
    "Name": "Sanskriti Singh"
  },
  {
    "id": "OLF-26-239",
    "Block": "273101-JAOLI; 273102-KARAD; 273103-KOREGAON; 273104-KHATAV; 273105-KHANDALA; 273106-MAHABALESHWAR; 273107-MAN; 273108-PATAN; 273109-PHALTAN; 273110-SATARA; 273111-WAI",
    "Designation": "Project Officer",
    "State": "Maharashtra",
    "Name": "Yogesh V Jagtap",
    "Email": "yogesh.olf@gmail.com",
    "Location": "Satara",
    "Reporting manager": "manoj@openlinksfoundation.org",
    "Dept": "Program Implementation",
    "Mobile": "7083642572",
    "District": "Satara",
    "Division": "Pune"
  },
  {
    "id": "OLF-26-241",
    "Mobile": "8482981188",
    "Location": "Akola",
    "Division": "Amravati",
    "District": "Amravati; Amravati - MC; Buldhana; Washim; Yavatmal",
    "Dept": "Program Implementation Div",
    "Designation": "Division Manager",
    "Name": "Amol Kukade",
    "Email": "amol.k@openlinksfoundation.org",
    "State": "Maharashtra",
    "Block": "270401-BULDANA; 270402-CHIKHALI; 270403-KHAMGAON; 270404-DEULGAON RAJA; 270405-MOTALA; 270406-LOANR; 270407-MALAKAPUR; 270408-MEHAKAR; 270409-JALGAON JAMOD; 270410-NANDURA; 270411-SANGRAMPUR; 270412-SHEGAON; 270413-SINDKHED RAJA; 27060-KARANJA LAD; 27060-MALEGAON; 27060-MANGRULPIR; 27060-RISOD; 27060-WASHIM; 270604-MANORA; 270701 - ACHALPUR; 270702 - AMRAVATI; 270703 - ANJANGAON SURJI; 270704 - BHATKULI; 270705 - CHANDUR BZ; 270706 - CHIKHALDARA; 270707 - CHANDUR RLY; 270708 - DARYAPUR; 270709 - DHARNI; 270710 - DHAMANGAON RLY; 270711 - MORSHI; 270712 - NANDGAON KH; 270713 - TIOSA; 270714 - WARUD; 270715 - AMRAVATI MNP; 271401 - ARNI; 271402 - BABHULGAON; 271403 - DARWHA; 271404 - DIGRAS; 271405 - GHATANJI; 271406 - KALAMB; 271407 - MAHAGAON; 271408 - MAREGAON; 271409 - NER; 271410 - PANDHARKAWADA; 271411 - PUSAD; 271412 - RALEGAON; 271413 - UMARKHED; 271414 - WANI; 271415 - YAVATMAL; 271416 - ZARI",
    "Reporting manager": "vishvajit@openlinksfoundation.org"
  },
  {
    "id": "OLF-26-245",
    "Mobile": "8097711008",
    "Division": "Chhatrapati Sambhajinagar",
    "District": "Jalna",
    "Email": "yogeshubale.olf@gmail.com",
    "Designation": "Project Officer",
    "Location": "Jalna",
    "Reporting manager": "amol.r@openlinksfoundation.org",
    "Block": "",
    "Dept": "Program Implementation",
    "State": "Maharashtra",
    "Name": "Yogesh Ubale"
  },
  {
    "id": "OLF-26-247",
    "Dept": "Program Implementation",
    "State": "Chhattisgarh",
    "Name": "Mohd. Rahul Khan",
    "Designation": "Project Officer",
    "Block": "221608-GEEDAM; 221622-DANTEWADA",
    "Status": "Active",
    "Reporting manager": "amit.k@openlinksfoundation.org",
    "District": "Dantewada",
    "Division": "Bastar",
    "Location": "Dantewada",
    "Email": "rahulkhan.olf@gmail.com",
    "Mobile": "9991563686"
  },
  {
    "id": "OLF-26-248",
    "Location": "Nanded",
    "State": "Maharashtra",
    "Name": "Manoj A Pallewar",
    "Reporting manager": "ajay@openlinksfoundation.org",
    "Mobile": "7030108726",
    "Designation": "Project Officer",
    "District": "Nanded",
    "Dept": "Program Implementation",
    "Division": "Chhatrapati Sambhajinagar",
    "Email": "manojpallewar.olf@gmail.com"
  },
  {
    "id": "OLF-26-249",
    "State": "Maharashtra",
    "District": "",
    "Division": "Chhatrapati Sambhajinagar",
    "Name": "Chetan Shivram Dange",
    "Location": "Ch. Sambhaji Nagar",
    "Block": "",
    "Dept": "Program Implementation",
    "Reporting manager": "amol.r@openlinksfoundation.org",
    "Designation": "Project Officer",
    "Mobile": "8805667060",
    "Email": "chetandange.olf@gmail.com"
  },
  {
    "id": "OLF-26-252",
    "Designation": "Project Officer",
    "Dept": "Program Implementation",
    "Name": "Sachin Y Khobragade",
    "Email": "sachinkhobragade.olf@gmail.com",
    "State": "Maharashtra",
    "Mobile": "8329366477",
    "Division": "Pune",
    "District": "Pune",
    "Reporting manager": "manoj@openlinksfoundation.org",
    "Location": "Pune HO",
    "Block": "272501-AMBEGAON; 272507-JUNNAR; 272508-KHED; 272509-MAVAL; 272510-MULSHI; 272512-SHIRUR"
  },
  {
    "id": "OLF-26-253",
    "State": "Maharashtra",
    "Designation": "Project Officer",
    "Reporting manager": "amol.r@openlinksfoundation.org",
    "Dept": "Program Implementation",
    "Name": "Liladhar G Rothe",
    "Block": "272701-AMBAJOGAI; 272704-DHARUR; 272706-KAIJ; 272707-MAJALGAON; 272708-PARLI",
    "District": "Bid",
    "Division": "Chhatrapati Sambhajinagar",
    "Location": "Beed",
    "Mobile": "7218379013",
    "Email": "liladharrothe.olf@gmail.com"
  },
  {
    "id": "OLF-26-254",
    "Reporting manager": "nitesh.olf@gmail.com",
    "Dept": "Program Implementation",
    "State": "Maharashtra",
    "Name": "Mangesh S Ramteke",
    "District": "Chandrapur",
    "Designation": "Project Officer",
    "Division": "Nagpur",
    "Location": "Chndrapur",
    "Block": "271308-MUL; 271309-SINDEWAHI; 271310-NAGBHID; 271311-BRAMHAPURI; 271312-CHIMUR; 271313-SAOLI; 271314-POMBURNA",
    "Status": "Active",
    "Email": "mangeshramteke.olf@gmail.com",
    "Mobile": "9021827552"
  },
  {
    "id": "OLF-26-256",
    "Mobile": "7987456125",
    "Reporting manager": "abhijeet@openlinksfoundation.org",
    "Division": "Jabalpur",
    "District": "Seoni",
    "Email": "netrapal.olf@gmail.com",
    "Location": "Seoni",
    "Status": "Active",
    "Block": "234404-KURAI; 234406-LAKHNADON; 234407-GHANSORE; 234408-DHANORA",
    "State": "Madhya Pradesh",
    "Dept": "Program Implementation",
    "Designation": "Project Officer",
    "Name": "Netrapal Singh Katre"
  },
  {
    "id": "OLF-26-257",
    "Designation": "Project Officer",
    "Mobile": "8421337255",
    "Email": "swapnilbhovate.olf@gmail.com",
    "Block": "270902-KATOL; 270903-KALMESHWAR; 270905-KAMPTEE; 270911-UMRED; 270913-BHIWAPUR",
    "Location": "Nagpur",
    "Division": "Nagpur",
    "Name": "Swapnil S Bhovate",
    "State": "Maharashtra",
    "District": "Nagpur",
    "Reporting manager": "vishal@openlinksfoundation.org",
    "Dept": "Program Implementation"
  },
  {
    "id": "OLF-26-258",
    "District": "Washim",
    "Name": "Pratiksha A Bhagat",
    "Reporting manager": "raghunath@openlinksfoundation.org",
    "Division": "Amravati",
    "Dept": "Program Implementation",
    "State": "Maharashtra",
    "Block": "27060-KARANJA LAD; 27060-MALEGAON; 27060-MANGRULPIR; 27060-RISOD; 27060-WASHIM; 270604-MANORA",
    "Location": "Washim",
    "Mobile": "9881876916",
    "Designation": "Project Officer",
    "Email": "pratikshabhagat1.olf@gmail.com"
  },
  {
    "id": "OLF-26-259",
    "Block": "221504-DARBHA; 221517-BASTAR; 221523-TOKAPAL; 221524-LOHANDIGUDA; 221529-BAKAWAND; 221530-BASTANAR; 221533-JAGDALPUR; 221608-GEEDAM; 221615-KATEKALYAN; 221619-KUAKONDA; 221622-DANTEWADA; 222102-SUKMA; 222134-KONTA; 222135-CHHINDGARH",
    "District": "Bastar; Dantewada; Sukma",
    "Division": "Bastar",
    "Reporting manager": "jeetendra@openlinksfoundation.org",
    "Location": "Bastar",
    "Status": "Active",
    "State": "Chhattisgarh",
    "Email": "amit.k@openlinksfoundation.org",
    "Designation": "Program Manager",
    "Name": "Amit A Kundu",
    "Dept": "Program Implementation PM",
    "Mobile": "9479271152"
  },
  {
    "id": "OLF-26-260",
    "Location": "Thane",
    "Name": "Ghanshyam M Arya",
    "Designation": "Sr. Project Officer",
    "Dept": "Program Implementation",
    "State": "Maharashtra",
    "District": "Thane",
    "Division": "Konkan",
    "Reporting manager": "manik@openlinksfoundation.org",
    "Email": "ghanshyam.olf@gmail.com",
    "Mobile": "9769693738"
  },
  {
    "id": "OLF-26-262",
    "Dept": "Program Implementation PM",
    "Reporting manager": "vishal@openlinksfoundation.org",
    "Name": "Abhijeet L Vaidhay",
    "State": "Madhya Pradesh",
    "Block": "234401-SEONI; 234402-BARGHAT; 234403-KEOLARI; 234404-KURAI; 234405-CHHAPARA; 234406-LAKHNADON; 234407-GHANSORE; 234408-DHANORA; 234501-BALAGHAT; 234502-KIRNAPUR; 234503-KATANGI; 234504-KHAIRLANJI; 234505-PARASWADA; 234506-LAL BURRA; 234507-WARA SEONI; 234508-LANJI; 234509-BAIHAR; 234510-BIRSA",
    "Mobile": "9340564194",
    "Location": "Balaghat",
    "District": "Balaghat; Seoni",
    "Email": "abhijeet@openlinksfoundation.org",
    "Division": "Jabalpur",
    "Designation": "Program Manager",
    "Status": "Active"
  },
  {
    "id": "OLF-IN-26-004",
    "Location": "Pune HO",
    "Block": "",
    "Designation": "Program Implementation",
    "Mobile": "7588903131",
    "District": "",
    "State": "Maharashtra",
    "Division": "Pune",
    "Email": "shrisai.olf@gmail.com",
    "Name": "Shrisai Vijaykant Bandal",
    "Status": "Active",
    "Dept": "Program Implementation PM",
    "Reporting manager": "prashant@openlinksfoundation.org"
  },
  {
    "id": "OLF-IN-26-005",
    "Email": "ombhandwalkar.olf@gmail.com",
    "Reporting manager": "prashant@openlinksfoundation.org",
    "Location": "Pune HO",
    "Mobile": "9588602787",
    "Division": "Pune",
    "District": "",
    "Block": "",
    "Status": "Active",
    "Name": "Om S Bhandwalkar",
    "Dept": "Program Implementation",
    "State": "Maharashtra",
    "Designation": "Analyst - Program Insights"
  },
  {
    "id": "OLF_Visitor_01",
    "Name": "Guest 01",
    "Mobile": "9999999999",
    "Dept": "Program Implementation",
    "State": "Maharashtra",
    "Email": "anjalibisht.olf@gmail.com",
    "Location": "Pune HO",
    "Designation": "Guest",
    "Reporting manager": "Guest"
  }
];

  // State
  let activeView = "smart-goals"; // 'smart-goals' | 'historical'
  let activeState = "MH"; // 'MH' | 'CH' | 'MP' | 'BR'
  let expandedDivisions = new Set(); // Set of division/track IDs that are expanded
  let searchQuery = "";
  let currentModalRoleId = null;
  let activeModalTab = "goals"; // 'goals' | 'role' | 'priority' | 'annexures'
  let isModalMaximized = false;
  let tabEditStates = {
    goals: false,
    role: false,
    priority: false,
    annexures: false
  };

  // Live staff dataset
  let liveEmployees = [...CACHED_PROGRAM_STAFF];
  let dynamicTree = null;

  // Role-Based Access Control (RBAC) Store
  // STRICTLY Admin-only by default. Custom editors persisted to Firestore and localStorage.
  const STORAGE_KEY_EDITORS = "olf_smart_goals_authorized_editors_v1";
  let authorizedEditors = new Set();
  let isAdminUser = false;
  let canEditUser = false;

  function loadLocalEditors() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_EDITORS);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          authorizedEditors = new Set(list.map(e => String(e).trim().toLowerCase()));
        }
      }
    } catch (e) {
      console.warn("[TeamPerformance] Could not load authorized editors:", e);
    }
  }

  function saveLocalEditors() {
    try {
      localStorage.setItem(STORAGE_KEY_EDITORS, JSON.stringify([...authorizedEditors]));
    } catch (e) {
      console.warn("[TeamPerformance] Could not save authorized editors:", e);
    }
  }

  async function syncFirestoreEditors() {
    if (window.SmartGoalsEditors && typeof window.SmartGoalsEditors.list === "function") {
      try {
        const list = await window.SmartGoalsEditors.list();
        if (Array.isArray(list) && list.length) {
          list.forEach(e => authorizedEditors.add(String(e).trim().toLowerCase()));
          saveLocalEditors();
        }
      } catch (e) {
        console.warn("[TeamPerformance] Could not sync Firestore editors:", e);
      }
    }
  }

  async function checkPermissions() {
    let user = null;
    if (window.__olfUser && window.__olfUser.email) {
      user = {
        email: String(window.__olfUser.email).trim().toLowerCase(),
        role: window.__olfUser.role || "User"
      };
    } else {
      try {
        const sim = localStorage.getItem("olf_smart_goals_simulated_user");
        if (sim) user = JSON.parse(sim);
      } catch (e) {}
    }
    if (!user) {
      user = { email: "", role: "User" };
    }

    // 1. Is IT Admin?
    if (user.role === "Admin") {
      isAdminUser = true;
    } else if (typeof window.olfIsEmailAdmin === "function" && user.email) {
      try {
        isAdminUser = await window.olfIsEmailAdmin(user.email);
      } catch (e) {
        isAdminUser = false;
      }
    } else {
      isAdminUser = false;
    }

    // 2. Can Edit? STRICTLY Admin only by default. Or in authorizedEditors list.
    // Non-admin staff (including Vishvajit) are view-only by default unless explicitly granted.
    if (isAdminUser) {
      canEditUser = true;
    } else if (user.email && authorizedEditors.has(user.email)) {
      canEditUser = true;
    } else {
      canEditUser = false;
    }

    updateToolbarAdminUI();
    updateModalEditControlsVisibility();
  }

  function updateToolbarAdminUI() {
    const btn = document.getElementById("tpManageEditorsBtn");
    if (btn) {
      btn.style.display = isAdminUser ? "inline-flex" : "none";
    }
  }

  function updateModalEditControlsVisibility() {
    const canEdit = canEditUser;

    const resetBtn = document.getElementById("tpResetDefaultBtn");
    if (resetBtn) resetBtn.style.display = canEdit ? "inline-flex" : "none";

    const editGoalsBtn = document.getElementById("tpEditGoalsBtn");
    if (editGoalsBtn) editGoalsBtn.style.display = canEdit ? "inline-flex" : "none";

    const editRoleBtn = document.getElementById("tpEditRoleBtn");
    if (editRoleBtn) editRoleBtn.style.display = canEdit ? "inline-flex" : "none";

    const editPriorityBtn = document.getElementById("tpEditPriorityBtn");
    if (editPriorityBtn) editPriorityBtn.style.display = canEdit ? "inline-flex" : "none";

    const editAnnexuresBtn = document.getElementById("tpEditAnnexuresBtn");
    if (editAnnexuresBtn) editAnnexuresBtn.style.display = canEdit ? "inline-flex" : "none";

    if (!canEdit) {
      toggleEditGoals(false);
      toggleEditRole(false);
      toggleEditPriority(false);
      toggleEditAnnexures(false);
    }
  }

  function openEditorsModal() {
    if (!isAdminUser) {
      toast("Access restricted: Only IT Administrators can manage editors.", "error");
      return;
    }
    const modal = document.getElementById("tpEditorsModal");
    if (modal) {
      modal.style.display = "flex";
      modal.classList.add("open");
      renderEditorsList();
      populateStaffEmailDropdown();
    }
  }

  function closeEditorsModal() {
    const modal = document.getElementById("tpEditorsModal");
    if (modal) {
      modal.classList.remove("open");
      modal.style.display = "none";
    }
  }

  function populateStaffEmailDropdown() {
    const dl = document.getElementById("tpStaffEmailList");
    if (!dl) return;
    const staff = liveEmployees && liveEmployees.length ? liveEmployees : CACHED_PROGRAM_STAFF;
    let html = "";
    staff.forEach(s => {
      const email = String(s.Email || "").trim().toLowerCase();
      if (email) {
        html += `<option value="${esc(email)}">${esc(s.Name || "")} (${esc(s.Designation || "Staff")})</option>`;
      }
    });
    dl.innerHTML = html;
  }

  function renderEditorsList() {
    const container = document.getElementById("tpEditorsList");
    const countEl = document.getElementById("tpEditorsCount");
    if (!container) return;

    const list = [...authorizedEditors];
    if (countEl) countEl.textContent = list.length;

    if (list.length === 0) {
      container.innerHTML = `<div class="tp-empty-editors">No custom editors assigned. Only IT Admins currently have edit access.</div>`;
      return;
    }

    let html = "";
    list.forEach(email => {
      const emp = (liveEmployees || []).find(e => (e.Email || "").trim().toLowerCase() === email);
      const name = emp ? emp.Name : email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      const roleText = emp ? (emp.Designation || "Editor") : "Authorized Editor";
      const initials = (name.split(/\s+/).map(p => p[0]).join("").substring(0, 2) || "ED").toUpperCase();

      html += `
        <div class="tp-editor-item">
          <div class="tp-editor-item-left">
            <div class="tp-editor-avatar">${esc(initials)}</div>
            <div class="tp-editor-info">
              <div class="tp-editor-name">${esc(name)} <span style="font-size:11px; font-weight:normal; color:#64748B;">&middot; ${esc(roleText)}</span></div>
              <div class="tp-editor-email">${esc(email)}</div>
            </div>
          </div>
          <button type="button" class="tp-btn-revoke" onclick="window.TeamPerformance.revokeEditorAccess('${esc(email)}')" title="Revoke edit access">
            ✕ Revoke
          </button>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  async function grantEditorAccess() {
    if (!isAdminUser) {
      toast("Access restricted: Only IT Administrators can grant permissions.", "error");
      return;
    }
    const input = document.getElementById("tpNewEditorEmail");
    if (!input) return;
    const email = String(input.value || "").trim().toLowerCase();

    if (!email || !email.includes("@")) {
      toast("Please enter a valid employee email address.", "error");
      return;
    }

    if (authorizedEditors.has(email)) {
      toast(`${email} is already an authorized editor.`, "info");
      input.value = "";
      return;
    }

    authorizedEditors.add(email);
    saveLocalEditors();
    input.value = "";
    renderEditorsList();
    toast(`Edit access granted to ${email}`);

    if (window.SmartGoalsEditors && typeof window.SmartGoalsEditors.add === "function") {
      try {
        await window.SmartGoalsEditors.add(email);
      } catch (e) {
        console.warn("[TeamPerformance] Could not persist editor to Firestore:", e);
      }
    }

    await checkPermissions();
  }

  async function revokeEditorAccess(email) {
    if (!isAdminUser) {
      toast("Access restricted: Only IT Administrators can revoke permissions.", "error");
      return;
    }
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!authorizedEditors.has(cleanEmail)) return;

    authorizedEditors.delete(cleanEmail);
    saveLocalEditors();
    renderEditorsList();
    toast(`Revoked edit access for ${cleanEmail}`);

    if (window.SmartGoalsEditors && typeof window.SmartGoalsEditors.remove === "function") {
      try {
        await window.SmartGoalsEditors.remove(cleanEmail);
      } catch (e) {
        console.warn("[TeamPerformance] Could not remove editor from Firestore:", e);
      }
    }

    await checkPermissions();
  }


  // Persistent Custom Data Store
  // Shape: { [roleId]: { goals?: [], role?: string, resp?: [], priority?: [], annexures?: [] } }
  let customData = {};

  // Keep an immutable snapshot of original template data for instant clean reset
  let originalTemplateSnapshot = {};
  try {
    if (window.TEAM_PERFORMANCE_ROLES) {
      originalTemplateSnapshot = JSON.parse(JSON.stringify(window.TEAM_PERFORMANCE_ROLES));
    }
  } catch (e) {
    console.warn("[TeamPerformance] Could not snapshot original roles:", e);
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) customData = JSON.parse(raw);
  } catch (e) {
    console.warn("[TeamPerformance] Could not load custom data from localStorage:", e);
  }

  const DISTRICT_RENAMES = {
    "bid": "Beed",
    "raigarh mh": "Raigad",
    "thane-zp": "Thane",
    "thane - kdmc": "Thane",
    "nagpur - atc": "Nagpur",
    "amravati - mc": "Amravati",
    "nashik - mc": "Nashik",
    "sangli - mc": "Sangli",
    "pimpri chinchwad": "Pune",
    "pimpri chinchwad - mc": "Pune",
    "pune - mc": "Pune"
  };

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function slugify(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function tidyDistrict(name) {
    let trimmed = String(name || "").trim().replace(/\s*[-–]?\s*(MC|ATC|KDMC|ZP|KD)$/i, "").trim();
    if (DISTRICT_RENAMES[trimmed.toLowerCase()]) trimmed = DISTRICT_RENAMES[trimmed.toLowerCase()];
    return trimmed;
  }

  function splitMulti(val) {
    return String(val || "").split(/[;\r\n]/).map(s => s.trim()).filter(Boolean);
  }

  function shortDesignation(desig) {
    if (!desig) return "PO";
    if (/sr\.\s*project\s*officer/i.test(desig)) return "Sr. PO";
    if (/project\s*officer/i.test(desig)) return "PO";
    if (/analyst/i.test(desig)) return "Analyst";
    if (/communications\s*manager/i.test(desig)) return "Comm. Mgr";
    if (/associate\s*program\s*manager/i.test(desig)) return "Assoc. PM";
    if (/program\s*manager/i.test(desig)) return "PM";
    if (/division\s*manager/i.test(desig)) return "Div. Mgr";
    if (/coo/i.test(desig)) return "COO";
    return desig;
  }

  function isActiveEmployee(emp) {
    return String((emp || {})["Status"] || "").trim().toLowerCase() !== "inactive";
  }

  function isActualDivisionManager(emp) {
    if (!emp) return false;
    const desig = String(emp.Designation || "").trim().toLowerCase();
    const dept = String(emp.Dept || "").trim().toLowerCase();
    return desig.includes("division manager") || (desig.includes("manager") && dept.includes("div"));
  }

  function isProgramImplementation(emp) {
    return /program\s*implementation/i.test(String((emp || {})["Dept"] || ""));
  }

  // --- Dynamic Tree Construction (100% Data-Driven Hierarchy) ---

  function buildOperationalTree(staffList) {
    const activeStaff = (staffList && staffList.length ? staffList : CACHED_PROGRAM_STAFF)
      .filter(isActiveEmployee)
      .filter(isProgramImplementation);

    const byEmail = new Map();
    const byId = new Map();
    activeStaff.forEach(s => {
      const em = normalizeEmail(s.Email);
      if (em) byEmail.set(em, s);
      if (s.id) byId.set(s.id, s);
    });

    const placedStaffIds = new Set();

    function buildDistrictCards(subordinates, pmKey) {
      const distMap = new Map();
      subordinates.forEach(po => {
        placedStaffIds.add(po.id);
        const rawDist = po.District || "";
        const distList = [...new Set(splitMulti(rawDist).map(tidyDistrict))];
        const distName = distList[0] || (po.Division ? `${po.Division} Support` : "Interim District");
        if (!distMap.has(distName)) distMap.set(distName, []);
        distMap.get(distName).push(po);
      });

      const districts = [];
      for (const [distName, poList] of distMap.entries()) {
        districts.push({
          cardId: `n-d-${slugify(distName)}-${slugify(pmKey)}`,
          roleId: `d-${slugify(distName)}`,
          name: distName,
          pos: poList.map(po => ({
            roleId: po.id,
            name: `${po.Name} · ${shortDesignation(po.Designation)}`
          }))
        });
      }
      return districts;
    }

    function getDivId(emp) {
      const rawDiv = String(emp.Division || "").trim().toLowerCase();
      const rawLoc = String(emp.Location || "").trim().toLowerCase();
      const geoCheck = `${rawDiv} ${rawLoc}`;

      if (geoCheck.includes("pune")) return "pune";
      if (geoCheck.includes("nagpur")) return "nagpur";
      if (geoCheck.includes("amravati")) return "amravati";
      if (geoCheck.includes("sambhajinagar") || geoCheck.includes("aurangabad") || geoCheck.includes("csn")) return "csn";
      if (geoCheck.includes("nashik") || geoCheck.includes("konkan")) return "nashik-konkan";

      const mgrEmail = normalizeEmail(emp["Reporting manager"] || emp["Reporting Manager"]);
      if (mgrEmail === "manoj@openlinksfoundation.org" || mgrEmail === "rahul@openlinksfoundation.org") return "pune";
      if (mgrEmail === "vishal@openlinksfoundation.org" || mgrEmail === "nitesh.olf@gmail.com") return "nagpur";
      if (mgrEmail === "amol.k@openlinksfoundation.org" || mgrEmail === "raghunath@openlinksfoundation.org" || mgrEmail === "mohan@openlinksfoundation.org") return "amravati";
      if (mgrEmail === "amol.r@openlinksfoundation.org" || mgrEmail === "ajay@openlinksfoundation.org") return "csn";
      if (mgrEmail === "shrikant@openlinksfoundation.org" || mgrEmail === "pruthviraj@openlinksfoundation.org" || mgrEmail === "manik@openlinksfoundation.org") return "nashik-konkan";

      const dists = [...splitMulti(emp.District), ...splitMulti(emp.Location)].map(tidyDistrict).map(d => d.toLowerCase());
      if (dists.some(d => ["pune", "solapur", "satara", "sangli", "kolhapur"].includes(d))) return "pune";
      if (dists.some(d => ["nagpur", "bhandara", "gadchiroli", "gondia", "wardha", "chandrapur"].includes(d))) return "nagpur";
      if (dists.some(d => ["amravati", "yavatmal", "washim", "buldhana", "akola"].includes(d))) return "amravati";
      if (dists.some(d => ["jalna", "beed", "nanded", "hingoli", "dharashiv", "latur"].includes(d))) return "csn";
      if (dists.some(d => ["nashik", "ahilyanagar", "jalgaon", "nandurbar", "palghar", "thane", "raigad", "ratnagiri"].includes(d))) return "nashik-konkan";

      return "pune";
    }

    // --- 1. MAHARASHTRA (MH) ---
    const mhStaff = activeStaff.filter(s => {
      const st = String(s.State || "").trim().toLowerCase();
      return st.includes("maha") || (!st && normalizeEmail(s["Reporting manager"] || "").includes("openlinks") && !st.includes("chhatt") && !st.includes("madhya") && !st.includes("bihar"));
    });

    const coo = mhStaff.find(e => /coo/i.test(e.Dept) || /coo/i.test(e.Designation)) || {
      Name: "Vishvajit G Pawar",
      Designation: "COO",
      id: "OLF-23-010"
    };
    placedStaffIds.add(coo.id);

    const mhDivConfigs = [
      { id: "pune", title: "Pune Division", leadEmail: "manoj@openlinksfoundation.org", defaultLeadName: "Manoj C Girase", roleId: "dm-pune", role: "Associate Division Manager" },
      { id: "nagpur", title: "Nagpur Division", leadEmail: "vishal@openlinksfoundation.org", defaultLeadName: "Vishal J Dahat", roleId: "dm-nagpur", role: "Sr. Program Manager & Division Manager" },
      { id: "amravati", title: "Amravati Division", leadEmail: "amol.k@openlinksfoundation.org", defaultLeadName: "Amol Kukade", roleId: "dm-amravati", role: "Division Manager" },
      { id: "csn", title: "Chhatrapati Sambhajinagar Division", leadEmail: null, defaultLeadName: "Vacant", roleId: "dm-csn", role: "Division Manager (Vacant)" },
      { id: "nashik-konkan", title: "Nashik & Konkan Division", leadEmail: "shrikant@openlinksfoundation.org", defaultLeadName: "Shrikant S Sawant", roleId: "dm-nashik", role: "Division Manager" }
    ];

    const divColumnsMap = new Map();
    mhDivConfigs.forEach(cfg => divColumnsMap.set(cfg.id, []));

    const mhManagersMap = new Map();
    const mhUnassigned = [];

    mhStaff.forEach(e => {
      if (e.id === coo.id) return;
      const mgrEmail = normalizeEmail(e["Reporting manager"] || e["Reporting Manager"]);
      const mgr = byEmail.get(mgrEmail);
      if (!mgr) {
        mhUnassigned.push(e);
        return;
      }

      // If reporting to Manoj Girase from CSN division, align under CSN Associate PM Somnath Swami
      if (mgrEmail === "manoj@openlinksfoundation.org" && String(e.Division || "").includes("Sambhajinagar") && e.Email !== "somnathswami.olf@gmail.com") {
        const swami = byEmail.get("somnathswami.olf@gmail.com");
        if (swami) {
          if (!mhManagersMap.has("somnathswami.olf@gmail.com")) mhManagersMap.set("somnathswami.olf@gmail.com", { mgr: swami, subs: [] });
          mhManagersMap.get("somnathswami.olf@gmail.com").subs.push(e);
          return;
        }
      }

      if (!mhManagersMap.has(mgrEmail)) {
        mhManagersMap.set(mgrEmail, { mgr: mgr, subs: [] });
      }
      mhManagersMap.get(mgrEmail).subs.push(e);
    });

    const swami = byEmail.get("somnathswami.olf@gmail.com");
    if (swami && !mhManagersMap.has("somnathswami.olf@gmail.com")) {
      mhManagersMap.set("somnathswami.olf@gmail.com", { mgr: swami, subs: [] });
    }

    for (const [mgrEmail, entry] of mhManagersMap.entries()) {
      const mgr = entry.mgr;
      placedStaffIds.add(mgr.id);

      const directStaff = entry.subs.filter(s => !mhManagersMap.has(normalizeEmail(s.Email)));
      if (directStaff.length === 0 && entry.subs.length > 0) continue;

      const divId = getDivId(mgr);
      let label = mgr.Designation || "Program Manager";
      if (/div/i.test(mgr.Dept) || /division\s*manager/i.test(mgr.Designation)) {
        label = "Division Manager Track";
      }

      const districts = buildDistrictCards(directStaff, mgr.id || mgrEmail);
      const pmCol = {
        pmId: mgr.id || `pm-${slugify(mgr.Name)}`,
        label: label,
        name: mgr.Name,
        badge: `${directStaff.length} POs`,
        districts: districts
      };

      if (divColumnsMap.has(divId)) {
        divColumnsMap.get(divId).push(pmCol);
      } else {
        divColumnsMap.get("pune").push(pmCol);
      }
    }

    // Graceful fallback for unassigned/operational support in MH
    if (mhUnassigned.length > 0) {
      const unassignedByDiv = new Map();
      mhUnassigned.forEach(u => {
        const divId = getDivId(u);
        if (!unassignedByDiv.has(divId)) unassignedByDiv.set(divId, []);
        unassignedByDiv.get(divId).push(u);
      });

      for (const [divId, group] of unassignedByDiv.entries()) {
        const lead = group.find(s => /manager|lead|pm/i.test(s.Designation)) || group[0];
        placedStaffIds.add(lead.id);
        const remaining = group.filter(s => s.id !== lead.id);
        const districts = buildDistrictCards(remaining.length ? remaining : [lead], lead.id);
        const pmCol = {
          pmId: lead.id,
          label: lead.Designation || "Program Operations",
          name: lead.Name,
          badge: "Support",
          districts: districts
        };
        if (divColumnsMap.has(divId)) {
          divColumnsMap.get(divId).push(pmCol);
        } else {
          divColumnsMap.get("pune").push(pmCol);
        }
      }
    }

    const mhDivisions = mhDivConfigs.map(cfg => {
      let leadEmp = cfg.leadEmail ? byEmail.get(cfg.leadEmail) : null;
      if (leadEmp && (!isActualDivisionManager(leadEmp) && cfg.id === "csn")) {
        leadEmp = null;
      }
      if (leadEmp) placedStaffIds.add(leadEmp.id);
      const isVacant = !leadEmp || String(leadEmp.Name).toLowerCase() === "vacant";
      return {
        divisionId: cfg.id,
        state: "MH",
        divisionTitle: cfg.title,
        divisionLead: isVacant ? "Vacant" : leadEmp.Name,
        divisionRoleId: cfg.roleId,
        divisionRole: isVacant ? "Division Manager (Vacant)" : leadEmp.Designation,
        pmColumns: divColumnsMap.get(cfg.id) || []
      };
    });

    const mhDistCount = mhDivisions.reduce((acc, div) => acc + div.pmColumns.reduce((pa, pm) => pa + pm.districts.length, 0), 0);
    const mhPoCount = mhDivisions.reduce((acc, div) => acc + div.pmColumns.reduce((pa, pm) => pa + pm.districts.reduce((da, d) => da + d.pos.length, 0), 0), 0);

    const stateLead = {
      roleId: "statelead",
      name: coo.Name || "Vishvajit G Pawar",
      title: "State Lead — Maharashtra",
      divisionsCount: mhDivisions.length,
      pmsCount: mhDivisions.reduce((acc, div) => acc + div.pmColumns.length, 0),
      districtsCount: mhDistCount,
      posCount: mhPoCount,
      activeStaffCount: mhStaff.length
    };

    function rankLead(desig) {
      const d = (desig || "").toLowerCase();
      if (d.includes("division manager") && !d.includes("associate")) return 100;
      if (d.includes("associate division manager")) return 90;
      if (d.includes("sr. program manager") || d.includes("senior program manager")) return 80;
      if (d.includes("program manager") && !d.includes("associate")) return 70;
      if (d.includes("associate program manager")) return 60;
      if (d.includes("sr. project officer") || d.includes("senior project officer")) return 40;
      if (d.includes("project officer") || d.includes("po")) return 30;
      return 10;
    }

    function buildStateDivisions(stateCode, stateStaff, stateLead, preferredDivNames) {
      const divGroups = new Map();
      const interimStaff = [];

      if (preferredDivNames && preferredDivNames.length) {
        preferredDivNames.forEach(name => {
          divGroups.set(name.toLowerCase(), { titleName: name, staff: [] });
        });
      }

      stateStaff.forEach(s => {
        const rawDiv = String(s.Division || "").trim();
        if (!rawDiv) {
          interimStaff.push(s);
          return;
        }

        let matchedKey = null;
        for (const [key] of divGroups.entries()) {
          if (rawDiv.toLowerCase().includes(key) || key.includes(rawDiv.toLowerCase())) {
            matchedKey = key;
            break;
          }
        }

        if (matchedKey) {
          divGroups.get(matchedKey).staff.push(s);
        } else {
          const cleanName = rawDiv.replace(/\s*Division$/i, "").trim();
          divGroups.set(cleanName.toLowerCase(), { titleName: cleanName, staff: [s] });
        }
      });

      if (interimStaff.length > 0) {
        divGroups.set("interim", { titleName: "Interim", staff: interimStaff });
      }

      const divisions = [];

      for (const [divKey, group] of divGroups.entries()) {
        const divStaff = group.staff;
        const baseName = group.titleName;
        const divTitle = `${baseName} Division`;
        const divId = `${stateCode.toLowerCase()}-${slugify(baseName)}`;

        const sortedByRank = [...divStaff].sort((a, b) => rankLead(b.Designation) - rankLead(a.Designation));
        let leadEmp = sortedByRank[0] || null;

        let leadName = "Interim";
        let leadRole = "Interim";
        let roleId = `dm-${divId}`;

        if (leadEmp) {
          leadName = leadEmp.Name;
          roleId = leadEmp.id || `dm-${divId}`;
          const isFormalDM = /division\s*manager/i.test(leadEmp.Designation) && !/associate/i.test(leadEmp.Designation);
          if (isFormalDM) {
            leadRole = leadEmp.Designation || "Division Manager";
          } else {
            leadRole = `${leadEmp.Designation} / Interim Lead`;
          }
          placedStaffIds.add(leadEmp.id);
        } else if (divKey === "interim") {
          leadName = "Interim";
          leadRole = "Interim";
        }

        const mgrMap = new Map();
        const unassigned = [];

        divStaff.forEach(emp => {
          if (stateLead && emp.id === stateLead.id && divStaff.length > 1) {
            return;
          }

          const mgrEmail = normalizeEmail(emp["Reporting manager"] || emp["Reporting Manager"]);
          const mgr = byEmail.get(mgrEmail);
          if (mgr) {
            if (!mgrMap.has(mgrEmail)) mgrMap.set(mgrEmail, { mgr, subs: [] });
            mgrMap.get(mgrEmail).subs.push(emp);
          } else {
            unassigned.push(emp);
          }
        });

        const pmColumns = [];
        const placedInThisDiv = new Set();

        for (const [mgrEmail, entry] of mgrMap.entries()) {
          const mgr = entry.mgr;
          const directStaff = entry.subs.filter(s => !mgrMap.has(normalizeEmail(s.Email)));
          if (directStaff.length === 0) continue;

          directStaff.forEach(s => placedInThisDiv.add(s.id));

          let label = mgr.Designation ? `${mgr.Designation} Track` : "Program Manager Track";
          if (/division\s*manager/i.test(mgr.Designation)) {
            label = "Division Manager Track";
          }

          let roleId = mgr.id || `pm-${slugify(mgr.Name)}`;
          if (/jeetendra/i.test(mgr.Name) || mgr.id === "OLF-24-046" || (mgr.Email && mgr.Email.toLowerCase().includes("jeetendra"))) {
            roleId = "dm-cg";
          }

          const districts = buildDistrictCards(directStaff, `${mgr.id || slugify(mgr.Name)}-${divId}`);
          pmColumns.push({
            pmId: `${mgr.id || 'pm-' + slugify(mgr.Name)}-${divId}`,
            roleId: roleId,
            label: label,
            name: mgr.Name,
            badge: `${districts.length} Districts · ${directStaff.length} POs`,
            districts: districts
          });
        }

        const remainingStaff = divStaff.filter(s => !placedInThisDiv.has(s.id) && (!stateLead || s.id !== stateLead.id));
        if (remainingStaff.length > 0) {
          const unplacedMgrs = remainingStaff.filter(s => rankLead(s.Designation) >= 60);
          const unplacedOthers = remainingStaff.filter(s => rankLead(s.Designation) < 60);

          if (unplacedOthers.length > 0) {
            const leadForTrack = unplacedMgrs[0] || leadEmp || stateLead;
            const leadTrackName = leadForTrack ? leadForTrack.Name : "Interim Support";
            const districts = buildDistrictCards(unplacedOthers, `${divId}-support`);
            let roleId = leadForTrack ? (leadForTrack.id || `pm-${slugify(leadForTrack.Name)}`) : `pm-${divId}-support`;
            if (leadForTrack && (/jeetendra/i.test(leadForTrack.Name) || leadForTrack.id === "OLF-24-046")) {
              roleId = "dm-cg";
            }
            pmColumns.push({
              pmId: `pm-${divId}-support`,
              roleId: roleId,
              label: leadForTrack ? `${leadForTrack.Designation || 'Support'} / Interim Support` : "Interim Support Track",
              name: leadTrackName,
              badge: `Interim Support · ${unplacedOthers.length} Staff`,
              districts: districts
            });
          }

          if (pmColumns.length === 0 && unplacedMgrs.length > 0) {
            unplacedMgrs.forEach(pm => {
              const districts = buildDistrictCards([pm], pm.id);
              let roleId = pm.id || `pm-${slugify(pm.Name)}`;
              if (/jeetendra/i.test(pm.Name) || pm.id === "OLF-24-046") {
                roleId = "dm-cg";
              }
              pmColumns.push({
                pmId: pm.id,
                roleId: roleId,
                label: pm.Designation || "Program Manager Track",
                name: pm.Name,
                badge: `${districts.length} Districts · 1 Staff`,
                districts: districts
              });
            });
          }
        }

        if (pmColumns.length === 0 && divStaff.length > 0) {
          const districts = buildDistrictCards(divStaff, `${divId}-all`);
          let roleId = leadEmp ? leadEmp.id : `pm-${divId}`;
          if (leadEmp && (/jeetendra/i.test(leadEmp.Name) || leadEmp.id === "OLF-24-046")) {
            roleId = "dm-cg";
          }
          pmColumns.push({
            pmId: leadEmp ? leadEmp.id : `pm-${divId}`,
            roleId: roleId,
            label: leadRole,
            name: leadName,
            badge: `${districts.length} Districts · ${divStaff.length} Staff`,
            districts: districts
          });
        }

        divisions.push({
          divisionId: divId,
          state: stateCode,
          divisionTitle: divTitle,
          divisionLead: leadName,
          divisionRoleId: roleId,
          divisionRole: leadRole,
          pmColumns: pmColumns
        });
      }

      return divisions;
    }

    // --- 2. CHHATTISGARH (CH) ---
    const chStaff = activeStaff.filter(s => String(s.State || "").trim().toLowerCase().includes("chhatt"));
    const chLead = chStaff.find(e => /div/i.test(e.Dept) || /division\s*manager/i.test(e.Designation)) || {
      Name: "Jeetendra Singh",
      Designation: "Division Manager",
      id: "OLF-24-046"
    };
    placedStaffIds.add(chLead.id);

    const chDivisions = buildStateDivisions("CH", chStaff, chLead, ["Raipur", "Durg", "Bastar", "Bilaspur", "Surguja"]);
    const chDistCount = chDivisions.reduce((acc, div) => acc + div.pmColumns.reduce((pa, pm) => pa + pm.districts.length, 0), 0);
    const chPoCount = chDivisions.reduce((acc, div) => acc + div.pmColumns.reduce((pa, pm) => pa + pm.districts.reduce((da, d) => da + d.pos.length, 0), 0), 0);
    const chPmsCount = chDivisions.reduce((acc, div) => acc + div.pmColumns.length, 0);

    const chRoot = {
      roleId: "dm-cg",
      name: chLead.Name || "Jeetendra Singh",
      designation: chLead.Designation || "Division Manager",
      title: "State Lead — Chhattisgarh",
      divisionsCount: chDivisions.length,
      pmsCount: chPmsCount,
      districtsCount: chDistCount,
      posCount: chPoCount,
      activeStaffCount: chStaff.length
    };

    // --- 3. MADHYA PRADESH (MP) ---
    const mpStaff = activeStaff.filter(s => String(s.State || "").trim().toLowerCase().includes("madhya"));
    const mpLead = mpStaff.find(e => /pm/i.test(e.Dept) || /program\s*manager/i.test(e.Designation)) || {
      Name: "Abhijeet L Vaidhay",
      Designation: "Program Manager",
      id: "OLF-26-262"
    };
    placedStaffIds.add(mpLead.id);

    const mpDivisions = buildStateDivisions("MP", mpStaff, mpLead, ["Jabalpur"]);
    if (mpDivisions.length && mpDivisions[0].divisionLead === mpLead.Name) {
      mpDivisions[0].divisionRole = "Program Manager / Interim";
    }
    const mpDistCount = mpDivisions.reduce((acc, div) => acc + div.pmColumns.reduce((pa, pm) => pa + pm.districts.length, 0), 0);
    const mpPoCount = mpDivisions.reduce((acc, div) => acc + div.pmColumns.reduce((pa, pm) => pa + pm.districts.reduce((da, d) => da + d.pos.length, 0), 0), 0);
    const mpPmsCount = mpDivisions.reduce((acc, div) => acc + div.pmColumns.length, 0);

    const mpRoot = {
      roleId: "pm-v2",
      name: mpLead.Name || "Abhijeet L Vaidhay",
      designation: "Program Manager / Interim",
      title: "State Operations — Madhya Pradesh",
      divisionsCount: mpDivisions.length,
      pmsCount: mpPmsCount,
      districtsCount: mpDistCount,
      posCount: mpPoCount,
      activeStaffCount: mpStaff.length
    };

    // --- 4. BIHAR (BR) ---
    const brStaff = activeStaff.filter(s => String(s.State || "").trim().toLowerCase().includes("bihar"));
    const brLead = byEmail.get("manoj@openlinksfoundation.org") || {
      Name: "Manoj C Girase",
      Designation: "Associate Division Manager",
      id: "OLF-23-017"
    };

    const brDivisions = buildStateDivisions("BR", brStaff, brLead, ["Munger"]);
    if (brDivisions.length) {
      brDivisions[0].divisionLead = brLead.Name;
      brDivisions[0].divisionRole = "Associate Division Manager / Interim";
      brDivisions[0].divisionRoleId = "dm-pune";
    }
    const brDistCount = brDivisions.reduce((acc, div) => acc + div.pmColumns.reduce((pa, pm) => pa + pm.districts.length, 0), 0);
    const brPoCount = brDivisions.reduce((acc, div) => acc + div.pmColumns.reduce((pa, pm) => pa + pm.districts.reduce((da, d) => da + d.pos.length, 0), 0), 0);
    const brPmsCount = brDivisions.reduce((acc, div) => acc + div.pmColumns.length, 0);

    const brRoot = {
      roleId: "dm-pune",
      name: brLead.Name,
      designation: "Associate Division Manager / Interim",
      title: "State Operations — Bihar",
      divisionsCount: brDivisions.length,
      pmsCount: brPmsCount,
      districtsCount: brDistCount,
      posCount: brPoCount,
      activeStaffCount: brStaff.length
    };

    return {
      stateLead,
      mhDivisions,
      chRoot,
      chDivisions,
      mpRoot,
      mpDivisions,
      brRoot,
      brDivisions
    };
  }

  // Pre-seed dynamic tree immediately from baseline staff
  dynamicTree = buildOperationalTree(liveEmployees);
  window.TEAM_PERFORMANCE_TREE = dynamicTree;

  // --- Live Data Loader ---

  async function fetchLiveEmployees() {
    // 1. Try StaffConnect in-app reader
    if (typeof window.olfGetEmployees === "function") {
      try {
        const emps = await window.olfGetEmployees();
        if (Array.isArray(emps) && emps.length > 0) {
          console.log("[TeamPerformance] Loaded " + emps.length + " employees via window.olfGetEmployees");
          return emps;
        }
      } catch (err) {
        console.warn("[TeamPerformance] olfGetEmployees error, falling back to REST API:", err);
      }
    }

    // 2. Try Firestore REST API directly (100% read-only)
    try {
      const resp = await fetch("https://firestore.googleapis.com/v1/projects/olf-staff-connect-b1d54/databases/(default)/documents/Employees?pageSize=300");
      if (resp.ok) {
        const json = await resp.json();
        const docs = json.documents || [];
        const parsed = docs.map(d => {
          const id = d.name.split("/").pop();
          const fields = {};
          for (const [k, v] of Object.entries(d.fields || {})) {
            fields[k] = v.stringValue ?? v.integerValue ?? v.booleanValue ?? (v.nullValue !== undefined ? null : JSON.stringify(v));
          }
          return { id, ...fields };
        });
        if (parsed.length > 0) {
          console.log("[TeamPerformance] Loaded " + parsed.length + " employees via Firestore REST API");
          return parsed;
        }
      }
    } catch (err) {
      console.warn("[TeamPerformance] Firestore REST API fetch failed, falling back to snapshot:", err);
    }

    // 3. Fallback to cached snapshot
    return CACHED_PROGRAM_STAFF;
  }

  async function initLiveData() {
    try {
      const emps = await fetchLiveEmployees();
      if (Array.isArray(emps) && emps.length) {
        liveEmployees = emps;
      }
    } catch (e) {
      console.warn("[TeamPerformance] Error in initLiveData:", e);
    }
    dynamicTree = buildOperationalTree(liveEmployees);
    window.TEAM_PERFORMANCE_TREE = dynamicTree;
  }

  // Role resolver fallback: ensures ANY employee or district role has rich scorecards & annexures
  function resolveRoleFromStaff(roleId) {
    if (!roleId) return null;

    const cleanRoleId = String(roleId).trim().toLowerCase();
    if (cleanRoleId.includes("jeetendra") || cleanRoleId.includes("olf-24-046") || cleanRoleId === "dm-cg") {
      const dmCg = (window.TEAM_PERFORMANCE_ROLES || {})["dm-cg"] || originalTemplateSnapshot["dm-cg"];
      if (dmCg) return dmCg;
    }

    const stripped = roleId.replace(/-(?:ch|mh|mp|br)-[a-z0-9_-]+$/i, "");
    const cleanStripped = stripped.toLowerCase();
    if (cleanStripped.includes("jeetendra") || cleanStripped.includes("olf-24-046") || cleanStripped === "dm-cg") {
      const dmCg = (window.TEAM_PERFORMANCE_ROLES || {})["dm-cg"] || originalTemplateSnapshot["dm-cg"];
      if (dmCg) return dmCg;
    }

    // Check by employee ID or normalized email
    const emp = (liveEmployees || []).find(e => e.id === roleId || e.id === stripped || (e.Email && (e.Email.trim().toLowerCase() === cleanRoleId || e.Email.trim().toLowerCase() === cleanStripped)));
    if (emp) {
      if (/jeetendra/i.test(emp.Name) || emp.id === "OLF-24-046") {
        const dmCg = (window.TEAM_PERFORMANCE_ROLES || {})["dm-cg"] || originalTemplateSnapshot["dm-cg"];
        if (dmCg) return dmCg;
      }
      // Look for match by first name in roles
      const nameParts = (emp.Name || "").toLowerCase().trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
      const roles = window.TEAM_PERFORMANCE_ROLES || {};

      for (const [k, v] of Object.entries(roles)) {
        const title = (v.title || "").toLowerCase();
        const person = (v.person || "").toLowerCase();
        if ((title.includes(firstName) && (lastName ? title.includes(lastName) : true)) ||
            (person.includes(firstName) && (lastName ? person.includes(lastName) : true))) {
          const matched = JSON.parse(JSON.stringify(v));
          const mgrEmail = normalizeEmail(emp["Reporting manager"] || emp["Reporting Manager"]);
          const mgr = (liveEmployees || []).find(e => normalizeEmail(e.Email) === mgrEmail);
          if (mgr && mgr.Name) {
            matched.person = `Program Manager: ${mgr.Name}`;
          }
          return matched;
        }
      }

      // Check if PO in a known district
      const dists = splitMulti(emp.District).map(tidyDistrict);
      const distName = dists[0] || "Assigned District";
      const isLead = /coo|div|pm/i.test(emp.Dept);

      if (isLead) {
        return {
          level: emp.Designation || "Program Manager",
          title: emp.Name,
          person: (emp.Dept || "Program Implementation") + " · " + (emp.Division || emp.State || "Operations"),
          hasData: true,
          role: "Lead educational program execution, stakeholder engagement, team mentorship, and operational excellence across appointed districts.",
          resp: [
            "Drive comprehensive outcome improvements across academic, life skills, and teacher community initiatives.",
            "Recruit, train, align, and support dedicated Project Officers across assigned districts.",
            "Liaise with district educational authorities, block education officers, and school heads.",
            "Monitor progress, field visit compliance, and data governance on a weekly basis."
          ],
          goals: [
            { n: "A", title: "Drive improvement in outcomes — academic, life skills & vibrant teacher community", weight: "70%", measure: "Achieve planned monthly curriculum targets and high teacher community engagement." },
            { n: "B", title: "Build and support a dedicated, mission-aligned team", weight: "10%", measure: "Ensure zero unmanaged attrition, weekly 1-on-1s, and continuous capability building." },
            { n: "C", title: "Identify and pursue partnership opportunities", weight: "10%", measure: "Coordinate with district administration and secure institutional support." },
            { n: "D", title: "Self Development & Governance", weight: "10%", measure: "Maintain 100% attendance, daily updates, and professional development." }
          ],
          priority: [
            { n: 1, goal: "Academic & Life Skills Quality", focus: "Conduct district walkthroughs and review school observation data." },
            { n: 2, goal: "Team Coaching", focus: "Conduct bi-weekly performance check-ins with all supervised POs." },
            { n: 3, goal: "Governance & Review", focus: "Ensure 100% timely submission of weekly operational trackers and monthly scorecards." }
          ],
          annexures: [
            {
              title: "Annexure A — Operational Target & Rollup",
              type: "table",
              content: "<table class='annex-table'><thead><tr><th>Domain</th><th>Target</th><th>Weight</th></tr></thead><tbody><tr><td>Academic Implementation</td><td>100% Delivery</td><td>70%</td></tr><tr><td>Team Mentorship & Visits</td><td>Weekly SOP compliance</td><td>10%</td></tr><tr><td>District Partnerships</td><td>Active Collaboration</td><td>10%</td></tr><tr><td>Governance & Compliance</td><td>100% timely reports</td><td>10%</td></tr></tbody></table>"
            }
          ]
        };
      }

      // Standard PO Role Card
      return {
        level: emp.Designation || "Project Officer",
        title: emp.Name + " — " + distName,
        person: "Reporting: " + (emp["Reporting manager"] || "Operations Lead"),
        hasData: true,
        role: "Drive improvement in outcomes across primary and secondary schools in assigned clusters and blocks.",
        resp: [
          "Execute core academic and life skills programs across assigned schools and blocks.",
          "Activate and engage teacher communities through digital platforms and recognition events.",
          "Conduct weekly field visits, school observations, and stakeholder meetings.",
          "Ensure 100% timely compliance with attendance, weekly ops, and reporting protocols."
        ],
        goals: [
          { n: "A", title: "Drive improvement in outcomes — academic, life skills & vibrant teacher community", weight: "60%", measure: "Achieve planned monthly curriculum targets and teacher community engagement." },
          { n: "B", title: "Field Visits, Compliance & Governance", weight: "20%", measure: "Complete mandatory weekly school visits and submit verified field reports." },
          { n: "C", title: "Self Development & Capacity Building", weight: "20%", measure: "Participate in OLF training workshops, assessments, and mentorship." }
        ],
        priority: [
          { n: 1, goal: "School Implementations", focus: "Complete scheduled classroom visits and support teachers with teaching learning materials." },
          { n: 2, goal: "Community Engagement", focus: "Organize cluster meetings and celebrate teacher contributions on the OLF platform." },
          { n: 3, goal: "Reporting & Visits", focus: "Submit weekly visit logs and compliance notes without delay." }
        ],
        annexures: [
          {
            title: "Annexure A — PO Scorecard & Target",
            type: "table",
            content: "<table class='annex-table'><thead><tr><th>Domain</th><th>Monthly Target</th><th>Weight</th></tr></thead><tbody><tr><td>Academic & Life Skills Delivery</td><td>100% Planned Schools</td><td>60%</td></tr><tr><td>Field Visits & School Observations</td><td>18-20 Visits / Month</td><td>20%</td></tr><tr><td>Self Development & Timely Reporting</td><td>100% Compliance</td><td>20%</td></tr></tbody></table>"
          }
        ]
      };
    }

    // Dynamic District Card fallback
    if (cleanRoleId.startsWith("d-")) {
      const distName = roleId.replace(/^d-/, "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      return {
        level: "District Operations",
        title: distName + " District Operational Card",
        person: "District",
        hasData: true,
        role: `Coordinate educational program execution, school walkthroughs, and teacher community engagement across ${distName} District.`,
        resp: [
          `Deliver academic interventions across primary and secondary schools in ${distName}.`,
          "Conduct school observations, teacher capability assessments, and monthly cluster reviews.",
          "Liaise with Block Education Officers and district education officials."
        ],
        goals: [
          { n: "A", title: "District Curriculum Delivery & Teacher Community", weight: "60%", measure: "100% target school coverage and active monthly teacher participation." },
          { n: "B", title: "Walkthroughs & Compliance", weight: "20%", measure: "Maintain verified weekly visit logs across all designated blocks." },
          { n: "C", title: "Capacity Building & Governance", weight: "20%", measure: "Timely submission of district trackers and reviews." }
        ],
        priority: [
          { n: 1, goal: "District Quality Assurance", focus: `Conduct comprehensive classroom visits across ${distName}.` },
          { n: 2, goal: "Stakeholder Engagement", focus: "Organize district level showcase and review meetings with education officers." }
        ],
        annexures: [
          {
            title: "Annexure A — District Targets",
            type: "table",
            content: `<table class='annex-table'><thead><tr><th>Domain</th><th>Target</th><th>Weight</th></tr></thead><tbody><tr><td>Academic Implementation</td><td>100% Coverage</td><td>60%</td></tr><tr><td>Field Walks</td><td>Target Block Walkthroughs</td><td>20%</td></tr><tr><td>Governance</td><td>Timely Logs</td><td>20%</td></tr></tbody></table>`
          }
        ]
      };
    }

    return null;
  }

  function getRoleData(roleId) {
    let lookupId = roleId;
    const cleanLookup = String(lookupId || "").trim().toLowerCase();
    if (cleanLookup.includes("jeetendra") || cleanLookup.includes("olf-24-046") || cleanLookup === "dm-cg") {
      lookupId = "dm-cg";
    } else if (!((window.TEAM_PERFORMANCE_ROLES || {})[lookupId]) && /-([a-z]{2}-[a-z0-9_-]+)$/i.test(lookupId)) {
      const stripped = lookupId.replace(/-([a-z]{2}-[a-z0-9_-]+)$/i, "");
      if ((window.TEAM_PERFORMANCE_ROLES || {})[stripped] || (liveEmployees || []).some(e => e.id === stripped)) {
        lookupId = stripped;
      }
    }

    let original = (window.TEAM_PERFORMANCE_ROLES || {})[lookupId] || originalTemplateSnapshot[lookupId];
    if (!original) {
      original = resolveRoleFromStaff(lookupId) || {};
    }
    const custom = customData[lookupId] || {};

    let goals = custom.goals != null ? JSON.parse(JSON.stringify(custom.goals)) : JSON.parse(JSON.stringify(original.goals || []));
    if (custom.goals && custom.goals.length > 0 && original.goals && original.goals.length > 0) {
      const hasContent = custom.goals.some(g => (g.title || g.goal || "").trim() || (g.measure || g.measures || "").trim());
      if (!hasContent) {
        goals = JSON.parse(JSON.stringify(original.goals));
      }
    }

    return {
      level: custom.level || original.level || "Role Details",
      title: custom.title || original.title || "Designation",
      person: custom.person || original.person || "",
      hasData: original.hasData !== false,
      role: custom.role != null ? custom.role : (original.role || ""),
      resp: custom.resp != null ? JSON.parse(JSON.stringify(custom.resp)) : JSON.parse(JSON.stringify(original.resp || [])),
      goals: goals,
      priority: custom.priority != null ? JSON.parse(JSON.stringify(custom.priority)) : JSON.parse(JSON.stringify(original.priority || [])),
      annexures: custom.annexures != null ? JSON.parse(JSON.stringify(custom.annexures)) : JSON.parse(JSON.stringify(original.annexures || []))
    };
  }

  function saveRoleField(roleId, fieldName, value) {
    if (!customData[roleId]) customData[roleId] = {};
    customData[roleId][fieldName] = value;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customData));
    } catch (e) {
      console.warn("[TeamPerformance] localStorage save failed:", e);
    }
  }

  function resetRoleToTemplate(roleId) {
    delete customData[roleId];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customData));
    } catch (e) {}
    if (originalTemplateSnapshot[roleId] && window.TEAM_PERFORMANCE_ROLES) {
      window.TEAM_PERFORMANCE_ROLES[roleId] = JSON.parse(JSON.stringify(originalTemplateSnapshot[roleId]));
    }
  }

  // HTML escape helper
  function esc(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderMultiline(text) {
    if (!text) return "";
    return esc(text).replace(/\n/g, "<br>");
  }

  function formatMeasureText(text) {
    if (!text) return "";
    const lines = String(text).split("\n");
    return lines.map(line => {
      let l = line.trim();
      if (!l) return "";
      let isSubBullet = false;
      let isMainBullet = false;
      if (l.startsWith(">>")) {
        isSubBullet = true;
        l = l.slice(2).trim();
      } else if (l.startsWith("~~")) {
        isMainBullet = true;
        l = l.slice(2).trim();
      }
      l = l.replace(/\uFFFD/g, "≥");
      const escaped = esc(l);
      if (isSubBullet) {
        return `<div style="padding-left: 14px; margin: 2px 0; color: #374151;">&bull; ${escaped}</div>`;
      }
      if (isMainBullet) {
        return `<div style="margin: 4px 0 2px 0; font-weight: 600; color: #1F2937;">${escaped}</div>`;
      }
      return `<div style="margin: 2px 0;">${escaped}</div>`;
    }).filter(Boolean).join("");
  }

  // --- Tree Rendering ---

  function renderDivisionPills() {
    const container = document.getElementById("tpDivisionPills");
    const bar = document.getElementById("tpDivisionBar");
    if (!container || !bar) return;

    bar.style.display = "flex";

    const tree = window.TEAM_PERFORMANCE_TREE || dynamicTree || {};

    let divisions = [];
    if (activeState === "MH") {
      divisions = tree.mhDivisions || [];
    } else if (activeState === "CH") {
      divisions = tree.chDivisions || [];
    } else if (activeState === "MP") {
      divisions = tree.mpDivisions || [];
    } else if (activeState === "BR") {
      divisions = tree.brDivisions || [];
    }

    let html = `<button type="button" class="tp-pill-btn ${expandedDivisions.size === 0 ? "active" : ""}" onclick="window.TeamPerformance.collapseAll()">Overview (All Collapsed)</button>`;
    divisions.forEach(d => {
      const isExpanded = expandedDivisions.has(d.divisionId);
      html += `<button type="button" class="tp-pill-btn ${isExpanded ? "active" : ""}" onclick="window.TeamPerformance.toggleDivision('${d.divisionId}')">${esc(d.divisionTitle.replace(/\s*Division$/i, ""))} <span class="tp-pill-badge">${isExpanded ? "Hide ▲" : "View Team ▼"}</span></button>`;
    });
    container.innerHTML = html;
  }

  function renderTree() {
    const container = document.getElementById("tpTreeContainer");
    if (!container) return;

    const tree = window.TEAM_PERFORMANCE_TREE || dynamicTree;
    if (!tree) {
      container.innerHTML = `<div class="tp-empty-msg">Hierarchy data loading...</div>`;
      return;
    }

    let html = "";
    if (activeState === "MH") {
      html = renderMaharashtraTree(tree);
    } else if (activeState === "CH") {
      html = renderChhattisgarhTree(tree);
    } else if (activeState === "MP") {
      html = renderMadhyaPradeshTree(tree);
    } else if (activeState === "BR") {
      html = renderBiharTree(tree);
    }

    container.innerHTML = html;
    updateCounts();
    scheduleConnectorUpdate();
  }

  function renderStateTreeLayout(sl, divisions, stateLabel, stateCode) {
    if (!sl) return `<div class="tp-empty-msg">${esc(stateLabel)} data not available.</div>`;

    const distTotal = sl.districtsCount != null ? sl.districtsCount : (divisions || []).reduce((a, c) => a + c.pmColumns.reduce((pa, p) => pa + p.districts.length, 0), 0);
    const poTotal = sl.posCount != null ? sl.posCount : (divisions || []).reduce((a, c) => a + c.pmColumns.reduce((pa, p) => pa + p.districts.reduce((da, d) => da + d.pos.length, 0), 0), 0);
    const pmsTotal = sl.pmsCount != null ? sl.pmsCount : (divisions || []).reduce((a, c) => a + c.pmColumns.length, 0);
    const divsTotal = sl.divisionsCount != null ? sl.divisionsCount : (divisions || []).length;

    let html = "";

    // Level 0: State Lead Node
    html += `
      <div class="tp-row tp-row-root" id="tpRowRoot">
        <div class="tp-card tp-card-root" id="node-${sl.roleId}">
          <div class="tp-card-header">
            <span class="tp-tag tp-tag-gold">${esc(stateLabel)}</span>
            <button type="button" class="tp-card-details-btn" onclick="window.TeamPerformance.openModal('${sl.roleId}', '${esc(sl.designation || sl.title || "State Lead")}', '${esc(sl.name)}')">Details &rarr;</button>
          </div>
          <div class="tp-card-name">${esc(sl.title || stateLabel)}</div>
          <div class="tp-card-sub">${sl.subtitle ? esc(sl.subtitle) : "State Operations &amp; Strategy"}</div>
          <div class="tp-card-stats">
            <div class="tp-stat-item"><strong>${divsTotal}</strong><span>${divsTotal === 1 ? "Division" : "Divisions"}</span></div>
            <div class="tp-stat-item"><strong>${pmsTotal}</strong><span>${pmsTotal === 1 ? "Prog Mgr" : "Prog Mgrs"}</span></div>
            <div class="tp-stat-item"><strong>${distTotal}</strong><span>${distTotal === 1 ? "District" : "Districts"}</span></div>
            <div class="tp-stat-item"><strong>${poTotal}</strong><span>POs</span></div>
          </div>
        </div>
      </div>
    `;

    // Level 1: Row of Division Cards
    html += `<div class="tp-divisions-row" id="tpDivisionsRow">`;
    (divisions || []).forEach(div => {
      const isExpanded = expandedDivisions.has(div.divisionId);
      const isMatched = searchQuery && (matchesQuery(div.divisionTitle, div.divisionLead) || div.pmColumns.some(pm => matchesQuery(pm.name, pm.label)));
      const distCount = div.pmColumns.reduce((a, c) => a + (c.districts?.length || 0), 0);
      const poCount = div.pmColumns.reduce((a, c) => a + c.districts.reduce((da, d) => da + (d.pos?.length || 0), 0), 0);

      const isInterim = !div.divisionLead || /interim|vacant/i.test(div.divisionLead);
      const leadDisplay = isInterim
        ? `<span style="background:#F1F5F9;color:#64748B;padding:2px 8px;border-radius:4px;font-weight:700;font-size:12px;border:1px dashed #CBD5E1;">${esc(div.divisionLead || "Interim")}</span>`
        : `<strong>${esc(div.divisionLead)}</strong>`;

      html += `
        <div class="tp-card tp-card-div ${isExpanded ? "tp-expanded-card" : ""} ${isMatched ? "tp-matched" : ""}" id="node-${div.divisionId}">
          <div class="tp-card-header">
            <span class="tp-tag tp-tag-teal">Division</span>
          </div>
          <div class="tp-card-name">${esc(div.divisionTitle)}</div>
          <div class="tp-card-meta">
            <span>${div.pmColumns.length} ${div.pmColumns.length === 1 ? "PM" : "PMs"}</span> &middot; 
            <span>${distCount} ${distCount === 1 ? "District" : "Districts"}</span> &middot; 
            <span>${poCount} POs</span>
          </div>
          <div class="tp-card-footer-actions">
            <button type="button" class="tp-toggle-team-btn ${isExpanded ? "active" : ""}" onclick="window.TeamPerformance.toggleDivision('${div.divisionId}')">
              ${isExpanded ? "▲ Hide Team" : "▼ View Team (" + div.pmColumns.length + " " + (div.pmColumns.length === 1 ? "PM" : "PMs") + ")"}
            </button>
          </div>
        </div>
      `;
    });
    html += `</div>`;

    // Level 2: Expanded Division Team Sections (Rendered beneath the division row)
    const expandedList = (divisions || []).filter(d => expandedDivisions.has(d.divisionId));
    if (expandedList.length > 0) {
      html += `<div class="tp-expanded-divisions-container">`;
      expandedList.forEach(div => {
        const isInterim = !div.divisionLead || /interim|vacant/i.test(div.divisionLead);
        const leadDisplay = isInterim
          ? `<span style="background:#F1F5F9;color:#64748B;padding:2px 8px;border-radius:4px;font-weight:700;font-size:12px;border:1px dashed #CBD5E1;">${esc(div.divisionLead || "Interim")}</span>`
          : `<strong>${esc(div.divisionLead)}</strong>`;

        html += `
          <div class="tp-division-expanded-panel" id="divpanel-${div.divisionId}">
            <div class="tp-panel-banner">
              <div class="tp-panel-banner-left">
                <span class="tp-panel-badge">Active Division</span>
                <h4 class="tp-panel-title">${esc(div.divisionTitle)} &mdash; Team Flowchart</h4>
              </div>
              <div class="tp-panel-banner-right">
                <button type="button" class="tp-btn tp-btn-sm tp-btn-secondary" onclick="window.TeamPerformance.openModal('${div.divisionRoleId}', '${esc(div.divisionRole || "Division Lead")}', '${esc(div.divisionLead)}')">Division Details &rarr;</button>
                <button type="button" class="tp-btn tp-btn-sm tp-btn-cancel" onclick="window.TeamPerformance.toggleDivision('${div.divisionId}')">&times; Close</button>
              </div>
            </div>

            <!-- PM Columns Row -->
            <div class="tp-pm-row">
              ${div.pmColumns.map(pm => renderPMColumn(pm)).join("")}
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

    return html;
  }

  function renderMaharashtraTree(tree) {
    const sl = tree.stateLead || {
      roleId: "statelead",
      name: "Vishvajit G Pawar",
      title: "State Lead — Maharashtra",
      subtitle: "State Operations & Strategy",
      divisionsCount: 5,
      pmsCount: 16,
      districtsCount: 42,
      posCount: 57,
      activeStaffCount: 74
    };
    return renderStateTreeLayout(sl, tree.mhDivisions || [], "State Lead · Maharashtra", "MH");
  }

  function renderChhattisgarhTree(tree) {
    const sl = tree.chRoot || {
      roleId: "dm-cg",
      name: "Jeetendra Singh",
      designation: "Division Manager",
      title: "State Lead — Chhattisgarh",
      divisionsCount: 5,
      pmsCount: 10,
      districtsCount: 16,
      posCount: 24,
      activeStaffCount: 29
    };
    return renderStateTreeLayout(sl, tree.chDivisions || [], "State Lead · Chhattisgarh", "CH");
  }

  function renderMadhyaPradeshTree(tree) {
    const sl = tree.mpRoot || {
      roleId: "pm-v2",
      name: "Abhijeet L Vaidhay",
      designation: "Program Manager / Interim",
      title: "State Operations — Madhya Pradesh",
      divisionsCount: 1,
      pmsCount: 1,
      districtsCount: 2,
      posCount: 4,
      activeStaffCount: 5
    };
    return renderStateTreeLayout(sl, tree.mpDivisions || [], "State Operations · Madhya Pradesh", "MP");
  }

  function renderBiharTree(tree) {
    const sl = tree.brRoot || {
      roleId: "dm-pune",
      name: "Manoj C Girase",
      designation: "Associate Division Manager / Interim",
      title: "State Operations — Bihar",
      divisionsCount: 1,
      pmsCount: 1,
      districtsCount: 1,
      posCount: 4,
      activeStaffCount: 4
    };
    return renderStateTreeLayout(sl, tree.brDivisions || [], "State Operations · Bihar", "BR");
  }

  function renderPMColumn(pm) {
    const isMatched = searchQuery && matchesQuery(pm.name, pm.label, pm.pmId);
    return `
      <div class="tp-pm-col ${isMatched ? "tp-matched" : ""}">
        <div class="tp-card tp-card-pm" id="node-${pm.pmId}">
          <div class="tp-card-header">
            <span class="tp-tag tp-tag-blue">${esc(pm.label)}</span>
            <button type="button" class="tp-card-details-btn" onclick="window.TeamPerformance.openModal('${pm.roleId || pm.pmId}', '${esc(pm.label)}', '${esc(pm.name)}')">Details &rarr;</button>
          </div>
          <div class="tp-card-name">${esc(pm.name)}</div>
          <div class="tp-card-sub">${pm.districts.length} Districts Assigned</div>
          ${pm.badge ? `<div class="tp-badge-sm-tag">${esc(pm.badge)}</div>` : ""}
        </div>

        <div class="tp-districts-list">
          ${pm.districts.map(dst => renderDistrictCard(dst)).join("")}
        </div>
      </div>
    `;
  }

  function renderDistrictCard(dst) {
    const isMatched = searchQuery && (matchesQuery(dst.name, dst.roleId) || dst.pos.some(p => matchesQuery(p.name, p.roleId)));
    return `
      <div class="tp-district-card ${isMatched ? "tp-matched" : ""}" id="node-${dst.cardId}">
        <div class="tp-district-header">
          <div class="tp-dist-pip"></div>
          <span class="tp-dist-title">${esc(dst.name)}</span>
          <button type="button" class="tp-row-details-btn" onclick="window.TeamPerformance.openModal('${dst.roleId}', 'District', '${esc(dst.name)}')">Details &rarr;</button>
        </div>
        <div class="tp-pos-list">
          ${dst.pos.map(po => `
            <div class="tp-po-row ${searchQuery && matchesQuery(po.name, po.roleId) ? "tp-matched-row" : ""}">
              <span class="tp-po-dot"></span>
              <span class="tp-po-name">${esc(po.name)}</span>
              <button type="button" class="tp-row-details-btn" onclick="window.TeamPerformance.openModal('${po.roleId}', 'Project Officer', '${esc(po.name)}')">Details &rarr;</button>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function matchesQuery(...terms) {
    if (!searchQuery) return false;
    const q = searchQuery.toLowerCase();
    return terms.some(t => t && String(t).toLowerCase().includes(q));
  }

  function updateCounts() {
    const badge = document.getElementById("tpTotalCountBadge");
    if (!badge) return;

    const tree = window.TEAM_PERFORMANCE_TREE || dynamicTree;
    if (!tree) return;

    if (activeState === "MH") {
      const sl = tree.stateLead;
      const activeDivName = (tree.mhDivisions || []).find(d => expandedDivisions.has(d.divisionId))?.divisionTitle;
      const expStatus = activeDivName ? `${activeDivName} Active` : "All Collapsed";
      badge.textContent = `Maharashtra · 5 Divisions (${expStatus}) · ${sl ? sl.pmsCount : 16} PMs · ${sl ? sl.districtsCount : 42} Districts · ${sl ? sl.posCount : 57} POs (${sl ? sl.activeStaffCount : 74} Staff)`;
    } else if (activeState === "CH") {
      const sl = tree.chRoot;
      const activeDivName = (tree.chDivisions || []).find(d => expandedDivisions.has(d.divisionId))?.divisionTitle;
      const expStatus = activeDivName ? `${activeDivName} Active` : "All Collapsed";
      badge.textContent = `Chhattisgarh · ${sl ? sl.divisionsCount : 5} Divisions (${expStatus}) · ${sl ? sl.pmsCount : 10} PM Tracks · ${sl ? sl.districtsCount : 16} Districts · ${sl ? sl.posCount : 24} POs (${sl ? sl.activeStaffCount : 29} Staff)`;
    } else if (activeState === "MP") {
      const sl = tree.mpRoot;
      const activeDivName = (tree.mpDivisions || []).find(d => expandedDivisions.has(d.divisionId))?.divisionTitle;
      const expStatus = activeDivName ? `${activeDivName} Active` : "All Collapsed";
      badge.textContent = `Madhya Pradesh · ${sl ? sl.divisionsCount : 1} Division (${expStatus}) · ${sl ? sl.pmsCount : 1} PM Track · ${sl ? sl.districtsCount : 2} Districts · ${sl ? sl.posCount : 4} POs (${sl ? sl.activeStaffCount : 5} Staff)`;
    } else if (activeState === "BR") {
      const sl = tree.brRoot;
      const activeDivName = (tree.brDivisions || []).find(d => expandedDivisions.has(d.divisionId))?.divisionTitle;
      const expStatus = activeDivName ? `${activeDivName} Active` : "All Collapsed";
      badge.textContent = `Bihar · ${sl ? sl.divisionsCount : 1} Division (${expStatus}) · ${sl ? sl.pmsCount : 1} Track · ${sl ? sl.districtsCount : 1} District · ${sl ? sl.posCount : 4} POs (${sl ? sl.activeStaffCount : 4} Staff)`;
    }
  }

  function toggleDivision(divId) {
    const willOpen = !expandedDivisions.has(divId);
    if (expandedDivisions.has(divId)) {
      expandedDivisions.delete(divId);
    } else {
      expandedDivisions.clear();
      expandedDivisions.add(divId);
    }
    renderDivisionPills();
    renderTree();
    if (willOpen) {
      setTimeout(() => {
        const panel = document.getElementById("divpanel-" + divId);
        if (panel) {
          panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }, 60);
    }
  }

  function expandAll() {
    const tree = window.TEAM_PERFORMANCE_TREE || dynamicTree || {};
    if (activeState === "MH") {
      (tree.mhDivisions || []).forEach(d => expandedDivisions.add(d.divisionId));
    } else if (activeState === "CH") {
      (tree.chDivisions || []).forEach(d => expandedDivisions.add(d.divisionId));
    } else if (activeState === "MP") {
      (tree.mpDivisions || []).forEach(d => expandedDivisions.add(d.divisionId));
    } else if (activeState === "BR") {
      (tree.brDivisions || []).forEach(d => expandedDivisions.add(d.divisionId));
    }
    renderDivisionPills();
    renderTree();
  }

  function collapseAll() {
    expandedDivisions.clear();
    renderDivisionPills();
    renderTree();
  }

  // --- SVG Connectors ---
  let connectorRaf = null;
  function scheduleConnectorUpdate() {
    if (connectorRaf) cancelAnimationFrame(connectorRaf);
    connectorRaf = requestAnimationFrame(() => {
      drawConnectors();
    });
    setTimeout(drawConnectors, 40);
    setTimeout(drawConnectors, 180);
  }

  function drawConnectors() {
    const svg = document.getElementById("tpSvg");
    const container = document.getElementById("tpCanvas");
    const treeContainer = document.getElementById("tpTreeContainer");
    if (!svg || !container || !treeContainer) return;

    // Sizing SVG precisely to canvas scroll bounds
    const width = Math.max(container.scrollWidth, treeContainer.scrollWidth);
    const height = Math.max(container.scrollHeight, treeContainer.scrollHeight);
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.style.width = width + "px";
    svg.style.height = height + "px";

    const cRect = container.getBoundingClientRect();
    const rootCard = document.querySelector(".tp-card-root");
    const divCards = document.querySelectorAll(".tp-divisions-row .tp-card-div");

    if (!rootCard || !divCards.length) {
      svg.innerHTML = "";
      return;
    }

    const rBox = rootCard.getBoundingClientRect();
    const rX = Math.round(rBox.left - cRect.left + rBox.width / 2);
    const rY = Math.round(rBox.bottom - cRect.top);

    const divPoints = [];
    divCards.forEach(dCard => {
      const dBox = dCard.getBoundingClientRect();
      if (dBox.width > 0 && dBox.height > 0) {
        const dX = Math.round(dBox.left - cRect.left + dBox.width / 2);
        const dY = Math.round(dBox.top - cRect.top);
        divPoints.push({ dX, dY, id: dCard.id, el: dCard });
      }
    });

    if (!divPoints.length) {
      svg.innerHTML = "";
      return;
    }

    // Bus level (halfway between root bottom and nearest division top)
    const minDivY = Math.min(...divPoints.map(p => p.dY));
    const busY = Math.round(rY + Math.max(16, (minDivY - rY) * 0.52));

    let paths = "";

    // 1. Root pip at bottom of State Lead card
    paths += `<circle cx="${rX}" cy="${rY}" r="4" class="tp-connector-root-pip"/>`;

    // 2. Trunk stem from State Lead down to bus level
    paths += `<line x1="${rX}" y1="${rY}" x2="${rX}" y2="${busY}" class="tp-connector-trunk"/>`;

    // 3. Central junction hub
    paths += `<circle cx="${rX}" cy="${busY}" r="5" class="tp-connector-hub"/>`;

    // 4. Step-orthogonal branch to each division card
    divPoints.forEach(pt => {
      paths += `
        <g class="tp-connector-group" id="conn-${pt.id}">
          <path class="tp-connector-branch" id="branch-${pt.id}"
                d="M ${rX} ${busY} L ${pt.dX} ${busY} L ${pt.dX} ${pt.dY}"
                fill="none"/>
          <circle cx="${pt.dX}" cy="${pt.dY}" r="3.5" class="tp-connector-anchor" id="anchor-${pt.id}"/>
        </g>
      `;
    });

    svg.innerHTML = paths;

    // Attach hover effects between cards and connectors
    divPoints.forEach(pt => {
      pt.el.onmouseenter = () => {
        const br = document.getElementById(`branch-${pt.id}`);
        const an = document.getElementById(`anchor-${pt.id}`);
        if (br) br.classList.add("highlighted");
        if (an) an.classList.add("highlighted");
      };
      pt.el.onmouseleave = () => {
        const br = document.getElementById(`branch-${pt.id}`);
        const an = document.getElementById(`anchor-${pt.id}`);
        if (br) br.classList.remove("highlighted");
        if (an) an.classList.remove("highlighted");
      };
    });

    rootCard.onmouseenter = () => {
      document.querySelectorAll(".tp-connector-branch").forEach(b => b.classList.add("highlighted"));
      document.querySelectorAll(".tp-connector-anchor").forEach(a => a.classList.add("highlighted"));
    };
    rootCard.onmouseleave = () => {
      document.querySelectorAll(".tp-connector-branch").forEach(b => b.classList.remove("highlighted"));
      document.querySelectorAll(".tp-connector-anchor").forEach(a => a.classList.remove("highlighted"));
    };
  }

  // --- Modal & Multi-Tab Editor Logic ---

  function openModal(roleId, fallbackLevel, fallbackPerson) {
    let resolvedId = roleId;
    const cleanId = String(resolvedId || "").trim().toLowerCase();
    const isJeetendra = cleanId.includes("jeetendra") || cleanId.includes("olf-24-046") || cleanId === "dm-cg";
    if (isJeetendra) {
      resolvedId = "dm-cg";
    }

    currentModalRoleId = resolvedId;
    activeModalTab = "goals";
    tabEditStates = { goals: false, role: false, priority: false, annexures: false };

    const modal = document.getElementById("tpModal");
    if (!modal) return;

    const roleData = getRoleData(resolvedId);

    document.getElementById("tpModalLevel").textContent = roleData.level || fallbackLevel || "Role";
    document.getElementById("tpModalTitle").textContent = roleData.title || fallbackLevel || "Designation";
    let personText = roleData.person || fallbackPerson || "Staff Member";
    if (resolvedId === "statelead") {
      personText = "Maharashtra State Operations · 24 districts";
    }
    if (isJeetendra) {
      personText = "Jeetendra Singh";
    } else {
      const cleanRoleId = String(resolvedId || "").trim().toLowerCase();
      if (cleanRoleId.startsWith("d-") || (roleData && roleData.level === "District") || fallbackLevel === "District") {
        personText = "District";
      }
      if ((cleanRoleId.startsWith("dm-") && cleanRoleId !== "dm-cg") || cleanRoleId.includes("division") || fallbackLevel === "Division Lead" || fallbackLevel === "Division" || fallbackLevel === "Division Operations") {
        personText = "Division Operations";
      }
    }
    document.getElementById("tpModalPerson").textContent = personText;

    renderAllModalTabs(resolvedId);
    switchTab("goals");
    updateModalEditControlsVisibility();

    modal.classList.add("open");
  }

  function toggleModalMaximize() {
    isModalMaximized = !isModalMaximized;
    const dialog = document.querySelector("#tpModal .tp-modal-dialog");
    const btn = document.getElementById("tpModalMaxBtn");
    if (dialog) {
      dialog.classList.toggle("maximized", isModalMaximized);
    }
    if (btn) {
      btn.innerHTML = isModalMaximized ? "◗" : "⛶";
      btn.title = isModalMaximized ? "Restore default size" : "Maximize / Fullscreen";
      btn.setAttribute("aria-label", isModalMaximized ? "Restore default size" : "Maximize / Fullscreen");
    }
  }

  function closeModal() {
    const modal = document.getElementById("tpModal");
    if (modal) modal.classList.remove("open");
    const dialog = document.querySelector("#tpModal .tp-modal-dialog");
    if (dialog) dialog.classList.remove("maximized");
    isModalMaximized = false;
    const btn = document.getElementById("tpModalMaxBtn");
    if (btn) {
      btn.innerHTML = "⛶";
      btn.title = "Maximize / Fullscreen";
    }
    currentModalRoleId = null;
    tabEditStates = { goals: false, role: false, priority: false, annexures: false };
  }

  function switchTab(tabKey) {
    activeModalTab = tabKey;
    const tabs = ["goals", "role", "priority", "annexures"];
    tabs.forEach(t => {
      const btn = document.getElementById(`tpTabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
      const pane = document.getElementById(`tpTabPane${t.charAt(0).toUpperCase() + t.slice(1)}`);
      if (btn) btn.classList.toggle("active", t === tabKey);
      if (pane) pane.classList.toggle("active", t === tabKey);
    });
    const tabsBar = document.querySelector("#tpModal .tp-modal-tabs");
    if (tabsBar) tabsBar.scrollLeft = 0;
  }

  function renderAllModalTabs(roleId) {
    renderGoalsTab(roleId);
    renderRoleTab(roleId);
    renderPriorityTab(roleId);
    renderAnnexuresTab(roleId);
  }

  // 1. Goals Tab
  function renderGoalsTab(roleId) {
    const roleData = getRoleData(roleId);
    const goals = roleData.goals || [];

    document.getElementById("tpGoalsCountText").textContent = `${goals.length} Goals`;
    const totalWeight = goals.reduce((acc, g) => acc + (parseFloat(g.weight) || 0), 0);
    document.getElementById("tpGoalsWeightText").textContent = `${totalWeight}%`;

    const tbody = document.getElementById("tpGoalsTableBody");
    if (!goals.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="tp-empty-table-cell">No goals recorded yet. Click <strong>✎ Edit Goals</strong> to add scorecards.</td></tr>`;
    } else {
      tbody.innerHTML = goals.map((g, idx) => {
        const num = g.n || g.num || (idx + 1);
        const title = g.title || g.goal || `Goal ${idx + 1}`;
        const measure = g.measure || g.measures || "";
        const weightVal = parseFloat(g.weight) || 0;
        return `
          <tr>
            <td style="text-align: center; font-weight: 700; color: #4F8EF7;">${esc(num)}</td>
            <td><strong style="display:block;white-space:normal;word-break:break-word;">${esc(title)}</strong></td>
            <td class="tp-measures-cell">${formatMeasureText(measure)}</td>
            <td style="text-align: right; font-weight: 700; color: #0D9488; white-space: nowrap !important;">${weightVal}%</td>
          </tr>
        `;
      }).join("");
    }
  }

  function toggleEditGoals(isEdit) {
    if (isEdit && !canEditUser) {
      toast("View-only access: Contact an IT Administrator to request edit permissions.", "error");
      return;
    }
    tabEditStates.goals = isEdit;
    document.getElementById("tpGoalsViewContainer").style.display = isEdit ? "none" : "block";
    document.getElementById("tpGoalsEditContainer").style.display = isEdit ? "block" : "none";
    document.getElementById("tpEditGoalsBtn").style.display = isEdit ? "none" : (canEditUser ? "inline-flex" : "none");
    document.getElementById("tpEditGoalsControls").style.display = isEdit ? "flex" : "none";

    if (isEdit) {
      const goals = getRoleData(currentModalRoleId).goals || [];
      const listEl = document.getElementById("tpGoalsEditList");
      listEl.innerHTML = goals.map((g, idx) => {
        const numLabel = g.n || g.num || (idx + 1);
        const title = g.title || g.goal || "";
        const measure = g.measure || g.measures || "";
        const weightVal = parseFloat(g.weight) || 0;
        return `
          <div class="tp-goal-edit-card" data-idx="${idx}">
            <div class="tp-goal-edit-header">
              <span class="tp-goal-idx-badge">Goal #${numLabel}</span>
              <div class="tp-goal-weight-input-wrap">
                <label>Weight %</label>
                <input type="number" class="tp-input tp-input-weight" value="${weightVal}" min="0" max="100" oninput="window.TeamPerformance.recalcLiveWeight()">
              </div>
              <button type="button" class="tp-btn-icon-del" onclick="window.TeamPerformance.deleteGoalRow(${idx})" title="Delete Goal">&times;</button>
            </div>
            <div class="tp-form-group">
              <label>Goal Objective</label>
              <input type="text" class="tp-input tp-input-goal" value="${esc(title)}" placeholder="Enter specific goal objective...">
            </div>
            <div class="tp-form-group">
              <label>Measures & Key Deliverables</label>
              <textarea class="tp-textarea tp-input-measures" rows="3" placeholder="Itemize key performance indicators...">${esc(measure)}</textarea>
            </div>
          </div>
        `;
      }).join("") || `<div class="tp-empty-msg">No goals in this scorecard. Click <strong>+ Add Goal</strong> to create one.</div>`;
      recalcLiveWeight();
    } else {
      renderGoalsTab(currentModalRoleId);
    }
  }

  function addNewGoalRow() {
    const listEl = document.getElementById("tpGoalsEditList");
    const count = listEl.querySelectorAll(".tp-goal-edit-card").length;
    const div = document.createElement("div");
    div.className = "tp-goal-edit-card";
    div.dataset.idx = count;
    div.innerHTML = `
      <div class="tp-goal-edit-header">
        <span class="tp-goal-idx-badge">Goal #${count + 1}</span>
        <div class="tp-goal-weight-input-wrap">
          <label>Weight %</label>
          <input type="number" class="tp-input tp-input-weight" value="20" min="0" max="100" oninput="window.TeamPerformance.recalcLiveWeight()">
        </div>
        <button type="button" class="tp-btn-icon-del" onclick="window.TeamPerformance.deleteGoalRow(${count})" title="Delete Goal">&times;</button>
      </div>
      <div class="tp-form-group">
        <label>Goal Objective</label>
        <input type="text" class="tp-input tp-input-goal" value="" placeholder="Enter specific goal objective...">
      </div>
      <div class="tp-form-group">
        <label>Measures & Key Deliverables</label>
        <textarea class="tp-textarea tp-input-measures" rows="3" placeholder="Itemize key performance indicators..."></textarea>
      </div>
    `;
    listEl.appendChild(div);
    recalcLiveWeight();
  }

  function deleteGoalRow(idx) {
    const listEl = document.getElementById("tpGoalsEditList");
    const cards = listEl.querySelectorAll(".tp-goal-edit-card");
    if (cards[idx]) {
      cards[idx].remove();
      listEl.querySelectorAll(".tp-goal-edit-card").forEach((card, i) => {
        card.dataset.idx = i;
        card.querySelector(".tp-goal-idx-badge").textContent = `Goal #${i + 1}`;
        card.querySelector(".tp-btn-icon-del").setAttribute("onclick", `window.TeamPerformance.deleteGoalRow(${i})`);
      });
      recalcLiveWeight();
    }
  }

  function recalcLiveWeight() {
    const listEl = document.getElementById("tpGoalsEditList");
    if (!listEl) return;
    let total = 0;
    listEl.querySelectorAll(".tp-input-weight").forEach(inp => total += parseFloat(inp.value) || 0);
    const totalEl = document.getElementById("tpLiveWeightTotal");
    const warnEl = document.getElementById("tpLiveWeightWarning");
    if (totalEl) totalEl.textContent = `${total}%`;
    if (warnEl) {
      if (Math.abs(total - 100) > 0.01) {
        warnEl.style.display = "inline";
        warnEl.textContent = `(Warning: Total is ${total}%, standard is 100%)`;
      } else {
        warnEl.style.display = "none";
      }
    }
  }

  function saveGoals() {
    if (!canEditUser) {
      toast("Permission denied: You do not have edit access.", "error");
      return;
    }
    if (!currentModalRoleId) return;
    const listEl = document.getElementById("tpGoalsEditList");
    const updated = [];
    listEl.querySelectorAll(".tp-goal-edit-card").forEach((card, i) => {
      const goal = card.querySelector(".tp-input-goal").value.trim();
      const measures = card.querySelector(".tp-input-measures").value.trim();
      const weightVal = parseFloat(card.querySelector(".tp-input-weight").value) || 0;
      if (goal || measures) {
        updated.push({
          n: String(i + 1),
          num: i + 1,
          title: goal,
          goal: goal,
          measure: measures,
          measures: measures,
          weight: `${weightVal}%`
        });
      }
    });
    saveRoleField(currentModalRoleId, "goals", updated);
    toggleEditGoals(false);
    toast("Goals & Measures saved successfully!");
  }

  // 2. Role & Responsibilities Tab
  function renderRoleTab(roleId) {
    const roleData = getRoleData(roleId);
    const viewContainer = document.getElementById("tpRoleViewContainer");
    let html = "";

    if (roleData.role) {
      html += `<div class="tp-role-overview-card"><div class="tp-role-card-label">Primary Role</div><p>${esc(roleData.role)}</p></div>`;
    }
    if (roleData.resp && roleData.resp.length) {
      html += `
        <div class="tp-resp-block">
          <div class="tp-role-card-label">Key Responsibilities (${roleData.resp.length})</div>
          <table class="tp-table tp-table-clean">
            <colgroup>
              <col style="width: 44px;">
              <col style="width: auto;">
            </colgroup>
            <tbody>
              ${roleData.resp.map((r, i) => `<tr><td style="width:44px;font-weight:700;color:#64748B;text-align:center;">${i + 1}</td><td>${esc(r)}</td></tr>`).join("")}
            </tbody>
          </table>
        </div>
      `;
    }
    if (!html) {
      html = `<div class="tp-empty-msg">No responsibilities recorded. Click <strong>✎ Edit Role</strong> to add items.</div>`;
    }
    viewContainer.innerHTML = html;
  }

  function toggleEditRole(isEdit) {
    if (isEdit && !canEditUser) {
      toast("View-only access: Contact an IT Administrator to request edit permissions.", "error");
      return;
    }
    tabEditStates.role = isEdit;
    document.getElementById("tpRoleViewContainer").style.display = isEdit ? "none" : "block";
    document.getElementById("tpRoleEditContainer").style.display = isEdit ? "block" : "none";
    document.getElementById("tpEditRoleBtn").style.display = isEdit ? "none" : (canEditUser ? "inline-flex" : "none");
    document.getElementById("tpEditRoleControls").style.display = isEdit ? "flex" : "none";

    if (isEdit) {
      const roleData = getRoleData(currentModalRoleId);
      document.getElementById("tpInputRoleOverview").value = roleData.role || "";
      const respListEl = document.getElementById("tpRespEditList");
      respListEl.innerHTML = (roleData.resp || []).map((r, idx) => `
        <div class="tp-edit-row" data-idx="${idx}">
          <span class="tp-row-idx">#${idx + 1}</span>
          <textarea class="tp-textarea tp-resp-item" rows="2" placeholder="Responsibility item...">${esc(r)}</textarea>
          <button type="button" class="tp-btn-icon-del" onclick="this.parentElement.remove()" title="Delete">&times;</button>
        </div>
      `).join("");
    } else {
      renderRoleTab(currentModalRoleId);
    }
  }

  function addNewRespRow() {
    const listEl = document.getElementById("tpRespEditList");
    const count = listEl.querySelectorAll(".tp-edit-row").length;
    const div = document.createElement("div");
    div.className = "tp-edit-row";
    div.dataset.idx = count;
    div.innerHTML = `
      <span class="tp-row-idx">#${count + 1}</span>
      <textarea class="tp-textarea tp-resp-item" rows="2" placeholder="Enter new responsibility item..."></textarea>
      <button type="button" class="tp-btn-icon-del" onclick="this.parentElement.remove()" title="Delete">&times;</button>
    `;
    listEl.appendChild(div);
  }

  function saveRole() {
    if (!canEditUser) {
      toast("Permission denied: You do not have edit access.", "error");
      return;
    }
    if (!currentModalRoleId) return;
    const overview = document.getElementById("tpInputRoleOverview").value.trim();
    const respItems = [];
    document.querySelectorAll("#tpRespEditList .tp-resp-item").forEach(t => {
      const v = t.value.trim();
      if (v) respItems.push(v);
    });
    saveRoleField(currentModalRoleId, "role", overview);
    saveRoleField(currentModalRoleId, "resp", respItems);
    toggleEditRole(false);
    toast("Role & Responsibilities saved successfully!");
  }

  // 3. 3 Months Priority Tab
  function renderPriorityTab(roleId) {
    const roleData = getRoleData(roleId);
    const priorities = roleData.priority || [];
    const viewContainer = document.getElementById("tpPriorityViewContainer");

    if (!priorities.length) {
      viewContainer.innerHTML = `<div class="tp-empty-msg">No 3-month priority items set. Click <strong>✎ Edit Priority</strong> to add.</div>`;
      return;
    }

    let html = `
      <table class="tp-table">
        <thead>
          <tr>
            <th style="width: 44px; text-align: center;">#</th>
            <th style="width: 30%;">Strategic Goal</th>
            <th style="width: auto;">Priority Focus & Key Actions</th>
          </tr>
        </thead>
        <tbody>
          ${priorities.map((p, idx) => {
            const num = (p && typeof p === "object" && p.n) ? p.n : (idx + 1);
            const goal = (p && typeof p === "object") ? (p.goal || "") : String(p);
            const focus = (p && typeof p === "object") ? (p.focus || "") : "";
            return `
              <tr>
                <td style="text-align: center; font-weight: 700; color: #D97706;">${num}</td>
                <td><strong style="display:block;white-space:normal;word-break:break-word;">${esc(goal)}</strong></td>
                <td class="tp-measures-cell">${renderMultiline(focus)}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;

    viewContainer.innerHTML = html;
  }

  function toggleEditPriority(isEdit) {
    if (isEdit && !canEditUser) {
      toast("View-only access: Contact an IT Administrator to request edit permissions.", "error");
      return;
    }
    tabEditStates.priority = isEdit;
    document.getElementById("tpPriorityViewContainer").style.display = isEdit ? "none" : "block";
    document.getElementById("tpPriorityEditContainer").style.display = isEdit ? "block" : "none";
    document.getElementById("tpEditPriorityBtn").style.display = isEdit ? "none" : (canEditUser ? "inline-flex" : "none");
    document.getElementById("tpEditPriorityControls").style.display = isEdit ? "flex" : "none";

    if (isEdit) {
      const priorities = getRoleData(currentModalRoleId).priority || [];
      const listEl = document.getElementById("tpPriorityEditList");
      listEl.innerHTML = priorities.map((p, idx) => {
        const goal = (p && typeof p === "object") ? (p.goal || "") : String(p);
        const focus = (p && typeof p === "object") ? (p.focus || "") : "";
        return `
          <div class="tp-priority-edit-card" data-idx="${idx}">
            <div class="tp-goal-edit-header">
              <span class="tp-priority-idx-badge">Priority #${idx + 1}</span>
              <button type="button" class="tp-btn-icon-del" onclick="this.closest('.tp-priority-edit-card').remove()" title="Delete">&times;</button>
            </div>
            <div class="tp-form-group">
              <label>Goal / Objective</label>
              <input type="text" class="tp-input tp-priority-goal" value="${esc(goal)}" placeholder="Enter strategic priority goal...">
            </div>
            <div class="tp-form-group">
              <label>Focus Description &amp; Actions</label>
              <textarea class="tp-textarea tp-priority-focus" rows="3" placeholder="Describe specific actions, milestones, and deliverables...">${esc(focus)}</textarea>
            </div>
          </div>
        `;
      }).join("") || `<div class="tp-empty-msg">No priorities defined. Click <strong>+ Add Priority Item</strong> below.</div>`;
    } else {
      renderPriorityTab(currentModalRoleId);
    }
  }

  function addNewPriorityRow() {
    const listEl = document.getElementById("tpPriorityEditList");
    const count = listEl.querySelectorAll(".tp-priority-edit-card").length;
    const div = document.createElement("div");
    div.className = "tp-priority-edit-card";
    div.dataset.idx = count;
    div.innerHTML = `
      <div class="tp-goal-edit-header">
        <span class="tp-priority-idx-badge">Priority #${count + 1}</span>
        <button type="button" class="tp-btn-icon-del" onclick="this.closest('.tp-priority-edit-card').remove()" title="Delete">&times;</button>
      </div>
      <div class="tp-form-group">
        <label>Goal / Objective</label>
        <input type="text" class="tp-input tp-priority-goal" value="" placeholder="Enter strategic priority goal...">
      </div>
      <div class="tp-form-group">
        <label>Focus Description &amp; Actions</label>
        <textarea class="tp-textarea tp-priority-focus" rows="3" placeholder="Describe specific actions, milestones, and deliverables..."></textarea>
      </div>
    `;
    listEl.appendChild(div);
  }

  function savePriority() {
    if (!canEditUser) {
      toast("Permission denied: You do not have edit access.", "error");
      return;
    }
    if (!currentModalRoleId) return;
    const updated = [];
    document.querySelectorAll("#tpPriorityEditList .tp-priority-edit-card").forEach((card, i) => {
      const goal = card.querySelector(".tp-priority-goal").value.trim();
      const focus = card.querySelector(".tp-priority-focus").value.trim();
      if (goal || focus) {
        updated.push({ n: i + 1, goal: goal || `Priority ${i + 1}`, focus });
      }
    });
    saveRoleField(currentModalRoleId, "priority", updated);
    toggleEditPriority(false);
    toast("3 Months Priority saved successfully!");
  }

  // 4. Annexures Tab (Visual Table & Spreadsheet Editor)
  function renderAnnexuresTab(roleId) {
    const roleData = getRoleData(roleId);
    const annexures = roleData.annexures || [];
    const viewContainer = document.getElementById("tpAnnexuresViewContainer");

    if (!annexures.length) {
      viewContainer.innerHTML = `<div class="tp-empty-msg">No annexures available for this role. Click <strong>✎ Edit Annexures</strong> to attach data.</div>`;
      return;
    }

    let html = `<div class="tp-annexures-list">`;
    annexures.forEach((ann, idx) => {
      const title = (ann && typeof ann === "object") ? (ann.title || `Annexure ${idx + 1}`) : `Annexure ${idx + 1}`;
      const content = (ann && typeof ann === "object") ? (ann.content || "") : String(ann);

      html += `
        <div class="tp-annexure-card open">
          <div class="tp-annexure-header" onclick="this.parentElement.classList.toggle('open')">
            <span class="tp-annexure-title">${esc(title)}</span>
            <span class="tp-annexure-chevron">&#9660;</span>
          </div>
          <div class="tp-annexure-body">
            ${content}
          </div>
        </div>
      `;
    });
    html += `</div>`;

    viewContainer.innerHTML = html;
  }

  function prepareVisualEditorHtml(rawContent) {
    if (!rawContent || !rawContent.trim()) {
      return `
        <div class="tp-table-editor-wrapper">
          <table class="annex-table tp-editable-annex-table">
            <thead>
              <tr>
                <th class="tp-editable-cell" contenteditable="true">#</th>
                <th class="tp-editable-cell" contenteditable="true">Item / Category</th>
                <th class="tp-editable-cell center" contenteditable="true">Achieved</th>
                <th class="tp-editable-cell center" contenteditable="true">Target</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="tp-editable-cell" contenteditable="true">1</td>
                <td class="tp-editable-cell" contenteditable="true">Category A</td>
                <td class="tp-editable-cell center" contenteditable="true">10</td>
                <td class="tp-editable-cell center" contenteditable="true">20</td>
              </tr>
              <tr>
                <td class="tp-editable-cell" contenteditable="true">2</td>
                <td class="tp-editable-cell" contenteditable="true">Category B</td>
                <td class="tp-editable-cell center" contenteditable="true">15</td>
                <td class="tp-editable-cell center" contenteditable="true">25</td>
              </tr>
            </tbody>
          </table>
          <div class="tp-table-toolbar">
            <span class="tp-tbl-tool-label">Table Controls:</span>
            <button type="button" class="tp-table-btn" onclick="window.TeamPerformance.tableAddRow(this)">+ Add Row</button>
            <button type="button" class="tp-table-btn" onclick="window.TeamPerformance.tableAddCol(this)">+ Add Column</button>
            <button type="button" class="tp-table-btn tp-table-btn-danger" onclick="window.TeamPerformance.tableDelRow(this)">&minus; Remove Row</button>
            <button type="button" class="tp-table-btn tp-table-btn-danger" onclick="window.TeamPerformance.tableDelCol(this)">&minus; Remove Column</button>
          </div>
        </div>
        <p class="annex-note tp-editable-text" contenteditable="true">Click here to write notes or guidelines...</p>
      `;
    }

    const temp = document.createElement("div");
    temp.innerHTML = rawContent;

    const tables = temp.querySelectorAll("table");
    tables.forEach(table => {
      table.classList.add("tp-editable-annex-table");
      table.querySelectorAll("th, td").forEach(cell => {
        cell.setAttribute("contenteditable", "true");
        cell.classList.add("tp-editable-cell");
      });

      const wrapper = document.createElement("div");
      wrapper.className = "tp-table-editor-wrapper";
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);

      const toolbar = document.createElement("div");
      toolbar.className = "tp-table-toolbar";
      toolbar.innerHTML = `
        <span class="tp-tbl-tool-label">Table Controls:</span>
        <button type="button" class="tp-table-btn" onclick="window.TeamPerformance.tableAddRow(this)">+ Add Row</button>
        <button type="button" class="tp-table-btn" onclick="window.TeamPerformance.tableAddCol(this)">+ Add Column</button>
        <button type="button" class="tp-table-btn tp-table-btn-danger" onclick="window.TeamPerformance.tableDelRow(this)">&minus; Remove Row</button>
        <button type="button" class="tp-table-btn tp-table-btn-danger" onclick="window.TeamPerformance.tableDelCol(this)">&minus; Remove Column</button>
      `;
      wrapper.appendChild(toolbar);
    });

    temp.querySelectorAll("p, div").forEach(el => {
      if (!el.classList.contains("tp-table-editor-wrapper") && !el.classList.contains("tp-table-toolbar") && !el.querySelector("table")) {
        el.setAttribute("contenteditable", "true");
        el.classList.add("tp-editable-text");
      }
    });

    return temp.innerHTML;
  }

  function cleanVisualEditorHtml(container) {
    if (!container) return "";
    const clone = container.cloneNode(true);

    clone.querySelectorAll(".tp-table-toolbar").forEach(tb => tb.remove());

    clone.querySelectorAll(".tp-table-editor-wrapper").forEach(wrapper => {
      const table = wrapper.querySelector("table");
      if (table) {
        wrapper.parentNode.insertBefore(table, wrapper);
      }
      wrapper.remove();
    });

    clone.querySelectorAll("[contenteditable]").forEach(el => {
      el.removeAttribute("contenteditable");
      el.classList.remove("tp-editable-cell", "tp-editable-text", "tp-editable-annex-table");
      if (!el.getAttribute("class")?.trim()) el.removeAttribute("class");
    });

    return clone.innerHTML.trim();
  }

  function tableAddRow(btn) {
    const wrapper = btn.closest(".tp-table-editor-wrapper");
    if (!wrapper) return;
    const table = wrapper.querySelector("table");
    let tbody = table.querySelector("tbody") || table;
    const firstRow = table.querySelector("tr");
    const colCount = firstRow ? firstRow.children.length : 3;

    const tr = document.createElement("tr");
    const existingRows = tbody.querySelectorAll("tr").length;
    for (let i = 0; i < colCount; i++) {
      const td = document.createElement("td");
      td.setAttribute("contenteditable", "true");
      td.className = "tp-editable-cell";
      if (firstRow.children[i]?.classList.contains("center")) td.classList.add("center");
      td.textContent = (i === 0 && !isNaN(Number(firstRow.children[0]?.textContent))) ? (existingRows + 1) : "";
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
    tr.children[Math.min(1, colCount - 1)].focus();
  }

  function tableAddCol(btn) {
    const wrapper = btn.closest(".tp-table-editor-wrapper");
    if (!wrapper) return;
    const table = wrapper.querySelector("table");
    const thead = table.querySelector("thead");
    if (thead) {
      thead.querySelectorAll("tr").forEach(r => {
        const th = document.createElement("th");
        th.setAttribute("contenteditable", "true");
        th.className = "tp-editable-cell";
        th.textContent = "New Col";
        r.appendChild(th);
      });
    }
    const tbody = table.querySelector("tbody") || table;
    tbody.querySelectorAll("tr").forEach(r => {
      const td = document.createElement("td");
      td.setAttribute("contenteditable", "true");
      td.className = "tp-editable-cell";
      td.textContent = "";
      r.appendChild(td);
    });
  }

  function tableDelRow(btn) {
    const wrapper = btn.closest(".tp-table-editor-wrapper");
    if (!wrapper) return;
    const tbody = wrapper.querySelector("tbody") || wrapper.querySelector("table");
    const rows = tbody.querySelectorAll("tr");
    if (rows.length > 1) {
      rows[rows.length - 1].remove();
    }
  }

  function tableDelCol(btn) {
    const wrapper = btn.closest(".tp-table-editor-wrapper");
    if (!wrapper) return;
    const table = wrapper.querySelector("table");
    table.querySelectorAll("tr").forEach(r => {
      if (r.children.length > 1) {
        r.lastElementChild.remove();
      }
    });
  }

  function addTableToAnnexure(btn) {
    const card = btn.closest(".tp-annexure-edit-card");
    const editor = card.querySelector(".tp-annex-visual-editor-box");
    const div = document.createElement("div");
    div.innerHTML = prepareVisualEditorHtml("");
    while (div.firstChild) {
      editor.appendChild(div.firstChild);
    }
  }

  function addNoteToAnnexure(btn) {
    const card = btn.closest(".tp-annexure-edit-card");
    const editor = card.querySelector(".tp-annex-visual-editor-box");
    const p = document.createElement("p");
    p.className = "annex-note tp-editable-text";
    p.setAttribute("contenteditable", "true");
    p.textContent = "Click here to add notes or description...";
    editor.appendChild(p);
    p.focus();
  }

  function toggleEditAnnexures(isEdit) {
    if (isEdit && !canEditUser) {
      toast("View-only access: Contact an IT Administrator to request edit permissions.", "error");
      return;
    }
    tabEditStates.annexures = isEdit;
    document.getElementById("tpAnnexuresViewContainer").style.display = isEdit ? "none" : "block";
    document.getElementById("tpAnnexuresEditContainer").style.display = isEdit ? "block" : "none";
    document.getElementById("tpEditAnnexuresBtn").style.display = isEdit ? "none" : (canEditUser ? "inline-flex" : "none");
    document.getElementById("tpEditAnnexuresControls").style.display = isEdit ? "flex" : "none";

    if (isEdit) {
      const annexures = getRoleData(currentModalRoleId).annexures || [];
      const listEl = document.getElementById("tpAnnexuresEditList");
      listEl.innerHTML = annexures.map((ann, idx) => {
        const title = (ann && typeof ann === "object") ? (ann.title || "") : `Annexure ${idx + 1}`;
        const content = (ann && typeof ann === "object") ? (ann.content || "") : String(ann);
        return `
          <div class="tp-annexure-edit-card" data-idx="${idx}">
            <div class="tp-goal-edit-header">
              <span class="tp-annex-idx-badge">Annexure #${idx + 1}</span>
              <button type="button" class="tp-btn-icon-del" onclick="this.closest('.tp-annexure-edit-card').remove()" title="Delete Annexure">&times;</button>
            </div>
            <div class="tp-form-group">
              <label>Annexure Title</label>
              <input type="text" class="tp-input tp-annex-title" value="${esc(title)}" placeholder="e.g. Annexure A — Systemic Impact Targets">
            </div>
            <div class="tp-form-group">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                <label style="margin:0;">Interactive Table &amp; Description (Click any cell to edit directly):</label>
                <div style="display:flex;gap:6px;">
                  <button type="button" class="tp-table-btn" onclick="window.TeamPerformance.addTableToAnnexure(this)">+ Add Table</button>
                  <button type="button" class="tp-table-btn" onclick="window.TeamPerformance.addNoteToAnnexure(this)">+ Add Note</button>
                </div>
              </div>
              <div class="tp-annex-visual-editor-box">
                ${prepareVisualEditorHtml(content)}
              </div>
            </div>
          </div>
        `;
      }).join("") || `<div class="tp-empty-msg">No annexures recorded. Click <strong>+ Add Annexure</strong> below.</div>`;
    } else {
      renderAnnexuresTab(currentModalRoleId);
    }
  }

  function addNewAnnexureRow() {
    const listEl = document.getElementById("tpAnnexuresEditList");
    const count = listEl.querySelectorAll(".tp-annexure-edit-card").length;
    const div = document.createElement("div");
    div.className = "tp-annexure-edit-card";
    div.dataset.idx = count;
    div.innerHTML = `
      <div class="tp-goal-edit-header">
        <span class="tp-annex-idx-badge">Annexure #${count + 1}</span>
        <button type="button" class="tp-btn-icon-del" onclick="this.closest('.tp-annexure-edit-card').remove()" title="Delete Annexure">&times;</button>
      </div>
      <div class="tp-form-group">
        <label>Annexure Title</label>
        <input type="text" class="tp-input tp-annex-title" value="" placeholder="e.g. Annexure B — Performance Metrics">
      </div>
      <div class="tp-form-group">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <label style="margin:0;">Interactive Table &amp; Description (Click any cell to edit directly):</label>
          <div style="display:flex;gap:6px;">
            <button type="button" class="tp-table-btn" onclick="window.TeamPerformance.addTableToAnnexure(this)">+ Add Table</button>
            <button type="button" class="tp-table-btn" onclick="window.TeamPerformance.addNoteToAnnexure(this)">+ Add Note</button>
          </div>
        </div>
        <div class="tp-annex-visual-editor-box">
          ${prepareVisualEditorHtml("")}
        </div>
      </div>
    `;
    listEl.appendChild(div);
  }

  function saveAnnexures() {
    if (!canEditUser) {
      toast("Permission denied: You do not have edit access.", "error");
      return;
    }
    if (!currentModalRoleId) return;
    const updated = [];
    document.querySelectorAll("#tpAnnexuresEditList .tp-annexure-edit-card").forEach((card, i) => {
      const title = card.querySelector(".tp-annex-title").value.trim();
      const editorBox = card.querySelector(".tp-annex-visual-editor-box");
      const cleanContent = cleanVisualEditorHtml(editorBox);
      if (title || cleanContent) {
        updated.push({ title: title || `Annexure ${i + 1}`, content: cleanContent });
      }
    });
    saveRoleField(currentModalRoleId, "annexures", updated);
    toggleEditAnnexures(false);
    toast("Annexures saved successfully!");
  }

  function resetDefaultAll() {
    if (!currentModalRoleId) return;
    if (confirm("Reset ALL data for this role back to the original organization template?")) {
      resetRoleToTemplate(currentModalRoleId);
      renderAllModalTabs(currentModalRoleId);
      toggleEditGoals(false);
      toggleEditRole(false);
      toggleEditPriority(false);
      toggleEditAnnexures(false);
      toast("Restored default template data.");
    }
  }

  function toast(msg) {
    if (typeof window.showToast === "function") {
      window.showToast(msg);
    } else {
      console.log("[Toast]", msg);
    }
  }

  // --- Search & Filters ---

  function onSearch(query) {
    searchQuery = (query || "").trim();
    const clearBtn = document.getElementById("tpSearchClear");
    const summaryEl = document.getElementById("tpSearchSummary");
    const summaryText = document.getElementById("tpSearchSummaryText");

    if (clearBtn) clearBtn.style.display = searchQuery ? "block" : "none";

    if (searchQuery) {
      expandAll();
    }

    renderTree();

    if (searchQuery) {
      const matched = document.querySelectorAll(".tp-matched, .tp-matched-row");
      if (summaryEl && summaryText) {
        summaryEl.style.display = "flex";
        summaryText.textContent = `Found ${matched.length} match(es) for "${searchQuery}"`;
      }
      if (matched.length > 0) {
        matched[0].scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } else {
      if (summaryEl) summaryEl.style.display = "none";
    }
  }

  function clearSearch() {
    searchQuery = "";
    const inp = document.getElementById("tpSearchInput");
    if (inp) inp.value = "";
    collapseAll();
    onSearch("");
  }

  function setState(state) {
    activeState = state;
    document.getElementById("tpSegMH")?.classList.toggle("active", state === "MH");
    document.getElementById("tpSegCH")?.classList.toggle("active", state === "CH");
    document.getElementById("tpSegMP")?.classList.toggle("active", state === "MP");
    document.getElementById("tpSegBR")?.classList.toggle("active", state === "BR");

    expandedDivisions.clear();
    renderDivisionPills();
    renderTree();
  }

  // --- Mount ---
  async function mount() {
    loadLocalEditors();
    await checkPermissions();
    await initLiveData();
    await syncFirestoreEditors();
    await checkPermissions();
    renderDivisionPills();
    renderTree();
    updateToolbarAdminUI();

    const viewport = document.getElementById("tpViewport");
    if (viewport && !viewport.__scrollAttached) {
      viewport.__scrollAttached = true;
      viewport.addEventListener("scroll", scheduleConnectorUpdate, { passive: true });
    }
    if (window.ResizeObserver) {
      const canvas = document.getElementById("tpCanvas");
      const tree = document.getElementById("tpTreeContainer");
      if (canvas && !canvas.__roAttached) {
        canvas.__roAttached = true;
        new window.ResizeObserver(scheduleConnectorUpdate).observe(canvas);
      }
      if (tree && !tree.__roAttached) {
        tree.__roAttached = true;
        new window.ResizeObserver(scheduleConnectorUpdate).observe(tree);
      }
    }
  }

  function switchView(viewName) {
    activeView = viewName;
    const isSmart = viewName === "smart-goals";
    const smartView = document.getElementById("tpSmartGoalsView");
    const histView = document.getElementById("tpHistoricalView");
    const smartTabBtn = document.getElementById("tpViewTabSmartGoals");
    const histTabBtn = document.getElementById("tpViewTabHistorical");

    if (smartView) smartView.style.display = isSmart ? "block" : "none";
    if (histView) histView.style.display = isSmart ? "none" : "block";
    if (smartTabBtn) smartTabBtn.classList.toggle("active", isSmart);
    if (histTabBtn) histTabBtn.classList.toggle("active", !isSmart);

    if (isSmart) {
      scheduleConnectorUpdate();
    }
  }

  // Close on Escape key press
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      const modal = document.getElementById("tpModal");
      if (modal && modal.classList.contains("open")) {
        closeModal();
      }
      const edModal = document.getElementById("tpEditorsModal");
      if (edModal && edModal.style.display === "flex") {
        closeEditorsModal();
      }
    }
  });

  // Public API
  window.TeamPerformance = {
    mount,
    initLiveData,
    buildOperationalTree,
    getRoleData,
    openEditorsModal,
    closeEditorsModal,
    grantEditorAccess,
    revokeEditorAccess,
    checkPermissions,
    canCurrentUserEdit: () => canEditUser,
    isCurrentUserAdmin: () => isAdminUser,
    switchView,
    setState,
    toggleDivision,
    expandAll,
    collapseAll,
    onSearch,
    clearSearch,
    openModal,
    closeModal,
    toggleModalMaximize,
    switchTab,
    // Goals
    toggleEditGoals,
    addNewGoalRow,
    deleteGoalRow,
    recalcLiveWeight,
    saveGoals,
    // Role
    toggleEditRole,
    addNewRespRow,
    saveRole,
    // Priority
    toggleEditPriority,
    addNewPriorityRow,
    savePriority,
    // Annexures
    toggleEditAnnexures,
    addNewAnnexureRow,
    saveAnnexures,
    tableAddRow,
    tableAddCol,
    tableDelRow,
    tableDelCol,
    addTableToAnnexure,
    addNoteToAnnexure,
    // Reset
    resetDefaultAll
  };

})();
