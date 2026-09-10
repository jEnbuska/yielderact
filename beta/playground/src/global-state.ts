import { PersonRow } from "./types";

const FIRST_NAMES = [
  "Alice",
  "Bob",
  "Carol",
  "Dave",
  "Eve",
  "Frank",
  "Grace",
  "Hank",
  "Iris",
  "Jack",
  "Kate",
  "Leo",
  "Mona",
  "Nick",
  "Olga",
  "Pete",
  "Quinn",
  "Rita",
  "Sam",
  "Tina",
  "Uma",
  "Vic",
  "Wendy",
  "Xena",
  "Yuri",
  "Zara",
];

export const DEPARTMENTS = [
  "Engineering",
  "Sales",
  "Marketing",
  "Support",
  "Finance",
  "Legal",
  "HR",
  "Design",
  "Operations",
  "Research",
];

const CITIES = [
  "Helsinki",
  "Berlin",
  "London",
  "Paris",
  "Tokyo",
  "New York",
  "Sydney",
  "Toronto",
  "Mumbai",
  "Seoul",
];
export async function createPersonRows(count: number, signal: AbortSignal) {
  const rows: PersonRow[] = [];
  for (let i = 1; i <= count; i++) {
    if (i % 5000 === 0) {
      if (signal.aborted) throw new Error("Signal abortedss");
      await new Promise((res) => setTimeout(res, 0));
    }
    rows.push({
      id: `${i}`,
      name: FIRST_NAMES[i % FIRST_NAMES.length]!,
      department: DEPARTMENTS[i % DEPARTMENTS.length]!,
      city: CITIES[i % CITIES.length]!,
    });
  }
  return rows;
}

export function getPersonRows(count: number, signal: AbortSignal) {
  return createPersonRows(count, signal);
}
