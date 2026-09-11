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
import type { Children, ComponentProps } from "yract";
import { useContext, useId } from "yract";
import { RadioGroupContext } from "./contexts";

export interface GroupProps extends ComponentProps<"fieldset"> {
  /** Names the group. Rendered as the fieldset legend. */
  legend: Children;
  /** Note under the choices, tied to the fieldset with `aria-describedby`. */
  description?: Children;
  /** Lay the choices out in a row instead of a column. */
  row?: boolean;
}

export function* CheckboxGroup({ legend, description, row, children, ...rest }: GroupProps) {
  const descriptionId = yield* useId();
  return (
    <fieldset
      {...rest}
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

export interface CheckboxProps extends ComponentProps<"input"> {
  checked: boolean;
  /** Receives the new state. The native `onChange` still passes through. */
  onCheckedChange?: (checked: boolean) => void;
}

export function* Checkbox({ checked, onCheckedChange, children, ...rest }: CheckboxProps) {
  return (
    <label className="dos-check">
      <input
        {...rest}
        className="dos-check__input dos-check__input--checkbox"
        type="checkbox"
        checked={checked}
        onChange={() => onCheckedChange?.(!checked)}
      />
      <span className="dos-check__text">{children}</span>
    </label>
  );
}

export interface RadioGroupProps extends GroupProps {
  /** Value of the selected radio. */
  value: string;
  /** Receives the new value. The native `onChange` still passes through. */
  onValueChange?: (value: string) => void;
}

export function* RadioGroup({
  legend,
  description,
  row,
  value,
  onValueChange,
  children,
  ...rest
}: RadioGroupProps) {
  const name = yield* useId();
  const descriptionId = yield* useId();

  function select(next: string): void {
    onValueChange?.(next);
  }

  return (
    <RadioGroupContext value={{ name, value, select }}>
      <fieldset
        {...rest}
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

export interface RadioProps extends ComponentProps<"input"> {
  value: string;
}

export function* Radio({ value, children, ...rest }: RadioProps) {
  const group = yield* useContext(RadioGroupContext);
  return (
    <label className="dos-check">
      <input
        {...rest}
        className="dos-check__input dos-check__input--radio"
        type="radio"
        name={group.name}
        value={value}
        checked={group.value === value}
        onChange={() => group.select(value)}
      />
      <span className="dos-check__text">{children}</span>
    </label>
  );
}
