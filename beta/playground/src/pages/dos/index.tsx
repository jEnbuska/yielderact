/**
 * DosDemo — every component in the kit, composed the way it is meant to be
 * used. Doubles as the manual: each example sits beside the element it maps to.
 */
import { $id, useState } from "yract-beta";
import "../../dos/styles.css";
import {
  Alert,
  Badge,
  BreadCrumbs,
  BulletItem,
  BulletList,
  Button,
  Checkbox,
  CheckboxGroup,
  Code,
  Crumb,
  Cursor,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Heading,
  Kbd,
  Link,
  ListBox,
  ListBoxOption,
  LoaderTrain,
  Nav,
  NavLink,
  Progress,
  Quote,
  Radio,
  RadioGroup,
  Range,
  Row,
  Rule,
  Scroll,
  Select,
  Shell,
  ShellMain,
  Sidebar,
  SidebarGroup,
  SidebarLink,
  Small,
  Spinner,
  Stage,
  Status,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  Tag,
  Terminal,
  TerminalTone,
  Text,
  TextArea,
  TextInput,
  Well,
  Window,
  WindowBar,
  WindowBody,
} from "../../dos";

interface FormState {
  volume: string;
  path: string;
  fileSystem: string;
  notes: string;
  verify: boolean;
  backup: boolean;
  formatType: string;
  clusterSize: number;
}

export function* DosDemo() {
  const manageId = yield* $id();
  const maintenanceId = yield* $id();

  const [form, setForm] = yield* useState<FormState>({
    volume: "SYSTEM",
    path: "C:\\PROGRA~1\\?",
    fileSystem: "FAT16",
    notes: "",
    verify: true,
    backup: false,
    formatType: "quick",
    clusterSize: 4,
  });

  const pathInvalid = form.path.includes("?");

  function update<K extends keyof FormState>(key: K, value: FormState[K]): void {
    void setForm({ ...form, [key]: value });
  }

  return (
    <>
      <BreadCrumbs label="Location" hint="/dos">
        <Crumb>yract-beta</Crumb>
        <Crumb>DOS Kit</Crumb>
      </BreadCrumbs>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5em" }}>
        <Heading level={1} onScreen>
          Text mode UI kit
        </Heading>
        <Text>
          Sixteen colors, two bevels, one stylesheet. Every control below is a real element with{" "}
          <Code>styles.css</Code> applied, built for a mouse and answerable to a keyboard.
        </Text>
        <Row tight>
          <Badge tone="info">dos.css</Badge>
          <Badge>16 colors</Badge>
          <Badge tone="ok">no dependencies</Badge>
        </Row>

        {/* ---- Text ---- */}
        <Window id="text" labelledBy="dos-text-title">
          <WindowBar title="Headings and text" titleId="dos-text-title" aside="h1 · h2 · h3 · p" />
          <WindowBody>
            <Heading level={1}>Disk utilities</Heading>
            <Heading level={2}>Defragmenting drive C:</Heading>
            <Heading level={3}>Cluster map</Heading>
            <Text>
              Body copy sits on the gray panel. Keep measures short; a text-mode screen was eighty
              columns wide and reading is easier when you honor that.
            </Text>
            <Small>Last scan: 04/12/1997 — 0 bad sectors</Small>
            <Text>
              <Link href="https://example.com" onPanel>
                Open the manual
              </Link>
            </Text>
            <BulletList>
              <BulletItem>Scan for errors</BulletItem>
              <BulletItem>Rebuild index</BulletItem>
              <BulletItem>Compress free space</BulletItem>
            </BulletList>
            <Quote>640K ought to be enough of a measure for any paragraph.</Quote>
            <Row tight>
              <Code>CHKDSK /F</Code>
              <Kbd>Ctrl</Kbd>
              <Kbd>Alt</Kbd>
              <Kbd>Del</Kbd>
              <Tag>&lt;kbd&gt;</Tag>
            </Row>
            <Rule />
          </WindowBody>
        </Window>

        {/* ---- Navigation ---- */}
        <Window id="nav" labelledBy="dos-nav-title">
          <WindowBar title="Navigation" titleId="dos-nav-title" aside="nav · tablist · listbox" />
          <WindowBody>
            {/* Top bar on bare screen — it brings its own edges, so it needs no card. */}
            <Stage>
              <Nav label="Disk tools" brand="Norton">
                <NavLink href="/dos" current>
                  Files
                </NavLink>
                <NavLink href="/counter">Disks</NavLink>
                <NavLink href="/todos">Memory</NavLink>
                <NavLink href="/hooks">Settings</NavLink>
              </Nav>
            </Stage>

            <Stage flush>
              <Shell>
                <Sidebar label="Sections">
                  <SidebarGroup id={manageId}>Manage</SidebarGroup>
                  <SidebarLink href="/dos" current count={24} describedBy={manageId}>
                    Users
                  </SidebarLink>
                  <SidebarLink href="/dos" count={6} describedBy={manageId}>
                    Groups
                  </SidebarLink>
                  <SidebarLink href="/dos" count={11} describedBy={manageId}>
                    Devices
                  </SidebarLink>
                  <SidebarGroup id={maintenanceId}>Maintenance</SidebarGroup>
                  <SidebarLink href="/dos" count={3} describedBy={maintenanceId}>
                    Backups
                  </SidebarLink>
                  <SidebarLink href="/dos" count={198} describedBy={maintenanceId}>
                    Logs
                  </SidebarLink>
                  <SidebarLink href="/dos" disabled disabledReason="locked">
                    Archive
                  </SidebarLink>
                </Sidebar>
                <ShellMain>
                  <BreadCrumbs label="Location" hint="C:\MANAGE\USERS">
                    <Crumb>C:</Crumb>
                    <Crumb>Manage</Crumb>
                    <Crumb>Users</Crumb>
                  </BreadCrumbs>
                  <Heading level={3} onScreen>
                    Users
                  </Heading>
                  <Text>
                    The sidebar stays put while this pane changes. The current section is filled and
                    marked on its left edge.
                  </Text>
                </ShellMain>
              </Shell>
            </Stage>

            <TabGroup defaultValue="details" label="Record">
              <TabList>
                <Tab value="details">Details</Tab>
                <Tab value="permissions">Permissions</Tab>
                <Tab value="history">History</Tab>
              </TabList>
              <TabPanel value="details">
                <Text>Maya Rodriguez — account created 04/12/1997, last seen this morning.</Text>
              </TabPanel>
              <TabPanel value="permissions">
                <Text>Read, write, and format. Cannot low-level format drive C:.</Text>
              </TabPanel>
              <TabPanel value="history">
                <Text>Fourteen sessions this month, none of them from a floppy.</Text>
              </TabPanel>
            </TabGroup>

            <Well flush>
              <ListBox defaultValue="autoexec" label="Files on drive C:">
                <ListBoxOption value="autoexec">
                  <span>AUTOEXEC.BAT</span>
                  <span>512 B</span>
                </ListBoxOption>
                <ListBoxOption value="config">
                  <span>CONFIG.SYS</span>
                  <span>288 B</span>
                </ListBoxOption>
                <ListBoxOption value="himem">
                  <span>HIMEM.SYS</span>
                  <span>29 KB</span>
                </ListBoxOption>
              </ListBox>
            </Well>
          </WindowBody>
        </Window>

        {/* ---- Boxes and loaders ---- */}
        <Window id="boxes" labelledBy="dos-boxes-title">
          <WindowBar title="Boxes and loaders" titleId="dos-boxes-title" aside="table · progress" />
          <WindowBody>
            <Window nested>
              <WindowBar title="Properties" aside="×" />
              <WindowBody>
                <Text>Raised edges: white top and left, dark bottom and right.</Text>
              </WindowBody>
            </Window>

            <Well>Recessed into the panel.</Well>

            <Terminal>
              {"C:\\> chkdsk /f\n  "}
              <TerminalTone tone="hi">Volume SYSTEM created 04/12/1997</TerminalTone>
              {"\n  "}
              <TerminalTone tone="ok">655,360 bytes total memory</TerminalTone>
              {"\n  "}
              <TerminalTone tone="err">! 2 lost clusters found</TerminalTone>
              {"\n  "}
              <TerminalTone tone="warn">Convert to files? </TerminalTone>
              {"Y"}
              <Cursor />
            </Terminal>

            <Scroll label="Files on drive C:">
              <Table caption="Files on drive C: with type and size">
                <TableHead>
                  <TableRow>
                    <TableHeadCell>File</TableHeadCell>
                    <TableHeadCell>Type</TableHeadCell>
                    <TableHeadCell>Size</TableHeadCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>COMMAND.COM</TableCell>
                    <TableCell>System</TableCell>
                    <TableCell numeric>54,619</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>README.TXT</TableCell>
                    <TableCell>Text</TableCell>
                    <TableCell numeric>1,204</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>KEEN.EXE</TableCell>
                    <TableCell>Program</TableCell>
                    <TableCell numeric>128,000</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Scroll>

            <Alert>Drive not ready. Insert a disk in drive A: and click Retry.</Alert>

            <Field>
              <FieldLabel>Copying files</FieldLabel>
              <Progress value={64} />
              <FieldDescription>64% — 128 of 200 files · 12 seconds remaining</FieldDescription>
            </Field>

            <LoaderTrain label="Scanning drive C:" />
            <Status>
              <Spinner /> Reading directory
            </Status>
          </WindowBody>
        </Window>

        {/* ---- Form ---- */}
        <Window id="form" labelledBy="dos-form-title">
          <WindowBar title="Form" titleId="dos-form-title" aside="label · input · checkbox" />
          <WindowBody>
            <Field>
              <FieldLabel>Volume label</FieldLabel>
              <TextInput value={form.volume} onChange={(next) => update("volume", next)} />
              <FieldDescription>
                Up to eleven characters. Spaces are allowed, but nothing else is.
              </FieldDescription>
            </Field>

            <Field invalid={pathInvalid}>
              <FieldLabel>Target path</FieldLabel>
              <TextInput value={form.path} onChange={(next) => update("path", next)} />
              <FieldError>
                A path cannot contain a question mark. Remove it and try again.
              </FieldError>
            </Field>

            <Field>
              <FieldLabel>File system</FieldLabel>
              <Select value={form.fileSystem} onChange={(next) => update("fileSystem", next)}>
                <option value="FAT16">FAT16</option>
                <option value="FAT32">FAT32</option>
                <option value="NTFS">NTFS</option>
              </Select>
              <FieldDescription>
                FAT16 caps the volume at 2 GB. Pick FAT32 for anything larger.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Notes</FieldLabel>
              <TextArea
                value={form.notes}
                rows={2}
                placeholder="Anything worth remembering about this disk"
                onChange={(next) => update("notes", next)}
              />
              <FieldDescription>
                Stored with the volume, never shown to anyone else.
              </FieldDescription>
            </Field>

            <CheckboxGroup
              legend="Options"
              description="Verification roughly doubles the time and catches bad sectors as they happen."
            >
              <Checkbox checked={form.verify} onChange={(next) => update("verify", next)}>
                Verify each write
              </Checkbox>
              <Checkbox checked={form.backup} onChange={(next) => update("backup", next)}>
                Create a backup copy
              </Checkbox>
              <Checkbox checked={false} disabled>
                Low-level format (needs admin)
              </Checkbox>
            </CheckboxGroup>

            <RadioGroup
              legend="Format type"
              value={form.formatType}
              onChange={(next) => update("formatType", next)}
            >
              <Radio value="quick">Quick — erase the file table only</Radio>
              <Radio value="full">Full — erase and check every sector</Radio>
              <Radio value="system">Copy system files only</Radio>
            </RadioGroup>

            <Field>
              <FieldLabel>{`Cluster size — ${form.clusterSize} KB`}</FieldLabel>
              <Range
                value={form.clusterSize}
                min={1}
                max={32}
                valueText={`${form.clusterSize} KB`}
                onChange={(next) => update("clusterSize", next)}
              />
              <FieldDescription>
                Larger clusters read faster and waste more space on small files.
              </FieldDescription>
            </Field>

            <Row>
              <Button>Start</Button>
              <Button variant="default">Cancel</Button>
              <Button variant="danger">Format</Button>
              <Button disabled>Restore</Button>
            </Row>
          </WindowBody>
        </Window>
      </div>
    </>
  );
}
