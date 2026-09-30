// What each verified program is like, what you can get out of it, and who it's for,
// written from the program's own page (checked 2026-09-30) unless `source` says the
// details come from previous years' postings. Keyed by Opportunity id.

export type Audience = {
  // open: anyone eligible; encourages: open to all but names groups it especially welcomes;
  // focused: designed for a specific group.
  kind: "open" | "encourages" | "focused";
  label: string; // short, shown on cards for encourages/focused
  detail: string; // what the program's page says
};

export type ProgramDetails = {
  format: string;
  expect: string[];
  outcomes: string[];
  audience: Audience;
  requirements: string[];
  note?: string;
  source: "program page" | "past postings";
};

const OPEN: Audience = { kind: "open", label: "Open to all", detail: "No specific group focus; open to any student who meets the requirements." };

export const PROGRAM_DETAILS: Record<string, ProgramDetails> = {
  "bank-of-america-ignite-with-tech": {
    format: "1.5-day insight program",
    expect: [
      "An introduction to Bank of America's technology business and culture",
      "Networking receptions and day-in-the-life panels",
      "Sessions with recruiters and technology professionals",
    ],
    outcomes: [
      "Connections with Bank of America technologists and recruiters",
      "An inside look that helps you prepare for their internships",
    ],
    audience: {
      kind: "focused",
      label: "Black, Hispanic/Latino & Native American students",
      detail:
        "Targeted to Black, African American, Hispanic, Latino, Alaskan Native and American Indian freshman and sophomore students interested in technology.",
    },
    requirements: [
      "Freshman or sophomore interested in technology",
      "Counts toward Bank of America's limit of 3 U.S./Canada applications per recruiting season",
    ],
    source: "program page",
  },
  "bny-sophomore-summit": {
    format: "Virtual · 3 sessions over 6 weeks (May–June 2027)",
    expect: [
      "Engineering & Technology track on Wednesdays May 19, June 2 and June 16 (a Business track runs alternate weeks)",
      "Talks from current BNY interns and analysts",
      "A business case study or coding challenge",
    ],
    outcomes: ["Consideration for BNY's Summer Internship Program", "A clearer picture of careers in financial services"],
    audience: OPEN,
    requirements: ["Second-year student in a bachelor's program", "Graduating December 2028 or May 2029", "Based in the U.S."],
    source: "program page",
  },
  "capital-one-capital-one-s-early-internship-program": {
    format: "10-week paid summer internship · in person in McLean, VA · housing provided",
    expect: [
      "Hands-on projects on the Analyst or Technology track (the Analyst track uses tools like SQL)",
      "Mentorship from Capital One leaders",
      "A cohort of peers going through it with you",
    ],
    outcomes: ["A paid internship after sophomore year", "A path into Capital One's later internships and full-time programs"],
    audience: OPEN,
    requirements: ["Second-year (sophomore) undergraduate"],
    source: "program page",
  },
  "capital-one-capital-one-s-tech-summit": {
    format: "5-day event · sessions in May, August and January",
    expect: [
      "Workshops on web development, machine learning and hardware",
      "A closing hackathon with project demos to Capital One leaders",
    ],
    outcomes: [
      "Skills that strengthen an application to Capital One's Technology Internship Program",
      "A hackathon project you can talk about in interviews",
    ],
    audience: OPEN,
    requirements: ["Sophomore", "Computer science or STEM major", "Beginner coding experience is enough"],
    note: "To register interest, email TechEE@capitalone.com.",
    source: "program page",
  },
  "citadel-citadel-launch": {
    format: "11-week paid internship",
    expect: [
      "Engineering projects while learning how the finance industry works",
      "Mentorship throughout the summer",
      "Networking with peers and access to senior leaders",
    ],
    outcomes: ["A paid engineering internship at a top investment firm", "A head start toward Citadel's later internships"],
    audience: {
      kind: "open",
      label: "Not specified",
      detail: "Past postings don't name a group focus. Historically aimed at sophomores.",
    },
    requirements: ["Aspiring engineers curious about finance (2027 requirements not posted yet)"],
    source: "past postings",
  },
  "citadel-discover-citadel": {
    format: "2-day event · in person in New York · early April 2027",
    expect: [
      "Learn about Quantitative Research, Software Engineering and Trading roles",
      "Network with leaders, recent graduates and campus recruiters",
      "Team-building, intellectual competitions and mock interviews",
    ],
    outcomes: ["Mock-interview practice with Citadel", "An inside view of Citadel's internship and full-time paths"],
    audience: { ...OPEN, detail: "No group focus; offered to \"a select group of exceptional undergraduates.\"" },
    requirements: [
      "First- or second-year student",
      "Resume with your cumulative GPA",
      "U.S. and Canada applicants are considered for the New York event",
    ],
    note: "Citadel's page also lists a graduation date between Dec 2027 and June 2029, which may leave out current freshmen (Class of 2030). Worth confirming with Citadel.",
    source: "program page",
  },
  "electronic-arts-ea-pathfinder": {
    format: "12-week summer internship",
    expect: [
      "Real technical work alongside game-industry veterans",
      "Peer and professional mentorship",
      "Networking and time with EA's senior leaders",
    ],
    outcomes: ["Internship experience in the gaming industry", "Mentors and a network at EA"],
    audience: {
      kind: "focused",
      label: "Underrepresented students in STEM",
      detail: "Designed for STEM freshmen and sophomores from underrepresented backgrounds.",
    },
    requirements: ["First- or second-year STEM student (e.g., Computer Science)"],
    source: "past postings",
  },
  "hudson-river-trading-hrt-women-in-trading-technology-internship-jan": {
    format: "2–4 week internship · January 2027 · New York City",
    expect: [
      "An introduction to every technical side of algorithmic trading",
      "Independent programming projects in Python and C++",
      "Learning who HRT is and how they work",
    ],
    outcomes: ["Hands-on Python and C++ projects for your resume", "A real feel for careers in automated trading"],
    audience: {
      kind: "focused",
      label: "Underrepresented students (Women in Trading & Technology)",
      detail: "HRT describes it as being for second-year students from underrepresented backgrounds in tech and finance.",
    },
    requirements: ["Second-year student"],
    source: "program page",
  },
  "imc-trading-launchpad-program": {
    format: "2-day program · in person in Chicago · about 60 students",
    expect: [
      "Day 1: welcome sessions, an office tour, interactive presentations and networking",
      "Day 2: trading and technology deep dives, skills workshops",
      "Manual and algorithmic mock-trading simulations",
    ],
    outcomes: ["A fast track toward IMC's future internships", "Hands-on trading simulation experience", "Connections with IMC employees"],
    audience: OPEN,
    requirements: ["Second-year student", "Quantitative or computer science background"],
    source: "program page",
  },
  "jp-morgan-chase-jpmorganchase-fellowship-program": {
    format: "5-week paid, full-time summer fellowship · in select JPMorganChase offices",
    expect: [
      "A paid summer exploring careers at JPMorganChase",
      "Placement in a business track (e.g., Commercial & Investment Bank, Asset & Wealth Management)",
    ],
    outcomes: ["Consideration for a JPMorganChase summer internship the following year"],
    audience: {
      kind: "encourages",
      label: "Encourages Black, Hispanic & Latino students",
      detail:
        "Seeks sophomore students \"including, without limitation, Black, Hispanic and Latino students\", so it's open to all sophomores.",
    },
    requirements: ["Sophomore standing", "Enrolled at a U.S. college or university", "All majors welcome"],
    source: "program page",
  },
  "linkedin-first-play-linkedin-s-underclassman-engineering-internshipk": {
    format: "12-week paid internship · hybrid in Mountain View, CA",
    expect: [
      "Scoped coding projects that build your coding, debugging and problem-solving skills",
      "A dedicated mentor and manager",
      "First Play cohort events and LinkedIn's intern programming",
    ],
    outcomes: ["Real software engineering experience at LinkedIn", "Hourly pay, relocation support and intern perks"],
    audience: OPEN,
    requirements: [
      "Finished your first or second year of computer science",
      "Basic programming in Python, Java, C++, Rust or similar",
      "Some coding projects, coursework, hackathons or clubs",
    ],
    source: "program page",
  },
  "microsoft-microsoft-explore": {
    format: "12-week summer internship (U.S.)",
    expect: [
      "The Engineering Foundations track: build software through hands-on projects",
      "Work in a pod with other Explore interns, each owning part of a shared project",
      "Learn product thinking, collaboration and how AI supports engineering",
    ],
    outcomes: ["A Microsoft internship in your first or second year", "Foundational software engineering skills"],
    audience: OPEN,
    requirements: [
      "First- or second-year student",
      "Majoring in CS, Computer Engineering, IT, Data Science, Electrical Engineering, Cybersecurity or related",
    ],
    source: "program page",
  },
  "mlt-management-leadership-for-tomorrow-mlt-career-prep-class-of-2029": {
    format: "20+ month career program · virtual and in-person seminars",
    expect: ["One-on-one and group career coaching", "Skill-building seminars around the country", "Access to top employers"],
    outcomes: [
      "A personal coach and a professional playbook",
      "A network of 15,000+ MLT Rising Leaders and 11,000+ alumni",
      "A stronger shot at internships with MLT's partner employers",
    ],
    audience: {
      kind: "focused",
      label: "Students with inequitable access to career resources",
      detail: "For emerging leaders with lived experience of inequitable access to career-accelerating resources.",
    },
    requirements: [
      "Sophomore graduating Fall 2028–Summer 2029",
      "U.S. citizen, permanent resident or DACA recipient",
      "No minimum GPA, but competitive applicants have 3.0+",
      "Interest in business or technology (all majors accepted)",
    ],
    note: "Priority deadline for the Software/Technology track is Nov 1, 2026; final deadline Jan 15, 2027.",
    source: "program page",
  },
  "nvidia-nvidia-ignite-program": {
    format: "12-week summer pre-internship",
    expect: [
      "Hands-on work with NVIDIA technical experts on real projects",
      "Immersion in NVIDIA's products, culture and ecosystem",
      "A cohort that becomes a lasting support network",
    ],
    outcomes: ["Early technical experience at a leading AI company", "Mentors and a community of peers"],
    audience: {
      kind: "focused",
      label: "Historically underrepresented communities",
      detail: "Immerses students from historically underrepresented communities; NVIDIA describes it as inclusive of a wide range of backgrounds.",
    },
    requirements: ["Just started your freshman or sophomore year", "Interest in hardware, software or research"],
    source: "program page",
  },
  "optiver-quantitative-intern-summer-2027-sophomore-standing-grad-dec-2027-jun-2029": {
    format: "Summer 2027 internship · in person in Chicago",
    expect: [
      "Work alongside traders, researchers and engineers",
      "Training from Optiver's Education team and live market simulations",
      "Analyze data and build tools using AI-enabled research methods",
    ],
    outcomes: ["A Quant Trading or Quant Research internship", "Strong quantitative decision-making skills"],
    audience: OPEN,
    requirements: [
      "Bachelor's or Master's in a STEM field",
      "Graduating Dec 2027–June 2029 with sophomore standing or higher",
      "Available for Summer 2027",
    ],
    note: "This one is for sophomores, not freshmen.",
    source: "program page",
  },
  "rewriting-the-code-rtc-membership-community": {
    format: "Free online community · joining takes about 5 minutes",
    expect: ["A Slack community of peers and mentors", "Events like the Virtual Career Summit and TechConnect", "Introductions to partner companies"],
    outcomes: ["Mentors and peers from university through early career", "Access to internship and job opportunities"],
    audience: { kind: "focused", label: "Women in tech", detail: "A community of women in tech, from university through the first six years of their careers." },
    requirements: ["Woman in university (or up to 6 years into a tech career)"],
    source: "program page",
  },
  "susquehanna-discovery-programme-equity-research-on-site": {
    format: "Discovery programme · in person in Dublin, Ireland",
    expect: [
      "A day in the life of SIG's equity and macro research analysts",
      "Insight into investment finance and SIG's culture",
      "Tips on preparing for SIG's interview process",
    ],
    outcomes: ["Interview-prep advice for SIG's graduate roles", "Exposure to investment research careers"],
    audience: OPEN,
    requirements: [
      "First- or second-year student in finance, economics, maths, actuarial science, CS, statistics or engineering",
      "Submit a resume; eligible applicants take an online assessment",
    ],
    note: "Held in Dublin. SIG contacts applicants in January.",
    source: "program page",
  },
  "uber-uber-star": {
    format: "12-week paid summer internship",
    expect: ["Placement on a team such as engineering, freight, strategic finance or sales", "Real project work with mentorship"],
    outcomes: ["A paid internship at Uber in your first or second year"],
    audience: {
      kind: "encourages",
      label: "Encourages underrepresented students",
      detail: "Open to students from all schools, and especially welcomes students from groups historically underrepresented in tech.",
    },
    requirements: ["Freshman or rising sophomore"],
    source: "past postings",
  },
};
