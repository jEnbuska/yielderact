import { tabs } from "./constants";

export type Tab = (typeof tabs)[number]["id"];

export type Search = { tab?: Tab };

export type Pathname = "/";

export type PersonRow = {
  id: string;
  name: string;
  department: string;
  city: string;
};
