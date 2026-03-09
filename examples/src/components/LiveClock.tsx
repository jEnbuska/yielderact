export function* LiveClock({ tick }: { tick: number }) {
  return <b data-testid="clock-time">{new Date(tick).toLocaleTimeString("en-US")}</b>;
}
