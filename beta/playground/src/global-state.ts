import { PersonRow } from "./types";

let personRows: ReadonlyArray<PersonRow> = [];

export async function createPersonRows(count: number) {
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

  const DEPARTMENTS = [
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

  const rows: PersonRow[] = [];
  for (let i = 1; i <= count; i++) {
    if (i % 5000 === 0) await new Promise((res) => setTimeout(res, 0));
    rows.push({
      id: `${i}`,
      name: FIRST_NAMES[i % FIRST_NAMES.length]!,
      department: DEPARTMENTS[i % DEPARTMENTS.length]!,
      city: CITIES[i % CITIES.length]!,
    });
  }
  personRows = rows;
}

export function getPersonRows() {
  return personRows;
}
