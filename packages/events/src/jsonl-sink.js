export function attachJsonlSink(events, { output = console.log } = {}) {
  return events.subscribe((event) => output(JSON.stringify(event)));
}
