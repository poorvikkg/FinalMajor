"""
Seed data definitions for synthetic police record dataset generator.
Contains realistic Indian names, locations, police stations, legal sections,
note templates, activity templates, evidence templates, document templates.
"""

# 20 Police Stations with Realistic Coordinates & Contact Info across India
POLICE_STATIONS = [
    {
        "station_code": "PS-MUM-001",
        "station_name": "Colaba Police Station",
        "district": "Mumbai City",
        "state": "Maharashtra",
        "address": "1, Shahid Bhagat Singh Marg, Colaba, Mumbai - 400001",
        "latitude": 18.9154,
        "longitude": 72.8258,
        "jurisdiction": "Colaba, Cuffe Parade, Navy Nagar, Fort South",
        "phone": "+91-22-22856789",
        "email": "colaba.ps@mahapolice.gov.in"
    },
    {
        "station_code": "PS-MUM-002",
        "station_name": "Bandra Police Station",
        "district": "Mumbai Suburban",
        "state": "Maharashtra",
        "address": "Hill Road, Bandra West, Mumbai - 400050",
        "latitude": 19.0596,
        "longitude": 72.8295,
        "jurisdiction": "Bandra West, Pali Hill, Carter Road, Bandra Reclamation",
        "phone": "+91-22-26423456",
        "email": "bandra.ps@mahapolice.gov.in"
    },
    {
        "station_code": "PS-PUN-001",
        "station_name": "Shivajinagar Police Station",
        "district": "Pune",
        "state": "Maharashtra",
        "address": "JM Road, Shivajinagar, Pune - 411005",
        "latitude": 18.5308,
        "longitude": 73.8475,
        "jurisdiction": "Shivajinagar, FC Road, Model Colony, Deccan Gymkhana",
        "phone": "+91-20-25531234",
        "email": "shivajinagar.ps@punepolice.gov.in"
    },
    {
        "station_code": "PS-DEL-001",
        "station_name": "Connaught Place Police Station",
        "district": "Central Delhi",
        "state": "Delhi",
        "address": "Parliament Street, Connaught Place, New Delhi - 110001",
        "latitude": 28.6289,
        "longitude": 77.2150,
        "jurisdiction": "Connaught Place, Janpath, Barakhamba Road, Kasturba Gandhi Marg",
        "phone": "+91-11-23361234",
        "email": "cp.ps@delhipolice.gov.in"
    },
    {
        "station_code": "PS-DEL-002",
        "station_name": "Hauz Khas Police Station",
        "district": "South Delhi",
        "state": "Delhi",
        "address": "Aurobindo Marg, Hauz Khas, New Delhi - 110016",
        "latitude": 28.5494,
        "longitude": 77.2001,
        "jurisdiction": "Hauz Khas, Green Park, Safdarjung Enclave, IIT Campus",
        "phone": "+91-11-26514567",
        "email": "hauzkhas.ps@delhipolice.gov.in"
    },
    {
        "station_code": "PS-BLR-001",
        "station_name": "Koramangala Police Station",
        "district": "Bangalore Urban",
        "state": "Karnataka",
        "address": "8th Block, Koramangala, Bengaluru - 560095",
        "latitude": 12.9352,
        "longitude": 77.6245,
        "jurisdiction": "Koramangala 1st to 8th Blocks, Forum Mall, Sony World Junction",
        "phone": "+91-80-22942345",
        "email": "koramangala.ps@ksp.gov.in"
    },
    {
        "station_code": "PS-BLR-002",
        "station_name": "Indiranagar Police Station",
        "district": "Bangalore Urban",
        "state": "Karnataka",
        "address": "100 Feet Road, Indiranagar, Bengaluru - 560038",
        "latitude": 12.9784,
        "longitude": 77.6408,
        "jurisdiction": "Indiranagar 1st and 2nd Stages, CMH Road, Defence Colony",
        "phone": "+91-80-22943456",
        "email": "indiranagar.ps@ksp.gov.in"
    },
    {
        "station_code": "PS-CHE-001",
        "station_name": "T. Nagar Police Station",
        "district": "Chennai",
        "state": "Tamil Nadu",
        "address": "Venkatnarayana Road, T. Nagar, Chennai - 600017",
        "latitude": 13.0418,
        "longitude": 80.2341,
        "jurisdiction": "T. Nagar, Pondy Bazaar, Kodambakkam, West Mambalam",
        "phone": "+91-44-23452345",
        "email": "tnagar.ps@tnpolice.gov.in"
    },
    {
        "station_code": "PS-CHE-002",
        "station_name": "Mylapore Police Station",
        "district": "Chennai",
        "state": "Tamil Nadu",
        "address": "Kutchery Road, Mylapore, Chennai - 600004",
        "latitude": 13.0339,
        "longitude": 80.2687,
        "jurisdiction": "Mylapore, Mandaveli, Santhome, Luz Church Road",
        "phone": "+91-44-23453456",
        "email": "mylapore.ps@tnpolice.gov.in"
    },
    {
        "station_code": "PS-LKO-001",
        "station_name": "Hazratganj Police Station",
        "district": "Lucknow",
        "state": "Uttar Pradesh",
        "address": "MG Marg, Hazratganj, Lucknow - 226001",
        "latitude": 26.8537,
        "longitude": 80.9458,
        "jurisdiction": "Hazratganj, Vidhan Sabha Marg, Ashok Marg, Lalbagh",
        "phone": "+91-522-2201234",
        "email": "hazratganj.ps@uppolice.gov.in"
    },
    {
        "station_code": "PS-NOI-001",
        "station_name": "Sector 20 Police Station",
        "district": "Gautam Buddha Nagar",
        "state": "Uttar Pradesh",
        "address": "Sector 20, Noida - 201301",
        "latitude": 28.5800,
        "longitude": 77.3240,
        "jurisdiction": "Noida Sector 18, Sector 19, Sector 20, Sector 27, Atta Market",
        "phone": "+91-120-2521234",
        "email": "sec20noida.ps@uppolice.gov.in"
    },
    {
        "station_code": "PS-AMD-001",
        "station_name": "Navrangpura Police Station",
        "district": "Ahmedabad",
        "state": "Gujarat",
        "address": "CG Road, Navrangpura, Ahmedabad - 380009",
        "latitude": 23.0366,
        "longitude": 72.5612,
        "jurisdiction": "Navrangpura, Commerce College, Law Garden, Ellis Bridge",
        "phone": "+91-79-26401234",
        "email": "navrangpura.ps@gujaratpolice.gov.in"
    },
    {
        "station_code": "PS-JAI-001",
        "station_name": "Vidhadhar Nagar Police Station",
        "district": "Jaipur",
        "state": "Rajasthan",
        "address": "Sector 2, Vidhyadhar Nagar, Jaipur - 302039",
        "latitude": 26.9634,
        "longitude": 75.7788,
        "jurisdiction": "Vidyadhar Nagar, Ambabari, Shastri Nagar North",
        "phone": "+91-141-2231234",
        "email": "vdn.ps@rajasthanpolice.gov.in"
    },
    {
        "station_code": "PS-KOL-001",
        "station_name": "Park Street Police Station",
        "district": "Kolkata",
        "state": "West Bengal",
        "address": "Park Street, Kolkata - 700016",
        "latitude": 22.5532,
        "longitude": 88.3524,
        "jurisdiction": "Park Street, Camac Street, Free School Street, Mullick Bazar",
        "phone": "+91-33-22291234",
        "email": "parkstreet.ps@kolkatapolice.gov.in"
    },
    {
        "station_code": "PS-BHO-001",
        "station_name": "MP Nagar Police Station",
        "district": "Bhopal",
        "state": "Madhya Pradesh",
        "address": "Zone 1, MP Nagar, Bhopal - 462011",
        "latitude": 23.2331,
        "longitude": 77.4343,
        "jurisdiction": "MP Nagar Zone 1 & 2, DB Mall, Habibganj Station Area",
        "phone": "+91-755-2551234",
        "email": "mpnagar.ps@mppolice.gov.in"
    },
    {
        "station_code": "PS-TVM-001",
        "station_name": "Museum Police Station",
        "district": "Thiruvananthapuram",
        "state": "Kerala",
        "address": "Museum Junction, Thiruvananthapuram - 695033",
        "latitude": 8.5131,
        "longitude": 76.9565,
        "jurisdiction": "Museum, Kowdiar, Vellayambalam, Palayam",
        "phone": "+91-471-2315678",
        "email": "museum.ps@keralapolice.gov.in"
    },
    {
        "station_code": "PS-HYD-001",
        "station_name": "Banjara Hills Police Station",
        "district": "Hyderabad",
        "state": "Telangana",
        "address": "Road No. 12, Banjara Hills, Hyderabad - 500034",
        "latitude": 17.4156,
        "longitude": 78.4347,
        "jurisdiction": "Banjara Hills, Jubilee Hills East, KBC, Panjagutta South",
        "phone": "+91-40-27852345",
        "email": "banjarahills.ps@tspolice.gov.in"
    },
    {
        "station_code": "PS-CHD-001",
        "station_name": "Sector 17 Police Station",
        "district": "Chandigarh",
        "state": "Chandigarh",
        "address": "Sector 17 Plaza, Chandigarh - 160017",
        "latitude": 30.7398,
        "longitude": 76.7827,
        "jurisdiction": "Sector 17 Commercial Plaza, Sector 16, ISBT Sector 17",
        "phone": "+91-172-2701234",
        "email": "sec17.ps@chdpolice.gov.in"
    },
    {
        "station_code": "PS-COI-001",
        "station_name": "RS Puram Police Station",
        "district": "Coimbatore",
        "state": "Tamil Nadu",
        "address": "DB Road, RS Puram, Coimbatore - 641002",
        "latitude": 11.0084,
        "longitude": 76.9520,
        "jurisdiction": "RS Puram, Brookefields, Sukrawar Pet, Lawley Road",
        "phone": "+91-422-2471234",
        "email": "rspuram.ps@tnpolice.gov.in"
    },
    {
        "station_code": "PS-NAG-001",
        "station_name": "Sitabuldi Police Station",
        "district": "Nagpur",
        "state": "Maharashtra",
        "address": "Sitabuldi, Nagpur - 440012",
        "latitude": 21.1458,
        "longitude": 79.0882,
        "jurisdiction": "Sitabuldi Market, Tekdi Road, Nagpur Railway Station West",
        "phone": "+91-712-2521234",
        "email": "sitabuldi.ps@mahapolice.gov.in"
    }
]

# Indian Names Pool
MALE_FIRST_NAMES = [
    "Rajesh", "Suresh", "Amit", "Vikram", "Deepak", "Anil", "Ravi", "Sanjay", "Manish",
    "Rahul", "Nikhil", "Ajay", "Pradeep", "Vinod", "Mukesh", "Ashok", "Dinesh", "Ramesh",
    "Sunil", "Manoj", "Karan", "Arjun", "Aditya", "Rohan", "Gaurav", "Pankaj", "Alok",
    "Abhishek", "Vivek", "Siddharth", "Tarun", "Varun", "Vishal", "Sachin", "Vijay",
    "Mohan", "Devendra", "Hitesh", "Jitendra", "Mahesh", "Nilesh", "Pravin", "Rakesh",
    "Satish", "Umesh", "Yogesh", "Anand", "Bhaskar", "Chandan", "Ganesh"
]

FEMALE_FIRST_NAMES = [
    "Priya", "Sunita", "Anita", "Kavita", "Neha", "Pooja", "Rekha", "Suman", "Meena",
    "Geeta", "Asha", "Lata", "Shanti", "Manju", "Savita", "Nisha", "Seema", "Renu",
    "Uma", "Ananya", "Divya", "Krutika", "Meera", "Nandini", "Payal", "Ritu", "Sneha",
    "Swati", "Tanja", "Vandana", "Aarti", "Bhavna", "Deepa", "Indu", "Jyoti", "Kiran",
    "Madhu", "Nirmala", "Prachi", "Radha", "Shweta", "Tejal", "Usha", "Vidya", "Yashoda"
]

LAST_NAMES = [
    "Kumar", "Singh", "Sharma", "Verma", "Gupta", "Joshi", "Patel", "Reddy", "Nair",
    "Iyer", "Mishra", "Tiwari", "Yadav", "Chauhan", "Malik", "Das", "Rao", "Pillai",
    "Menon", "Patil", "Deshmukh", "Kulkarni", "Bhatt", "Shah", "Mehta", "Agarwal",
    "Bansal", "Saxena", "Srivastava", "Pandey", "Tripathi", "Dubey", "Shukla", "Gowda",
    "Shetty", "Naidu", "Mukherjee", "Banerjee", "Chatterjee", "Bhowmick", "Dutta"
]

OCCUPATIONS = [
    "Software Engineer", "Teacher", "Businessman", "Shopkeeper", "Driver", "Farmer",
    "Doctor", "Civil Engineer", "Accountant", "Government Servant", "Lawyer",
    "Bank Employee", "Security Guard", "Mechanic", "Electrician", "Student",
    "Homemaker", "Journalist", "Real Estate Agent", "Contractor", "Unemployed"
]

OFFICER_SPECIALIZATIONS = [
    "Cyber Crime", "Homicide & Violent Crimes", "Financial Fraud & Economic Offenses",
    "Narcotics", "Forensics & Ballistics", "Organized Crime", "Human Trafficking",
    "Traffic & Accident Reconstruction", "General Investigation"
]

# Statutory Legal Sections (IPC & BNS equivalents)
LEGAL_SECTIONS_MAP = {
    "MISSING_PERSON": [
        {"act": "IPC", "section": "363", "description": "Punishment for kidnapping"},
        {"act": "BNS", "section": "137", "description": "Kidnapping"}
    ],
    "KIDNAPPING": [
        {"act": "IPC", "section": "364", "description": "Kidnapping or abducting in order to murder"},
        {"act": "IPC", "section": "364A", "description": "Kidnapping for ransom"},
        {"act": "BNS", "section": "140", "description": "Kidnapping or abduction for ransom"}
    ],
    "THEFT": [
        {"act": "IPC", "section": "378", "description": "Theft"},
        {"act": "IPC", "section": "379", "description": "Punishment for theft"},
        {"act": "IPC", "section": "380", "description": "Theft in dwelling house"},
        {"act": "BNS", "section": "303", "description": "Theft and aggravated theft"}
    ],
    "ROBBERY": [
        {"act": "IPC", "section": "392", "description": "Punishment for robbery"},
        {"act": "IPC", "section": "395", "description": "Punishment for dacoity"},
        {"act": "BNS", "section": "309", "description": "Robbery"}
    ],
    "CYBER_CRIME": [
        {"act": "IT Act", "section": "66C", "description": "Punishment for identity theft"},
        {"act": "IT Act", "section": "66D", "description": "Punishment for cheating by personation using computer resource"},
        {"act": "IPC", "section": "420", "description": "Cheating and dishonestly inducing delivery of property"}
    ],
    "FRAUD": [
        {"act": "IPC", "section": "420", "description": "Cheating and dishonestly inducing delivery of property"},
        {"act": "IPC", "section": "406", "description": "Punishment for criminal breach of trust"},
        {"act": "IPC", "section": "468", "description": "Forgery for purpose of cheating"}
    ],
    "MURDER": [
        {"act": "IPC", "section": "302", "description": "Punishment for murder"},
        {"act": "IPC", "section": "307", "description": "Attempt to murder"},
        {"act": "BNS", "section": "103", "description": "Punishment for murder"}
    ],
    "ASSAULT": [
        {"act": "IPC", "section": "323", "description": "Punishment for voluntarily causing hurt"},
        {"act": "IPC", "section": "325", "description": "Punishment for voluntarily causing grievous hurt"},
        {"act": "BNS", "section": "115", "description": "Voluntarily causing hurt"}
    ],
    "ACCIDENT": [
        {"act": "IPC", "section": "279", "description": "Rash driving or riding on a public way"},
        {"act": "IPC", "section": "304A", "description": "Causing death by negligence"},
        {"act": "Motor Vehicles Act", "section": "184", "description": "Dangerous driving"}
    ],
    "DOMESTIC_VIOLENCE": [
        {"act": "IPC", "section": "498A", "description": "Husband or relative of husband subjecting woman to cruelty"},
        {"act": "DV Act", "section": "12", "description": "Application to Magistrate for domestic violence relief"}
    ],
    "DRUG_OFFENCE": [
        {"act": "NDPS Act", "section": "20", "description": "Punishment for contravention in relation to cannabis"},
        {"act": "NDPS Act", "section": "21", "description": "Punishment for contravention in relation to manufactured drugs"}
    ],
    "FINANCIAL_CRIME": [
        {"act": "PMLA", "section": "3", "description": "Offence of money-laundering"},
        {"act": "IPC", "section": "409", "description": "Criminal breach of trust by public servant, banker, merchant or agent"}
    ],
    "OTHERS": [
        {"act": "IPC", "section": "506", "description": "Punishment for criminal intimidation"}
    ]
}

# Template text pools for Notes, Activities, Evidence, Documents
NOTE_TEMPLATES = [
    "Visited crime scene at {location}. Conducted preliminary inspection and secured perimeter.",
    "CCTV footage collected from nearby commercial establishment ({location}). Preserved on secure drive.",
    "Recorded detailed statement of witness {person_name}. Statement signed and cataloged.",
    "Traced suspect vehicle registration number. Details submitted for RTO cross-verification.",
    "Awaiting formal forensic report from State Forensic Science Laboratory.",
    "Interrogated suspect {person_name} regarding whereabouts on the night of the incident.",
    "Retrieved Mobile CDR (Call Detail Record) for target mobile number. Analyzing cell tower dumps.",
    "Conducted surprise raid at suspected location in {district}. Seized physical evidence.",
    "Submitted request to Bank Manager for account statement and transaction logs.",
    "Ballistics evaluation report received from FSL. Caliber matches suspect firearm.",
    "Coordinates verified with local beat officers. Local informant network alerted.",
    "Drafted case progress report for Assistant Commissioner of Police review."
]

ACTIVITY_TEMPLATES = [
    ("REGISTERED", "FIR filed and case registered at {station_name}."),
    ("ASSIGNED", "Case assigned to Primary IO {officer_name} ({badge})."),
    ("EVIDENCE_COLLECTED", "Physical evidence items collected from incident site."),
    ("WITNESS_ADDED", "Witness {person_name} added to case record."),
    ("INTERROGATION", "Suspect {person_name} brought in for questioning."),
    ("INVESTIGATION_UPDATED", "Case notes updated following site visit."),
    ("STATUS_CHANGED", "Case status updated to {status}."),
    ("CHARGE_SHEET_FILED", "Charge sheet submitted to Judicial Magistrate Court."),
    ("CLOSED", "Case investigation concluded and case closed.")
]

EVIDENCE_DESCRIPTIONS = {
    "PHYSICAL": ["Recovered sharp metallic tool", "Latent fingerprint lifted from door handle", "Fabric sample with blood stains", "Shoe impression cast"],
    "DIGITAL": ["Hard disk drive containing DVR recording", "Mobile smartphone (Android/iOS)", "USB flash drive with encrypted documents", "SIM card recovered"],
    "DOCUMENTARY": ["Forged land deed agreement", "Fraudulent cheque leaf", "Handwritten ransom note", "Fake identification card"],
    "BIOLOGICAL": ["Swab sample for DNA profiling", "Blood sample collected from vehicle seat", "Hair strand recovered from crime scene"],
    "FORENSIC": ["Bullet casing recovered from floor", "Chemical reagent sample", "Toxicology vial from post-mortem"]
}

DOCUMENT_CONTENT_TEMPLATES = {
    "FIR": "FIRST INFORMATION REPORT (Under Section 154 Cr.P.C / Section 173 BNS)\nPolice Station: {station_name}\nDistrict: {district}\nFIR No: {fir_number}\nDate & Time: {date}\nDetails of Incident: {summary}\nSections: {sections}\nComplainant: {complainant_name}\nAssigned IO: {officer_name}",
    "WITNESS_STATEMENT": "STATEMENT OF WITNESS (Under Section 161 Cr.P.C / Section 180 BNS)\nCase FIR: {fir_number}\nWitness Name: {person_name}\nAge: {age}, Gender: {gender}\nAddress: {address}\nStatement: I was present near {location} on the date of incident. I saw suspicious movement near the premises around 21:30 hours...",
    "MEDICAL_REPORT": "MEDICO-LEGAL EXAMINATION REPORT (MLC)\nCase FIR: {fir_number}\nPatient/Victim: {person_name}\nExamining Doctor: Dr. S. K. Verma, MD\nFindings: Minor abrasions on forearm and contusion near left shoulder. Injuries consistent with blunt force impact. Age of injury: 12-24 hours.",
    "INVESTIGATION_REPORT": "PERIODIC INVESTIGATION REPORT\nCase FIR: {fir_number}\nInvestigating Officer: {officer_name}\nKey Findings: Technical intelligence and CDR analysis confirm presence of suspect in cell ID coverage area at the time of incident. Interrogation scheduled.",
    "CLOSURE_REPORT": "FINAL CLOSURE REPORT (Under Section 169/173 Cr.P.C)\nCase FIR: {fir_number}\nReason for Closure: {closure_reason}\nStatus: {status}\nApproved by Divisional Officer.",
    "COURT_ORDER": "IN THE COURT OF THE JUDICIAL MAGISTRATE FIRST CLASS\nCase Reference: {fir_number}\nOrder: Police custody of accused extended by 7 days for recovery of stolen property. Next hearing set for next week."
}
