// How an app says which kind of streak it counts. each-and-together: a streak per person and one
// together, in the phone's own day. household: one count for everyone who shares, in one time zone,
// from a start date, with an optional free skip per Monday-to-Sunday week.
export type HouseholdStreakRule = { kind: 'household'; timeZone: string; since: string; freeSkipsPerWeek: 0 | 1 }
export type StreakRule = { kind: 'each-and-together' } | HouseholdStreakRule
