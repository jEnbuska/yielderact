/**
 * Checkbox and radio — drawn in CSS rather than typed as `[X]` and `( )`, so
 * they stay real form controls that a screen reader and a keyboard understand.
 *
 * Composed:
 *   <CheckboxGroup legend="Options" description="…">
 *     <Checkbox checked={verify} onChange={…}>Verify each write</Checkbox>
 *   </CheckboxGroup>
 *
 *   <RadioGroup legend="Format type" value={mode} onChange={setMode}>
 *     <Radio value="quick">Quick</Radio>
 *   </RadioGroup>
 *
 * `RadioGroup` supplies the shared `name` and the selected value through
 * context, which is what makes the radios one group rather than three.
 */
import { $id, useContext } from "yract-beta";
import type { Children, PropsWithChildren } from "yract-beta";
import { RadioGroupContext } from "./contexts";

export interface GroupProps extends PropsWithChildren {
  /** Names the group. Rendered as the fieldset legend. */
  legend: Children;
  /** Note under the choices, tied to the fieldset with `aria-describedby`. */
  description?: Children;
  /** Lay the choices out in a row instead of a column. */
  row?: boolean;
}

export function* CheckboxGroup({ legend, description, row, children }: GroupProps) {
  const descriptionId = yield* $id();
  return (
    <fieldset
      className="dos-fieldset"
      aria-describedby={description === undefined ? undefined : descriptionId}
    >
      <legend className="dos-legend">{legend}</legend>
      <div className={row ? "dos-group dos-group--row" : "dos-group"}>{children}</div>
      {!!description && (
        <p className="dos-desc" id={descriptionId}>
          {description}
        </p>
      )}
    </fieldset>
  );
}

export interface CheckboxProps extends PropsWithChildren {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}

export function* Checkbox({ checked, onChange, disabled, children }: CheckboxProps) {
  return (
    <label className="dos-check">
      <input
        className="dos-check__input dos-check__input--checkbox"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={() => onChange?.(!checked)}
      />
      <span className="dos-check__text">{children}</span>
    </label>
  );
}

export interface RadioGroupProps extends GroupProps {
  /** Value of the selected radio. */
  value: string;
  onChange?: (value: string) => void;
}

export function* RadioGroup({
  legend,
  description,
  row,
  value,
  onChange,
  children,
}: RadioGroupProps) {
  const name = yield* $id();
  const descriptionId = yield* $id();

  function select(next: string): void {
    onChange?.(next);
  }

  return (
    <RadioGroupContext value={{ name, value, select }}>
      <fieldset
        className="dos-fieldset"
        aria-describedby={description === undefined ? undefined : descriptionId}
      >
        <legend className="dos-legend">{legend}</legend>
        <div className={row ? "dos-group dos-group--row" : "dos-group"}>{children}</div>
        {!!description && (
          <p className="dos-desc" id={descriptionId}>
            {description}
          </p>
        )}
      </fieldset>
    </RadioGroupContext>
  );
}

export interface RadioProps extends PropsWithChildren {
  value: string;
  disabled?: boolean;
}

export function* Radio({ value, disabled, children }: RadioProps) {
  const group = yield* useContext(RadioGroupContext);
  return (
    <label className="dos-check">
      <input
        className="dos-check__input dos-check__input--radio"
        type="radio"
        name={group.name}
        value={value}
        checked={group.value === value}
        disabled={disabled}
        onChange={() => group.select(value)}
      />
      <span className="dos-check__text">{children}</span>
    </label>
  );
}
