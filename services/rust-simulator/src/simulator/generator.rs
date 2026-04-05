use rand::Rng;

use crate::models::team::{Team, User};

const TEAM_PREFIXES: &[&str] = &[
    "Backend", "Frontend", "Platform", "Data", "Mobile", "DevOps",
    "Infra", "Auth", "Payments", "Search", "ML", "Analytics",
    "Billing", "Onboarding", "Notifications", "Integrations",
    "Core", "Growth", "Security", "Compliance", "Tooling", "DX",
    "API", "Web", "iOS", "Android", "Desktop", "CLI", "SDK", "Docs",
    "QA", "SRE", "Release", "Performance", "Observability", "Edge",
    "Streaming", "Storage", "Cache", "Gateway", "Identity", "Catalog",
];

const TEAM_SUFFIXES: &[&str] = &[
    "", "Alpha", "Beta", "Core", "Platform", "Services",
    "Engine", "Hub", "Studio", "Labs", "Team", "Squad",
    "West", "East", "EU", "APAC", "US", "Global",
    "V2", "Next", "Prime", "Plus", "Pro", "Lite",
];

const FIRST_NAMES: &[&str] = &[
    "alice", "bob", "carol", "dave", "eve", "frank", "grace", "heidi", "ivan", "judy",
];

const LAST_NAMES: &[&str] = &[
    "smith", "jones", "chen", "garcia", "kim", "patel", "silva", "nguyen", "murphy", "taylor",
];

pub fn generate_teams(count: usize) -> Vec<Team> {
    let mut teams = Vec::with_capacity(count);
    let mut used_names = std::collections::HashSet::new();

    for i in 0..count {
        let name = if i < TEAM_PREFIXES.len() {
            TEAM_PREFIXES[i].to_string()
        } else {
            let prefix = TEAM_PREFIXES[i % TEAM_PREFIXES.len()];
            let suffix_idx = (i / TEAM_PREFIXES.len()) % TEAM_SUFFIXES.len();
            let suffix = TEAM_SUFFIXES[suffix_idx];
            if suffix.is_empty() {
                format!("{} {}", prefix, i / TEAM_PREFIXES.len())
            } else {
                format!("{} {}", prefix, suffix)
            }
        };

        let name = if used_names.contains(&name) {
            format!("{}-{}", name, i)
        } else {
            name
        };
        used_names.insert(name.clone());

        let id = name.to_lowercase().replace(' ', "-");
        teams.push(Team { id, name });
    }

    teams
}

pub fn generate_users(teams: &[Team]) -> Vec<User> {
    let mut rng = rand::thread_rng();
    let mut users = Vec::new();
    let mut id_counter = 1u64;

    for team in teams {
        let count = rng.gen_range(2..=5);
        for _ in 0..count {
            let first = FIRST_NAMES[rng.gen_range(0..FIRST_NAMES.len())];
            let last = LAST_NAMES[rng.gen_range(0..LAST_NAMES.len())];
            users.push(User {
                id: format!("user-{}", id_counter),
                email: format!("{}.{}{}@acme.com", first, last, id_counter),
                team_id: team.id.clone(),
            });
            id_counter += 1;
        }
    }

    users
}
